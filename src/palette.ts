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
// A panel a notch lighter than GitHub's dark page (#0d1117) so the machine
// doesn't vanish into it, plus brighter empty sockets so the grid stays legible.
export const DARK: Palette = {
  name: 'dark',
  background: '#12171f',
  frame: '#3a424d',
  cell: ['#1f2632', '#0e4429', '#1a7f37', '#2ea043', '#46d160'],
  accent: '#ff7a18',
  accentDark: '#b8470a',
  hardware: '#9aa4b0',
  text: '#e6edf3',
  textDim: '#8b949e',
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
