import { LAW_BY_ID } from '../data/laws';
import { CATEGORY_BY_ID, DIFFICULTIES, MAJORITY, TERM_TURNS } from '../data/world';
import { addDays, addMonths, daysBetween, dayNumber, electionDate, turnsUntilElection } from './calendar';
import { rand } from './rng';
import type { BudgetCategory, Demand, GameState, Party, PartyOffer, Reaction } from '../types/game';
import { clamp } from '../utils';
import { setGameOver, setRole, syncRole } from './career';
import { addNews, logEvent, remember } from './effects';
import { assignMinister, fillVacancies, getMinistry } from './government';
import { ideologyDistance, proposeBill } from './parliament';
import { computeShares, seatsFromShares } from './polls';

/** The budget line each party asks for in coalition talks. */
export const BUDGET_PREF: Record<string, BudgetCategory> = {
  likud: 'defense', yashar: 'education', together: 'education', democrats: 'welfare', shas: 'welfare', utj: 'education',
  otzma: 'police', rzp: 'housing', yb: 'defense', joint: 'welfare', raam: 'government', bluewhite: 'defense',
  reservists: 'defense', amcha: 'defense', noam: 'education', israel_first: 'science',
};

export function callEarlyElections(s: GameState, reason: string): void {
  // the Knesseton dissolves; by law the election is held about 90 days later
  if (s.elections.date && daysBetween(s.date, s.elections.date) <= 90) return;
  s.elections.date = addDays(s.date, 90);
  s.elections.scheduledTurn = s.turn + turnsUntilElection(s);
  s.flags.early_election = 1;
  s.government.caretaker = true;
  addNews(s, `הכנסטון התפזר: ${reason}. הבחירות ייערכו בעוד כשלושה חודשים`, 'bad', '🗳️');
  logEvent(s, '🗳️', `בחירות מוקדמות: ${reason}`, 3, 'bad', 'election');
  s.career.memorable.push(`הממשלה נפלה: ${reason}`);
}

function recommendations(s: GameState, seats: Record<string, number>): { formateurId: string; ranking: { leaderId: string; seats: number }[] } {
  const parties = Object.values(s.parties).filter((p) => seats[p.id] > 0).sort((a, b) => seats[b.id] - seats[a.id]);
  const cands = parties.slice(0, 2);
  const mine = s.parties[s.player.partyId];
  if (mine.leaderId === s.player.politicianId && seats[mine.id] > 0 && !cands.includes(mine) && parties.indexOf(mine) <= 2) cands.push(mine);
  const tally: Record<string, number> = Object.fromEntries(cands.map((c) => [c.id, 0]));
  for (const p of parties) {
    let best = cands[0];
    let bestD = 99;
    const pLeader = s.politicians[p.leaderId];
    for (const c of cands) {
      // ideology first, then size, then how this party's leader feels about the player-candidate
      const attitude = c.leaderId === s.player.politicianId && pLeader && !pLeader.isPlayer ? clamp((pLeader.loyalty - 50) / 250, -0.1, 0.1) : 0;
      const noise = c.id === p.id ? 0 : (rand(s) - 0.5) * 0.14 * DIFFICULTIES[s.difficulty].volatility;
      const pmParty = s.politicians[s.government.pmId]?.partyId;
      const incumbency = c.id === pmParty && s.government.coalition.includes(p.id) ? 0.04 : 0;
      const pledged = c.leaderId === s.player.politicianId && (s.alliances.some((a) => a.partyId === p.id && a.kind === 'bloc') || (s.flags[`endorse_${p.id}`] ?? -1) >= s.turn);
      const d = c.id === p.id ? -1 : pledged ? -0.5 : ideologyDistance(p.ideology, c.ideology) - seats[c.id] / 400 - attitude - incumbency + noise;
      if (d < bestD) { bestD = d; best = c; }
    }
    tally[best.id] += seats[p.id];
  }
  const ranking = cands.map((c) => ({ leaderId: c.leaderId, seats: tally[c.id] })).sort((a, b) => b.seats - a.seats);
  return { formateurId: ranking[0].leaderId, ranking };
}

