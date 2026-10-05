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
  panel,
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
import { ADVANCE, BOOM, INVADER, SAUCER, glyphUse, pixelText } from './pixel-art';
import { mulberry32 } from './shuffle';
import {
  APPROACH,
  MARCH_RANGE,
  RESET_START,
  SWEEP_END,
  marchAt,
  planMarch,
  pickMisses,
  planTimeline,
  poseChanges,
  type MarchStep,
  type Moves,
  type PoseChange,
  type Timeline,
} from './timeline';
import type { ContributionLevel, SweepPlan } from './types';

/** Optional HUD metadata. */
export interface RenderOptions {
  /** Date shown on the deck (e.g. "2026-06-09"). */
  date?: string;
  /** Seed for the day's missed shots, bombs, stars and fireworks (the firing order is fixed). */
  seed?: number;
}

const LASER_H = 9;
const EPS = 0.02; // % between "hidden" and "shown" so things jump instead of sliding
const BOOM_SPAN = 0.45; // % of the loop an explosion stays
const POPUP_SPAN = 1.2; // % a "+30" floats up for
const COMBO_EVERY = 10; // hits in a row for a COMBO popup
const COMBO_SPAN = 1.6;
const ROW_STAGGER = 0.7; // % between rows of the next wave flying in
const LIVES = 3;
const MYSTERY_POINTS = 300;
const BOMB_EVERY = 2.2; // % between invader bombs
const BOMB_FALL = 1.4; // % a bomb takes to reach the ground
const BOMB_CLEAR = 36; // px a harmless bomb keeps away from the ship
const SAUCER_PX = 2;
const SAUCER_CROSS = 7;
const MIN_STEP = 2; // px: even a shot up the same column gets a tiny walk, never a jump
const PLAN_PASSES = 4; // % of the loop the saucer takes to cross the whole screen
const CONFETTI = 22;

const POSES = ['idle', 'runLeft', 'runRight', 'jump', 'failed'] as const;
type Pose = (typeof POSES)[number];

interface Commit {
  column: number;
  row: number;
  level: ContributionLevel;
}

type Stop = [number, string];

/** Pixels to one decimal: plenty at README scale, and it keeps the file small. */
const px = (n: number): string => String(Math.round(n * 10) / 10);
const at = (x: number, y: number): string => `transform:translate(${px(x)}px,${px(y)}px)`;

/** A keyframes block from [percent, declarations] stops. */
const keyframes = (name: string, stops: Stop[]): string =>
  `@keyframes ${name}{${stops.map(([t, css]) => `${round(t)}%{${css}}`).join('')}}`;

/** Shown from `from` until `to`, hidden otherwise (for step-end animations). */
const shownBetween = (from: number, to: number): Stop[] => [
  [0, 'opacity:0'],
  [from, 'opacity:1'],
  [to, 'opacity:0'],
];

