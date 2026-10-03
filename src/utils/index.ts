import type { GameDate, GameState } from '../types/game';

export const clamp = (v: number, lo = 0, hi = 100) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const round1 = (v: number) => Math.round(v * 10) / 10;
export const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);

export const clone = <T,>(v: T): T => structuredClone(v);

export const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function dateLabel(d: GameDate): string {
  return `${MONTHS[d.month - 1]}–${MONTHS[d.month % 12]} ${d.year}`;
}
export function turnToDate(start: GameDate, turnsAhead: number): GameDate {
  const m = start.month - 1 + turnsAhead * 2;
  return { year: start.year + Math.floor(m / 12), month: (m % 12) + 1 };
}
export function turnsToText(turns: number): string {
  const months = turns * 2;
  if (months < 12) return `${months} חודשים`;
  const y = Math.floor(months / 12);
  const r = months % 12;
  return r ? `${y} שנים ו-${r} חודשים` : y === 1 ? 'שנה' : `${y} שנים`;
}

export function newId(s: GameState, prefix: string): string {
  s.nextId += 1;
  return `${prefix}_${s.nextId}`;
}

export const fmtB = (v: number) => `₪${round1(v).toLocaleString('he-IL')} מיליארד`;
export const fmtPct = (v: number, digits = 1) => `${v.toFixed(digits)}%`;
export const signed = (v: number, digits = 1) => `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;

export const deficitPct = (s: GameState) => (s.economy.deficit / s.economy.gdp) * 100;
export const debtPct = (s: GameState) => (s.economy.debt / s.economy.gdp) * 100;
