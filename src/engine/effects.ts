import { OUTLETS } from '../data/world';
import { pick } from './rng';
import type { BudgetCategory, Effects, GameState, GroupId, NewsTone, RegionId, ServiceId, Taxes } from '../types/game';
import { clamp, newId } from '../utils';
import { refreshFiscals } from './economy';
import { computeApproval, recomputeGroupSatisfaction } from './population';

const TAX_LIMITS: Record<keyof Taxes, [number, number]> = { incomeTax: [5, 50], vat: [0, 30], corporateTax: [5, 45] };

export function scaleEffects(e: Effects, k: number): Effects {
  const m = <T extends string>(r?: Partial<Record<T, number>>) =>
    r ? (Object.fromEntries(Object.entries(r).map(([a, v]) => [a, (v as number) * k])) as Partial<Record<T, number>>) : undefined;
  return {
    budget: m<BudgetCategory>(e.budget), taxes: m<keyof Taxes>(e.taxes), groups: m<GroupId>(e.groups), services: m<ServiceId>(e.services),
    serviceBonus: m<ServiceId>(e.serviceBonus), regionInvestment: m<RegionId>(e.regionInvestment),
    economy: e.economy ? { growth: (e.economy.growth ?? 0) * k, inflation: (e.economy.inflation ?? 0) * k, unemployment: (e.economy.unemployment ?? 0) * k } : undefined,
    oneOffCost: e.oneOffCost !== undefined ? e.oneOffCost * k : undefined,
    revenue: e.revenue !== undefined ? e.revenue * k : undefined,
    playerCapital: e.playerCapital !== undefined ? e.playerCapital * k : undefined,
    playerPopularity: e.playerPopularity !== undefined ? e.playerPopularity * k : undefined,
    playerReputation: e.playerReputation !== undefined ? e.playerReputation * k : undefined,
    stability: e.stability !== undefined ? e.stability * k : undefined,
    partyMomentum: m<string>(e.partyMomentum) as Record<string, number> | undefined,
    loyalty: m<string>(e.loyalty) as Record<string, number> | undefined,
  };
}

/** The single entry point that mutates the (draft) state from an Effects bundle. */
export function applyEffects(s: GameState, e: Effects): void {
  if (e.budget) for (const [c, v] of Object.entries(e.budget)) {
    const k = c as BudgetCategory;
    s.budget.allocations[k] = Math.max(0, s.budget.allocations[k] + (v ?? 0));
  }
  if (e.taxes) for (const [t, v] of Object.entries(e.taxes)) {
    const k = t as keyof Taxes;
    const [lo, hi] = TAX_LIMITS[k];
    s.economy.taxes[k] = clamp(s.economy.taxes[k] + (v ?? 0), lo, hi);
  }
  if (e.groups) for (const [g, v] of Object.entries(e.groups)) {
    const st = s.population.groups[g as GroupId];
    if (st) st.mood = clamp(st.mood + (v ?? 0), -45, 45);
  }
  if (e.services) for (const [id, v] of Object.entries(e.services)) {
    const svc = s.services[id as ServiceId];
    if (svc) svc.quality = clamp(svc.quality + (v ?? 0));
  }
  if (e.serviceBonus) for (const [id, v] of Object.entries(e.serviceBonus)) {
    const svc = s.services[id as ServiceId];
    if (svc) svc.bonus = clamp(svc.bonus + (v ?? 0), -30, 30);
  }
  if (e.economy) {
    s.economy.shocks.growth += e.economy.growth ?? 0;
    s.economy.shocks.inflation += e.economy.inflation ?? 0;
    s.economy.shocks.unemployment += e.economy.unemployment ?? 0;
  }
  if (e.oneOffCost) s.economy.debt += e.oneOffCost;
  if (e.revenue) s.economy.otherRevenue += e.revenue;
  if (e.playerCapital) s.player.politicalCapital = clamp(s.player.politicalCapital + e.playerCapital);
  if (e.playerReputation) s.player.reputation = clamp(s.player.reputation + e.playerReputation);
  if (e.playerPopularity) {
    const me = s.politicians[s.player.politicianId];
    me.popularity = clamp(me.popularity + e.playerPopularity);
  }
  if (e.partyMomentum) for (const [pid, v] of Object.entries(e.partyMomentum)) {
    const p = s.parties[pid];
    if (p) p.momentum = clamp(p.momentum + v, -40, 40);
  }
  if (e.stability) s.government.stability = clamp(s.government.stability + e.stability);
  if (e.loyalty) for (const [id, v] of Object.entries(e.loyalty)) {
    const p = s.politicians[id];
    if (p) p.loyalty = clamp(p.loyalty + v);
  }
  if (e.regionInvestment) for (const [r, v] of Object.entries(e.regionInvestment)) {
    const st = s.population.regions[r as RegionId];
    if (st) st.investment = clamp(st.investment + (v ?? 0));
  }
  refreshFiscals(s);
  recomputeGroupSatisfaction(s);
  s.government.approval = computeApproval(s);
}

export function logEvent(s: GameState, icon: string, text: string, importance: 1 | 2 | 3 = 1, tone: NewsTone = 'neutral', kind = 'general'): void {
  const ev = { turn: s.turn, icon, text, importance, tone, kind };
  s.turnLog.push(ev);
  if (importance >= 2) {
    s.eventLog.push(ev);
    if (s.eventLog.length > 200) s.eventLog.shift();
  }
}

export function addNews(s: GameState, headline: string, tone: NewsTone = 'neutral', icon = '📰'): void {
  s.news.unshift({ id: newId(s, 'n'), turn: s.turn, headline, outlet: pick(s, OUTLETS), tone, icon });
  if (s.news.length > 80) s.news.length = 80;
}

export function remember(s: GameState, polId: string, kind: GameState['politicians'][string]['memory'][number]['kind'], text: string, weight: number, deadlineTurn?: number, ref?: string): void {
  const p = s.politicians[polId];
  if (!p || p.isPlayer) return;
  p.memory.push({ turn: s.turn, kind, text, weight, deadlineTurn, ref });
  if (p.memory.length > 12) p.memory.shift();
  if (weight) p.loyalty = clamp(p.loyalty + weight * 0.6);
}
