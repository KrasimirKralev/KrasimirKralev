import {
  CELL,
  CRAB_H,
  CRAB_W,
  HOLD,
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
  pileSlots,
  poseMarkup,
  prizeBox,
  railMarkup,
  round,
  scoreDigits,
  screenCss,
  screenMarkup,
  screenOverlay,
  socketsMarkup,
  type Layout,
} from './cabinet';
import { SCREEN, type Palette } from './palette';
import { ADVANCE, glyphUse, pixelText } from './pixel-art';
import { mulberry32, seededOrder } from './shuffle';
import {
  APPROACH,
  RESET_START,
  SWEEP_END,
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
  /** Seed for the day's pickup order and missed grabs. */
  seed?: number;
}

const CARRY_LIFT = 6; // the crab hoists a commit this far above its parked height
const CABLE_LEN = 320; // longer than the deepest dip, cut off at the rail
const SLIP_HOIST = 0.55; // a missed grab gets this share of the way up before it falls
const SWING = 4; // degrees the crab swings past a stop
const CONFETTI = 18;
const CLEAR_BLINK = 0.6; // % of the loop per ROUND CLEAR! blink

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

/** Render a complete, self-animating, camo-safe SVG for one harvest plan. */
export function renderSvg(plan: SweepPlan, p: Palette, opts: RenderOptions = {}): string {
  const l = layout(plan.columns);
  const seed = opts.seed ?? 1;
  const h = hud(l);
  const digits = scoreDigits(plan.totalCells);
  const crabRigAt = (pose: string) =>
    `<g clip-path="url(#belowRail)"><g class="arm">` +
    `<rect x="-1" y="${round(l.armRest - CABLE_LEN)}" width="2" height="${CABLE_LEN}" fill="${p.hardware}"/>` +
    `<g transform="translate(${-CRAB_W / 2} ${round(l.armRest)})"><g class="squash">${pose}</g></g></g></g>`;
  const carriage =
    `<rect x="-13" y="${l.railY - 7}" width="26" height="14" rx="4" fill="url(#chrome)"/>` +
    `<rect x="-9" y="${l.railY - 1.5}" width="18" height="3" rx="1.5" fill="${p.accent}"/>`;

  const staticCss = [
    headerCss(l),
    deckCss(),
    screenCss(l),
    frameCss(),
    `.pose{opacity:0}.shown{opacity:1}`,
    `.cell{transform-box:fill-box;transform-origin:center}`,
    // The <use> inside spans the whole sprite sheet, so fill-box would scale around
    // the sheet; pin the origin to the crab's feet in its own coordinates instead.
    `.squash{transform-box:view-box;transform-origin:${round(CRAB_W / 2)}px ${round(CRAB_H)}px}`,
  ];
  const scene = [
    defs(l, p, opts.date),
    cabinetBody(l, p),
    headerMarkup(l, p),
    screenMarkup(l, seed),
    railMarkup(l, p),
    socketsMarkup(l),
    prizeBox(l, p),
    deckMarkup(l, p, plan.totalCells, opts.date),
  ];

  // --- Nothing to collect: the crab scans the empty grid ----------------------
  if (plan.isEmpty) {
    const mid = l.gridLeft + l.gridW / 2;
    const style = [
      ...staticCss,
      `.progress{transform:scaleX(0)}`,
      `.trolley{animation:scan 5s ease-in-out infinite}`,
      `@keyframes scan{0%,100%{transform:translateX(${round(l.gridLeft + 20)}px)}50%{transform:translateX(${round(l.gridLeft + l.gridW - 20)}px)}}`,
    ].join('');
    return [
      svgOpen(l, 'The ClawBox crab, scanning an empty contribution grid'),
      `<style>${style}</style>`,
      ...scene,
      `<g filter="url(#bloom)">${pixelText('0'.repeat(digits), h.scoreX, h.scoreY, { px: h.scorePx, fill: SCREEN.phosphor, cls: 'score' })}</g>`,
      `<g class="trolley" transform="translate(${round(mid)} 0)">${crabRigAt(poseMarkup('idle', CRAB_W, 'pose shown'))}${carriage}</g>`,
      banner(l, TEXT.scanning, 'scanning blink', SCREEN.dim),
      screenOverlay(l),
      `</svg>`,
    ].join('');
  }

  // --- The day's order, and the moments of every pickup -----------------------
  const all: Commit[] = plan.steps.flatMap((step) =>
    step.cells.map((cell) => ({ column: step.column, row: cell.row, level: cell.level })),
  );
  const order = seededOrder(all.length, seed).map((i) => all[i]!);
  const timeline = planTimeline(order.length, seed);
  const dur = `${round(timeline.durationS)}s`;
  const changes = poseChanges(timeline);
  const usedPoses = POSES.filter((pose) => changes.some((c) => c.pose === pose));

  const geo = geometry(l);
  const slots = pileSlots(l, order.length);
  const motion = crabMotion(order, timeline, geo);

  const cells = order.map(
    (c, j) =>
      `<rect class="cell h${j}" x="${l.gridLeft + c.column * PITCH}" y="${round(geo.cellY(c.row))}" ` +
      `width="${CELL}" height="${CELL}" rx="2" fill="${SCREEN.cell[c.level]}"/>`,
  );
  const pickupKeyframes = order.map((c, j) => pickupFrames(j, c, timeline, geo, slots[j]!));

  const counter = scoreCounter(timeline, h, digits);
  const confetti = confettiBurst(l, p, seed);

  const style = [
    ...staticCss,
    `.trolley{animation:trolley ${dur} ease-in-out infinite}`,
    `.arm{animation:arm ${dur} ease-in-out infinite}`,
    `.swing{transform-box:view-box;transform-origin:0 ${l.railY}px;animation:swing ${dur} ease-in-out infinite}`,
    `.squash{animation:squash ${dur} linear infinite}`,
    `.progress{animation:progress ${dur} linear infinite}`,
    `.ready{opacity:0;animation:ready ${dur} step-end infinite}`,
    `.round-clear{opacity:0;animation:clear ${dur} step-end infinite}`,
    ...usedPoses.map((pose) => `.pose-${pose}{animation:v-${pose} ${dur} step-end infinite}`),
    // Same easing as the crab, so a carried commit stays under its feet the whole way.
    ...order.map((_, j) => `.h${j}{animation:hv${j} ${dur} ease-in-out infinite}`),
    counter.css(dur),
    confetti.css(dur),
    keyframes('trolley', motion.trolley),
    keyframes('arm', motion.depth.map(([t, d]) => [t, `transform:translateY(${px(d)}px)`])),
    keyframes('swing', motion.swing),
    keyframes('squash', motion.squash),
    keyframes('progress', progressFrames(timeline)),
    keyframes('ready', [[0, 'opacity:1'], [APPROACH, 'opacity:0']]),
    keyframes('clear', clearFrames()),
    ...usedPoses.map((pose) => keyframes(`v-${pose}`, visibilityFrames(changes, pose))),
    ...pickupKeyframes,
  ].join('');

  const crab = usedPoses.map((pose) => poseMarkup(pose, CRAB_W)).join('');
  return [
    svgOpen(l, `The ClawBox crab collecting ${plan.totalCells} contributions into a prize box`),
    `<style>${style}</style>`,
    ...scene,
    counter.markup,
    ...cells,
    confetti.markup,
    // The crab draws after the grid so it stays in front as it lowers to grab.
    `<g class="trolley" transform="translate(${round(geo.boxX)} 0)"><g class="swing">${crabRigAt(crab)}</g>${carriage}</g>`,
    banner(l, TEXT.ready, 'ready', SCREEN.white),
    banner(l, TEXT.clear, 'round-clear', SCREEN.gold),
    // The CRT glass goes over everything on the screen, the crab included.
    screenOverlay(l),
    `</svg>`,
  ].join('');
}

