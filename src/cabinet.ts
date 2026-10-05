import { PANEL, SCREEN, type Palette } from './palette';
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
import { INVADER, SAUCER, bitmapPath, glyphDefs, pixelText, textWidth } from './pixel-art';
import { mulberry32 } from './shuffle';

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
const GLASS_PAD_BOTTOM = 18;
const RAIL_DROP = 12; // rail below the top of the glass
const CABLE_MIN = 10; // cable length with the crab parked
export const CRAB_W = 54;
export const CRAB_H = (CRAB_W * MASCOT_FRAME_H) / MASCOT_FRAME_W;
/** How far below the crab's top a held commit's center hangs (just under its feet). */
export const HOLD = CRAB_H + 1;
const CARRY_CLEAR = 9; // a carried commit clears the top row by this much
const BOX_GAP = 22;
const BOX_W = 84;
const DECK_H = 54;
const LOGO_H = 34;
const INVADER_PX = 2;
const MARCH = 18; // how far a formation steps across before it turns back
const STARS = 70;

/** Every string drawn in the pixel font, so only the glyphs in use are embedded. */
export const TEXT = {
  tagline: 'CONTRIBUTION CATCHER',
  score: 'SCORE<1>',
  hiScore: 'HI-SCORE',
  round: 'ROUND',
  collected: 'COLLECTED',
  prizes: 'PRIZES',
  ready: 'READY!',
  clear: 'ROUND CLEAR!',
  scanning: 'SCANNING...',
};

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

/** Score digits: 4 places like an arcade, more if a year ever needs them. */
export const scoreDigits = (total: number): number => Math.max(4, String(total).length);
const SCORE_PX = 2.6;
const LABEL_PX = 1.4;

/** Where the HUD's live parts sit (the score counts up, the bar fills). */
export function hud(l: Layout) {
  const d = l.deck;
  return {
    scoreX: d.x + 20,
    scoreY: d.y + 25,
    scorePx: SCORE_PX,
    barX: d.x + 170,
    barY: d.y + 30,
    barW: Math.max(40, d.w - 340),
  };
}

// --- Static parts --------------------------------------------------------------

/** Sprite sheet, glyphs, gradients and filters, defined once and referenced everywhere. */
export function defs(l: Layout, p: Palette, date?: string): string {
  const dark = p.name === 'dark';
  const v = (id: string, stops: [number, string, number?][]) =>
    `<linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">` +
    stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}"${a === undefined ? '' : ` stop-opacity="${a}"`}/>`).join('') +
    `</linearGradient>`;
  const h = (id: string, stops: [number, string, number?][]) =>
    v(id, stops).replace('x2="0" y1="0" y2="1"', 'x2="1" y1="0" y2="0"');
  const clip = (id: string, r: Rect, rx: number) =>
    `<clipPath id="${id}"><rect x="${r.x}" y="${round(r.y)}" width="${r.w}" height="${round(r.h)}" rx="${rx}"/></clipPath>`;
  return (
    `<defs>` +
    `<image id="sheet" href="${MASCOT_SHEET}" width="${MASCOT_SHEET_W}" height="${MASCOT_SHEET_H}"/>` +
    glyphDefs([...Object.values(TEXT), '0123456789', date ?? '']) +
    `<path id="invA" d="${bitmapPath(INVADER.a)}"/><path id="invB" d="${bitmapPath(INVADER.b)}"/>` +
    `<path id="saucer" d="${bitmapPath(SAUCER.rows)}"/>` +
    v('body', [[0, p.cabinet], [1, p.cabinetEdge]]) +
    v('chrome', [[0, '#f5f7fa'], [0.42, '#a3acb9'], [0.5, '#5f6a7a'], [1, '#d9dee5']]) +
    // Panel edges: the same metal, darker, so a border reads as trim rather than an outline.
    v('trim', dark
      ? [[0, '#8d97a6'], [0.5, '#3a4351'], [1, '#6b7584']]
      : [[0, '#d5dae1'], [0.5, '#9aa3af'], [1, '#c3c9d1']]) +
    v('panel', [[0, PANEL.top], [1, PANEL.bottom]]) +
    v('acrylic', [[0, '#fff', 0.1], [1, '#fff', 0]]) +
    h('sweep', [[0, '#fff', 0], [0.5, '#fff', 0.95], [1, '#fff', 0]]) +
    h('shine', [[0, '#fff', 0], [0.5, '#fff', 0.06], [1, '#fff', 0]]) +
    `<radialGradient id="vignette" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#000" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000" stop-opacity=".55"/></radialGradient>` +
    `<filter id="glow" x="-10%" y="-200%" width="120%" height="500%"><feGaussianBlur stdDeviation="3"/></filter>` +
    // CRT bloom for pixel text: a soft copy under the sharp one.
    `<filter id="bloom" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="1.4" result="b"/>` +
    `<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>` +
    `<pattern id="scanlines" width="4" height="3" patternUnits="userSpaceOnUse"><rect width="4" height="1" fill="#000" opacity=".32"/></pattern>` +
    `<pattern id="segments" x="${round(hud(l).barX)}" width="7" height="8" patternUnits="userSpaceOnUse"><rect x="5" width="2" height="8" fill="${PANEL.bottom}"/></pattern>` +
    clip('glassClip', l.glass, 8) +
    clip('headerClip', l.header, 12) +
    `<clipPath id="ledClip"><rect x="${l.header.x + 10}" y="${round(l.ledY)}" width="${l.header.w - 20}" height="3"/></clipPath>` +
    // One tile per day: far smaller than a rect per socket.
    `<pattern id="sockets" x="${l.gridLeft}" y="${round(l.gridTop)}" width="${PITCH}" height="${PITCH}" patternUnits="userSpaceOnUse">` +
    `<rect width="${CELL}" height="${CELL}" rx="2" fill="${SCREEN.cell[0]}"/></pattern>` +
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
    `<rect x="${x}" y="${stripY}" width="3" height="${round(stripH)}" rx="1.5" fill="${p.accent}" filter="url(#glow)" opacity=".8"/>` +
    `<rect x="${x}" y="${stripY}" width="3" height="${round(stripH)}" rx="1.5" fill="${p.accent}"/>`;
  return (
    `<rect class="cabinet" x="4" y="4" width="${l.width - 8}" height="${round(l.height - 8)}" rx="18" fill="url(#body)" stroke="url(#trim)" stroke-width="1.5"/>` +
    `<rect x="7" y="7" width="${l.width - 14}" height="${round(l.height - 14)}" rx="15" fill="none" stroke="#fff" stroke-opacity=".08"/>` +
    // LED strips down both sides.
    strip(11) +
    strip(l.width - 14)
  );
}

