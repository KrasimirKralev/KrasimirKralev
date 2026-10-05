import { mulberry32 } from './shuffle';
import type { MascotPose } from './mascot-sprite';

/** Every moment is a percentage of one animation loop. */
export const APPROACH = 3; // the crab sets off from the box
export const SWEEP_END = 88; // last commit settled in the box; the crab celebrates
export const RESET_START = 94; // commits fly back out to the grid for the next round

/** The crab misses about one grab in this many, then tries again. */
const SLIP_ODDS = 12;
/** A missed grab takes this much longer than a clean one. */
const SLIP_WEIGHT = 1.6;

// One commit's slice, split into moments (fractions of the slice, ascending).
const CLEAN = { arrive: 0.22, grab: 0.32, lift: 0.44, boxArrive: 0.76, drop: 0.86, settle: 0.95 };
const SLIPPED = {
  arrive: 0.14,
  grab: 0.2,
  slipLift: 0.28,
  fall: 0.34,
  regrab: 0.5,
  lift: 0.58,
  boxArrive: 0.8,
  drop: 0.88,
  settle: 0.96,
};

/** When each moment of one commit's pickup happens. */
export interface Pickup {
  /** The crab leaves the box for this commit. */
  start: number;
  /** Over the commit's column. */
  arrive: number;
  /** Feet on the commit; the cell flashes and the button lights. */
  grab: number;
  /** A missed grab: hoisted a little, the commit falls back, the crab grabs again. */
  slip?: { lift: number; fall: number; regrab: number };
  /** Hoisted with the commit. */
  lift: number;
  /** Over the prize box. */
  boxArrive: number;
  /** Released into the box. */
  drop: number;
  /** The commit has landed on the pile. */
  settle: number;
}

export interface Timeline {
  pickups: Pickup[];
  durationS: number;
}

/** Which grabs miss: about one in SLIP_ODDS, the same all day, never the first. */
export function pickSlips(count: number, seed: number): Set<number> {
  const rng = mulberry32(seed ^ 0x5eed);
  const slips = new Set<number>();
  for (let j = 0; j < count; j++) {
    if (rng() < 1 / SLIP_ODDS && j > 0) slips.add(j);
  }
  return slips;
}

/** Lay every pickup end to end across the sweep window. */
export function planTimeline(count: number, seed: number): Timeline {
  const slips = pickSlips(count, seed);
  const weights = Array.from({ length: count }, (_, j) => (slips.has(j) ? SLIP_WEIGHT : 1));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const unit = (SWEEP_END - APPROACH) / total;

  let cursor = APPROACH;
  const pickups = weights.map((w, j): Pickup => {
    const sl = w * unit;
    const at = (f: number): number => cursor + f * sl;
    const pickup: Pickup = slips.has(j)
      ? {
          start: cursor,
          arrive: at(SLIPPED.arrive),
          grab: at(SLIPPED.grab),
          slip: { lift: at(SLIPPED.slipLift), fall: at(SLIPPED.fall), regrab: at(SLIPPED.regrab) },
          lift: at(SLIPPED.lift),
          boxArrive: at(SLIPPED.boxArrive),
          drop: at(SLIPPED.drop),
          settle: at(SLIPPED.settle),
        }
      : {
          start: cursor,
          arrive: at(CLEAN.arrive),
          grab: at(CLEAN.grab),
          lift: at(CLEAN.lift),
          boxArrive: at(CLEAN.boxArrive),
          drop: at(CLEAN.drop),
          settle: at(CLEAN.settle),
        };
    cursor += sl;
    return pickup;
  });

  // Long enough that one grab reads (~0.65 s each), short enough to loop.
  const durationS = Math.min(150, Math.max(30, 12 + count * 0.75));
  return { pickups, durationS };
}

export interface PoseChange {
  at: number;
  pose: MascotPose | 'runLeft';
}

/** The crab's pose over the loop: walk left out, idle while grabbing, walk right home. */
export function poseChanges(t: Timeline): PoseChange[] {
  const changes: PoseChange[] = [{ at: 0, pose: 'idle' }];
  for (const p of t.pickups) {
    changes.push({ at: p.start, pose: 'runLeft' }, { at: p.arrive, pose: 'idle' });
    if (p.slip) {
      changes.push({ at: p.slip.fall, pose: 'failed' }, { at: p.slip.regrab, pose: 'idle' });
    }
    changes.push({ at: p.lift, pose: 'runRight' }, { at: p.boxArrive, pose: 'idle' });
  }
  changes.push({ at: SWEEP_END, pose: 'jump' }, { at: RESET_START, pose: 'idle' });
  // A pickup can start the instant the previous one settled; keep the later pose.
  return changes.filter((c, i) => i === changes.length - 1 || changes[i + 1]!.at > c.at);
}