export function runElection(s: GameState): void {
  const early = !!s.flags.early_election;
  s.flags.early_election = 0;
  const vol = 0.04 * DIFFICULTIES[s.difficulty].volatility;
  const shares = computeShares(s, vol);
  const seats = seatsFromShares(shares);
  const roleBefore = s.player.role;
  const me = s.politicians[s.player.politicianId];
  const myParty = s.parties[s.player.partyId];
  const seatsBefore = myParty.seats;

  for (const p of Object.values(s.parties)) {
    p.seats = seats[p.id];
    p.pollShare = shares[p.id];
    p.momentum *= 0.3;
  }
  s.elections.campaignBoost = {};
  s.elections.count += 1;
  // next regular election: four years from this one
  s.elections.date = addMonths(electionDate(s), 48);
  s.elections.scheduledTurn = s.turn + TERM_TURNS;
  // the new Knesseton: the top N of every list, in list order
  for (const party of Object.values(s.parties)) {
    const ranked = party.memberIds.map((id) => s.politicians[id]).filter((p) => p && p.active && (p.listRank ?? 0) > 0).sort((a, b) => (a.listRank ?? 99) - (b.listRank ?? 99));
    ranked.forEach((p, i) => { p.inKnesset = i < seats[party.id]; });
    for (const id of party.memberIds) { const p = s.politicians[id]; if (p && !(p.listRank ?? 0)) p.inKnesset = false; }
  }
  const { formateurId } = recommendations(s, seats);
  s.elections.last = { turn: s.turn, shares, seats, formateurId, early };
  s.polls.push({ turn: s.turn, shares, seats, govApproval: s.government.approval, playerApproval: me.popularity });

  addNews(s, `תוצאות הבחירות: ${myParty.name} – ${seats[myParty.id]} מנדטים`, seats[myParty.id] >= seatsBefore ? 'good' : 'bad', '🗳️');
  logEvent(s, '🗳️', `בחירות: ${myParty.name} קיבלה ${seats[myParty.id]} מנדטים (לפני: ${seatsBefore})`, 3, seats[myParty.id] >= seatsBefore ? 'good' : 'bad', 'election');
  s.career.memorable.push(`בחירות ${s.date.year}: ${myParty.name} – ${seats[myParty.id]} מנדטים`);

  // ---- did the player make it into the Knesseton? ----
  if (seats[myParty.id] === 0) {
    s.career.electionsLost += 1;
    setGameOver(s, roleBefore === 'pm' || roleBefore === 'candidate' ? 'lost_election' : 'not_elected', `${myParty.name} לא עברה את אחוז החסימה`);
    return;
  }
  if (myParty.leaderId !== me.id) {
    const rank = playerListRank(s);
    s.player.listRank = rank;
    if (rank > seats[myParty.id]) {
      setGameOver(s, 'not_elected', `נשארת במקום ${rank} ברשימה – מחוץ לכנסטון`);
      return;
    }
  }

  if (formateurId === me.id) {
    startNegotiation(s);
    logEvent(s, '🤝', 'קיבלת את המנדט להרכבת הממשלה', 3, 'good', 'election');
    return;
  }
  if (roleBefore === 'pm' || roleBefore === 'candidate') {
    s.career.electionsLost += 1;
    const winner = s.politicians[formateurId];
    setGameOver(s, 'lost_election', `הפסדת בבחירות ל${winner?.name ?? 'יריב'}`);
    return;
  }
  aiFormGovernment(s, formateurId);
}

/** Player's place on the list (the real slot; primaries and deals can move it). */
export function playerListRank(s: GameState): number {
  const party = s.parties[s.player.partyId];
  const me = s.politicians[s.player.politicianId];
  if (party.leaderId === me.id) return 1;
  return Math.max(1, me.listRank ?? s.player.listRank ?? 99);
}

