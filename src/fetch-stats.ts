/**
 * Live profile stats: merged-PR counts from the search API and contributor
 * ranks from the contributors API, counted at build time so the README never
 * carries a number that has gone stale.
 */

export interface StatsConfig {
  login: string;
  /** The shell prompt drawn above the numbers. */
  prompt: string;
  home: { repo: string; label: string };
  org: { name: string; label: string };
  /** Repos whose contributor rank gets its own line, in this order. */
  rankRepos: string[];
}

/** What the profile shows. Labels and repos only: every number is fetched. */
export const PROFILE_STATS: Omit<StatsConfig, 'login'> = {
  prompt: 'krasi@plovdiv:~',
  home: { repo: 'ID-Robots/clawbox', label: 'ClawBox' },
  org: { name: 'openclaw', label: 'OpenClaw' },
  rankRepos: ['openclaw/mcporter', 'openclaw/lobster'],
};

export interface Rank {
  repo: string;
  rank: number;
  of: number;
}

export interface Stats {
  prompt: string;
  /** The day the numbers were counted, YYYY-MM-DD (UTC). */
  date: string;
  home: { label: string; repo: string; merged: number; rank: Rank | null };
  org: { label: string; name: string; merged: number; repos: number };
  ranks: Rank[];
}

export type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

export interface FetchStatsOptions {
  fetch?: FetchLike;
  date?: string;
  warn?: (message: string) => void;
}

const API = 'https://api.github.com';
const PER_PAGE = 100;
/** The search API never returns more than 1,000 results for one query. */
const SEARCH_CAP = 1000;
/** A runaway-paging stop; the contributors API itself stops at a few hundred. */
const MAX_PAGES = 50;

/**
 * The user's rank among a repo's contributors, as GitHub's contributors API
 * lists them (the same list the repo page counts). Ties share the better rank.
 */
export function contributorRank(
  list: unknown,
  login: string,
): { rank: number; of: number } | null {
  if (!Array.isArray(list)) throw new Error('Contributors response is not a list.');
  const commits = (c: any) => Number(c?.contributions) || 0;
  const want = login.toLowerCase();
  const me = list.find((c) => String(c?.login ?? '').toLowerCase() === want);
  if (!me) return null;
  const ahead = list.filter((c) => commits(c) > commits(me)).length;
  return { rank: ahead + 1, of: list.length };
}

/** One page of a PR search: the total and the repo of every item on the page. */
export function parseSearchPage(json: unknown, query: string): { total: number; repos: string[] } {
  const body = json as any;
  if (typeof body?.total_count !== 'number' || !Array.isArray(body?.items)) {
    throw new Error(`Unexpected search response for "${query}".`);
  }
  // A search that timed out answers 200 with partial results; publishing those
  // would show a number lower than the truth.
  if (body.incomplete_results) {
    throw new Error(`The search API returned incomplete results for "${query}"; try again later.`);
  }
  return {
    total: body.total_count,
    repos: body.items.map((item: any) => {
      const match = /\/repos\/([^/]+\/[^/]+)$/.exec(String(item?.repository_url ?? ''));
      if (!match) throw new Error(`A search result for "${query}" has no repository.`);
      return match[1]!;
    }),
  };
}

async function getJson(fetchImpl: FetchLike, url: string, token: string): Promise<unknown> {
  const res = await fetchImpl(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'krasimirkralev-profile-stats',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  // 204 is how the contributors API answers for an empty repo.
  if (res.status === 204) return [];
  if (!res.ok) {
    throw new Error(`GitHub API request failed: ${res.status} ${res.statusText} (${url})`);
  }
  return res.json();
}

function searchUrl(query: string, page: number, perPage: number): string {
  const params = new URLSearchParams({ q: query, per_page: String(perPage), page: String(page) });
  return `${API}/search/issues?${params}`;
}

/** Every result of a PR search, paged, as the repo each one belongs to. */
async function searchRepos(fetchImpl: FetchLike, token: string, query: string): Promise<string[]> {
  const repos: string[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const { total, repos: onPage } = parseSearchPage(
      await getJson(fetchImpl, searchUrl(query, page, PER_PAGE), token),
      query,
    );
    if (total > SEARCH_CAP) {
      throw new Error(
        `"${query}" has ${total} results; the search API lists at most 1,000, so the repos cannot all be counted.`,
      );
    }
    repos.push(...onPage);
    if (repos.length >= total || onPage.length === 0) {
      if (repos.length !== total) {
        throw new Error(
          `"${query}" reported ${total} results but listed ${repos.length}; the results changed while paging.`,
        );
      }
      return repos;
    }
  }
  throw new Error(`"${query}" did not finish within ${MAX_PAGES} pages.`);
}

async function searchCount(fetchImpl: FetchLike, token: string, query: string): Promise<number> {
  return parseSearchPage(await getJson(fetchImpl, searchUrl(query, 1, 1), token), query).total;
}

async function contributors(fetchImpl: FetchLike, token: string, repo: string): Promise<unknown[]> {
  const all: unknown[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${API}/repos/${repo}/contributors?per_page=${PER_PAGE}&page=${page}`;
    const list = await getJson(fetchImpl, url, token);
    if (!Array.isArray(list)) throw new Error(`Contributors response for ${repo} is not a list.`);
    all.push(...list);
    if (list.length < PER_PAGE) return all;
  }
  throw new Error(`The contributors of ${repo} did not finish within ${MAX_PAGES} pages.`);
}

/** Count everything the stats card shows, live. Throws rather than guess. */
export async function fetchStats(
  config: StatsConfig,
  token: string,
  options: FetchStatsOptions = {},
): Promise<Stats> {
  const fetchImpl = options.fetch ?? ((url, init) => fetch(url, init));
  const warn = options.warn ?? ((message: string) => console.warn(message));
  const date = options.date ?? new Date().toISOString().slice(0, 10);
  const merged = (scope: string) => `is:pr is:merged author:${config.login} ${scope}`;

  const rankIn = async (repo: string): Promise<Rank | null> => {
    const found = contributorRank(await contributors(fetchImpl, token, repo), config.login);
    if (!found) warn(`${config.login} is not among the contributors of ${repo}; its rank is left out.`);
    return found && { repo, ...found };
  };

  const homeMerged = await searchCount(fetchImpl, token, merged(`repo:${config.home.repo}`));
  const orgRepos = await searchRepos(fetchImpl, token, merged(`org:${config.org.name}`));
  const homeRank = await rankIn(config.home.repo);
  const ranks: Rank[] = [];
  for (const repo of config.rankRepos) {
    const rank = await rankIn(repo);
    if (rank) ranks.push(rank);
  }

  // A token that cannot see search results gets a 200 with nothing in it, not
  // an error. The contributors API is a second, independent witness.
  const refuseZero = (count: number, where: string, seen: boolean) => {
    if (count === 0 && seen) {
      throw new Error(
        `The search API found 0 merged PRs by ${config.login} in ${where}, but the contributors API lists them there; refusing to publish a wrong zero.`,
      );
    }
  };
  refuseZero(homeMerged, config.home.repo, homeRank !== null);
  refuseZero(
    orgRepos.length,
    `org:${config.org.name}`,
    ranks.some((r) => r.repo.startsWith(`${config.org.name}/`)),
  );

  return {
    prompt: config.prompt,
    date,
    home: { label: config.home.label, repo: config.home.repo, merged: homeMerged, rank: homeRank },
    org: {
      label: config.org.label,
      name: config.org.name,
      merged: orgRepos.length,
      repos: new Set(orgRepos).size,
    },
    ranks,
  };
}