/** Render a complete, self-animating, camo-safe SVG for one year of contributions. */
export function renderSvg(plan: SweepPlan, p: Palette, opts: RenderOptions = {}): string {
  const l = layout(plan.columns);
  const seed = opts.seed ?? 1;
  const h = hud(l);
  const ship = (poses: string, homeX: number) =>
    `<g class="ship" transform="translate(${round(homeX)} 0)"><g class="respawn">` +
    `<g transform="translate(${round(-CRAB_W / 2)} ${round(l.shipTop)})"><g class="recoil">${poses}</g></g></g></g>`;

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
  const livesText = (lives: number) => pixelText(String(lives), l.glass.x + 16, l.groundY + 8, { px: 1.2, fill: SCREEN.white });

  // --- No contributions: an empty sky, the ship patrolling -----------------------
  if (plan.isEmpty) {
    const digits = scoreDigits(0);
    const style = [
      ...staticCss,
      `.progress{transform:scaleX(0)}`,
      `.ship{animation:patrol 6s ease-in-out infinite}`,
      `@keyframes patrol{0%,100%{transform:translateX(${round(l.gridLeft + 30)}px)}50%{transform:translateX(${round(l.gridLeft + l.gridW - 30)}px)}}`,
    ].join('');
    return [
      svgOpen(l, 'An empty contribution graph: no invaders today'),
      `<style>${style}</style>`,
      defs(l, p, [opts.date ?? '']),
      cabinetBody(l, p),
      headerMarkup(l, p),
      screenMarkup(l, seed),
      deckMarkup(l, p, 0, opts.date),
      pixelText('0'.repeat(digits), h.scoreX, h.scoreY, { px: h.scorePx, fill: SCREEN.phosphor, cls: 'score' }),
      livesText(LIVES),
      socketsMarkup(l),
      ship(poseMarkup('idle', CRAB_W, 'pose shown'), l.glass.x + l.glass.w / 2),
      banner(l, TEXT.scanning, 'scanning blink', SCREEN.dim),
      screenOverlay(l),
      `</svg>`,
    ].join('');
  }

  // --- The wave: firing order, every event's moments, the formation's march -------
  const all: Commit[] = plan.steps.flatMap((step) =>
    step.cells.map((cell) => ({ column: step.column, row: cell.row, level: cell.level })),
  );
  const order = firingOrder(all);
  const { t, march, homeX } = planShots(order, l, seed);
  const dur = `${round(t.durationS)}s`;
  const g = geometry(l, march);
  const play = playWave(order, t, g, homeX, seed);
  const changes = poseChanges(t, play.moves);
  const usedPoses = POSES.filter((pose) => changes.some((c) => c.pose === pose));

  // Points: every invader by its colour, plus the mystery saucer.
  const points = order.map((c) => SCREEN.points[c.level]);
  const scoreEvents: [number, number][] = [
    ...t.shots.map((s, j): [number, number] => [s.hit, points[j]!]),
    ...(t.bonus ? [[t.bonus.hit, MYSTERY_POINTS] as [number, number]] : []),
  ].sort((a, b) => a[0] - b[0]);
  const maxScore = scoreEvents.reduce((a, [, v]) => a + v, 0);
  const digits = scoreDigits(maxScore);

  // --- The formation: invaders, their explosions, empty days --------------------
  const invaders = order
    .map((c, j) => {
      const x = round(g.cellLeft(c.column) + (CELL - INVADER.w) / 2);
      const y = round(g.cellTop(c.row) + (CELL - INVADER.h) / 2);
      const fill = SCREEN.invader[c.level];
      return (
        `<g class="h${j}"><use href="#invA" class="la" x="${x}" y="${y}" fill="${fill}"/>` +
        `<use href="#invB" class="lb" x="${x}" y="${y}" fill="${fill}"/></g>`
      );
    })
    .join('');
  const booms = order
    .map(
      (c, j) =>
        `<use href="#boom" class="ex x${j}" x="${round(g.cellLeft(c.column) + (CELL - BOOM.w) / 2)}" ` +
        `y="${round(g.cellTop(c.row) + (CELL - BOOM.h) / 2)}" fill="${SCREEN.invader[c.level]}"/>`,
    )
    .join('');

  // --- Popups: points on every hit, combos, the saucer bonus ---------------------
  const popups: string[] = [];
  const popupCss: string[] = [];
  const texts: string[] = [opts.date ?? ''];
  // The class sits on an outer group: an animated transform would replace pixelText's own.
  const float = (cls: string, from: number): string =>
    `.${cls}{animation:${cls} ${dur} linear infinite}` +
    keyframes(cls, [
      [0, `opacity:0;${at(0, 0)}`],
      [from - EPS, `opacity:0;${at(0, 0)}`],
      [from, `opacity:1;${at(0, 0)}`],
      [from + POPUP_SPAN, `opacity:0;${at(0, -14)}`],
    ]);
  t.shots.forEach((s, j) => {
    const text = `+${points[j]}`;
    texts.push(text);
    const [x, y] = play.hitAt[j]!;
    popups.push(`<g class="pp p${j}">${pixelText(text, x, y - 16, { px: 1.2, fill: SCREEN.invader[order[j]!.level], anchor: 'middle' })}</g>`);
    popupCss.push(float(`p${j}`, s.hit));
  });
  if (t.bonus && play.bonusAt) {
    const text = `+${MYSTERY_POINTS}`;
    texts.push(text);
    popups.push(`<g class="pp pbonus">${pixelText(text, play.bonusAt[0], play.bonusAt[1] + 4, { px: 2, fill: SCREEN.gold, anchor: 'middle' })}</g>`);
    popupCss.push(float('pbonus', t.bonus.hit));
  }
  const combos = comboMoments(t);
  combos.forEach(([moment, streak], k) => {
    const text = `${TEXT.combo}${streak}!`;
    texts.push(text);
    popups.push(
      pixelText(text, l.gridLeft + l.gridW / 2, l.gridTop + l.gridH + MARCH_RANGE.y + 18, {
        px: 2,
        fill: SCREEN.nebulaA,
        anchor: 'middle',
        cls: `cb c${k}x`,
      }),
    );
    popupCss.push(`.c${k}x{animation:c${k}x ${dur} step-end infinite}` + keyframes(`c${k}x`, shownBetween(moment, moment + COMBO_SPAN)));
  });

  // --- ROUND CLEAR! with the wave's stats ----------------------------------------
  const misses = t.shots.filter((s) => s.miss).length;
  const accuracy = Math.round((100 * t.shots.length) / (t.shots.length + misses));
  const statLines = [
    { text: TEXT.clear, px: 3, fill: SCREEN.gold, cls: 'blink' },
    { text: `${TEXT.hits} ${t.shots.length}  ${TEXT.accuracy} ${accuracy}%`, px: 1.6, fill: SCREEN.white },
    { text: `${TEXT.streak} ${longestStreak(plan)} ${TEXT.days}`, px: 1.6, fill: SCREEN.invader[1] },
    ...(t.bonus ? [{ text: `${TEXT.mystery} +${MYSTERY_POINTS}`, px: 1.6, fill: SCREEN.red }] : []),
  ];
  texts.push(...statLines.map((s) => s.text));

  // --- Lives: lost when a bomb gets through, back for the next wave -------------
  const lifeIcons = Array.from({ length: LIVES }, (_, i) =>
    `<g transform="translate(${round(l.glass.x + 30 + i * 20)} ${round(l.groundY + 5)})">${poseMarkup('idle', 16, `life l${i}`)}</g>`,
  ).join('');
  const lifeCss = Array.from({ length: LIVES }, (_, i) => {
    const lost = t.deaths[LIVES - 1 - i]; // the last icon goes first
    return lost
      ? `.l${i}{animation:l${i} ${dur} step-end infinite}` + keyframes(`l${i}`, [[0, 'opacity:1'], [lost.impact, 'opacity:0']])
      : '';
  }).join('');
  const livesEvents: [number, number][] = t.deaths.map((d) => [d.impact, -1]);

  const score = digitCounter('s', scoreEvents, 0, digits);
  const lives = digitCounter('v', livesEvents, LIVES, 1);
  const fireworks = confettiBurst(l, p, seed);

  const style = [
    ...staticCss,
    `.wave{animation:wave ${dur} step-end infinite}`,
    `.la{animation:legs-a ${dur} step-end infinite}.lb{animation:legs-b ${dur} step-end infinite}`,
    // Linear: the ship walks at one steady pace; each move's time already matches its distance.
    `.ship{animation:ship ${dur} linear infinite}`,
    `.respawn{animation:respawn ${dur} step-end infinite}`,
    `.recoil{animation:recoil ${dur} linear infinite}`,
    `.laser{animation:laser ${dur} linear infinite}`,
    `.ufo{animation:ufo ${dur} linear infinite}`,
    `.progress{animation:progress ${dur} linear infinite}`,
    `.ready{opacity:0;animation:ready ${dur} step-end infinite}`,
    `.round-clear{opacity:0;animation:clear ${dur} step-end infinite}`,
    `.ex,.pp,.cb,.bomb,.splat{opacity:0}`,
    ...usedPoses.map((pose) => `.pose-${pose}{animation:v-${pose} ${dur} step-end infinite}`),
    ...order.map((_, j) => `.h${j}{animation:h${j} ${dur} step-end infinite}.x${j}{animation:x${j} ${dur} step-end infinite}`),
    score.css(dur),
    lives.css(dur),
    lifeCss,
    fireworks.css(dur),
    play.bombs.css(dur),
    ...popupCss,
    keyframes('wave', waveFrames(march)),
    keyframes('legs-a', legFrames(march, 0)),
    keyframes('legs-b', legFrames(march, 1)),
    keyframes('ship', play.ship),
    keyframes('respawn', respawnFrames(t)),
    keyframes('recoil', play.recoil),
    keyframes('laser', play.laser),
    keyframes('ufo', play.ufo),
    keyframes('progress', progressFrames(t)),
    keyframes('ready', [[0, 'opacity:1'], [APPROACH, 'opacity:0']]),
    keyframes('clear', shownBetween(SWEEP_END, RESET_START)),
    ...usedPoses.map((pose) => keyframes(`v-${pose}`, visibilityFrames(changes, pose))),
    ...order.map((c, j) => invaderFrames(j, c, t)),
  ].join('');

  const poses = usedPoses.map((pose) => poseMarkup(pose, CRAB_W)).join('');
  return [
    svgOpen(l, `The ClawBox crab shooting down ${plan.totalCells} contribution invaders`),
    `<style>${style}</style>`,
    defs(l, p, texts),
    cabinetBody(l, p),
    headerMarkup(l, p),
    screenMarkup(l, seed),
    deckMarkup(l, p, maxScore, opts.date),
    score.markup(h.scoreX, h.scoreY, h.scorePx, SCREEN.phosphor),
    lives.markup(l.glass.x + 16, l.groundY + 8, 1.2, SCREEN.white),
    lifeIcons,
    // The whole year marches as one formation: empty days, invaders and their explosions.
    `<g class="wave">${socketsMarkup(l)}${invaders}${booms}</g>`,
    play.ufoMarkup,
    play.bombs.markup,
    `<rect class="laser" x="-1" y="0" width="2" height="${LASER_H}" fill="${SCREEN.laser}" filter="url(#bloom)"/>`,
    ship(poses, homeX),
    play.deathMarkup,
    popups.join(''),
    fireworks.markup,
    banner(l, TEXT.ready, 'ready', SCREEN.white),
    panel(l, statLines, 'round-clear'),
    // The CRT glass goes over everything on the screen.
    screenOverlay(l),
    `</svg>`,
  ].join('');
}

