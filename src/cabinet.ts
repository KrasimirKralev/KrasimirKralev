import { PANEL, type Palette } from './palette';
import {
  MASCOT_FRAME_H,
  MASCOT_FRAME_W,
  MASCOT_ROWS,
  MASCOT_SHEET,
  MASCOT_SHEET_H,
  MASCOT_SHEET_W,
  WORDMARK,
  WORDMARK_H,
  WORDMARK_W,
  type MascotPose,
} from './brand-assets';

export const round = (n: number): string => String(Math.round(n * 100) / 100);

// --- Geometry (px) -----------------------------------------------------------
export const CELL = 12;
export const GAP = 2;
export const PITCH = CELL + GAP;
export const ROWS = 7;
const OUTER = 4; // margin around the cabinet
const SIDE = 18; // cabinet side panels
const HEADER_H = 66;
const LED_GAP = 14; // the LED light bar sits between the header and the glass
const GAP_V = 10; // between the glass and the deck
const GLASS_PAD_X = 14;
const GLASS_PAD_BOTTOM = 16;
const RAIL_DROP = 12; // rail below the top of the glass
const CABLE_MIN = 10; // cable length with the crab parked
export const CRAB_W = 54;
export const CRAB_H = (CRAB_W * MASCOT_FRAME_H) / MASCOT_FRAME_W;
/** How far below the crab's top a held commit's center hangs (just under its feet). */
export const HOLD = CRAB_H + 1;
const CARRY_CLEAR = 9; // a carried commit clears the top row by this much
const BOX_GAP = 22;
const BOX_W = 84;
const DECK_H = 52;
const LOGO_H = 36;

const SANS = 'system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif';
const MONO = 'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

