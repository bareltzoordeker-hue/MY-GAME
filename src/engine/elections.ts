import { LAW_BY_ID } from '../data/laws';
import { CATEGORY_BY_ID, DIFFICULTIES, MAJORITY, TERM_TURNS } from '../data/world';
import { addDays, addMonths, daysBetween, dayNumber, electionDate, turnsUntilElection } from './calendar';
import { rand } from './rng';
import type { BudgetCategory, CoalitionOffer, Demand, GameState, Party, PartyOffer, Reaction } from '../types/game';
import { SWEETENER_VALUE, demandsFor, writeAgreement } from './coalitionDeals';
import { partyRelation } from './relations';
import { clamp, newId } from '../utils';
import { setGameOver, setRole, syncRole } from './career';
import { addNews, applyEffects, logEvent, remember } from './effects';
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
      const bloc = p.bloc && p.bloc === s.parties[c.id].bloc ? 0.35 : 0;
      const d = c.id === p.id ? -1 : pledged ? -0.5 : ideologyDistance(p.ideology, c.ideology) - seats[c.id] / 400 - attitude - incumbency - bloc + noise;
      if (d < bestD) { bestD = d; best = c; }
    }
    // Arab parties recommend a candidate only when relations allow it; otherwise they recommend no one
    if (p.bloc === 'arab' && best.id !== p.id && partyRelation(s, p.id, best.id) < 15) continue;
    tally[best.id] += seats[p.id];
  }
  const ranking = cands.map((c) => ({ leaderId: c.leaderId, seats: tally[c.id] })).sort((a, b) => b.seats - a.seats);
  // the mandate follows the seats: the largest party gets it unless the other candidate has a clearly bigger recommendation count
  const largest = parties[0];
  const top = ranking[0];
  const own = ranking.find((r) => r.leaderId === largest.leaderId);
  if (own && top.leaderId !== own.leaderId && top.seats - own.seats < 10) {
    ranking.splice(ranking.indexOf(own), 1);
    ranking.unshift(own);
  }
  return { formateurId: ranking[0].leaderId, ranking };
}

/** A surplus-vote agreement: the two lists share their remainders when seats are allocated (Bader-Ofer). */
export function applySurplus(shares: Record<string, number>, seats: Record<string, number>, a: string, b?: string): Record<string, number> {
  if (!b || !seats[a] || !seats[b]) return seats;
  const joint = `${a}+${b}`;
  const merged: Record<string, number> = { ...shares, [joint]: shares[a] + shares[b] };
  delete merged[a];
  delete merged[b];
  const ms = seatsFromShares(merged);
  const split: Record<string, number> = { [a]: 0, [b]: 0 };
  for (let i = 0; i < ms[joint]; i++) {
    const next = shares[a] / (split[a] + 1) >= shares[b] / (split[b] + 1) ? a : b;
    split[next] += 1;
  }
  delete ms[joint];
  return { ...ms, ...split };
}

export function runElection(s: GameState): void {
  const early = !!s.flags.early_election;
  s.flags.early_election = 0;
  const vol = 0.04 * DIFFICULTIES[s.difficulty].volatility;
  const shares = computeShares(s, vol);
  const seats = applySurplus(shares, seatsFromShares(shares), s.player.partyId, s.elections.surplusWith);
  s.elections.surplusWith = undefined;
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
  const { formateurId, ranking } = recommendations(s, seats);
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
  formationRounds(s, ranking.map((r) => r.leaderId), roleBefore);
}

