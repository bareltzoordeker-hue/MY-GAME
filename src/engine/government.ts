import { MAJORITY } from '../data/world';
import { NEW_MINISTRY_TEMPLATES } from '../data/ministries';
import { chance } from './rng';
import type { GameState, Ministry, Politician } from '../types/game';
import { clamp, lerp, newId } from '../utils';
import { addNews, logEvent, remember } from './effects';
import { coalitionSeats } from './polls';

export const getMinistry = (s: GameState, id: string) => s.government.ministries.find((m) => m.id === id);
export const ministerOf = (s: GameState, m: Ministry): Politician | null => (m.ministerId ? s.politicians[m.ministerId] ?? null : null);

/** Candidates for a ministry: active politicians of coalition parties. */
export function ministerCandidates(s: GameState): Politician[] {
  return Object.values(s.politicians).filter((p) => p.active && s.government.coalition.includes(p.partyId) && p.id !== s.government.pmId);
}

export function assignMinister(s: GameState, ministryId: string, politicianId: string | null): void {
  const m = getMinistry(s, ministryId);
  if (!m) return;
  const prevId = m.ministerId;
  m.ministerId = politicianId;
  // a minister may hold several portfolios: ministryId is his main one, the others point at him through ministerId
  if (prevId && s.politicians[prevId] && s.politicians[prevId].ministryId === m.id) {
    s.politicians[prevId].ministryId = s.government.ministries.find((x) => x.ministerId === prevId)?.id ?? null;
  }
  if (politicianId && politicianId !== s.government.pmId) {
    const p = s.politicians[politicianId];
    if (!p.ministryId || !s.government.ministries.some((x) => x.id === p.ministryId && x.ministerId === p.id)) p.ministryId = m.id;
  }
}

/** Vacant portfolios are held by the PM until someone is appointed. */
export function fillVacancies(s: GameState, preferAI: boolean): void {
  for (const m of s.government.ministries) {
    if (m.ministerId && s.politicians[m.ministerId]?.active) continue;
    if (preferAI) {
      const party = m.agreementPartyId && s.government.coalition.includes(m.agreementPartyId) ? m.agreementPartyId : s.politicians[s.government.pmId]?.partyId;
      const cands = ministerCandidates(s).filter((p) => p.partyId === party && !p.ministryId && !p.isPlayer);
      cands.sort((a, b) => (b.expertise[m.domain] ?? 20) + b.power * 0.4 - ((a.expertise[m.domain] ?? 20) + a.power * 0.4));
      if (cands[0]) { assignMinister(s, m.id, cands[0].id); continue; }
    }
    m.ministerId = s.government.pmId;
  }
}

export function mergeMinistries(s: GameState, aId: string, bId: string): Ministry | null {
  const a = getMinistry(s, aId);
  const b = getMinistry(s, bId);
  if (!a || !b || a === b) return null;
  const merged: Ministry = {
    id: newId(s, 'min'), name: `משרד ה${a.name.replace(/^משרד ה?/, '').replace(/^המשרד ל/, '')} וה${b.name.replace(/^משרד ה?/, '').replace(/^המשרד ל/, '')}`,
    icon: a.icon, domain: a.domain, services: [...new Set([...a.services, ...b.services])], categories: [...new Set([...a.categories, ...b.categories])],
    ministerId: a.ministerId, efficiency: clamp((a.efficiency + b.efficiency) / 2 - 8), bureaucracy: clamp(Math.max(a.bureaucracy, b.bureaucracy) + 5),
    deep: a.deep || b.deep, custom: true, agreementPartyId: a.agreementPartyId,
    origins: [...(a.origins ?? [a.id]), ...(b.origins ?? [b.id])],
  };
  const loser = b.ministerId && b.ministerId !== a.ministerId ? s.politicians[b.ministerId] : null;
  if (loser) {
    loser.ministryId = null;
    remember(s, loser.id, 'fired', `המשרד שלו אוחד ונעלם`, -18);
  }
  if (a.ministerId && s.politicians[a.ministerId] && a.ministerId !== s.government.pmId) s.politicians[a.ministerId].ministryId = merged.id;
  s.government.ministries = s.government.ministries.filter((m) => m !== a && m !== b);
  s.government.ministries.push(merged);
  return merged;
}

