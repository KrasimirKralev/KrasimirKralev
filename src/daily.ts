/**
 * A deterministic seed derived from a date string, so the crab's pickup order
 * is fresh each day but reproducible within the day. Shared by the production
 * entry point and the dev preview scripts so they never diverge.
 */
export function dailySeed(date: string): number {
  return [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
}
