/**
 * Pixel art for the arcade look: a 5x7 bitmap font and the invader sprites.
 * Everything is drawn as paths, never as <text>, so it looks the same on every
 * device (an SVG inside a README image cannot load a web font).
 */

const FONT: Record<string, string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.....', '..#..'],
  ':': ['.....', '..#..', '.....', '.....', '.....', '..#..', '.....'],
};

/** Advance per character, in font pixels (5 wide + 1 space). */
export const ADVANCE = 6;
export const GLYPH_H = 7;

/** Original ClawBox pixel crabs (not the arcade's own sprites), two frames: claws up, claws in. */
export const INVADER = {
  w: 11,
  h: 8,
  a: [
    '#.#.....#.#',
    '###.....###',
    '.#.#####.#.',
    '..##.#.##..',
    '..#######..',
    '.#########.',
    '#.#.....#.#',
    '.#.......#.',
  ],
  b: [
    '.#.......#.',
    '###.....###',
    '.#.#####.#.',
    '..##.#.##..',
    '..#######..',
    '.#########.',
    '.#.#...#.#.',
    '#.........#',
  ],
};

/** The mystery ship: a little saucer with the ClawBox cube on top. */
export const SAUCER = {
  w: 16,
  h: 7,
  rows: [
    '......####......',
    '...##########...',
    '..############..',
    '.##.##.##.##.##.',
    '################',
    '..###..##..###..',
    '...#........#...',
  ],
};

/** A bitmap as one path, one subpath per horizontal run of lit pixels. */
export function bitmapPath(rows: string[]): string {
  const d: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; ) {
      if (row[x] !== '#') {
        x++;
        continue;
      }
      let run = 1;
      while (row[x + run] === '#') run++;
      d.push(`M${x} ${y}h${run}v1h-${run}z`);
      x += run;
    }
  });
  return d.join('');
}

const glyphId = (ch: string): string => `g${ch.charCodeAt(0)}`;

/** <defs> entries for every character the given strings use (and nothing else). */
export function glyphDefs(texts: string[]): string {
  const used = new Set(texts.join('').replace(/ /g, ''));
  return [...used]
    .sort()
    .map((ch) => {
      const bitmap = FONT[ch];
      if (!bitmap) throw new Error(`pixel font has no glyph for "${ch}"`);
      return `<path id="${glyphId(ch)}" d="${bitmapPath(bitmap)}"/>`;
    })
    .join('');
}

export interface PixelTextOptions {
  /** Size of one font pixel. */
  px: number;
  fill: string;
  anchor?: 'start' | 'middle' | 'end';
  cls?: string;
}

/** Width of a string in screen pixels. */
export const textWidth = (s: string, px: number): number => (s.length * ADVANCE - 1) * px;

/** A string in the pixel font; (x, y) is the top of the line at its anchor. */
export function pixelText(s: string, x: number, y: number, o: PixelTextOptions): string {
  const w = textWidth(s, o.px);
  const left = o.anchor === 'middle' ? x - w / 2 : o.anchor === 'end' ? x - w : x;
  const uses = [...s]
    .map((ch, i) => (ch === ' ' ? '' : `<use href="#${glyphId(ch)}" x="${i * ADVANCE}"/>`))
    .join('');
  const r = (n: number) => Math.round(n * 100) / 100;
  return (
    `<g${o.cls ? ` class="${o.cls}"` : ''} fill="${o.fill}" ` +
    `transform="translate(${r(left)} ${r(y)}) scale(${o.px})">${uses}</g>`
  );
}

/** One glyph at a font-pixel offset, for building counters digit by digit. */
export function glyphUse(ch: string, xFontPx: number, cls?: string): string {
  return `<use href="#${glyphId(ch)}" x="${xFontPx}"${cls ? ` class="${cls}"` : ''}/>`;
}
