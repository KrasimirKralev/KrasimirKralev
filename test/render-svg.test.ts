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
); // 2 populated columns

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
    const svg = renderSvg(SAMPLE, DARK);
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/\son\w+\s*=/i); // onload=, onclick=, ...
    expect(svg).not.toMatch(/javascript:/i);
    expect(svg).not.toMatch(/href\s*=\s*["']https?:/i); // no external fetches
    expect(svg).not.toMatch(/url\(\s*["']?https?:/i);
    expect(svg).not.toMatch(/@import/i);
  });

  it('animates with embedded CSS keyframes, one clean pickup per commit', () => {
    const svg = renderSvg(SAMPLE, DARK);
    expect(svg).toContain('<style');
    expect(svg).toContain('@keyframes');
    const harvestCycles = (svg.match(/@keyframes hv\d+/g) ?? []).length;
    expect(harvestCycles).toBe(SAMPLE.totalCells); // every commit grabbed individually
  });

  it('renders a crab as the claw', () => {
    expect(renderSvg(SAMPLE, DARK)).toContain('class="crab"');
  });

  it('shows commits being deposited into the box', () => {
    const svg = renderSvg(SAMPLE, DARK);
    expect(svg).toContain('class="box"');
    expect(svg).toContain('@keyframes boxCatch');
  });

  it('uses the palette background and accent', () => {
    expect(renderSvg(SAMPLE, DARK)).toContain(DARK.background);
    expect(renderSvg(SAMPLE, DARK)).toContain(DARK.accent);
    expect(renderSvg(SAMPLE, LIGHT)).toContain(LIGHT.background);
  });

  it('renders the idle SCANNING state for an empty grid, without a sweep', () => {
    const empty = planSweep(gridFromLevels([[0, 0, 0, 0, 0, 0, 0]]));
    const svg = renderSvg(empty, DARK);
    expect(svg).toContain('SCANNING');
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
});