// --- Geometry ----------------------------------------------------------------------

interface Geometry {
  l: Layout;
  march: MarchStep[];
  cellLeft: (col: number) => number;
  cellTop: (row: number) => number;
  /** Where an invader's centre is at a moment, marching included. */
  invaderAt: (c: Commit, pct: number) => [number, number];
}

function geometry(l: Layout, march: MarchStep[]): Geometry {
  const cellLeft = (col: number) => l.gridLeft + col * PITCH;
  const cellTop = (row: number) => l.gridTop + row * PITCH;
  return {
    l,
    march,
    cellLeft,
    cellTop,
    invaderAt: (c, pct) => {
      const m = marchAt(march, pct);
      return [cellLeft(c.column) + CELL / 2 + m.x, cellTop(c.row) + CELL / 2 + m.y];
    },
  };
}

// --- Playing the wave: the ship, its laser, the saucer, the bombs ------------------

function playWave(order: Commit[], t: Timeline, g: Geometry, homeX: number, seed: number) {
  const { l } = g;
  const laserTop = l.shipTop - LASER_H + 6; // leaves from between the claws
  const offTop = l.glass.y - LASER_H - 4;
  const x = (v: number): string => `transform:translateX(${px(v)}px)`;

  const ship: Stop[] = [[0, x(homeX)]];
  const track: [number, number][] = [[0, homeX]]; // the ship's x over time, for aiming bombs
  const laser: Stop[] = [[0, `opacity:0;${at(homeX, laserTop)}`]];
  const recoil: Stop[] = [[0, 'transform:scale(1)']];
  const moves: Moves = { shots: [], home: 0 };
  const hitAt: [number, number][] = [];
  const moveTo = (when: number, toX: number) => {
    ship.push([when, x(toX)]);
    track.push([when, toX]);
  };
  const bolt = (bx: number, fire: number, end: number, endY: number) => {
    laser.push(
      [fire - EPS, `opacity:0;${at(bx, laserTop)}`],
      [fire, `opacity:1;${at(bx, laserTop)}`],
      [end, `opacity:1;${at(bx, endY)}`],
      [end + EPS, `opacity:0;${at(bx, endY)}`],
    );
    recoil.push([fire - 0.1, 'transform:scale(1)'], [fire, 'transform:scale(1.06,.9)'], [fire + 0.15, 'transform:scale(1)']);
  };

  // The mystery saucer flies left to right along the top; it is shot down mid-screen.
  const saucerW = SAUCER.w * SAUCER_PX;
  const saucerY = l.glass.y + 5;
  const ufo: Stop[] = [[0, `opacity:0;${at(l.glass.x - saucerW, saucerY)}`]];
  let ufoMarkup = '';
  let bonusAt: [number, number] | undefined;
  // It crosses at a steady speed, timed to be right over the ship when the laser arrives.
  const saucerStart = l.glass.x - saucerW;
  const saucerSpeed = (l.glass.w + saucerW) / SAUCER_CROSS; // px per % of the loop

  // Deaths: a bomb from the bottom of the formation falls on the ship where it stands.
  const deathParts: string[] = [];
  const deathCss: string[] = [];
  const lethal: Stop[][] = [];

  let prev = homeX;
  t.shots.forEach((s, j) => {
    const b = t.bonus;
    if (b && b.before === j) {
      const hitX = prev;
      const hitLeft = hitX - saucerW / 2;
      const enter = Math.max(APPROACH, b.hit - (hitLeft - saucerStart) / saucerSpeed);
      moveTo(b.start, prev);
      bolt(hitX, b.fire, b.hit, saucerY + SAUCER.h * SAUCER_PX - 2);
      ufo.push(
        [enter - EPS, `opacity:0;${at(saucerStart, saucerY)}`],
        [enter, `opacity:1;${at(saucerStart, saucerY)}`],
        [b.hit, `opacity:1;${at(hitLeft, saucerY)}`],
        [b.hit + EPS, `opacity:0;${at(hitLeft, saucerY)}`],
      );
      bonusAt = [hitX, saucerY];
      deathParts.push(
        `<use href="#boom" class="ex xufo" transform="translate(${round(hitX - BOOM.w)} ${round(saucerY)}) scale(2)" fill="${SCREEN.red}"/>`,
      );
      deathCss.push(`.xufo{animation:xufo DUR step-end infinite}` + keyframes('xufo', shownBetween(b.hit, b.hit + BOOM_SPAN * 2)));
    }

    const c = order[j]!;
    // Aim where the invader will be when the laser arrives: the formation marches.
    const [fireX, cy] = g.invaderAt(c, s.hit);
    const hitY = cy + INVADER.h / 2 - 2;
    hitAt.push([fireX, cy]);
    moveTo(s.start, prev);
    if (s.miss) {
      // A near miss: the laser slips through the gap beside the invader.
      const wrongX = missSpot(fireX, j);
      moveTo(s.miss.aim, wrongX);
      moveTo(s.miss.reaim, wrongX);
      bolt(wrongX, s.miss.fire, s.miss.top, offTop);
      moves.shots.push({ miss: Math.sign(wrongX - prev), main: Math.sign(fireX - wrongX) });
    } else {
      moves.shots.push({ main: Math.sign(fireX - prev) });
    }
    moveTo(s.aim, fireX);
    bolt(fireX, s.fire, s.hit, hitY);
    prev = fireX;

    for (const d of t.deaths.filter((dd) => dd.after === j)) {
      const k = lethal.length;
      const fromY = formationBottom(order, t, g, d.start);
      lethal.push([
        [0, `opacity:0;${at(prev, fromY)}`],
        [d.start - EPS, `opacity:0;${at(prev, fromY)}`],
        [d.start, `opacity:1;${at(prev, fromY)}`],
        [d.impact, `opacity:1;${at(prev, l.shipTop + 10)}`],
        [d.impact + EPS, `opacity:0;${at(prev, l.shipTop + 10)}`],
      ]);
      deathParts.push(
        `<use href="#boom" class="ex xd${k}" transform="translate(${round(prev - BOOM.w * 1.5)} ${round(l.shipTop + 4)}) scale(3)" fill="${SCREEN.red}"/>`,
      );
      deathCss.push(`.xd${k}{animation:xd${k} DUR step-end infinite}` + keyframes(`xd${k}`, shownBetween(d.impact, d.respawn - 0.1)));
      moveTo(d.start, prev);
    }
  });

  moves.home = Math.sign(homeX - prev);
  moveTo(RESET_START, prev);
  moveTo(100, homeX);
  laser.push([100, `opacity:0;${at(homeX, laserTop)}`]);
  recoil.push([100, 'transform:scale(1)']);
  ufo.push([100, `opacity:0;${at(l.glass.x - saucerW, saucerY)}`]);
  if (t.bonus) {
    ufoMarkup = `<g class="ufo"><use href="#saucer" transform="scale(${SAUCER_PX})" fill="${SCREEN.red}"/></g>`;
  }

  const bombs = invaderBombs(order, t, g, track, lethal, seed);
  return {
    ship,
    laser,
    recoil,
    ufo,
    ufoMarkup,
    moves,
    hitAt,
    bonusAt,
    bombs: {
      markup: bombs.markup,
      css: (dur: string) => bombs.css(dur) + deathCss.join('').replace(/DUR/g, dur),
    },
    deathMarkup: deathParts.join(''),
  };
}

