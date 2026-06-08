import type {
  ContributionGrid,
  SweepCell,
  SweepPlan,
  SweepStep,
} from './types';

/**
 * Turn a contribution grid into a deterministic harvest plan: one step per
 * populated column (left-to-right), each listing its lit cells top-to-bottom,
 * with a running tally. Empty columns are skipped; an all-zero grid yields the
 * idle (SCANNING) plan.
 */
export function planSweep(grid: ContributionGrid): SweepPlan {
  const steps: SweepStep[] = [];
  let cumulativeCells = 0;

  grid.weeks.forEach((week, column) => {
    const cells: SweepCell[] = [];
    week.forEach((day, row) => {
      if (day.level > 0) {
        cells.push({ row, level: day.level });
      }
    });

    if (cells.length > 0) {
      cumulativeCells += cells.length;
      steps.push({ column, cells, cumulativeCells });
    }
  });

  return {
    columns: grid.weeks.length,
    rows: 7,
    steps,
    totalCells: cumulativeCells,
    isEmpty: cumulativeCells === 0,
  };
}
