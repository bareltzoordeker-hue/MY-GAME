// ============================================================
// Promise deadlines and the list of open promises.
// Deadlines are kept in "standard" two-month turns. A short turn (campaign, negotiation)
// moves them forward only by its share of a standard turn, and while there is no
// functioning government (caretaker, elections, negotiation) they stop altogether:
// nobody can be blamed for a law the Knesseton could not pass.
// ============================================================
import type { GameState } from '../types/game';
import { LAW_BY_ID } from '../data/laws';

const STANDARD_DAYS = 61; // a normal two-month turn

/** True while the government can't legislate or appoint, so promise clocks are frozen. */
export const deadlinesFrozen = (s: GameState) => !!s.government.caretaker || s.elections.phase !== 'none';

/** Call once per turn, after the date moved by `days`. */
export function slideDeadlines(s: GameState, days: number): void {
  const shift = deadlinesFrozen(s) ? 1 : Math.max(0, 1 - days / STANDARD_DAYS);
  if (shift <= 0) return;
  for (const p of Object.values(s.politicians)) {
    for (const m of p.memory) if (m.kind === 'promise' && !m.resolved && m.deadlineTurn !== undefined) m.deadlineTurn += shift;
  }
  for (const c of s.government.agreements ?? []) if (c.status === 'pending' && c.dueTurn !== undefined) c.dueTurn += shift;
}

export interface OpenPromise {
  key: string;
  source: 'agreement' | 'personal' | 'public';
  text: string;
  /** who it was promised to */
  to: string;
  toId?: string;
  lawId?: string;
  role?: boolean;
  /** standard turns left (rounded up), undefined when there is no deadline */
  turnsLeft?: number;
}

/** Every promise the player still has to keep, the closest deadline first. */
export function openPromises(s: GameState): OpenPromise[] {
  const left = (due?: number) => (due === undefined ? undefined : Math.max(0, Math.ceil(due - s.turn - 1e-6)));
  const out: OpenPromise[] = [];
  for (const c of s.government.agreements ?? []) {
    if (c.status !== 'pending' || c.kind !== 'law' || !c.lawId) continue;
    out.push({ key: `a${c.id}`, source: 'agreement', text: c.label, to: s.parties[c.partyId]?.name ?? '', lawId: c.lawId, turnsLeft: left(c.dueTurn) });
  }
  for (const p of Object.values(s.politicians)) {
    if (!p.active) continue;
    p.memory.forEach((m, i) => {
      if (m.kind !== 'promise' || m.resolved) return;
      const lawId = m.ref && m.ref !== 'role' && LAW_BY_ID[m.ref] ? m.ref : undefined;
      out.push({ key: `m${p.id}_${i}`, source: 'personal', text: m.text, to: p.name, toId: p.id, lawId, role: m.ref === 'role', turnsLeft: left(m.deadlineTurn) });
    });
  }
  for (const pr of s.promises) {
    if (pr.status !== 'pending') continue;
    out.push({ key: `p${pr.id}`, source: 'public', text: pr.text, to: 'הציבור', turnsLeft: left(pr.deadlineTurn) });
  }
  return out.sort((a, b) => (a.turnsLeft ?? 99) - (b.turnsLeft ?? 99));
}
