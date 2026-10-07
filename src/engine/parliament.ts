import { LAW_BY_ID, type LawDef } from '../data/laws';
import { MAJORITY } from '../data/world';
import { pick } from './rng';
import type { Bill, GameState, GroupId, Ideology, Party, VoteResult } from '../types/game';
import { clamp, newId } from '../utils';
import { addNews, applyEffects, logEvent, scaleEffects } from './effects';
import { isPartyLeader } from './roles';

export function ideologyDistance(a: Ideology, b: Ideology): number {
  return Math.sqrt((a.economic - b.economic) ** 2 + (a.security - b.security) ** 2 + (a.religion - b.religion) ** 2) / 2;
}

/** Support of a party for a bill: -1.5..1.5 */
export function partyStance(s: GameState, party: Party, bill: Bill): number {
  const law = LAW_BY_ID[bill.lawId];
  if (!law) return 0;
  let v = 1 - ideologyDistance(law.ideology, party.ideology) * 1.3;
  if (party.favoriteLaws.includes(law.id)) v += 0.8;
  if (party.hatedLaws.includes(law.id)) v -= 1.2;
  let groupInterest = 0;
  for (const [g, aff] of Object.entries(party.affinity)) groupInterest += ((law.groups[g as GroupId] ?? 0) * (aff ?? 0)) / 40;
  v += clamp(groupInterest, -0.8, 0.8);
  const inGov = s.government.coalition.includes(party.id);
  const sponsor = s.politicians[bill.sponsorId];
  const sponsorInGov = sponsor ? s.government.coalition.includes(sponsor.partyId) : false;
  if (bill.isGovernment) v += inGov ? 0.65 : -0.45;
  else if (sponsorInGov) v += inGov ? 0.1 : -0.1;
  else v += inGov ? -0.55 : 0.15;
  if (sponsor && sponsor.partyId === party.id) v += 0.6;
  // allies coordinate with the player's bills
  if (sponsor?.isPlayer && s.alliances?.some((a) => a.partyId === party.id)) v += 0.7;
  v += bill.push / 100;
  if (bill.modified) v += 0.25;
  return clamp(v, -1.5, 1.5);
}

export function computeVote(s: GameState, bill: Bill): VoteResult {
  const res: VoteResult = { for: 0, against: 0, abstain: 0, passed: false, byParty: {} };
  for (const party of Object.values(s.parties)) {
    if (party.seats <= 0) continue;
    let stance = partyStance(s, party, bill);
    // a player who leads the party whips it behind their own bills
    if (party.id === s.player.partyId && isPartyLeader(s) && bill.sponsorId === s.player.politicianId) stance = 1;
    const defect = clamp((55 - party.cohesion) / 100, 0, 0.35);
    if (stance > 0.15) {
      const d = Math.round(party.seats * defect * (stance < 0.5 ? 1 : 0.4));
      res.for += party.seats - d;
      res.abstain += d;
      res.byParty[party.id] = d > 0 ? 'split' : 'for';
    } else if (stance < -0.15) {
      const d = Math.round(party.seats * defect * (stance > -0.5 ? 1 : 0.4));
      res.against += party.seats - d;
      res.abstain += d;
      res.byParty[party.id] = d > 0 ? 'split' : 'against';
    } else {
      res.abstain += party.seats;
      res.byParty[party.id] = 'abstain';
    }
  }
  res.passed = res.for > res.against && (bill.stage !== 'final' || res.for >= 40);
  return res;
}

export function proposeBill(s: GameState, lawId: string, sponsorId: string, isGovernment: boolean, modified = false): Bill | null {
  if (s.activeLaws.includes(lawId) || s.bills.some((b) => b.lawId === lawId && b.status === 'active')) return null;
  const law = LAW_BY_ID[lawId];
  const bill: Bill = {
    id: newId(s, 'bill'), lawId, title: law.title, sponsorId, isGovernment, stage: isGovernment ? 'committee' : 'preliminary',
    turnsInStage: 0, proposedTurn: s.turn, status: 'active', push: 0, modified,
  };
  s.bills.push(bill);
  if (sponsorId === s.player.politicianId) s.career.billsProposed += 1;
  return bill;
}

export function lawEffectsScale(bill: Bill) {
  return bill.modified ? 0.5 : 1;
}

export function enactLaw(s: GameState, law: LawDef, k = 1): void {
  if (s.activeLaws.includes(law.id)) return;
  s.activeLaws.push(law.id);
  for (const [g, v] of Object.entries(law.groups)) {
    const st = s.population.groups[g as GroupId];
    st.offset += (v ?? 0) * k * 0.7;
    st.mood += (v ?? 0) * k * 0.5;
  }
  if (law.budget) {
    s.budget.allocations[law.budget.category] += law.budget.amount * k;
  }
  if (law.structural) {
    s.economy.structural.growth += (law.structural.growth ?? 0) * k;
    s.economy.structural.inflation += (law.structural.inflation ?? 0) * k;
    s.economy.structural.unemployment += (law.structural.unemployment ?? 0) * k;
  }
  applyEffects(s, scaleEffects({ serviceBonus: law.serviceBonus, ...(law.onPass ?? {}) }, k));
}