export function createMinistry(s: GameState, templateId: string): Ministry | null {
  const t = NEW_MINISTRY_TEMPLATES.find((x) => x.id === templateId);
  if (!t || s.government.ministries.some((m) => m.name === t.name)) return null;
  const m: Ministry = {
    id: newId(s, 'min'), name: t.name, icon: t.icon, domain: t.domain, services: [], categories: [], ministerId: s.government.pmId,
    efficiency: 45, bureaucracy: 50, deep: false, custom: true, satire: t.satire, origins: [t.id],
  };
  s.government.ministries.push(m);
  s.budget.allocations.government += 0.3;
  return m;
}

export function removeMinistry(s: GameState, id: string): boolean {
  const m = getMinistry(s, id);
  if (!m || m.services.length || m.categories.length || m.id === 'finance') return false;
  if (m.ministerId && m.ministerId !== s.government.pmId) {
    const p = s.politicians[m.ministerId];
    if (p) { p.ministryId = null; remember(s, p.id, 'fired', `סגרו לו את ${m.name}`, -15); }
  }
  s.government.ministries = s.government.ministries.filter((x) => x !== m);
  s.budget.allocations.government = Math.max(5, s.budget.allocations.government - 0.25);
  return true;
}

/** Coalition partner leaves: its ministers are removed. */
export function partyLeavesCoalition(s: GameState, partyId: string, reason: string): void {
  if (!s.government.coalition.includes(partyId) || partyId === s.politicians[s.government.pmId]?.partyId) return;
  s.government.coalition = s.government.coalition.filter((x) => x !== partyId);
  for (const m of s.government.ministries) {
    const min = m.ministerId ? s.politicians[m.ministerId] : null;
    if (min && min.partyId === partyId) {
      min.ministryId = null;
      m.ministerId = null;
    }
  }
  s.government.stability = clamp(s.government.stability - 15);
  const party = s.parties[partyId];
  addNews(s, `${party.name} פורשת מהקואליציה: "${reason}"`, 'bad', '💥');
  logEvent(s, '💥', `${party.name} פרשה מהקואליציה`, 3, 'bad', 'coalition');
  fillVacancies(s, s.government.pmId !== s.player.politicianId);
}

export function simulateGovernment(s: GameState): void {
  const g = s.government;
  const seats = coalitionSeats(s);
  const pm = s.politicians[g.pmId];
  const partnersMood = g.coalition
    .filter((id) => id !== pm?.partyId)
    .map((id) => {
      const leader = s.politicians[s.parties[id].leaderId];
      if (!leader) return 50;
      return g.pmId === s.player.politicianId ? leader.loyalty : 50 + (leader.relationships[g.pmId] ?? 0) * 0.4;
    });
  const avgMood = partnersMood.length ? partnersMood.reduce((a, b) => a + b, 0) / partnersMood.length : 60;
  const target = clamp(50 + (seats - MAJORITY) * 2.2 + (avgMood - 50) * 0.4 + (g.approval - 45) * 0.3 - s.crises.length * 3);
  g.stability = clamp(lerp(g.stability, target, 0.15));

  g.lowMajorityTurns = seats < MAJORITY ? g.lowMajorityTurns + 1 : 0;
  g.lowApprovalTurns = g.approval < 18 ? g.lowApprovalTurns + 1 : 0;

  // partner walks out when angry and the government is wobbly
  for (const id of [...g.coalition]) {
    if (id === pm?.partyId) continue;
    const leader = s.politicians[s.parties[id].leaderId];
    if (!leader) continue;
    const mood = g.pmId === s.player.politicianId ? leader.loyalty : 50 + (leader.relationships[g.pmId] ?? 0) * 0.4;
    if (mood < 18 && g.stability < 35 && chance(s, 0.25)) {
      partyLeavesCoalition(s, id, 'לא נשב בממשלה שמזלזלת בנו');
      break;
    }
  }

  // ministry efficiency drifts with minister competence
  for (const m of g.ministries) {
    const min = ministerOf(s, m);
    const skill = min ? min.expertise[m.domain] ?? 20 : 30;
    m.efficiency = clamp(lerp(m.efficiency, 35 + skill * 0.35 - (m.bureaucracy - 50) * 0.2, 0.05));
  }
}