const invaderCellW = INVADER.w * INVADER_PX + 8;
const formationWidth = (cols: number): number => cols * invaderCellW - 8;

/** A formation of pixel crab invaders: two frames, swapped as it marches. */
function formation(x: number, y: number, cols: number, rows: number, colors: string[]): string {
  const cellH = INVADER.h * INVADER_PX + 6;
  const frame = (id: string, cls: string) =>
    `<g class="${cls}">` +
    Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) =>
        `<use href="#${id}" x="${(c * invaderCellW) / INVADER_PX}" y="${(r * cellH) / INVADER_PX}" fill="${colors[r % colors.length]}"/>`,
      ).join(''),
    ).join('') +
    `</g>`;
  return (
    `<g class="march"><g transform="translate(${round(x)} ${round(y)}) scale(${INVADER_PX})">` +
    frame('invA', 'fa') +
    frame('invB', 'fb') +
    `</g></g>`
  );
}

/** The header: the ClawBox wordmark between two marching invader formations, an
 *  occasional mystery saucer, CRT scanlines, and an LED light bar under it all. */
export function headerMarkup(l: Layout, p: Palette): string {
  const m = l.header;
  const cx = m.x + m.w / 2;
  const logoW = (LOGO_H * WORDMARK_W) / WORDMARK_H;
  const side = (m.w - logoW) / 2; // room either side of the logo
  const cols = Math.max(1, Math.min(5, Math.floor((side - 60) / invaderCellW)));
  const fw = formationWidth(cols);
  const fy = m.y + 14;
  const leftX = m.x + side / 2 - fw / 2 - MARCH / 2;
  const rightX = cx + logoW / 2 + side / 2 - fw / 2 - MARCH / 2;
  const colors = [SCREEN.white, SCREEN.phosphor];
  return (
    `<g class="header">` +
    `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="12" fill="url(#panel)" stroke="url(#trim)" stroke-width="1.5"/>` +
    `<g clip-path="url(#headerClip)">` +
    formation(leftX, fy, cols, 2, colors) +
    formation(rightX, fy, cols, 2, colors) +
    `<g class="saucer"><use href="#saucer" transform="translate(${m.x} ${m.y + 3}) scale(1.5)" fill="${SCREEN.red}"/></g>` +
    `<image href="${WORDMARK}" x="${round(cx - logoW / 2)}" y="${m.y + 7}" width="${round(logoW)}" height="${LOGO_H}"/>` +
    `<g filter="url(#bloom)">${pixelText(TEXT.tagline, cx, m.y + m.h - 15, { px: 1.2, fill: SCREEN.gold, anchor: 'middle' })}</g>` +
    `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" fill="url(#scanlines)"/>` +
    `</g>` +
    `<rect x="${m.x + 14}" y="${m.y + 2.5}" width="${m.w - 28}" height="1.2" rx=".6" fill="#fff" opacity=".16"/>` +
    `</g>` +
    `<g class="led">` +
    `<rect x="${m.x + 10}" y="${round(l.ledY)}" width="${m.w - 20}" height="3" rx="1.5" fill="${p.accent}" filter="url(#glow)"/>` +
    `<rect x="${m.x + 10}" y="${round(l.ledY)}" width="${m.w - 20}" height="3" rx="1.5" fill="${p.accent}"/>` +
    `<g clip-path="url(#ledClip)"><rect class="sweep" x="${m.x}" y="${round(l.ledY)}" width="140" height="3" fill="url(#sweep)"/></g>` +
    `</g>`
  );
}

