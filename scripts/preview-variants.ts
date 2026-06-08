// Dev-only: render the crab-style variants side by side for review.
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchContributions } from '../src/fetch-contributions';
import { planSweep } from '../src/plan-sweep';
import { renderSvg, type CrabStyle } from '../src/render-svg';
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

const styles: CrabStyle[] = ['classic', 'robo', 'claw'];
mkdirSync(outDir, { recursive: true });

for (const crabStyle of styles) {
  const svg = renderSvg(plan, DARK, { date, seed, crabStyle });
  writeFileSync(join(outDir, `variant-${crabStyle}.svg`), svg, 'utf8');
  console.log(`variant-${crabStyle}.svg  (${(svg.length / 1024).toFixed(1)} KB)`);
}

const labels: Record<CrabStyle, string> = {
  classic: 'A — Classic crab (rounded body, eye stalks, pincers)',
  robo: 'B — Robo-crab (mecha chassis, visor, antenna)',
  claw: 'C — Claw-crab (big down-reaching pincers)',
};

const panes = styles
  .map(
    (s) =>
      `<section><h2>${labels[s]}</h2><img src="variant-${s}.svg" alt="${s}"/></section>`,
  )
  .join('\n');

const html = `<!doctype html><html><head><meta charset="utf-8"/><style>
  body{margin:0;background:#0d1117;color:#c9d1d9;font-family:ui-monospace,monospace}
  section{padding:22px 28px;border-bottom:1px solid #21262d}
  h2{font-size:13px;letter-spacing:1px;color:#ff7a18;margin:0 0 12px}
  img{display:block}
</style></head><body>
<div style="padding:16px 28px;font-size:12px;color:#8b949e">Crab variants — grab → carry → drop into the box (dark theme)</div>
${panes}
</body></html>`;
writeFileSync(join(outDir, 'variants.html'), html, 'utf8');
console.log('variants.html written');
