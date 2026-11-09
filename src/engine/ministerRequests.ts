// When the player is the prime minister, the ministers ask for approval too: the defense minister proposes strikes, the national-security
// minister police operations, the foreign and economy ministers launch initiatives, and others ask to start projects.
// What they achieve depends on their expertise; the PM approves or declines.
import { INTERNAL_OPTIONS } from '../data/internalSecurity';
import { PROJECTS } from '../data/projects';
import { FRONTS, OPERATIONS, OPERATION_BY_ID, type FrontId } from '../data/security';
import type { GameState, InboxItem, Politician, Reaction } from '../types/game';
import { clamp } from '../utils';
import { addInbox } from './characters';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { FOREIGN_BY_ID, FOREIGN_LIST, foreignValue, shiftForeign, signAgreement, statement, visitCountry } from './foreign';
import { startProject } from './projects';
import { chance, pick, rand } from './rng';
import { isPM } from './roles';
import { executeOperation, operationChance, world } from './security';
import { TRADE_BASE, exportDrive, tradeDeal, tradeState } from './trade';

/** How often ministers come with requests: 0 = rarely, 1 = normal, 2 = often (a setting the player can change). */
export const requestFreq = (s: GameState): number => clamp(s.flags.reqFreq ?? 1, 0, 2);

const ministerOf = (s: GameState, ministryId: string): Politician | undefined => {
  const m = s.government.ministries.find((x) => x.id === ministryId || (x.origins ?? []).includes(ministryId));
  const p = m?.ministerId ? s.politicians[m.ministerId] : undefined;
  return p && p.active && !p.isPlayer && p.id !== s.government.pmId ? p : undefined;
};
const exp = (p: Politician, domain: 'defense' | 'security' | 'foreign' | 'economy') => p.expertise[domain] ?? 20;
const level = (e: number) => (e >= 75 ? 'גבוהה' : e >= 50 ? 'טובה' : e >= 30 ? 'בינונית' : 'נמוכה');

/** A skilled minister improves things a little every turn; a weak one makes them worse. */
export function ministerSkillEffects(s: GameState): void {
  if (!isPM(s)) return;
  const fm = ministerOf(s, 'foreign');
  if (fm) for (const c of FOREIGN_LIST) shiftForeign(s, c.id, (exp(fm, 'foreign') - 50) / 200);
  const em = ministerOf(s, 'economy');
  if (em) applyEffects(s, { economy: { growth: (exp(em, 'economy') - 50) / 800 } });
}

interface Draft { fromId: string; kind: string; title: string; text: string; payload: Record<string, string | number>; approveLabel?: string }

function strikeRequest(s: GameState): Draft | null {
  const m = ministerOf(s, 'defense');
  if (!m) return null;
  const w = world(s);
  const fronts = FRONTS.filter((f) => w.fronts[f.id].threat >= 25).sort((a, b) => w.fronts[b.id].threat - w.fronts[a.id].threat);
  if (!fronts.length) return null;
  const front = fronts[Math.min(fronts.length - 1, Math.floor(rand(s) * 3))];
  const ops = OPERATIONS.filter((o) => o.fronts.includes(front.id as FrontId) && (s.flags[`op_${front.id}`] ?? -1) < s.turn);
  if (!ops.length) return null;
  const op = pick(s, ops);
  const e = exp(m, 'defense');
  const p = operationChance(s, op, front.id as FrontId, (e - 50) / 400);
  return {
    fromId: m.id, kind: 'mreq_strike', title: `${m.name} מבקש לאשר: ${op.name} ב${front.name}`, payload: { opId: op.id, front: front.id },
    text: `"אני מבקש לאשר ${op.name} בחזית ${front.name}. רמת האיום בחזית: ${w.fronts[front.id].threat.toFixed(0)}. הערכת הסיכוי להצלחה: ${Math.round(p * 100)}%. מומחיות הביטחון שלי ${level(e)}."${op.needsCabinet ? ' (מבצע גדול: מחיר בנפגעים ובלחץ בינלאומי.)' : ''}`,
  };
}

