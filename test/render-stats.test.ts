import { describe, it, expect } from 'vitest';
import type { Stats } from '../src/fetch-stats';
import { renderStatsSvg, statsLines, STATS_DARK, STATS_LIGHT } from '../src/render-stats';

const STATS: Stats = {
  prompt: 'krasi@plovdiv:~',
  date: '2026-10-12',
  home: {
    label: 'ClawBox',
    repo: 'ID-Robots/clawbox',
    merged: 1234,
    rank: { repo: 'ID-Robots/clawbox', rank: 1, of: 11 },
  },
  org: { label: 'OpenClaw', name: 'openclaw', merged: 41, repos: 7 },
  ranks: [
    { repo: 'openclaw/mcporter', rank: 5, of: 48 },
    { repo: 'openclaw/lobster', rank: 4, of: 17 },
  ],
};

const text = (stats: Stats) => statsLines(stats).map((line) => line.map(([, t]) => t).join(''));

describe('statsLines', () => {
  it('prints the uptime prompt, the counts, the ranks and the date', () => {
    expect(text(STATS)).toEqual([
      'krasi@plovdiv:~$ uptime',
      '1,234 PRs merged into ClawBox · #1 of 11 contributors',
      '41 PRs merged across 7 OpenClaw repos',
      '#5 of 48 contributors in openclaw/mcporter',
      '#4 of 17 contributors in openclaw/lobster',
      '# counted from the GitHub API on 2026-10-12',
    ]);
  });

  it('uses the singular for one', () => {
    const one: Stats = {
      ...STATS,
      home: { ...STATS.home, merged: 1, rank: { repo: 'ID-Robots/clawbox', rank: 1, of: 1 } },
      org: { ...STATS.org, merged: 1, repos: 1 },
      ranks: [],
    };
    expect(text(one).slice(1, 3)).toEqual([
      '1 PR merged into ClawBox · #1 of 1 contributor',
      '1 PR merged across 1 OpenClaw repo',
    ]);
  });

  it('drops the rank when there is none, and prints only the ranks it has', () => {
    const lines = text({ ...STATS, home: { ...STATS.home, rank: null }, ranks: [] });
    expect(lines).toEqual([
      'krasi@plovdiv:~$ uptime',
      '1,234 PRs merged into ClawBox',
      '41 PRs merged across 7 OpenClaw repos',
      '# counted from the GitHub API on 2026-10-12',
    ]);
  });

  it('takes every number from the data, none from the code', () => {
    const other: Stats = {
      ...STATS,
      home: { ...STATS.home, merged: 77, rank: { repo: 'ID-Robots/clawbox', rank: 3, of: 9 } },
      org: { ...STATS.org, merged: 12, repos: 2 },
      ranks: [{ repo: 'openclaw/mcporter', rank: 8, of: 60 }],
    };
    expect(text(other).slice(1, 4)).toEqual([
      '77 PRs merged into ClawBox · #3 of 9 contributors',
      '12 PRs merged across 2 OpenClaw repos',
      '#8 of 60 contributors in openclaw/mcporter',
    ]);
  });
});

describe('renderStatsSvg', () => {
  it('draws on the background GitHub uses for a console block, per theme', () => {
    expect(renderStatsSvg(STATS, STATS_LIGHT)).toContain('fill="#f6f8fa"');
    expect(renderStatsSvg(STATS, STATS_DARK)).toContain('fill="#151b23"');
    expect(renderStatsSvg(STATS, STATS_LIGHT)).not.toBe(renderStatsSvg(STATS, STATS_DARK));
  });

  it('has a size that matches its viewBox and one text row per line', () => {
    const svg = renderStatsSvg(STATS, STATS_LIGHT);
    const [, w, h] = /width="(\d+)" height="(\d+)" viewBox="0 0 (\d+) (\d+)"/.exec(svg) ?? [];
    expect(Number(w)).toBeGreaterThan(0);
    expect(svg).toContain(`viewBox="0 0 ${w} ${h}"`);
    expect(svg.match(/<text /g)).toHaveLength(statsLines(STATS).length);
  });

  it('grows wider with the longest line', () => {
    const width = (s: Stats) => Number(/width="(\d+)"/.exec(renderStatsSvg(s, STATS_LIGHT))![1]);
    const longer = { ...STATS, ranks: [{ repo: 'openclaw/a-much-longer-repository-name', rank: 2, of: 3 }] };
    expect(width(longer)).toBeGreaterThan(width(STATS));
  });

  it('carries the full text for screen readers', () => {
    const svg = renderStatsSvg(STATS, STATS_DARK);
    expect(svg).toContain('role="img"');
    expect(svg).toMatch(/<title id="[^"]+">[^<]*1,234 PRs merged into ClawBox/);
  });

  it('escapes markup in labels', () => {
    const svg = renderStatsSvg(
      { ...STATS, org: { ...STATS.org, label: 'A&B <i>' } },
      STATS_LIGHT,
    );
    expect(svg).toContain('A&amp;B &lt;i&gt;');
    expect(svg).not.toContain('<i>');
  });

  it('is self-contained: no scripts, links or external resources', () => {
    const svg = renderStatsSvg(STATS, STATS_LIGHT);
    expect(svg).not.toMatch(/<script|<image|<a |href=|url\(|@import|foreignObject/i);
  });
});
