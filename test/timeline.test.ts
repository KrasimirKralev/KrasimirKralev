import { describe, it, expect } from 'vitest';
import {
  RESET_START,
  SWEEP_END,
  marchAt,
  pickMisses,
  planMarch,
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

  it('plays every event one after another: shots, the saucer and the deaths', () => {
    const t = planTimeline(141, 4);
    const spans = [
      ...t.shots.map((s) => [s.start, s.done]),
      [t.bonus!.start, t.bonus!.done],
      ...t.deaths.map((d) => [d.start, d.done]),
    ].sort((a, b) => a[0]! - b[0]!);
    for (let i = 1; i < spans.length; i++) expect(spans[i]![0]).toBeGreaterThanOrEqual(spans[i - 1]![1]!);
  });

  it('sends the mystery saucer mid-wave, and only in a wave big enough', () => {
    const t = planTimeline(141, 4);
    expect(t.bonus!.before).toBe(70);
    expect(t.bonus!.done).toBeLessThanOrEqual(t.shots[70]!.start);
    expect(t.bonus!.start).toBeGreaterThanOrEqual(t.shots[69]!.done);
    expect(planTimeline(5, 4).bonus).toBeUndefined();
  });

  it('lets the invaders hit the ship twice in a big wave, never in a tiny one', () => {
    const t = planTimeline(141, 4);
    expect(t.deaths).toHaveLength(2);
    for (const d of t.deaths) {
      expect(ascending([d.start, d.impact, d.respawn, d.done])).toBe(true);
      expect(d.start).toBeGreaterThanOrEqual(t.shots[d.after]!.done);
    }
    expect(planTimeline(5, 4).deaths).toHaveLength(0);
  });

  it('misses exactly the shots picked to miss', () => {
    const t = planTimeline(300, 11);
    const misses = pickMisses(300, 11);
    t.shots.forEach((s, j) => expect(Boolean(s.miss)).toBe(misses.has(j)));
  });

  it('keeps one shot readable: longer waves for more commits, within bounds', () => {
    expect(planTimeline(10, 1).durationS).toBeGreaterThanOrEqual(30);
    expect(planTimeline(141, 1).durationS).toBeGreaterThan(planTimeline(40, 1).durationS);
    expect(planTimeline(5000, 1).durationS).toBeLessThanOrEqual(140);
  });
});

describe('planMarch', () => {
  it('starts home, steps sideways, and drops a row each time it turns', () => {
    const steps = planMarch(planTimeline(141, 2));
    expect(marchAt(steps, 0)).toEqual({ x: 0, y: 0 });
    expect(steps[1]!.x).toBeGreaterThan(0);
    expect(steps[6]!.y).toBeGreaterThan(0);
  });

  it('speeds up as the formation is shot down, like the arcade', () => {
    const steps = planMarch(planTimeline(141, 2));
    const gap = (i: number) => steps[i + 1]!.at - steps[i]!.at;
    expect(gap(steps.length - 3)).toBeLessThan(gap(0) / 3);
  });

  it('flips the invaders’ legs on every step', () => {
    const steps = planMarch(planTimeline(20, 2));
    steps.forEach((s, i) => expect(s.frame).toBe(i % 2));
  });

  it('holds still between steps and goes home for the next wave', () => {
    const steps = planMarch(planTimeline(141, 2));
    const mid = (steps[3]!.at + steps[4]!.at) / 2;
    expect(marchAt(steps, mid)).toEqual({ x: steps[3]!.x, y: steps[3]!.y });
    expect(marchAt(steps, RESET_START + 1)).toEqual({ x: 0, y: 0 });
  });
});

describe('poseChanges', () => {
  it('runs the way the ship moves, jumps at the end, and runs home for the reset', () => {
    const t = planTimeline(2, 1);
    const changes = poseChanges(t, { shots: [{ main: -1 }, { main: 1 }], home: 1 });
    expect(changes[0]).toEqual({ at: 0, pose: 'idle' });
    expect(changes).toContainEqual({ at: t.shots[0]!.start, pose: 'runLeft' });
    expect(changes).toContainEqual({ at: t.shots[1]!.start, pose: 'runRight' });
    expect(changes).toContainEqual({ at: SWEEP_END, pose: 'jump' });
    expect(changes).toContainEqual({ at: RESET_START, pose: 'runRight' });
    expect(ascending(changes.map((c) => c.at))).toBe(true);
  });

  it('looks upset after a miss', () => {
    const t = planTimeline(300, 11);
    const j = t.shots.findIndex((s) => s.miss);
    const shots = t.shots.map((s) => ({ main: 1, miss: s.miss ? -1 : undefined }));
    expect(poseChanges(t, { shots, home: 0 })).toContainEqual({ at: t.shots[j]!.miss!.top, pose: 'failed' });
  });

  it('disappears when hit and comes back when it respawns', () => {
    const t = planTimeline(141, 4);
    const changes = poseChanges(t, { shots: t.shots.map(() => ({ main: 1 })), bonus: -1, home: 0 });
    for (const d of t.deaths) {
      expect(changes).toContainEqual({ at: d.impact, pose: 'dead' });
      expect(changes).toContainEqual({ at: d.respawn, pose: 'idle' });
    }
    expect(changes).toContainEqual({ at: t.bonus!.start, pose: 'runLeft' });
  });
});