export function headerCss(l: Layout): string {
  const m = l.header;
  return (
    // The classic step: the formation hops across, turns, hops back; the legs swap each hop.
    `.march{animation:march 6s steps(9) infinite}` +
    `@keyframes march{0%,100%{transform:translateX(0)}50%{transform:translateX(${MARCH}px)}}` +
    `.fa,.fb{animation:flip .66s steps(1) infinite}.fb{animation-delay:-.33s}` +
    `@keyframes flip{0%{opacity:1}50%{opacity:0}}` +
    `.saucer{animation:saucer 17s linear infinite}` +
    `@keyframes saucer{0%{transform:translateX(-40px)}38%,100%{transform:translateX(${round(m.w + 40)}px)}}` +
    `.sweep{animation:sweep 4.5s ease-in-out infinite}` +
    `@keyframes sweep{0%{transform:translateX(-160px)}60%,100%{transform:translateX(${round(m.w + 20)}px)}}`
  );
}

/** The play field: a dark CRT with twinkling stars and the green ground line. */
export function screenMarkup(l: Layout, seed: number): string {
  const g = l.glass;
  const rng = mulberry32(seed ^ 0x57a5);
  const stars = Array.from({ length: STARS }, (_, i) => {
    const x = g.x + 6 + rng() * (g.w - 12);
    const y = g.y + 6 + rng() * (g.h - 12);
    const s = rng() < 0.2 ? 2 : 1.2;
    return `<rect class="star s${i % 3}" x="${round(x)}" y="${round(y)}" width="${s}" height="${s}" fill="${SCREEN.white}"/>`;
  }).join('');
  const groundY = l.gridTop + l.gridH + 9;
  return (
    `<rect class="glass" x="${g.x}" y="${g.y}" width="${g.w}" height="${round(g.h)}" rx="8" fill="${SCREEN.bg}" stroke="url(#trim)" stroke-width="1.5"/>` +
    `<g clip-path="url(#glassClip)">${stars}` +
    `<rect class="ground" x="${g.x + 10}" y="${round(groundY)}" width="${round(l.box.x - 14 - g.x)}" height="2" fill="${SCREEN.phosphor}" opacity=".85"/>` +
    `</g>`
  );
}

/** Drawn over everything on the screen: scanlines, vignette and a slow sheen. */
export function screenOverlay(l: Layout): string {
  const g = l.glass;
  return (
    `<g clip-path="url(#glassClip)" class="crt">` +
    `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${round(g.h)}" fill="url(#scanlines)"/>` +
    `<rect x="${g.x}" y="${g.y}" width="${g.w}" height="${round(g.h)}" fill="url(#vignette)"/>` +
    `<g class="shine"><polygon points="${g.x},${round(g.y + g.h)} ${g.x + 60},${g.y} ${g.x + 130},${g.y} ${g.x + 70},${round(g.y + g.h)}" fill="url(#shine)"/></g>` +
    `</g>`
  );
}