/** ROUND CLEAR! blinks from the last commit until the reset. */
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

// --- Geometry shared by the crab and the commits -------------------------------

interface Geometry {
  l: Layout;
  boxX: number;
  colX: (col: number) => number;
  cellY: (row: number) => number;
  /** Crab dip (px below parked) that puts its feet on a row. */
  grabDepth: (row: number) => number;
  /** Crab dip that lowers a held commit into the box. */
  dropDepth: number;
}

function geometry(l: Layout): Geometry {
  const cellY = (row: number) => l.gridTop + row * PITCH;
  return {
    l,
    boxX: l.box.x + l.box.w / 2,
    colX: (col) => l.gridLeft + col * PITCH + CELL / 2,
    cellY,
    grabDepth: (row) => cellY(row) + CELL / 2 - HOLD - l.armRest,
    dropDepth: l.box.y + 10 - HOLD - l.armRest,
  };
}

/** Where a held commit's center sits, for a crab at this dip. */
const heldY = (g: Geometry, depth: number): number => g.l.armRest + depth + HOLD;

// --- The crab -------------------------------------------------------------------

function crabMotion(order: Commit[], t: Timeline, g: Geometry) {
  const trolley: [number, string][] = [[0, `transform:translateX(${round(g.boxX)}px)`]];
  const depth: [number, number][] = [[0, 0]];
  const swing: [number, string][] = [[0, 'transform:rotate(0)']];
  const squash: [number, string][] = [[0, 'transform:scale(1)']];
  const x = (v: number): string => `transform:translateX(${px(v)}px)`;
  const rot = (deg: number): string => `transform:rotate(${px(deg)}deg)`;
  const bump = (at: number, span: number) => {
    squash.push(
      [at - span, 'transform:scale(1)'],
      [at, 'transform:scale(1.08,.86)'],
      [at + span, 'transform:scale(1)'],
    );
  };

  t.pickups.forEach((pk, j) => {
    const c = order[j]!;
    const colX = g.colX(c.column);
    const dGrab = g.grabDepth(c.row);

    trolley.push([pk.start, x(g.boxX)], [pk.arrive, x(colX)], [pk.lift, x(colX)], [pk.boxArrive, x(g.boxX)]);

    depth.push([pk.arrive, 0], [pk.grab, dGrab]);
    if (pk.slip) {
      depth.push(
        [pk.slip.lift, dGrab * SLIP_HOIST],
        [pk.slip.fall, dGrab * SLIP_HOIST],
        [pk.slip.regrab, dGrab],
      );
    }
    depth.push(
      [pk.lift, -CARRY_LIFT],
      [pk.boxArrive, -CARRY_LIFT],
      [pk.drop, g.dropDepth],
      [pk.settle, 0],
    );

    // Overshoot when it stops, swing back, settle before the next move.
    swing.push(
      [pk.start, rot(0)],
      [pk.arrive, rot(SWING)],
      [(pk.arrive + pk.grab) / 2, rot(-SWING * 0.4)],
      [pk.grab, rot(0)],
      [pk.lift, rot(0)],
      [pk.boxArrive, rot(-SWING)],
      [(pk.boxArrive + pk.drop) / 2, rot(SWING * 0.4)],
      [pk.drop, rot(0)],
    );

    const span = Math.min((pk.lift - pk.grab) * 0.3, 0.25);
    bump(pk.grab, span);
    if (pk.slip) bump(pk.slip.regrab, span);
  });

  trolley.push([100, x(g.boxX)]);
  depth.push([SWEEP_END, 0], [100, 0]);
  swing.push([100, rot(0)]);
  squash.push([100, 'transform:scale(1)']);
  return { trolley, depth, swing, squash };
}

