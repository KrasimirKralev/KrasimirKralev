/** Color palettes for the two README themes. */

export interface Palette {
  name: 'dark' | 'light';
  /** Cabinet body. */
  cabinet: string;
  /** Cabinet trim and panel edges. */
  cabinetEdge: string;
  /** Marquee panel behind the title (dark in both themes, like a lit sign). */
  marquee: string;
  /** Play area behind the glass. */
  glass: string;
  /** Control deck under the glass. */
  deck: string;
  /** Contribution cell colors, indexed by level 0..4. */
  cell: [string, string, string, string, string];
  /** ClawBox accent (title, rail carriage, prize box, counter). */
  accent: string;
  /** Darker accent for depth/shadow. */
  accentDark: string;
  /** Cable / gantry hardware. */
  hardware: string;
  /** Marquee bulbs, unlit and lit. */
  bulbOff: string;
  bulbOn: string;
  /** The grab button, resting and lit. */
  button: string;
  buttonLit: string;
  /** Score display background. */
  lcd: string;
  /** Primary text. */
  text: string;
  /** Dim text. */
  textDim: string;
}

// GitHub's own contribution greens, so the grid reads as a real contribution graph.
export const DARK: Palette = {
  name: 'dark',
  cabinet: '#1a212c',
  cabinetEdge: '#2e3847',
  marquee: '#0b0f15',
  glass: '#0f141b',
  deck: '#151b24',
  cell: ['#1f2632', '#0e4429', '#1a7f37', '#2ea043', '#46d160'],
  accent: '#ff7a18',
  accentDark: '#b8470a',
  hardware: '#9aa4b0',
  bulbOff: '#4a2c12',
  bulbOn: '#ffc061',
  button: '#d9304f',
  buttonLit: '#ffb3c1',
  lcd: '#07090d',
  text: '#e6edf3',
  textDim: '#8b949e',
};

export const LIGHT: Palette = {
  name: 'light',
  cabinet: '#fff3e8',
  cabinetEdge: '#efc9a6',
  marquee: '#1f2328',
  glass: '#ffffff',
  deck: '#fde6d2',
  cell: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  accent: '#ec6209',
  accentDark: '#9a3d04',
  hardware: '#6e7781',
  bulbOff: '#5c3b1e',
  bulbOn: '#ffc061',
  button: '#d9304f',
  buttonLit: '#ffb3c1',
  lcd: '#1f2328',
  text: '#1f2328',
  textDim: '#656d76',
};
