import { describe, it, expect, vi } from 'vitest';
import {
  contributorRank,
  fetchStats,
  parseSearchPage,
  type FetchLike,
  type StatsConfig,
} from '../src/fetch-stats';

const CONFIG: StatsConfig = {
  login: 'octo',
  prompt: 'octo@home:~',
  home: { repo: 'acme/box', label: 'Box' },
  org: { name: 'tools', label: 'Tools' },
  rankRepos: ['tools/alpha', 'tools/beta'],
};

const TOKEN = 'test-token-value';

function items(counts: Record<string, number>): { repository_url: string }[] {
  return Object.entries(counts).flatMap(([repo, n]) =>
    Array.from({ length: n }, () => ({ repository_url: `https://api.github.com/repos/${repo}` })),
  );
}

function people(...entries: [string, number][]): { login: string; contributions: number }[] {
  return entries.map(([login, contributions]) => ({ login, contributions }));
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Fake {
  /** Every search result for a query, before paging. */
  search: (q: string) => { total?: number; items: unknown[]; incomplete?: boolean };
  /** Every contributor of a repo, before paging; a Response is returned as is. */
  contributors: (repo: string) => unknown[] | Response;
}

/** A stand-in for the two GitHub REST endpoints the stats use, with real paging. */
function fakeGitHub(fake: Fake): FetchLike & { calls: string[]; headers: Headers[] } {
  const calls: string[] = [];
  const headers: Headers[] = [];
  const impl = (async (input: string, init?: RequestInit) => {
    calls.push(input);
    headers.push(new Headers(init?.headers));
    const url = new URL(input);
    const page = Number(url.searchParams.get('page') ?? '1');
    const perPage = Number(url.searchParams.get('per_page') ?? '30');
    const slice = (all: unknown[]) => all.slice((page - 1) * perPage, page * perPage);

    if (url.pathname === '/search/issues') {
      const result = fake.search(url.searchParams.get('q') ?? '');
      return json({
        total_count: result.total ?? result.items.length,
        incomplete_results: result.incomplete ?? false,
        items: slice(result.items),
      });
    }
    const match = /^\/repos\/([^/]+\/[^/]+)\/contributors$/.exec(url.pathname);
    if (match) {
      const result = fake.contributors(match[1]!);
      return result instanceof Response ? result : json(slice(result));
    }
    return json({ message: 'Not Found' }, 404);
  }) as FetchLike & { calls: string[]; headers: Headers[] };
  impl.calls = calls;
  impl.headers = headers;
  return impl;
}

/** The happy path: 3 PRs in the home repo, 105 across 3 org repos. */
const HAPPY: Fake = {
  search: (q) =>
    q.includes('repo:acme/box')
      ? { items: items({ 'acme/box': 3 }) }
      : { items: items({ 'tools/alpha': 60, 'tools/beta': 40, 'tools/gamma': 5 }) },
  contributors: (repo) => {
    if (repo === 'acme/box') return people(['octo', 900], ['ann', 40]);
    if (repo === 'tools/alpha') {
      // 103 contributors, so the list spans two pages; octo is tied for 2nd.
      const others = Array.from({ length: 100 }, (_, i) => [`dev${i}`, 1] as [string, number]);
      return people(['lead', 500], ['ann', 30], ['OCTO', 30], ...others);
    }
    return people(['lead', 50], ['ann', 9], ['octo', 2]);
  },
};

describe('contributorRank', () => {
  it('ranks by commits, ties sharing the better rank, out of everyone listed', () => {
    const list = people(['a', 10], ['b', 8], ['octo', 8], ['c', 2]);
    expect(contributorRank(list, 'octo')).toEqual({ rank: 2, of: 4 });
  });

  it('matches the login case-insensitively', () => {
    expect(contributorRank(people(['Octo', 3]), 'octo')).toEqual({ rank: 1, of: 1 });
  });

  it('returns null when the user is not in the list', () => {
    expect(contributorRank(people(['a', 1]), 'octo')).toBeNull();
  });

  it('throws on a response that is not a list', () => {
    expect(() => contributorRank({ message: 'Not Found' }, 'octo')).toThrow(/not a list/);
  });
});

describe('parseSearchPage', () => {
  it('reads the total and the repo of every item', () => {
    const page = parseSearchPage(
      { total_count: 2, incomplete_results: false, items: items({ 'a/x': 1, 'b/y': 1 }) },
      'q',
    );
    expect(page).toEqual({ total: 2, repos: ['a/x', 'b/y'] });
  });

  it('refuses incomplete results instead of publishing a low count', () => {
    expect(() =>
      parseSearchPage({ total_count: 5, incomplete_results: true, items: [] }, 'q'),
    ).toThrow(/incomplete/);
  });

  it('throws on an unexpected shape', () => {
    expect(() => parseSearchPage({ message: 'Bad credentials' }, 'q')).toThrow(/Unexpected/);
  });
});

describe('fetchStats', () => {
  it('counts merged PRs and repos, and ranks the user, from the live APIs', async () => {
    const fetch = fakeGitHub(HAPPY);
    const warn = vi.fn();
    const stats = await fetchStats(CONFIG, TOKEN, { fetch, date: '2026-10-12', warn });

    expect(stats).toEqual({
      prompt: 'octo@home:~',
      date: '2026-10-12',
      home: { label: 'Box', repo: 'acme/box', merged: 3, rank: { repo: 'acme/box', rank: 1, of: 2 } },
      org: { label: 'Tools', name: 'tools', merged: 105, repos: 3 },
      ranks: [
        { repo: 'tools/alpha', rank: 2, of: 103 },
        { repo: 'tools/beta', rank: 3, of: 3 },
      ],
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('asks the search API for merged PRs by the user, scoped to the repo and the org', async () => {
    const fetch = fakeGitHub(HAPPY);
    await fetchStats(CONFIG, TOKEN, { fetch, date: '2026-10-12' });
    const queries = fetch.calls
      .map((u) => new URL(u))
      .filter((u) => u.pathname === '/search/issues')
      .map((u) => u.searchParams.get('q'));

    expect(queries).toContain('is:pr is:merged author:octo repo:acme/box');
    expect(queries).toContain('is:pr is:merged author:octo org:tools');
    // 105 org results at 100 a page: two pages, and nothing more.
    expect(queries.filter((q) => q?.endsWith('org:tools'))).toHaveLength(2);
  });

  it('sends the token as a bearer header', async () => {
    const fetch = fakeGitHub(HAPPY);
    await fetchStats(CONFIG, TOKEN, { fetch, date: '2026-10-12' });
    expect(fetch.headers.every((h) => h.get('authorization') === `Bearer ${TOKEN}`)).toBe(true);
  });

  it('leaves out a rank, with a warning, when the user is not a listed contributor', async () => {
    const fetch = fakeGitHub({
      ...HAPPY,
      contributors: (repo) => (repo === 'tools/beta' ? people(['lead', 50]) : HAPPY.contributors(repo)),
    });
    const warn = vi.fn();
    const stats = await fetchStats(CONFIG, TOKEN, { fetch, date: '2026-10-12', warn });

    expect(stats.ranks.map((r) => r.repo)).toEqual(['tools/alpha']);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('tools/beta'));
  });

  it('treats an empty repo (204 No Content) as having no contributors', async () => {
    const fetch = fakeGitHub({
      ...HAPPY,
      contributors: (repo) =>
        repo === 'tools/beta' ? new Response(null, { status: 204 }) : HAPPY.contributors(repo),
    });
    const stats = await fetchStats(CONFIG, TOKEN, { fetch, date: '2026-10-12', warn: () => {} });
    expect(stats.ranks.map((r) => r.repo)).toEqual(['tools/alpha']);
  });

  it('fails on an API error, naming the status and never the token', async () => {
    const fetch = fakeGitHub({
      ...HAPPY,
      contributors: () => json({ message: 'Server Error' }, 502),
    });
    const error = await fetchStats(CONFIG, TOKEN, { fetch, date: '2026-10-12' }).catch((e) => e);
    expect(error).toBeInstanceOf(Error);
    expect(String(error.message)).toMatch(/502/);
    expect(String(error.message)).not.toContain(TOKEN);
  });

  it('fails when the search results are incomplete', async () => {
    const fetch = fakeGitHub({ ...HAPPY, search: () => ({ items: [], total: 9, incomplete: true }) });
    await expect(fetchStats(CONFIG, TOKEN, { fetch, date: '2026-10-12' })).rejects.toThrow(
      /incomplete/,
    );
  });

  it('fails when the org has more merged PRs than the search API can list', async () => {
    const fetch = fakeGitHub({
      ...HAPPY,
      search: (q) => (q.includes('org:') ? { items: [], total: 1001 } : HAPPY.search(q)),
    });
    await expect(fetchStats(CONFIG, TOKEN, { fetch, date: '2026-10-12' })).rejects.toThrow(
      /1,000/,
    );
  });

  it('refuses a zero from search when the contributors API shows the user there', async () => {
    // What a token that cannot see search results looks like: a 200 with nothing in it.
    const fetch = fakeGitHub({ ...HAPPY, search: () => ({ items: [] }) });
    await expect(fetchStats(CONFIG, TOKEN, { fetch, date: '2026-10-12' })).rejects.toThrow(
      /refusing/i,
    );
  });
});