/** Where a missed shot is fired from: the gap beside the invader. */
const missSpot = (x: number, j: number): number => x + (j % 2 === 0 ? PITCH / 2 : -PITCH / 2);

/**
 * Time every move by its true distance, so the ship walks at one steady pace.
 * The distance depends on where the formation has marched to by each hit, and
 * the march depends on the timing, so plan, measure, re-plan until it settles.
 */
function planShots(order: Commit[], l: Layout, seed: number) {
  const baseX = order.map((c) => l.gridLeft + c.column * PITCH + CELL / 2);
  const misses = pickMisses(order.length, seed);
  const walks = (xs: number[]) =>
    xs.map((x, j) => {
      const target = misses.has(j) ? missSpot(x, j) : x;
      return Math.max(MIN_STEP, Math.abs(target - (j === 0 ? xs[0]! : xs[j - 1]!)));
    });
  let xs = baseX;
  let t = planTimeline({ moves: walks(xs), reaimPx: PITCH / 2 }, seed);
  for (let pass = 0; pass < PLAN_PASSES; pass++) {
    const march = planMarch(t);
    xs = order.map((_, j) => baseX[j]! + marchAt(march, t.shots[j]!.hit).x);
    t = planTimeline({ moves: walks(xs), reaimPx: PITCH / 2 }, seed);
  }
  const march = planMarch(t);
  return { t, march, homeX: baseX[0]! + marchAt(march, t.shots[0]!.hit).x };
}

