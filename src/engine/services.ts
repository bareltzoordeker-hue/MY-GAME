import { CATEGORIES, SERVICES } from '../data/world';
import type { GameState, Ministry, ServiceId } from '../types/game';
import { clamp, lerp, sum } from '../utils';

export function fundingRatio(s: GameState, id: ServiceId): number {
  const cats = SERVICES.find((x) => x.id === id)!.categories;
  const alloc = sum(cats.map((c) => s.budget.allocations[c]));
  const need = sum(cats.map((c) => s.budget.needs[c]));
  return alloc / Math.max(0.1, need);
}

export function ministryForService(s: GameState, id: ServiceId): Ministry | undefined {
  return s.government.ministries.find((m) => m.services.includes(id));
}

export function ministerSkill(s: GameState, m: Ministry | undefined): number {
  if (!m || !m.ministerId) return 35;
  const p = s.politicians[m.ministerId];
  if (!p) return 35;
  return p.expertise[m.domain] ?? 20;
}

/** Quality the service is converging to, explained. */
export function serviceDrivers(s: GameState, id: ServiceId): { label: string; value: number }[] {
  const svc = s.services[id];
  const m = ministryForService(s, id);
  const r = fundingRatio(s, id);
  const crisisPenalty = s.crises.filter((c) => c.affectedServices.includes(id)).length * 4;
  return [
    { label: 'בסיס', value: 55 },
    { label: 'מימון ביחס לצורך', value: clamp((r - 1) * 90, -35, 30) },
    { label: 'יעילות המשרד', value: m ? (m.efficiency - 50) * 0.2 : -3 },
    { label: 'מומחיות השר', value: (ministerSkill(s, m) - 50) * 0.12 },
    { label: 'פרויקטים ורפורמות', value: svc.bonus },
    { label: 'משברים פעילים', value: -crisisPenalty },
  ];
}

export function simulateServices(s: GameState): void {
  for (const def of SERVICES) {
    const svc = s.services[def.id];
    const target = clamp(sum(serviceDrivers(s, def.id).map((d) => d.value)), 5, 98);
    const before = svc.quality;
    svc.quality = clamp(lerp(svc.quality, target, 0.15));
    svc.trend = svc.quality - before;
    svc.satisfaction = clamp(lerp(svc.satisfaction, svc.quality - 4 + svc.trend * 4, 0.3));
    updateMetrics(s, def.id);
  }
}

/** Budget needs grow with inflation, population and ageing. Called each turn. */
export function growNeeds(s: GameState): void {
  const g = Math.pow(1 + (s.economy.inflation + s.population.growthRate) / 100, 1 / 6);
  for (const c of CATEGORIES) {
    const ageing = c.id === 'health' || c.id === 'welfare' ? 1.0012 : 1;
    s.budget.needs[c.id] *= g * ageing;
    // automatic indexation of allocations (continuation budget) — real changes come from decisions
    s.budget.allocations[c.id] *= g;
  }
}

/** Domain-specific KPIs used by ministry dashboards. Derived from the simulation, never free-floating. */
export function updateMetrics(s: GameState, id: ServiceId): void {
  const svc = s.services[id];
  const q = svc.quality;
  const m = svc.metrics;
  const r = fundingRatio(s, id);
  const issues: string[] = [];
  switch (id) {
    case 'transport':
      m.congestion = clamp(105 - q * 0.75 + s.population.total * 1.5);
      m.commute = Math.round(80 - q * 0.45 + m.congestion * 0.15);
      m.punctuality = Math.round(clamp(40 + q * 0.55));
      if (m.congestion > 70) issues.push('פקקים כרוניים בכניסות לערים');
      if (m.punctuality < 65) issues.push('רכבות מאחרות באופן קבוע');
      break;
    case 'education':
      m.classSize = Math.round(40 - q * 0.13 - (m.classrooms ?? 0) / 250);
      m.teacherShortage = Math.max(0, Math.round((1.05 - r) * 30000 + (60 - q) * 120));
      m.score = Math.round(430 + q * 1.3);
      if (m.classSize > 34) issues.push('כיתות צפופות');
      if (m.teacherShortage > 3000) issues.push('מחסור חמור במורים');
      break;
    case 'health':
      m.erWait = Math.round((10 - q * 0.075 - (m.beds ?? 0) / 1500) * 10) / 10;
      m.bedsPer1000 = Math.round((1.7 + (m.beds ?? 0) / 10000 + q * 0.004) * 100) / 100;
      m.doctorShortage = Math.max(0, Math.round((1.05 - r) * 4000 + (60 - q) * 40));
      if (m.erWait > 6) issues.push('המתנה ארוכה במיון');
      if (m.bedsPer1000 < 2) issues.push('תפוסת יתר במחלקות');
      break;
    case 'housing':
      m.aptPrice = Math.round((2.3 * (1 + (55 - q) / 150) * (s.economy.avgIncome / 12800)) * 100) / 100;
      m.salaryYears = Math.round(((m.aptPrice * 1e6) / (s.economy.avgIncome * 12)) * 10) / 10;
      if (m.salaryYears > 12) issues.push('דירה = 12+ שנות משכורת');
      break;
    case 'security':
      m.readiness = Math.round(clamp(30 + q * 0.7));
      m.reserveDays = Math.round(45 - q * 0.3 + s.crises.filter((c) => c.defId === 'border').length * 20);
      if (m.readiness < 60) issues.push('כשירות נמוכה');
      break;
    case 'welfare':
      m.poverty = Math.round((24 - q * 0.15 + s.economy.unemployment * 0.5) * 10) / 10;
      if (m.poverty > 20) issues.push('שיעור עוני גבוה');
      break;
    case 'energy':
      m.blackoutRisk = Math.round(clamp(80 - q));
      if (m.blackoutRisk > 40) issues.push('סיכון להפסקות חשמל בקיץ');
      break;
    case 'infrastructure':
      m.waterIndex = Math.round(clamp(q + 5));
      if (q < 45) issues.push('צנרת ישנה ותקלות');
      break;
    case 'govServices':
      m.bureaucracyDays = Math.round(60 - q * 0.5);
      if (m.bureaucracyDays > 30) issues.push('ביורוקרטיה איטית');
      break;
  }
  if (r < 0.9) issues.unshift('תת-תקצוב');
  svc.issues = issues;
}

export const servicesAverage = (s: GameState) => sum(Object.values(s.services).map((x) => x.quality)) / SERVICES.length;
