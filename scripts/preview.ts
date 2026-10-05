// Dev-only: render both themes into preview/ and a page that shows them the way
// a GitHub profile does. Uses the live contribution graph when GITHUB_TOKEN is
// set, otherwise a made-up year, so it also works offline.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchContributions } from '../src/fetch-contributions';
import { planSweep } from '../src/plan-sweep';
import { renderSvg } from '../src/render-svg';
import { DARK, LIGHT } from '../src/palette';
import { dailySeed } from '../src/daily';
import { mulberry32 } from '../src/shuffle';
import type { ContributionGrid, ContributionLevel } from '../src/types';

const login = process.env.GH_LOGIN ?? 'KrasimirKralev';
const token = process.env.GITHUB_TOKEN ?? process.env.CONTRIB_TOKEN;
const outDir = process.env.OUT_DIR ?? 'preview';
const date = process.env.PREVIEW_DATE ?? new Date().toISOString().slice(0, 10);

/** A plausible year: quiet at first, busier towards the end. */
function madeUpYear(): ContributionGrid {
  const rng = mulberry32(42);
  return {
    weeks: Array.from({ length: 53 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => {
        const lit = rng() < 0.08 + (w / 53) * 0.45;
        const level = (lit ? 1 + Math.floor(rng() * 4) : 0) as ContributionLevel;
        return { date: `w${w}d${d}`, count: level, level };
      }),
    ),
  };
}

const grid = token ? await fetchContributions(login, token) : madeUpYear();
const plan = planSweep(grid);
mkdirSync(outDir, { recursive: true });

for (const palette of [DARK, LIGHT]) {
  const svg = renderSvg(plan, palette, { date, seed: dailySeed(date) });
  writeFileSync(join(outDir, `claw-${palette.name}.svg`), svg, 'utf8');
  console.log(`claw-${palette.name}.svg  (${(svg.length / 1024).toFixed(1)} KB)`);
}

const pane = (theme: 'dark' | 'light', bg: string, fg: string) =>
  `<section style="background:${bg};color:${fg}"><h2>${theme}</h2>` +
  `<img src="claw-${theme}.svg" alt="claw machine, ${theme} theme"></section>`;
writeFileSync(
  join(outDir, 'index.html'),
  `<!doctype html><html><head><meta charset="utf-8"><title>Claw machine preview</title><style>
  body{margin:0;font:13px ui-monospace,monospace}
  section{padding:20px 24px}h2{margin:0 0 10px;font-size:12px;letter-spacing:1px;opacity:.7}
  img{display:block;width:100%;max-width:880px}
</style></head><body>
<p style="padding:0 24px">${plan.totalCells} commits · ${token ? `live data for ${login}` : 'made-up year'} · ${date}</p>
${pane('dark', '#0d1117', '#e6edf3')}
${pane('light', '#ffffff', '#1f2328')}
</body></html>`,
  'utf8',
);
console.log(`${join(outDir, 'index.html')} written`);
