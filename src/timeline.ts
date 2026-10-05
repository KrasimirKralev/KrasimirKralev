import { mulberry32 } from './shuffle';
import type { MascotPose } from './brand-assets';

/** Every moment is a percentage of one animation loop (one wave). */
export const APPROACH = 3; // READY!, then the first shot
export const SWEEP_END = 88; // the last invader is down; ROUND CLEAR!
export const RESET_START = 94; // the next wave flies in

/** The ship misses about one shot in this many, then fires again. */
const MISS_ODDS = 12;
const BONUS_MIN = 8; // the mystery saucer shows up in waves at least this big
const DEATH_MIN = 20; // invaders get a hit in on waves at least this big
const DEATH_AFTER = [0.32, 0.71]; // ...after this share of the shots

/** The ship always moves at one steady speed: a longer move simply takes longer. */
export const SHIP_SPEED = 70; // px per second
// Everything else in seconds of real time.
const SETTLE = 0.08; // stop, then fire
const LASER = 0.12; // the laser's flight
const BOOM = 0.2; // the explosion, before the next move
const MISS_FLIGHT = 0.2; // a missed laser leaving the screen
const UPSET = 0.32; // the ship's sulk after a miss
const BONUS_WAIT = 1.2; // waiting for the saucer to come over
const BONUS_AFTER = 0.8;
const DEATH_FALL = 0.7;
const DEATH_BLOWN = 0.6; // gone before it respawns
const DEATH_BLINK = 1.0;
const MIN_LOOP_S = 20;

/** When each moment of one shot happens. */
export interface Shot {
  /** The ship sets off towards its firing spot. */
  start: number;
  /** A missed shot first: aimed a little off, fired, gone off the top, then a re-aim. */
  miss?: { aim: number; fire: number; top: number; reaim: number };
  /** In position under the target. */
  aim: number;
  /** The laser leaves the ship. */
  fire: number;
  /** The laser hits; the target explodes and the score goes up. */
  hit: number;
  /** The explosion is over. */
  done: number;
}

/** The mystery saucer crossing the top: shot down for a bonus, just before shots[before]. */
export interface Bonus extends Shot {
  before: number;
}

/** An invader bomb hits the ship, right after shots[after]: it explodes, then respawns. */
export interface Death {
  after: number;
  /** The bomb is released. */
  start: number;
  impact: number;
  respawn: number;
  done: number;
}

