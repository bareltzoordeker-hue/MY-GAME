// ============================================================
// advanceTurn — one turn = exactly two months.
// Fixed order: time → budget cycle → projects → economy → services →
// population → crises → politics → parliament → polls → elections →
// career → game over → news/briefing.
// ============================================================
import { N } from './ai/narrative';
import { MAJORITY } from '../data/world';
import { chance } from './rng';
import type { Briefing, GameState } from '../types/game';
import { clamp, clone, debtPct, deficitPct } from '../utils';
import { newFiscalYear, processBudgetDeadline, simulateAIGovernment } from './aiGovernment';
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

  // 1. time
  s.turn += 1;
  s.date.month += 2;
  if (s.date.month > 12) { s.date.month -= 12; s.date.year += 1; }

  // 2. decisions mature: expired inbox items resolve by default
  expireInbox(s);

  // budget cycle
  if (s.date.month === 1) newFiscalYear(s);
  processBudgetDeadline(s);

  // 3-5. projects, economy, services, needs
  simulateProjects(s);
  growNeeds(s);
  simulateEconomy(s);
  simulateServices(s);

  // 6. public opinion
  simulatePopulation(s);

  // crises (Event Engine)
  tickCrises(s);
  generateCrises(s);

  // 7-8. characters react; rare AI initiatives
  simulateCharacters(s);
  generateInitiatives(s);
  simulateAlliances(s);
  simulateGovernment(s);
  simulateAIGovernment(s);
  if (isPM(s)) {
    fillVacancies(s, false);
    if (coalitionSeats(s) < MAJORITY && s.government.lowMajorityTurns >= 2) callEarlyElections(s, 'הקואליציה איבדה את הרוב');
  }
  simulateParliament(s);
  checkPromises(s);

  // polls
  simulatePolls(s);
  pollNews(s, before);

  // elections
  if (s.turn >= s.elections.scheduledTurn) {
    runElection(s);
  } else if (s.elections.scheduledTurn - s.turn <= 4) {
    // AI parties campaign too
    for (const p of Object.values(s.parties)) {
      if (p.isPlayerParty) continue;
      s.elections.campaignBoost[p.id] = (s.elections.campaignBoost[p.id] ?? 0) + (chance(s, 0.5) ? 1 : 0.3);
    }
  }

  // career, game over
  if (!s.gameOver) {
    syncRole(s);
    updateCareer(s);
    if (s.flags.expel && s.parties[s.player.partyId].leaderId !== s.player.politicianId) {
      setGameOver(s, 'expelled', 'המנהיג הוציא אותך מהמפלגה');
    }
    evaluateGameOver(s);
  }

  for (const h of N.satireHeadlines(s)) addNews(s, h, 'satire', '🤡');
  generateDrama(s);
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
  if (!lines.length) lines.push({ icon: '☕', text: 'חודשיים שקטים. חשוד.', tone: 'neutral' });
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
