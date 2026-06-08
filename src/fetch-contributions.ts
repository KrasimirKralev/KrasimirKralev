import type { ContributionGrid, ContributionLevel } from './types';

const LEVEL: Record<string, ContributionLevel> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const QUERY = `query($login:String!){
  user(login:$login){
    contributionsCollection{
      contributionCalendar{
        weeks{
          contributionDays{ date contributionCount contributionLevel }
        }
      }
    }
  }
}`;

/** Map a GitHub GraphQL contributions response into a ContributionGrid. */
export function parseContributions(json: unknown): ContributionGrid {
  const weeks = (json as any)?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!Array.isArray(weeks)) {
    throw new Error(
      'No contribution calendar in response (check the login and token scope).',
    );
  }
  return {
    weeks: weeks.map((week: any) =>
      (week.contributionDays as any[]).map((day) => ({
        date: String(day.date),
        count: Number(day.contributionCount) || 0,
        level: LEVEL[day.contributionLevel] ?? 0,
      })),
    ),
  };
}

/** Fetch a user's contribution calendar via the GitHub GraphQL API. */
export async function fetchContributions(
  login: string,
  token: string,
): Promise<ContributionGrid> {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'clawbox-claw-machine',
    },
    body: JSON.stringify({ query: QUERY, variables: { login } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub GraphQL request failed: ${res.status} ${res.statusText}`);
  }

  const json = await res.json();
  if ((json as any).errors) {
    throw new Error(`GitHub GraphQL errors: ${JSON.stringify((json as any).errors)}`);
  }
  return parseContributions(json);
}
