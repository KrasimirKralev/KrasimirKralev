import type { Palette } from './palette';
import {
  MASCOT_FRAME_H,
  MASCOT_FRAME_W,
  MASCOT_ROWS,
  MASCOT_SHEET,
  MASCOT_SHEET_H,
  MASCOT_SHEET_W,
  type MascotPose,
} from './mascot-sprite';

export const round = (n: number): string => String(Math.round(n * 100) / 100);

// --- Geometry (px) -----------------------------------------------------------
export const CELL = 12;
export const GAP = 2;
export const PITCH = CELL + GAP;
export const ROWS = 7;
const OUTER = 4; // margin around the cabinet
const SIDE = 18; // cabinet side panels
const MARQUEE_H = 50;
const GAP_V = 8; // between marquee, glass and deck
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
const DECK_H = 58;

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
  glass: Rect;
  marquee: Rect;
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
  const marquee = { x: cabX + SIDE, y: OUTER + 8, w: 0, h: MARQUEE_H };
  const glassTop = marquee.y + MARQUEE_H + GAP_V;
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
  marquee.w = glass.w;
  const deck = { x: glass.x, y: glass.y + glass.h + GAP_V, w: glass.w, h: DECK_H };
  const cabW = glassRight + SIDE - cabX;
  const cabH = deck.y + DECK_H + 10 - OUTER;
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
    glass,
    marquee,
    deck,
    box,
  };
}

/** Deck positions the animation needs too (the joystick tilts, the button lights). */
export function deckSpots(l: Layout) {
  const stickX = l.deck.x + 38;
  return {
    stickX,
    stickPivotY: l.deck.y + 38,
    buttonX: stickX + 50,
    buttonY: l.deck.y + 30,
    scoreX: l.box.x - 156,
    scoreY: l.deck.y + 12,
  };
}

// --- Static parts --------------------------------------------------------------

