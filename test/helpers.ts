import type { ContributionGrid, ContributionLevel } from '../src/types';

/** Build a grid from a list of weeks, each week a list of day levels. */
export function gridFromLevels(weeks: number[][]): ContributionGrid {
  return {
    weeks: weeks.map((week, w) =>
      week.map((level, d) => ({
        date: `2026-01-${String(((w * 7 + d) % 28) + 1).padStart(2, '0')}`,
        count: level,
        level: level as ContributionLevel,
      })),
    ),
  };
}
