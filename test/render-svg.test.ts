import { describe, it, expect } from 'vitest';
import { renderSvg } from '../src/render-svg';
import { planSweep } from '../src/plan-sweep';
import { DARK, LIGHT } from '../src/palette';
import { gridFromLevels } from './helpers';

const SAMPLE = planSweep(
  gridFromLevels([
    [0, 1, 0, 2, 0, 0, 0], // populated
    [0, 0, 0, 0, 0, 0, 0], // empty
    [3, 0, 4, 0, 0, 0, 1], // populated
  ]),
); // 5 commits in 2 populated columns

/** A year (53 weeks) with `lit` commits spread across it. */
const year = (lit: number) => {
  const weeks = Array.from({ length: 53 }, () => [0, 0, 0, 0, 0, 0, 0]);
  for (let i = 0; i < lit; i++) weeks[(i * 7) % 53]![i % 7] = (i % 4) + 1;
  return planSweep(gridFromLevels(weeks));
};

const viewBoxWidth = (svg: string): number =>
  Number(svg.match(/viewBox="0 0 ([\d.]+) [\d.]+"/)![1]);

describe('renderSvg', () => {
  it('produces a well-formed svg element', () => {
    const svg = renderSvg(SAMPLE, DARK);
    expect(svg.trimStart().startsWith('<svg')).toBe(true);
    expect(svg).toContain('</svg>');
    expect(svg).toContain('viewBox="0 0 ');
  });

  it('is camo-safe: no scripts, event handlers, or external resources', () => {
    const svg = renderSvg(SAMPLE, DARK, { seed: 3 });
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/\son\w+\s*=/i); // onload=, onclick=, ...
    expect(svg).not.toMatch(/javascript:/i);
    expect(svg).not.toMatch(/href\s*=\s*["']https?:/i); // no external fetches
    expect(svg).not.toMatch(/url\(\s*["']?https?:/i);
    expect(svg).not.toMatch(/@import/i);
  });

  it('embeds the mascot sheet once and reuses it for every pose', () => {
    const svg = renderSvg(SAMPLE, DARK);
    expect(svg.match(/data:image\/webp;base64,/g)).toHaveLength(1);
    expect(svg).toContain('href="#sheet"');
    for (const pose of ['idle', 'runLeft', 'runRight', 'jump']) {
      expect(svg).toContain(`class="pose pose-${pose}"`);
    }
  });

  it('animates with embedded CSS keyframes, one pickup per commit', () => {
    const svg = renderSvg(SAMPLE, DARK);
    expect(svg).toContain('@keyframes');
    expect(svg.match(/@keyframes hv\d+\{/g)).toHaveLength(SAMPLE.totalCells);
  });

  it('keeps every delivered commit on the pile instead of fading it out', () => {
    const svg = renderSvg(SAMPLE, DARK);
    const pickups = svg.match(/@keyframes hv\d+\{.*?\}\}/g) ?? [];
    expect(pickups).toHaveLength(SAMPLE.totalCells);
    for (const kf of pickups) expect(kf).not.toContain('opacity:0');
  });

  it('draws the arcade cabinet around the grid', () => {
    const svg = renderSvg(SAMPLE, DARK);
    for (const part of ['marquee', 'glass', 'joystick', 'grab-button', 'coin-slot', 'prize-box', 'score']) {
      expect(svg).toContain(`class="${part}"`);
    }
  });

  it('shows the crab upset only when a grab slips', () => {
    expect(renderSvg(year(141), DARK, { seed: 11 })).toContain('class="pose pose-failed"');
    expect(renderSvg(SAMPLE, DARK, { seed: 1 })).not.toContain('pose-failed');
  });

  it('uses the palette for each theme', () => {
    expect(renderSvg(SAMPLE, DARK)).toContain(DARK.cabinet);
    expect(renderSvg(SAMPLE, DARK)).toContain(DARK.accent);
    expect(renderSvg(SAMPLE, LIGHT)).toContain(LIGHT.cabinet);
  });

  it('renders the idle SCANNING state for an empty grid, without pickups', () => {
    const empty = planSweep(gridFromLevels([[0, 0, 0, 0, 0, 0, 0]]));
    const svg = renderSvg(empty, DARK);
    expect(svg).toContain('SCANNING');
    expect(svg).toContain('class="marquee"');
    expect(svg).not.toMatch(/@keyframes hv\d+/);
  });

  it('scales width with the number of columns', () => {
    const narrow = renderSvg(
      planSweep(gridFromLevels(Array.from({ length: 3 }, () => [1, 0, 0, 0, 0, 0, 0]))),
      DARK,
    );
    const wide = renderSvg(
      planSweep(gridFromLevels(Array.from({ length: 20 }, () => [1, 0, 0, 0, 0, 0, 0]))),
      DARK,
    );
    expect(viewBoxWidth(wide)).toBeGreaterThan(viewBoxWidth(narrow));
  });

  it('stays small enough for a README image', () => {
    expect(renderSvg(year(141), DARK, { seed: 9, date: '2026-10-05' }).length).toBeLessThan(420_000);
    expect(renderSvg(year(371), LIGHT, { seed: 9, date: '2026-10-05' }).length).toBeLessThan(900_000);
  });
});