/** Each pose shows only while it is the crab's current pose. */
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

/** The deck's progress bar fills as each commit lands, and empties for the reset. */
function progressFrames(t: Timeline): [number, string][] {
  const total = t.pickups.length;
  return [
    [0, 'transform:scaleX(0)'],
    ...t.pickups.map((pk, j): [number, string] => [pk.settle, `transform:scaleX(${round((j + 1) / total)})`]),
    [RESET_START, 'transform:scaleX(1)'],
    [100, 'transform:scaleX(0)'],
  ];
}

// --- The commits ----------------------------------------------------------------

/**
 * One commit's trip: it flashes when grabbed, rides under the crab to the box,
 * drops onto the pile and stays there; at the end of the round every commit
 * flies back to its day in the grid.
 */
function pickupFrames(
  j: number,
  c: Commit,
  t: Timeline,
  g: Geometry,
  slot: { x: number; y: number; size: number },
): string {
  const pk = t.pickups[j]!;
  const cx = g.colX(c.column);
  const cy = g.cellY(c.row) + CELL / 2;
  // A missing scale() pads to scale(1), so only the pile needs one.
  const at = (dx: number, dy: number, k = 1): string =>
    `transform:translate(${px(dx)}px,${px(dy)}px)${k === 1 ? '' : ` scale(${round(k)})`}`;
  const hold = heldY(g, -CARRY_LIFT) - cy;
  const toBox = g.boxX - cx;
  const pile = at(slot.x - cx, slot.y - cy, slot.size / CELL);
  const color = SCREEN.cell[c.level];

  // The flash builds while the crab lowers onto it, then fades as it is lifted.
  const stops: [number, string][] = [
    [0, `${at(0, 0)};fill:${color}`],
    [pk.arrive, `fill:${color}`],
    [pk.grab, `${at(0, 0)};fill:#fff`],
  ];
  if (pk.slip) {
    const dGrab = g.grabDepth(c.row);
    stops.push(
      [pk.slip.lift, at(0, heldY(g, dGrab * SLIP_HOIST) - cy)],
      [pk.slip.fall, `${at(0, 0)};fill:${color}`],
      [pk.slip.regrab, `${at(0, 0)};fill:#fff`],
    );
  }
  stops.push(
    [pk.lift, `${at(0, hold)};fill:${color}`],
    [pk.boxArrive, at(toBox, hold)],
    [pk.drop, at(toBox, heldY(g, g.dropDepth) - cy)],
    [pk.settle, pile],
    [RESET_START, pile],
    [100, at(0, 0)],
  );
  return keyframes(`hv${j}`, stops);
}

