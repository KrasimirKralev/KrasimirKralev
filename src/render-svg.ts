import {
  CELL,
  CRAB_H,
  CRAB_W,
  PITCH,
  TEXT,
  banner,
  cabinetBody,
  deckCss,
  deckMarkup,
  defs,
  frameCss,
  headerCss,
  headerMarkup,
  hud,
  layout,
  poseMarkup,
  round,
  scoreDigits,
  screenCss,
  screenMarkup,
  screenOverlay,
  socketsMarkup,
  type Layout,
} from './cabinet';
import { SCREEN, type Palette } from './palette';
import { ADVANCE, BOOM, INVADER, glyphUse, pixelText } from './pixel-art';
import { mulberry32, seededOrder } from './shuffle';
import {
  APPROACH,
  MARCH_STEP,
  RESET_START,
  SWEEP_END,
  marchAt,
  planTimeline,
  poseChanges,
  type PoseChange,
  type Timeline,
} from './timeline';
import type { ContributionLevel, SweepPlan } from './types';

/** Optional HUD metadata. */
export interface RenderOptions {
  /** Date shown on the deck (e.g. "2026-06-09"). */
  date?: string;
  /** Seed for the day's firing order and missed shots. */
  seed?: number;
}

const LASER_H = 9;
const EPS = 0.02; // % between "hidden" and "shown" so the laser jumps instead of sliding
const BOOM_SPAN = 0.45; // % of the loop an explosion stays
const ROW_STAGGER = 0.7; // % between rows of the next wave flying in
const CONFETTI = 18;
const CLEAR_BLINK = 0.6; // % of the loop per ROUND CLEAR! blink

/** GitHub's greens, lifted so even a level-1 day shows up on the black screen. */
const INVADER_FILL = ['', '#238a43', '#2ea043', '#46d160', '#8bff9c'] as const;

const POSES = ['idle', 'runLeft', 'runRight', 'jump', 'failed'] as const;
type Pose = (typeof POSES)[number];

interface Commit {
  column: number;
  row: number;
  level: ContributionLevel;
}

/** Pixels to one decimal: plenty at README scale, and it keeps the file small. */
const px = (n: number): string => String(Math.round(n * 10) / 10);

/** A keyframes block from [percent, declarations] stops. */
const keyframes = (name: string, stops: [number, string][]): string =>
  `@keyframes ${name}{${stops.map(([t, css]) => `${round(t)}%{${css}}`).join('')}}`;

