import { GROUPS, REGIONS, REGION_BY_ID, SERVICES, groupWeight } from '../data/world';
import type { GameState, GroupId } from '../types/game';
import { clamp, lerp, sum } from '../utils';

const ECON_SENSITIVE: Partial<Record<GroupId, number>> = {
  lowIncome: 1.6, youth: 1.3, employees: 1.2, selfEmployed: 1.3, middleClass: 1.1, students: 1.1, families: 1.1, retirees: 0.9,
};

/** Structural satisfaction target of a group, before permanent offsets. */
export function groupTargetRaw(s: GameState, id: GroupId): number {
  const def = GROUPS.find((g) => g.id === id)!;
  const e = s.economy;
  let t = def.base;
  for (const svc of SERVICES) {
    const w = svc.groups[id];
    if (w) t += (s.services[svc.id].quality - 55) * 0.35 * w;
  }
  const k = ECON_SENSITIVE[id] ?? 0.8;
  t += (-(e.unemployment - 4.5) * 1.6 - (e.inflation - 2.5) * 1.3 + (e.growth - 3) * 0.7) * k;
  return t;
}

export function simulateGroups(s: GameState): void {
  for (const g of GROUPS) {
    const st = s.population.groups[g.id];
    const before = st.satisfaction;
    const target = groupTargetRaw(s, g.id) + st.offset;
    st.structural = lerp(st.structural, target, 0.2);
    st.mood *= 0.85;
    st.satisfaction = clamp(st.structural + st.mood);
    st.lastDelta = st.satisfaction - before;
  }
}

export function recomputeGroupSatisfaction(s: GameState): void {
  for (const g of GROUPS) {
    const st = s.population.groups[g.id];
    st.satisfaction = clamp(st.structural + st.mood);
  }
}

export function weightedSatisfaction(s: GameState): number {
  return sum(GROUPS.map((g) => s.population.groups[g.id].satisfaction * groupWeight(g.id)));
}

export function computeApproval(s: GameState): number {
  return clamp(weightedSatisfaction(s) * 0.85 + s.government.stability * 0.15 - s.crises.length * 1.5);
}

export function simulatePopulation(s: GameState): void {
  const p = s.population;
  p.total *= Math.pow(1 + p.growthRate / 100, 1 / 6);
  p.growthRate = clamp(lerp(p.growthRate, 1.8 - Math.max(0, s.economy.unemployment - 7) * 0.05, 0.05), 0.5, 3);
  // slow ageing
  p.ages.seniors = clamp(p.ages.seniors + 0.0002, 0, 0.3);
  p.ages.kids = clamp(p.ages.kids - 0.0001, 0.2, 0.4);
  p.ages.adults = 1 - p.ages.seniors - p.ages.kids - p.ages.young;

  simulateGroups(s);
  s.government.approval = computeApproval(s);

  const e = s.economy;
  for (const r of REGIONS) {
    const st = p.regions[r.id];
    st.investment = clamp(lerp(st.investment, 40, 0.03));
    st.unemployment = clamp(e.unemployment * r.unempFactor - (st.investment - 40) * 0.03, 1.5, 30);
    st.income = Math.round(e.avgIncome * r.incomeFactor * (1 + (st.investment - 40) / 600));
    st.infrastructure = clamp(lerp(st.infrastructure, r.infra + (st.investment - 40) * 0.4 + (s.services.infrastructure.quality - 50) * 0.3, 0.1));
    const svcAvg = sum(Object.values(s.services).map((x) => x.quality)) / 9;
    st.services = clamp(svcAvg + (st.infrastructure - 55) * 0.4);
    st.satisfaction = clamp(s.government.approval + (st.investment - 40) * 0.25 - (st.unemployment - e.unemployment) * 2 + (st.services - svcAvg) * 0.3);
  }
}

export function regionName(id: string): string {
  return REGION_BY_ID[id as keyof typeof REGION_BY_ID]?.name ?? id;
}