export interface Layout {
  width: number;
  height: number;
  cols: number;
  gridLeft: number;
  gridTop: number;
  gridW: number;
  gridH: number;
  railY: number;
  /** Crab's top edge when parked; every dip is measured from here. */
  armRest: number;
  header: Rect;
  ledY: number;
  glass: Rect;
  deck: Rect;
  box: Rect;
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function layout(cols: number): Layout {
  const cabX = OUTER;
  const header = { x: cabX + SIDE, y: OUTER + 10, w: 0, h: HEADER_H };
  const glassTop = header.y + HEADER_H + LED_GAP;
  const railY = glassTop + RAIL_DROP;
  const armRest = railY + CABLE_MIN;
  const gridTop = armRest + HOLD + CARRY_CLEAR;
  const gridLeft = cabX + SIDE + GLASS_PAD_X;
  const gridW = cols * PITCH - GAP;
  const gridH = ROWS * PITCH - GAP;
  const box = { x: gridLeft + gridW + BOX_GAP, y: gridTop - 2, w: BOX_W, h: gridH + 4 };
  const glassRight = box.x + BOX_W + GLASS_PAD_X;
  const glass = {
    x: cabX + SIDE,
    y: glassTop,
    w: glassRight - (cabX + SIDE),
    h: box.y + box.h + GLASS_PAD_BOTTOM - glassTop,
  };
  header.w = glass.w;
  const deck = { x: glass.x, y: glass.y + glass.h + GAP_V, w: glass.w, h: DECK_H };
  const cabW = glassRight + SIDE - cabX;
  const cabH = deck.y + DECK_H + 12 - OUTER;
  return {
    width: cabX + cabW + OUTER,
    height: OUTER + cabH + OUTER,
    cols,
    gridLeft,
    gridTop,
    gridW,
    gridH,
    railY,
    armRest,
    header,
    ledY: header.y + HEADER_H + LED_GAP / 2 - 1.5,
    glass,
    deck,
    box,
  };
}

/** Deck positions the animation needs too (the progress bar fills, the score counts). */
export function deckSpots(l: Layout) {
  const scoreW = 134;
  const scoreX = l.deck.x + l.deck.w - scoreW - 14;
  const barX = l.deck.x + 150;
  return {
    scoreX,
    scoreY: l.deck.y + 9,
    scoreW,
    barX,
    barY: l.deck.y + 30,
    barW: Math.max(40, scoreX - 28 - barX),
  };
}

// --- Static parts --------------------------------------------------------------

/** Sprite sheet, gradients and filters, defined once and referenced everywhere. */
export function defs(l: Layout, p: Palette): string {
  const dark = p.name === 'dark';
  const v = (id: string, stops: [number, string, number?][]) =>
    `<linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">` +
    stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('') +
    `</linearGradient>`;
  const h = (id: string, stops: [number, string, number?][]) =>
    v(id, stops).replace('x2="0" y1="0" y2="1"', 'x2="1" y1="0" y2="0"');
  return (
    `<defs>` +
    `<image id="sheet" href="${MASCOT_SHEET}" width="${MASCOT_SHEET_W}" height="${MASCOT_SHEET_H}"/>` +
    v('body', [[0, p.cabinet], [1, p.cabinetEdge]]) +
    v('chrome', [[0, '#f5f7fa'], [0.42, '#a3acb9'], [0.5, '#5f6a7a'], [1, '#d9dee5']]) +
    // Panel edges: the same metal, darker, so a border reads as trim rather than an outline.
    v('trim', dark
      ? [[0, '#8d97a6'], [0.5, '#3a4351'], [1, '#6b7584']]
      : [[0, '#d5dae1'], [0.5, '#9aa3af'], [1, '#c3c9d1']]) +
    v('panel', [[0, PANEL.top], [1, PANEL.bottom]]) +
    v('depth', [[0, '#000', dark ? 0.35 : 0.08], [1, '#000', 0]]) +
    v('acrylic', [[0, '#fff', dark ? 0.1 : 0.5], [1, '#fff', 0]]) +
    h('fadeL', [[0, p.accent, 0], [1, p.accent, 0.8]]) +
    h('fadeR', [[0, p.accent, 0.8], [1, p.accent, 0]]) +
    h('sweep', [[0, '#fff', 0], [0.5, '#fff', 0.95], [1, '#fff', 0]]) +
    h('shine', [[0, '#fff', 0], [0.5, '#fff', dark ? 0.07 : 0.35], [1, '#fff', 0]]) +
    `<filter id="glow" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>` +
    `<clipPath id="glassClip"><rect x="${l.glass.x}" y="${l.glass.y}" width="${l.glass.w}" height="${l.glass.h}" rx="8"/></clipPath>` +
    `<clipPath id="ledClip"><rect x="${l.header.x + 10}" y="${round(l.ledY)}" width="${l.header.w - 20}" height="3"/></clipPath>` +
    // One tile per day: far smaller than a rect per socket.
    `<pattern id="sockets" x="${l.gridLeft}" y="${round(l.gridTop)}" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse">` +
    `<rect width="${CELL}" height="${CELL}" rx="2" fill="${p.cell[0]}"/></pattern>` +
    // The cable is drawn long and cut off at the rail, so it needs no keyframes of its own.
    `<clipPath id="belowRail"><rect x="-2000" y="${l.railY}" width="4000" height="1000"/></clipPath>` +
    `</defs>`
  );
}

/** Frame-stepping animation class for each pose's row. */
export const POSE_FRAMES: Record<MascotPose, { cls: string; secs: number }> = {
  idle: { cls: 'fr-idle', secs: 1.1 },
  runRight: { cls: 'fr-run', secs: 0.7 },
  jump: { cls: 'fr-jump', secs: 0.75 },
  failed: { cls: 'fr-failed', secs: 1.2 },
};

export function frameCss(): string {
  return Object.entries(POSE_FRAMES)
    .map(([pose, { cls, secs }]) => {
      const n = MASCOT_ROWS[pose as MascotPose].frames;
      return (
        `.${cls}{animation:${cls} ${secs}s steps(${n}) infinite}` +
        `@keyframes ${cls}{to{transform:translateX(-${n * MASCOT_FRAME_W}px)}}`
      );
    })
    .join('');
}

/** One pose of the crab: a frame-sized window onto its row of the sheet. */
export function poseMarkup(
  pose: MascotPose | 'runLeft',
  w: number,
  cls = `pose pose-${pose}`,
): string {
  const row = pose === 'runLeft' ? MASCOT_ROWS.runRight : MASCOT_ROWS[pose];
  const frames = POSE_FRAMES[pose === 'runLeft' ? 'runRight' : pose].cls;
  const h = (w * MASCOT_FRAME_H) / MASCOT_FRAME_W;
  const strip =
    `<g transform="translate(0 ${-row.row * MASCOT_FRAME_H})"><use href="#sheet" class="${frames}"/></g>`;
  // Running left is running right, mirrored: half the frames to embed.
  const body =
    pose === 'runLeft' ? `<g transform="translate(${MASCOT_FRAME_W} 0) scale(-1 1)">${strip}</g>` : strip;
  return (
    `<g class="${cls}">` +
    `<svg width="${round(w)}" height="${round(h)}" viewBox="0 0 ${MASCOT_FRAME_W} ${MASCOT_FRAME_H}">${body}</svg></g>`
  );
}

export function cabinetBody(l: Layout, p: Palette): string {
  const { glass, deck } = l;
  const stripY = glass.y;
  const stripH = deck.y + deck.h - glass.y;
  const strip = (x: number) =>
    `<rect x="${x}" y="${stripY}" width="3" height="${stripH}" rx="1.5" fill="${p.accent}" filter="url(#glow)" opacity=".8"/>` +
    `<rect x="${x}" y="${stripY}" width="3" height="${stripH}" rx="1.5" fill="${p.accent}"/>`;
  return (
    `<rect class="cabinet" x="4" y="4" width="${l.width - 8}" height="${round(l.height - 8)}" rx="18" fill="url(#body)" stroke="url(#trim)" stroke-width="1.5"/>` +
    `<rect x="7" y="7" width="${l.width - 14}" height="${round(l.height - 14)}" rx="15" fill="none" stroke="#fff" stroke-opacity=".08"/>` +
    // LED strips down both sides.
    strip(11) +
    strip(l.width - 14) +
    `<rect class="glass" x="${glass.x}" y="${glass.y}" width="${glass.w}" height="${glass.h}" rx="8" fill="${p.glass}" stroke="url(#trim)" stroke-width="1.5"/>` +
    // Depth: the glass is set into the cabinet.
    `<rect x="${glass.x + 1}" y="${glass.y + 1}" width="${glass.w - 2}" height="22" rx="7" fill="url(#depth)"/>`
  );
}

/** The header: the ClawBox wordmark on a dark glass panel, with an LED light bar under it. */
export function headerMarkup(l: Layout, p: Palette): string {
  const m = l.header;
  const cx = m.x + m.w / 2;
  const logoW = (LOGO_H * WORDMARK_W) / WORDMARK_H;
  const logoY = m.y + 9;
  const lineY = logoY + LOGO_H / 2;
  const lineW = Math.min(220, m.w / 2 - logoW / 2 - 40);
  return (
    `<g class="header">` +
    `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="12" fill="url(#panel)" stroke="url(#trim)" stroke-width="1.5"/>` +
    `<rect x="${m.x + 14}" y="${m.y + 2.5}" width="${m.w - 28}" height="1.2" rx=".6" fill="#fff" opacity=".16"/>` +
    `<rect x="${round(cx - logoW / 2 - 24 - lineW)}" y="${round(lineY)}" width="${round(lineW)}" height="1.2" fill="url(#fadeL)"/>` +
    `<rect x="${round(cx + logoW / 2 + 24)}" y="${round(lineY)}" width="${round(lineW)}" height="1.2" fill="url(#fadeR)"/>` +
    `<image href="${WORDMARK}" x="${round(cx - logoW / 2)}" y="${logoY}" width="${round(logoW)}" height="${LOGO_H}"/>` +
    `<text x="${round(cx)}" y="${m.y + m.h - 9}" class="tag" fill="${PANEL.textDim}">CONTRIBUTION CATCHER</text>` +
    `</g>` +
    `<g class="led">` +
    `<rect x="${m.x + 10}" y="${round(l.ledY)}" width="${m.w - 20}" height="3" rx="1.5" fill="${p.accent}" filter="url(#glow)"/>` +
    `<rect x="${m.x + 10}" y="${round(l.ledY)}" width="${m.w - 20}" height="3" rx="1.5" fill="${p.accent}"/>` +
    `<g clip-path="url(#ledClip)"><rect class="sweep" x="${m.x}" y="${round(l.ledY)}" width="140" height="3" fill="url(#sweep)"/></g>` +
    `</g>`
  );
}

export function headerCss(l: Layout): string {
  return (
    `.tag{font:600 7.5px ${SANS};letter-spacing:3.5px;text-anchor:middle}` +
    `.sweep{animation:sweep 4.5s ease-in-out infinite}` +
    `@keyframes sweep{0%{transform:translateX(-160px)}60%,100%{transform:translateX(${round(l.header.w + 20)}px)}}`
  );
}

/** A slow sheen across the glass, every few seconds. */
export function glassShine(l: Layout): string {
  const g = l.glass;
  return (
    `<g clip-path="url(#glassClip)"><g class="shine">` +
    `<polygon points="${g.x},${g.y + g.h} ${g.x + 60},${g.y} ${g.x + 130},${g.y} ${g.x + 70},${g.y + g.h}" fill="url(#shine)"/>` +
    `</g></g>`
  );
}

export function glassShineCss(l: Layout): string {
  return (
    `.shine{animation:shine 9s ease-in-out infinite}` +
    `@keyframes shine{0%{transform:translateX(-160px)}55%,100%{transform:translateX(${round(l.glass.w + 40)}px)}}`
  );
}

export function railMarkup(l: Layout, p: Palette): string {
  const x1 = l.gridLeft - 6;
  const x2 = l.box.x + l.box.w + 6;
  return (
    `<rect x="${x1}" y="${l.railY - 2.5}" width="${x2 - x1}" height="5" rx="2.5" fill="url(#chrome)"/>` +
    `<rect x="${x1 - 3}" y="${l.railY - 5}" width="6" height="10" rx="2" fill="${p.accentDark}"/>` +
    `<rect x="${x2 - 3}" y="${l.railY - 5}" width="6" height="10" rx="2" fill="${p.accentDark}"/>`
  );
}

/** Empty sockets under every day of the year. */
export function socketsMarkup(l: Layout): string {
  return `<rect x="${l.gridLeft}" y="${round(l.gridTop)}" width="${l.gridW}" height="${l.gridH}" fill="url(#sockets)"/>`;
}

/** The acrylic prize box the commits pile up in (open at the top), lit from below. */
export function prizeBox(l: Layout, p: Palette): string {
  const b = l.box;
  const bottom = b.y + b.h;
  return (
    `<g class="prize-box">` +
    `<rect x="${b.x}" y="${round(b.y)}" width="${b.w}" height="${round(b.h)}" rx="4" fill="${p.accent}" opacity=".06"/>` +
    `<rect x="${b.x + 2}" y="${round(b.y)}" width="${b.w - 4}" height="${round(b.h * 0.6)}" rx="3" fill="url(#acrylic)"/>` +
    `<path d="M${b.x} ${round(b.y)} V${round(bottom)} H${b.x + b.w} V${round(b.y)}" fill="none" stroke="${p.accent}" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="${b.x - 3}" y="${round(b.y - 3)}" width="${b.w + 6}" height="4" rx="2" fill="url(#chrome)"/>` +
    `<rect x="${b.x + 4}" y="${round(bottom + 2)}" width="${b.w - 8}" height="2.5" rx="1.25" fill="${p.accent}" filter="url(#glow)"/>` +
    `<rect x="${b.x + 4}" y="${round(bottom + 2)}" width="${b.w - 8}" height="2.5" rx="1.25" fill="${p.accent}"/>` +
    `<text x="${b.x + b.w / 2}" y="${round(bottom + 14)}" class="lbl" fill="${p.textDim}">PRIZES</text>` +
    `</g>`
  );
}

/** Pile slots inside the box: the largest square cells that fit every commit. */
export function pileSlots(l: Layout, count: number): { x: number; y: number; size: number }[] {
  const left = l.box.x + 5;
  const bottom = l.box.y + l.box.h - 4;
  const w = l.box.w - 10;
  const h = l.box.h - 26; // keep the top clear for the drop
  let pitch = 8;
  while (pitch > 2 && Math.floor(w / pitch) * Math.floor(h / pitch) < count) pitch -= 0.5;
  const perRow = Math.max(1, Math.floor(w / pitch));
  const rows = Math.max(1, Math.floor(h / pitch));
  const size = Math.max(1.5, pitch - 1);
  return Array.from({ length: count }, (_, j) => {
    // A huge year wraps onto the top layer rather than overflowing the box.
    const row = Math.floor(j / perRow) % rows;
    return { x: left + (j % perRow) * pitch + size / 2, y: bottom - row * pitch - size / 2, size };
  });
}

/** The control deck: date, a progress bar that fills as commits land, and the score. */
export function deckMarkup(l: Layout, p: Palette, total: number, date?: string): string {
  const d = l.deck;
  const s = deckSpots(l);
  const bar = `x="${round(s.barX)}" y="${round(s.barY)}" width="${round(s.barW)}" height="5" rx="2.5"`;
  return (
    `<rect x="${d.x}" y="${round(d.y)}" width="${d.w}" height="${d.h}" rx="10" fill="url(#panel)" stroke="url(#trim)" stroke-width="1.5"/>` +
    `<rect x="${d.x + 14}" y="${round(d.y + 2.5)}" width="${d.w - 28}" height="1.2" rx=".6" fill="#fff" opacity=".12"/>` +
    (date
      ? `<text x="${d.x + 20}" y="${round(d.y + 21)}" class="lbl start" fill="${PANEL.textDim}">DAILY ROUND</text>` +
        `<text x="${d.x + 20}" y="${round(d.y + 38)}" class="val" fill="${PANEL.text}">${date}</text>`
      : '') +
    `<g class="progress-meter">` +
    `<text x="${round(s.barX)}" y="${round(s.barY - 9)}" class="lbl start" fill="${PANEL.textDim}">COLLECTED</text>` +
    `<text x="${round(s.barX + s.barW)}" y="${round(s.barY - 9)}" class="lbl end" fill="${PANEL.textDim}">${total} THIS YEAR</text>` +
    `<rect ${bar} fill="${PANEL.track}"/>` +
    `<rect class="progress" ${bar} fill="${p.accent}" filter="url(#glow)"/>` +
    `<rect class="progress" ${bar} fill="${p.accent}"/>` +
    `</g>` +
    `<g class="score">` +
    `<rect x="${s.scoreX}" y="${round(s.scoreY)}" width="${s.scoreW}" height="34" rx="6" fill="#050709" stroke="url(#trim)" stroke-width="1"/>` +
    `<text x="${s.scoreX + 12}" y="${round(s.scoreY + 21)}" class="lbl start" fill="${PANEL.textDim}">HAUL</text>` +
    `</g>`
  );
}

/** Where the score digits are drawn. */
export function scoreAnchor(l: Layout): { x: number; y: number } {
  const s = deckSpots(l);
  return { x: s.scoreX + s.scoreW - 10, y: s.scoreY + 26 };
}

export function deckCss(): string {
  return (
    `.lbl{font:600 7.5px ${SANS};letter-spacing:2.2px;text-anchor:middle}` +
    `.start{text-anchor:start}.end{text-anchor:end}` +
    `.val{font:600 13px ${SANS};letter-spacing:.5px}` +
    `.digits{font:700 24px ${MONO};text-anchor:end;letter-spacing:2px}` +
    `.progress{transform-box:fill-box;transform-origin:0 50%}`
  );
}
