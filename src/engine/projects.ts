import { projectCeremony, projectDelayed, projectStarted } from './aftermath';
import { PROJECT_BY_ID } from '../data/projects';
import { chance } from './rng';
import type { GameState, Project } from '../types/game';
import { clamp, newId } from '../utils';
import { addNews, applyEffects, logEvent } from './effects';
import { refreshFiscals } from './economy';

export function startProject(s: GameState, defId: string, sponsorId: string): Project | null {
  const def = PROJECT_BY_ID[defId];
  if (!def || s.projects.some((p) => p.defId === defId && p.status === 'active')) return null;
  const p: Project = {
    id: newId(s, 'prj'), defId, name: def.name, icon: def.icon, region: def.region, service: def.service, totalCost: def.cost,
    spent: 0, progress: 0, durationTurns: def.turns, turnsElapsed: 0, status: 'active', delays: 0, startedTurn: s.turn, sponsorId,
  };
  s.projects.push(p);
  if (sponsorId === s.player.politicianId) s.career.moneyInvested += def.cost;
  projectStarted(s, p.id);
  refreshFiscals(s);
  addNews(s, `יוצא לדרך: ${def.name} (₪${def.cost} מיליארד)`, 'neutral', def.icon);
  return p;
}

export function cancelProject(s: GameState, id: string): boolean {
  const p = s.projects.find((x) => x.id === id && x.status === 'active');
  if (!p) return false;
  p.status = 'cancelled';
  refreshFiscals(s);
  return true;
}

export function simulateProjects(s: GameState): void {
  for (const p of s.projects) {
    if (p.status !== 'active') continue;
    const def = PROJECT_BY_ID[p.defId];
    const ministry = s.government.ministries.find((m) => m.services.includes(p.service));
    const eff = ministry?.efficiency ?? 45;
    const bureaucracy = ministry?.bureaucracy ?? 55;
    p.turnsElapsed += 1;
    p.spent += p.totalCost / p.durationTurns;
    // delays depend on bureaucracy and efficiency — not pure luck
    if (chance(s, clamp(0.08 + (bureaucracy - 50) / 250 - (eff - 50) / 300, 0.02, 0.3))) {
      p.delays += 1;
      p.durationTurns += 1;
      p.totalCost *= 1.04;
      if (p.delays === 2) addNews(s, `${p.name}: עיכוב נוסף וחריגה בתקציב`, 'bad', '🐌');
      projectDelayed(s, p.id);
    } else {
      p.progress = clamp((p.turnsElapsed / p.durationTurns) * 100);
    }
    if (p.turnsElapsed >= p.durationTurns) {
      p.status = 'done';
      p.progress = 100;
      const svc = s.services[p.service];
      if (def.metric) svc.metrics[def.metric.key] = (svc.metrics[def.metric.key] ?? 0) + def.metric.amount;
      applyEffects(s, { serviceBonus: { [p.service]: def.bonus }, groups: def.groups, regionInvestment: { [p.region]: 15 } });
      const st = s.population.regions[p.region];
      st.infrastructure = clamp(st.infrastructure + 6);
      addNews(s, `נחנך: ${p.name}${p.delays ? ` (באיחור של ${p.delays * 2} חודשים)` : ''}`, 'good', '✂️');
      logEvent(s, '🎀', `הפרויקט "${p.name}" הושלם`, 2, 'good', 'project');
      projectCeremony(s, p.id);
      if (p.sponsorId === s.player.politicianId) {
        s.career.memorable.push(`חנך את ${p.name}`);
        s.player.reputation = clamp(s.player.reputation + 4);
      }
    }
  }
  refreshFiscals(s);
}
