import type { Stats } from './fetch-stats';

/**
 * The colours GitHub gives a ```console block (background, prompt, command,
 * output, comment), so the card reads as the rest of the README's terminal.
 */
export interface StatsTheme {
  name: 'light' | 'dark';
  bg: string;
  fg: string;
  prompt: string;
  value: string;
  dim: string;
}

export const STATS_LIGHT: StatsTheme = {
  name: 'light',
  bg: '#f6f8fa',
  fg: '#1f2328',
  prompt: '#6639ba',
  value: '#0550ae',
  dim: '#59636e',
};

export const STATS_DARK: StatsTheme = {
  name: 'dark',
  bg: '#151b23',
  fg: '#f0f6fc',
  prompt: '#d2a8ff',
  value: '#79c0ff',
  dim: '#9198a1',
};

type Kind = 'prompt' | 'command' | 'output' | 'number' | 'comment';
export type Segment = readonly [Kind, string];

const FONT_SIZE = 14;
const LINE_HEIGHT = 21;
const PAD = 16;
/** Monospace advance is about 0.6em; two spare columns absorb wider fonts. */
const CHAR_WIDTH = 0.6 * FONT_SIZE;
const SPARE_COLUMNS = 2;

const fmt = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, word: string) => (n === 1 ? word : `${word}s`);

/** The card, line by line, as coloured segments. */
export function statsLines(stats: Stats): Segment[][] {
  const { home, org } = stats;
  const homeLine: Segment[] = [
    ['number', fmt(home.merged)],
    ['output', ` ${plural(home.merged, 'PR')} merged into ${home.label}`],
  ];
  if (home.rank) {
    homeLine.push(
      ['output', ' · '],
      ['number', `#${home.rank.rank}`],
      ['output', ` of ${fmt(home.rank.of)} ${plural(home.rank.of, 'contributor')}`],
    );
  }
  return [
    [
      ['prompt', stats.prompt],
      ['command', '$ uptime'],
    ],
    homeLine,
    [
      ['number', fmt(org.merged)],
      ['output', ` ${plural(org.merged, 'PR')} merged across `],
      ['number', fmt(org.repos)],
      ['output', ` ${org.label} ${plural(org.repos, 'repo')}`],
    ],
    ...stats.ranks.map((r): Segment[] => [
      ['number', `#${r.rank}`],
      ['output', ` of ${fmt(r.of)} ${plural(r.of, 'contributor')} in ${r.repo}`],
    ]),
    [['comment', `# counted from the GitHub API on ${stats.date}`]],
  ];
}

const escapeXml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&${{ '&': 'amp', '<': 'lt', '>': 'gt', '"': 'quot', "'": 'apos' }[c]};`);

const CLASS: Record<Kind, string> = {
  prompt: 'p',
  command: 'c',
  output: 'o',
  number: 'n',
  comment: 'd',
};

/** A small, self-contained SVG: no scripts, links, fonts or images. */
export function renderStatsSvg(stats: Stats, theme: StatsTheme): string {
  const lines = statsLines(stats);
  const plain = lines.map((line) => line.map(([, t]) => t).join(''));
  const columns = Math.max(...plain.map((l) => l.length)) + SPARE_COLUMNS;
  const width = Math.ceil(PAD * 2 + columns * CHAR_WIDTH);
  const height = PAD * 2 + lines.length * LINE_HEIGHT;
  // Baseline of the first row: the line box is centred on the font size.
  const firstBaseline = PAD + Math.round((LINE_HEIGHT - FONT_SIZE) / 2 + FONT_SIZE * 0.8);

  const rows = lines
    .map((line, i) => {
      const spans = line
        .map(([kind, t]) => `<tspan class="${CLASS[kind]}">${escapeXml(t)}</tspan>`)
        .join('');
      return `<text x="${PAD}" y="${firstBaseline + i * LINE_HEIGHT}" xml:space="preserve">${spans}</text>`;
    })
    .join('\n');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="stats-title">
<title id="stats-title">${escapeXml(plain.join('\n'))}</title>
<style>
text{font-family:ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace;font-size:${FONT_SIZE}px}
.p{fill:${theme.prompt}}.c{fill:${theme.fg}}.o{fill:${theme.value}}.n{fill:${theme.value};font-weight:700}.d{fill:${theme.dim}}
</style>
<rect width="${width}" height="${height}" rx="6" fill="${theme.bg}"/>
${rows}
</svg>
`;
}