/**
 * The order a real player clears the year: across the screen and back, a steady
 * walk with no jumps. Even weeks on the way out, odd weeks on the way back, so the
 * ship ends near where it started; each column bottom-up, because a laser hits
 * the lowest invader in its path first.
 */
function firingOrder(all: Commit[]): Commit[] {
  const columns = [...new Set(all.map((c) => c.column))].sort((a, b) => a - b);
  const sweep = [...columns.filter((c) => c % 2 === 0), ...columns.filter((c) => c % 2 === 1).reverse()];
  return sweep.flatMap((col) => all.filter((c) => c.column === col).sort((a, b) => b.row - a.row));
}

/** The lowest invader still standing at a moment: bombs drop from the bottom of the formation. */
function formationBottom(order: Commit[], t: Timeline, g: Geometry, pct: number): number {
  let bottom = -Infinity;
  order.forEach((c, j) => {
    if (t.shots[j]!.hit > pct) bottom = Math.max(bottom, g.invaderAt(c, pct)[1] + INVADER.h / 2);
  });
  return Number.isFinite(bottom) ? bottom : g.l.gridTop + g.l.gridH;
}

/** Linear guess of where the ship is at a moment, from its stops. */
function shipXAt(track: [number, number][], pct: number): number {
  let i = 0;
  while (i < track.length - 1 && track[i + 1]![0] <= pct) i++;
  const [t0, x0] = track[i]!;
  const next = track[i + 1];
  if (!next) return x0;
  const [t1, x1] = next;
  return t1 === t0 ? x1 : x0 + ((x1 - x0) * (pct - t0)) / (t1 - t0);
}

