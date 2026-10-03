import { LAW_BY_ID } from '../data/laws';
import { DIFFICULTIES } from '../data/world';
import { gauss } from './rng';
import type { BudgetCategory, GameState } from '../types/game';
import { clamp, deficitPct, debtPct, lerp, sum } from '../utils';

const DT = 1 / 6; // two months as a fraction of a year

export function revenueFactor(s: GameState): number {
  const t = s.economy.taxes;
  let f = (t.incomeTax / 100) * 0.52 + (t.vat / 100) * 0.52 + (t.corporateTax / 100) * 0.13 + 0.03;
  for (const id of s.activeLaws) f += LAW_BY_ID[id]?.revenueFactor ?? 0;
  return f;
}

export function computeRevenue(s: GameState): number {
  const e = s.economy;
  const t = e.taxes;
  const burden = t.incomeTax + t.vat * 0.8 + t.corporateTax * 0.3;
  const compliance = burden > 46 ? 1 - (burden - 46) * 0.012 : 1; // Laffer-ish
  const unempAdj = 1 - (e.unemployment - 4) * 0.008;
  return e.gdp * revenueFactor(s) * compliance * unempAdj + e.otherRevenue;
}

export function computeSpending(s: GameState): number {
  return sum(Object.values(s.budget.allocations)) + s.budget.debtInterest + s.budget.projectSpending;
}

/** Recompute derived fiscal numbers without advancing time. Call after every change. */
export function refreshFiscals(s: GameState): void {
  s.budget.projectSpending = sum(
    s.projects.filter((p) => p.status === 'active').map((p) => (p.totalCost / p.durationTurns) * 6),
  );
  s.economy.revenue = computeRevenue(s);
  s.economy.spending = computeSpending(s);
  s.economy.deficit = s.economy.spending - s.economy.revenue;
  s.economy.creditRating = creditRating(s);
}

export function creditRating(s: GameState): string {
  const score = 100 - debtPct(s) * 0.45 - Math.max(0, deficitPct(s)) * 4 + s.economy.growth * 2;
  if (score >= 82) return 'AAA';
  if (score >= 74) return 'AA+';
  if (score >= 66) return 'AA';
  if (score >= 58) return 'AA-';
  if (score >= 50) return 'A+';
  if (score >= 42) return 'A';
  if (score >= 34) return 'BBB';
  return 'BB (זבל)';
}

const ratio = (s: GameState, c: BudgetCategory) => s.budget.allocations[c] / Math.max(0.1, s.budget.needs[c]);

/** Target annual real growth, explained term by term (used for tooltips too). */
export function growthDrivers(s: GameState): { label: string; value: number }[] {
  const e = s.economy;
  const d = DIFFICULTIES[s.difficulty];
  const t = e.taxes;
  const invest = (ratio(s, 'infrastructure') + ratio(s, 'transport') + ratio(s, 'science') + ratio(s, 'education')) / 4 - 1;
  const servicesAvg = sum(Object.values(s.services).map((x) => x.quality)) / 9;
  const def = deficitPct(s);
  return [
    { label: 'צמיחה בסיסית', value: 3 + d.economyBias * 0.5 },
    { label: 'השקעות ציבוריות', value: clamp(invest * 3, -1.5, 1.5) },
    { label: 'נטל המס', value: -0.08 * (t.incomeTax - 20) - 0.06 * (t.corporateTax - 23) - 0.05 * (t.vat - 17) },
    { label: 'גירעון גבוה', value: def > 5 ? -(def - 5) * 0.3 : 0 },
    { label: 'גירוי פיסקלי', value: clamp((def - 3) * 0.08, -0.3, 0.3) },
    { label: 'אינפלציה', value: e.inflation > 4 ? -(e.inflation - 4) * 0.3 : 0 },
    { label: 'ריבית', value: -(e.interestRate - 4) * 0.12 },
    { label: 'שירותים ציבוריים', value: (servicesAvg - 55) * 0.03 },
    { label: 'יציבות שלטונית', value: (s.government.stability - 50) * 0.01 },
    { label: 'זעזועים ומשברים', value: e.shocks.growth + e.structural.growth },
  ];
}

export function simulateEconomy(s: GameState): void {
  const e = s.economy;
  const d = DIFFICULTIES[s.difficulty];

  // --- growth ---
  const target = sum(growthDrivers(s).map((x) => x.value)) + gauss(s) * 0.35 * d.volatility;
  e.growth = clamp(lerp(e.growth, target, 0.5), -8, 9);

  // --- unemployment ---
  const uTarget = 4.2 - (e.growth - 3) * 0.6 + e.shocks.unemployment + e.structural.unemployment;
  e.unemployment = clamp(lerp(e.unemployment, uTarget, 0.3), 2, 25);

  // --- inflation ---
  const def = deficitPct(s);
  const iTarget = 2.5 + Math.max(0, def - 3) * 0.35 + (e.growth - 3) * 0.2 - (e.interestRate - 4) * 0.3 + e.shocks.inflation + e.structural.inflation;
  e.inflation = clamp(lerp(e.inflation, iTarget, 0.35) + gauss(s) * 0.1 * d.volatility, -2, 30);

  // --- central bank (independent!) ---
  const rTarget = clamp(1.5 + 1.3 * (e.inflation - 2), 0.1, 15);
  e.interestRate = clamp(e.interestRate + clamp(rTarget - e.interestRate, -0.5, 0.5), 0.1, 15);
  const riskPremium = Math.max(0, debtPct(s) - 75) * 0.04 + (e.creditRating.startsWith('B') ? 1 : 0);
  e.effectiveDebtRate = lerp(e.effectiveDebtRate, e.interestRate * 0.6 + 1.2 + riskPremium, 0.08);

  // --- nominal GDP, income ---
  e.gdp *= Math.pow(1 + e.growth / 100, DT) * Math.pow(1 + e.inflation / 100, DT);
  e.avgIncome *= Math.pow(1 + (e.growth * 0.6 + e.inflation) / 100, DT) * (1 - Math.max(0, e.unemployment - 6) * 0.0008);

  // --- debt ---
  s.budget.debtInterest = (e.debt * e.effectiveDebtRate) / 100;
  refreshFiscals(s);
  e.debt = Math.max(0, e.debt + e.deficit * DT);

  // --- decay temporary shocks / one-off revenue ---
  e.shocks.growth *= 0.5;
  e.shocks.inflation *= 0.5;
  e.shocks.unemployment *= 0.6;
  e.otherRevenue *= 0.7;
  refreshFiscals(s);
}
