// When the player is the prime minister, the ministers ask for approval too: the defense minister proposes strikes, the national-security
// minister police operations, the foreign and economy ministers launch initiatives, and others ask to start projects.
// What they achieve depends on their expertise; the PM approves or declines.
import { INTERNAL_OPTIONS } from '../data/internalSecurity';
import { PROJECTS } from '../data/projects';
import { FRONTS, OPERATIONS, OPERATION_BY_ID, type FrontId } from '../data/security';
import type { GameState, InboxItem, Politician, Reaction } from '../types/game';
import { clamp, deficitPct } from '../utils';
import { addInbox } from './characters';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { FOREIGN_BY_ID, FOREIGN_LIST, foreignValue, hasPact, isContested, shiftForeign, signAgreement, statement, visitCountry } from './foreign';
import { startProject } from './projects';
import { chance, pick, rand } from './rng';
import { isPM } from './roles';
import { executeOperation, operationChance, world } from './security';
import { buildAfterAction, evaluatePlan, planFromParams, planToParams, proposalReport, proposeStrikePlan, savePlan } from './strikePlan';
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

interface Draft { fromId: string; kind: string; title: string; text: string; payload: Record<string, string | number>; approveLabel?: string; report?: InboxItem['report'] }

const hawk = (p: Politician) => p.ideology.security;

/** A request must make sense: it follows the situation, and says why now. */
function strikeRequest(s: GameState): Draft | null {
  const m = ministerOf(s, 'defense');
  if (!m) return null;
  if (hawk(m) < -0.2 && chance(s, 0.6)) return null; // a dovish minister asks less
  const w = world(s);
  const cands = FRONTS.filter((f) => {
    const st = w.fronts[f.id];
    if ((s.flags[`op_${f.id}`] ?? -9) >= s.turn - 1) return false; // something just happened there
    if (st.status === 'ceasefire' && st.threat < 60) return false; // the ceasefire is holding
    return st.threat >= 40 || st.status === 'fighting';
  }).sort((a, b) => w.fronts[b.id].threat - w.fronts[a.id].threat);
  if (!cands.length) return null;
  const front = cands[Math.min(cands.length - 1, Math.floor(rand(s) * 2))];
  const st = w.fronts[front.id];
  const fits = (o: (typeof OPERATIONS)[number]) => o.fronts.includes(front.id as FrontId) && (!o.needsCabinet || st.threat >= 65)
    && (o.id !== 'iran_strike' || (st.threat >= 75 && !s.flags.iran_strike_done)) && (o.id !== 'wide_ground' || st.status === 'fighting' || st.threat >= 80);
  const ops = OPERATIONS.filter(fits);
  if (!ops.length) return null;
  const op = pick(s, ops);
  const e = exp(m, 'defense');
  const skill = (e - 50) / 400;
  const why = st.status === 'ceasefire' ? `הפסקת האש בחזית ${front.name} לא מחזיקה: רמת האיום עלתה ל-${st.threat.toFixed(0)}.` : st.status === 'fighting' ? `בחזית ${front.name} נמשכת לחימה, ורמת האיום ${st.threat.toFixed(0)}.` : `רמת האיום בחזית ${front.name} עומדת על ${st.threat.toFixed(0)}.`;
  // a full proposal: a plan with a report. An operation that has no plan keeps the short request.
  const prop = proposeStrikePlan(s, op.id, front.id as FrontId, hawk(m), skill);
  if (prop) {
    return {
      fromId: m.id, kind: 'mreq_strike', title: `${m.name} מבקש לאשר: ${op.name} ב${front.name}`, payload: { ...planToParams(prop.plan), skill },
      text: `${why} "אני מבקש לאשר ${op.name} בחזית ${front.name}. מומחיות הביטחון שלי ${level(e)}. הדוח המלא מצורף."`,
      report: proposalReport(s, prop.plan, prop.ev),
    };
  }
  const p = operationChance(s, op, front.id as FrontId, skill);
  return {
    fromId: m.id, kind: 'mreq_strike', title: `${m.name} מבקש לאשר: ${op.name} ב${front.name}`, payload: { opId: op.id, front: front.id },
    text: `${why} "אני מבקש לאשר ${op.name} בחזית ${front.name}. רמת האיום בחזית: ${st.threat.toFixed(0)}. הערכת הסיכוי להצלחה: ${Math.round(p * 100)}%. מומחיות הביטחון שלי ${level(e)}."${op.needsCabinet ? ' (מבצע גדול: מחיר בנפגעים ובלחץ בינלאומי.)' : ''}`,
  };
}

