import { describe, it, expect } from 'vitest';
import { parseContributions } from '../src/fetch-contributions';

const RESPONSE = {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          weeks: [
            {
              contributionDays: [
                { date: '2026-06-01', contributionCount: 0, contributionLevel: 'NONE' },
                { date: '2026-06-02', contributionCount: 5, contributionLevel: 'SECOND_QUARTILE' },
              ],
            },
            {
              contributionDays: [
                { date: '2026-06-08', contributionCount: 12, contributionLevel: 'FOURTH_QUARTILE' },
              ],
            },
          ],
        },
      },
    },
  },
};

describe('parseContributions', () => {
  it('maps weeks and days into a ContributionGrid with numeric levels', () => {
    const grid = parseContributions(RESPONSE);

    expect(grid.weeks).toHaveLength(2);
    expect(grid.weeks[0]).toEqual([
      { date: '2026-06-01', count: 0, level: 0 },
      { date: '2026-06-02', count: 5, level: 2 },
    ]);
    expect(grid.weeks[1]![0]).toEqual({ date: '2026-06-08', count: 12, level: 4 });
  });

  it('throws a clear error when the user is missing (bad login/token)', () => {
    expect(() => parseContributions({ data: { user: null } })).toThrow(/contribution/i);
  });
});
