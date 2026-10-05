/** Color palettes for the two README themes. */

export interface Palette {
  name: 'dark' | 'light';
  /** Cabinet body, top and bottom of its gradient. */
  cabinet: string;
  cabinetEdge: string;
  /** ClawBox accent (LED strips, carriage, prize box, score). */
  accent: string;
  /** Darker accent for depth/shadow. */
  accentDark: string;
  /** Cable and rail. */
  hardware: string;
}

/**
 * The header and the control deck are dark glass in both themes, like a lit
 * sign and a screen, so their colors do not change with the theme.
 */
export const PANEL = {
  top: '#1e2734',
  bottom: '#090c11',
  text: '#e6edf3',
  textDim: '#8b949e',
  track: '#1c2430',
};

/**
 * The play field is an arcade CRT, dark in both themes. Its grid uses GitHub's
 * dark-theme contribution greens, so it still reads as a contribution graph.
 */
export const SCREEN = {
  bg: '#07090e',
  cell: ['#161c26', '#0e4429', '#1a7f37', '#2ea043', '#46d160'] as const,
  phosphor: '#5cff7a',
  white: '#eef2f6',
  red: '#ff4d6d',
  gold: '#ffd27a',
  dim: '#8b949e',
};

export const DARK: Palette = {
  name: 'dark',
  cabinet: '#252e3b',
  cabinetEdge: '#121720',
  accent: '#ff7a18',
  accentDark: '#b8470a',
  hardware: '#9aa4b0',
};

export const LIGHT: Palette = {
  name: 'light',
  cabinet: '#fdfdfe',
  cabinetEdge: '#dfe3e9',
  accent: '#ec6209',
  accentDark: '#9a3d04',
  hardware: '#9aa4b0',
};