/** The President hands the mandate down the ranking; whoever can reach 61 forms the government. */
function formationRounds(s: GameState, order: string[], roleBefore: string): void {
  const me = s.politicians[s.player.politicianId];
  // the player leads a party that is not the formateur's: let the player look at the offers before anything is decided
  if (!s.flags.excludeMe) {
    const offers = buildOffers(s, order);
    if (offers.length) {
      s.elections.phase = 'offers';
      s.elections.offers = offers;
      s.elections.offerCtx = { order, roleBefore };
      addNews(s, `${offers.length} הצעות להצטרף לממשלה הגיעו ל${s.parties[me.partyId].name}`, 'good', '📨');
      logEvent(s, '📨', 'הצעות להצטרף לממשלה', 3, 'good', 'election');
      return;
    }
  }
  for (const fid of order) {
    if (fid === me.id) {
      startNegotiation(s);
      addNews(s, `המנדט עבר אליך אחרי שהמועמד הקודם לא הצליח להרכיב ממשלה`, 'good', '🤝');
      logEvent(s, '🤝', 'המנדט להרכבת הממשלה עבר אליך', 3, 'good', 'election');
      return;
    }
    if (aiFormGovernment(s, fid)) {
      if (roleBefore === 'pm' || roleBefore === 'candidate') {
        s.career.electionsLost += 1;
        logEvent(s, '🏛️', `${s.politicians[fid]?.name} הרכיב את הממשלה. המפלגה שלך באופוזיציה`, 3, 'bad', 'election');
      }
      return;
    }
    addNews(s, `${s.politicians[fid]?.name} החזיר את המנדט: אין רוב לממשלה`, 'bad', '↩️');
  }
  // nobody can reach 61: the caretaker government stays and the country goes back to the polls
  s.elections.date = addDays(s.date, 90);
  s.elections.scheduledTurn = s.turn + turnsUntilElection(s);
  s.government.caretaker = true;
  s.flags.formFails = (s.flags.formFails ?? 0) + 1;
  addNews(s, 'אף מועמד לא הצליח להרכיב ממשלה. הבחירות יחזרו בעוד כ-90 יום', 'bad', '🗳️');
  logEvent(s, '🗳️', 'לא הורכבה ממשלה – בחירות חוזרות', 3, 'bad', 'election');
}

/** Player's place on the list (the real slot; primaries and deals can move it). */
export function playerListRank(s: GameState): number {
  const party = s.parties[s.player.partyId];
  const me = s.politicians[s.player.politicianId];
  if (party.leaderId === me.id) return 1;
  return Math.max(1, me.listRank ?? s.player.listRank ?? 99);
}

/** Can these two parties sit in one government? (red lines against the other's core laws) */
function compatible(a: Party, b: Party): boolean {
  const clash = (x: Party, y: Party) => (x.redLines ?? []).some((l) => y.favoriteLaws.slice(0, 2).includes(l));
  return !clash(a, b) && !clash(b, a);
}

/** The government a formateur could build: compatible parties, nearest first. include: a party that must be in it. */
function planCoalition(s: GameState, formateurId: string, opts: { include?: string; exclude?: string } = {}): { parties: Party[]; total: number } | null {
  const fParty = s.parties[s.politicians[formateurId].partyId];
  // every failed formation makes the next try more flexible: after repeated elections the parties compromise
  const relax = s.flags.formFails ?? 0;
  const inc = opts.include ? s.parties[opts.include] : undefined;
  let candidates = Object.values(s.parties)
    .filter((p) => p.id !== fParty.id && p.seats > 0 && compatible(fParty, p) && p.id !== opts.exclude && p.id !== inc?.id)
    // Arab parties: Ra'am may join a centre-left government (or any government after repeated failures); the Joint List gives outside support at most
    .filter((p) => p.id !== 'joint' && (p.bloc !== 'arab' || relax >= 2 || (fParty.bloc === 'opp' && partyRelation(s, p.id, fParty.id) >= 0)))
    .filter((p) => relax >= 1 || ideologyDistance(fParty.ideology, p.ideology) < 0.95 || p.bloc === fParty.bloc)
    .sort((a, b) => (a.bloc === fParty.bloc ? 0 : 1) - (b.bloc === fParty.bloc ? 0 : 1) || ideologyDistance(fParty.ideology, a.ideology) - ideologyDistance(fParty.ideology, b.ideology));
  const coalition: Party[] = [fParty];
  let total = fParty.seats;
  if (inc) {
    if (!compatible(fParty, inc)) return null;
    coalition.push(inc);
    total += inc.seats;
    candidates = candidates.filter((p) => compatible(inc, p));
  }
  for (const p of candidates) {
    if (total >= MAJORITY + 2) break;
    // relaxed rounds: partners only have to get along with the formateur, not with each other
    if (relax >= 1 ? true : coalition.every((c) => compatible(c, p))) { coalition.push(p); total += p.seats; }
  }
  return total >= MAJORITY ? { parties: coalition, total } : null;
}

