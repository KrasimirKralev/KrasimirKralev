import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fetchContributions } from './fetch-contributions';
import { planSweep } from './plan-sweep';
import { renderSvg } from './render-svg';
import { DARK, LIGHT } from './palette';

const login = process.env.GH_LOGIN ?? 'KrasimirKralev';
const token = process.env.GITHUB_TOKEN ?? process.env.CONTRIB_TOKEN;
const outDir = process.env.OUT_DIR ?? '.';

if (!token) {
  console.error('Missing GITHUB_TOKEN (or CONTRIB_TOKEN) in the environment.');
  process.exit(1);
}

const date = new Date().toISOString().slice(0, 10);
// Seed the pickup order from the date: a fresh random path each day, reproducible.
const seed = [...date].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);

const grid = await fetchContributions(login, token);
const plan = planSweep(grid);

mkdirSync(outDir, { recursive: true });
const targets = [
  { file: 'claw-dark.svg', palette: DARK },
  { file: 'claw-light.svg', palette: LIGHT },
];

for (const { file, palette } of targets) {
  const svg = renderSvg(plan, palette, { date, seed });
  const path = join(outDir, file);
  writeFileSync(path, svg, 'utf8');
  console.log(`${path}  (${(svg.length / 1024).toFixed(1)} KB)`);
}

console.log(
  `Plan: ${plan.totalCells} lit cells across ${plan.steps.length}/${plan.columns} columns` +
    (plan.isEmpty ? ' — idle SCANNING state' : ''),
);
