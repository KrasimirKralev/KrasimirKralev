/** Color palettes for the two README themes. */

export interface Palette {
  name: 'dark' | 'light';
  /** Cabinet body, top and bottom of its gradient. */
  cabinet: string;
  cabinetEdge: string;
  /** Play area behind the glass. */
  glass: string;
  /** Contribution cell colors, indexed by level 0..4. */
  cell: [string, string, string, string, string];
  /** ClawBox accent (LED strips, carriage, prize box, score). */
  accent: string;
  /** Darker accent for depth/shadow. */
  accentDark: string;
  /** Cable and rail. */
  hardware: string;
  /** Labels on the glass. */
  textDim: string;
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

// GitHub's own contribution greens, so the grid reads as a real contribution graph.
export const DARK: Palette = {
  name: 'dark',
  cabinet: '#252e3b',
  cabinetEdge: '#121720',
  glass: '#0f141b',
  cell: ['#1f2632', '#0e4429', '#1a7f37', '#2ea043', '#46d160'],
  accent: '#ff7a18',
  accentDark: '#b8470a',
  hardware: '#9aa4b0',
  textDim: '#8b949e',
};

export const LIGHT: Palette = {
  name: 'light',
  cabinet: '#fdfdfe',
  cabinetEdge: '#dfe3e9',
  glass: '#ffffff',
  cell: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  accent: '#ec6209',
  accentDark: '#9a3d04',
  hardware: '#6e7781',
  textDim: '#656d76',
};
