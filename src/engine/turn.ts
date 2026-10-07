// ============================================================
// advanceTurn — one turn = 4 months, or 2 weeks in the 4 months before an election.
// Continuous systems run in 2-month steps (a 4-month turn = 2 steps; campaign turns accumulate).
// Fixed order: time → budget cycle → projects → economy → services →
// population → crises → politics → parliament → polls → elections →
// career → game over → news/briefing.
// ============================================================
import { dayNumber, daysBetween, electionDate, inCampaign, nextTurnDate, stepsForDays, turnsUntilElection } from './calendar';
import { MAJORITY } from '../data/world';
import { chance } from './rng';
import type { Briefing, GameState } from '../types/game';
import { clamp, clone, debtPct, deficitPct } from '../utils';
import { newFiscalYear, processBudgetDeadline, simulateAIGovernment } from './aiGovernment';
import { processCommitments } from './coalitionDeals';
import { driftRelations } from './relations';
import { campaignTick } from './campaign';
import { worldTick } from './security';
import { evaluateGameOver, setGameOver, syncRole, updateCareer } from './career';
import { generateInitiatives, simulateCharacters } from './characters';
import { generateCrises, tickCrises } from './crises';
import { simulateEconomy } from './economy';
import { addNews, logEvent } from './effects';
import { callEarlyElections, runElection } from './elections';
import { fillVacancies, simulateGovernment } from './government';
import { pushHistory } from './history';
import { expireInbox } from './inbox';
import { simulateParliament } from './parliament';
import { coalitionSeats, simulatePolls } from './polls';
import { simulatePopulation } from './population';
import { simulateProjects } from './projects';
import { checkPromises } from './promises';
import { isPM } from './roles';
import { growNeeds, simulateServices } from './services';
import { generateDrama } from './drama';
import { simulateAlliances } from './alliances';

export function canAdvance(s: GameState): string | null {
  if (s.gameOver) return 'המשחק נגמר';
  if (s.elections.phase === 'negotiation') return 'קודם צריך להרכיב ממשלה (או להחזיר את המנדט)';
  if (s.drama) return `קודם צריך להחליט: ${s.drama.title}`;
  return null;
}

export function advanceTurn(s0: GameState): GameState {
  if (canAdvance(s0)) return s0;
  const s = clone(s0);
  const before = snapshot(s);
  s.turnLog = [];

  // 1. time (calendar)
  s.turn += 1;
  const prevDate = s.date;
  const campaignTurn = inCampaign(s);
  s.date = nextTurnDate(s);
  const days = daysBetween(prevDate, s.date);
  const steps = stepsForDays(days);

  // 2. decisions mature: expired inbox items resolve by default
  expireInbox(s);
  processCommitments(s);
  driftRelations(s);
  campaignTick(s);
  worldTick(s, days / 30.4);

  // budget cycle (new fiscal year when the calendar crosses into January)
  if (s.date.year > prevDate.year) newFiscalYear(s);
  if (!s.government.caretaker) processBudgetDeadline(s);

  // 3-8. continuous simulation in 2-month steps (campaign turns accumulate until a full step)
  s.flags.simAcc = (s.flags.simAcc ?? 0) + steps;
  while (s.flags.simAcc >= 1) {
    s.flags.simAcc -= 1;
    simulateProjects(s);
    growNeeds(s);
    simulateEconomy(s);
    simulateServices(s);
    simulatePopulation(s);
    tickCrises(s);
    simulateCharacters(s);
    simulateAlliances(s);
    simulateGovernment(s);
    if (!(s.government.caretaker && s.elections.phase === 'none')) simulateParliament(s); // a dissolved Knesseton does not legislate
  }

  // discrete events: once per turn, with chance scaled to the turn's length
  const events = Math.min(2, steps);
  if (events >= 1 || chance(s, events)) {
    generateCrises(s);
    generateInitiatives(s);
    if (!s.government.caretaker) simulateAIGovernment(s);
  }
  if (events >= 2) generateCrises(s);
  if (isPM(s) && !s.government.caretaker) {
    fillVacancies(s, false);
    if (coalitionSeats(s) < MAJORITY && s.government.lowMajorityTurns >= 2) callEarlyElections(s, 'הקואליציה איבדה את הרוב');
  }
  checkPromises(s);

  // polls every turn (campaign moves them)
  simulatePolls(s);
  pollNews(s, before);

  // elections (by date)
  if (dayNumber(s.date) >= dayNumber(electionDate(s)) && s.elections.phase === 'none') {
    runElection(s);
  } else if (campaignTurn || inCampaign(s)) {
    // AI parties campaign too
    for (const p of Object.values(s.parties)) {
      if (p.isPlayerParty) continue;
      s.elections.campaignBoost[p.id] = (s.elections.campaignBoost[p.id] ?? 0) + (chance(s, 0.5) ? 0.6 : 0.2);
    }
  }
  s.elections.scheduledTurn = s.turn + turnsUntilElection(s);

  // career, game over
  if (!s.gameOver) {
    syncRole(s);
    updateCareer(s, days / 30.4);
    if (s.flags.expel && s.parties[s.player.partyId].leaderId !== s.player.politicianId) {
      setGameOver(s, 'expelled', 'המנהיג הוציא אותך מהמפלגה');
    }
    evaluateGameOver(s);
  }

  if (events >= 1 || chance(s, events)) generateDrama(s);
  pushHistory(s);
  s.briefing = buildBriefing(s, before);
  validateState(s);
  return s;
}

