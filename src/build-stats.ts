import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchStats, PROFILE_STATS } from './fetch-stats';
import { renderStatsSvg, STATS_DARK, STATS_LIGHT } from './render-stats';

const login = process.env.GH_LOGIN ?? 'KrasimirKralev';
const token = process.env.GITHUB_TOKEN;
const outDir = process.env.OUT_DIR ?? '.';

if (!token) {
  console.error('Missing GITHUB_TOKEN in the environment.');
  process.exit(1);
}

try {
  const stats = await fetchStats({ login, ...PROFILE_STATS }, token, {
    // Shows up as an annotation on the workflow run.
    warn: (message) => console.log(`::warning::${message}`),
  });

  mkdirSync(outDir, { recursive: true });
  const targets = [
    { file: 'stats.svg', theme: STATS_LIGHT },
    { file: 'stats-dark.svg', theme: STATS_DARK },
  ];
  for (const { file, theme } of targets) {
    const svg = renderStatsSvg(stats, theme);
    const path = join(outDir, file);
    writeFileSync(path, svg, 'utf8');
    console.log(`${path}  (${(svg.length / 1024).toFixed(1)} KB)`);
  }
  // The numbers behind the card, for the PR preview; never published.
  writeFileSync(join(outDir, 'stats.json'), `${JSON.stringify(stats, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(stats));
} catch (error) {
  console.error(`Could not build the stats card: ${(error as Error).message}`);
  process.exit(1);
}