/**
 * SCORE<1>, counting up as each commit lands: one glyph per digit place and
 * value, each shown only while that place reads that digit. (SVG cannot animate
 * text, and a pre-drawn number per total would cost far more.)
 */
function scoreCounter(t: Timeline, h: ReturnType<typeof hud>, digits: number) {
  const total = t.pickups.length;
  const startOf = [0, ...t.pickups.map((pk) => pk.settle)]; // when the score becomes v
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
    markup:
      `<g filter="url(#bloom)"><g class="score" fill="${SCREEN.phosphor}" ` +
      `transform="translate(${round(h.scoreX)} ${round(h.scoreY)}) scale(${h.scorePx})">${uses.join('')}</g></g>`,
    css: (dur: string) => `.sc{opacity:0}` + rules.join('').replace(/DUR/g, dur),
  };
}

/** A burst of confetti out of the prize box when the round is done. */
function confettiBurst(l: Layout, p: Palette, seed: number) {
  const rng = mulberry32(seed ^ 0xc0f);
  const x0 = l.box.x + l.box.w / 2;
  const y0 = l.box.y + 6;
  const colors = [p.accent, SCREEN.gold, SCREEN.cell[2], SCREEN.cell[4], SCREEN.white];
  const markup: string[] = [];
  const frames: string[] = [];
  for (let i = 0; i < CONFETTI; i++) {
    const dx = (rng() - 0.5) * 150;
    const up = 30 + rng() * 45;
    const spin = Math.round((rng() - 0.5) * 720);
    markup.push(
      `<rect class="cf cf${i}" x="${round(x0 - 2)}" y="${round(y0 - 3)}" width="4" height="6" rx="1" fill="${colors[i % colors.length]}"/>`,
    );
    frames.push(
      keyframes(`cf${i}`, [
        [0, 'opacity:0;transform:translate(0,0) rotate(0)'],
        [SWEEP_END, 'opacity:0;transform:translate(0,0) rotate(0)'],
        [SWEEP_END + 0.3, 'opacity:1;transform:translate(0,0) rotate(0)'],
        [SWEEP_END + 2.2, `opacity:1;transform:translate(${round(dx * 0.6)}px,${round(-up)}px) rotate(${spin / 2}deg)`],
        [RESET_START, `opacity:0;transform:translate(${round(dx)}px,${round(-up + 70)}px) rotate(${spin}deg)`],
        [100, 'opacity:0;transform:translate(0,0) rotate(0)'],
      ]),
    );
  }
  return {
    markup: `<g class="confetti">${markup.join('')}</g>`,
    css: (dur: string) =>
      `.cf{opacity:0;transform-box:fill-box;transform-origin:center}` +
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