function internalRequest(s: GameState): Draft | null {
  const m = ministerOf(s, 'national_security');
  if (!m) return null;
  const quality = s.services.security.quality;
  if (quality >= 72) return null; // internal security is fine: no reason to launch an operation
  const options = INTERNAL_OPTIONS.filter((x) => x.op && (s.flags[`mreq_opt_${x.id}`] ?? -9) < s.turn - 6);
  if (!options.length) return null;
  const o = pick(s, options);
  const e = exp(m, 'security');
  const police = s.budget.allocations.police / Math.max(0.1, s.budget.needs.police);
  const p = clamp(o.base + (police - 1) * 0.35 + (e - 50) / 300, 0.2, 0.95);
  return {
    fromId: m.id, kind: 'mreq_internal', title: `${m.name} מבקש לאשר: ${o.title}`, payload: { optId: o.id },
    text: `ביטחון הפנים במצב קשה: איכות השירות ${quality.toFixed(0)}.\n"${o.desc} אני מבקש אישור לצאת למבצע. הערכת הסיכוי להצלחה: ${Math.round(p * 100)}%. המומחיות שלי בתחום ${level(e)}."`,
  };
}

function foreignRequest(s: GameState): Draft | null {
  const m = ministerOf(s, 'foreign');
  if (!m) return null;
  const e = exp(m, 'foreign');
  const hawkish = hawk(m) > 0.2;
  const options = FOREIGN_LIST.filter((c) => c.id !== 'un').flatMap((c) => {
    const v = foreignValue(s, c.id);
    const out: { act: 'visit' | 'agreement' | 'statement'; id: string; name: string; v: number }[] = [];
    if (v >= 30 && !(isContested(c.id) && hawkish)) out.push({ act: 'visit', id: c.id, name: c.name, v });
    if (v >= 45 && !hasPact(s, c.id)) out.push({ act: 'agreement', id: c.id, name: c.name, v });
    if (v < 30 && isContested(c.id) && hawkish && c.id !== 'usa' && c.id !== 'eu') out.push({ act: 'statement', id: c.id, name: c.name, v });
    return out;
  });
  if (!options.length) return null;
  const o = pick(s, options);
  const what = o.act === 'visit' ? `ביקור רשמי ב${o.name}` : o.act === 'agreement' ? `הסכם שיתוף פעולה עם ${o.name}` : `הצהרה חריפה נגד ${o.name}`;
  const why = o.act === 'visit' ? `היחסים עם ${o.name} טובים (${o.v.toFixed(0)}) ואפשר לחזק אותם.` : o.act === 'agreement' ? `היחסים עם ${o.name} מבשילים להסכם (${o.v.toFixed(0)}).` : `היחסים עם ${o.name} הידרדרו (${o.v.toFixed(0)}).`;
  return {
    fromId: m.id, kind: 'mreq_foreign', title: `${m.name} מציע: ${what}`, payload: { act: o.act, country: o.id },
    text: `${why}\n"אני מציע ${what}. היחסים עם ${o.name} עומדים על ${o.v.toFixed(0)}. הניסיון שלי בדיפלומטיה ${level(e)}."`,
  };
}

function tradeRequest(s: GameState): Draft | null {
  const m = ministerOf(s, 'economy');
  if (!m) return null;
  const e = exp(m, 'economy');
  const t = tradeState(s);
  const options: { act: 'deal' | 'export'; id: string }[] = [];
  for (const id of Object.keys(TRADE_BASE)) {
    const v = foreignValue(s, id);
    const big = TRADE_BASE[id].ex >= 1;
    if (big && !t.deals.includes(id) && v >= 35) options.push({ act: 'deal', id });
    if (big && (t.boosts[id]?.until ?? -1) < s.turn && v >= 30) options.push({ act: 'export', id });
  }
  if (!options.length) return null;
  const o = pick(s, options);
  const name = FOREIGN_BY_ID[o.id]?.name ?? o.id;
  const share = Math.round((TRADE_BASE[o.id].ex / Object.values(TRADE_BASE).reduce((a, b) => a + b.ex, 0)) * 100);
  const what = o.act === 'deal' ? `הסכם סחר עם ${name}` : `מבצע ייצוא ל${name}`;
  return {
    fromId: m.id, kind: 'mreq_trade', title: `${m.name} מציע: ${what}`, payload: { act: o.act, country: o.id },
    text: `${name} מהווה כ-${share}% מהייצוא, והיחסים איתה טובים מספיק.\n"אני מציע ${what}. הסחר עם ${name} חשוב למשק. המומחיות שלי בכלכלה ${level(e)}."${o.act === 'export' ? ' (עלות ₪0.2 מיליארד.)' : ''}`,
  };
}

