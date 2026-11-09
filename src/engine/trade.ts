// Foreign trade: exports and imports by partner, driven by relations, agreements, tariffs and the economy minister's moves.
// The numbers are a simulation (shares of GDP), not official statistics.
import type { GameState, TradeState } from '../types/game';
import { clamp } from '../utils';
import { addNews, applyEffects, logEvent } from './effects';
import { FOREIGN_BY_ID, foreignValue, hasPact, shiftForeign } from './foreign';
import { rand } from './rng';
import { initWorld } from './security';

/** Annual exports / imports with each partner, in % of GDP, at neutral relations. */
export const TRADE_BASE: Record<string, { ex: number; im: number }> = {
  usa: { ex: 7.0, im: 3.6 }, eu: { ex: 4.6, im: 8.0 }, germany: { ex: 1.3, im: 2.5 }, uk: { ex: 1.6, im: 1.3 }, china: { ex: 1.8, im: 4.5 },
  india: { ex: 1.0, im: 1.2 }, russia: { ex: 0.3, im: 0.8 }, uae: { ex: 1.2, im: 0.7 }, egypt: { ex: 0.5, im: 0.4 }, jordan: { ex: 0.5, im: 0.2 },
  saudi: { ex: 0.15, im: 0.1 }, qatar: { ex: 0.03, im: 0.05 }, pa: { ex: 1.0, im: 0.4 },
};
/** The rest of the world: not affected by the player's moves. */
const REST = { ex: 8.0, im: 6.0 };
export const TRADE_PARTNERS = Object.keys(TRADE_BASE);

export const tradeState = (s: GameState): TradeState => (s.trade ??= { tariffs: [], deals: [], boosts: {} });

const relFactorEx = (v: number) => 0.65 + (v / 100) * 0.7;
const relFactorIm = (v: number) => 0.85 + (v / 100) * 0.3;

export interface TradeRow { id: string; name: string; rel: number; exports: number; imports: number; deal: boolean; pact: boolean; tariff: boolean; boost: boolean }
export interface TradeSummary { rows: TradeRow[]; restExports: number; restImports: number; totalExports: number; totalImports: number; balance: number; exportsPctGdp: number; importsPctGdp: number; index: number }

function summarize(s: GameState, rel: (id: string) => number, t: TradeState, gdp: number): TradeSummary {
  const rows: TradeRow[] = [];
  let baseEx = 0;
  let curEx = 0;
  for (const id of TRADE_PARTNERS) {
    const b = TRADE_BASE[id];
    const v = rel(id);
    const pact = (s.world?.pacts ?? []).includes(id);
    const deal = t.deals.includes(id);
    const tariff = t.tariffs.includes(id);
    const boost = (t.boosts[id]?.until ?? -1) >= s.turn;
    const industry = (t.industry?.until ?? -1) >= s.turn ? t.industry!.pct : 0;
    const exF = relFactorEx(v) * (pact ? 1.08 : 1) * (deal ? 1.1 : 1) * (1 + (boost ? t.boosts[id].pct : 0) + industry) * (tariff ? 0.92 : 1);
    const imF = relFactorIm(v) * (tariff ? 0.65 : 1) * (deal ? 1.06 : 1);
    const ex = (gdp * b.ex) / 100 * exF;
    const im = (gdp * b.im) / 100 * imF;
    baseEx += b.ex;
    curEx += b.ex * exF;
    rows.push({ id, name: FOREIGN_BY_ID[id]?.name ?? id, rel: v, exports: ex, imports: im, deal, pact, tariff, boost });
  }
  const restExports = (gdp * REST.ex) / 100;
  const restImports = (gdp * REST.im) / 100;
  const totalExports = rows.reduce((a, r) => a + r.exports, 0) + restExports;
  const totalImports = rows.reduce((a, r) => a + r.imports, 0) + restImports;
  return { rows, restExports, restImports, totalExports, totalImports, balance: totalExports - totalImports, exportsPctGdp: (totalExports / gdp) * 100, importsPctGdp: (totalImports / gdp) * 100, index: curEx / baseEx - 1 };
}

const START_RELATIONS = (() => { const w = initWorld(); return (id: string) => w.relations[id] ?? w.channels[id] ?? 50; })();
const START_INDEX = summarize({ turn: 0 } as GameState, START_RELATIONS, { tariffs: [], deals: [], boosts: {} }, 1000).index;