/** Render a complete, self-animating, camo-safe SVG for one year of contributions. */
export function renderSvg(plan: SweepPlan, p: Palette, opts: RenderOptions = {}): string {
  const l = layout(plan.columns);
  const seed = opts.seed ?? 1;
  const h = hud(l);
  const digits = scoreDigits(plan.totalCells);
  const homeX = l.glass.x + l.glass.w / 2;
  const ship = (poses: string) =>
    `<g class="ship" transform="translate(${round(homeX)} 0)">` +
    `<g transform="translate(${round(-CRAB_W / 2)} ${round(l.shipTop)})"><g class="recoil">${poses}</g></g></g>`;

  const staticCss = [
    headerCss(l),
    deckCss(),
    screenCss(l),
    frameCss(),
    `.pose{opacity:0}.shown{opacity:1}`,
    // The <use> inside spans the whole sprite sheet, so fill-box would scale around
    // the sheet; pin the origin to the ship's feet in its own coordinates instead.
    `.recoil{transform-box:view-box;transform-origin:${round(CRAB_W / 2)}px ${round(CRAB_H)}px}`,
  ];
  const scene = [
    defs(l, p, opts.date),
    cabinetBody(l, p),
    headerMarkup(l, p),
    screenMarkup(l, seed),
    deckMarkup(l, p, plan.totalCells, opts.date),
  ];

  // --- No contributions: an empty sky, the ship patrolling -----------------------
  if (plan.isEmpty) {
    const style = [
      ...staticCss,
      `.progress{transform:scaleX(0)}`,
      `.ship{animation:patrol 6s ease-in-out infinite}`,
      `@keyframes patrol{0%,100%{transform:translateX(${round(l.gridLeft + 30)}px)}50%{transform:translateX(${round(l.gridLeft + l.gridW - 30)}px)}}`,
    ].join('');
    return [
      svgOpen(l, 'An empty contribution graph: no invaders today'),
      `<style>${style}</style>`,
      ...scene,
      `<g filter="url(#bloom)">${pixelText('0'.repeat(digits), h.scoreX, h.scoreY, { px: h.scorePx, fill: SCREEN.phosphor, cls: 'score' })}</g>`,
      socketsMarkup(l),
      ship(poseMarkup('idle', CRAB_W, 'pose shown')),
      banner(l, TEXT.scanning, 'scanning blink', SCREEN.dim),
      screenOverlay(l),
      `</svg>`,
    ].join('');
  }

  // --- The day's firing order, and every shot's moments ------------------------
  const all: Commit[] = plan.steps.flatMap((step) =>
    step.cells.map((cell) => ({ column: step.column, row: cell.row, level: cell.level })),
  );
  const order = seededOrder(all.length, seed).map((i) => all[i]!);
  const timeline = planTimeline(order.length, seed);
  const dur = `${round(timeline.durationS)}s`;
  const aims = aimShots(order, timeline, l, homeX);
  const changes = poseChanges(timeline, aims.dirs, Math.sign(homeX - aims.lastX));
  const usedPoses = POSES.filter((pose) => changes.some((c) => c.pose === pose));

  const cellX = (col: number) => l.gridLeft + col * PITCH;
  const cellY = (row: number) => l.gridTop + row * PITCH;
  const invX = (CELL - INVADER.w) / 2;
  const invY = (CELL - INVADER.h) / 2;
  const invaders = order
    .map((c, j) => {
      const x = round(cellX(c.column) + invX);
      const y = round(cellY(c.row) + invY);
      const fill = INVADER_FILL[c.level];
      return (
        `<g class="h${j}"><use href="#invA" class="fa" x="${x}" y="${y}" fill="${fill}"/>` +
        `<use href="#invB" class="fb" x="${x}" y="${y}" fill="${fill}"/></g>`
      );
    })
    .join('');
  const booms = order
    .map(
      (c, j) =>
        `<use href="#boom" class="bm x${j}" x="${round(cellX(c.column) + (CELL - BOOM.w) / 2)}" ` +
        `y="${round(cellY(c.row) + (CELL - BOOM.h) / 2)}" fill="${SCREEN.gold}"/>`,
    )
    .join('');

  const counter = scoreCounter(timeline, h, digits);
  const fireworks = confettiBurst(l, p, seed);

  const style = [
    ...staticCss,
    `.wave{animation:wave ${dur} step-end infinite}`,
    `.ship{animation:ship ${dur} ease-in-out infinite}`,
    `.recoil{animation:recoil ${dur} linear infinite}`,
    `.laser{animation:laser ${dur} linear infinite}`,
    `.progress{animation:progress ${dur} linear infinite}`,
    `.ready{opacity:0;animation:ready ${dur} step-end infinite}`,
    `.round-clear{opacity:0;animation:clear ${dur} step-end infinite}`,
    `.bm{opacity:0}`,
    ...usedPoses.map((pose) => `.pose-${pose}{animation:v-${pose} ${dur} step-end infinite}`),
    ...order.map((_, j) => `.h${j}{animation:h${j} ${dur} step-end infinite}.x${j}{animation:x${j} ${dur} step-end infinite}`),
    counter.css(dur),
    fireworks.css(dur),
    keyframes('wave', waveFrames()),
    keyframes('ship', aims.ship),
    keyframes('recoil', aims.recoil),
    keyframes('laser', aims.laser),
    keyframes('progress', progressFrames(timeline)),
    keyframes('ready', [[0, 'opacity:1'], [APPROACH, 'opacity:0']]),
    keyframes('clear', clearFrames()),
    ...usedPoses.map((pose) => keyframes(`v-${pose}`, visibilityFrames(changes, pose))),
    ...order.map((c, j) => invaderFrames(j, c, timeline)),
  ].join('');

  const poses = usedPoses.map((pose) => poseMarkup(pose, CRAB_W)).join('');
  return [
    svgOpen(l, `The ClawBox crab shooting down ${plan.totalCells} contribution invaders`),
    `<style>${style}</style>`,
    ...scene,
    counter.markup,
    // The whole year marches as one formation: empty days, invaders and their explosions.
    `<g class="wave">${socketsMarkup(l)}${invaders}${booms}</g>`,
    `<rect class="laser" x="-1" y="0" width="2" height="${LASER_H}" fill="${SCREEN.white}" filter="url(#bloom)"/>`,
    ship(poses),
    fireworks.markup,
    banner(l, TEXT.ready, 'ready', SCREEN.white),
    banner(l, TEXT.clear, 'round-clear', SCREEN.gold),
    // The CRT glass goes over everything on the screen.
    screenOverlay(l),
    `</svg>`,
  ].join('');
}

// --- Aiming: where the ship stands, and the laser, for every shot ---------------