export function screenCss(l: Layout): string {
  return (
    `.star{animation:twinkle 3.2s steps(1) infinite}.s1{animation-delay:-1.1s}.s2{animation-delay:-2.2s}` +
    `@keyframes twinkle{0%{opacity:.9}40%{opacity:.25}70%{opacity:.6}}` +
    `.shine{animation:shine 9s ease-in-out infinite}` +
    `@keyframes shine{0%{transform:translateX(-160px)}55%,100%{transform:translateX(${round(l.glass.w + 40)}px)}}` +
    `.blink{animation:blink 1.2s steps(1) infinite}@keyframes blink{50%{opacity:.15}}`
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
    `<rect x="${b.x}" y="${round(b.y)}" width="${b.w}" height="${round(b.h)}" rx="4" fill="${p.accent}" opacity=".07"/>` +
    `<rect x="${b.x + 2}" y="${round(b.y)}" width="${b.w - 4}" height="${round(b.h * 0.6)}" rx="3" fill="url(#acrylic)"/>` +
    `<path d="M${b.x} ${round(b.y)} V${round(bottom)} H${b.x + b.w} V${round(b.y)}" fill="none" stroke="${p.accent}" stroke-width="2" stroke-linejoin="round"/>` +
    `<rect x="${b.x - 3}" y="${round(b.y - 3)}" width="${b.w + 6}" height="4" rx="2" fill="url(#chrome)"/>` +
    `<rect x="${b.x + 4}" y="${round(bottom + 2)}" width="${b.w - 8}" height="2.5" rx="1.25" fill="${p.accent}" filter="url(#glow)"/>` +
    `<rect x="${b.x + 4}" y="${round(bottom + 2)}" width="${b.w - 8}" height="2.5" rx="1.25" fill="${p.accent}"/>` +
    pixelText(TEXT.prizes, b.x + b.w / 2, bottom + 8, { px: 1.1, fill: SCREEN.dim, anchor: 'middle' }) +
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

/** Big centered pixel text over the play field, on a dark plate (READY!, ROUND CLEAR!). */
export function banner(l: Layout, text: string, cls: string, fill: string): string {
  const px = 3;
  const cx = l.gridLeft + l.gridW / 2;
  const cy = l.gridTop + l.gridH / 2;
  const w = textWidth(text, px);
  const h = 7 * px;
  return (
    `<g class="${cls}">` +
    `<rect x="${round(cx - w / 2 - 14)}" y="${round(cy - h / 2 - 10)}" width="${round(w + 28)}" height="${h + 20}" rx="4" fill="${SCREEN.bg}" opacity=".85"/>` +
    `<g filter="url(#bloom)">${pixelText(text, cx, cy - h / 2, { px, fill, anchor: 'middle' })}</g>` +
    `</g>`
  );
}

/** The arcade HUD: SCORE<1> (live, drawn by the renderer), the round and a segmented
 *  progress bar, and the HI-SCORE: this year's total. */
export function deckMarkup(l: Layout, p: Palette, total: number, date?: string): string {
  const d = l.deck;
  const s = hud(l);
  const right = d.x + d.w - 20;
  const bar = `x="${round(s.barX)}" y="${round(s.barY)}" width="${round(s.barW)}" height="8" rx="1"`;
  const hi = String(total).padStart(scoreDigits(total), '0');
  return (
    `<rect x="${d.x}" y="${round(d.y)}" width="${d.w}" height="${d.h}" rx="10" fill="url(#panel)" stroke="url(#trim)" stroke-width="1.5"/>` +
    `<rect x="${d.x + 14}" y="${round(d.y + 2.5)}" width="${d.w - 28}" height="1.2" rx=".6" fill="#fff" opacity=".12"/>` +
    `<g class="hud" filter="url(#bloom)">` +
    pixelText(TEXT.score, s.scoreX, d.y + 11, { px: LABEL_PX, fill: SCREEN.white }) +
    pixelText(TEXT.hiScore, right, d.y + 11, { px: LABEL_PX, fill: SCREEN.white, anchor: 'end' }) +
    pixelText(hi, right, s.scoreY, { px: SCORE_PX, fill: SCREEN.white, anchor: 'end' }) +
    pixelText(date ? `${TEXT.round} ${date}` : TEXT.round, s.barX, d.y + 14, { px: LABEL_PX, fill: SCREEN.dim }) +
    pixelText(TEXT.collected, s.barX + s.barW, d.y + 14, { px: LABEL_PX, fill: SCREEN.dim, anchor: 'end' }) +
    `</g>` +
    `<g class="progress-meter">` +
    `<rect ${bar} fill="${PANEL.track}"/>` +
    `<rect class="progress" ${bar} fill="${p.accent}" filter="url(#glow)"/>` +
    `<rect class="progress" ${bar} fill="${p.accent}"/>` +
    `<rect ${bar} fill="url(#segments)"/>` +
    `</g>`
  );
}

export function deckCss(): string {
  return `.progress{transform-box:fill-box;transform-origin:0 50%}`;
}
