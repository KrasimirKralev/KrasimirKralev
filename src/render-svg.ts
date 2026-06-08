import { CLAWBOX_ICON, CRAB_MASCOT } from './logo';
import type { Palette } from './palette';
import { seededOrder } from './shuffle';
import type { ContributionLevel, SweepPlan } from './types';

export type CrabStyle = 'classic' | 'robo' | 'claw';
/** Title brand mark: the crab emoji, the ClawBox icon, or the crab mascot. */
export type LogoStyle = 'emoji' | 'icon' | 'mascot';

/** Optional HUD / variant metadata. */
export interface RenderOptions {
  /** Date label shown in the HUD (e.g. "2026-06-09"). */
  date?: string;
  /** Seed for the (deterministic) random pickup order. */
  seed?: number;
  /** Which crab design to draw. */
  crabStyle?: CrabStyle;
  /** Which brand mark to show in the title. */
  logo?: LogoStyle;
}

// --- Layout (px) -------------------------------------------------------------
const CELL = 11;
const GAP = 2;
const PITCH = CELL + GAP; // 13
const ROWS = 7;
const PAD = 18;
const TOP = 94; // headroom above the grid: tall title band, rail, carry lane
const RAIL_Y = PAD + 40; // rail sits below a tall header that holds the big logo
const RIGHT_ZONE = 66; // box + HUD column to the right of the grid
const CRAB_SCALE = 1.45;

// --- Animation timeline (% of one loop) --------------------------------------
const APPROACH = 9; // the crab glides in from the left home before the first pick
const SWEEP_END = 84; // last commit delivered; the rest is the glide home
const CARRY_LIFT = 22; // how high the crab hoists a commit into the carry lane
const CARRY_PEEK = 17; // how far the held commit hangs below the hoisted crab
const BOX_DROP_INSET = 13; // how far the claw dips into the box to release
// One commit's slice is divided into these sub-phases (fractions, must ascend).
const PHASE = {
  arrive: 0.18, // crab over the column, claw up
  grab: 0.3, // claw down on the commit
  lift: 0.42, // hoisted into the lane
  boxArrive: 0.74, // carried to the box
  drop: 0.88, // released into the box
  clear: 0.96, // claw retracted, commit settled
} as const;

const round = (n: number): string => String(Math.round(n * 100) / 100);

interface FlatCell {
  column: number;
  row: number;
  level: ContributionLevel;
}

interface DipStop {
  pct: number;
  depth: number; // px the crab descends from its parked rest position
}

/** The ClawBox crab, drawn centered at the local origin, by style. */
function crabMarkup(p: Palette, style: CrabStyle): string {
  if (style === 'robo') return crabRobo(p);
  if (style === 'claw') return crabClaw(p);
  return crabClassic(p);
}

function crabClassic(p: Palette): string {
  return (
    `<g class="crab">` +
    `<g stroke="${p.accentDark}" stroke-width="1.4" stroke-linecap="round">` +
    `<path d="M-6 3 l-5 2"/><path d="M-6 5 l-5 4"/><path d="M6 3 l5 2"/><path d="M6 5 l5 4"/>` +
    `</g>` +
    `<path class="claw-l" d="M-7 -1 q-6 -3 -10 -1 q-2 2 0 4 q3 1 6 -1" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1"/>` +
    `<path class="claw-r" d="M7 -1 q6 -3 10 -1 q2 2 0 4 q-3 1 -6 -1" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1"/>` +
    `<ellipse cx="0" cy="0" rx="9" ry="6.8" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1.2"/>` +
    `<line x1="-3" y1="-6" x2="-3.5" y2="-10.5" stroke="${p.accentDark}" stroke-width="1.2"/>` +
    `<line x1="3" y1="-6" x2="3.5" y2="-10.5" stroke="${p.accentDark}" stroke-width="1.2"/>` +
    `<circle cx="-3.5" cy="-11" r="1.8" fill="#fff" stroke="${p.accentDark}" stroke-width="0.6"/>` +
    `<circle cx="3.5" cy="-11" r="1.8" fill="#fff" stroke="${p.accentDark}" stroke-width="0.6"/>` +
    `<circle cx="-3.2" cy="-11" r="0.85" fill="#1b1b1b"/>` +
    `<circle cx="3.8" cy="-11" r="0.85" fill="#1b1b1b"/>` +
    `</g>`
  );
}