export function aiFormGovernment(s: GameState, formateurId: string): void {
  const fParty = s.parties[s.politicians[formateurId].partyId];
  const others = Object.values(s.parties).filter((p) => p.id !== fParty.id && p.seats > 0)
    .sort((a, b) => ideologyDistance(fParty.ideology, a.ideology) - ideologyDistance(fParty.ideology, b.ideology));
  const coalition: Party[] = [fParty];
  let total = fParty.seats;
  for (const p of others) {
    if (total >= MAJORITY + 2) break;
    if (ideologyDistance(fParty.ideology, p.ideology) < 0.75) { coalition.push(p); total += p.seats; }
  }
  for (const p of others) {
    if (total >= MAJORITY) break;
    if (!coalition.includes(p)) { coalition.push(p); total += p.seats; }
  }
  installGovernment(s, formateurId, coalition.map((p) => p.id), {});
  const pm = s.politicians[formateurId];
  addNews(s, `${pm.name} הרכיב ממשלה עם ${coalition.length - 1} שותפות (${total} מנדטים)`, 'neutral', '🏛️');
  syncRole(s);
}

/** Reset ministries and appoint a new government. agreements: ministryId -> partyId */
export function installGovernment(s: GameState, pmId: string, coalition: string[], agreements: Record<string, string>): void {
  const g = s.government;
  const pmParty = s.politicians[pmId].partyId;
  g.pmId = pmId;
  g.coalition = coalition;
  g.formedTurn = s.turn;
  g.formedDay = dayNumber(s.date);
  g.caretaker = false;
  g.stability = 62;
  g.lowMajorityTurns = 0;
  for (const p of Object.values(s.politicians)) p.ministryId = null;
  for (const m of g.ministries) { m.ministerId = null; m.agreementPartyId = agreements[m.id] ?? undefined; }
  // partners without explicit agreements get their preferred ministries (≈1 per 5 seats)
  for (const pid of coalition) {
    if (pid === pmParty || Object.values(agreements).includes(pid)) continue;
    const party = s.parties[pid];
    let n = Math.max(1, Math.round(party.seats / 5));
    const key = (id: string) => id === 'finance' || id === 'defense';
    const prefs = party.preferredMinistries.filter((id) => getMinistry(s, id) && (!key(id) || party.seats >= 8));
    const rest = g.ministries.filter((m) => !key(m.id)).map((m) => m.id);
    for (const mid of [...prefs, ...rest]) {
      if (n <= 0) break;
      const m = getMinistry(s, mid);
      if (m && !m.agreementPartyId) { m.agreementPartyId = pid; n--; }
    }
  }
  for (const m of g.ministries) if (!m.agreementPartyId) m.agreementPartyId = pmParty;

  // the player, if in coalition and not PM, may get a portfolio
  const me = s.politicians[s.player.politicianId];
  if (pmId !== me.id && coalition.includes(me.partyId)) {
    const leader = s.parties[me.partyId].leaderId === me.id;
    const partyMins = g.ministries.filter((m) => m.agreementPartyId === me.partyId);
    const leaderLoyalty = leader ? 100 : s.politicians[s.parties[me.partyId].leaderId]?.loyalty ?? 50;
    const score = me.power + s.player.reputation * 0.4 + leaderLoyalty * 0.3 + (s.player.role === 'minister' ? 15 : 0);
    if (partyMins.length && (leader || rand(s) < clamp((score - 55) / 50, 0.05, 0.9))) {
      const best = [...partyMins].sort((a, b) => (me.expertise[b.domain] ?? 20) - (me.expertise[a.domain] ?? 20))[0];
      assignMinister(s, best.id, me.id);
    }
  }
  fillVacancies(s, true);
  for (const p of Object.values(s.politicians)) {
    if (p.ministryId) p.power = clamp(p.power + 8);
  }
}