/**
 * The invaders shoot back: every so often the lowest invader of a column still
 * standing drops a zig-zag bomb. These miss the ship (it keeps moving); the two
 * that hit it are planned in the timeline and passed in as `lethal`.
 */
function invaderBombs(
  order: Commit[],
  t: Timeline,
  g: Geometry,
  track: [number, number][],
  lethal: Stop[][],
  seed: number,
) {
  const { l } = g;
  const rng = mulberry32(seed ^ 0xb0b); // the day's own bombs
  const markup: string[] = [];
  const rules: ((dur: string) => string)[] = [];
  const busy = t.deaths.map((d) => [d.start - 1, d.done] as const);

  const addBomb = (cls: string, stops: Stop[], fill: string) => {
    markup.push(`<g class="bomb ${cls}"><use href="#bomb" transform="scale(1.6)" fill="${fill}"/></g>`);
    rules.push((dur) => `.${cls}{animation:${cls} ${dur} linear infinite}` + keyframes(cls, stops));
  };
  lethal.forEach((stops, k) => addBomb(`bl${k}`, stops, SCREEN.red));

  let k = 0;
  for (let tb = APPROACH + 2; tb < SWEEP_END - BOMB_FALL; tb += BOMB_EVERY * (0.7 + rng() * 0.6)) {
    const land = tb + BOMB_FALL;
    if (busy.some(([a, b]) => land >= a && tb <= b)) continue;
    // A column with an invader still standing, and its lowest invader.
    const standing = order.map((c, j) => [c, j] as const).filter(([, j]) => t.shots[j]!.hit > tb + 0.3);
    if (standing.length === 0) break;
    const [pick] = standing[Math.floor(rng() * standing.length)]!;
    const lowest = standing
      .filter(([c]) => c.column === pick.column)
      .reduce((a, b) => (b[0].row > a[0].row ? b : a));
    const [bx, by] = g.invaderAt(lowest[0], tb);
    if (Math.abs(bx - shipXAt(track, land)) < BOMB_CLEAR) continue;
    const groundY = l.groundY - BOMB_CLEAR / 4;
    addBomb(
      `bb${k}`,
      [
        [0, `opacity:0;${at(bx - 2, by)}`],
        [tb - EPS, `opacity:0;${at(bx - 2, by)}`],
        [tb, `opacity:1;${at(bx - 2, by)}`],
        [land, `opacity:1;${at(bx - 2, groundY)}`],
        [land + EPS, `opacity:0;${at(bx - 2, groundY)}`],
      ],
      SCREEN.gold,
    );
    // The ground takes the hit.
    markup.push(
      `<use href="#boom" class="splat s${k}x" transform="translate(${round(bx - 5)} ${round(l.groundY - 6)}) scale(.9)" fill="${SCREEN.red}"/>`,
    );
    const kk = k;
    rules.push((dur) => `.s${kk}x{animation:s${kk}x ${dur} step-end infinite}` + keyframes(`s${kk}x`, shownBetween(land, land + 0.5)));
    k++;
  }
  return { markup: markup.join(''), css: (dur: string) => rules.map((r) => r(dur)).join('') };
}