function crabRobo(p: Palette): string {
  return (
    `<g class="crab">` +
    `<g stroke="${p.accentDark}" stroke-width="1.6" stroke-linecap="round">` +
    `<path d="M-7 4 l-4 3"/><path d="M-3 6 l-2 4"/><path d="M7 4 l4 3"/><path d="M3 6 l2 4"/>` +
    `</g>` +
    `<path class="claw-l" d="M-8 -2 l-6 -2 l-2 3 l3 2 l3 -1 l1 2 l2 -1 z" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1"/>` +
    `<path class="claw-r" d="M8 -2 l6 -2 l2 3 l-3 2 l-3 -1 l-1 2 l-2 -1 z" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1"/>` +
    `<rect x="-9" y="-6" width="18" height="12" rx="3" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1.2"/>` +
    `<circle cx="-6.5" cy="-3.5" r="0.9" fill="${p.accentDark}"/><circle cx="6.5" cy="-3.5" r="0.9" fill="${p.accentDark}"/>` +
    `<circle cx="-6.5" cy="3.5" r="0.9" fill="${p.accentDark}"/><circle cx="6.5" cy="3.5" r="0.9" fill="${p.accentDark}"/>` +
    `<rect x="-5.5" y="-2.5" width="11" height="4.5" rx="2.2" fill="#0b0e12"/>` +
    `<rect x="-4.5" y="-1.7" width="3" height="2.9" rx="1" fill="#fff"/>` +
    `<line x1="0" y1="-6" x2="0" y2="-11.5" stroke="${p.accentDark}" stroke-width="1.2"/>` +
    `<circle cx="0" cy="-12" r="1.6" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="0.6"/>` +
    `</g>`
  );
}

function crabClaw(p: Palette): string {
  return (
    `<g class="crab">` +
    `<path class="claw-l" d="M-3 3 q-11 3 -10 13 q3.5 2.5 6 -1 q-3 -7 5 -9" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path class="claw-r" d="M3 3 q11 3 10 13 q-3.5 2.5 -6 -1 q3 -7 -5 -9" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<ellipse cx="0" cy="1" rx="7" ry="5.2" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1.2"/>` +
    `<line x1="-2.6" y1="-4" x2="-3" y2="-8" stroke="${p.accentDark}" stroke-width="1.1"/>` +
    `<line x1="2.6" y1="-4" x2="3" y2="-8" stroke="${p.accentDark}" stroke-width="1.1"/>` +
    `<circle cx="-3" cy="-8.5" r="1.7" fill="#fff" stroke="${p.accentDark}" stroke-width="0.6"/>` +
    `<circle cx="3" cy="-8.5" r="1.7" fill="#fff" stroke="${p.accentDark}" stroke-width="0.6"/>` +
    `<circle cx="-2.7" cy="-8.5" r="0.8" fill="#1b1b1b"/>` +
    `<circle cx="3.3" cy="-8.5" r="0.8" fill="#1b1b1b"/>` +
    `</g>`
  );
}

