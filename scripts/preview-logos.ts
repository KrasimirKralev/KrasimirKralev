// Dev-only: render the title brand-mark options side by side for review.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchContributions } from '../src/fetch-contributions';
import { planSweep } from '../src/plan-sweep';
import { renderSvg, type LogoStyle } from '../src/render-svg';
import { DARK } from '../src/palette';
import { dailySeed } from '../src/daily';

const login = process.env.GH_LOGIN ?? 'KrasimirKralev';
const token = process.env.GITHUB_TOKEN ?? process.env.CONTRIB_TOKEN;
const outDir = process.env.OUT_DIR ?? 'preview';
if (!token) {
  console.error('Missing GITHUB_TOKEN.');
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
const seed = dailySeed(date);

const grid = await fetchContributions(login, token);
const plan = planSweep(grid);

const logos: LogoStyle[] = ['emoji', 'icon', 'mascot'];
const labels: Record<LogoStyle, string> = {
  emoji: 'A — Crab emoji (current)',
  icon: 'B — ClawBox icon logo',
  mascot: 'C — Crab mascot logo',
};

mkdirSync(outDir, { recursive: true });
for (const logo of logos) {
  const svg = renderSvg(plan, DARK, { date, seed, crabStyle: 'robo', logo });
  writeFileSync(join(outDir, `logo-${logo}.svg`), svg, 'utf8');
  console.log(`logo-${logo}.svg  (${(svg.length / 1024).toFixed(1)} KB)`);
}

const panes = logos
  .map((l) => `<section><h2>${labels[l]}</h2><img src="logo-${l}.svg" alt="${l}"/></section>`)
  .join('\n');
const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
  body{margin:0;background:#0d1117;color:#c9d1d9;font-family:ui-monospace,monospace}
  section{padding:22px 28px;border-bottom:1px solid #21262d}
  h2{font-size:13px;letter-spacing:1px;color:#ff7a18;margin:0 0 12px}
  img{display:block}
</style></head><body>
<div style="padding:16px 28px;font-size:12px;color:#8b949e">Title brand-mark options (dark theme)</div>
${panes}
</body></html>`;
writeFileSync(join(outDir, 'logos.html'), html, 'utf8');
console.log('logos.html written');