// --- Keyframe builders ---------------------------------------------------------------

/** The formation's march, step by step; home again for the next wave. */
function waveFrames(march: MarchStep[]): Stop[] {
  return [
    ...march.map((s): Stop => [s.at, `transform:translate(${s.x}px,${s.y}px)`]),
    [RESET_START, 'transform:translate(0px,0px)'],
  ];
}

/** The invaders' legs flip on every step of the march. */
function legFrames(march: MarchStep[], frame: 0 | 1): Stop[] {
  return [
    ...march.map((s): Stop => [s.at, `opacity:${s.frame === frame ? 1 : 0}`]),
    [RESET_START, `opacity:${frame === 0 ? 1 : 0}`],
  ];
}

/** An invader stays until its hit, explodes, and returns with its row for the next wave. */
function invaderFrames(j: number, c: Commit, t: Timeline): string {
  const s = t.shots[j]!;
  return (
    keyframes(`h${j}`, [
      [0, 'opacity:1'],
      [s.hit, 'opacity:0'],
      [RESET_START + c.row * ROW_STAGGER, 'opacity:1'],
    ]) + keyframes(`x${j}`, shownBetween(s.hit, Math.min(s.hit + BOOM_SPAN, s.done)))
  );
}

/** After a death the ship blinks while it is invulnerable, the arcade way. */
function respawnFrames(t: Timeline): Stop[] {
  const stops: Stop[] = [[0, 'opacity:1']];
  for (const d of t.deaths) {
    let on = false;
    for (let m = d.respawn; m < d.done; m += 0.25) {
      stops.push([m, `opacity:${on ? 1 : 0.15}`]);
      on = !on;
    }
    stops.push([d.done, 'opacity:1']);
  }
  return stops;
}

