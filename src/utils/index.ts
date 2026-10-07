import type { GameState } from '../types/game';

export const clamp = (v: number, lo = 0, hi = 100) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const round1 = (v: number) => Math.round(v * 10) / 10;
export const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export const clone = <T,>(v: T): T => structuredClone(v);

export { dateLabel } from '../engine/calendar';

export function newId(s: GameState, prefix: string): string {
  s.nextId += 1;
  return `${prefix}_${s.nextId}`;
}

export const fmtB = (v: number) => `₪${round1(v).toLocaleString('he-IL')} מיליארד`;
export const fmtPct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;
export const signed = (v: number, digits = 1) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;

export const deficitPct = (s: GameState) => (s.economy.deficit / s.economy.gdp) * 100;
export const debtPct = (s: GameState) => (s.economy.debt / s.economy.gdp) * 100;
