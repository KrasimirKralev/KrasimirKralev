import { describe, it, expect } from 'vitest';
import { bitmapPath, glyphDefs, pixelText, textWidth } from '../src/pixel-art';

describe('pixel art', () => {
  it('draws a bitmap as one path, merging runs of lit pixels', () => {
    expect(bitmapPath(['##.#', '....'])).toBe('M0 0h2v1h-2zM3 0h1v1h-1z');
  });

  it('embeds only the glyphs a string uses, once each', () => {
    const defs = glyphDefs(['ABBA', 'A']);
    expect(defs.match(/<path id="g\d+"/g)).toHaveLength(2);
  });

  it('refuses a character the font cannot draw', () => {
    expect(() => glyphDefs(['~'])).toThrow(/no glyph/);
  });

  it('anchors text at its start, middle or end', () => {
    const w = textWidth('AB', 2); // (2 chars * 6 - 1) * 2
    expect(w).toBe(22);
    expect(pixelText('AB', 100, 0, { px: 2, fill: '#fff', anchor: 'end' })).toContain('translate(78 0)');
    expect(pixelText('AB', 100, 0, { px: 2, fill: '#fff', anchor: 'middle' })).toContain('translate(89 0)');
  });
});