function internalRequest(s: GameState): Draft | null {
  const m = ministerOf(s, 'national_security');
  if (!m) return null;
  const o = pick(s, INTERNAL_OPTIONS.filter((x) => x.op));
  const e = exp(m, 'security');
  const police = s.budget.allocations.police / Math.max(0.1, s.budget.needs.police);
  const p = clamp(o.base + (police - 1) * 0.35 + (e - 50) / 300, 0.2, 0.95);
  return {
    fromId: m.id, kind: 'mreq_internal', title: `${m.name} מבקש לאשר: ${o.title}`, payload: { optId: o.id },
    text: `"${o.desc} אני מבקש אישור לצאת למבצע. הערכת הסיכוי להצלחה: ${Math.round(p * 100)}%. המומחיות שלי בתחום ${level(e)}."`,
  };
}

function foreignRequest(s: GameState): Draft | null {
  const m = ministerOf(s, 'foreign');
  if (!m) return null;
  const e = exp(m, 'foreign');
  const c = pick(s, FOREIGN_LIST);
  const v = foreignValue(s, c.id);
  const sharp = v < 40 && chance(s, 0.4);
  const act = sharp ? 'statement' : v >= 45 && chance(s, 0.5) ? 'agreement' : 'visit';
  const what = act === 'visit' ? `ביקור רשמי ב${c.name}` : act === 'agreement' ? `הסכם שיתוף פעולה עם ${c.name}` : `הצהרה חריפה נגד ${c.name}`;
  return {
    fromId: m.id, kind: 'mreq_foreign', title: `${m.name} מציע: ${what}`, payload: { act, country: c.id },
    text: `"אני מציע ${what}. היחסים עם ${c.name} עומדים על ${v.toFixed(0)}. הניסיון שלי בדיפלומטיה ${level(e)}."`,
  };
}

function tradeRequest(s: GameState): Draft | null {
  const m = ministerOf(s, 'economy');
  if (!m) return null;
  const e = exp(m, 'economy');
  const ids = Object.keys(TRADE_BASE);
  const c = pick(s, ids);
  const t = tradeState(s);
  const options: string[] = [];
  if (!t.deals.includes(c) && foreignValue(s, c) >= 35) options.push('deal');
  if ((t.boosts[c]?.until ?? -1) < s.turn) options.push('export');
  if (!options.length) return null;
  const act = pick(s, options);
  const name = FOREIGN_BY_ID[c]?.name ?? c;
  const what = act === 'deal' ? `הסכם סחר עם ${name}` : `מבצע ייצוא ל${name}`;
  return {
    fromId: m.id, kind: 'mreq_trade', title: `${m.name} מציע: ${what}`, payload: { act, country: c },
    text: `"אני מציע ${what}. הסחר עם ${name} חשוב למשק. המומחיות שלי בכלכלה ${level(e)}."${act === 'export' ? ' (עלות ₪0.2 מיליארד.)' : ''}`,
  };
}

function projectRequest(s: GameState): Draft | null {
  const cands: { m: Politician; d: (typeof PROJECTS)[number] }[] = [];
  for (const min of s.government.ministries) {
    const p = min.ministerId ? s.politicians[min.ministerId] : undefined;
    if (!p || !p.active || p.isPlayer || ['defense', 'foreign', 'economy', 'national_security'].includes(min.id)) continue;
    for (const d of PROJECTS) if ((min.origins ?? [min.id]).includes(d.ministry) && d.cost < 14 && !s.projects.some((x) => x.defId === d.id && x.status !== 'cancelled')) cands.push({ m: p, d });
  }
  if (!cands.length) return null;
  const { m, d } = pick(s, cands);
  return {
    fromId: m.id, kind: 'mreq_project', title: `${m.name} מבקש להשיק: ${d.name}`, payload: { defId: d.id },
    text: `"אני מבקש אישור להשיק את הפרויקט ${d.name}. עלות ₪${d.cost} מיליארד, ${d.turns * 2} חודשים, שיפור איכות +${d.bonus}."`,
  };
}