// ---------------- Player-led coalition negotiation ----------------
function demandsFor(s: GameState, party: Party): Demand[] {
  const out: Demand[] = [];
  const mins = party.preferredMinistries.map((id) => getMinistry(s, id)).filter((m) => !!m);
  if (mins[0]) out.push({ kind: 'ministry', ministryId: mins[0]!.id, label: mins[0]!.name });
  if (party.seats >= 9 && mins[1]) out.push({ kind: 'ministry', ministryId: mins[1]!.id, label: mins[1]!.name });
  const cat = BUDGET_PREF[party.id] ?? 'welfare';
  const amount = clamp(Math.round(party.seats / 4 + 1), 1, 5);
  out.push({ kind: 'budget', category: cat, amount, label: `+₪${amount}B ל${CATEGORY_BY_ID[cat].name}` });
  const law = party.favoriteLaws.find((l) => !s.activeLaws.includes(l));
  if (law) out.push({ kind: 'law', lawId: law, label: LAW_BY_ID[law].title });
  return out;
}

export function startNegotiation(s: GameState): void {
  const mine = s.parties[s.player.partyId];
  const offers: Record<string, PartyOffer> = {};
  for (const p of Object.values(s.parties)) {
    if (p.id === mine.id || p.seats <= 0) continue;
    const leader = s.politicians[p.leaderId];
    const dist = ideologyDistance(mine.ideology, p.ideology);
    const willingness = clamp(0.88 - dist * 0.6 + ((leader?.loyalty ?? 50) - 50) / 120 + (p.seats < 8 ? 0.05 : 0), 0, 1);
    offers[p.id] = { partyId: p.id, demands: demandsFor(s, p), patience: willingness > 0.6 ? 3 : 2, status: 'pending', willingness };
  }
  s.elections.phase = 'negotiation';
  s.elections.negotiation = { formateurId: s.player.politicianId, offers, attempt: 1 };
}

function conflictPenalty(s: GameState, partyId: string): number {
  const n = s.elections.negotiation!;
  const party = s.parties[partyId];
  let pen = 0;
  for (const o of Object.values(n.offers)) {
    if (o.status !== 'accepted') continue;
    const other = s.parties[o.partyId];
    const otherLaws = o.demands.filter((d) => d.kind === 'law').map((d) => d.lawId!);
    const myLaws = n.offers[partyId].demands.filter((d) => d.kind === 'law').map((d) => d.lawId!);
    if (otherLaws.some((l) => party.hatedLaws.includes(l)) || myLaws.some((l) => other.hatedLaws.includes(l))) pen += 0.35;
    const otherMins = o.demands.filter((d) => d.kind === 'ministry').map((d) => d.ministryId);
    if (n.offers[partyId].demands.some((d) => d.kind === 'ministry' && otherMins.includes(d.ministryId))) pen += 0.2;
  }
  return pen;
}

export function negotiate(s: GameState, partyId: string, action: 'accept' | 'counter' | 'refuse', dropIndex = -1): Reaction {
  const n = s.elections.negotiation;
  const offer = n?.offers[partyId];
  const party = s.parties[partyId];
  if (!n || !offer || offer.status !== 'pending') return { title: 'אין מה לשאת ולתת', status: 'info', stats: [], groups: [], people: [] };
  const conflict = conflictPenalty(s, partyId);
  if (action === 'refuse') {
    offer.status = 'refused';
    return { title: `${party.name} מחוץ לממשלה`, status: 'info', stats: [], groups: [], people: [], quip: `${s.politicians[party.leaderId]?.name}: "נתראה באופוזיציה."` };
  }
  let p = action === 'accept' ? offer.willingness + 0.35 - conflict : offer.willingness + 0.15 - conflict - 0.2 * (offer.demands.length <= 2 ? 1.5 : 1);
  if (action === 'counter' && dropIndex >= 0) {
    const d = offer.demands[dropIndex];
    if (d?.kind === 'ministry') p -= 0.1;
  }
  if (rand(s) < clamp(p, 0.02, 0.97)) {
    if (action === 'counter' && dropIndex >= 0) offer.demands.splice(dropIndex, 1);
    offer.status = 'accepted';
    return { title: `${party.name} מצטרפת!`, status: 'approved', stats: [{ icon: '🪑', label: 'מנדטים', value: `+${party.seats}`, tone: 'good' }], groups: [], people: [], quip: conflict > 0 ? 'שימו לב: יש חיכוך עם שותפה אחרת.' : undefined };
  }
  offer.patience -= 1;
  if (offer.patience <= 0) {
    offer.status = 'refused';
    return { title: `${party.name} עזבה את השולחן`, status: 'rejected', stats: [], groups: [], people: [], quip: conflict > 0 ? 'הם לא מוכנים לשבת עם השותפות שכבר בחרת.' : 'נגמרה להם הסבלנות.' };
  }
  return { title: `${party.name} לא מתרשמת`, status: 'rejected', stats: [{ icon: '⏳', label: 'סבלנות', value: `${offer.patience}`, tone: 'neutral' }], groups: [], people: [], quip: 'אפשר לנסות שוב, אבל הסבלנות נגמרת.' };
}