/** Render a complete, self-animating, camo-safe SVG for one harvest plan. */
export function renderSvg(plan: SweepPlan, p: Palette, opts: RenderOptions = {}): string {
  const crabStyle = opts.crabStyle ?? 'robo';
  const cols = plan.columns;
  const gridLeft = PAD;
  const gridTop = PAD + TOP;
  const gridW = cols * PITCH - GAP;
  const gridH = ROWS * PITCH - GAP;
  const width = gridLeft + gridW + RIGHT_ZONE + PAD;
  const height = gridTop + gridH + PAD + 10;

  const colCenterX = (col: number): number => gridLeft + col * PITCH + CELL / 2;
  const cellX = (col: number): number => gridLeft + col * PITCH;
  const cellY = (row: number): number => gridTop + row * PITCH;
  const cellCenterY = (row: number): number => cellY(row) + CELL / 2;

  // Crab geometry: parks just above the grid, descends to each commit's row.
  const armRestY = gridTop - 6;
  const parkedLen = armRestY - RAIL_Y; // cable length at rest
  const homeX = colCenterX(0);

  // Collection box on the right.
  const boxX = gridLeft + gridW + 15;
  const boxW = 30;
  const boxH = 44;
  const boxTop = gridTop + 1;
  const boxBottom = boxTop + boxH;
  const boxCenterX = boxX + boxW / 2;
  const boxInnerY = boxBottom - 11; // where a commit settles in the box
  const boxDropDepth = boxTop + BOX_DROP_INSET - armRestY; // claw dip to drop into the box

  // Flatten into harvest order, then shuffle (deterministic per seed).
  const cells: FlatCell[] = [];
  for (const step of plan.steps) {
    for (const cell of step.cells) {
      cells.push({ column: step.column, row: cell.row, level: cell.level });
    }
  }
  const pick = seededOrder(cells.length, opts.seed ?? 1).map((i) => cells[i]!);
  const M = pick.length;
  const dur = Math.min(46, Math.max(22, 9 + plan.totalCells * 0.5));

  const bg = `<rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="${p.background}"/>`;
  const frame = `<rect x="3" y="3" width="${width - 6}" height="${height - 6}" rx="9" fill="none" stroke="${p.frame}" stroke-width="1.5"/>`;
  const logoSrc =
    opts.logo === 'mascot' ? CRAB_MASCOT : opts.logo === 'icon' ? CLAWBOX_ICON : null;
  const title = logoSrc
    ? `<image href="${logoSrc}" x="${PAD}" y="4" width="35" height="52" preserveAspectRatio="xMidYMid meet"/>` +
      `<text x="${PAD + 42}" y="36" class="brand">CLAWBOX</text>`
    : `<text x="${PAD}" y="${PAD + 4}" class="brand">` +
      `<tspan class="emoji">&#129408;</tspan> CLAWBOX</text>`;

  const railX1 = boxCenterX + 6;
  const rail =
    `<rect x="${gridLeft}" y="${RAIL_Y - 2}" width="${railX1 - gridLeft}" height="4" rx="2" fill="${p.hardware}"/>` +
    `<rect x="${gridLeft - 2}" y="${RAIL_Y - 5}" width="5" height="10" rx="1.5" fill="${p.accentDark}"/>` +
    `<rect x="${railX1 - 3}" y="${RAIL_Y - 5}" width="5" height="10" rx="1.5" fill="${p.accentDark}"/>`;

  // Static "sockets" under every cell; lit cells layered on top.
  const sockets: string[] = [];
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < ROWS; r++) {
      sockets.push(
        `<rect x="${cellX(c)}" y="${cellY(r)}" width="${CELL}" height="${CELL}" rx="2" fill="${p.cell[0]}"/>`,
      );
    }
  }

  // Crab rig: cable (stretches) + arm (dips, carries the bigger crab) + carriage.
  const cable = `<rect class="cable" x="-1" y="${RAIL_Y}" width="2" height="${parkedLen}" fill="${p.hardware}"/>`;
  // Resting offset + scale on an inner <g>; the animated translateY lives on
  // .claw-arm. (A CSS transform animation REPLACES an element's transform.)
  const clawArm =
    `<g class="claw-arm"><g transform="translate(0 ${armRestY}) scale(${CRAB_SCALE})">` +
    `${crabMarkup(p, crabStyle)}</g></g>`;
  const carriage =
    `<rect x="-10" y="${RAIL_Y - 6}" width="20" height="11" rx="2.5" fill="${p.accent}"/>` +
    `<rect x="-10" y="${RAIL_Y - 6}" width="20" height="11" rx="2.5" fill="none" stroke="${p.accentDark}" stroke-width="1"/>`;
  const crabRig = cable + clawArm + carriage;

  // --- Idle (SCANNING) branch ------------------------------------------------
  if (plan.isEmpty) {
    const beamX = colCenterX(Math.floor(cols / 2));
    const style = [
      brandCss(p),
      crabIdleCss(),
      `.scan{font:600 11px ui-monospace,Menlo,Consolas,monospace;fill:${p.textDim};letter-spacing:2px;animation:blink 1.4s steps(2) infinite}`,
      `@keyframes blink{0%,49%{opacity:1}50%,100%{opacity:.25}}`,
      `.beam{animation:scan 3.6s ease-in-out infinite}`,
      `@keyframes scan{0%,100%{transform:translateX(${round(gridLeft - beamX)}px)}50%{transform:translateX(${round(gridLeft + gridW - beamX)}px)}}`,
    ].join('');
    return [
      svgOpen(width, height, 'ClawBox crab, scanning an empty contribution grid'),
      `<style>${style}</style>`,
      bg,
      frame,
      title,
      rail,
      `<g class="beam"><g transform="translate(${beamX} 0)">${crabRig}</g></g>`,
      ...sockets,
      `<text x="${gridLeft}" y="${gridTop + gridH + 18}" class="scan">SCANNING&#8230;</text>`,
      `</svg>`,
    ].join('');
  }

  // --- Lit cells (one grab-carry-drop cycle each) ----------------------------
  const litCells = pick.map(
    (cell, j) =>
      `<rect class="cell h${j}" x="${cellX(cell.column)}" y="${cellY(cell.row)}" ` +
      `width="${CELL}" height="${CELL}" rx="2" fill="${p.cell[cell.level]}"/>`,
  );

  // --- Collection box + HUD --------------------------------------------------
  const box =
    `<g class="box">` +
    `<rect x="${boxX + 2}" y="${boxTop + 2}" width="${boxW - 4}" height="${boxH - 4}" rx="2" fill="${p.accent}" opacity="0.08"/>` +
    `<path d="M${boxX} ${boxTop} L${boxX} ${boxBottom} L${boxX + boxW} ${boxBottom} L${boxX + boxW} ${boxTop}" ` +
    `fill="none" stroke="${p.accent}" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="${boxX - 2}" y="${boxTop - 3}" width="${boxW + 4}" height="4" rx="1.5" fill="${p.accent}"/>` +
    `</g>`;
  const numY = boxBottom + 31;
  const hud =
    `<text x="${boxCenterX}" y="${boxBottom + 14}" class="hud-label">HAUL</text>` +
    (opts.date ? `<text x="${boxCenterX}" y="${boxBottom + 43}" class="hud-date">${opts.date}</text>` : '');

  // --- Timeline: grab → carry → drop into the box, one commit at a time ------
  const sl = (SWEEP_END - APPROACH) / M; // slice of the loop per commit
  const bBefore = Math.min(0.5, sl * 0.2); // box catch-bounce lead-in
  const bAfter = Math.min(0.9, sl * 0.45); // box catch-bounce settle

  const trolleyStops: string[] = [`0%{transform:translateX(${round(homeX)}px)}`];
  const dipStops: DipStop[] = [{ pct: 0, depth: 0 }];
  const boxStops: string[] = ['0%{transform:scaleY(1)}'];
  const harvestKeyframes: string[] = [];
  // When each commit lands, for the live counter. Monotonically increasing by
  // construction (tDrop grows with j) — the counter's reveal windows rely on it.
  const dropTimes: number[] = [];

  pick.forEach((cell, j) => {
    const ss = APPROACH + j * sl;
    const tArrive = ss + PHASE.arrive * sl;
    const tGrab = ss + PHASE.grab * sl;
    const tLift = ss + PHASE.lift * sl;
    const tBoxArr = ss + PHASE.boxArrive * sl;
    const tDrop = ss + PHASE.drop * sl;
    const tClear = ss + PHASE.clear * sl;

    const colX = colCenterX(cell.column);
    const rowCY = cellCenterY(cell.row);
    const rowDepth = rowCY - armRestY;
    const dyHold = armRestY - CARRY_LIFT + CARRY_PEEK - rowCY; // hoisted into the lane, peeking below the crab
    const dxBox = boxCenterX - colX; // carry across to the box
    const dyDrop = boxInnerY - rowCY;

    // Crab travels to the column, holds while it descends/grabs/lifts, then
    // carries to the box and holds while it drops in.
    trolleyStops.push(`${round(tArrive)}%{transform:translateX(${round(colX)}px)}`);
    trolleyStops.push(`${round(tLift)}%{transform:translateX(${round(colX)}px)}`);
    trolleyStops.push(`${round(tBoxArr)}%{transform:translateX(${round(boxCenterX)}px)}`);
    trolleyStops.push(`${round(tDrop)}%{transform:translateX(${round(boxCenterX)}px)}`);

    dipStops.push({ pct: tArrive, depth: 0 });
    dipStops.push({ pct: tGrab, depth: rowDepth });
    dipStops.push({ pct: tLift, depth: -CARRY_LIFT }); // hoist up into the lane
    dipStops.push({ pct: tBoxArr, depth: -CARRY_LIFT }); // carry it high to the box
    dipStops.push({ pct: tDrop, depth: boxDropDepth });
    dipStops.push({ pct: tClear, depth: 0 });

    // The commit rides with the crab: sits in the grid, lifts into the claws,
    // moves across to the box (matching the crab's X), then drops in.
    harvestKeyframes.push(
      `@keyframes hv${j}{` +
        `0%,${round(tGrab)}%{opacity:1;transform:translate(0,0) scale(1)}` +
        `${round(tLift)}%{transform:translate(0,${round(dyHold)}px) scale(1)}` +
        `${round(tBoxArr)}%{transform:translate(${round(dxBox)}px,${round(dyHold)}px) scale(1)}` +
        `${round(tDrop)}%{opacity:1;transform:translate(${round(dxBox)}px,${round(dyDrop)}px) scale(.5)}` +
        `${round(tClear)}%,100%{opacity:0;transform:translate(${round(dxBox)}px,${round(dyDrop)}px) scale(0)}}`,
    );

    boxStops.push(`${round(tDrop - bBefore)}%{transform:scaleY(1)}`);
    boxStops.push(`${round(tDrop)}%{transform:scaleY(1.14)}`);
    boxStops.push(`${round(tDrop + bAfter)}%{transform:scaleY(1)}`);
    dropTimes.push(tDrop);
  });

  trolleyStops.push(`100%{transform:translateX(${round(homeX)}px)}`);
  dipStops.push({ pct: 100, depth: 0 });
  boxStops.push('100%{transform:scaleY(1)}');

  const trolleyKeyframes = `@keyframes trolley{${trolleyStops.join('')}}`;
  const clawKeyframes =
    `@keyframes claw{` +
    dipStops.map((s) => `${round(s.pct)}%{transform:translateY(${round(s.depth)}px)}`).join('') +
    `}`;
  const cableKeyframes =
    `@keyframes cable{` +
    dipStops.map((s) => `${round(s.pct)}%{transform:scaleY(${round(1 + s.depth / parkedLen)})}`).join('') +
    `}`;
  const boxKeyframes = `@keyframes boxCatch{${boxStops.join('')}}`;

  const { counter, numberRules, numberKeyframes } = buildCounter(
    dropTimes,
    M,
    boxCenterX,
    numY,
    dur,
  );

  const style = [
    brandCss(p),
    crabIdleCss(),
    `.hud-label{font:600 8px ui-monospace,Menlo,Consolas,monospace;fill:${p.textDim};letter-spacing:1.5px;text-anchor:middle}`,
    `.hud-num{font:700 18px ui-monospace,Menlo,Consolas,monospace;fill:${p.accent};text-anchor:middle;opacity:0}`,
    `.hud-date{font:400 7px ui-monospace,Menlo,Consolas,monospace;fill:${p.textDim};text-anchor:middle}`,
    `.cell{transform-box:fill-box;transform-origin:center}`,
    `.cable{transform-box:fill-box;transform-origin:center top;animation:cable ${dur}s linear infinite}`,
    `.trolley{animation:trolley ${dur}s linear infinite}`,
    `.claw-arm{animation:claw ${dur}s linear infinite}`,
    `.box{transform-box:fill-box;transform-origin:center bottom;animation:boxCatch ${dur}s linear infinite}`,
    ...pick.map((_, j) => `.h${j}{animation:hv${j} ${dur}s linear infinite}`),
    ...numberRules,
    trolleyKeyframes,
    clawKeyframes,
    cableKeyframes,
    boxKeyframes,
    ...harvestKeyframes,
    ...numberKeyframes,
  ].join('');

  return [
    svgOpen(width, height, `ClawBox crab carrying ${plan.totalCells} contribution commits into a box`),
    `<style>${style}</style>`,
    bg,
    frame,
    title,
    rail,
    ...sockets,
    ...litCells,
    box,
    hud,
    counter,
    // Crab renders last so it stays on top of the grid as it lowers to grab.
    `<g class="trolley" transform="translate(${homeX} 0)">${crabRig}</g>`,
    `</svg>`,
  ].join('');
}

