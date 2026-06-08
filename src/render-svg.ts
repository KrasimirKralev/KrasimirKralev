import type { Palette } from './palette';
import { seededOrder } from './shuffle';
import type { ContributionLevel, SweepPlan } from './types';

/** Optional HUD metadata. */
export interface RenderOptions {
  /** Date label shown in the HUD (e.g. "2026-06-09"). */
  date?: string;
  /** Seed for the (deterministic) random pickup order. */
  seed?: number;
}

// --- Layout (px) -------------------------------------------------------------
const CELL = 11;
const GAP = 2;
const PITCH = CELL + GAP; // 13
const ROWS = 7;
const PAD = 18;
const TOP = 52; // headroom above the grid for the rail + parked crab
const RAIL_Y = PAD + 16;
const RIGHT_ZONE = 64; // chute + HUD column to the right of the grid

// --- Animation timeline (% of one loop) --------------------------------------
const APPROACH = 14; // the crab glides in from the left home before the first pick
const SWEEP_END = 78; // harvesting finishes here; the rest is dump + reset
const DUMP_AT = 89;

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

/** A ClawBox crab, drawn centered at the local origin. */
function crabMarkup(p: Palette): string {
  return (
    `<g class="crab">` +
    `<g stroke="${p.accentDark}" stroke-width="1.4" stroke-linecap="round">` +
    `<path d="M-6 3 l-5 2"/><path d="M-6 5 l-5 4"/><path d="M6 3 l5 2"/><path d="M6 5 l5 4"/>` +
    `</g>` +
    `<path class="claw-l" d="M-7 -1 q-5 -3 -9 -1 q-2 2 0 4 q3 1 5 -1" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1"/>` +
    `<path class="claw-r" d="M7 -1 q5 -3 9 -1 q2 2 0 4 q-3 1 -5 -1" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1"/>` +
    `<ellipse cx="0" cy="0" rx="8.5" ry="6.5" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1.2"/>` +
    `<line x1="-3" y1="-6" x2="-3.5" y2="-10" stroke="${p.accentDark}" stroke-width="1.2"/>` +
    `<line x1="3" y1="-6" x2="3.5" y2="-10" stroke="${p.accentDark}" stroke-width="1.2"/>` +
    `<circle cx="-3.5" cy="-10.5" r="1.7" fill="#fff" stroke="${p.accentDark}" stroke-width="0.6"/>` +
    `<circle cx="3.5" cy="-10.5" r="1.7" fill="#fff" stroke="${p.accentDark}" stroke-width="0.6"/>` +
    `<circle cx="-3.2" cy="-10.5" r="0.8" fill="#1b1b1b"/>` +
    `<circle cx="3.8" cy="-10.5" r="0.8" fill="#1b1b1b"/>` +
    `</g>`
  );
}

