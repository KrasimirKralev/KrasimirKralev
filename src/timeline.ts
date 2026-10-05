import { mulberry32 } from './shuffle';
import type { MascotPose } from './brand-assets';

/** Every moment is a percentage of one animation loop (one wave). */
export const APPROACH = 3; // READY!, then the first shot
export const SWEEP_END = 88; // the last invader is down; ROUND CLEAR!
export const RESET_START = 94; // the next wave flies in

/** The ship misses about one shot in this many, then fires again. */
const MISS_ODDS = 12;
/** A missed shot takes this much longer than a clean one. */
const MISS_WEIGHT = 1.7;

// One shot's slice, split into moments (fractions of the slice, ascending).
const CLEAN = { aim: 0.4, fire: 0.45, hit: 0.62, done: 0.95 };
const MISSED = {
  missAim: 0.2,
  missFire: 0.25,
  missTop: 0.38,
  reaim: 0.5,
  aim: 0.6,
  fire: 0.65,
  hit: 0.78,
  done: 0.97,
};

/** When each moment of one shot happens. */
export interface Shot {
  /** The ship sets off towards its firing spot. */
  start: number;
  /** A missed shot first: aimed a little off, fired, gone off the top, then a re-aim. */
  miss?: { aim: number; fire: number; top: number; reaim: number };
  /** In position under the invader. */
  aim: number;
  /** The laser leaves the ship. */
  fire: number;
  /** The laser hits; the invader explodes and the score goes up. */
  hit: number;
  /** The explosion is over. */
  done: number;
}

export interface Timeline {
  shots: Shot[];
  durationS: number;
}

/** Which shots miss: about one in MISS_ODDS, the same all day, never the first. */
export function pickMisses(count: number, seed: number): Set<number> {
  const rng = mulberry32(seed ^ 0x5eed);
  const misses = new Set<number>();
  for (let j = 0; j < count; j++) {
    if (rng() < 1 / MISS_ODDS && j > 0) misses.add(j);
  }
  return misses;
}

/** Lay every shot end to end across the wave. */
export function planTimeline(count: number, seed: number): Timeline {
  const misses = pickMisses(count, seed);
  const weights = Array.from({ length: count }, (_, j) => (misses.has(j) ? MISS_WEIGHT : 1));
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const unit = (SWEEP_END - APPROACH) / total;

  let cursor = APPROACH;
  const shots = weights.map((w, j): Shot => {
    const sl = w * unit;
    const at = (f: number): number => cursor + f * sl;
    const shot: Shot = misses.has(j)
      ? {
          start: cursor,
          miss: { aim: at(MISSED.missAim), fire: at(MISSED.missFire), top: at(MISSED.missTop), reaim: at(MISSED.reaim) },
          aim: at(MISSED.aim),
          fire: at(MISSED.fire),
          hit: at(MISSED.hit),
          done: at(MISSED.done),
        }
      : { start: cursor, aim: at(CLEAN.aim), fire: at(CLEAN.fire), hit: at(CLEAN.hit), done: at(CLEAN.done) };
    cursor += sl;
    return shot;
  });

  // Long enough that one shot reads (~0.55 s each), short enough to loop.
  const durationS = Math.min(120, Math.max(30, 10 + count * 0.55));
  return { shots, durationS };
}

// --- The formation's march ------------------------------------------------------

/** % of the loop between two steps of the formation. */
export const MARCH_STEP = 1;
const STEP_X = 3; // px per sideways step
const STEPS_ACROSS = 5; // steps before it turns
const DROP = 2; // px it drops on each turn
const MAX_DROPS = 8;

/** Where the formation stands at a moment: it hops across, turns, drops, hops back. */
export function marchAt(pct: number): { x: number; y: number } {
  const k = Math.floor(pct / MARCH_STEP);
  const phase = k % (STEPS_ACROSS * 2);
  const x = (phase <= STEPS_ACROSS ? phase : STEPS_ACROSS * 2 - phase) * STEP_X;
  const turns = Math.floor(k / STEPS_ACROSS);
  return { x, y: Math.min(turns, MAX_DROPS) * DROP };
}

/** How far the formation can reach, for sizing the screen. */
export const MARCH_RANGE = { x: STEPS_ACROSS * STEP_X, y: MAX_DROPS * DROP };

// --- The ship's poses -------------------------------------------------------------

export interface PoseChange {
  at: number;
  pose: MascotPose | 'runLeft';
}

/** -1 moving left, 1 moving right, 0 already in place. */
export type Direction = -1 | 0 | 1 | number;

const run = (dir: Direction): PoseChange['pose'] => (dir < 0 ? 'runLeft' : dir > 0 ? 'runRight' : 'idle');

/**
 * The ship's pose over the loop: run the way it moves, idle while it fires,
 * upset after a miss, jump when the wave is cleared, run home for the next one.
 */
export function poseChanges(
  t: Timeline,
  dirs: { main: Direction; miss?: Direction }[],
  homeDir: Direction,
): PoseChange[] {
  const changes: PoseChange[] = [{ at: 0, pose: 'idle' }];
  t.shots.forEach((s, j) => {
    const d = dirs[j]!;
    if (s.miss) {
      changes.push(
        { at: s.start, pose: run(d.miss ?? 0) },
        { at: s.miss.aim, pose: 'idle' },
        { at: s.miss.top, pose: 'failed' },
        { at: s.miss.reaim, pose: run(d.main) },
      );
    } else {
      changes.push({ at: s.start, pose: run(d.main) });
    }
    changes.push({ at: s.aim, pose: 'idle' });
  });
  changes.push({ at: SWEEP_END, pose: 'jump' }, { at: RESET_START, pose: run(homeDir) });
  // Drop repeats and moments that coincide, keeping the later pose.
  const unique = changes.filter((c, i) => i === changes.length - 1 || changes[i + 1]!.at > c.at);
  return unique.filter((c, i) => i === 0 || c.pose !== unique[i - 1]!.pose);
}