interface Snap { approval: number; gdp: number; growth: number; unemployment: number; inflation: number; deficit: number; debt: number; pop: number; seats: number; capital: number }
function snapshot(s: GameState): Snap {
  const last = s.polls[s.polls.length - 1];
  return {
    approval: s.government.approval, gdp: s.economy.gdp, growth: s.economy.growth, unemployment: s.economy.unemployment,
    inflation: s.economy.inflation, deficit: deficitPct(s), debt: debtPct(s), pop: s.politicians[s.player.politicianId].popularity,
    seats: last?.seats[s.player.partyId] ?? 0, capital: s.player.politicalCapital,
  };
}

function pollNews(s: GameState, b: Snap): void {
  const seats = s.polls[s.polls.length - 1].seats[s.player.partyId];
  const diff = seats - b.seats;
  if (Math.abs(diff) >= 2) {
    addNews(s, `סקר: ${s.parties[s.player.partyId].name} ${diff > 0 ? 'מזנקת' : 'צונחת'} ל-${seats} מנדטים`, diff > 0 ? 'good' : 'bad', '📊');
    logEvent(s, '📊', `סקר: ${seats} מנדטים (${diff > 0 ? '+' : ''}${diff})`, 2, diff > 0 ? 'good' : 'bad', 'poll');
  }
  if (s.government.approval < b.approval - 3) addNews(s, 'סקר חדש: התמיכה בממשלה ירדה', 'bad', '📉');
}

function buildBriefing(s: GameState, b: Snap): Briefing {
  const lines = s.turnLog
    .slice()
    .sort((x, y) => y.importance - x.importance)
    .slice(0, 6)
    .map((e) => ({ icon: e.icon, text: e.text, tone: e.tone }));
  if (!lines.length) lines.push({ icon: '📋', text: 'תקופה שקטה יחסית. אין אירועים חריגים.', tone: 'neutral' });
  const now = snapshot(s);
  return {
    turn: s.turn,
    lines,
    changes: [
      { label: 'שביעות רצון', before: b.approval, after: now.approval, unit: '', goodWhenUp: true },
      { label: 'צמיחה', before: b.growth, after: now.growth, unit: '%', goodWhenUp: true },
      { label: 'אבטלה', before: b.unemployment, after: now.unemployment, unit: '%', goodWhenUp: false },
      { label: 'אינפלציה', before: b.inflation, after: now.inflation, unit: '%', goodWhenUp: false },
      { label: 'גירעון', before: b.deficit, after: now.deficit, unit: '%', goodWhenUp: false },
      { label: 'הפופולריות שלך', before: b.pop, after: now.pop, unit: '', goodWhenUp: true },
      { label: 'מנדטים בסקר', before: b.seats, after: now.seats, unit: '', goodWhenUp: true },
    ],
  };
}

/** Guard against NaN / runaway values so a bug can never brick a save. */
export function validateState(s: GameState): void {
  const fix = (v: number, lo: number, hi: number, fallback: number) => (Number.isFinite(v) ? clamp(v, lo, hi) : fallback);
  const e = s.economy;
  e.gdp = fix(e.gdp, 100, 1e6, 2000);
  e.debt = fix(e.debt, 0, 1e6, 1200);
  e.growth = fix(e.growth, -15, 15, 2);
  e.unemployment = fix(e.unemployment, 1, 40, 5);
  e.inflation = fix(e.inflation, -5, 50, 3);
  e.avgIncome = fix(e.avgIncome, 1000, 1e6, 12000);
  for (const k of Object.keys(s.budget.allocations) as (keyof typeof s.budget.allocations)[]) {
    s.budget.allocations[k] = fix(s.budget.allocations[k], 0, 1e5, 5);
    s.budget.needs[k] = fix(s.budget.needs[k], 0.5, 1e5, 5);
  }
  for (const g of Object.values(s.population.groups)) {
    g.satisfaction = fix(g.satisfaction, 0, 100, 50);
    g.structural = fix(g.structural, -50, 150, 50);
    g.mood = fix(g.mood, -45, 45, 0);
  }
  for (const svc of Object.values(s.services)) svc.quality = fix(svc.quality, 0, 100, 50);
  for (const p of Object.values(s.politicians)) {
    p.loyalty = fix(p.loyalty, 0, 100, 50);
    p.power = fix(p.power, 0, 100, 30);
    p.popularity = fix(p.popularity, 0, 100, 30);
  }
  s.government.approval = fix(s.government.approval, 0, 100, 40);
  s.player.politicalCapital = fix(s.player.politicalCapital, 0, 100, 30);
}