export function computeTrade(s: GameState): TradeSummary {
  return summarize(s, (id) => foreignValue(s, id), tradeState(s), s.economy.gdp);
}

/** How much foreign trade adds to or takes from yearly growth, compared with where the game started. */
export function tradeGrowthEffect(s: GameState): number {
  return clamp((computeTrade(s).index - START_INDEX) * 3, -1.2, 1.0);
}

export interface TradeResult { ok: boolean; title: string; text: string }
const name = (id: string) => FOREIGN_BY_ID[id]?.name ?? id;
const skill = (s: GameState) => ((s.politicians[s.player.politicianId].expertise.economy ?? 20) - 20) / 300;

export function tradeDeal(s: GameState, id: string): TradeResult {
  const t = tradeState(s);
  const v = foreignValue(s, id);
  if (v < 35 && !hasPact(s, id)) return { ok: false, title: `${name(id)} לא מוכנה להסכם סחר`, text: 'היחסים לא מספיק טובים. כדאי לחזק אותם קודם, למשל בהסכם שיתוף פעולה של שר החוץ.' };
  const p = clamp(0.4 + (v - 35) / 120 + (hasPact(s, id) ? 0.2 : 0) + skill(s), 0.15, 0.9);
  if (rand(s) < p) {
    t.deals.push(id);
    shiftForeign(s, id, 3);
    addNews(s, `נחתם הסכם סחר עם ${name(id)}`, 'good', '📦');
    logEvent(s, '📦', `הסכם סחר עם ${name(id)}`, 2, 'good', 'economy');
    return { ok: true, title: `הסכם סחר עם ${name(id)}`, text: 'הייצוא עולה ב-10% והייבוא ב-6%, והיחסים השתפרו מעט.' };
  }
  return { ok: false, title: `המשא ומתן על סחר עם ${name(id)} נתקע`, text: 'הצדדים לא הגיעו להסכמה. אפשר לנסות שוב.' };
}

export function exportDrive(s: GameState, id: string): TradeResult {
  tradeState(s).boosts[id] = { pct: 0.08, until: s.turn + 3 };
  applyEffects(s, { oneOffCost: 0.2 });
  return { ok: true, title: `מבצע ייצוא ל${name(id)}`, text: 'הייצוא למדינה גדל ב-8% במשך שלושה תורות (עלות חד-פעמית של ₪0.2 מיליארד).' };
}

export function tariff(s: GameState, id: string, mode: 'impose' | 'remove'): TradeResult {
  const t = tradeState(s);
  if (mode === 'impose') {
    t.tariffs.push(id);
    shiftForeign(s, id, -4);
    applyEffects(s, { groups: { employees: 1, selfEmployed: 1, highIncome: -1 }, economy: { inflation: 0.05 } });
    return { ok: true, title: `הוטלו מכסים על סחורות מ${name(id)}`, text: 'הייבוא יורד ב-35%, אבל הייצוא אליה נפגע, היחסים ירדו והמחירים עולים מעט.' };
  }
  t.tariffs = t.tariffs.filter((x) => x !== id);
  shiftForeign(s, id, 2);
  applyEffects(s, { groups: { highIncome: 1, middleClass: 1 } });
  return { ok: true, title: `בוטלו המכסים על ${name(id)}`, text: 'הסחר חוזר לרמתו, והיחסים השתפרו מעט.' };
}

export const SECTORS: Record<string, { label: string; groups: Partial<Record<string, number>> }> = {
  tech: { label: 'הייטק', groups: { highIncome: 2, youth: 1 } },
  industry: { label: 'תעשייה', groups: { employees: 2, periphery: 1 } },
  agriculture: { label: 'חקלאות', groups: { periphery: 2, selfEmployed: 1 } },
};

export function industryAid(s: GameState, sector: string): TradeResult {
  const sec = SECTORS[sector];
  tradeState(s).industry = { pct: 0.03, until: s.turn + 2 };
  applyEffects(s, { oneOffCost: 0.5, economy: { growth: 0.15 }, groups: sec.groups as never });
  return { ok: true, title: `סיוע לענף ${sec.label}`, text: 'מענקים והקלות לענף: הצמיחה עולה מעט והייצוא גדל ב-3% בשני התורות הקרובים (עלות ₪0.5 מיליארד).' };
}
