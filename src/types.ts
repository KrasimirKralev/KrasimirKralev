/** Shared data model for the ClawBox claw-machine generator. */

export type ContributionLevel = 0 | 1 | 2 | 3 | 4;

/** One day cell in the contribution calendar. */
export interface Day {
  /** ISO date, yyyy-mm-dd. */
  date: string;
  /** Raw contribution count for the day. */
  count: number;
  /** GitHub quartile level 0 (none) .. 4 (highest). */
  level: ContributionLevel;
}

/**
 * The contribution grid. `weeks[w]` is one column (a calendar week, oldest
 * first); each column holds up to 7 `Day`s indexed by weekday (0 = Sunday).
 */
export interface ContributionGrid {
  weeks: Day[][];
}

/** A single lit cell the claw will harvest. */
export interface SweepCell {
  /** Weekday row, 0..6. */
  row: number;
  level: ContributionLevel;
}

/** One claw dip: all lit cells in a single populated column. */
export interface SweepStep {
  /** Week index (grid column) the trolley dips into. */
  column: number;
  /** Lit cells (level > 0) in this column, top-to-bottom. */
  cells: SweepCell[];
  /** Running count of lit cells harvested after this step (the HUD tally). */
  cumulativeCells: number;
}

/**
 * Deterministic harvest plan: one step per populated column, left-to-right.
 * Drives the renderer's trolley positions, dips, and tally.
 */
export interface SweepPlan {
  /** Grid width (number of weeks). */
  columns: number;
  /** Grid height (always 7). */
  rows: number;
  /** Ordered steps for populated columns only. */
  steps: SweepStep[];
  /** Total lit cells across the grid. */
  totalCells: number;
  /** True when nothing is lit — renderer shows the idle SCANNING state. */
  isEmpty: boolean;
}