/**
 * The live HUD counter: numbers 0..total stacked at one spot, each revealed for
 * its window so the tally ticks up by one as every commit lands in the box.
 * (SVG/CSS can't animate text content, so we reveal pre-rendered digits.)
 */
function buildCounter(
  dropTimes: number[],
  total: number,
  x: number,
  y: number,
  dur: number,
): { counter: string; numberRules: string[]; numberKeyframes: string[] } {
  const parts: string[] = [];
  const numberRules: string[] = [];
  const numberKeyframes: string[] = [];
  for (let v = 0; v <= total; v++) {
    const a = v === 0 ? 0 : dropTimes[v - 1]!;
    const b = v === total ? 100 : dropTimes[v]!;
    parts.push(`<text class="hud-num n${v}" x="${x}" y="${y}">${v}</text>`);
    numberKeyframes.push(numberFrames(v, a, b));
    numberRules.push(`.n${v}{animation:n${v} ${dur}s linear infinite}`);
  }
  return { counter: parts.join(''), numberRules, numberKeyframes };
}

/** Opacity keyframes that reveal one counter digit-group during [a, b] only. */
function numberFrames(v: number, a: number, b: number): string {
  const eps = 0.02;
  const stops: string[] = [];
  if (a <= 0) {
    stops.push('0%{opacity:1}');
  } else {
    stops.push('0%{opacity:0}', `${round(a - eps)}%{opacity:0}`, `${round(a)}%{opacity:1}`);
  }
  if (b >= 100) {
    stops.push('100%{opacity:1}');
  } else {
    stops.push(`${round(b)}%{opacity:1}`, `${round(b + eps)}%{opacity:0}`, '100%{opacity:0}');
  }
  return `@keyframes n${v}{${stops.join('')}}`;
}

function svgOpen(width: number, height: number, label: string): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="${label}">`
  );
}

function brandCss(p: Palette): string {
  return (
    `.brand{font:600 12px ui-monospace,Menlo,Consolas,monospace;fill:${p.accent};letter-spacing:1px}` +
    `.emoji{font-size:13px}`
  );
}

function crabIdleCss(): string {
  return (
    `.crab{transform-box:fill-box;transform-origin:50% 35%;animation:crabIdle 1.6s ease-in-out infinite}` +
    `@keyframes crabIdle{0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}}` +
    `.claw-l{transform-box:fill-box;transform-origin:85% 50%;animation:snipL .8s ease-in-out infinite}` +
    `.claw-r{transform-box:fill-box;transform-origin:15% 50%;animation:snipR .8s ease-in-out infinite}` +
    `@keyframes snipL{0%,100%{transform:rotate(0)}50%{transform:rotate(-13deg)}}` +
    `@keyframes snipR{0%,100%{transform:rotate(0)}50%{transform:rotate(13deg)}}`
  );
}
