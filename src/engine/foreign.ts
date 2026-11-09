// The foreign minister's toolbox: relations with 14 countries and blocs, and six diplomatic moves.
import { CHANNELS, DOVE_GROUPS, HAWK_GROUPS } from '../data/security';
import type { GameState, GroupId } from '../types/game';
import { clamp } from '../utils';
import { addNews, applyEffects, logEvent } from './effects';
import { rand } from './rng';
import { COUNTRIES, world } from './security';

export interface ForeignEntry { id: string; name: string }
/** Every country and bloc the foreign minister deals with: the eight in `relations` and the channels. */
export const FOREIGN_LIST: ForeignEntry[] = [
  ...COUNTRIES.map((c) => ({ id: c.id, name: c.name })),
  ...CHANNELS.filter((c) => c.id !== 'usa').map((c) => ({ id: c.id, name: c.name })),
];
export const FOREIGN_BY_ID = Object.fromEntries(FOREIGN_LIST.map((c) => [c.id, c])) as Record<string, ForeignEntry>;
/** Hostile or contested: a sharp word against them pleases the right, warmth towards them angers it. */
const CONTESTED = new Set(['qatar', 'pa', 'russia', 'china', 'un']);
export const isContested = (id: string) => CONTESTED.has(id);

export const foreignValue = (s: GameState, id: string): number => {
  const w = world(s);
  return w.relations[id] ?? w.channels[id] ?? 0;
};

export function shiftForeign(s: GameState, id: string, d: number): void {
  const w = world(s);
  if (id in w.relations) w.relations[id] = clamp(w.relations[id] + d);
  if (id in w.channels) w.channels[id] = clamp(w.channels[id] + d);
}

const scaled = (g: Partial<Record<GroupId, number>>, k: number): Partial<Record<GroupId, number>> => Object.fromEntries(Object.entries(g).map(([id, v]) => [id, Math.round((v ?? 0) * k * 10) / 10])) as Partial<Record<GroupId, number>>;
const pol = (s: GameState) => s.politicians[s.player.politicianId];
const skill = (s: GameState) => ((pol(s).expertise.foreign ?? 20) - 20) / 300;

export interface ForeignResult { ok: boolean; title: string; text: string }

export function visitCountry(s: GameState, id: string): ForeignResult {
  const c = FOREIGN_BY_ID[id];
  const v = foreignValue(s, id);
  const p = clamp(0.55 + (v - 40) / 150 + skill(s), 0.2, 0.9);
  if (isContested(id) && ['qatar', 'pa'].includes(id)) applyEffects(s, { groups: scaled(DOVE_GROUPS, 0.25) });
  if (rand(s) < p) {
    const gain = Math.round((5 + rand(s) * 4) * 10) / 10;
    shiftForeign(s, id, gain);
    addNews(s, `${pol(s).name} ביקר ב${c.name}: היחסים התחממו`, 'good', '✈️');
    return { ok: true, title: `ביקור מוצלח ב${c.name}`, text: `היחסים עם ${c.name} השתפרו ב-${gain.toFixed(0)}.` };
  }
  shiftForeign(s, id, -3);
  applyEffects(s, { playerReputation: -1 });
  return { ok: false, title: `הביקור ב${c.name} לא הצליח`, text: `תקרית פרוטוקולית העיבה על הביקור. היחסים ירדו ב-3.` };
}

export const hasPact = (s: GameState, id: string) => (world(s).pacts ?? []).includes(id);

export function signAgreement(s: GameState, id: string): ForeignResult {
  const c = FOREIGN_BY_ID[id];
  const v = foreignValue(s, id);
  if (v < 35) return { ok: false, title: `${c.name} לא מוכנה לחתום`, text: 'היחסים לא מספיק טובים. כדאי לבקר שם או לחזק קשרים קודם.' };
  const p = clamp(0.45 + (v - 35) / 120 + skill(s), 0.2, 0.85);
  if (rand(s) < p) {
    shiftForeign(s, id, 8);
    const w = world(s);
    w.pacts = [...(w.pacts ?? []), id];
    applyEffects(s, { playerReputation: 2, groups: { center: 1, liberals: 1 } });
    addNews(s, `נחתם הסכם שיתוף פעולה עם ${c.name}`, 'good', '🤝');
    logEvent(s, '🤝', `הסכם שיתוף פעולה עם ${c.name}`, 2, 'good', 'diplomacy');
    return { ok: true, title: `נחתם הסכם עם ${c.name}`, text: 'ההסכם מחזק את היחסים ופותח הזדמנויות לסחר ולשיתוף פעולה.' };
  }
  return { ok: false, title: `המשא ומתן עם ${c.name} נתקע`, text: 'הצדדים לא הגיעו להסכמה. אפשר לנסות שוב בתור הבא.' };
}

