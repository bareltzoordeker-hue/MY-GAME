// Alliances with other parties: Knesseton coordination ("votes") or a full political bloc ("bloc").
import { CATEGORY_BY_ID } from '../data/world';
import { rand } from './rng';
import type { Alliance, BudgetCategory, GameState, Reaction } from '../types/game';
import { clamp, clone } from '../utils';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { ideologyDistance } from './parliament';
import { isPartyLeader } from './roles';
import { BUDGET_PREF } from './elections';
import { shiftPartyRelation } from './relations';

export const COST = { votes: 8, bloc: 14 } as const;

export const allianceWith = (s: GameState, partyId: string) => s.alliances.find((a) => a.partyId === partyId);

export function allianceChance(s: GameState, partyId: string, kind: Alliance['kind']): number {
  const p = s.parties[partyId];
  const mine = s.parties[s.player.partyId];
  const leader = s.politicians[p.leaderId];
  const dist = ideologyDistance(p.ideology, mine.ideology);
  return clamp(0.35 + ((leader?.loyalty ?? 50) - 50) / 90 + (0.7 - dist) * 0.6 + (mine.pollShare - p.pollShare) / 120 - (kind === 'bloc' ? 0.15 : 0), 0.02, 0.9);
}

export function allianceDemand(s: GameState, partyId: string): { category: BudgetCategory; amount: number; label: string } {
  const p = s.parties[partyId];
  const category = BUDGET_PREF[partyId] ?? 'welfare';
  const amount = clamp(Math.round(p.seats / 6 + 0.5), 1, 4);
  return { category, amount, label: `+₪${amount}B ל${CATEGORY_BY_ID[category].name}` };
}

export function proposeAlliance(s0: GameState, partyId: string, kind: Alliance['kind']): { state: GameState; reaction: Reaction } {
  const fail = (title: string): { state: GameState; reaction: Reaction } => ({ state: s0, reaction: { title, status: 'rejected', stats: [], groups: [], people: [] } });
  if (!isPartyLeader(s0)) return fail('רק מנהיג מפלגה יכול לכרות בריתות');
  if (allianceWith(s0, partyId)) return fail('כבר יש ברית');
  if (s0.player.politicalCapital < COST[kind]) return fail('אין מספיק הון פוליטי');
  const s = clone(s0);
  s.player.politicalCapital -= COST[kind];
  const p = s.parties[partyId];
  const leader = s.politicians[p.leaderId];
  const pr = allianceChance(s, partyId, kind);
  if (rand(s) >= pr) {
    if (leader) leader.loyalty = clamp(leader.loyalty - 4);
    return { state: s, reaction: { title: `${p.name} דחתה את הברית`, subtitle: `סיכוי היה ${Math.round(pr * 100)}%`, status: 'rejected', stats: [], groups: [], people: leader ? [{ icon: p.logo, label: leader.name, text: 'אנחנו מעדיפים לחכות לסקר הבא.', tone: 'neutral' }] : [], quip: 'בפוליטיקה "לא" זה בדרך כלל "עוד לא".' } };
  }
  const d = allianceDemand(s, partyId);
  // the price of an alliance: if the player controls the budget it's paid now, otherwise it's a promise
  if (s.government.pmId === s.player.politicianId) applyEffects(s, { budget: { [d.category]: d.amount } });
  else if (leader) remember(s, leader.id, 'promise', d.label, 0, s.turn + 24);
  s.alliances.push({ partyId, kind, strength: 60, since: s.turn, demand: d.label });
  if (leader) remember(s, leader.id, 'deal', kind === 'bloc' ? 'גוש פוליטי משותף' : 'ברית הצבעה', 12);
  shiftPartyRelation(s, s.player.partyId, partyId, kind === 'bloc' ? 18 : 10);
  applyEffects(s, { partyMomentum: { [s.player.partyId]: kind === 'bloc' ? 3 : 1, [partyId]: kind === 'bloc' ? 2 : 0 } });
  const title = kind === 'bloc' ? `גוש חדש: ${s.parties[s.player.partyId].shortName} + ${p.shortName}` : `ברית הצבעה עם ${p.name}`;
  addNews(s, `${title}. ${kind === 'bloc' ? 'שתי המפלגות ימליצו זו על זו אחרי הבחירות' : 'המפלגות יתאמו הצבעות בכנסטון'}`, 'neutral', '🤝');
  logEvent(s, '🤝', title, 3, 'good', 'alliance');
  s.career.memorable.push(title);
  return {
    state: s,
    reaction: {
      title, subtitle: `המחיר: ${d.label}`, status: 'approved',
      stats: [{ icon: '🪑', label: 'מנדטים בברית', value: `${p.seats}`, tone: 'good' }, { icon: '🎯', label: 'הון פוליטי', value: `-${COST[kind]}`, tone: 'neutral' }],
      groups: [], people: leader ? [{ icon: p.logo, label: leader.name, text: kind === 'bloc' ? 'נפעל יחד להרכבת הממשלה הבאה.' : 'נתאם איתך את ההצבעות בכנסטון.', tone: 'good' }] : [],
      quip: kind === 'bloc' ? 'אחרי הבחירות הם ימליצו עליך לנשיא, כל עוד היחסים יישמרו.' : 'בכנסטון הם יתמכו בחוקים שלך. שמור על היחסים.',
    },
  };
}

