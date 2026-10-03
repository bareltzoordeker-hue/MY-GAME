import type { GameState } from '../types/game';

/** mulberry32 step on a 32-bit state. Returns [value 0..1, nextState]. */
export function mulberry(stateIn: number): [number, number] {
  const next = (stateIn + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, next];
}

/** Seeded random bound to a (mutable draft) GameState. */
export function rand(s: GameState): number {
  const [v, n] = mulberry(s.rngState);
  s.rngState = n;
  return v;
}

export const chance = (s: GameState, p: number) => rand(s) < p;
export const randRange = (s: GameState, a: number, b: number) => a + rand(s) * (b - a);
export const randInt = (s: GameState, a: number, b: number) => Math.floor(randRange(s, a, b + 1));
export function pick<T>(s: GameState, arr: readonly T[]): T {
  return arr[Math.floor(rand(s) * arr.length)];
}
/** approx normal(0,1) */
export function gauss(s: GameState): number {
  return (rand(s) + rand(s) + rand(s) + rand(s) - 2) * 1.732;
}

/** Standalone generator for world creation before a state exists. */
export function makeRng(seed: number) {
  let st = seed | 0;
  const next = () => {
    const [v, n] = mulberry(st);
    st = n;
    return v;
  };
  return {
    next,
    range: (a: number, b: number) => a + next() * (b - a),
    int: (a: number, b: number) => Math.floor(a + next() * (b - a + 1)),
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    get state() { return st; },
  };
}
export type Rng = ReturnType<typeof makeRng>;
