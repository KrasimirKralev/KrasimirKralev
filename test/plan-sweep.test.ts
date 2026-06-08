import { describe, it, expect } from 'vitest';
import { planSweep } from '../src/plan-sweep';
import { gridFromLevels } from './helpers';

describe('planSweep', () => {
  it('marks an all-zero grid as empty and produces no steps', () => {
    const grid = gridFromLevels([
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ]);

    const plan = planSweep(grid);

    expect(plan.isEmpty).toBe(true);
    expect(plan.steps).toEqual([]);
    expect(plan.totalCells).toBe(0);
    expect(plan.columns).toBe(2);
    expect(plan.rows).toBe(7);
  });

  it('creates one step per populated column, skipping empty columns, left-to-right', () => {
    const grid = gridFromLevels([
      [0, 1, 0, 0, 0, 0, 0], // col 0 populated
      [0, 0, 0, 0, 0, 0, 0], // col 1 empty -> skipped
      [2, 0, 0, 0, 0, 0, 3], // col 2 populated
    ]);

    const plan = planSweep(grid);

    expect(plan.isEmpty).toBe(false);
    expect(plan.steps.map((s) => s.column)).toEqual([0, 2]);
  });

  it('includes only lit cells in a column, in row order, with levels', () => {
    const grid = gridFromLevels([[0, 2, 0, 4, 0, 0, 1]]);

    const plan = planSweep(grid);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]!.cells).toEqual([
      { row: 1, level: 2 },
      { row: 3, level: 4 },
      { row: 6, level: 1 },
    ]);
  });

  it('accumulates a running tally of lit cells and a total', () => {
    const grid = gridFromLevels([
      [1, 1, 0, 0, 0, 0, 0], // 2 lit
      [0, 0, 3, 0, 0, 0, 0], // 1 lit
    ]);

    const plan = planSweep(grid);

    expect(plan.steps.map((s) => s.cumulativeCells)).toEqual([2, 3]);
    expect(plan.totalCells).toBe(3);
  });
});
