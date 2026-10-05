import { describe, it, expect } from 'vitest';
import {
  MARCH_STEP,
  RESET_START,
  SWEEP_END,
  marchAt,
  pickMisses,
  planTimeline,
  poseChanges,
} from '../src/timeline';

const ascending = (xs: number[]): boolean => xs.every((x, i) => i === 0 || x > xs[i - 1]!);

describe('pickMisses', () => {
  it('is deterministic for a seed and changes with the seed', () => {
    expect([...pickMisses(400, 7)]).toEqual([...pickMisses(400, 7)]);
    expect([...pickMisses(400, 7)]).not.toEqual([...pickMisses(400, 8)]);
  });

  it('misses roughly one shot in twelve', () => {
    const rate = pickMisses(2400, 3).size / 2400;
    expect(rate).toBeGreaterThan(0.05);
    expect(rate).toBeLessThan(0.12);
  });

  it('never misses the very first shot', () => {
    for (let seed = 1; seed < 60; seed++) expect(pickMisses(50, seed).has(0)).toBe(false);
  });
});

describe('planTimeline', () => {
  it('gives every shot ordered moments inside the wave', () => {
    const t = planTimeline(141, 2026);
    expect(t.shots).toHaveLength(141);
    for (const s of t.shots) {
      const moments = [
        s.start,
        ...(s.miss ? [s.miss.aim, s.miss.fire, s.miss.top, s.miss.reaim] : []),
        s.aim,
        s.fire,
        s.hit,
        s.done,
      ];
      expect(ascending(moments)).toBe(true);
      expect(s.start).toBeGreaterThanOrEqual(0);
      expect(s.done).toBeLessThanOrEqual(SWEEP_END);
    }
  });

  it('fires one shot after another', () => {
    const { shots } = planTimeline(30, 5);
    for (let j = 1; j < shots.length; j++) {
      expect(shots[j]!.start).toBeGreaterThanOrEqual(shots[j - 1]!.done);
    }
  });

  it('misses exactly the shots picked to miss', () => {
    const t = planTimeline(300, 11);
    const misses = pickMisses(300, 11);
    t.shots.forEach((s, j) => expect(Boolean(s.miss)).toBe(misses.has(j)));
  });

  it('keeps one shot readable: longer waves for more commits, within bounds', () => {
    expect(planTimeline(10, 1).durationS).toBeGreaterThanOrEqual(30);
    expect(planTimeline(141, 1).durationS).toBeGreaterThan(planTimeline(40, 1).durationS);
    expect(planTimeline(5000, 1).durationS).toBeLessThanOrEqual(120);
  });
});

describe('marchAt', () => {
  it('starts home, steps sideways, and drops a row each time it turns', () => {
    expect(marchAt(0)).toEqual({ x: 0, y: 0 });
    expect(marchAt(MARCH_STEP).x).toBeGreaterThan(0);
    const turned = marchAt(MARCH_STEP * 6);
    expect(turned.y).toBeGreaterThan(0);
  });

  it('holds still between steps', () => {
    expect(marchAt(MARCH_STEP * 2.1)).toEqual(marchAt(MARCH_STEP * 2.9));
  });
});

describe('poseChanges', () => {
  it('runs the way the ship moves, jumps at the end, and runs home for the reset', () => {
    const t = planTimeline(2, 1);
    const changes = poseChanges(t, [{ main: -1 }, { main: 1 }], 1);
    expect(changes[0]).toEqual({ at: 0, pose: 'idle' });
    expect(changes).toContainEqual({ at: t.shots[0]!.start, pose: 'runLeft' });
    expect(changes).toContainEqual({ at: t.shots[1]!.start, pose: 'runRight' });
    expect(changes).toContainEqual({ at: SWEEP_END, pose: 'jump' });
    expect(changes).toContainEqual({ at: RESET_START, pose: 'runRight' });
    expect(ascending(changes.map((c) => c.at))).toBe(true);
  });

  it('stays idle for a shot fired from where it stands', () => {
    const t = planTimeline(1, 1);
    expect(poseChanges(t, [{ main: 0 }], 0)).not.toContainEqual({ at: t.shots[0]!.start, pose: 'runLeft' });
  });

  it('looks upset after a miss', () => {
    const t = planTimeline(300, 11);
    const j = t.shots.findIndex((s) => s.miss);
    const dirs = t.shots.map((s) => ({ main: 1, miss: s.miss ? -1 : undefined }));
    expect(poseChanges(t, dirs, 0)).toContainEqual({ at: t.shots[j]!.miss!.top, pose: 'failed' });
  });
});