export function breakAlliance(s0: GameState, partyId: string): { state: GameState; reaction: Reaction } {
  const s = clone(s0);
  const a = allianceWith(s, partyId);
  if (!a) return { state: s0, reaction: { title: 'אין ברית', status: 'info', stats: [], groups: [], people: [] } };
  dissolve(s, a, 'פירקת את הברית');
  remember(s, s.parties[partyId].leaderId, 'betrayal', 'פירק את הברית', -25);
  shiftPartyRelation(s, s.player.partyId, partyId, -25);
  return { state: s, reaction: { title: `הברית עם ${s.parties[partyId].name} פורקה`, status: 'info', stats: [], groups: [], people: [], quip: 'פירוק הברית פגע קשות ביחסים עם המפלגה.' } };
}

function dissolve(s: GameState, a: Alliance, why: string): void {
  s.alliances = s.alliances.filter((x) => x !== a);
  const p = s.parties[a.partyId];
  addNews(s, `קץ הברית: ${p.name} – "${why}"`, 'bad', '💔');
  logEvent(s, '💔', `הברית עם ${p.name} התפרקה: ${why}`, 3, 'bad', 'alliance');
}

/** Each turn: alliances live or die by how the partner's leader feels about you. */
export function simulateAlliances(s: GameState): void {
  if (!isPartyLeader(s)) { for (const a of [...s.alliances]) dissolve(s, a, 'כבר לא מנהיג המפלגה'); return; }
  for (const a of [...s.alliances]) {
    const p = s.parties[a.partyId];
    const leader = s.politicians[p?.leaderId];
    if (!p || !leader || p.seats <= 0) { dissolve(s, a, 'המפלגה כבר לא בכנסטון'); continue; }
    a.strength = clamp(a.strength + (leader.loyalty - 50) / 10 - 1.5);
    if (a.strength < 12) dissolve(s, a, 'היחסים התקררו לגמרי');
    else if (a.strength < 30 && (s.flags[`ally_warn_${a.partyId}`] ?? 0) <= s.turn) {
      s.flags[`ally_warn_${a.partyId}`] = s.turn + 8;
      addNews(s, `${leader.name} רומז: "הברית לא מובנת מאליה"`, 'bad', '⚠️');
    }
  }
}

/** Betrayal hook: when the player hurts an ally's favourite law. */
export function allyHurt(s: GameState, lawId: string): void {
  for (const a of s.alliances) if (s.parties[a.partyId]?.favoriteLaws.includes(lawId)) a.strength = clamp(a.strength - 30);
}
