/** Color palettes for the two README themes. */

export interface Palette {
  name: 'dark' | 'light';
  /** Cabinet / canvas background. */
  background: string;
  /** Cabinet frame stroke. */
  frame: string;
  /** Contribution cell colors, indexed by level 0..4. */
  cell: [string, string, string, string, string];
  /** ClawBox accent (rail, trolley, claw, chute). */
  accent: string;
  /** Darker accent for depth/shadow. */
  accentDark: string;
  /** Cable / gantry hardware. */
  hardware: string;
  /** Primary HUD text. */
  text: string;
  /** Dim HUD text. */
  textDim: string;
}

// GitHub's own contribution greens, so the grid reads as a real contribution graph.
export const DARK: Palette = {
  name: 'dark',
  background: '#0d1117',
  frame: '#30363d',
  cell: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  accent: '#ff7a18',
  accentDark: '#b8470a',
  hardware: '#8b949e',
  text: '#e6edf3',
  textDim: '#7d8590',
};

export const LIGHT: Palette = {
  name: 'light',
  background: '#ffffff',
  frame: '#d0d7de',
  cell: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  accent: '#ec6209',
  accentDark: '#9a3d04',
  hardware: '#6e7781',
  text: '#1f2328',
  textDim: '#656d76',
};