/** The sprite sheet, embedded once and reused by every pose through <use>. */
export function defs(l: Layout, p: Palette): string {
  return (
    `<defs>` +
    `<image id="sheet" href="${MASCOT_SHEET}" width="${MASCOT_SHEET_W}" height="${MASCOT_SHEET_H}"/>` +
    `<clipPath id="glassClip"><rect x="${l.glass.x}" y="${l.glass.y}" width="${l.glass.w}" height="${l.glass.h}" rx="6"/></clipPath>` +
    `<linearGradient id="shine" x1="0" x2="1" y1="0" y2="0">` +
    `<stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity="${p.name === 'dark' ? 0.07 : 0.35}"/>` +
    `<stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
    `<filter id="glow" x="-20%" y="-60%" width="140%" height="220%"><feGaussianBlur stdDeviation="2.4"/></filter>` +
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
  return (
    `<rect class="cabinet" x="4" y="4" width="${l.width - 8}" height="${l.height - 8}" rx="16" fill="${p.cabinet}" stroke="${p.cabinetEdge}" stroke-width="2"/>` +
    // Side trim: a stripe of the accent down each panel.
    `<rect x="11" y="${glass.y}" width="4" height="${deck.y + deck.h - glass.y}" rx="2" fill="${p.accent}" opacity=".85"/>` +
    `<rect x="${l.width - 15}" y="${glass.y}" width="4" height="${deck.y + deck.h - glass.y}" rx="2" fill="${p.accent}" opacity=".85"/>` +
    `<rect class="glass" x="${glass.x}" y="${glass.y}" width="${glass.w}" height="${glass.h}" rx="6" fill="${p.glass}" stroke="${p.cabinetEdge}" stroke-width="2"/>`
  );
}

/** The lit sign on top: title, two idle crabs, and chasing bulbs around the edge. */
export function marqueeMarkup(l: Layout, p: Palette): string {
  const m = l.marquee;
  const cx = m.x + m.w / 2;
  const bulbs: string[] = [];
  const step = 16;
  const n = Math.max(2, Math.floor((m.w - 16) / step));
  const x0 = m.x + (m.w - (n - 1) * step) / 2;
  for (let i = 0; i < n; i++) {
    const x = x0 + i * step;
    bulbs.push(`<circle class="b b${i % 3}" cx="${round(x)}" cy="${m.y + 5}" r="2.2"/>`);
    bulbs.push(`<circle class="b b${(i + 1) % 3}" cx="${round(x)}" cy="${m.y + m.h - 5}" r="2.2"/>`);
  }
  const crabW = 30;
  const crabY = m.y + (m.h - (crabW * MASCOT_FRAME_H) / MASCOT_FRAME_W) / 2;
  const title = `x="${round(cx)}" y="${m.y + m.h / 2 + 9}" class="title"`;
  return (
    `<g class="marquee">` +
    `<rect x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="8" fill="${p.marquee}" stroke="${p.accentDark}" stroke-width="2"/>` +
    bulbs.join('') +
    `<text ${title} fill="${p.accent}" filter="url(#glow)" opacity=".8">CLAWBOX</text>` +
    `<text ${title} fill="${p.accent}">CLAWBOX</text>` +
    `<g transform="translate(${round(cx - 128 - crabW)} ${round(crabY)})">${poseMarkup('idle', crabW, 'mascot')}</g>` +
    `<g transform="translate(${round(cx + 128)} ${round(crabY)})">${poseMarkup('idle', crabW, 'mascot')}</g>` +
    `</g>`
  );
}

export function marqueeCss(p: Palette): string {
  return (
    `.title{font:800 26px ui-monospace,Menlo,Consolas,monospace;letter-spacing:7px;text-anchor:middle}` +
    `.b{fill:${p.bulbOff}}` +
    `.b0,.b1,.b2{animation:chase 1.2s steps(1) infinite}.b1{animation-delay:-.4s}.b2{animation-delay:-.8s}` +
    `@keyframes chase{0%{fill:${p.bulbOn}}33.3%{fill:${p.bulbOff}}}`
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
    `<rect x="${x1}" y="${l.railY - 2}" width="${x2 - x1}" height="4" rx="2" fill="${p.hardware}"/>` +
    `<rect x="${x1 - 3}" y="${l.railY - 5}" width="6" height="10" rx="1.5" fill="${p.accentDark}"/>` +
    `<rect x="${x2 - 3}" y="${l.railY - 5}" width="6" height="10" rx="1.5" fill="${p.accentDark}"/>`
  );
}

/** Empty sockets under every day of the year. */
export function socketsMarkup(l: Layout): string {
  return `<rect x="${l.gridLeft}" y="${round(l.gridTop)}" width="${l.gridW}" height="${l.gridH}" fill="url(#sockets)"/>`;
}

/** The glass prize box the commits pile up in (open at the top). */
export function prizeBox(l: Layout, p: Palette): string {
  const b = l.box;
  return (
    `<g class="prize-box">` +
    `<rect x="${b.x}" y="${round(b.y)}" width="${b.w}" height="${round(b.h)}" rx="3" fill="${p.accent}" opacity=".07"/>` +
    `<path d="M${b.x} ${round(b.y)} V${round(b.y + b.h)} H${b.x + b.w} V${round(b.y)}" fill="none" stroke="${p.accent}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<rect x="${b.x - 3}" y="${round(b.y - 3)}" width="${b.w + 6}" height="4" rx="1.5" fill="${p.accent}"/>` +
    `<text x="${b.x + b.w / 2}" y="${round(b.y + b.h + 12)}" class="label" fill="${p.textDim}">PRIZES</text>` +
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

export function deckMarkup(l: Layout, p: Palette, date?: string): string {
  const d = l.deck;
  const s = deckSpots(l);
  const coinX = d.x + d.w / 2 - 40;
  const chuteX = l.box.x + 8;
  return (
    `<rect x="${d.x}" y="${round(d.y)}" width="${d.w}" height="${d.h}" rx="8" fill="${p.deck}" stroke="${p.cabinetEdge}" stroke-width="2"/>` +
    // Joystick: the stick tilts with the crab; the base stays put.
    `<ellipse cx="${s.stickX}" cy="${round(s.stickPivotY + 4)}" rx="15" ry="5.5" fill="${p.marquee}"/>` +
    `<g class="joystick"><g class="stick">` +
    `<rect x="${s.stickX - 2}" y="${round(s.stickPivotY - 20)}" width="4" height="22" rx="2" fill="${p.hardware}"/>` +
    `<circle cx="${s.stickX}" cy="${round(s.stickPivotY - 22)}" r="7" fill="${p.accent}" stroke="${p.accentDark}" stroke-width="1.5"/>` +
    `</g></g>` +
    `<text x="${s.stickX}" y="${round(d.y + d.h - 5)}" class="label" fill="${p.textDim}">MOVE</text>` +
    `<circle cx="${s.buttonX}" cy="${round(s.buttonY + 2)}" r="11" fill="${p.marquee}"/>` +
    `<circle class="grab-button" cx="${s.buttonX}" cy="${round(s.buttonY)}" r="9.5" fill="${p.button}"/>` +
    `<text x="${s.buttonX}" y="${round(d.y + d.h - 5)}" class="label" fill="${p.textDim}">GRAB</text>` +
    (date
      ? `<text x="${s.buttonX + 44}" y="${round(d.y + 24)}" class="label start" fill="${p.textDim}">DAILY ROUND</text>` +
        `<text x="${s.buttonX + 44}" y="${round(d.y + 40)}" class="date start" fill="${p.text}">${date}</text>`
      : '') +
    `<g class="coin-slot">` +
    `<rect x="${coinX}" y="${round(d.y + 12)}" width="24" height="32" rx="4" fill="${p.marquee}"/>` +
    `<rect x="${coinX + 10.5}" y="${round(d.y + 18)}" width="3" height="20" rx="1.5" fill="${p.accent}" class="slot"/>` +
    `<text x="${coinX + 34}" y="${round(d.y + 32)}" class="label start blink" fill="${p.accent}">INSERT COIN</text>` +
    `</g>` +
    `<g class="score">` +
    `<rect x="${s.scoreX}" y="${round(s.scoreY)}" width="134" height="34" rx="5" fill="${p.lcd}" stroke="${p.accentDark}" stroke-width="1.5"/>` +
    `<text x="${s.scoreX + 10}" y="${round(s.scoreY + 21)}" class="label start" fill="${p.textDim}">HAUL</text>` +
    `<text x="${s.scoreX + 124}" y="${round(s.scoreY + 26)}" class="digits" fill="${p.bulbOff}" opacity=".3">888</text>` +
    `</g>` +
    `<g class="chute">` +
    `<rect x="${chuteX}" y="${round(d.y + 10)}" width="${l.box.w - 16}" height="38" rx="4" fill="${p.marquee}"/>` +
    `<rect x="${chuteX + 6}" y="${round(d.y + 16)}" width="${l.box.w - 28}" height="18" rx="3" fill="${p.accentDark}" opacity=".55"/>` +
    `<text x="${chuteX + (l.box.w - 16) / 2}" y="${round(d.y + 44)}" class="label" fill="${p.accent}">PUSH</text>` +
    `</g>`
  );
}

export function deckCss(): string {
  return (
    `.label{font:700 8px ui-monospace,Menlo,Consolas,monospace;letter-spacing:1.5px;text-anchor:middle}` +
    `.start{text-anchor:start}` +
    `.date{font:600 11px ui-monospace,Menlo,Consolas,monospace;letter-spacing:1px}` +
    `.digits{font:800 24px ui-monospace,Menlo,Consolas,monospace;text-anchor:end;letter-spacing:2px}` +
    `.blink{animation:blink 1.4s steps(1) infinite}@keyframes blink{50%{opacity:.15}}` +
    `.slot{animation:slot 2s ease-in-out infinite}@keyframes slot{50%{opacity:.35}}`
  );
}