/** Exact inverse of enactLaw (the law's effects are removed; the public reacts to the reversal). */
export function repealLaw(s: GameState, law: LawDef): void {
  if (!s.activeLaws.includes(law.id)) return;
  const bill = s.bills.find((b) => b.lawId === law.id && b.status === 'passed');
  const k = bill ? lawEffectsScale(bill) : 1;
  s.activeLaws = s.activeLaws.filter((x) => x !== law.id);
  for (const [g, v] of Object.entries(law.groups)) {
    const st = s.population.groups[g as GroupId];
    st.offset -= (v ?? 0) * k * 0.7;
    st.mood -= (v ?? 0) * k * 0.5;
  }
  if (law.budget) s.budget.allocations[law.budget.category] = Math.max(0, s.budget.allocations[law.budget.category] - law.budget.amount * k);
  if (law.structural) {
    s.economy.structural.growth -= (law.structural.growth ?? 0) * k;
    s.economy.structural.inflation -= (law.structural.inflation ?? 0) * k;
    s.economy.structural.unemployment -= (law.structural.unemployment ?? 0) * k;
  }
  applyEffects(s, scaleEffects({ serviceBonus: law.serviceBonus }, -k));
}

/** Advance all bills by one turn; votes happen here. */
export function simulateParliament(s: GameState): void {
  for (const bill of s.bills.filter((b) => b.status === 'active')) {
    bill.turnsInStage += 1;
    const law = LAW_BY_ID[bill.lawId];
    const sponsor = s.politicians[bill.sponsorId];
    const mine = bill.sponsorId === s.player.politicianId || (bill.isGovernment && s.government.pmId === s.player.politicianId);
    if (bill.stage === 'preliminary') {
      const v = computeVote(s, bill);
      bill.lastVote = v;
      if (v.passed) {
        bill.stage = 'committee';
        bill.turnsInStage = 0;
        logEvent(s, '🗳️', `"${law.title}" עבר בקריאה טרומית (${v.for}-${v.against})`, mine ? 2 : 1, 'neutral', 'bill');
      } else {
        bill.status = 'failed';
        logEvent(s, '❌', `"${law.title}" נפל בקריאה טרומית (${v.for}-${v.against})`, mine ? 2 : 1, mine ? 'bad' : 'neutral', 'bill');
        if (mine) addNews(s, `הכנסטון הפיל את "${law.title}" של ${sponsor?.name ?? 'הממשלה'}`, 'bad', '❌');
      }
    } else if (bill.stage === 'committee') {
      const needed = law.level === 'major' ? 2 : 1;
      if (bill.turnsInStage >= needed) { bill.stage = 'final'; bill.turnsInStage = 0; }
    } else if (bill.stage === 'final') {
      const v = computeVote(s, bill);
      bill.lastVote = v;
      if (v.passed) {
        bill.status = 'passed';
        enactLaw(s, law, lawEffectsScale(bill));
        if (mine) {
          s.career.lawsPassed += 1;
          s.player.reputation = clamp(s.player.reputation + (law.level === 'major' ? 6 : 3));
          const me = s.politicians[s.player.politicianId];
          me.power = clamp(me.power + 3);
          if (s.career.lawsPassed === 1) s.career.achievements.push(`החוק הראשון שלך: ${law.title}`);
        }
        logEvent(s, '📜', `"${law.title}" עבר בקריאה שלישית (${v.for}-${v.against})`, 2, 'good', 'law');
        addNews(s, pick(s, [`הכנסטון אישר את ${law.title}`, `${law.title} עבר בקריאה שלישית`, `סופית: ${law.title} בספר החוקים`]), 'good', law.icon);
        if (law.level === 'major') s.career.memorable.push(`${law.title} עבר (${v.for}-${v.against})`);
      } else {
        bill.status = 'failed';
        logEvent(s, '❌', `"${law.title}" נפל בקריאה שלישית (${v.for}-${v.against})`, 2, 'bad', 'law');
        addNews(s, `${law.title} נפל בהצבעה במליאה`, 'bad', '❌');
        if (mine) s.career.failures.push(`${law.title} נפל במליאה`);
      }
    }
  }
  if (s.bills.length > 40) s.bills = s.bills.filter((b) => b.status === 'active' || b.proposedTurn > s.turn - 18);
}

/** Annual budget vote. Returns whether it passed. */
export function voteBudget(s: GameState): VoteResult {
  const res: VoteResult = { for: 0, against: 0, abstain: 0, passed: false, byParty: {} };
  const pmIsPlayer = s.government.pmId === s.player.politicianId;
  for (const party of Object.values(s.parties)) {
    if (!party.seats) continue;
    const inGov = s.government.coalition.includes(party.id);
    const leader = s.politicians[party.leaderId];
    const mood = !leader ? 50 : pmIsPlayer ? leader.loyalty : 50 + (leader.relationships[s.government.pmId] ?? 0) * 0.4;
    const supports = inGov && (leader?.isPlayer || mood > 22 || s.government.stability > 45);
    if (supports) { res.for += party.seats; res.byParty[party.id] = 'for'; }
    else { res.against += party.seats; res.byParty[party.id] = 'against'; }
  }
  res.passed = res.for >= MAJORITY || res.for > res.against;
  return res;
}