export interface Timeline {
  shots: Shot[];
  bonus?: Bonus;
  deaths: Death[];
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

type Slot = { kind: 'shot'; j: number } | { kind: 'bonus' } | { kind: 'death'; after: number };

export interface PlanOptions {
  /** px the ship travels to line up each shot, in firing order (the first from its start). */
  moves: number[];
  /** px between a missed shot's spot and the right one. */
  reaimPx?: number;
}

/**
 * Lay out the wave: every shot, the saucer and the ship's deaths, end to end,
 * with the ship moving at SHIP_SPEED throughout, so its pace never changes.
 */
export function planTimeline({ moves, reaimPx = 7.5 }: PlanOptions, seed: number): Timeline {
  const count = moves.length;
  const misses = pickMisses(count, seed);
  const bonusBefore = count >= BONUS_MIN ? Math.floor(count / 2) : -1;
  const deathsAfter = count >= DEATH_MIN ? DEATH_AFTER.map((f) => Math.floor(count * f)) : [];

  const slots: Slot[] = [];
  for (let j = 0; j < count; j++) {
    if (j === bonusBefore) slots.push({ kind: 'bonus' });
    slots.push({ kind: 'shot', j });
    if (deathsAfter.includes(j)) slots.push({ kind: 'death', after: j });
  }

  // Each slot's moments as seconds from its start; the last one is its length.
  const travel = (px: number) => px / SHIP_SPEED;
  const plans = slots.map((slot): number[] => {
    if (slot.kind === 'bonus') return [0, BONUS_WAIT, BONUS_WAIT + LASER, BONUS_WAIT + LASER + BONUS_AFTER];
    if (slot.kind === 'death') return [0, DEATH_FALL, DEATH_FALL + DEATH_BLOWN, DEATH_FALL + DEATH_BLOWN + DEATH_BLINK];
    const move = travel(moves[slot.j]!);
    if (!misses.has(slot.j)) {
      return [0, move, move + SETTLE, move + SETTLE + LASER, move + SETTLE + LASER + BOOM];
    }
    // A miss: move to the spot beside it, fire, sulk, step over, fire again.
    const missFire = move + SETTLE;
    const missTop = missFire + MISS_FLIGHT;
    const reaim = missTop + UPSET;
    const aim = reaim + travel(reaimPx);
    return [0, move, missFire, missTop, reaim, aim, aim + SETTLE, aim + SETTLE + LASER, aim + SETTLE + LASER + BOOM];
  });
  const totalS = plans.reduce((a, m) => a + m[m.length - 1]!, 0) || 1;
  const pct = (SWEEP_END - APPROACH) / totalS;

  const shots: Shot[] = [];
  const deaths: Death[] = [];
  let bonus: Bonus | undefined;
  let cursor = APPROACH;
  slots.forEach((slot, i) => {
    const m = plans[i]!.map((sec) => cursor + sec * pct);
    if (slot.kind === 'bonus') {
      bonus = { before: bonusBefore, start: m[0]!, aim: m[0]!, fire: m[1]!, hit: m[2]!, done: m[3]! };
    } else if (slot.kind === 'death') {
      deaths.push({ after: slot.after, start: m[0]!, impact: m[1]!, respawn: m[2]!, done: m[3]! });
    } else if (m.length === 5) {
      shots.push({ start: m[0]!, aim: m[1]!, fire: m[2]!, hit: m[3]!, done: m[4]! });
    } else {
      shots.push({
        start: m[0]!,
        miss: { aim: m[1]!, fire: m[2]!, top: m[3]!, reaim: m[4]! },
        aim: m[5]!,
        fire: m[6]!,
        hit: m[7]!,
        done: m[8]!,
      });
    }
    cursor = m[m.length - 1]!;
  });

  // The wave fills (SWEEP_END - APPROACH)% of the loop; a tiny year gets a slower loop.
  const durationS = Math.max(MIN_LOOP_S, totalS / ((SWEEP_END - APPROACH) / 100));
  return { shots, bonus, deaths, durationS };
}

// --- The formation's march --------------------------------------------------------

export interface MarchStep {
  at: number;
  x: number;
  y: number;
  /** Which leg frame the invaders show: they flip on every step, like the arcade. */
  frame: 0 | 1;
}

const STEP_X = 3; // px per sideways step
const STEPS_ACROSS = 5; // steps before it turns
const DROP = 2; // px it drops on each turn
const MAX_DROPS = 10;
const SLOWEST = 1.4; // % of the loop between steps with the whole formation alive...
const FASTEST = 0.18; // ...and with the last invader standing

/** How far the formation can reach, for sizing the screen. */
export const MARCH_RANGE = { x: STEPS_ACROSS * STEP_X, y: MAX_DROPS * DROP };

/**
 * The formation hops across, turns, drops, hops back, and speeds up as it is
 * shot down, the way the arcade invaders do. Steps run until the next wave.
 */
export function planMarch(t: Timeline): MarchStep[] {
  const hits = t.shots.map((s) => s.hit).sort((a, b) => a - b);
  const total = Math.max(1, hits.length);
  const steps: MarchStep[] = [];
  let at = 0;
  let downed = 0;
  for (let k = 0; at < RESET_START; k++) {
    while (downed < hits.length && hits[downed]! <= at) downed++;
    const phase = k % (STEPS_ACROSS * 2);
    steps.push({
      at,
      x: (phase <= STEPS_ACROSS ? phase : STEPS_ACROSS * 2 - phase) * STEP_X,
      y: Math.min(Math.floor(k / STEPS_ACROSS), MAX_DROPS) * DROP,
      frame: (k % 2) as 0 | 1,
    });
    const alive = Math.max(1, total - downed) / total;
    at += Math.max(FASTEST, SLOWEST * alive ** 0.7);
  }
  return steps;
}

/** Where the formation stands at a moment (home again for the next wave). */
export function marchAt(steps: MarchStep[], pct: number): { x: number; y: number } {
  if (pct >= RESET_START || steps.length === 0) return { x: 0, y: 0 };
  let lo = 0;
  let hi = steps.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (steps[mid]!.at <= pct) lo = mid;
    else hi = mid - 1;
  }
  return { x: steps[lo]!.x, y: steps[lo]!.y };
}

// --- The ship's poses -------------------------------------------------------------

export interface PoseChange {
  at: number;
  /** 'dead': blown up, nothing drawn until it respawns. */
  pose: MascotPose | 'runLeft' | 'dead';
}

export interface Moves {
  /** Per shot: -1 moving left, 1 moving right, 0 already in place (and the miss's first move). */
  shots: { main: number; miss?: number }[];
  home: number;
}

const run = (dir: number): PoseChange['pose'] => (dir < 0 ? 'runLeft' : dir > 0 ? 'runRight' : 'idle');

/**
 * The ship's pose over the loop: run the way it moves, idle while it fires,
 * upset after a miss, gone while it is blown up, a jump when the wave is
 * cleared, and a run home for the next one.
 */
export function poseChanges(t: Timeline, moves: Moves): PoseChange[] {
  const changes: PoseChange[] = [{ at: 0, pose: 'idle' }];
  t.shots.forEach((s, j) => {
    // The saucer is timed to pass over the ship, which waits for it where it stands.
    if (t.bonus && t.bonus.before === j) changes.push({ at: t.bonus.start, pose: 'idle' });
    const d = moves.shots[j]!;
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
    for (const death of t.deaths.filter((x) => x.after === j)) {
      changes.push({ at: death.impact, pose: 'dead' }, { at: death.respawn, pose: 'idle' });
    }
  });
  changes.push({ at: SWEEP_END, pose: 'jump' }, { at: RESET_START, pose: run(moves.home) });
  // Drop repeats and moments that coincide, keeping the later pose.
  const unique = changes.filter((c, i) => i === changes.length - 1 || changes[i + 1]!.at > c.at);
  return unique.filter((c, i) => i === 0 || c.pose !== unique[i - 1]!.pose);
}