/** Each pose shows only while it is the ship's current pose ('dead' shows none). */
function visibilityFrames(changes: PoseChange[], pose: Pose): Stop[] {
  const stops: Stop[] = [];
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
function progressFrames(t: Timeline): Stop[] {
  const total = t.shots.length;
  return [
    [0, 'transform:scaleX(0)'],
    ...t.shots.map((s, j): Stop => [s.hit, `transform:scaleX(${round((j + 1) / total)})`]),
    [RESET_START, 'transform:scaleX(1)'],
    [100, 'transform:scaleX(0)'],
  ];
}

/** Every COMBO_EVERY hits in a row; a miss or a lost life breaks the streak. */
function comboMoments(t: Timeline): [number, number][] {
  const out: [number, number][] = [];
  let streak = 0;
  t.shots.forEach((s, j) => {
    if (s.miss) streak = 0;
    streak++;
    if (streak % COMBO_EVERY === 0) out.push([s.hit, streak]);
    if (t.deaths.some((d) => d.after === j)) streak = 0;
  });
  return out;
}

/** The longest run of days in a row with at least one contribution. */
function longestStreak(plan: SweepPlan): number {
  const days = plan.steps.flatMap((s) => s.cells.map((c) => s.column * 7 + c.row)).sort((a, b) => a - b);
  let best = 0;
  let run = 0;
  days.forEach((d, i) => {
    run = i > 0 && d === days[i - 1]! + 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/**
 * A number that changes over the loop (the score, the lives), built digit by
 * digit: one glyph per place and value, each shown only while that place reads
 * that digit. SVG cannot animate text, and a pre-drawn number per value would
 * cost far more.
 */
function digitCounter(prefix: string, deltas: [number, number][], start: number, digits: number) {
  const values: [number, number][] = [[0, start]];
  let v = start;
  for (const [moment, delta] of deltas) values.push([moment, (v += delta)]);
  const uses: string[] = [];
  const rules: string[] = [];
  for (let place = 0; place < digits; place++) {
    const pow = 10 ** (digits - 1 - place);
    const digitOf = (n: number) => Math.floor(n / pow) % 10;
    for (let d = 0; d <= 9; d++) {
      const stops: Stop[] = [];
      let shown: boolean | undefined;
      for (const [moment, n] of values) {
        const now = digitOf(n) === d;
        if (now !== shown) stops.push([moment, `opacity:${now ? 1 : 0}`]);
        shown = now;
      }
      if (!stops.some(([, css]) => css === 'opacity:1')) continue; // never shows
      const cls = `${prefix}${place}${d}`;
      uses.push(glyphUse(String(d), place * ADVANCE, `${prefix}g ${cls}`));
      rules.push(
        stops.length === 1
          ? `.${cls}{opacity:1}` // a place that never changes, like the leading zeros
          : `.${cls}{animation:${cls} DUR step-end infinite}` +
              keyframes(cls, [...stops, [100, `opacity:${digitOf(start) === d ? 1 : 0}`]]),
      );
    }
  }
  return {
    markup: (x: number, y: number, scale: number, fill: string) =>
      `<g class="${prefix === 's' ? 'score' : 'lives'}" fill="${fill}" ` +
      `transform="translate(${round(x)} ${round(y)}) scale(${scale})">${uses.join('')}</g>`,
    css: (dur: string) => `.${prefix}g{opacity:0}` + rules.join('').replace(/DUR/g, dur),
  };
}

/** Fireworks over the cleared sky when the wave is done. */
function confettiBurst(l: Layout, p: Palette, seed: number) {
  const rng = mulberry32(seed ^ 0xc0f);
  const x0 = l.gridLeft + l.gridW / 2;
  const y0 = l.gridTop + l.gridH / 2;
  const colors = [p.accent, ...SCREEN.invader.slice(1), SCREEN.white];
  const markup: string[] = [];
  const frames: string[] = [];
  for (let i = 0; i < CONFETTI; i++) {
    const a = (i / CONFETTI) * Math.PI * 2;
    const r = 80 + rng() * 110;
    const dx = Math.cos(a) * r * 2;
    const dy = Math.sin(a) * r * 0.6;
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