export function negotiationSeats(s: GameState): number {
  const n = s.elections.negotiation;
  if (!n) return 0;
  return s.parties[s.player.partyId].seats + Object.values(n.offers).filter((o) => o.status === 'accepted').reduce((a, o) => a + s.parties[o.partyId].seats, 0);
}

export function finalizeCoalition(s: GameState): Reaction {
  const n = s.elections.negotiation;
  if (!n) return { title: 'אין משא ומתן פעיל', status: 'info', stats: [], groups: [], people: [] };
  const seats = negotiationSeats(s);
  if (seats < MAJORITY) return { title: `רק ${seats} מנדטים – צריך ${MAJORITY}`, status: 'rejected', stats: [], groups: [], people: [] };
  const accepted = Object.values(n.offers).filter((o) => o.status === 'accepted');
  const agreements: Record<string, string> = {};
  for (const o of accepted) for (const d of o.demands) if (d.kind === 'ministry' && d.ministryId && !agreements[d.ministryId]) agreements[d.ministryId] = o.partyId;
  installGovernment(s, s.player.politicianId, [s.player.partyId, ...accepted.map((o) => o.partyId)], agreements);
  for (const o of accepted) {
    const leaderId = s.parties[o.partyId].leaderId;
    for (const d of o.demands) {
      if (d.kind === 'budget' && d.category && d.amount) s.budget.allocations[d.category] += d.amount;
      if (d.kind === 'law' && d.lawId) {
        proposeBill(s, d.lawId, s.player.politicianId, true);
        remember(s, leaderId, 'promise', `להעביר את ${LAW_BY_ID[d.lawId].title}`, 0, s.turn + 12, d.lawId);
      }
    }
    remember(s, leaderId, 'deal', 'הסכם קואליציוני', 10);
  }
  s.elections.phase = 'none';
  s.elections.negotiation = null;
  s.career.governmentsFormed += 1;
  s.career.electionsWon += 1;
  setRole(s, 'pm', `הרכיב ממשלה עם ${seats} מנדטים`);
  addNews(s, `${s.politicians[s.player.politicianId].name} הרכיב ממשלה: ${seats} מנדטים`, 'good', '🏛️');
  return { title: 'הממשלה הושבעה!', subtitle: `${seats} מנדטים, ${accepted.length} שותפות`, status: 'approved', stats: [{ icon: '🪑', label: 'קואליציה', value: `${seats}`, tone: 'good' }], groups: [], people: [], quip: 'עכשיו רק צריך לקיים את כל ההבטחות. בהצלחה.' };
}

export function abandonMandate(s: GameState): void {
  const role = s.player.role;
  s.elections.phase = 'none';
  s.elections.negotiation = null;
  if (role === 'pm' || role === 'candidate') {
    setGameOver(s, 'coalition_failed', 'נכשלת בהרכבת ממשלה');
    return;
  }
  // a non-PM leader returns the mandate: the next largest party tries
  const next = Object.values(s.parties).filter((p) => p.id !== s.player.partyId && p.seats > 0).sort((a, b) => b.seats - a.seats)[0];
  aiFormGovernment(s, next.leaderId);
}