function aimShots(order: Commit[], t: Timeline, l: Layout, homeX: number) {
  const colX = (col: number) => l.gridLeft + col * PITCH + CELL / 2;
  const laserTop = l.shipTop - LASER_H + 6; // leaves from between the claws
  const offTop = l.glass.y - LASER_H - 4;
  const x = (v: number): string => `transform:translateX(${px(v)}px)`;
  const at = (lx: number, ly: number): string => `transform:translate(${px(lx)}px,${px(ly)}px)`;

  const ship: [number, string][] = [[0, x(homeX)]];
  const laser: [number, string][] = [[0, `opacity:0;${at(homeX, laserTop)}`]];
  const recoil: [number, string][] = [[0, 'transform:scale(1)']];
  const dirs: { main: number; miss?: number }[] = [];
  const bolt = (bx: number, fire: number, end: number, endY: number) => {
    laser.push(
      [fire - EPS, `opacity:0;${at(bx, laserTop)}`],
      [fire, `opacity:1;${at(bx, laserTop)}`],
      [end, `opacity:1;${at(bx, endY)}`],
      [end + EPS, `opacity:0;${at(bx, endY)}`],
    );
    recoil.push([fire - 0.1, 'transform:scale(1)'], [fire, 'transform:scale(1.06,.9)'], [fire + 0.15, 'transform:scale(1)']);
  };

  let prev = homeX;
  t.shots.forEach((s, j) => {
    const c = order[j]!;
    // Aim where the invader will be when the laser arrives: the formation marches.
    const m = marchAt(s.hit);
    const fireX = colX(c.column) + m.x;
    const hitY = l.gridTop + c.row * PITCH + m.y + (CELL + INVADER.h) / 2 - 2;
    ship.push([s.start, x(prev)]);
    if (s.miss) {
      // A near miss: the laser slips through the gap beside the invader.
      const wrongX = fireX + (j % 2 === 0 ? PITCH / 2 : -PITCH / 2);
      ship.push([s.miss.aim, x(wrongX)], [s.miss.reaim, x(wrongX)]);
      bolt(wrongX, s.miss.fire, s.miss.top, offTop);
      dirs.push({ miss: Math.sign(wrongX - prev), main: Math.sign(fireX - wrongX) });
    } else {
      dirs.push({ main: Math.sign(fireX - prev) });
    }
    ship.push([s.aim, x(fireX)]);
    bolt(fireX, s.fire, s.hit, hitY);
    prev = fireX;
  });

  ship.push([RESET_START, x(prev)], [100, x(homeX)]);
  laser.push([100, `opacity:0;${at(homeX, laserTop)}`]);
  recoil.push([100, 'transform:scale(1)']);
  return { ship, laser, recoil, dirs, lastX: prev };
}

/** The formation's march, step by step, across the whole loop. */
function waveFrames(): [number, string][] {
  const stops: [number, string][] = [];
  let last = '';
  for (let k = 0; k * MARCH_STEP < 100; k++) {
    const m = marchAt(k * MARCH_STEP);
    const css = `transform:translate(${m.x}px,${m.y}px)`;
    if (css !== last) stops.push([k * MARCH_STEP, css]);
    last = css;
  }
  stops.push([100, 'transform:translate(0px,0px)']);
  return stops;
}

/** An invader stays until its hit, explodes, and returns with its row for the next wave. */
function invaderFrames(j: number, c: Commit, t: Timeline): string {
  const s = t.shots[j]!;
  return (
    keyframes(`h${j}`, [
      [0, 'opacity:1'],
      [s.hit, 'opacity:0'],
      [RESET_START + c.row * ROW_STAGGER, 'opacity:1'],
    ]) +
    keyframes(`x${j}`, [
      [0, 'opacity:0'],
      [s.hit, 'opacity:1'],
      [Math.min(s.hit + BOOM_SPAN, s.done), 'opacity:0'],
    ])
  );
}

/** Each pose shows only while it is the ship's current pose. */
function visibilityFrames(changes: PoseChange[], pose: Pose): [number, string][] {
  const stops: [number, string][] = [];
  let shown: boolean | undefined;
  for (const c of changes) {
    const now = c.pose === pose;
    if (now !== shown) stops.push([c.at, `opacity:${now ? 1 : 0}`]);
    shown = now;
  }
  stops.push([100, `opacity:${changes[0]!.pose === pose ? 1 : 0}`]);
  return stops;
}

/** The deck's progress bar fills with each hit, and empties for the next wave. */
function progressFrames(t: Timeline): [number, string][] {
  const total = t.shots.length;
  return [
    [0, 'transform:scaleX(0)'],
    ...t.shots.map((s, j): [number, string] => [s.hit, `transform:scaleX(${round((j + 1) / total)})`]),
    [RESET_START, 'transform:scaleX(1)'],
    [100, 'transform:scaleX(0)'],
  ];
}

