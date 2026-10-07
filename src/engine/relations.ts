// ============================================================
// Relations between parties (and helpers for MK-to-MK ties).
// Party relations start from ideology, bloc and coalition membership, then
// move with what happens: alliances, attacks, shared government, mergers.
// ============================================================
import type { GameState } from '../types/game';
import { clamp } from '../utils';
import { addNews, logEvent, remember } from './effects';
import { ideologyDistance } from './parliament';

const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Where a pair of parties "naturally" stands: ideology, bloc, sitting together in government. */
export function baseRelation(s: GameState, a: string, b: string): number {
  const pa = s.parties[a];
  const pb = s.parties[b];
  if (!pa || !pb) return 0;
  const sameBloc = pa.bloc && pa.bloc === pb.bloc;
  const together = s.government.coalition.includes(a) && s.government.coalition.includes(b);
  return clamp(45 - ideologyDistance(pa.ideology, pb.ideology) * 55 + (sameBloc ? 18 : -8) + (together ? 12 : 0), -100, 100);
}

export function partyRelation(s: GameState, a: string, b: string): number {
  if (a === b) return 100;
  const k = key(a, b);
  s.partyRelations ??= {};
  if (s.partyRelations[k] === undefined) s.partyRelations[k] = Math.round(baseRelation(s, a, b));
  return s.partyRelations[k];
}

export function shiftPartyRelation(s: GameState, a: string, b: string, delta: number): number {
  if (a === b) return 100;
  const v = clamp(partyRelation(s, a, b) + delta, -100, 100);
  s.partyRelations![key(a, b)] = v;
  return v;
}

/** Once per turn: relations drift back toward their natural level; partners in government grow closer. */
export function driftRelations(s: GameState): void {
  const ids = Object.keys(s.parties).filter((id) => s.parties[id].seats > 0);
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = ids[i];
      const b = ids[j];
      const cur = partyRelation(s, a, b);
      const base = baseRelation(s, a, b);
      shiftPartyRelation(s, a, b, (base - cur) * 0.08 + (s.government.coalition.includes(a) && s.government.coalition.includes(b) ? 1 : 0));
    }
  }
}

/** The player's party absorbs another party (joint list). */
export function mergeParties(s: GameState, otherId: string): void {
  const other = s.parties[otherId];
  const mine = s.parties[s.player.partyId];
  mine.seats += other.seats;
  other.seats = 0;
  mine.calibration += other.calibration * (other.pollShare / Math.max(1, mine.pollShare)) * 0.8;
  for (const [g, v] of Object.entries(other.affinity)) mine.affinity[g as keyof typeof mine.affinity] = (mine.affinity[g as keyof typeof mine.affinity] ?? 0) + (v ?? 0) * 0.5;
  // the joint list interleaves: the other party's leader takes slot 2, the rest follow behind
  const otherMembers = other.memberIds.map((id) => s.politicians[id]).filter(Boolean);
  for (const p of otherMembers) {
    p.partyId = mine.id;
    p.listRank = p.id === other.leaderId ? 2 : (p.listRank ?? 30) * 2 + 1;
    mine.memberIds.push(p.id);
  }
  for (const id of mine.memberIds) { const p = s.politicians[id]; if (p && p.id !== mine.leaderId && p.partyId === mine.id && !otherMembers.includes(p) && (p.listRank ?? 0) >= 2) p.listRank = (p.listRank ?? 30) * 2; }
  other.memberIds = [];
  other.calibration = 0.0001;
  s.government.coalition = s.government.coalition.filter((id) => id !== otherId);
  remember(s, other.leaderId, 'deal', 'ריצה משותפת', 10);
  addNews(s, `${mine.name} ו${other.name} מתאחדות לרשימה משותפת`, 'good', '🔗');
  logEvent(s, '🔗', `איחוד עם ${other.name}`, 3, 'good', 'party');
  s.career.memorable.push(`איחד את ${other.name} עם המפלגה`);
}