function projectRequest(s: GameState): Draft | null {
  const deficit = deficitPct(s);
  const cands: { m: Politician; d: (typeof PROJECTS)[number]; q: number }[] = [];
  for (const min of s.government.ministries) {
    const p = min.ministerId ? s.politicians[min.ministerId] : undefined;
    if (!p || !p.active || p.isPlayer || ['defense', 'foreign', 'economy', 'national_security'].includes(min.id)) continue;
    for (const d of PROJECTS) {
      if (!(min.origins ?? [min.id]).includes(d.ministry) || s.projects.some((x) => x.defId === d.id && x.status !== 'cancelled')) continue;
      const q = s.services[d.service]?.quality ?? 60;
      if (q >= 70 || d.cost >= 14) continue; // a service that works needs no project, and a huge one needs more than a request
      if (deficit > 5 && d.cost > 4) continue; // the deficit is high: only small projects
      cands.push({ m: p, d, q });
    }
  }
  if (!cands.length) return null;
  const { m, d, q } = pick(s, cands);
  return {
    fromId: m.id, kind: 'mreq_project', title: `${m.name} מבקש להשיק: ${d.name}`, payload: { defId: d.id },
    text: `איכות השירות במשרד שלו עומדת על ${q.toFixed(0)}. הפרויקט ישפר אותה.\n"אני מבקש אישור להשיק את הפרויקט ${d.name}. עלות ₪${d.cost} מיליארד, ${d.turns * 2} חודשים, שיפור איכות +${d.bonus}."`,
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
    if (draft.kind === 'mreq_internal') s.flags[`mreq_opt_${draft.payload.optId}`] = s.turn;
    addInbox(s, {
      kind: draft.kind, title: draft.title, fromId: draft.fromId, expiresTurn: s.turn + 2, text: draft.text, payload: draft.payload, report: draft.report,
      options: [{ id: 'approve', label: 'לאשר' }, ...(draft.kind === 'mreq_strike' && draft.payload.lead ? [{ id: 'save', label: 'לשמור לתכנון' }] : []), { id: 'decline', label: 'לדחות' }], defaultOptionId: 'decline',
    });
  }
}

const note = (title: string, status: Reaction['status'], quip: string): Reaction => ({ title, status, stats: [], groups: [], people: [], quip });

/** The PM's answer to a minister's request. */
export function resolveMinisterRequest(s: GameState, it: InboxItem, opt: string): Reaction {
  const m = it.fromId ? s.politicians[it.fromId] : undefined;
  if (!m) return note('הבקשה בוטלה', 'info', '');
  if (opt === 'save' && it.kind === 'mreq_strike') {
    const saved = planFromParams(it.payload);
    const ok = !!saved && savePlan(s, saved);
    return note(ok ? 'ההצעה נשמרה בתוכניות' : 'אי אפשר לשמור את ההצעה', 'info', ok ? `${m.name}: "אחכה להחלטתך." התוכנית ממתינה במסך הביטחון.` : '');
  }
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
    const plan = planFromParams(it.payload);
    const ev = plan ? evaluatePlan(s, plan) : null;
    const mods = ev?.ok ? { ...ev.mods, chance: clamp(ev.chance + Number(it.payload.skill ?? 0), 0.12, 0.92) } : undefined;
    const o = executeOperation(s, op, front, mods ? 0 : (exp(m, 'defense') - 50) / 400, mods);
    if (plan && ev?.ok) world(s).lastReport = buildAfterAction(s, plan, ev, o);
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