/** ROUND CLEAR! blinks from the last hit until the next wave. */
function clearFrames(): [number, string][] {
  const stops: [number, string][] = [[0, 'opacity:0']];
  let on = true;
  for (let t = SWEEP_END; t < RESET_START; t += CLEAR_BLINK) {
    stops.push([t, `opacity:${on ? 1 : 0}`]);
    on = !on;
  }
  stops.push([RESET_START, 'opacity:0']);
  return stops;
}

/**
 * SCORE<1>, counting up with each hit: one glyph per digit place and value,
 * each shown only while that place reads that digit. (SVG cannot animate text,
 * and a pre-drawn number per total would cost far more.)
 */
function scoreCounter(t: Timeline, h: ReturnType<typeof hud>, digits: number) {
  const total = t.shots.length;
  const startOf = [0, ...t.shots.map((s) => s.hit)]; // when the score becomes v
  const uses: string[] = [];
  const rules: string[] = [];
  for (let place = 0; place < digits; place++) {
    const pow = 10 ** (digits - 1 - place);
    const digitOf = (v: number) => Math.floor(v / pow) % 10;
    for (let d = 0; d <= 9; d++) {
      const stops: [number, string][] = [];
      let shown: boolean | undefined;
      for (let v = 0; v <= total; v++) {
        const now = digitOf(v) === d;
        if (now !== shown) stops.push([startOf[v]!, `opacity:${now ? 1 : 0}`]);
        shown = now;
      }
      if (!stops.some(([, css]) => css === 'opacity:1')) continue; // never shows
      const cls = `c${place}${d}`;
      uses.push(glyphUse(String(d), place * ADVANCE, `sc ${cls}`));
      rules.push(
        stops.length === 1
          ? `.${cls}{opacity:1}` // a place that never changes, like the leading zeros
          : `.${cls}{animation:${cls} DUR step-end infinite}` +
              keyframes(cls, [...stops, [100, `opacity:${digitOf(0) === d ? 1 : 0}`]]),
      );
    }
  }
  return {
    // No bloom on the live score: the digits read crisper without it.
    markup:
      `<g class="score" fill="${SCREEN.phosphor}" ` +
      `transform="translate(${round(h.scoreX)} ${round(h.scoreY)}) scale(${h.scorePx})">${uses.join('')}</g>`,
    css: (dur: string) => `.sc{opacity:0}` + rules.join('').replace(/DUR/g, dur),
  };
}

/** Fireworks over the cleared sky when the wave is done. */
function confettiBurst(l: Layout, p: Palette, seed: number) {
  const rng = mulberry32(seed ^ 0xc0f);
  const x0 = l.gridLeft + l.gridW / 2;
  const y0 = l.gridTop + l.gridH / 2;
  const colors = [p.accent, SCREEN.gold, SCREEN.phosphor, SCREEN.red, SCREEN.white];
  const markup: string[] = [];
  const frames: string[] = [];
  for (let i = 0; i < CONFETTI; i++) {
    const a = (i / CONFETTI) * Math.PI * 2;
    const r = 70 + rng() * 90;
    const dx = Math.cos(a) * r * 1.8;
    const dy = Math.sin(a) * r * 0.55;
    markup.push(
      `<rect class="cf cf${i}" x="${round(x0 - 2)}" y="${round(y0 - 2)}" width="4" height="4" fill="${colors[i % colors.length]}"/>`,
    );
    frames.push(
      keyframes(`cf${i}`, [
        [0, 'opacity:0;transform:translate(0,0)'],
        [SWEEP_END, 'opacity:0;transform:translate(0,0)'],
        [SWEEP_END + 0.3, 'opacity:1;transform:translate(0,0)'],
        [SWEEP_END + 2.4, `opacity:1;transform:translate(${round(dx)}px,${round(dy)}px)`],
        [RESET_START, `opacity:0;transform:translate(${round(dx * 1.1)}px,${round(dy + 30)}px)`],
        [100, 'opacity:0;transform:translate(0,0)'],
      ]),
    );
  }
  return {
    markup: `<g class="fireworks">${markup.join('')}</g>`,
    css: (dur: string) =>
      `.cf{opacity:0}` +
      Array.from({ length: CONFETTI }, (_, i) => `.cf${i}{animation:cf${i} ${dur} linear infinite}`).join('') +
      frames.join(''),
  };
}

function svgOpen(l: Layout, label: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${l.width}" height="${round(l.height)}" ` +
    `viewBox="0 0 ${l.width} ${round(l.height)}" role="img" aria-label="${label}">`
  );
}