/** Once per turn when the player is the PM: a few ministers come with a request, according to the frequency setting. */
export function generateMinisterRequests(s: GameState): void {
  if (!isPM(s) || s.government.caretaker || s.elections.phase !== 'none') return;
  ministerSkillEffects(s);
  const pending = () => s.inbox.filter((i) => i.kind.startsWith('mreq_')).length;
  const f = requestFreq(s);
  const tries = [1, 2, 3][f];
  const p = [0.4, 0.75, 0.9][f];
  const builders = [strikeRequest, internalRequest, foreignRequest, tradeRequest, projectRequest, projectRequest];
  for (let i = 0; i < tries && pending() < 3; i++) {
    if (!chance(s, p)) continue;
    const draft = pick(s, builders)(s);
    if (!draft || (s.flags[`mreq_${draft.fromId}`] ?? -9) >= s.turn - 1) continue;
    s.flags[`mreq_${draft.fromId}`] = s.turn;
    addInbox(s, {
      kind: draft.kind, title: draft.title, fromId: draft.fromId, expiresTurn: s.turn + 2, text: draft.text, payload: draft.payload,
      options: [{ id: 'approve', label: 'לאשר' }, { id: 'decline', label: 'לדחות' }], defaultOptionId: 'decline',
    });
  }
}

const note = (title: string, status: Reaction['status'], quip: string): Reaction => ({ title, status, stats: [], groups: [], people: [], quip });

/** The PM's answer to a minister's request. */
export function resolveMinisterRequest(s: GameState, it: InboxItem, opt: string): Reaction {
  const m = it.fromId ? s.politicians[it.fromId] : undefined;
  if (!m) return note('הבקשה בוטלה', 'info', '');
  if (opt !== 'approve') {
    remember(s, m.id, 'ignored', 'דחית את בקשתי', -2);
    m.loyalty = clamp(m.loyalty - 1);
    return note('דחית את הבקשה', 'info', `${m.name} קיבל את ההחלטה, אבל זוכר אותה.`);
  }
  remember(s, m.id, 'favor', 'אישרת את בקשתי', 3);
  if (it.kind === 'mreq_strike') {
    const op = OPERATION_BY_ID[String(it.payload.opId)];
    const front = String(it.payload.front) as FrontId;
    s.flags[`op_${front}`] = s.turn;
    const o = executeOperation(s, op, front, (exp(m, 'defense') - 50) / 400);
    return { title: o.headline, status: o.success ? 'approved' : 'rejected', stats: [], groups: [], people: o.lines, quip: o.text, subtitle: `בקשת שר הביטחון, באישורך` };
  }
  if (it.kind === 'mreq_internal') {
    const o = INTERNAL_OPTIONS.find((x) => x.id === it.payload.optId)!;
    const police = s.budget.allocations.police / Math.max(0.1, s.budget.needs.police);
    const ok = rand(s) < clamp(o.base + (police - 1) * 0.35 + (exp(m, 'security') - 50) / 300, 0.2, 0.95);
    applyEffects(s, { ...(ok ? o.good : o.bad), ...(o.cost ? { budget: { police: o.cost } } : {}) });
    return note(ok ? `${o.title}: הצליח` : `${o.title}: נתקל בקשיים`, ok ? 'approved' : 'rejected', ok ? o.goodText : o.badText);
  }
  if (it.kind === 'mreq_foreign') {
    const c = String(it.payload.country);
    const e = exp(m, 'foreign');
    const r = it.payload.act === 'agreement' ? signAgreement(s, c, e) : it.payload.act === 'statement' ? statement(s, c) : visitCountry(s, c, e);
    return note(r.title, r.ok ? 'approved' : 'rejected', r.text);
  }
  if (it.kind === 'mreq_trade') {
    const c = String(it.payload.country);
    const e = exp(m, 'economy');
    const r = it.payload.act === 'deal' ? tradeDeal(s, c, e) : exportDrive(s, c);
    return note(r.title, r.ok ? 'approved' : 'rejected', r.text);
  }
  if (it.kind === 'mreq_project') {
    const p = startProject(s, String(it.payload.defId), m.id);
    if (p) { addNews(s, `${m.name} משיק את ${p.name}`, 'good', '🏗️'); logEvent(s, '🏗️', `אישרת את ${p.name}`, 2, 'good', 'projects'); }
    return note(p ? `${p.name} יוצא לדרך` : 'הפרויקט כבר בביצוע', p ? 'approved' : 'info', p ? `${m.name}: "תודה על האמון."` : '');
  }
  return note('אושר', 'approved', '');
}