/** An AI formateur builds a coalition from compatible parties. Returns false if it cannot reach 61. */
export function aiFormGovernment(s: GameState, formateurId: string): boolean {
  const me = s.politicians[s.player.politicianId];
  const plan = planCoalition(s, formateurId, { exclude: s.flags.excludeMe ? me.partyId : undefined });
  if (!plan) return false;
  const { parties: coalition, total } = plan;
  s.flags.formFails = 0;
  installGovernment(s, formateurId, coalition.map((p) => p.id), {});
  const pm = s.politicians[formateurId];
  addNews(s, `${pm.name} הרכיב ממשלה עם ${coalition.length - 1} שותפות (${total} מנדטים)`, 'neutral', '🏛️');
  syncRole(s);
  // the player leads a party that was invited: join, demand a senior portfolio, or stay out
  if (s.parties[me.partyId]?.leaderId === me.id && coalition.some((p) => p.id === me.partyId) && formateurId !== me.id) {
    const mine = s.government.ministries.filter((m) => m.agreementPartyId === me.partyId).map((m) => m.name);
    s.inbox.push({
      id: newId(s, 'in'), kind: 'coalition_invite', title: `${pm.name} מזמין אותך לממשלה`, fromId: pm.id, createdTurn: s.turn, expiresTurn: s.turn + 1,
      text: `ראש הממשלה המיועד מציע ל${s.parties[me.partyId].name} להצטרף לקואליציה${mine.length ? ` עם ${mine.join(', ')}` : ''}. אפשר להסכים, לדרוש תיק בכיר (אוצר, ביטחון או חוץ) בסיכון שהממשלה תקום בלעדיך, או להישאר באופוזיציה.`,
      options: [{ id: 'accept', label: 'להצטרף' }, { id: 'demand', label: 'לדרוש תיק בכיר' }, { id: 'refuse', label: 'להישאר באופוזיציה' }], defaultOptionId: 'accept', payload: {},
    });
  }
  return true;
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
const MANDATE_DAYS = 28;
const EXTENSION_DAYS = 14;

export function startNegotiation(s: GameState): void {
  const mine = s.parties[s.player.partyId];
  const offers: Record<string, PartyOffer> = {};
  for (const p of Object.values(s.parties)) {
    if (p.id === mine.id || p.seats <= 0) continue;
    const leader = s.politicians[p.leaderId];
    const dist = ideologyDistance(mine.ideology, p.ideology);
    const willingness = clamp(0.88 - dist * 0.6 + ((leader?.loyalty ?? 50) - 50) / 120 + (p.seats < 8 ? 0.05 : 0), 0, 1);
    offers[p.id] = { partyId: p.id, demands: demandsFor(s, p, mine.seats), patience: willingness > 0.6 ? 3 : 2, status: 'pending', willingness };
  }
  s.elections.phase = 'negotiation';
  s.elections.negotiation = { formateurId: s.player.politicianId, offers, attempt: 1, daysLeft: MANDATE_DAYS, extended: false };
}

export interface CoalitionConflict { partyId: string; reason: string; weight: number }

/** Who in the coalition-to-be this party will not sit with, and why. Shown before the player tries, and used in the odds. */
export function coalitionConflicts(s: GameState, partyId: string): CoalitionConflict[] {
  const n = s.elections.negotiation;
  if (!n) return [];
  const party = s.parties[partyId];
  const mine = n.offers[partyId]?.demands ?? [];
  const out: CoalitionConflict[] = [];
  const law = (id: string) => LAW_BY_ID[id]?.title ?? 'חוק';
  const min = (id?: string) => s.government.ministries.find((m) => m.id === id)?.name ?? 'אותו תיק';
  const addMe = (c: CoalitionConflict) => out.push(c);
  const accepted = Object.values(n.offers).filter((o) => o.status === 'accepted' && o.partyId !== partyId);
  // the player's own party counts as a partner too
  const others = [...accepted.map((o) => ({ party: s.parties[o.partyId], demands: o.demands })), { party: s.parties[s.player.partyId], demands: [] as typeof mine }];
  for (const { party: other, demands } of others) {
    if (!other || other.id === partyId) continue;
    const otherLaws = demands.filter((d) => d.kind === 'law').map((d) => d.lawId!);
    const myLaws = mine.filter((d) => d.kind === 'law').map((d) => d.lawId!);
    const otherVetoes = demands.filter((d) => d.kind === 'veto').map((d) => d.lawId!);
    const hates = (p: Party, l: string) => p.hatedLaws.includes(l) || !!p.redLines?.includes(l);
    for (const l of otherLaws) if (hates(party, l)) addMe({ partyId: other.id, weight: 0.35, reason: `${party.shortName} מתנגדת ל"${law(l)}" ש${other.shortName} דורשת` });
    for (const l of myLaws) if (hates(other, l) || otherVetoes.includes(l)) addMe({ partyId: other.id, weight: 0.35, reason: `${other.shortName} מתנגדת ל"${law(l)}" ש${party.shortName} דורשת` });
    const otherMins = demands.filter((d) => d.kind === 'ministry').map((d) => d.ministryId);
    for (const d of mine) if (d.kind === 'ministry' && otherMins.includes(d.ministryId)) addMe({ partyId: other.id, weight: 0.2, reason: `גם ${other.shortName} דורשת את ${min(d.ministryId)}` });
    if (demands.some((d) => d.kind === 'rotation') && mine.some((d) => d.kind === 'rotation')) addMe({ partyId: other.id, weight: 0.5, reason: `גם ${other.shortName} דורשת רוטציה על ראשות הממשלה` });
    if (!compatible(party, other)) addMe({ partyId: other.id, weight: 0.4, reason: `קו אדום מול ${other.shortName}: מה ש${other.shortName} רוצה נוגד עיקרון של ${party.shortName}` });
  }
  return out;
}

function conflictPenalty(s: GameState, partyId: string): number {
  return coalitionConflicts(s, partyId).reduce((a, c) => a + c.weight, 0);
}

/** Each step of the talks takes days off the mandate. The President grants one 14-day extension. */
function spendDays(s: GameState, days: number): string | undefined {
  const n = s.elections.negotiation!;
  n.daysLeft = (n.daysLeft ?? MANDATE_DAYS) - days;
  if (n.daysLeft > 0) return undefined;
  if (!n.extended) {
    n.extended = true;
    n.daysLeft += EXTENSION_DAYS;
    addNews(s, 'הנשיא העניק הארכה של 14 יום להרכבת הממשלה', 'neutral', '⏳');
    return 'הנשיא העניק הארכה אחרונה של 14 יום.';
  }
  return 'expired';
}

export function negotiate(s: GameState, partyId: string, action: 'accept' | 'counter' | 'refuse' | 'sweeten', dropIndex = -1, sweetener?: Demand): Reaction {
  const n = s.elections.negotiation;
  const offer = n?.offers[partyId];
  const party = s.parties[partyId];
  if (!n || !offer || offer.status !== 'pending') return { title: 'אין מה לשאת ולתת', status: 'info', stats: [], groups: [], people: [] };
  const conflict = conflictPenalty(s, partyId);
  const leaderName = s.politicians[party.leaderId]?.name ?? party.name;
  if (action === 'refuse') {
    offer.status = 'refused';
    return { title: `${party.name} מחוץ לממשלה`, status: 'info', stats: [], groups: [], people: [], quip: `${leaderName}: "נהיה באופוזיציה."` };
  }
  if (action === 'sweeten' && sweetener) {
    offer.demands.push({ ...sweetener, sweetener: true });
    offer.willingness = clamp(offer.willingness + (SWEETENER_VALUE[sweetener.kind] ?? 0.05), 0, 1);
    const note = spendDays(s, 1);
    if (note === 'expired') return expireMandate(s);
    return {
      title: `הצעה ל${party.name}: ${sweetener.label}`, subtitle: `נכונות ${(offer.willingness * 100).toFixed(0)}%`, status: 'info',
      stats: [{ icon: '⏳', label: 'ימים למנדט', value: `${n.daysLeft}`, tone: 'neutral' }], groups: [], people: [],
      quip: note ?? (sweetener.kind === 'cash' ? 'העברת כספים מחוץ לתקציב עלולה להיות עבירה פלילית. אם היא תיחשף, הנזק יהיה כבד.' : undefined),
    };
  }
  let p = action === 'accept' ? offer.willingness + 0.35 - conflict : offer.willingness + 0.15 - conflict - 0.2 * (offer.demands.length <= 2 ? 1.5 : 1);
  if (action === 'counter' && dropIndex >= 0) {
    const d = offer.demands[dropIndex];
    if (d?.kind === 'ministry') p -= 0.1;
    if (d?.kind === 'veto' || d?.kind === 'rotation') p -= 0.15;
  }
  const note = spendDays(s, 3);
  if (note === 'expired') return expireMandate(s);
  if (rand(s) < clamp(p, 0.02, 0.97)) {
    if (action === 'counter' && dropIndex >= 0) offer.demands.splice(dropIndex, 1);
    offer.status = 'accepted';
    return {
      title: `${party.name} מצטרפת לקואליציה`, status: 'approved',
      stats: [{ icon: '🪑', label: 'מנדטים', value: `+${party.seats}`, tone: 'good' }, { icon: '⏳', label: 'ימים למנדט', value: `${n.daysLeft}`, tone: 'neutral' }],
      groups: [], people: [], quip: note ?? (conflict > 0 ? 'שימו לב: יש חיכוך עם שותפה אחרת.' : undefined),
    };
  }
  offer.patience -= 1;
  if (offer.patience <= 0) {
    offer.status = 'refused';
    return { title: `${party.name} עזבה את השולחן`, status: 'rejected', stats: [], groups: [], people: [], quip: conflict > 0 ? `הם לא מוכנים לשבת עם השותפות שכבר הסכמת איתן: ${coalitionConflicts(s, partyId).slice(0, 2).map((c) => c.reason).join('; ')}.` : 'הסבלנות שלהם נגמרה.' };
  }
  return {
    title: `${party.name} לא השתכנעה`, status: 'rejected',
    stats: [{ icon: '⏳', label: 'סבלנות', value: `${offer.patience}`, tone: 'neutral' }, { icon: '📅', label: 'ימים למנדט', value: `${n.daysLeft}`, tone: 'neutral' }],
    groups: [], people: [], quip: note ?? 'אפשר לנסות שוב, להוסיף הצעה או לוותר על דרישה.',
  };
}

function expireMandate(s: GameState): Reaction {
  addNews(s, 'תם המנדט: הממשלה לא הורכבה בזמן', 'bad', '⌛');
  abandonMandate(s);
  return { title: 'תם הזמן להרכבת הממשלה', subtitle: '28 ימים והארכה של 14 – והממשלה לא הורכבה', status: 'rejected', stats: [], groups: [], people: [] };
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
  writeAgreement(s, accepted);
  for (const o of accepted) {
    const leaderId = s.parties[o.partyId].leaderId;
    for (const d of o.demands) {
      if (d.kind === 'law' && d.lawId) {
        proposeBill(s, d.lawId, s.player.politicianId, true);
        remember(s, leaderId, 'promise', `להעביר את ${LAW_BY_ID[d.lawId].title}`, 0, s.turn + 12, d.lawId);
      }
    }
  }
  s.elections.phase = 'none';
  s.elections.negotiation = null;
  s.career.governmentsFormed += 1;
  s.career.electionsWon += 1;
  setRole(s, 'pm', `הרכיב ממשלה עם ${seats} מנדטים`);
  addNews(s, `${s.politicians[s.player.politicianId].name} הרכיב ממשלה: ${seats} מנדטים`, 'good', '🏛️');
  const pending = (s.government.agreements ?? []).filter((c) => c.status === 'pending' && !c.secret).length;
  return {
    title: 'הממשלה הושבעה', subtitle: `${seats} מנדטים, ${accepted.length} שותפות`, status: 'approved',
    stats: [{ icon: '🪑', label: 'קואליציה', value: `${seats}`, tone: 'good' }, { icon: '📜', label: 'התחייבויות פתוחות', value: `${pending}`, tone: 'neutral' }],
    groups: [], people: [], quip: 'ההסכם הקואליציוני נחתם. את ההתחייבויות והמועדים אפשר לראות במסך הממשלה.',
  };
}

export function abandonMandate(s: GameState): void {
  const role = s.player.role;
  s.elections.phase = 'none';
  s.elections.negotiation = null;
  addNews(s, `${s.politicians[s.player.politicianId].name} החזיר את המנדט להרכבת הממשלה`, 'bad', '↩️');
  // the President turns to the next candidates (biggest parties first)
  const order = Object.values(s.parties).filter((p) => p.id !== s.player.partyId && p.seats > 0).sort((a, b) => b.seats - a.seats).slice(0, 2).map((p) => p.leaderId);
  formationRounds(s, order, role);
}

// ---------------- Offers to the player's party after the election ----------------
/** When the player leads a party that is not the formateur's: the formateurs who could govern with it, and on what terms. */
function buildOffers(s: GameState, order: string[]): CoalitionOffer[] {
  const me = s.politicians[s.player.politicianId];
  const myParty = s.parties[me.partyId];
  if (!myParty || myParty.leaderId !== me.id || myParty.seats <= 0) return [];
  const out: CoalitionOffer[] = [];
  for (const fid of order) {
    if (fid === me.id) break;
    if (out.length >= 3) break;
    const f = s.politicians[fid];
    if (!f || f.partyId === myParty.id) continue;
    const plan = planCoalition(s, fid, { include: myParty.id });
    if (!plan) continue;
    const fp = s.parties[f.partyId];
    const partners = plan.parties.filter((p) => p.id !== myParty.id && p.id !== fp.id);
    const terms = demandsFor(s, myParty, fp.seats).filter((d) => ['ministry', 'deputy', 'committee', 'budget', 'law'].includes(d.kind));
    const others = plan.parties.filter((p) => p.id !== myParty.id);
    const asks: string[] = [];
    for (const p of others) {
      for (const l of p.redLines ?? []) if (myParty.favoriteLaws.includes(l) && LAW_BY_ID[l] && !s.activeLaws.includes(l)) asks.push(`לא לקדם את ${LAW_BY_ID[l].title} (קו אדום של ${p.shortName})`);
    }
    asks.push('לתמוך בתקציב ובחוקי היסוד של הממשלה', 'להצביע עם הקואליציה בהצבעות אמון');
    out.push({ id: newId(s, 'off'), formateurId: fid, partnerIds: partners.map((p) => p.id), seats: plan.total, terms, asks: [...new Set(asks)], tries: 0 });
  }
  return out;
}

/** What the player may ask to add to an offer (each one can be refused). */
export function offerExtras(s: GameState, offer: CoalitionOffer): Demand[] {
  const myParty = s.parties[s.politicians[s.player.politicianId].partyId];
  const taken = new Set(offer.terms.filter((d) => d.kind === 'ministry').map((d) => d.ministryId));
  const out: Demand[] = [];
  if (myParty.seats >= 8) for (const id of ['finance', 'defense', 'foreign']) { const m = getMinistry(s, id); if (m && !taken.has(id)) out.push({ kind: 'ministry', ministryId: id, label: `תיק בכיר: ${m.name}`, sweetener: true }); }
  const free = s.government.ministries.filter((m) => !taken.has(m.id) && !['finance', 'defense', 'foreign'].includes(m.id));
  const extra = free.find((m) => myParty.preferredMinistries.includes(m.id)) ?? free[0];
  if (extra) out.push({ kind: 'ministry', ministryId: extra.id, label: `תיק נוסף: ${extra.name}`, sweetener: true });
  const cat = BUDGET_PREF[myParty.id] ?? 'welfare';
  out.push({ kind: 'budget', category: cat, amount: 1, label: `+₪1B נוסף ל${CATEGORY_BY_ID[cat].name}`, sweetener: true });
  if (!offer.terms.some((d) => d.kind === 'committee')) out.push({ kind: 'committee', committee: 'ועדת הכספים', label: 'ראשות ועדת הכספים', sweetener: true });
  if (!offer.terms.some((d) => d.kind === 'deputy')) out.push({ kind: 'deputy', label: 'סגן שר נוסף', sweetener: true });
  return out;
}

/** The chance that the formateur accepts this extra request. */
export function extraChance(s: GameState, offer: CoalitionOffer, d: Demand): number {
  const myParty = s.parties[s.politicians[s.player.politicianId].partyId];
  const need = MAJORITY - (offer.seats - myParty.seats); // the seats the formateur is short by without us
  const key = d.kind === 'ministry' && ['finance', 'defense', 'foreign'].includes(d.ministryId ?? '');
  return clamp(0.5 + (myParty.seats - 8) / 50 + clamp(need / 30, 0, 0.3) - (key ? 0.3 : d.kind === 'ministry' ? 0.1 : 0) - offer.tries * 0.1, 0.08, 0.85);
}

export function answerCoalitionOffer(s: GameState, offerId: string, action: 'accept' | 'decline' | 'ask', extraIndex = -1): Reaction {
  const note = (title: string, status: Reaction['status'], quip: string): Reaction => ({ title, status, stats: [], groups: [], people: [], quip });
  const offers = s.elections.offers ?? [];
  const offer = offers.find((o) => o.id === offerId);
  const ctx = s.elections.offerCtx;
  if (s.elections.phase !== 'offers' || !offer || !ctx) return note('אין הצעה פעילה', 'info', '');
  const me = s.politicians[s.player.politicianId];
  const myParty = s.parties[me.partyId];
  const f = s.politicians[offer.formateurId];
  if (action === 'ask') {
    const d = offerExtras(s, offer)[extraIndex];
    if (!d || offer.tries >= 3) return note('אי אפשר לבקש עוד', 'info', 'פנית כבר שלוש פעמים. ההצעה על השולחן.');
    const p = extraChance(s, offer, d);
    offer.tries += 1;
    if (rand(s) < p) { offer.terms.push(d); return note('הבקשה התקבלה', 'approved', `${f.name} הסכים: ${d.label}.`); }
    return note('הבקשה נדחתה', 'rejected', `${f.name} לא מוכן: ${d.label}. ההצעה המקורית עדיין על השולחן.`);
  }
  if (action === 'decline') {
    s.elections.offers = offers.filter((o) => o.id !== offerId);
    if (s.elections.offers.length > 0) return note('דחית את ההצעה', 'info', 'אפשר עדיין לבחור באחת ההצעות האחרות.');
    s.elections.phase = 'none';
    s.elections.offers = undefined;
    s.elections.offerCtx = undefined;
    s.flags.excludeMe = 1;
    formationRounds(s, ctx.order, ctx.roleBefore);
    s.flags.excludeMe = 0;
    return note('דחית את כל ההצעות', 'info', 'המפלגה שלך נשארת מחוץ לממשלה, אלא אם יימצא רוב בלעדיה.');
  }
  // accept: the government is formed with the player's party in it
  const agreements: Record<string, string> = {};
  for (const d of offer.terms) if (d.kind === 'ministry' && d.ministryId && !agreements[d.ministryId]) agreements[d.ministryId] = myParty.id;
  installGovernment(s, f.id, [f.partyId, myParty.id, ...offer.partnerIds], agreements);
  for (const d of offer.terms) {
    if (d.kind === 'law' && d.lawId) proposeBill(s, d.lawId, f.id, true);
    else if (d.kind === 'budget' && d.category) applyEffects(s, { budget: { [d.category]: d.amount ?? 1 } });
    else if (d.kind === 'committee') applyEffects(s, { playerReputation: 2 });
    else if (d.kind === 'deputy') me.power = clamp(me.power + 3);
  }
  s.elections.phase = 'none';
  s.elections.offers = undefined;
  s.elections.offerCtx = undefined;
  if (ctx.roleBefore === 'pm' || ctx.roleBefore === 'candidate') s.career.electionsLost += 1;
  syncRole(s);
  addNews(s, `${me.name} הצטרף לממשלה של ${f.name}: ${offer.seats} מנדטים`, 'neutral', '🤝');
  logEvent(s, '🤝', `${myParty.name} הצטרפה לממשלה של ${f.name}`, 3, 'good', 'election');
  return note('הצטרפת לממשלה', 'approved', `${offer.seats} מנדטים בקואליציה. ההסכמות נכנסו לתוקף.`);
}
