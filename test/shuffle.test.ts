import { describe, it, expect } from 'vitest';
import { seededOrder } from '../src/shuffle';

describe('seededOrder', () => {
  it('returns a permutation of 0..n-1', () => {
    const order = seededOrder(10, 42);
    expect([...order].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('is deterministic for a given seed', () => {
    expect(seededOrder(20, 7)).toEqual(seededOrder(20, 7));
  });

  it('produces different orders for different seeds', () => {
    expect(seededOrder(20, 1)).not.toEqual(seededOrder(20, 2));
  });

  it('handles the empty case', () => {
    expect(seededOrder(0, 1)).toEqual([]);
  });
});
