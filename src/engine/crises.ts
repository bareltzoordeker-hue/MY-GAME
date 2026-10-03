import { CRISES, CRISIS_BY_ID } from '../data/crises';
import { DIFFICULTIES } from '../data/world';
import { chance, rand } from './rng';
import type { Crisis, GameState, Reaction } from '../types/game';
import { clamp, newId } from '../utils';
import { addNews, applyEffects, logEvent, scaleEffects } from './effects';

const MAX_ACTIVE = 2;

export function crisisProbability(s: GameState, defId: string): number {
  const def = CRISIS_BY_ID[defId];
  return clamp(def.trigger(s) * DIFFICULTIES[s.difficulty].eventRate, 0, 0.6);
}

export function startCrisis(s: GameState, defId: string, severity?: 1 | 2 | 3): Crisis {
  const def = CRISIS_BY_ID[defId];
  const sev = severity ?? ((1 + Math.floor(rand(s) * 2.2)) as 1 | 2 | 3);
  const c: Crisis = {
    id: newId(s, 'cr'), defId, title: def.title, icon: def.icon, category: def.category, severity: Math.min(3, sev) as 1 | 2 | 3,
    startTurn: s.turn, remaining: def.duration + (sev === 3 ? 1 : 0), affectedServices: def.services, affectedGroups: def.groups,
    perTurn: def.perTurn, impactLines: def.impact, actions: def.actions, ministryId: def.ministryId,
  };
  s.crises.push(c);
  s.flags[`crisis_cd_${defId}`] = s.turn + 6;
  addNews(s, def.headline, 'bad', def.icon);
  logEvent(s, def.icon, `משבר חדש: ${def.title}`, 3, 'bad', 'crisis');
  applyEffects(s, scaleEffects(def.perTurn, 0.5 * c.severity));
  return c;
}

/** Event Engine for crises: only crises whose conditions exist in the state can fire. */
export function generateCrises(s: GameState): void {
  if (s.crises.length >= MAX_ACTIVE) return;
  const candidates = CRISES.filter((d) => !s.crises.some((c) => c.defId === d.id) && (s.flags[`crisis_cd_${d.id}`] ?? 0) <= s.turn
    && !(d.ministryId && (s.flags[`calm_${d.ministryId}`] ?? 0) > s.turn));
  // shuffle-free: evaluate in deterministic order but at most one new crisis per turn
  const scored = candidates.map((d) => ({ d, p: crisisProbability(s, d.id) })).filter((x) => x.p > 0);
  scored.sort((a, b) => b.p - a.p);
  for (const { d, p } of scored) {
    if (chance(s, p)) {
      startCrisis(s, d.id);
      return;
    }
  }
}

export function tickCrises(s: GameState): void {
  for (const c of [...s.crises]) {
    applyEffects(s, scaleEffects(c.perTurn, 0.5 + c.severity * 0.35));
    c.remaining -= 1;
    if (c.remaining <= 0) {
      s.crises = s.crises.filter((x) => x !== c);
      logEvent(s, '✅', `${c.title} דעך מעצמו`, 2, 'neutral', 'crisis');
      addNews(s, `${c.title}: המשבר נרגע. איש לא יודע למה.`, 'neutral', c.icon);
    }
  }
}

/** Who handles a crisis: the PM, or the minister whose portfolio it hit. Everyone else can only talk about it. */
export function canHandleCrisis(s: GameState, c: Crisis): boolean {
  if (s.government.pmId === s.player.politicianId) return true;
  if (s.player.role !== 'minister' || !c.ministryId) return false;
  const m = s.government.ministries.find((x) => x.ministerId === s.player.politicianId);
  return !!m && (m.origins ?? [m.id]).includes(c.ministryId);
}

export function crisisOwner(s: GameState, c: Crisis): string {
  const m = c.ministryId ? s.government.ministries.find((x) => (x.origins ?? [x.id]).includes(c.ministryId!)) : undefined;
  return m ? m.name : 'ראש הממשלה';
}

/** Player handles a crisis with one of its actions. */
export function resolveCrisis(s: GameState, crisisId: string, actionId: string): Reaction | null {
  const c = s.crises.find((x) => x.id === crisisId);
  if (!c) return null;
  if (!canHandleCrisis(s, c)) {
    return { title: 'זה לא באחריותך', subtitle: `את המשבר מנהל/ת ${crisisOwner(s, c)}`, status: 'rejected', stats: [], groups: [], people: [], quip: 'אפשר להגיב בתקשורת – לתקוף או לגבות. להחליט – לא.' };
  }
  const a = c.actions.find((x) => x.id === actionId);
  if (!a) return null;
  if (a.capital > s.player.politicalCapital) {
    return { title: 'אין מספיק הון פוליטי', status: 'rejected', stats: [], groups: [], people: [], quip: 'היועץ: "צריך קודם לצבור קצת כוח."' };
  }
  s.player.politicalCapital = clamp(s.player.politicalCapital - a.capital);
  if (a.cost) { s.economy.debt += a.cost; s.career.moneyInvested += a.cost; }
  applyEffects(s, a.effects);
  if (a.id === 'ignore') {
    logEvent(s, '🙈', `החלטת להתעלם מ${c.title}`, 1, 'bad', 'crisis');
    return { title: `התעלמת מ${c.title}`, status: 'info', stats: [{ icon: '📉', label: 'פופולריות', value: '-2', tone: 'bad' }], groups: [], people: [], quip: 'היועץ: "אולי זה יעבור מעצמו. ואולי לא."' };
  }
  const ok = rand(s) < a.successChance;
  if (ok) {
    s.crises = s.crises.filter((x) => x !== c);
    const me = s.politicians[s.player.politicianId];
    me.popularity = clamp(me.popularity + 3 + c.severity);
    s.player.reputation = clamp(s.player.reputation + 3);
    addNews(s, `${c.title} הסתיים: "${a.label}" עבד`, 'good', '✅');
    logEvent(s, '✅', `טיפלת ב${c.title}: ${a.label}`, 2, 'good', 'crisis');
    s.career.memorable.push(`ניהל את ${c.title} (${a.label})`);
  } else {
    c.severity = Math.min(3, c.severity + 1) as 1 | 2 | 3;
    addNews(s, `${a.label} נכשל; ${c.title} מחריף`, 'bad', '⚠️');
    logEvent(s, '⚠️', `${a.label} לא עבד. המשבר מחריף`, 2, 'bad', 'crisis');
  }
  return {
    title: ok ? `${c.title}: טופל` : `${c.title}: הניסיון נכשל`,
    subtitle: a.label,
    status: ok ? 'approved' : 'rejected',
    stats: [
      ...(a.cost ? [{ icon: '💸', label: 'עלות', value: `₪${a.cost.toFixed(1)} מיליארד`, tone: 'bad' as const }] : []),
      ...(a.capital ? [{ icon: '🎯', label: 'הון פוליטי', value: `-${a.capital}`, tone: 'bad' as const }] : []),
      { icon: '📊', label: 'פופולריות', value: ok ? `+${3 + c.severity}` : '0', tone: ok ? 'good' : 'neutral' },
    ],
    groups: [],
    people: [],
  };
}
