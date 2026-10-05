import { describe, it, expect } from 'vitest';
import { pickSlips, planTimeline, poseChanges, RESET_START, SWEEP_END } from '../src/timeline';

const ascending = (xs: number[]): boolean => xs.every((x, i) => i === 0 || x > xs[i - 1]!);

describe('pickSlips', () => {
  it('is deterministic for a seed and changes with the seed', () => {
    expect([...pickSlips(400, 7)]).toEqual([...pickSlips(400, 7)]);
    expect([...pickSlips(400, 7)]).not.toEqual([...pickSlips(400, 8)]);
  });

  it('misses roughly one grab in twelve', () => {
    const rate = pickSlips(2400, 3).size / 2400;
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThan(0.12);
  });

  it('never misses the very first grab', () => {
    for (let seed = 1; seed < 60; seed++) expect(pickSlips(50, seed).has(0)).toBe(false);
  });
});

describe('planTimeline', () => {
  it('gives every commit ordered moments inside the sweep window', () => {
    const t = planTimeline(141, 2026);
    expect(t.pickups).toHaveLength(141);
    for (const p of t.pickups) {
      const moments = [
        p.start,
        p.arrive,
        p.grab,
        ...(p.slip ? [p.slip.lift, p.slip.fall, p.slip.regrab] : []),
        p.lift,
        p.boxArrive,
        p.drop,
        p.settle,
      ];
      expect(ascending(moments)).toBe(true);
      expect(p.start).toBeGreaterThanOrEqual(0);
      expect(p.settle).toBeLessThanOrEqual(SWEEP_END);
    }
  });

  it('runs the commits one after another', () => {
    const { pickups } = planTimeline(30, 5);
    for (let j = 1; j < pickups.length; j++) {
      expect(pickups[j]!.start).toBeGreaterThanOrEqual(pickups[j - 1]!.settle);
    }
  });

  it('re-grabs exactly the commits that slip', () => {
    const t = planTimeline(300, 11);
    const slips = pickSlips(300, 11);
    t.pickups.forEach((p, j) => expect(Boolean(p.slip)).toBe(slips.has(j)));
  });

  it('keeps one grab readable: longer loops for more commits, within bounds', () => {
    expect(planTimeline(10, 1).durationS).toBeGreaterThanOrEqual(30);
    expect(planTimeline(141, 1).durationS).toBeGreaterThan(planTimeline(40, 1).durationS);
    expect(planTimeline(5000, 1).durationS).toBeLessThanOrEqual(150);
  });
});

describe('poseChanges', () => {
  it('walks left to a commit, right to the box, jumps at the end, and rests for the reset', () => {
    const t = planTimeline(3, 1);
    const changes = poseChanges(t);
    expect(changes[0]).toEqual({ at: 0, pose: 'idle' });
    const first = t.pickups[0]!;
    expect(changes).toContainEqual({ at: first.start, pose: 'runLeft' });
    expect(changes).toContainEqual({ at: first.lift, pose: 'runRight' });
    expect(changes).toContainEqual({ at: SWEEP_END, pose: 'jump' });
    expect(changes).toContainEqual({ at: RESET_START, pose: 'idle' });
    expect(ascending(changes.map((c) => c.at))).toBe(true);
  });

  it('looks upset for a slipped grab', () => {
    const t = planTimeline(300, 11);
    const slipped = t.pickups.find((p) => p.slip)!;
    expect(poseChanges(t)).toContainEqual({ at: slipped.slip!.fall, pose: 'failed' });
  });
});