/** Render a complete, self-animating, camo-safe SVG for one harvest plan. */
export function renderSvg(plan: SweepPlan, p: Palette, opts: RenderOptions = {}): string {
  const cols = plan.columns;
  const gridLeft = PAD;
  const gridTop = PAD + TOP;
  const gridW = cols * PITCH - GAP;
  const gridH = ROWS * PITCH - GAP;
  const width = gridLeft + gridW + RIGHT_ZONE + PAD;
  const height = gridTop + gridH + PAD + 8;

  const colCenterX = (col: number): number => gridLeft + col * PITCH + CELL / 2;
  const cellX = (col: number): number => gridLeft + col * PITCH;
  const cellY = (row: number): number => gridTop + row * PITCH;
  const cellCenterY = (row: number): number => cellY(row) + CELL / 2;

  // Crab geometry: parked just above the grid, descends to each commit's row.
  const armRestY = gridTop - 5;
  const parkedLen = armRestY - RAIL_Y; // cable length at rest

  const chuteX = gridLeft + gridW + 18;
  const chuteW = 26;
  const chuteCenterX = chuteX + chuteW / 2;
  const homeX = colCenterX(0);

  // Flatten into the harvest order: left-to-right by column, top-to-bottom within.
  const cells: FlatCell[] = [];
  for (const step of plan.steps) {
    for (const cell of step.cells) {
      cells.push({ column: step.column, row: cell.row, level: cell.level });
    }
  }

  const bg = `<rect x="0" y="0" width="${width}" height="${height}" rx="10" fill="${p.background}"/>`;
  const frame = `<rect x="3" y="3" width="${width - 6}" height="${height - 6}" rx="9" fill="none" stroke="${p.frame}" stroke-width="1.5"/>`;
  const title =
    `<text x="${PAD}" y="${PAD + 4}" class="brand">` +
    `<tspan class="emoji">&#129408;</tspan> CLAWBOX</text>`;

  const railX1 = chuteCenterX + 6;
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

  // Crab assembly: cable (stretches) + arm (dips) + carriage (rides the rail).
  const cable = `<rect class="cable" x="-1" y="${RAIL_Y}" width="2" height="${parkedLen}" fill="${p.hardware}"/>`;
  // The resting offset lives on an inner <g>; the animated translateY lives on
  // .claw-arm. (A CSS transform animation REPLACES an element's transform
  // attribute, so the two must not share an element.)
  const clawArm = `<g class="claw-arm"><g transform="translate(0 ${armRestY})">${crabMarkup(p)}</g></g>`;
  const carriage =
    `<rect x="-9" y="${RAIL_Y - 6}" width="18" height="11" rx="2.5" fill="${p.accent}"/>` +
    `<rect x="-9" y="${RAIL_Y - 6}" width="18" height="11" rx="2.5" fill="none" stroke="${p.accentDark}" stroke-width="1"/>`;
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

  // --- Pickup order: deterministic-random, so the crab hops around -----------
  const pick = seededOrder(cells.length, opts.seed ?? 1).map((i) => cells[i]!);
  const M = pick.length;
  const dur = Math.min(22, Math.max(12, 6 + plan.totalCells * 0.22));

  // --- Lit cells (one carry-to-box cycle each) -------------------------------
  const litCells = pick.map(
    (cell, j) =>
      `<rect class="cell h${j}" x="${cellX(cell.column)}" y="${cellY(cell.row)}" ` +
      `width="${CELL}" height="${CELL}" rx="2" fill="${p.cell[cell.level]}"/>`,
  );

  // --- Chute + box + HUD -----------------------------------------------------
  const chuteTop = gridTop + 2;
  const mouthY = chuteTop + 15; // funnel throat (commits arrive here)
  const boxTop = chuteTop + 18;
  const boxInnerY = chuteTop + 27; // where a commit settles inside the box
  const chute =
    `<path d="M${chuteX} ${chuteTop} L${chuteX + chuteW} ${chuteTop} ` +
    `L${chuteX + chuteW - 6} ${chuteTop + 16} L${chuteX + 6} ${chuteTop + 16} Z" ` +
    `fill="none" stroke="${p.accent}" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<rect class="box" x="${chuteX + 4}" y="${boxTop}" width="${chuteW - 8}" height="14" rx="2" fill="none" stroke="${p.accent}" stroke-width="1.5"/>`;
  const hud =
    `<text x="${chuteCenterX}" y="${chuteTop + 52}" class="hud-label">HAUL</text>` +
    `<text x="${chuteCenterX}" y="${chuteTop + 70}" class="hud-num">${plan.totalCells}</text>` +
    (opts.date ? `<text x="${chuteCenterX}" y="${chuteTop + 84}" class="hud-date">${opts.date}</text>` : '');

  // --- Timeline --------------------------------------------------------------
  const spacing = (SWEEP_END - APPROACH) / M;
  const w = Math.min(0.9, spacing * 0.34); // crab dip half-window
  const bBefore = Math.min(0.5, spacing * 0.35); // box-catch lead-in
  const bAfter = Math.min(0.7, spacing * 0.5); // box-catch settle
  const CARRY = 6; // % of the loop a commit spends flying to the box
  const DROP = 1.6;

  const trolleyStops: string[] = [`0%{transform:translateX(${round(homeX)}px)}`];
  const dipStops: DipStop[] = [{ pct: 0, depth: 0 }];
  const boxStops: string[] = ['0%{transform:scaleY(1)}'];
  const harvestKeyframes: string[] = [];

  pick.forEach((cell, j) => {
    const grab = APPROACH + ((j + 0.5) / M) * (SWEEP_END - APPROACH);
    const cy = cellCenterY(cell.row);
    const depth = cy - armRestY;
    const cx = colCenterX(cell.column);
    const dx = chuteCenterX - cx; // flight to the box
    const apexY = Math.min(-12, mouthY - cy) - 16;

    // Crab: travel to the column, then dip to the commit's row.
    trolleyStops.push(`${round(grab)}%{transform:translateX(${round(cx)}px)}`);
    dipStops.push({ pct: grab - w, depth: 0 });
    dipStops.push({ pct: grab, depth });
    dipStops.push({ pct: grab + w, depth: 0 });

    // Commit: pop into the claws (held), arc across, drop into the box.
    const p1 = grab + w;
    const p2 = grab + w + 0.8;
    const p3 = grab + CARRY * 0.55;
    const p4 = grab + CARRY; // lands in the box here
    const p5 = grab + CARRY + DROP;
    const p6 = p5 + 0.6;
    harvestKeyframes.push(
      `@keyframes hv${j}{` +
        `0%,${round(grab)}%{opacity:1;transform:translate(0,0) scale(1)}` +
        `${round(p1)}%{transform:translate(0,-12px) scale(1)}` +
        `${round(p2)}%{transform:translate(0,-12px) scale(.92)}` +
        `${round(p3)}%{transform:translate(${round(dx * 0.5)}px,${round(apexY)}px) scale(.8)}` +
        `${round(p4)}%{transform:translate(${round(dx)}px,${round(mouthY - cy)}px) scale(.62)}` +
        `${round(p5)}%{opacity:1;transform:translate(${round(dx)}px,${round(boxInnerY - cy)}px) scale(.34)}` +
        `${round(p6)}%,100%{opacity:0;transform:translate(${round(dx)}px,${round(boxInnerY - cy)}px) scale(0)}}`,
    );

    // Box: a quick catch-bounce as each commit lands.
    boxStops.push(`${round(p4 - bBefore)}%{transform:scaleY(1)}`);
    boxStops.push(`${round(p4)}%{transform:scaleY(1.16)}`);
    boxStops.push(`${round(p4 + bAfter)}%{transform:scaleY(1)}`);
  });

  trolleyStops.push(`${DUMP_AT}%{transform:translateX(${round(chuteCenterX)}px)}`);
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

  const style = [
    brandCss(p),
    crabIdleCss(),
    `.hud-label{font:600 8px ui-monospace,Menlo,Consolas,monospace;fill:${p.textDim};letter-spacing:1.5px;text-anchor:middle}`,
    `.hud-num{font:700 18px ui-monospace,Menlo,Consolas,monospace;fill:${p.accent};text-anchor:middle}`,
    `.hud-date{font:400 7px ui-monospace,Menlo,Consolas,monospace;fill:${p.textDim};text-anchor:middle}`,
    `.cell{transform-box:fill-box;transform-origin:center}`,
    `.cable{transform-box:fill-box;transform-origin:center top;animation:cable ${dur}s linear infinite}`,
    `.trolley{animation:trolley ${dur}s linear infinite}`,
    `.claw-arm{animation:claw ${dur}s linear infinite}`,
    `.box{transform-box:fill-box;transform-origin:center bottom;animation:boxCatch ${dur}s linear infinite}`,
    ...pick.map((_, j) => `.h${j}{animation:hv${j} ${dur}s linear infinite}`),
    trolleyKeyframes,
    clawKeyframes,
    cableKeyframes,
    boxKeyframes,
    ...harvestKeyframes,
  ].join('');

  return [
    svgOpen(width, height, `ClawBox crab harvesting ${plan.totalCells} contribution commits`),
    `<style>${style}</style>`,
    bg,
    frame,
    title,
    rail,
    ...sockets,
    ...litCells,
    chute,
    hud,
    `<g class="trolley" transform="translate(${homeX} 0)">${crabRig}</g>`,
    `</svg>`,
  ].join('');
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
    `.crab{transform-box:fill-box;transform-origin:50% 35%;animation:crabIdle 1.5s ease-in-out infinite}` +
    `@keyframes crabIdle{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(5deg)}}` +
    `.claw-l{transform-box:fill-box;transform-origin:90% 50%;animation:snipL .7s ease-in-out infinite}` +
    `.claw-r{transform-box:fill-box;transform-origin:10% 50%;animation:snipR .7s ease-in-out infinite}` +
    `@keyframes snipL{0%,100%{transform:rotate(0)}50%{transform:rotate(-16deg)}}` +
    `@keyframes snipR{0%,100%{transform:rotate(0)}50%{transform:rotate(16deg)}}`
  );
}
