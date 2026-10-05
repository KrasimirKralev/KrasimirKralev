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

  it('embeds the mascot sheet and the wordmark once each, reusing the sheet for every pose', () => {
    const svg = renderSvg(SAMPLE, DARK);
    expect(svg.match(/data:image\/webp;base64,/g)).toHaveLength(2);
    expect(svg.match(/id="sheet"/g)).toHaveLength(1);
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

  it('draws the cabinet: ClawBox header, glass, prize box, progress bar and score', () => {
    const svg = renderSvg(SAMPLE, DARK);
    for (const part of ['header', 'led', 'glass', 'prize-box', 'progress-meter', 'score']) {
      expect(svg).toContain(`class="${part}"`);
    }
    expect(svg).toContain('@keyframes progress');
  });

  it('plays like an arcade: marching invaders, a saucer, a CRT screen, READY! and ROUND CLEAR!', () => {
    const svg = renderSvg(SAMPLE, LIGHT);
    for (const part of ['march', 'saucer', 'crt', 'ready', 'round-clear']) {
      expect(svg).toContain(`class="${part}"`);
    }
    expect(svg).toContain('id="invA"');
    expect(svg).toContain('id="invB"');
  });

  it('draws every word in the pixel font, never as <text>', () => {
    const svg = renderSvg(SAMPLE, DARK, { date: '2026-10-05' });
    expect(svg).not.toContain('<text');
    expect(svg).toContain('<use href="#g48"'); // the digit 0
  });

  it('has no joystick, buttons or coin slot on the deck', () => {
    const svg = renderSvg(SAMPLE, DARK);
    for (const gone of ['joystick', 'grab-button', 'coin-slot', 'MOVE', 'GRAB', 'INSERT COIN']) {
      expect(svg).not.toContain(gone);
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
    expect(svg).toContain('class="scanning blink"');
    expect(svg).toContain('class="header"');
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