export function statement(s: GameState, id: string): ForeignResult {
  const c = FOREIGN_BY_ID[id];
  shiftForeign(s, id, id === 'usa' || id === 'eu' ? -10 : -6);
  applyEffects(s, { playerPopularity: 1, playerReputation: -1, groups: scaled(HAWK_GROUPS, isContested(id) ? 0.25 : 0.12) });
  addNews(s, `שר החוץ נגד ${c.name}: הצהרה חריפה`, 'neutral', '📢');
  return { ok: true, title: `הצהרה חריפה נגד ${c.name}`, text: 'הציבור בבית שמע. ביחסים עם המדינה יש מחיר.' };
}

export function summonAmbassador(s: GameState, id: string): ForeignResult {
  const c = FOREIGN_BY_ID[id];
  const backfire = rand(s) < 0.2;
  shiftForeign(s, id, backfire ? -6 : -3);
  applyEffects(s, { playerReputation: backfire ? -1 : 1, groups: scaled(HAWK_GROUPS, 0.1) });
  return { ok: !backfire, title: `שיחת נזיפה עם שגריר ${c.name}`, text: backfire ? 'השגריר פרסם תגובה חריפה, והשיחה חזרה אלינו בבומרנג.' : 'המסר הועבר. היחסים נפגעו מעט.' };
}

export const hasAmbassador = (s: GameState, id: string) => (world(s).ambassadors ?? []).includes(id);

export function changeAmbassador(s: GameState, id: string, mode: 'appoint' | 'recall'): ForeignResult {
  const c = FOREIGN_BY_ID[id];
  const w = world(s);
  if (mode === 'appoint') {
    w.ambassadors = [...(w.ambassadors ?? []), id];
    shiftForeign(s, id, 4);
    return { ok: true, title: `מונה שגריר ב${c.name}`, text: 'נוכחות דיפלומטית קבועה משפרת את היחסים ב-4.' };
  }
  w.ambassadors = (w.ambassadors ?? []).filter((x) => x !== id);
  shiftForeign(s, id, -15);
  applyEffects(s, { groups: scaled(HAWK_GROUPS, 0.3), playerReputation: -1 });
  addNews(s, `השגריר בישמעאל ב${c.name} הוחזר לייעוץ`, 'bad', '↩️');
  return { ok: true, title: `השגריר ב${c.name} הוחזר`, text: 'צעד חריף: היחסים ירדו ב-15.' };
}

export function unCoalition(s: GameState): ForeignResult {
  const w = world(s);
  const avg = ((w.relations.usa ?? 0) + (w.relations.eu ?? 0) + (w.relations.uk ?? 0) + (w.relations.germany ?? 0)) / 4;
  const p = clamp(0.25 + (avg - 30) / 120 + skill(s), 0.1, 0.8);
  if (rand(s) < p) {
    w.relations.un = clamp((w.relations.un ?? 0) + 6);
    w.relations.eu = clamp((w.relations.eu ?? 0) + 2);
    applyEffects(s, { playerReputation: 2 });
    addNews(s, 'ישמעאל גייסה קואליציית מדינות בהצבעה באו״ם', 'good', '🌐');
    return { ok: true, title: 'קואליציה באו״ם', text: 'גייסת מדינות ידידותיות לצידך בהצבעה. היחסים עם האו״ם והאיחוד האירופי השתפרו.' };
  }
  w.relations.un = clamp((w.relations.un ?? 0) - 2);
  return { ok: false, title: 'הקואליציה באו״ם לא נבנתה', text: 'לא הצלחת לגייס מספיק מדינות. היחסים עם האו״ם ירדו מעט.' };
}
