// ============================================================
// Decision Engine. UI → performAction → ActionDef.run (draft) → Reaction.
// Every action changes the GameState; nothing is decorative.
// ============================================================
import { N } from './ai/narrative';
import { LAW_BY_ID } from '../data/laws';
import { MINISTRY_ACTIONS, type MinistryActionSpec } from '../data/ministryActions';
import { EXTRA_MINISTRY_ACTIONS, GENERIC_MINISTER_ACTIONS } from '../data/ministryActionsPlus';
import { WAR_ACTIONS, atWar } from '../data/warActions';
import { startCrisis } from './crises';
import { DOMAIN_NAMES } from '../data/ministries';
import { PROJECT_BY_ID } from '../data/projects';
import { PROMISE_BY_ID } from '../data/promises';
import {
  BUDGET_SENSITIVITY, CATEGORY_BY_ID, GROUPS, GROUP_BY_ID, MAJORITY, REGION_BY_ID, SERVICES, TAX_NAMES, TAX_SENSITIVITY,
} from '../data/world';
import { chance, pick, rand, randInt } from './rng';
import type {
  ActionResult, Bill, BudgetCategory, CampaignState, Domain, Effects, GameState, GroupId, Ideology, Ministry, Politician, Reaction, ReactionLine, Taxes,
} from '../types/game';
import { clamp, clone, deficitPct, newId, round1 } from '../utils';
import { aiPmDecides } from './aiGovernment';
import { setGameOver, setRole, syncRole } from './career';
import { randomCaricature } from './newGame';
import { addNews, applyEffects, logEvent, remember, scaleEffects } from './effects';
import { BUDGET_PREF, callEarlyElections } from './elections';
import { addMonths, daysBetween, electionDate, inCampaign, monthsUntilElection } from './calendar';
import { BUDGETS, STRATEGY_BY_ID, issueSalience, startCampaign } from './campaign';
import { TOPIC_BY_ID, VENUES, deliverSpeech, type Tone, type Venue } from './speech';
import { CHANNEL_BY_ID, FRONT_BY_ID, OPERATION_BY_ID, UNIT_BY_ID, type ChannelId, type FrontId, type UnitId } from '../data/security';
import { decisionReactions } from './reactions';
import { INTERNAL_BY_ID } from '../data/internalSecurity';
import { canUseInternalSecurity, cabinetVote, confidenceMeasure, executeOperation, mediatedCeasefire, normalization, openChannel, securityRole, transferArea, takeBackArea, unitTraining, type CbmKind } from './security';
import { assignMinister, createMinistry, getMinistry, mergeMinistries, removeMinistry } from './government';
import { ideologyDistance, partyStance, proposeBill, repealLaw, voteBudget } from './parliament';
import { coalitionSeats, computeShares, seatsFromShares } from './polls';
import { cancelProject, startProject } from './projects';
import { makePromise } from './promises';
import { allyHurt } from './alliances';
import { mergeParties, partyRelation, shiftPartyRelation } from './relations';
import { getCapabilities, isPM, isPartyLeader, lawAllowed, isSpeaker, playerMinistry } from './roles';

export type Params = Record<string, string | number>;
export type ActionCategory = 'economy' | 'government' | 'parliament' | 'ministry' | 'media' | 'party' | 'campaign' | 'career' | 'projects';

export interface RunResult {
  status?: Reaction['status'];
  title?: string;
  subtitle?: string;
  quip?: string;
  people?: ReactionLine[];
}

export interface ActionDef {
  id: string;
  title: string;
  icon: string;
  category: ActionCategory;
  level: 'simple' | 'medium' | 'major';
  description: string;
  domain?: Domain;
  capital?: number | ((s: GameState, p: Params) => number);
  cooldown?: number;
  /** reason why it can't be done now, or null */
  unavailable: (s: GameState, p: Params) => string | null;
  /** estimated effects, used for previews & meeting stances */
  estimate?: (s: GameState, p: Params) => Effects;
  run: (s: GameState, p: Params) => RunResult | void;
  /** does this (in this context) need a cabinet meeting first? */
  needsMeeting?: (s: GameState, p: Params) => boolean;
}

// ---------------- helpers ----------------
const me = (s: GameState) => s.politicians[s.player.politicianId];
const str = (p: Params, k: string) => String(p[k] ?? '');
const num = (p: Params, k: string) => Number(p[k] ?? 0);
/** "תור אחד" / "3 תורות" (a turn is 4 months, or 2 weeks during a campaign). */
export const turnsText = (n: number) => (n === 1 ? 'תור אחד' : `${n} תורות`);

/** Budget & tax changes automatically produce group reactions via the sensitivity matrices. */
export function deriveGroupEffects(s: GameState, e: Effects): Partial<Record<GroupId, number>> {
  const out: Partial<Record<GroupId, number>> = { ...(e.groups ?? {}) };
  const add = (g: GroupId, v: number) => { out[g] = (out[g] ?? 0) + v; };
  if (e.budget) for (const [c, d] of Object.entries(e.budget)) {
    const cat = c as BudgetCategory;
    const pct = ((d ?? 0) / Math.max(1, s.budget.allocations[cat])) * 10; // in units of 10%
    for (const [g, k] of Object.entries(BUDGET_SENSITIVITY[cat])) add(g as GroupId, clamp(pct * (k ?? 0), -8, 8));
  }
  if (e.taxes) for (const [t, d] of Object.entries(e.taxes)) {
    for (const [g, k] of Object.entries(TAX_SENSITIVITY[t as keyof Taxes])) add(g as GroupId, (d ?? 0) * (k ?? 0));
  }
  return out;
}

export function applyDecision(s: GameState, e: Effects): void {
  applyEffects(s, { ...e, groups: deriveGroupEffects(s, e) });
}

function ministryOf(s: GameState, p: Params): Ministry | undefined {
  return p.ministryId ? getMinistry(s, str(p, 'ministryId')) : playerMinistry(s);
}

/** The actions a ministry offers. Wartime actions are listed only while a war is on (pass the state), and are always found by id. */
export function ministryActionSpecs(m: Ministry, s?: GameState): MinistryActionSpec[] {
  const ids = m.origins ?? [m.id];
  const own = ids.flatMap((id) => [...(MINISTRY_ACTIONS[id] ?? []), ...(EXTRA_MINISTRY_ACTIONS[id] ?? [])]);
  const war = ids.flatMap((id) => WAR_ACTIONS[id] ?? []);
  // the prime minister holds the purse: he can't "pressure the PM for more budget"
  const generic = GENERIC_MINISTER_ACTIONS.filter((a) => !(s && isPM(s) && a.id === 'gen_pressure_pm'));
  return [...own, ...(s && !atWar(s) ? [] : war), ...generic];
}

/** A minister (not PM) asking for money must get the PM's approval. */
function needsPmApproval(s: GameState, e: Effects): number {
  if (isPM(s)) return 0;
  const add = Object.values(e.budget ?? {}).reduce((a, v) => a + Math.max(0, v ?? 0), 0);
  const taxes = Object.values(e.taxes ?? {}).reduce((a, v) => a + Math.abs(v ?? 0), 0) * 5;
  return add + taxes;
}

function pmApproval(s: GameState, amount: number, funding = 1): RunResult | null {
  const pm = s.politicians[s.government.pmId];
  const { approved } = aiPmDecides(s, amount, funding);
  if (approved) {
    return null;
  }
  remember(s, pm.id, 'ignored', 'ביקש כסף בתקופה קשה', -2);
  return {
    status: 'rejected', title: 'ראש הממשלה דחה את הבקשה',
    quip: `${pm.name}: "${pick(s, ['אין מקור תקציבי. צריך להתייעל במסגרת הקיימת.', 'לא בשלב הזה. הגירעון גבוה מדי.', 'נבחן את זה בתקציב הבא.'])}"`,
    people: [{ icon: '🪑', label: pm.name, text: 'דחה את הבקשה', tone: 'bad' }],
  };
}

/** Campaign spending has diminishing returns: the boost saturates around +22%. */
function addCampaign(s: GameState, partyId: string, amount: number): void {
  const cur = s.elections.campaignBoost[partyId] ?? 0;
  const add = amount > 0 ? amount * Math.max(0, 1 - cur / 22) : amount;
  s.elections.campaignBoost[partyId] = cur + add;
}

// ---------------- Action registry ----------------
const A: ActionDef[] = [];
const def = (a: ActionDef) => { A.push(a); return a; };

// ===== ECONOMY (PM) =====
def({
  id: 'set_tax', title: 'שינוי מס', icon: '🧾', category: 'economy', level: 'medium', domain: 'finance',
  description: 'העלאה או הורדה של מס. משנה את הכנסות המדינה ומשפיע על קבוצות שונות לפי סוג המס.',
  capital: (_s, p) => Math.round(Math.abs(num(p, 'delta')) * 5),
  unavailable: (s) => (getCapabilities(s).canSetTaxes ? null : 'רק ראש הממשלה קובע מסים'),
  estimate: (_s, p) => ({ taxes: { [str(p, 'tax')]: num(p, 'delta') } }),
  needsMeeting: (_s, p) => Math.abs(num(p, 'delta')) >= 2,
  run: (s, p) => {
    const tax = str(p, 'tax') as keyof Taxes;
    const d = num(p, 'delta');
    applyDecision(s, { taxes: { [tax]: d }, stability: d > 0 ? -2 : 0, partyMomentum: { [s.player.partyId]: d > 0 ? -1.5 * d : 1 * -d } });
    addNews(s, d > 0 ? `הממשלה מעלה את ה${TAX_NAMES[tax]} ב-${d}%` : `הורדת ${TAX_NAMES[tax]}: ${Math.abs(d)}% פחות`, d > 0 ? 'bad' : 'good', '🧾');
    return { title: `${TAX_NAMES[tax]} ${d > 0 ? '+' : ''}${d}%`, quip: d > 0 ? 'ההכנסות יעלו, אבל הציבור ירגיש את זה בכיס.' : 'הציבור ירוויח, אבל ההכנסות יירדו והגירעון יגדל.' };
  },
});

def({
  id: 'adjust_budget', title: 'שינוי תקציב', icon: '💰', category: 'economy', level: 'medium',
  description: 'הוספה או קיצוץ בסעיף תקציבי. משפיע על איכות השירות, על השר האחראי ועל הקבוצות שנשענות עליו.',
  capital: (_s, p) => (Math.abs(num(p, 'delta')) >= 3 ? 4 : 2),
  unavailable: (s) => (getCapabilities(s).canManageBudget ? null : 'רק ראש הממשלה מחלק את התקציב'),
  estimate: (_s, p) => ({ budget: { [str(p, 'category')]: num(p, 'delta') } }),
  needsMeeting: (s, p) => Math.abs(num(p, 'delta')) >= s.budget.allocations[str(p, 'category') as BudgetCategory] * 0.1,
  run: (s, p) => {
    const cat = str(p, 'category') as BudgetCategory;
    const d = num(p, 'delta');
    applyDecision(s, { budget: { [cat]: d } });
    const m = s.government.ministries.find((x) => x.categories.includes(cat));
    const people: ReactionLine[] = [];
    if (m?.ministerId && m.ministerId !== s.player.politicianId) {
      const min = s.politicians[m.ministerId];
      min.loyalty = clamp(min.loyalty + (d > 0 ? 4 : -6));
      if (d < 0) remember(s, min.id, 'insult', `קיצצת לו ₪${Math.abs(d)}B`, -6);
      people.push({ icon: '👔', label: min.name, text: N.ministerComment(s, min, d > 0 ? 0.6 : -0.6, Math.abs(d)), tone: d > 0 ? 'good' : 'bad' });
    }
    if (d > 0) s.career.moneyInvested += d;
    addNews(s, d > 0 ? `תוספת של ₪${round1(d)}B ל${CATEGORY_BY_ID[cat].name}` : `קיצוץ של ₪${round1(-d)}B ב${CATEGORY_BY_ID[cat].name}`, d > 0 ? 'good' : 'bad', CATEGORY_BY_ID[cat].icon);
    return { title: `${CATEGORY_BY_ID[cat].name}: ${d > 0 ? '+' : ''}₪${round1(d)} מיליארד`, people };
  },
});

def({
  id: 'stimulus', title: 'חבילת גירוי כלכלי', icon: '🚀', category: 'economy', level: 'major', domain: 'economy',
  description: '₪8 מיליארד חד-פעמיים להאצת הצמיחה ולהורדת האבטלה. מגדיל את החוב ועלול להעלות את האינפלציה.', capital: 8, cooldown: 3,
  unavailable: (s) => (getCapabilities(s).canManageBudget ? null : 'רק ראש הממשלה'),
  estimate: () => ({ oneOffCost: 8, economy: { growth: 0.8, unemployment: -0.4, inflation: 0.3 }, groups: { selfEmployed: 3, employees: 2, highIncome: 1 } }),
  needsMeeting: () => true,
  run: (s, p) => {
    const k = num(p, 'scale') || 1;
    applyDecision(s, scaleEffects({ oneOffCost: 8, economy: { growth: 0.8, unemployment: -0.4, inflation: 0.3 }, groups: { selfEmployed: 3, employees: 2, highIncome: 1 } }, k));
    s.career.moneyInvested += 8 * k;
    addNews(s, `הממשלה משיקה חבילת גירוי של ₪${8 * k} מיליארד`, 'neutral', '🚀');
  },
});

def({
  id: 'austerity', title: 'תוכנית צנע', icon: '✂️', category: 'economy', level: 'major', domain: 'finance',
  description: 'קיצוץ רוחבי של 3% בכל המשרדים האזרחיים (הביטחון לא נכלל). מקטין את הגירעון ופוגע בשירותים ובעובדי המדינה.', capital: 10, cooldown: 4,
  unavailable: (s) => (getCapabilities(s).canManageBudget ? null : 'רק ראש הממשלה'),
  estimate: (s) => ({ budget: Object.fromEntries((['education', 'health', 'welfare', 'transport', 'housing', 'infrastructure', 'government', 'culture', 'science'] as BudgetCategory[]).map((c) => [c, -s.budget.allocations[c] * 0.03])) }),
  needsMeeting: () => true,
  run: (s, p) => {
    const k = num(p, 'scale') || 1;
    const cats: BudgetCategory[] = ['education', 'health', 'welfare', 'transport', 'housing', 'infrastructure', 'government', 'culture', 'science'];
    applyDecision(s, { budget: Object.fromEntries(cats.map((c) => [c, -s.budget.allocations[c] * 0.03 * k])), groups: { publicSector: -4 * k } });
    for (const m of s.government.ministries) {
      if (m.ministerId && m.ministerId !== s.player.politicianId && m.categories.some((c) => cats.includes(c))) {
        remember(s, m.ministerId, 'insult', 'תוכנית הצנע קיצצה לו', -5);
      }
    }
    addNews(s, 'תוכנית צנע: הממשלה מקצצת 3% בכל המשרדים האזרחיים', 'bad', '✂️');
  },
});

def({
  id: 'tax_enforcement', title: 'מבצע אכיפת מס', icon: '🔍', category: 'economy', level: 'simple', domain: 'finance',
  description: 'תגבור רשות המסים נגד העלמות והון שחור. מכניס כ-₪5 מיליארד; העצמאים והמגזר העסקי לא מרוצים.', capital: 4, cooldown: 2,
  unavailable: (s) => (getCapabilities(s).canManageBudget ? null : 'רק ראש הממשלה'),
  estimate: () => ({ revenue: 5, groups: { selfEmployed: -4, highIncome: -2, lowIncome: 1 } }),
  run: (s) => { applyDecision(s, { revenue: 5, groups: { selfEmployed: -4, highIncome: -2, lowIncome: 1 } }); },
});

def({
  id: 'submit_budget', title: 'הגשת התקציב לכנסטון', icon: '📒', category: 'economy', level: 'medium',
  description: 'הצבעה על תקציב המדינה. אם התקציב נופל, הכנסטון מתפזר והולכים לבחירות.', capital: 3,
  unavailable: (s) => (!isPM(s) ? 'רק ראש הממשלה' : s.government.caretaker ? 'ממשלת מעבר לא מגישה תקציב' : s.budget.passed ? 'התקציב השנתי כבר אושר' : null),
  run: (s) => {
    const v = voteBudget(s);
    s.budget.passed = true;
    s.inbox = s.inbox.filter((i) => i.kind !== 'budget_review');
    if (v.passed) {
      addNews(s, `תקציב ${s.budget.fiscalYear} אושר (${v.for}-${v.against})`, 'good', '📒');
      logEvent(s, '📒', 'התקציב עבר', 2, 'good', 'budget');
      return { title: `התקציב אושר (${v.for}-${v.against})`, status: 'approved' };
    }
    callEarlyElections(s, 'התקציב נפל');
    return { title: `התקציב נפל (${v.for}-${v.against})`, status: 'rejected', quip: 'לפי החוק, הכנסטון מתפזר והבחירות יתקיימו בתוך כ-90 יום.' };
  },
});

// ===== GOVERNMENT (PM) =====
def({
  id: 'appoint_minister', title: 'מינוי שר', icon: '🤝', category: 'government', level: 'simple', capital: 3,
  description: 'מינוי חבר קואליציה לתיק. מינוי מתיק ששויך בהסכם למפלגה אחרת פוגע ביציבות הקואליציה.',
  unavailable: (s, p) => {
    if (!getCapabilities(s).canManageGovernment) return 'רק ראש הממשלה ממנה שרים';
    const pol = s.politicians[str(p, 'politicianId')];
    if (!pol || !s.government.coalition.includes(pol.partyId)) return 'אפשר למנות רק חברי קואליציה';
    return null;
  },
  run: (s, p) => {
    const m = getMinistry(s, str(p, 'ministryId'))!;
    const pol = s.politicians[str(p, 'politicianId')];
    const people: ReactionLine[] = [];
    const prev = m.ministerId && m.ministerId !== s.government.pmId ? s.politicians[m.ministerId] : null;
    if (prev && prev.id !== pol.id) {
      remember(s, prev.id, 'fired', `הוחלף ב${m.name}`, -20);
      people.push({ icon: '😠', label: prev.name, text: pick(s, ['אני מצטער על ההחלטה. היא לא עניינית.', 'אמשיך לשרת את הציבור מכל תפקיד.', 'ההחלטה מאכזבת.']), tone: 'bad' });
    }
    assignMinister(s, m.id, pol.id);
    remember(s, pol.id, 'appointed', `מונה ל${m.name}`, 15);
    people.push({ icon: '🙂', label: pol.name, text: pick(s, ['אני מודה על האמון ואפעל לטובת כלל הציבור.', 'זו אחריות גדולה. ניגש לעבודה כבר מחר.', 'אני מכיר את התחום ואדע לקדם אותו.']), tone: 'good' });
    if (m.agreementPartyId && m.agreementPartyId !== pol.partyId && s.government.coalition.includes(m.agreementPartyId)) {
      const lead = s.parties[m.agreementPartyId].leaderId;
      remember(s, lead, 'betrayal', `לקחת להם את ${m.name}`, -18);
      applyEffects(s, { stability: -6 });
      people.push({ icon: '⚠️', label: s.parties[m.agreementPartyId].name, text: 'זו הפרה של ההסכם הקואליציוני.', tone: 'bad' });
      m.agreementPartyId = pol.partyId;
    }
    addNews(s, `${pol.name} מונה ל${m.name}`, 'neutral', '🤝');
    return { title: `${pol.name} – ${m.name}`, people };
  },
});

def({
  id: 'fire_minister', title: 'פיטורי שר', icon: '📤', category: 'government', level: 'medium', capital: 5,
  description: 'העברת שר מתפקידו. התיק עובר לראש הממשלה. השר ומפלגתו יזכרו את זה.',
  unavailable: (s, p) => {
    if (!getCapabilities(s).canManageGovernment) return 'רק ראש הממשלה';
    const m = getMinistry(s, str(p, 'ministryId'));
    if (!m?.ministerId || m.ministerId === s.player.politicianId) return 'אין שר לפטר';
    return null;
  },
  run: (s, p) => {
    const m = getMinistry(s, str(p, 'ministryId'))!;
    const min = s.politicians[m.ministerId!];
    min.ministryId = null;
    m.ministerId = s.government.pmId;
    remember(s, min.id, 'fired', `פוטר מ${m.name}`, -30);
    const lead = s.parties[min.partyId].leaderId;
    if (lead !== min.id) remember(s, lead, 'insult', `פיטרת את ${min.name} שלנו`, -8);
    applyEffects(s, { stability: min.partyId !== s.player.partyId ? -5 : -1, playerPopularity: min.popularity < 30 ? 2 : -1 });
    addNews(s, `${min.name} הועבר מתפקידו כ${m.name.replace('משרד ה', 'שר ה')}`, 'neutral', '📤');
    logEvent(s, '📤', `פיטרת את ${min.name}`, 2, 'neutral', 'government');
    return { title: `${min.name} פוטר`, people: [{ icon: '😠', label: min.name, text: pick(s, ['זו החלטה פוליטית ולא מקצועית.', 'למדתי על כך מהתקשורת. זה לא ראוי.', 'אשקול את צעדיי הבאים.']), tone: 'bad' }] };
  },
});

def({
  id: 'merge_ministries', title: 'איחוד משרדים', icon: '🧩', category: 'government', level: 'medium', capital: 8,
  description: 'מאחד שני משרדים לאחד. חוסך בהוצאות המנהלה; בטווח הקצר פוגע ביעילות ובעובדים.',
  unavailable: (s, p) => (!getCapabilities(s).canManageGovernment ? 'רק ראש הממשלה' : str(p, 'a') === str(p, 'b') ? 'בחר שני משרדים שונים' : null),
  run: (s, p) => {
    const merged = mergeMinistries(s, str(p, 'a'), str(p, 'b'));
    if (!merged) return { status: 'rejected', title: 'האיחוד נכשל' };
    applyDecision(s, { budget: { government: -0.4 }, groups: { center: 1, publicSector: -2 } });
    addNews(s, `הממשלה אישרה את הקמת ${merged.name}`, 'neutral', '🧩');
    return { title: `נוצר: ${merged.name}`, quip: 'בטווח הקצר תהיה פגיעה ביעילות; בטווח הארוך צפוי חיסכון.' };
  },
});

def({
  id: 'create_ministry', title: 'הקמת משרד', icon: '🏛️', category: 'government', level: 'simple', capital: 4,
  description: 'הקמת משרד ממשלתי חדש (מבין משרדים שהיו בעבר). מאפשר תיק נוסף לשותף קואליציוני; עולה בהוצאות מנהלה.',
  unavailable: (s) => (getCapabilities(s).canManageGovernment ? null : 'רק ראש הממשלה'),
  run: (s, p) => {
    const m = createMinistry(s, str(p, 'templateId'));
    if (!m) return { status: 'rejected', title: 'המשרד כבר קיים' };
    applyDecision(s, { groups: { center: -1.5, selfEmployed: -1, publicSector: 1 } });
    addNews(s, `הוקם ${m.name}`, 'neutral', m.icon);
    return { title: `הוקם ${m.name}`, quip: 'עכשיו צריך למנות לו שר.' };
  },
});

def({
  id: 'remove_ministry', title: 'סגירת משרד', icon: '🗑️', category: 'government', level: 'simple', capital: 4,
  description: 'סגירת משרד שאינו מנהל שירות או תקציב. חוסך בהוצאות מנהלה; השר מאבד את תיקו.',
  unavailable: (s, p) => {
    if (!getCapabilities(s).canManageGovernment) return 'רק ראש הממשלה';
    const m = getMinistry(s, str(p, 'ministryId'));
    return m && !m.services.length && !m.categories.length && m.id !== 'finance' ? null : 'אי אפשר לסגור משרד שמנהל שירותים';
  },
  run: (s, p) => {
    const m = getMinistry(s, str(p, 'ministryId'))!;
    removeMinistry(s, m.id);
    applyDecision(s, { groups: { center: 1.5, selfEmployed: 1 } });
    addNews(s, `${m.name} נסגר; תחומי האחריות הועברו למשרדים אחרים`, 'neutral', '🗑️');
    return { title: `${m.name} נסגר` };
  },
});

def({
  id: 'coalition_gift', title: 'כספים קואליציוניים', icon: '🎁', category: 'government', level: 'simple', capital: 0, cooldown: 2,
  description: '₪1.5 מיליארד לנושאים שהשותפה דורשת. מחזק את היציבות והנאמנות; פוגע בתדמית ובאמון הציבור.',
  unavailable: (s, p) => (!isPM(s) ? 'רק ראש הממשלה' : !s.government.coalition.includes(str(p, 'partyId')) || str(p, 'partyId') === s.player.partyId ? 'בחר שותפה קואליציונית' : null),
  run: (s, p) => {
    const party = s.parties[str(p, 'partyId')];
    const cat = BUDGET_PREF[party.id] ?? 'welfare';
    applyDecision(s, { budget: { [cat]: 1.5 }, groups: { center: -1.5, secular: ['shas', 'utj'].includes(party.id) ? -2 : 0 }, stability: 5 });
    remember(s, party.leaderId, 'favor', 'כספים קואליציוניים', 14);
    addNews(s, `₪1.5 מיליארד כספים קואליציוניים ל${party.name}`, 'bad', '🎁');
    return { title: `${party.name} קיבלה ₪1.5 מיליארד`, people: [{ icon: party.logo, label: s.politicians[party.leaderId]?.name ?? party.name, text: 'זה מה שסוכם. נמשיך לתמוך בממשלה.', tone: 'good' }] };
  },
});

def({
  id: 'early_elections', title: 'הקדמת בחירות', icon: '🗳️', category: 'government', level: 'major', capital: 0,
  description: 'פיזור הכנסטון. הבחירות יתקיימו בתוך כ-90 יום, ועד אז הממשלה היא ממשלת מעבר.',
  unavailable: (s) => (!isPM(s) ? 'רק ראש הממשלה' : monthsUntilElection(s) <= 6 ? 'הבחירות כבר קרובות' : null),
  run: (s) => { callEarlyElections(s, 'ראש הממשלה פיזר את הכנסטון'); return { title: 'הכנסטון התפזר', quip: 'הבחירות בעוד כ-3 חודשים. עכשיו הכול תלוי בקמפיין.' }; },
});

// ===== PARLIAMENT =====
def({
  id: 'propose_law', title: 'הגשת הצעת חוק', icon: '📝', category: 'parliament', level: 'medium',
  description: 'הגשת חוק לכנסטון. הצעה ממשלתית עוברת ישר לוועדה; הצעה פרטית מתחילה בקריאה טרומית. כדי לעבור צריך רוב.',
  capital: (s) => (isPM(s) ? 4 : 6), cooldown: 1,
  unavailable: (s, p) => {
    const lawId = str(p, 'lawId');
    if (!LAW_BY_ID[lawId]) return 'חוק לא קיים';
    if (s.activeLaws.includes(lawId)) return 'החוק כבר בתוקף';
    if (s.bills.some((b) => b.lawId === lawId && b.status === 'active')) return 'כבר בדיון בכנסטון';
    if (!lawAllowed(s, LAW_BY_ID[lawId])) return 'לא בתחום האחריות של המשרד שלך';
    if (s.government.caretaker && s.elections.phase === 'none') return 'הכנסטון התפזר – אין חקיקה עד אחרי הבחירות';
    return null;
  },
  needsMeeting: (s, p) => isPM(s) && LAW_BY_ID[str(p, 'lawId')]?.level === 'major',
  run: (s, p) => {
    const law = LAW_BY_ID[str(p, 'lawId')];
    let gov = isPM(s);
    const people: ReactionLine[] = [];
    if (s.player.role === 'minister' && law.domain === playerMinistry(s)?.domain) {
      const ok = chance(s, clamp(0.3 + (s.politicians[s.government.pmId].loyalty - 50) / 100 + 0.2, 0.1, 0.85));
      gov = ok;
      people.push({ icon: '🪑', label: 'ראש הממשלה', text: ok ? 'מאשר כהצעה ממשלתית.' : 'לא כהצעה ממשלתית. אפשר להגיש כהצעה פרטית.', tone: ok ? 'good' : 'bad' });
    }
    const bill = proposeBill(s, law.id, s.player.politicianId, gov, num(p, 'scale') === 0.5);
    if (!bill) return { status: 'rejected', title: 'לא ניתן להגיש' };
    if (s.flags.mutual_push) { bill.push += s.flags.mutual_push; s.flags.mutual_push = 0; }
    applyEffects(s, { playerPopularity: 1, playerReputation: 1 });
    addNews(s, `${me(s).name} מגיש: ${law.title}`, 'neutral', law.icon);
    return { title: `הוגש: ${law.title}`, subtitle: gov ? 'הצעה ממשלתית — עוברת ישר לוועדה' : 'הצעה פרטית — קריאה טרומית בתור הבא', status: 'pending', people };
  },
});

def({
  id: 'repeal_law', title: 'ביטול חוק', icon: '🧨', category: 'parliament', level: 'major', capital: 10, cooldown: 2,
  description: 'ביטול חוק קיים. צריך רוב בכנסטון; המפלגות שקידמו את החוק יראו בזה בגידה.',
  unavailable: (s, p) => (!isPM(s) ? 'רק ראש הממשלה יכול לבטל חוק' : !s.activeLaws.includes(str(p, 'lawId')) ? 'החוק לא בתוקף' : null),
  needsMeeting: () => true,
  run: (s, p) => {
    const law = LAW_BY_ID[str(p, 'lawId')];
    const bill: Bill = { id: 'repeal', lawId: law.id, title: law.title, sponsorId: s.player.politicianId, isGovernment: true, stage: 'final', turnsInStage: 0, proposedTurn: s.turn, status: 'active', push: 0, modified: false };
    let against = 0;
    for (const party of Object.values(s.parties)) {
      const st = partyStance(s, party, bill);
      const inGov = s.government.coalition.includes(party.id);
      if (party.favoriteLaws.includes(law.id) || (!inGov && st > 0.3)) against += party.seats;
    }
    if (against >= MAJORITY) {
      return { status: 'rejected', title: `הכנסטון סירב לבטל את ${law.title}`, subtitle: `${against} התנגדו` };
    }
    repealLaw(s, law);
    allyHurt(s, law.id);
    for (const pid of Object.keys(s.parties)) if (s.parties[pid].favoriteLaws.includes(law.id)) remember(s, s.parties[pid].leaderId, 'betrayal', `ביטלת את ${law.title}`, -15);
    addNews(s, `הכנסטון ביטל את ${law.title}`, 'neutral', '🧨');
    logEvent(s, '🧨', `ביטלת את ${law.title}`, 2, 'neutral', 'law');
    return { title: `בוטל: ${law.title}`, subtitle: `${120 - against} תמכו בביטול` };
  },
});

def({
  id: 'push_bill', title: 'גיוס תמיכה להצעה', icon: '📣', category: 'parliament', level: 'simple', capital: 8,
  description: 'שיחות עם ח״כים ועם ראשי סיעות כדי להגדיל את התמיכה בהצעה (+25 לסיכויי המעבר).',
  unavailable: (s, p) => (s.bills.find((b) => b.id === str(p, 'billId') && b.status === 'active') ? null : 'ההצעה לא פעילה'),
  run: (s, p) => {
    const b = s.bills.find((x) => x.id === str(p, 'billId'))!;
    b.push = Math.min(80, b.push + 25);
    return { title: `התמיכה ב"${b.title}" עולה`, quip: 'ח״כים מתנדנדים קיבלו הסברים והבטחות לתיאום בהמשך.' };
  },
});

def({
  id: 'soften_bill', title: 'ריכוך הצעה', icon: '🧈', category: 'parliament', level: 'simple', capital: 2,
  description: 'גרסה מתונה של החוק: יותר תמיכה, פחות השפעה.',
  unavailable: (s, p) => {
    const b = s.bills.find((x) => x.id === str(p, 'billId') && x.status === 'active');
    if (!b) return 'ההצעה לא פעילה';
    if (b.modified) return 'ההצעה כבר רוככה';
    return b.sponsorId === s.player.politicianId || (b.isGovernment && isPM(s)) ? null : 'רק היוזם יכול לרכך';
  },
  run: (s, p) => {
    const b = s.bills.find((x) => x.id === str(p, 'billId'))!;
    b.modified = true;
    return { title: `"${b.title}" רוכך`, quip: 'הגרסה המתונה מגדילה את הסיכוי לרוב, אבל ההשפעה של החוק קטנה.' };
  },
});

def({
  id: 'vote_bill', title: 'הצבעה במליאה', icon: '🗳️', category: 'parliament', level: 'simple', capital: 0,
  description: 'ההצבעה שלך על הצעת חוק. הצבעה נגד קו המפלגה פוגעת ביחסים עם המנהיג.',
  unavailable: (s, p) => (!s.bills.find((b) => b.id === str(p, 'billId') && b.status === 'active') ? 'ההצעה לא פעילה' : (s.flags[`voted_${str(p, 'billId')}`] ?? -1) >= s.turn ? 'כבר הצבעת על ההצעה הזו בתור הזה' : null),
  run: (s, p) => {
    const b = s.bills.find((x) => x.id === str(p, 'billId'))!;
    s.flags[`voted_${b.id}`] = s.turn;
    const forIt = str(p, 'vote') === 'for';
    b.push = Math.max(-60, Math.min(60, b.push + (forIt ? 4 : -4)));
    const party = s.parties[s.player.partyId];
    const partyFor = party.favoriteLaws.includes(b.lawId) || (b.isGovernment && s.government.coalition.includes(party.id));
    const leader = s.politicians[party.leaderId];
    const people: ReactionLine[] = [];
    if (!forIt) allyHurt(s, b.lawId);
    if (leader && !leader.isPlayer && forIt !== partyFor) {
      remember(s, leader.id, 'betrayal', `הצביע נגד הקו ב${b.title}`, -10);
      applyEffects(s, { playerPopularity: 2, playerReputation: 1 });
      people.push({ icon: '😤', label: leader.name, text: 'הצבעה נגד עמדת הסיעה. נדבר על זה.', tone: 'bad' });
    } else if (leader && !leader.isPlayer) {
      leader.loyalty = clamp(leader.loyalty + 2);
    }
    return { title: `הצבעת ${forIt ? 'בעד' : 'נגד'} ${b.title}`, people };
  },
});

def({
  id: 'no_confidence', title: 'הצעת אי-אמון', icon: '⚔️', category: 'parliament', level: 'major', capital: 15, cooldown: 3,
  description: 'ניסיון להפיל את הממשלה. מצליח רק אם יש רוב נגדה ושותפים בקואליציה מוכנים לערוק.',
  unavailable: (s) => (s.government.coalition.includes(s.player.partyId) ? 'אתה בקואליציה' : !isPartyLeader(s) ? 'רק מנהיג מפלגה' : null),
  run: (s) => {
    const seats = coalitionSeats(s);
    const defectors = s.government.coalition.filter((id) => {
      const l = s.politicians[s.parties[id].leaderId];
      return l && id !== s.politicians[s.government.pmId].partyId && (l.relationships[s.government.pmId] ?? 0) < -10 && rand(s) < 0.5;
    }).reduce((a, id) => a + s.parties[id].seats, 0);
    const govVotes = seats - defectors;
    if (govVotes < MAJORITY && s.government.approval < 45) {
      callEarlyElections(s, 'הממשלה הפסידה בהצבעת אי-אמון');
      applyEffects(s, { partyMomentum: { [s.player.partyId]: 6 }, playerPopularity: 5 });
      s.career.memorable.push('הפיל את הממשלה בהצבעת אי-אמון');
      return { title: 'הממשלה נפלה', status: 'approved', quip: 'הכנסטון מתפזר. עכשיו צריך לנצח בבחירות.' };
    }
    applyEffects(s, { partyMomentum: { [s.player.partyId]: -2 } });
    return { title: `אי-האמון נכשל (${govVotes} נגד)`, status: 'rejected', quip: 'הקואליציה שמרה על רוב.' };
  },
});

// ===== PROJECTS =====
def({
  id: 'start_project', title: 'השקת פרויקט', icon: '🏗️', category: 'projects', level: 'medium',
  description: 'פרויקט לאומי: עולה כסף לאורך זמן ומשפר שירות ואזור כשהוא מסתיים.', capital: 3,
  unavailable: (s, p) => {
    const d = PROJECT_BY_ID[str(p, 'defId')];
    if (!d) return 'פרויקט לא קיים';
    if (s.projects.some((x) => x.defId === d.id && x.status === 'active')) return 'כבר בביצוע';
    if (isPM(s)) return null;
    const held = s.government.ministries.filter((x) => x.ministerId === s.player.politicianId);
    if (s.player.role !== 'minister' || !held.length) return 'רק ראש הממשלה או השר האחראי';
    return held.some((x) => (x.origins ?? [x.id]).includes(d.ministry)) ? null : 'הפרויקט לא באחריות המשרד שלך';
  },
  needsMeeting: (s, p) => isPM(s) && (PROJECT_BY_ID[str(p, 'defId')]?.cost ?? 0) >= 10,
  run: (s, p) => {
    const d = PROJECT_BY_ID[str(p, 'defId')];
    if (!isPM(s)) {
      const rej = pmApproval(s, d.cost / d.turns * 6);
      if (rej) return rej;
    }
    startProject(s, d.id, s.player.politicianId);
    applyDecision(s, { groups: scaleEffects({ groups: d.groups }, 0.4).groups, regionInvestment: { [d.region]: 5 } });
    return { title: `יוצא לדרך: ${d.name}`, subtitle: `₪${d.cost}B · ${d.turns * 2} חודשים · ${REGION_BY_ID[d.region].name}`, quip: d.note };
  },
});

def({
  id: 'cancel_project', title: 'ביטול פרויקט', icon: '🛑', category: 'projects', level: 'simple', capital: 4,
  description: 'עצירת פרויקט שבביצוע. חוסך את יתרת העלות ופוגע באזור ובמי שיזם אותו.',
  unavailable: (s) => (getCapabilities(s).canStartProjects ? null : 'אין לך סמכות'),
  run: (s, p) => {
    const prj = s.projects.find((x) => x.id === str(p, 'projectId') && x.status === 'active');
    if (!prj || !cancelProject(s, prj.id)) return { status: 'rejected', title: 'לא נמצא' };
    applyDecision(s, { regionInvestment: { [prj.region]: -10 }, groups: { periphery: -2 } });
    if (prj.sponsorId !== s.player.politicianId) remember(s, prj.sponsorId, 'insult', `ביטלת את ${prj.name}`, -10);
    addNews(s, `בוטל: ${prj.name}. התושבים מאוכזבים`, 'bad', '🛑');
    return { title: `${prj.name} בוטל` };
  },
});

// ===== MINISTRY (minister, or PM instructing) =====
def({
  id: 'ministry_action', title: 'פעולת משרד', icon: '🏛️', category: 'ministry', level: 'medium',
  description: 'פעולה ייעודית של המשרד.',
  capital: (s, p) => {
    const m = ministryOf(s, p);
    const spec = m && ministryActionSpecs(m).find((x) => x.id === str(p, 'actionId'));
    return (spec?.capital ?? 3) + (isPM(s) && m?.ministerId !== s.player.politicianId ? 2 : 0);
  },
  unavailable: (s, p) => {
    const m = ministryOf(s, p);
    if (!m) return 'אין משרד';
    if (!isPM(s) && m.ministerId !== s.player.politicianId) return 'זה לא המשרד שלך';
    const spec = ministryActionSpecs(m).find((x) => x.id === str(p, 'actionId'));
    if (!spec) return 'פעולה לא קיימת';
    if (spec.cat === 'war' && !atWar(s)) return 'פעולה זמינה רק בשעת מלחמה';
    if ((s.player.actionCooldowns[`m_${spec.id}`] ?? 0) > s.turn) return `זמין שוב בעוד ${turnsText(s.player.actionCooldowns[`m_${spec.id}`] - s.turn)}`;
    return null;
  },
  estimate: (s, p) => {
    const m = ministryOf(s, p);
    return m ? ministryActionSpecs(m).find((x) => x.id === str(p, 'actionId'))?.effects(s) ?? {} : {};
  },
  run: (s, p) => {
    const m = ministryOf(s, p)!;
    const spec = ministryActionSpecs(m).find((x) => x.id === str(p, 'actionId'))!;
    s.player.actionCooldowns[`m_${spec.id}`] = s.turn + spec.cooldown;
    const eff = spec.effects(s, m);
    const people: ReactionLine[] = [];
    const pm = s.politicians[s.government.pmId];
    let ask = 0;
    if (spec.rogue && !isPM(s)) {
      // acting without the PM: it happens, but the PM and the coalition remember
      remember(s, pm.id, 'betrayal', `פעל על דעת עצמו: ${spec.title}`, -18);
      applyEffects(s, { stability: -5, playerReputation: -2, playerPopularity: 2 });
      people.push({ icon: '😠', label: pm.name, text: pick(s, ['הצעד לא תואם איתי ולא אושר בממשלה.', 'זו פעולה בניגוד לעקרון האחריות המשותפת.', 'אני שוקל את המשך כהונתך בממשלה.']), tone: 'bad' });
    } else {
      ask = needsPmApproval(s, eff);
      // a ministry funded at 100% of its need pays for its own actions: no PM approval, no deficit excuse
      const cat = m.categories[0];
      const funding = cat ? s.budget.allocations[cat] / Math.max(0.1, s.budget.needs[cat]) : 1;
      if (funding >= 1) ask = 0;
      if (ask > 0) {
        const rej = pmApproval(s, ask, funding);
        if (rej) return rej;
        people.push({ icon: '🪑', label: pm.name, text: 'אושר, במסגרת התקציב הקיים.', tone: 'good' });
      }
    }
    applyDecision(s, eff);
    spec.mutate?.(s, m);
    if (spec.metric) s.services[spec.metric.service as keyof GameState['services']].metrics[spec.metric.key] = (s.services[spec.metric.service as keyof GameState['services']].metrics[spec.metric.key] ?? 0) + spec.metric.amount;
    if (!isPM(s)) applyEffects(s, { playerReputation: 1, playerPopularity: 1 });
    let quip = spec.note;
    let status: RunResult['status'] = 'approved';
    // random outcomes: the same action can go very differently
    if (spec.outcomes?.length) {
      const total = spec.outcomes.reduce((a, o) => a + o.w, 0);
      let r = rand(s) * total;
      const o = spec.outcomes.find((x) => (r -= x.w) <= 0) ?? spec.outcomes[0];
      const oe = typeof o.effects === 'function' ? o.effects(s, m) : o.effects;
      if (oe) applyDecision(s, oe);
      if (o.crisis && !s.crises.some((c) => c.defId === o.crisis)) startCrisis(s, o.crisis);
      if (o.headline) addNews(s, o.headline, o.tone === 'good' ? 'good' : o.tone === 'bad' ? 'bad' : 'neutral', spec.icon);
      quip = o.text;
      if (o.tone === 'bad') status = 'rejected';
    }
    if (spec.crisis && !s.crises.some((c) => c.defId === spec.crisis)) startCrisis(s, spec.crisis, 3);
    const budgetAdd = Object.values(eff.budget ?? {}).reduce((a, v) => a + Math.max(0, v ?? 0), 0);
    s.career.moneyInvested += budgetAdd;
    if (spec.cat === 'extreme') s.career.memorable.push(`${spec.title} (${m.name})`);
    addNews(s, `${m.name}: ${spec.title}`, 'neutral', spec.icon);
    return { title: `${spec.icon} ${spec.title}`, subtitle: m.name, quip, people, status };
  },
});

def({
  id: 'ministry_request_budget', title: 'בקשת תוספת תקציב', icon: '🙏', category: 'ministry', level: 'medium', capital: 4, cooldown: 2,
  description: 'בקשה מראש הממשלה לתוספת של כ-5% מצורכי המשרד. ראש הממשלה מחליט לפי הגירעון ולפי היחסים איתך.',
  unavailable: (s) => (s.player.role !== 'minister' ? 'רק שר' : !playerMinistry(s)?.categories.length ? 'למשרד שלך אין סעיף תקציבי' : null),
  run: (s) => {
    const m = playerMinistry(s)!;
    const cat = m.categories[0];
    const amount = round1(s.budget.needs[cat] * 0.05);
    const rej = pmApproval(s, amount);
    if (rej) return rej;
    applyDecision(s, { budget: { [cat]: amount } });
    s.career.moneyInvested += amount;
    addNews(s, `${me(s).name} השיג תוספת של ₪${amount}B ל${m.name}`, 'good', '💰');
    return { title: `אושרה תוספת של ₪${amount} מיליארד`, status: 'approved', people: [{ icon: '🪑', label: s.politicians[s.government.pmId].name, text: 'מאושר. אני מצפה לראות תוצאות.', tone: 'neutral' }] };
  },
});

def({
  id: 'ministry_efficiency', title: 'תוכנית התייעלות', icon: '⚙️', category: 'ministry', level: 'simple', capital: 4, cooldown: 2,
  description: 'יעילות המשרד +8 וביורוקרטיה -6. עובדי המדינה לא מרוצים.',
  unavailable: (s, p) => (ministryOf(s, p) && (isPM(s) || s.player.role === 'minister') ? null : 'אין משרד'),
  run: (s, p) => {
    const m = ministryOf(s, p)!;
    m.efficiency = clamp(m.efficiency + 8);
    m.bureaucracy = clamp(m.bureaucracy - 6);
    applyDecision(s, { groups: { publicSector: -3, selfEmployed: 1 }, playerReputation: 2 });
    return { title: `${m.name} מתייעל`, subtitle: 'יעילות +8 · ביורוקרטיה -6' };
  },
});

def({
  id: 'ministry_union', title: 'הסכם עם ועד העובדים', icon: '🤝', category: 'ministry', level: 'simple', capital: 3, cooldown: 2,
  description: 'הסכם שקט תעשייתי: מוריד את הסיכוי לשביתה בתחום המשרד לשנה.',
  unavailable: (s, p) => (ministryOf(s, p) && (isPM(s) || s.player.role === 'minister') ? null : 'אין משרד'),
  run: (s, p) => {
    const m = ministryOf(s, p)!;
    s.flags[`calm_${m.id}`] = s.turn + 3;
    for (const o of m.origins ?? []) s.flags[`calm_${o}`] = s.turn + 3;
    applyDecision(s, { groups: { publicSector: 2 } });
    return { title: 'נחתם הסכם שקט תעשייתי', subtitle: 'הסיכוי לשביתה בתחום ירד לשנה', quip: 'ההסכם כולל שיפורים בתנאי העבודה, בעלות נמוכה.' };
  },
});

def({
  id: 'consult_experts', title: 'התייעצות עם אנשי מקצוע', icon: '🧑‍🔬', category: 'ministry', level: 'simple', capital: 1, cooldown: 1,
  description: 'ישיבת עבודה עם מומחים בתחום: מומחיות +5 ומוניטין +1.',
  unavailable: () => null,
  run: (s, p) => {
    const m = ministryOf(s, p);
    const domain = (str(p, 'domain') || m?.domain || 'management') as Domain;
    const pl = me(s);
    pl.expertise[domain] = clamp((pl.expertise[domain] ?? 20) + 5);
    applyEffects(s, { playerReputation: 1 });
    return { title: 'למדת את התחום לעומק', subtitle: `מומחיות +5 (${DOMAIN_NAMES[domain] ?? domain})`, quip: 'ההבנה המקצועית תעזור לך בהחלטות הבאות ובראיונות.' };
  },
});

// ===== MEDIA & CAREER: every appearance can go many ways, with real consequences =====
interface Roll { w: number; text: string; tone: 'good' | 'bad' | 'neutral'; fx?: Effects; headline?: string; extra?: (s: GameState) => string | void }
function rollOut(s: GameState, title: string, icon: string, list: Roll[]): RunResult {
  const pool = list.filter((x) => x.w > 0);
  const total = pool.reduce((a, x) => a + x.w, 0);
  let r = rand(s) * total;
  const o = pool.find((x) => (r -= x.w) <= 0) ?? pool[0];
  if (o.fx) applyDecision(s, o.fx);
  const more = o.extra?.(s);
  if (o.headline) addNews(s, o.headline, o.tone === 'good' ? 'good' : o.tone === 'bad' ? 'bad' : 'neutral', icon);
  return { title, status: o.tone === 'good' ? 'approved' : o.tone === 'bad' ? 'rejected' : 'info', quip: more ? `${o.text} ${more}` : o.text };
}
const randomGroup = (s: GameState): GroupId => pick(s, GROUPS.map((g) => g.id));
const myLeader = (s: GameState) => s.politicians[s.parties[s.player.partyId].leaderId];
const rival = (s: GameState) => pick(s, Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && p.partyId !== s.player.partyId && s.parties[p.partyId]?.leaderId === p.id));

def({
  id: 'press_conference', title: 'מסיבת עיתונאים', icon: '🎙️', category: 'media', level: 'simple', capital: 3, cooldown: 1,
  description: 'הצהרה ושאלות מהעיתונאים. המוניטין שלך משפיע על הסיכוי שזה ילך טוב.',
  unavailable: () => null,
  run: (s) => {
    const me0 = me(s);
    return rollOut(s, 'מסיבת עיתונאים', '🎙️', [
      { w: 4 + s.player.reputation / 20, tone: 'good', text: 'הצגת את העמדה בבהירות וענית על השאלות הקשות.', fx: { playerPopularity: 4, partyMomentum: { [s.player.partyId]: 1 } } },
      { w: 2.5, tone: 'bad', text: 'שאלה על התנהלות המשרד תפסה אותך לא מוכן. התשובה נשמעה מתחמקת.', fx: { playerPopularity: -4, playerReputation: -2 }, headline: `${me0.name} התקשה להשיב לשאלות במסיבת העיתונאים` },
      { w: 2, tone: 'neutral', text: 'הכרזת על תוכנית שעוד לא תואמה עם המפלגה. היא נשמעה טוב, אבל עכשיו צריך לממש אותה.', fx: { playerPopularity: 3, playerReputation: -3 }, extra: (x) => { const l = myLeader(x); if (l && !l.isPlayer) remember(x, l.id, 'insult', 'הכריז על תוכנית בלי לתאם', -6); return l && !l.isPlayer ? `${l.name} לא עודכן מראש.` : ''; } },
      { w: 1.2, tone: 'good', text: 'תשובה חדה לשאלה קשה הופצה ברשתות והגיעה לקהלים צעירים.', fx: { playerPopularity: 2, groups: { youth: 3 } }, headline: `התשובה של ${me0.name} הופצה ברשתות` },
    ]);
  },
});

def({
  id: 'tv_interview', title: 'ראיון באולפן', icon: '📺', category: 'media', level: 'simple', capital: 2, cooldown: 1,
  description: 'ראיון חי בטלוויזיה. יכול לחזק אותך מאוד או לייצר סערה. המוניטין משנה את הסיכויים.',
  unavailable: () => null,
  run: (s) => {
    const g = randomGroup(s);
    const r = rival(s);
    return rollOut(s, 'ראיון באולפן', '📺', [
      { w: 3 + s.player.reputation / 15, tone: 'good', text: 'ראיון חזק: עמדות ברורות, נתונים מדויקים. גם מבקרים הודו שהיה משכנע.', fx: { playerPopularity: 6, playerReputation: 2, partyMomentum: { [s.player.partyId]: 2 } }, headline: `${me(s).name} בראיון: "יש לנו תוכנית"` },
      { w: 3, tone: 'bad', text: `אמירה על ${GROUP_BY_ID[g].name} התפרשה כפוגענית. נציגיהם דורשים התנצלות.`, fx: { groups: { [g]: -7 }, playerPopularity: -3 }, headline: `סערה בעקבות דברי ${me(s).name} על ${GROUP_BY_ID[g].name}` },
      { w: r ? 2 : 0, tone: 'neutral', text: `תקפת את ${r?.name} בשידור. הבסיס שלך מרוצה, היחסים ביניכם הורעו.`, fx: { playerPopularity: 2 }, extra: (x) => { if (r) { remember(x, r.id, 'insult', 'תקף אותי באולפן', -12); x.politicians[r.id].popularity = clamp(x.politicians[r.id].popularity - 3); } } },
      { w: 1.2, tone: 'neutral', text: 'עימות חריף עם המראיין. הבסיס הימני מרוצה, מצביעי המרכז פחות.', fx: { groups: { right: 3, center: -3 }, playerPopularity: 1 }, headline: `עימות חריף באולפן עם ${me(s).name}` },
      { w: 1.5, tone: 'bad', text: 'מיקרופון שנשאר פתוח אחרי הראיון קלט ביקורת שלך על מנהיג המפלגה.', fx: { playerPopularity: -2 }, extra: (x) => { const l = myLeader(x); if (l && !l.isPlayer) remember(x, l.id, 'betrayal', 'ביקר אותי במיקרופון פתוח', -15); return l && !l.isPlayer ? `${l.name} שמע את הדברים.` : ''; }, headline: 'מיקרופון פתוח חשף מתיחות במפלגה' },
    ]);
  },
});

def({
  id: 'tweet_storm', title: 'פוסט חריף ברשתות', icon: '📱', category: 'media', level: 'simple', capital: 0, cooldown: 1,
  description: 'הודעה חריפה ברשתות החברתיות. מגיעה מהר לצעירים; עלולה לייצר סערה.',
  unavailable: () => null,
  run: (s) => {
    const r = rival(s);
    return rollOut(s, 'פוסט ברשתות', '📱', [
      { w: 4, tone: 'good', text: 'הפוסט הופץ באופן נרחב והגיע לקהלים חדשים.', fx: { playerPopularity: 5, groups: { youth: 3 } }, headline: `הפוסט של ${me(s).name} הופץ באופן נרחב` },
      { w: 3, tone: 'bad', text: 'הפוסט עורר ביקורת חריפה ונמחק. צילומי המסך ממשיכים להסתובב.', fx: { playerPopularity: -5, playerReputation: -3 }, headline: `${me(s).name} מחק פוסט אחרי ביקורת` },
      { w: r ? 2 : 0, tone: 'neutral', text: `${r?.name} הגיב, והוויכוח ביניכם עלה לכותרות.`, fx: { playerPopularity: 2 }, extra: (x) => { if (r) { x.politicians[r.id].popularity = clamp(x.politicians[r.id].popularity + 2); remember(x, r.id, 'insult', 'עימות ברשתות', -8); } } },
    ]);
  },
});

def({
  id: 'attack_opponent', title: 'מתקפה על יריב', icon: '🥊', category: 'media', level: 'simple', capital: 4, cooldown: 1,
  description: 'ביקורת ישירה על יריב פוליטי. כשאתה חזק ממנו זה עובד; אחרת זה עלול לחזור אליך.',
  unavailable: (s, p) => (s.politicians[str(p, 'politicianId')]?.active ? null : 'בחר יריב'),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    remember(s, t.id, 'insult', 'תקף אותי בתקשורת', -14);
    shiftPartyRelation(s, s.player.partyId, t.partyId, s.parties[t.partyId]?.leaderId === t.id ? -8 : -3);
    const strong = (me(s).popularity - t.popularity) / 100;
    const res = rollOut(s, `מתקפה על ${t.name}`, '🥊', [
      { w: 4 + strong * 6, tone: 'good', text: `${t.name} נאלץ להתגונן, והשיח עבר לנושאים שלך.`, fx: { playerPopularity: 3, partyMomentum: { [s.player.partyId]: 2, [t.partyId]: -3 } }, extra: (x) => { x.politicians[t.id].popularity = clamp(x.politicians[t.id].popularity - 7); } },
      { w: 2.5, tone: 'bad', text: `המתקפה נתפסה כבוטה מדי, ו${t.name} זכה לגל אהדה.`, fx: { playerPopularity: -4, partyMomentum: { [t.partyId]: 3 } }, extra: (x) => { x.politicians[t.id].popularity = clamp(x.politicians[t.id].popularity + 4); }, headline: `גל אהדה ל${t.name} אחרי המתקפה` },
      { w: 1.5, tone: 'bad', text: `${t.name} הגיש תביעת לשון הרע. ההליך יגזול זמן ותשומת לב.`, fx: { playerCapital: -6, playerReputation: -3 }, headline: `${t.name} תובע את ${me(s).name} בגין לשון הרע` },
    ]);
    return { ...res, people: [{ icon: '😠', label: t.name, text: pick(s, ['המתקפה הזו מוכיחה שאין לו תשובות עניניות.', 'הציבור יידע לשפוט.', 'לא אגיב ברמה הזו.']), tone: 'bad' }] };
  },
});

def({
  id: 'visit_region', title: 'סיור באזור', icon: '🚐', category: 'media', level: 'simple', capital: 2, cooldown: 1,
  description: 'ביקור בשטח: פגישות עם תושבים וראשי רשויות. משפר את שביעות הרצון באזור, אם הסיור עובר בהצלחה.',
  unavailable: (_s, p) => (REGION_BY_ID[str(p, 'regionId') as keyof typeof REGION_BY_ID] ? null : 'בחר אזור'),
  run: (s, p) => {
    const r = REGION_BY_ID[str(p, 'regionId') as keyof typeof REGION_BY_ID];
    const per = ['north', 'negev', 'eilat', 'judea_samaria'].includes(r.id);
    const st = s.population.regions[r.id];
    return rollOut(s, `סיור ב${r.name}`, '🚐', [
      { w: 4, tone: 'good', text: `התושבים ב${r.name} קיבלו אותך בחום והציגו את הבעיות שלהם.`, fx: { playerPopularity: 3, groups: per ? { periphery: 3 } : { center: 2 } }, extra: () => { st.satisfaction = clamp(st.satisfaction + 5); } },
      { w: 2.5, tone: 'bad', text: `מפגינים ב${r.name} האשימו את הממשלה בהזנחת האזור.`, fx: { playerPopularity: -4 }, extra: () => { st.satisfaction = clamp(st.satisfaction - 2); }, headline: `קריאות מחאה נגד ${me(s).name} ב${r.name}` },
      { w: 2, tone: 'neutral', text: 'התחייבת על המקום לפרויקט תשתית. התושבים יבדקו אם זה יקרה.', fx: { playerPopularity: 2, playerReputation: -2, regionInvestment: { [r.id]: 4 } } },
      { w: 1.5, tone: 'good', text: `זיהית בעיה אמיתית ב${r.name} ודחפת לפתרון מהיר.`, fx: { playerReputation: 5, playerPopularity: 3, regionInvestment: { [r.id]: 6 } } },
    ]);
  },
});

def({
  id: 'committee_work', title: 'עבודת ועדה', icon: '📑', category: 'career', level: 'simple', capital: 0, cooldown: 1,
  description: 'עבודה מעמיקה בוועדה: מומחיות +6 וכוח פוליטי +2. לפעמים מתגלים ליקויים שעולים לכותרות.',
  unavailable: (s) => (s.player.role === 'pm' ? 'ראש הממשלה לא חבר בוועדות' : null),
  run: (s, p) => {
    const domain = (str(p, 'domain') || 'economy') as Domain;
    const pl = me(s);
    pl.expertise[domain] = clamp((pl.expertise[domain] ?? 20) + 6);
    pl.power = clamp(pl.power + 2);
    const victim = pick(s, Object.values(s.politicians).filter((x) => x.active && !x.isPlayer && x.ministryId));
    return rollOut(s, 'עבודת ועדה', '📑', [
      { w: 5, tone: 'good', text: 'למדת לעומק את החומר המקצועי וקידמת תיקונים לחקיקה.', fx: { playerReputation: 3 } },
      { w: victim ? 1.5 : 0, tone: 'good', text: `בדיון התגלו ליקויים בהתנהלות המשרד של ${victim?.name}. הממצאים עלו לכותרות.`, fx: { playerReputation: 6, playerPopularity: 4 }, extra: (x) => { if (victim) remember(x, victim.id, 'insult', 'חשף ליקויים במשרד שלי', -15); }, headline: 'דיון בוועדה חשף ליקויים בהתנהלות משרד ממשלתי' },
      { w: 1.5, tone: 'neutral', text: 'עימות חריף עם יו״ר הוועדה הסתיים בהוצאתך מהדיון.', fx: { playerPopularity: 2, playerReputation: -1 } },
    ]);
  },
});

def({
  id: 'protest_speech', title: 'נאום בהפגנה', icon: '📢', category: 'media', level: 'simple', capital: 3, cooldown: 2,
  description: 'נאום בעצרת. חיזוק מול הבסיס; אם אתה בקואליציה ומדובר בהפגנה נגד הממשלה, ראש הממשלה יזכור.',
  unavailable: () => null,
  run: (s) => {
    const inGov = s.government.coalition.includes(s.player.partyId);
    const lean = me(s).ideology.security > 0 ? 'right' : 'left';
    return rollOut(s, 'נאום בהפגנה', '📢', [
      { w: 4, tone: 'good', text: 'הנאום התקבל בהתלהבות והופץ בתקשורת.', fx: { playerPopularity: 5, groups: { [lean]: 4 }, partyMomentum: { [s.player.partyId]: 2 } }, extra: (x) => { if (inGov) { remember(x, x.government.pmId, 'insult', 'נאם בהפגנה נגד הממשלה', -12); return 'ראש הממשלה לא אהב את זה.'; } } },
      { w: 2, tone: 'bad', text: 'ההפגנה הייתה קטנה והנאום כמעט לא סוקר.', fx: { playerPopularity: -1 } },
      { w: 1.5, tone: 'bad', text: 'ההפגנה הסתיימה בעימותים עם המשטרה, ואתה צולמת במקום.', fx: { playerPopularity: -2, playerReputation: -4, groups: { right: lean === 'right' ? 2 : -3, left: lean === 'left' ? 2 : -3 } }, headline: 'עימותים בהפגנה; ח״כ נכח במקום' },
    ]);
  },
});

def({
  id: 'leak_rival', title: 'הדלפת מידע על יריב', icon: '🗂️', category: 'media', level: 'simple', capital: 4, cooldown: 2,
  description: 'העברת מידע מביך על יריב לתקשורת. עלול להיחשף, ואז זה פוגע בך קשות.',
  unavailable: (s, p) => (s.politicians[str(p, 'politicianId')]?.active ? null : 'בחר יריב'),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    return rollOut(s, `הדלפה על ${t.name}`, '🗂️', [
      { w: 4, tone: 'good', text: `${t.name} עסוק בהכחשות. המקור לא נחשף.`, extra: (x) => { x.politicians[t.id].popularity = clamp(x.politicians[t.id].popularity - 9); }, headline: `פרסום: חשדות נגד ${t.name}` },
      { w: 3, tone: 'bad', text: 'זהות המקור נחשפה. הפגיעה במוניטין שלך קשה.', fx: { playerReputation: -8, playerPopularity: -4 }, extra: (x) => { remember(x, t.id, 'betrayal', 'הדליף עליי', -25); }, headline: `${me(s).name} נחשף כמקור ההדלפה על ${t.name}` },
      { w: 1.5, tone: 'neutral', text: 'החומר התגלה כחסר משמעות, והציבור ריחם על היריב.', extra: (x) => { x.politicians[t.id].popularity = clamp(x.politicians[t.id].popularity + 3); } },
    ]);
  },
});

def({
  id: 'write_book', title: 'פרסום ספר', icon: '📕', category: 'media', level: 'medium', capital: 4, cooldown: 6,
  description: 'ספר על דרכך ועל השקפת עולמך. עשוי לחזק אותך; פרקים על עמיתים עלולים לפגוע ביחסים.',
  unavailable: () => null,
  run: (s) => rollOut(s, 'הספר יצא לאור', '📕', [
    { w: 3, tone: 'good', text: 'הספר התקבל היטב והוביל לסדרת ראיונות.', fx: { playerPopularity: 5, playerReputation: 3 }, headline: `הספר של ${me(s).name} ברשימת רבי המכר` },
    { w: 3, tone: 'bad', text: 'פרק על ישיבות הממשלה עורר כעס בקרב שלושה שרים.', fx: { stability: -5, playerPopularity: 2 }, extra: (x) => { for (const m of Object.values(x.politicians).filter((q) => q.ministryId && !q.isPlayer).slice(0, 3)) remember(x, m.id, 'betrayal', 'כתב עליי בספר', -10); }, headline: 'ספר חדש חושף מתיחות בממשלה' },
    { w: 2, tone: 'neutral', text: 'הספר לא עורר עניין רב.', fx: { playerPopularity: -1 } },
  ]),
});

def({
  id: 'charity_photo', title: 'ביקור התנדבותי', icon: '🍲', category: 'media', level: 'simple', capital: 1, cooldown: 1,
  description: 'ביקור והתנדבות בארגון סיוע. מחזק את הקשר עם השכבות החלשות, אם זה נתפס כאמיתי.',
  unavailable: () => null,
  run: (s) => rollOut(s, 'ביקור התנדבותי', '🍲', [
    { w: 5, tone: 'good', text: 'שוחחת עם המתנדבים ועם הנזקקים ולמדת על הצרכים בשטח.', fx: { playerPopularity: 3, groups: { lowIncome: 2 } } },
    { w: 3, tone: 'bad', text: 'הביקור נתפס כאירוע יחסי ציבור קצר, והביקורת התפרסמה.', fx: { playerPopularity: -3, groups: { lowIncome: -2 } }, headline: 'ביקורת: ביקור קצר לצורכי צילום' },
  ]),
});

// ===== PM: national measures =====
def({
  id: 'state_emergency', title: 'הכרזה על מצב מיוחד בעורף', icon: '🚨', category: 'government', level: 'major', capital: 10, cooldown: 6,
  description: 'סמכויות חירום לפיקוד העורף ולממשלה. מגביר יציבות ומוכנות; פוגע באמון של קבוצות שחוששות מפגיעה בדמוקרטיה.',
  unavailable: (s) => (isPM(s) ? null : 'רק ראש הממשלה'),
  run: (s) => {
    applyDecision(s, { stability: 12, playerReputation: -4, services: { security: 3 }, groups: { left: -8, liberals: -6, center: -3, right: 3, elderly: 2 } });
    addNews(s, 'הממשלה הכריזה על מצב מיוחד בעורף', 'bad', '🚨');
    return { title: 'הוכרז מצב מיוחד בעורף', quip: 'ארגוני זכויות האדם יעקבו אחר השימוש בסמכויות.' };
  },
});

def({
  id: 'cash_handout', title: 'מענק סיוע חד-פעמי לכל משק בית', icon: '💵', category: 'government', level: 'major', capital: 6, cooldown: 8,
  description: '₪10 מיליארד מענק חד-פעמי. משפר את מצב הרוח ומגדיל את החוב והאינפלציה. לפני בחירות ייתפס כמהלך פוליטי.',
  unavailable: (s) => (isPM(s) ? null : 'רק ראש הממשלה'),
  run: (s) => {
    const pre = monthsUntilElection(s) <= 6;
    applyDecision(s, { oneOffCost: 10, economy: { inflation: 0.7, growth: 0.3 }, playerPopularity: pre ? 4 : 6, playerReputation: pre ? -4 : 0, groups: Object.fromEntries(GROUPS.map((g) => [g.id, 4])) as Partial<Record<GroupId, number>> });
    addNews(s, pre ? 'מענק חד-פעמי לכל משק בית; האופוזיציה: "שוחד בחירות"' : 'הממשלה אישרה מענק סיוע חד-פעמי לכל משק בית', pre ? 'bad' : 'neutral', '💵');
    return { title: 'אושר מענק חד-פעמי', quip: `בנק ישמעאל מזהיר מלחץ אינפלציוני.${pre ? ' האופוזיציה טוענת שזה מהלך בחירות.' : ''}` };
  },
});

def({
  id: 'nation_address', title: 'נאום לאומה', icon: '🎥', category: 'government', level: 'simple', capital: 4, cooldown: 1,
  description: 'נאום בשידור חי בפריים טיים. יכול לאחד ולחזק, או להיתפס כנאום פוליטי.',
  unavailable: (s) => (isPM(s) ? null : 'רק ראש הממשלה'),
  run: (s) => rollOut(s, 'נאום לאומה', '🎥', [
    { w: 4, tone: 'good', text: 'נאום מאחד וממלכתי. גם מבקרים הודו שהטון היה נכון.', fx: { playerPopularity: 5, stability: 3 }, headline: 'נאום ראש הממשלה לאומה: "נעבור את זה יחד"' },
    { w: 3, tone: 'bad', text: 'הנאום נתפס כנאום בחירות, והופץ בעיקר בביקורת.', fx: { playerPopularity: -3 }, headline: 'ביקורת: נאום פוליטי בפריים טיים' },
    { w: 1.5, tone: 'neutral', text: 'הנאום עבר בלי הדים מיוחדים.', fx: { playerPopularity: 1 } },
  ]),
});

def({
  id: 'postpone_elections', title: 'הצעה לדחיית הבחירות', icon: '⏸️', category: 'government', level: 'major', capital: 15, cooldown: 12,
  description: 'הארכת כהונת הכנסטון בשנה. לפי חוק היסוד צריך רוב של 80 ח״כים. גם אם עובר – צפויה מחאה ועתירות לבג״ץ.',
  unavailable: (s) => (!isPM(s) ? 'רק ראש הממשלה' : monthsUntilElection(s) > 8 ? 'הבחירות עוד רחוקות' : s.government.caretaker ? 'ממשלת מעבר' : null),
  run: (s) => {
    applyDecision(s, { groups: { left: -12, liberals: -10, center: -8, secular: -4, right: 1 }, stability: -8, playerReputation: -10 });
    const support = coalitionSeats(s) + Math.round(rand(s) * 14);
    if (support < 80) {
      addNews(s, `ההצעה לדחיית הבחירות נפלה: ${support} תומכים, נדרשו 80`, 'bad', '⏸️');
      return { title: 'ההצעה נפלה', status: 'rejected', subtitle: `${support} תומכים מתוך 80 הנדרשים`, quip: 'הבחירות יתקיימו במועדן.' };
    }
    if (!s.crises.some((c) => c.defId === 'cost_protest')) startCrisis(s, 'cost_protest', 3);
    if (rand(s) < 0.4) {
      applyEffects(s, { playerPopularity: -8 });
      addNews(s, 'בג״ץ ביטל את חוק דחיית הבחירות', 'bad', '⚖️');
      return { title: 'בג״ץ ביטל את הדחייה', status: 'rejected', quip: 'הבחירות יתקיימו במועדן, והמחאה נמשכת.' };
    }
    s.elections.date = addMonths(electionDate(s), 12);
    addNews(s, 'הכנסטון אישר ברוב של 80 את דחיית הבחירות בשנה', 'bad', '⏸️');
    s.career.memorable.push('דחה את הבחירות בשנה');
    return { title: 'הבחירות נדחו בשנה', quip: 'המהלך עבר, אבל המחיר הציבורי כבד.' };
  },
});

def({
  id: 'declare_war_pm', title: 'מבצע צבאי רחב', icon: '💥', category: 'government', level: 'major', capital: 12, cooldown: 8,
  description: 'מבצע צבאי רחב באישור הקבינט. מגייס מילואים ופוגע בכלכלה; בתחילה הציבור מתלכד, בהמשך נשאלות שאלות.',
  unavailable: (s) => (!isPM(s) ? 'רק ראש הממשלה' : s.crises.some((c) => c.defId === 'war') ? 'כבר מתנהלת מלחמה' : null),
  run: (s) => {
    applyDecision(s, { oneOffCost: 4, economy: { growth: -0.9, unemployment: 0.3 }, groups: { right: 6, settlers: 5, reservists: -8, families: -4, left: -8 }, stability: 10, playerPopularity: 5 });
    startCrisis(s, 'war', 3);
    s.career.memorable.push('הוביל מבצע צבאי רחב');
    return { title: 'יצא לדרך מבצע צבאי רחב', quip: 'משרתי המילואים גויסו. העורף נערך, והכלכלה תושפע בחודשים הקרובים.' };
  },
});

// ===== CAREER =====
def({
  id: 'network', title: 'פגישה אישית עם פוליטיקאי', icon: '☕', category: 'career', level: 'simple', capital: 5, cooldown: 1,
  description: 'שיחה אישית לחיזוק הקשר. משפרת את היחסים ואת הנאמנות (פחות עם בעלי אגו גבוה).',
  unavailable: (s, p) => (s.politicians[str(p, 'politicianId')]?.active && str(p, 'politicianId') !== s.player.politicianId ? null : 'בחר פוליטיקאי'),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    const gain = randInt(s, 6, 12) - Math.round(t.personality.ego * 4);
    remember(s, t.id, 'support', 'פגישה אישית', gain);
    me(s).power = clamp(me(s).power + 1);
    return { title: `פגישה עם ${t.name}`, subtitle: `יחסים +${Math.round(gain * 0.6)}`, people: [{ icon: '☕', label: t.name, text: pick(s, ['שיחה טובה. נמשיך להיות בקשר.', 'אני מעריך את הפנייה.', 'יש בינינו הרבה מן המשותף.']), tone: 'good' }] };
  },
});

def({
  id: 'support_leader', title: 'גיבוי פומבי למנהיג', icon: '🙌', category: 'career', level: 'simple', capital: 0, cooldown: 2,
  description: 'הצהרת תמיכה במנהיג המפלגה. משפרת את היחסים איתו; קצת פוגעת בעצמאות שלך בעיני הציבור.',
  unavailable: (s) => (isPartyLeader(s) ? 'אתה המנהיג' : null),
  run: (s) => {
    const l = s.politicians[s.parties[s.player.partyId].leaderId];
    remember(s, l.id, 'support', 'גיבה אותי בתקשורת', 12);
    applyEffects(s, { playerReputation: -1 });
    return { title: `גיבית את ${l.name}`, people: [{ icon: '🙂', label: l.name, text: 'אני מעריך את הגיבוי.', tone: 'good' }] };
  },
});

def({
  id: 'ask_position', title: 'בקשת תפקיד', icon: '🙋', category: 'career', level: 'simple', capital: 3, cooldown: 2,
  description: 'פנייה למנהיג בבקשה לתפקיד. מצליחה אם הוא סומך עליך (נאמנות 58+), יש לך כוח (32+) ומוניטין (40+).',
  unavailable: (s) => (s.player.role !== 'mk' ? 'כבר יש לך תפקיד' : isPartyLeader(s) ? 'אתה המנהיג' : null),
  run: (s) => {
    const leader = s.politicians[s.parties[s.player.partyId].leaderId];
    const pl = me(s);
    const inGov = s.government.coalition.includes(pl.partyId);
    const ok = leader.loyalty > 58 && pl.power > 32 && s.player.reputation > 40;
    if (!ok) {
      leader.loyalty = clamp(leader.loyalty - 3);
      return { title: 'הבקשה נדחתה', status: 'rejected', people: [{ icon: '🤨', label: leader.name, text: 'עוד לא הגיע הזמן. תוכיח את עצמך בעבודה.', tone: 'bad' }] };
    }
    if (inGov) {
      const free = s.government.ministries.filter((m) => m.agreementPartyId === pl.partyId && (!m.ministerId || m.ministerId === s.government.pmId));
      const target = free[0];
      if (target) {
        assignMinister(s, target.id, pl.id);
        setRole(s, 'minister', `מונה ל${target.name}`);
        return { title: `מונית ל${target.name}`, status: 'approved' };
      }
    }
    pl.committee = 'ועדת הכספים';
    pl.power = clamp(pl.power + 8);
    s.career.memorable.push('מונה ליו״ר ועדת הכספים');
    return { title: 'קיבלת ראשות ועדה', status: 'approved', subtitle: 'ועדת הכספים' };
  },
});

def({
  id: 'run_primaries', title: 'התמודדות על ראשות המפלגה', icon: '⚔️', category: 'career', level: 'major', capital: 20, cooldown: 4,
  description: 'התמודדות מול המנהיג המכהן. הסיכוי נקבע לפי הכוח, הפופולריות ותמיכת חברי המפלגה. הפסד יעלה ביוקר.',
  unavailable: (s) => (isPartyLeader(s) ? 'אתה כבר המנהיג' : me(s).power < 35 ? 'צריך לפחות 35 כוח פוליטי' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    const leader = s.politicians[party.leaderId];
    const pl = me(s);
    const members = party.memberIds.map((id) => s.politicians[id]).filter((x) => x && x.active && !x.isPlayer && x.id !== leader.id);
    const support = members.reduce((a, m) => a + m.loyalty, 0) / Math.max(1, members.length);
    const score = pl.power + pl.popularity * 0.5 + support * 0.4 - (leader.power + leader.popularity * 0.5 + 25);
    const pWin = clamp(0.5 + score / 60, 0.05, 0.92);
    if (rand(s) < pWin) {
      party.leaderId = pl.id;
      remember(s, leader.id, 'betrayal', 'הדיח אותי מראשות המפלגה', -40);
      pl.power = clamp(pl.power + 15);
      s.player.listRank = 1;
      s.career.memorable.push(`ניצח בפריימריז ב${party.name}`);
      addNews(s, `${pl.name} ניצח את ${leader.name} בבחירות לראשות ${party.name}`, 'good', '👑');
      if (s.government.pmId === leader.id) {
        s.government.pmId = pl.id;
        if (pl.ministryId) { const m = getMinistry(s, pl.ministryId); if (m) m.ministerId = pl.id; }
        for (const m of s.government.ministries) if (m.ministerId === leader.id) m.ministerId = pl.id;
        s.career.governmentsFormed += 1;
      }
      syncRole(s);
      return { title: 'ניצחת בפריימריז', status: 'approved', subtitle: `אתה ${s.player.role === 'pm' ? 'ראש הממשלה' : 'יו״ר ' + party.name}` };
    }
    remember(s, leader.id, 'betrayal', 'ניסה להדיח אותי', -35);
    pl.power = clamp(pl.power - 15);
    s.flags.failed_primaries = s.turn;
    addNews(s, `${pl.name} הפסיד בבחירות לראשות ${party.name}`, 'bad', '🗳️');
    s.career.failures.push(`הפסיד בפריימריז ב${party.name}`);
    return { title: 'הפסדת בפריימריז', status: 'rejected', subtitle: `סיכויי הניצחון היו ${Math.round(pWin * 100)}%`, quip: 'היחסים עם המנהיג נפגעו קשות.' };
  },
});

def({
  id: 'switch_party', title: 'מעבר מפלגה', icon: '🔀', category: 'career', level: 'major', capital: 15, cooldown: 6,
  description: 'מעבר למפלגה אחרת. חברי המפלגה הקודמת יראו בזה בגידה; במפלגה החדשה תקבל מקום לפי כוחך.',
  unavailable: (s, p) => (isPartyLeader(s) ? 'מנהיג לא עוזב את המפלגה שלו' : !s.parties[str(p, 'partyId')] || str(p, 'partyId') === s.player.partyId ? 'בחר מפלגה אחרת' : null),
  run: (s, p) => {
    const from = s.parties[s.player.partyId];
    const to = s.parties[str(p, 'partyId')];
    const pl = me(s);
    from.memberIds = from.memberIds.filter((id) => id !== pl.id);
    from.isPlayerParty = false;
    to.memberIds.push(pl.id);
    to.isPlayerParty = true;
    pl.partyId = to.id;
    s.player.partyId = to.id;
    if (pl.ministryId) { const m = getMinistry(s, pl.ministryId); if (m) m.ministerId = s.government.pmId; pl.ministryId = null; }
    for (const id of from.memberIds) remember(s, id, 'betrayal', 'ערק מהמפלגה', -25);
    for (const id of to.memberIds) if (id !== pl.id) s.politicians[id].loyalty = clamp(s.politicians[id].loyalty + 8);
    applyEffects(s, { playerPopularity: -5, playerReputation: -4 });
    s.player.listRank = Math.max(3, Math.round(to.seats * 0.5));
    from.seats = Math.max(0, from.seats - 1);
    to.seats += 1;
    s.career.memorable.push(`עבר מ${from.name} ל${to.name}`);
    addNews(s, `${pl.name} עובר ל${to.name}`, 'neutral', '🔀');
    syncRole(s);
    return { title: `הצטרפת ל${to.name}`, subtitle: `מקום ${s.player.listRank} ברשימה (עד הפריימריז)` };
  },
});

def({
  id: 'resign', title: 'התפטרות', icon: '🚪', category: 'career', level: 'major', capital: 0,
  description: 'פרישה מהחיים הפוליטיים. המשחק מסתיים.',
  unavailable: () => null,
  run: (s) => {
    setGameOver(s, 'resigned', 'התפטרת');
    return { title: 'התפטרת', status: 'info' };
  },
});

// ===== PARTY (leader) =====
def({
  id: 'rename_party', title: 'מיתוג מחדש', icon: '🎨', category: 'party', level: 'simple', capital: 3, cooldown: 3,
  description: 'שם, סמל וצבע חדשים למפלגה. יכול לתת תנופה, או לבלבל את המצביעים.',
  unavailable: (s, p) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : str(p, 'name').trim().length < 2 ? 'שם קצר מדי' : null),
  run: (s, p) => {
    const party = s.parties[s.player.partyId];
    const old = party.name;
    party.name = str(p, 'name').trim().slice(0, 32);
    party.shortName = party.name.slice(0, 14);
    if (str(p, 'logo')) party.logo = str(p, 'logo');
    if (str(p, 'color')) party.color = str(p, 'color');
    const up = rand(s) < 0.5;
    party.momentum = clamp(party.momentum + (up ? 3 : -2), -40, 40);
    addNews(s, `${old} משנה את שמה ל"${party.name}"`, 'neutral', party.logo);
    return { title: `"${party.name}"`, quip: up ? 'המיתוג החדש התקבל היטב.' : 'חלק מהמצביעים מתקשים לזהות את המפלגה בשמה החדש.' };
  },
});

def({
  id: 'promote_member', title: 'קידום חבר מפלגה', icon: '⬆️', category: 'party', level: 'simple', capital: 3, cooldown: 1,
  description: 'קידום בתוך המפלגה: כוחו +6 ונאמנותו עולה. שאר החברים קצת מקנאים.',
  unavailable: (s, p) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : s.politicians[str(p, 'politicianId')]?.partyId !== s.player.partyId ? 'רק חברי המפלגה' : null),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    t.power = clamp(t.power + 6);
    remember(s, t.id, 'favor', 'קודם במפלגה', 12);
    for (const id of s.parties[s.player.partyId].memberIds) if (id !== t.id && !s.politicians[id].isPlayer) s.politicians[id].loyalty = clamp(s.politicians[id].loyalty - 1.5);
    return { title: `${t.name} קודם`, people: [{ icon: '🙂', label: t.name, text: 'תודה על האמון. לא אאכזב.', tone: 'good' }] };
  },
});

def({
  id: 'demote_member', title: 'הורדת חבר מפלגה', icon: '⬇️', category: 'party', level: 'simple', capital: 3, cooldown: 1,
  description: 'הורדה בתוך המפלגה: כוחו -8. הוא עלול לחפש מפלגה אחרת.',
  unavailable: (s, p) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : s.politicians[str(p, 'politicianId')]?.partyId !== s.player.partyId ? 'רק חברי המפלגה' : null),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    t.power = clamp(t.power - 8);
    remember(s, t.id, 'insult', 'הורד במפלגה', -20);
    return { title: `${t.name} הורד`, people: [{ icon: '😤', label: t.name, text: 'ההחלטה לא הוגנת.', tone: 'bad' }] };
  },
});

def({
  id: 'expel_member', title: 'הוצאה מהמפלגה', icon: '🚫', category: 'party', level: 'medium', capital: 8, cooldown: 2,
  description: 'הוצאת חבר מהסיעה. המפלגה מאבדת מנדט; אם הוא היה לא נאמן, הלכידות עולה.',
  unavailable: (s, p) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : s.politicians[str(p, 'politicianId')]?.partyId !== s.player.partyId || str(p, 'politicianId') === s.player.politicianId ? 'רק חברי המפלגה' : null),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    const party = s.parties[s.player.partyId];
    party.memberIds = party.memberIds.filter((id) => id !== t.id);
    t.active = false;
    t.quirk = 'הוצא מהסיעה.';
    if (t.ministryId) { const m = getMinistry(s, t.ministryId); if (m) m.ministerId = s.government.pmId; t.ministryId = null; }
    party.seats = Math.max(1, party.seats - 1);
    party.cohesion = clamp(party.cohesion + (t.loyalty < 40 ? 8 : -6));
    addNews(s, `${t.name} הוצא מסיעת ${party.name}`, 'neutral', '🚫');
    return { title: `${t.name} הוצא מהסיעה`, subtitle: `לסיעה ${party.seats} מנדטים בכנסטון` };
  },
});

def({
  id: 'recruit_star', title: 'גיוס מועמד חיצוני', icon: '🌟', category: 'party', level: 'medium', capital: 10, cooldown: 3,
  description: 'צירוף איש מקצוע מוכר לרשימה (₪2 מיליון מקופת המפלגה). מוסיף תנופה; הוותיקים חוששים לירידה ברשימה.',
  unavailable: (s) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : s.parties[s.player.partyId].funds < 2 ? 'אין מספיק כסף במפלגה' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    const kinds = [
      { t: 'אלוף במילואים', d: 'defense' as Domain }, { t: 'כלכלנית בכירה', d: 'economy' as Domain }, { t: 'עיתונאי ותיק', d: 'media' as Domain },
      { t: 'מנהלת בית חולים', d: 'health' as Domain }, { t: 'מנכ״ל חברת טכנולוגיה', d: 'science' as Domain }, { t: 'מנהלת בית ספר', d: 'education' as Domain },
    ];
    const k = pick(s, kinds);
    const id = newId(s, 'pol');
    const gender = rand(s) < 0.5 ? 'f' : 'm';
    const pol: Politician = {
      id, name: `${pick(s, gender === 'f' ? ['נועה', 'מיכל', 'רונית', 'שירה', 'ענת', 'הדס'] : ['גיא', 'עומר', 'אורי', 'יואב', 'עמית', 'אלון'])} ${pick(s, ['ברק', 'שמעוני', 'לוין', 'אזולאי', 'רוזן', 'חדד', 'פרידמן', 'מזרחי'])}`,
      gender, partyId: party.id, ministryId: null, committee: null, mainDomain: k.d, expertise: { [k.d]: 82 }, power: 40, loyalty: 70,
      popularity: 62, experience: 0, personality: { ego: 0.8, ambition: 0.9, honesty: 0.6, aggression: 0.4 }, ideology: { ...party.ideology },
      memory: [], relationships: {}, caricature: randomCaricature(s, gender, party.id), quirk: `${k.t}. מועמד/ת חדש/ה בפוליטיקה (דמות בדיונית).`, cooldownUntil: s.turn + 2,
      isPlayer: false, active: true, ambitionTarget: 'משרד בכיר',
    };
    s.politicians[id] = pol;
    party.memberIds.push(id);
    party.funds -= 2;
    applyEffects(s, { partyMomentum: { [party.id]: 5 } });
    for (const mid of party.memberIds) if (mid !== id && !s.politicians[mid].isPlayer) s.politicians[mid].loyalty = clamp(s.politicians[mid].loyalty - 2);
    addNews(s, `${party.name} מצרפת לרשימה: ${pol.name}, ${k.t}`, 'good', '🌟');
    return { title: `הצטרף/ה: ${pol.name}`, subtitle: k.t, quip: 'חברי המפלגה הוותיקים חוששים לירידה ברשימה.' };
  },
});

def({
  id: 'fundraise', title: 'גיוס תרומות', icon: '💵', category: 'party', level: 'simple', capital: 2, cooldown: 1,
  description: 'אירוע התרמה במסגרת חוק מימון מפלגות. הסכום תלוי בפופולריות שלך.',
  unavailable: (s) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    const amount = round1(1.5 + me(s).popularity / 30 + rand(s));
    party.funds += amount;
    return { title: `גויסו ₪${amount} מיליון`, quip: 'כל התרומות דווחו למבקר המדינה, בהתאם לחוק.' };
  },
});

def({
  id: 'party_line', title: 'שינוי קו המפלגה', icon: '🧭', category: 'party', level: 'medium', capital: 6, cooldown: 3,
  description: 'הזזת המפלגה על אחד הצירים (ימין-שמאל, ליברלי-סוציאליסטי, דתי-חילוני). מושך קבוצות חדשות ומרחיק אחרות.',
  unavailable: (s) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : null),
  run: (s, p) => {
    const axis = str(p, 'axis') as keyof Ideology;
    const dir = num(p, 'dir') > 0 ? 1 : -1;
    const party = s.parties[s.player.partyId];
    party.ideology[axis] = clamp(party.ideology[axis] + dir * 0.2, -1, 1);
    me(s).ideology[axis] = party.ideology[axis];
    const map: Record<keyof Ideology, [GroupId[], GroupId[]]> = {
      economic: [['highIncome', 'selfEmployed', 'liberals'], ['lowIncome', 'publicSector', 'socialists']],
      security: [['right', 'settlers', 'reservists'], ['left', 'arabs']],
      religion: [['religious', 'haredim'], ['secular']],
    };
    const [up, down] = dir > 0 ? map[axis] : [map[axis][1], map[axis][0]];
    for (const g of up) party.affinity[g] = (party.affinity[g] ?? 0) + 0.4;
    for (const g of down) party.affinity[g] = Math.max(0, (party.affinity[g] ?? 0) - 0.4);
    for (const id of party.memberIds) {
      const m = s.politicians[id];
      if (!m.isPlayer && Math.abs(m.ideology[axis] - party.ideology[axis]) > 0.4) remember(s, id, 'insult', 'שינה את הקו', -6);
    }
    const names = { economic: ['לכיוון ליברלי', 'לכיוון סוציאליסטי'], security: ['ימינה', 'שמאלה'], religion: ['לכיוון דתי', 'לכיוון חילוני'] };
    addNews(s, `${party.name} זזה ${names[axis][dir > 0 ? 0 : 1]}`, 'neutral', '🧭');
    return { title: `המפלגה זזה ${names[axis][dir > 0 ? 0 : 1]}` };
  },
});

// ===== RELATIONSHIPS (MK to MK, party to party) =====
const otherPol = (s: GameState, p: Params) => {
  const t = s.politicians[str(p, 'politicianId')];
  return t && t.active && !t.isPlayer ? t : null;
};

def({
  id: 'joint_event', title: 'אירוע ציבורי משותף', icon: '🤝', category: 'career', level: 'simple', capital: 4, cooldown: 1,
  description: 'כנס, סיור או אירוע קהילתי יחד עם ח״כ אחר. מחזק את הקשר ביניכם (+10) ונותן חשיפה לשניכם. אם הוא מגוש אחר – המנהיג שלך עלול להסתייג.',
  unavailable: (s, p) => (otherPol(s, p) ? null : 'בחר ח״כ'),
  run: (s, p) => {
    const t = otherPol(s, p)!;
    remember(s, t.id, 'support', 'אירוע משותף', 10);
    t.popularity = clamp(t.popularity + 1);
    shiftPartyRelation(s, s.player.partyId, t.partyId, 3);
    const cross = s.parties[t.partyId]?.bloc !== s.parties[s.player.partyId]?.bloc;
    applyEffects(s, { playerPopularity: cross ? 2 : 1, playerReputation: cross ? 2 : 0 });
    const l = myLeader(s);
    if (cross && l && !l.isPlayer) remember(s, l.id, 'insult', `אירוע משותף עם ${t.name} מהצד השני`, -4);
    return { title: `אירוע משותף עם ${t.name}`, subtitle: 'יחסים +10', quip: cross ? 'שיתוף פעולה מעבר לקווים הפוליטיים זוכה להערכה בציבור; בבית הפוליטי שלך לא כולם מרוצים.' : 'הקשר ביניכם התחזק.', people: [{ icon: '🤝', label: t.name, text: 'שמח על שיתוף הפעולה.', tone: 'good' }] };
  },
});

def({
  id: 'mutual_support', title: 'הסכם תמיכה הדדית בחקיקה', icon: '🔁', category: 'parliament', level: 'simple', capital: 5, cooldown: 2,
  description: 'אתה מתחייב לתמוך בהצעת חוק שלו, והוא בשלך. יחסים +12, וההצעה הבאה שלך תקבל תמיכה נוספת (+15).',
  unavailable: (s, p) => (otherPol(s, p) ? null : 'בחר ח״כ'),
  run: (s, p) => {
    const t = otherPol(s, p)!;
    remember(s, t.id, 'deal', 'הסכם תמיכה הדדית', 12);
    s.flags.mutual_push = (s.flags.mutual_push ?? 0) + 15;
    for (const b of s.bills.filter((x) => x.status === 'active' && x.sponsorId === s.player.politicianId)) b.push += 15;
    return { title: `הסכם תמיכה הדדית עם ${t.name}`, subtitle: 'יחסים +12 · תמיכה בהצעות שלך +15', quip: 'אם תצביע נגד הצעה שלו בהמשך, הוא יראה בזה הפרה.', people: [{ icon: '🔁', label: t.name, text: 'סגרנו. אני סומך עליך.', tone: 'good' }] };
  },
});

def({
  id: 'public_defense', title: 'הגנה פומבית על עמית', icon: '🛡️', category: 'media', level: 'simple', capital: 2, cooldown: 1,
  description: 'יציאה להגנתו של ח״כ שמותקף בתקשורת. יחסים +14. אם הוא שנוי במחלוקת – גם אתה תספוג ביקורת.',
  unavailable: (s, p) => (otherPol(s, p) ? null : 'בחר ח״כ'),
  run: (s, p) => {
    const t = otherPol(s, p)!;
    remember(s, t.id, 'support', 'הגן עליי בפומבי', 14);
    const risky = t.popularity < 35;
    applyEffects(s, { playerReputation: risky ? -3 : 1, playerPopularity: risky ? -1 : 1 });
    return { title: `הגנת על ${t.name}`, subtitle: 'יחסים +14', quip: risky ? 'הוא לא פופולרי כרגע, וחלק מהביקורת עברה גם אליך.' : 'הגיבוי התקבל בהערכה.', people: [{ icon: '🛡️', label: t.name, text: 'לא אשכח את הגיבוי.', tone: 'good' }] };
  },
});

def({
  id: 'help_primaries', title: 'עזרה לחבר מפלגה בפריימריז', icon: '🗳️', category: 'party', level: 'simple', capital: 5, cooldown: 2,
  description: 'גיוס תומכים ומתפקדים לטובת חבר מפלגה. יחסים +18 וכוחו עולה; מתחריו במפלגה יתרעמו.',
  unavailable: (s, p) => { const t = otherPol(s, p); return !t ? 'בחר ח״כ' : t.partyId !== s.player.partyId ? 'רק חברי המפלגה שלך' : null; },
  run: (s, p) => {
    const t = otherPol(s, p)!;
    remember(s, t.id, 'favor', 'עזר לי בפריימריז', 18);
    t.power = clamp(t.power + 5);
    if (t.listRank && t.listRank > 2) t.listRank = Math.max(2, t.listRank - 2);
    const rival2 = s.parties[s.player.partyId].memberIds.map((id) => s.politicians[id]).find((x) => x && !x.isPlayer && x.id !== t.id && Math.abs((x.listRank ?? 99) - (t.listRank ?? 99)) <= 2);
    if (rival2) remember(s, rival2.id, 'insult', `עזר ל${t.name} נגדי בפריימריז`, -8);
    return { title: `עזרת ל${t.name} בפריימריז`, subtitle: 'יחסים +18 · עלה ברשימה', people: [{ icon: '🗳️', label: t.name, text: 'אני חייב לך.', tone: 'good' }] };
  },
});

def({
  id: 'leaders_meeting', title: 'פגישת ראשי מפלגות', icon: '🏛️', category: 'party', level: 'simple', capital: 5, cooldown: 1,
  description: 'פגישה עם יו״ר מפלגה אחרת לשיפור היחסים בין המפלגות. יחסים בין המפלגות +12, נאמנות היו״ר +8. פגישה עם יריב אידיאולוגי מעוררת שאלות בבסיס.',
  unavailable: (s, p) => (!isPartyLeader(s) ? 'רק יו״ר מפלגה' : !s.parties[str(p, 'partyId')] || str(p, 'partyId') === s.player.partyId ? 'בחר מפלגה אחרת' : null),
  run: (s, p) => {
    const party = s.parties[str(p, 'partyId')];
    const rel = shiftPartyRelation(s, s.player.partyId, party.id, 12);
    remember(s, party.leaderId, 'support', 'פגישת ראשי מפלגות', 8);
    const far = s.parties[s.player.partyId].bloc !== party.bloc;
    if (far) applyEffects(s, { partyMomentum: { [s.player.partyId]: -1 }, playerReputation: 2 });
    addNews(s, `${me(s).name} נפגש עם ${s.politicians[party.leaderId]?.name}, יו״ר ${party.name}`, 'neutral', '🏛️');
    return { title: `פגישה עם יו״ר ${party.name}`, subtitle: `יחסים בין המפלגות: ${rel.toFixed(0)}`, quip: far ? 'הפגישה עם מפלגה מהגוש השני עוררה ביקורת אצל חלק מהמצביעים שלך.' : undefined };
  },
});

def({
  id: 'surplus_agreement', title: 'הסכם עודפים', icon: '➗', category: 'campaign', level: 'simple', capital: 4,
  description: 'הסכם עודפים לבחירות הקרובות: הקולות העודפים של שתי המפלגות מצורפים יחד, וזה עשוי להוסיף מנדט לאחת מהן. צריך יחסים סבירים (20+).',
  unavailable: (s, p) => {
    if (!isPartyLeader(s)) return 'רק יו״ר מפלגה';
    if (monthsUntilElection(s) > 6) return 'הסכמי עודפים נחתמים בחצי השנה שלפני הבחירות';
    if (s.elections.surplusWith) return `כבר נחתם הסכם עודפים עם ${s.parties[s.elections.surplusWith]?.name}`;
    const party = s.parties[str(p, 'partyId')];
    if (!party || party.id === s.player.partyId) return 'בחר מפלגה אחרת';
    return partyRelation(s, s.player.partyId, party.id) < 20 ? 'היחסים בין המפלגות לא מספיק טובים (נדרש 20+)' : null;
  },
  run: (s, p) => {
    const party = s.parties[str(p, 'partyId')];
    s.elections.surplusWith = party.id;
    shiftPartyRelation(s, s.player.partyId, party.id, 5);
    addNews(s, `${s.parties[s.player.partyId].name} ו${party.name} חתמו על הסכם עודפים`, 'neutral', '➗');
    return { title: `הסכם עודפים עם ${party.name}`, quip: 'בחלוקת המנדטים, העודפים של שתי המפלגות יחושבו יחד.' };
  },
});

def({
  id: 'propose_merger', title: 'הצעה לריצה משותפת', icon: '🔗', category: 'campaign', level: 'major', capital: 10, cooldown: 3,
  description: 'איחוד רשימות עם מפלגה קטנה וקרובה. מונע בזבוז קולות מתחת לאחוז החסימה. היו״ר שלה יקבל את המקום השני ברשימה. הסיכוי תלוי ביחסים ובקרבה האידיאולוגית.',
  unavailable: (s, p) => {
    if (!isPartyLeader(s)) return 'רק יו״ר מפלגה';
    if (monthsUntilElection(s) > 8) return 'איחודים נעשים בחודשים שלפני הבחירות';
    const party = s.parties[str(p, 'partyId')];
    if (!party || party.id === s.player.partyId) return 'בחר מפלגה אחרת';
    if (party.pollShare > s.parties[s.player.partyId].pollShare) return 'רק מפלגה קטנה ממך';
    return null;
  },
  run: (s, p) => {
    const party = s.parties[str(p, 'partyId')];
    const rel = partyRelation(s, s.player.partyId, party.id);
    const dist = ideologyDistance(party.ideology, s.parties[s.player.partyId].ideology);
    const pr = clamp(0.25 + rel / 150 - dist * 0.4 + (party.pollShare < 3.5 ? 0.25 : 0), 0.03, 0.85);
    if (rand(s) < pr) {
      mergeParties(s, party.id);
      return { title: `${party.name} מצטרפת לרשימה משותפת`, status: 'approved', subtitle: `הסיכוי היה ${Math.round(pr * 100)}%` };
    }
    shiftPartyRelation(s, s.player.partyId, party.id, -6);
    return { title: `${party.name} דחתה את ההצעה`, status: 'rejected', subtitle: `הסיכוי היה ${Math.round(pr * 100)}%`, people: [{ icon: party.logo, label: s.politicians[party.leaderId]?.name ?? party.name, text: 'נרוץ לבד.', tone: 'neutral' }] };
  },
});

// ===== ELECTION CAMPAIGN (v2) =====
const campaignGate = (s: GameState, cost = 0): string | null => {
  if (!getCapabilities(s).canCampaign) return 'רק יו״ר מפלגה מנהל קמפיין';
  if (!inCampaign(s)) return 'הקמפיין מתחיל 4 חודשים לפני הבחירות';
  if (s.parties[s.player.partyId].funds < cost) return `אין מספיק כסף בקופת המפלגה (נדרש ₪${cost} מיליון)`;
  return null;
};

def({
  id: 'start_campaign', title: 'פתיחת הקמפיין', icon: '🚩', category: 'campaign', level: 'medium', capital: 0,
  description: 'בחירת אסטרטגיה, קהלי יעד, תקציב וסיסמה לקמפיין הבחירות.',
  unavailable: (s, p) => (!getCapabilities(s).canCampaign ? 'רק יו״ר מפלגה' : !inCampaign(s) ? 'הקמפיין עוד לא התחיל' : !STRATEGY_BY_ID[str(p, 'strategy') as keyof typeof STRATEGY_BY_ID] ? 'בחר אסטרטגיה' : null),
  run: (s, p) => {
    const strategy = str(p, 'strategy') as CampaignState['strategy'];
    const targets = [str(p, 't1'), str(p, 't2')].filter((g) => GROUP_BY_ID[g as GroupId]) as GroupId[];
    const budget = (['low', 'mid', 'high'].includes(str(p, 'budget')) ? str(p, 'budget') : 'mid') as CampaignState['budget'];
    const slogan = str(p, 'slogan').trim().slice(0, 40) || STRATEGY_BY_ID[strategy].slogans[0];
    startCampaign(s, strategy, targets, budget, slogan);
    const sal = issueSalience(s)[strategy];
    return { title: `הקמפיין יצא לדרך: "${slogan}"`, subtitle: `${STRATEGY_BY_ID[strategy].name} · תקציב ${BUDGETS[budget].name}`, quip: sal >= 0.9 ? 'הנושא שבחרת בוער כרגע בציבור. האסטרטגיה צפויה להיות אפקטיבית.' : sal <= 0.4 ? 'הנושא שבחרת לא בראש סדר היום כרגע. ההשפעה תהיה מוגבלת, אלא אם המצב ישתנה.' : 'הנושא שבחרת מעניין חלק מהציבור.' };
  },
});

def({
  id: 'field_campaign', title: 'חוגי בית ודלת לדלת', icon: '🚪', category: 'campaign', level: 'simple', capital: 2, cooldown: 1,
  description: 'פעילים ומתנדבים בשטח (₪0.5 מיליון). קמפיין +1.5, ובקהלי היעד שלך גם יותר.',
  unavailable: (s) => campaignGate(s, 0.5),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    party.funds -= 0.5;
    addCampaign(s, party.id, 1.5);
    const t = s.campaign?.targets ?? [];
    applyDecision(s, { playerPopularity: 1, groups: Object.fromEntries(t.map((g) => [g, 1.5])) as Partial<Record<GroupId, number>> });
    return { title: 'אלפי פעילים בשטח', subtitle: 'קמפיין +1.5', quip: 'עבודת שטח בונה תמיכה יציבה, במיוחד בקרב מצביעים מתלבטים.' };
  },
});

def({
  id: 'negative_ad', title: 'קמפיין שלילי נגד מפלגה יריבה', icon: '📉', category: 'campaign', level: 'simple', capital: 3, cooldown: 1,
  description: 'תשדירים נגד מפלגה יריבה (₪2 מיליון). פוגע בה – אבל ב-35% מהמקרים הוא חוזר אליך כבומרנג.',
  unavailable: (s, p) => campaignGate(s, 2) ?? (!s.parties[str(p, 'partyId')] || str(p, 'partyId') === s.player.partyId ? 'בחר מפלגה יריבה' : null),
  run: (s, p) => {
    const party = s.parties[s.player.partyId];
    const t = s.parties[str(p, 'partyId')];
    party.funds -= 2;
    shiftPartyRelation(s, party.id, t.id, -8);
    if (s.campaign) s.campaign.negativeHits += 1;
    if (rand(s) < 0.35 + (s.campaign?.negativeHits ?? 0) * 0.05) {
      addCampaign(s, party.id, -2);
      applyEffects(s, { playerReputation: -3, partyMomentum: { [t.id]: 1 } });
      addNews(s, `ביקורת על הקמפיין השלילי של ${party.name}`, 'bad', '📉');
      return { title: 'הקמפיין השלילי חזר כבומרנג', status: 'rejected', quip: 'הציבור ראה בו התקפה לא הוגנת. ככל שמשתמשים בזה יותר – הסיכון עולה.' };
    }
    applyEffects(s, { partyMomentum: { [t.id]: -4 } });
    addCampaign(s, party.id, 1);
    return { title: `הקמפיין נגד ${t.name} פגע`, status: 'approved', quip: `${t.name} נאלצת להתגונן.` };
  },
});

def({
  id: 'internal_poll', title: 'סקר פנימי', icon: '📋', category: 'campaign', level: 'simple', capital: 1, cooldown: 1,
  description: 'סקר מעמיק של המפלגה (₪0.3 מיליון): הערכה מדויקת של המנדטים ושל הנושא שהכי מעסיק את הבוחרים.',
  unavailable: (s) => (!isPartyLeader(s) ? 'רק יו״ר מפלגה' : s.parties[s.player.partyId].funds < 0.3 ? 'אין מספיק כסף בקופה' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    party.funds -= 0.3;
    const seats = seatsFromShares(computeShares(s, 0))[party.id] ?? 0;
    const sal = issueSalience(s);
    const top = (Object.entries(sal) as [CampaignState['strategy'], number][]).sort((a, b) => b[1] - a[1])[0][0];
    if (s.campaign) s.campaign.internalPoll = { turn: s.turn, seats, low: Math.max(0, seats - 2), high: seats + 2, topIssue: top };
    return { title: `הסקר הפנימי: ${Math.max(0, seats - 2)}–${seats + 2} מנדטים`, subtitle: `הנושא הבוער: ${STRATEGY_BY_ID[top].name}`, quip: s.campaign && s.campaign.strategy !== top ? `האסטרטגיה שלך (${STRATEGY_BY_ID[s.campaign.strategy].name}) לא תואמת את מה שמעסיק את הבוחרים כרגע.` : 'האסטרטגיה שלך תואמת את מה שמעסיק את הבוחרים.' };
  },
});

def({
  id: 'public_endorsement', title: 'תמיכה פומבית של אישיות ציבורית', icon: '🎖️', category: 'campaign', level: 'simple', capital: 3, cooldown: 2,
  description: 'אישיות ציבורית מוכרת (אלוף במילואים, כלכלנית, אמן) מודיעה על תמיכה במפלגה. קמפיין +2.',
  unavailable: (s) => campaignGate(s),
  run: (s) => {
    const kinds = [
      { who: 'אלוף במילואים', g: { reservists: 3, right: 1 } }, { who: 'כלכלנית בכירה', g: { middleClass: 2, highIncome: 2 } },
      { who: 'אמן ידוע', g: { youth: 3, secular: 1 } }, { who: 'רב מוכר', g: { religious: 3, haredim: 1 } }, { who: 'ראש עיר בפריפריה', g: { periphery: 3 } },
    ];
    const k = pick(s, kinds);
    addCampaign(s, s.player.partyId, 2);
    applyDecision(s, { groups: k.g as Partial<Record<GroupId, number>> });
    addNews(s, `${k.who} מודיע/ה על תמיכה ב${s.parties[s.player.partyId].name}`, 'good', '🎖️');
    return { title: `${k.who} תומך/ת בך`, subtitle: 'קמפיין +2' };
  },
});

def({
  id: 'gotv', title: 'הוצאת מצביעים ביום הבחירות', icon: '🗳️', category: 'campaign', level: 'simple', capital: 3, cooldown: 1,
  description: 'הסעות, מוקדים טלפוניים ופעילים בקלפיות (₪2 מיליון). רק בשבועיים האחרונים. קמפיין +3.',
  unavailable: (s) => campaignGate(s, 2) ?? (daysBetween(s.date, electionDate(s)) > 15 ? 'רק בשבועיים האחרונים לפני הבחירות' : null),
  run: (s) => {
    s.parties[s.player.partyId].funds -= 2;
    addCampaign(s, s.player.partyId, 3);
    return { title: 'מערך יום הבחירות מוכן', subtitle: 'קמפיין +3', quip: 'אחוז ההצבעה בקרב התומכים שלך צפוי לעלות.' };
  },
});

// ===== SECURITY & DIPLOMACY (v2) =====
/** A minister (not PM) needs the PM's approval for a security or diplomatic move. hawkish: +1 escalation, -1 concession. */
function pmSecurityApproval(s: GameState, hawkish: number): RunResult | null {
  if (isPM(s)) return null;
  const pm = s.politicians[s.government.pmId];
  const ok = rand(s) < clamp(0.35 + (pm.loyalty - 50) / 90 + pm.ideology.security * hawkish * 0.35, 0.05, 0.92);
  if (ok) return null;
  remember(s, pm.id, 'ignored', 'ביקש לאשר מהלך ביטחוני-מדיני', -2);
  return { status: 'rejected', title: 'ראש הממשלה לא אישר', people: [{ icon: '🪑', label: pm.name, text: hawkish > 0 ? 'לא בשלב הזה. הסיכון גבוה מדי.' : 'זה לא תואם את מדיניות הממשלה.', tone: 'bad' }] };
}

def({
  id: 'internal_security', title: 'ביטחון פנים', icon: '🚓', category: 'government', level: 'medium',
  capital: (_s, p) => INTERNAL_BY_ID[str(p, 'opId')]?.capital ?? 3,
  description: 'פעולות משטרה, שב״כ ושב״ס בתוך המדינה: מבצעים נגד פשיעה וטרור, שיטור קהילתי, אכיפה ותנאי כליאה.',
  cooldown: 3,
  unavailable: (s, p) => {
    if (!canUseInternalSecurity(s)) return 'רק ראש הממשלה והשר לביטחון לאומי';
    if (!INTERNAL_BY_ID[str(p, 'opId')]) return 'בחר פעולה';
    return null;
  },
  estimate: (_s, p) => INTERNAL_BY_ID[str(p, 'opId')]?.good ?? {},
  run: (s, p) => {
    const o = INTERNAL_BY_ID[str(p, 'opId')]!;
    const police = s.budget.allocations.police / Math.max(0.1, s.budget.needs.police);
    const m = s.government.ministries.find((x) => x.id === 'national_security');
    // better funding and a more efficient ministry make the plan work
    const chanceOk = clamp(o.base + (police - 1) * 0.35 + ((m?.efficiency ?? 50) - 50) / 250, 0.2, 0.95);
    const ok = rand(s) < chanceOk;
    applyDecision(s, { ...(ok ? o.good : o.bad), ...(o.cost ? { budget: { police: o.cost } } : {}) });
    return { title: ok ? `${o.title}: הצליח` : `${o.title}: נתקל בקשיים`, status: ok ? 'approved' : 'rejected', quip: ok ? o.goodText : o.badText };
  },
});

def({
  id: 'security_operation', title: 'מבצע צבאי', icon: '🎖️', category: 'government', level: 'major', capital: (_s, p) => (OPERATION_BY_ID[str(p, 'opId')]?.needsCabinet ? 8 : 4),
  description: 'תכנון מבצע בחזית מסוימת. מבצעים גדולים דורשים אישור הקבינט המדיני-ביטחוני.',
  unavailable: (s, p) => {
    const role = securityRole(s);
    if (!role || role === 'internal') return 'רק ראש הממשלה ושר הביטחון';
    const op = OPERATION_BY_ID[str(p, 'opId')];
    const front = str(p, 'front') as FrontId;
    if (!op) return 'בחר סוג מבצע';
    if (!op.fronts.includes(front)) return 'המבצע לא מתאים לחזית הזו';
    if ((s.flags[`op_${front}`] ?? -1) >= s.turn) return 'כבר בוצע מבצע בחזית הזו בתור הנוכחי';
    return null;
  },
  run: (s, p) => {
    const op = OPERATION_BY_ID[str(p, 'opId')];
    const front = str(p, 'front') as FrontId;
    const rej = pmSecurityApproval(s, 1);
    if (rej) return rej;
    let lines: ReactionLine[] = [];
    if (op.needsCabinet) {
      const v = cabinetVote(s, 1, op.risk);
      lines = v.lines;
      if (!v.passed) return { status: 'rejected', title: `הקבינט דחה את המבצע (${v.yes}-${v.no})`, subtitle: `${op.name} – ${FRONT_BY_ID[front].name}`, people: lines };
    }
    s.flags[`op_${front}`] = s.turn;
    const o = executeOperation(s, op, front);
    return { status: o.success ? 'approved' : 'rejected', title: o.headline, subtitle: op.needsCabinet ? 'באישור הקבינט המדיני-ביטחוני' : undefined, quip: o.text, people: [...o.lines, ...lines].slice(0, 6) };
  },
});

def({
  id: 'diplomacy', title: 'מהלך מדיני', icon: '🕊️', category: 'government', level: 'major',
  capital: (_s, p) => ({ channel_secret: 2, channel_open: 3, ceasefire: 6, cbm: 5, transfer: 12, annex: 12, normalize: 10 } as Record<string, number>)[str(p, 'kind')] ?? 4,
  description: 'ערוצי הידברות, הפסקות אש בתיווך, צעדים בוני אמון, העברת שטחים ונורמליזציה.',
  unavailable: (s, p) => {
    const role = securityRole(s);
    if (!role || role === 'internal') return 'רק ראש הממשלה ושר הביטחון';
    const kind = str(p, 'kind');
    if (!['channel_secret', 'channel_open', 'ceasefire', 'cbm', 'transfer', 'annex', 'normalize'].includes(kind)) return 'בחר מהלך';
    if ((kind === 'channel_secret' || kind === 'channel_open' || kind === 'ceasefire') && !CHANNEL_BY_ID[str(p, 'channel') as ChannelId]) return 'בחר ערוץ';
    if (kind === 'ceasefire' && !FRONT_BY_ID[str(p, 'front') as FrontId]) return 'בחר חזית';
    if (kind === 'ceasefire' && !['egypt', 'qatar', 'usa', 'jordan'].includes(str(p, 'channel'))) return 'הפסקת אש מושגת בתיווך מצרים, קטאר, ירדן או ארה״ב';
    if ((s.flags[`dip_${kind}`] ?? -1) >= s.turn) return 'כבר בוצע מהלך כזה בתור הנוכחי';
    return null;
  },
  run: (s, p) => {
    const kind = str(p, 'kind');
    s.flags[`dip_${kind}`] = s.turn;
    const concession = kind === 'cbm' || kind === 'transfer' || kind === 'normalize';
    const hardline = kind === 'annex';
    const rej = concession ? pmSecurityApproval(s, -1) : null;
    if (rej) return rej;
    let lines: ReactionLine[] = [];
    if (kind === 'transfer' || kind === 'cbm' || hardline) {
      const v = cabinetVote(s, hardline ? 1 : -1, kind === 'cbm' ? 0.3 : 1);
      lines = v.lines;
      if (!v.passed) return { status: 'rejected', title: `הקבינט דחה את המהלך (${v.yes}-${v.no})`, people: lines };
    }
    const o = kind === 'channel_secret' || kind === 'channel_open' ? openChannel(s, str(p, 'channel') as ChannelId, kind === 'channel_open')
      : kind === 'ceasefire' ? mediatedCeasefire(s, str(p, 'front') as FrontId, str(p, 'channel') as ChannelId)
        : kind === 'cbm' ? confidenceMeasure(s, (str(p, 'cbm') || 'permits') as CbmKind)
          : kind === 'annex' ? takeBackArea(s, str(p, 'from') === 'A' ? 'A' : 'B', str(p, 'from') === 'A' ? 'B' : 'C')
          : kind === 'transfer' ? transferArea(s, str(p, 'from') === 'B' ? 'B' : 'C')
            : normalization(s, 'saudi');
    return { status: o.ok ? 'approved' : 'rejected', title: o.title, quip: o.text, people: [...(o.lines ?? []), ...lines].slice(0, 6) };
  },
});

def({
  id: 'unit_training', title: 'אימון והצטיידות של יחידה', icon: '🏋️', category: 'government', level: 'simple', capital: 2,
  description: 'אימון מרוכז והשלמת ציוד: כשירות היחידה +15 (₪0.3 מיליארד).',
  unavailable: (s, p) => {
    const role = securityRole(s);
    if (role !== 'pm' && role !== 'defense') return 'רק ראש הממשלה ושר הביטחון';
    if (!UNIT_BY_ID[str(p, 'unitId') as UnitId]) return 'בחר יחידה';
    return (s.flags[`train_${str(p, 'unitId')}`] ?? -1) >= s.turn ? 'היחידה כבר באימון בתור הנוכחי' : null;
  },
  run: (s, p) => {
    s.flags[`train_${str(p, 'unitId')}`] = s.turn;
    applyDecision(s, { oneOffCost: 0.3 });
    const o = unitTraining(s, str(p, 'unitId') as UnitId);
    return { title: o.title, subtitle: o.text };
  },
});

// ===== SPEECHES =====
def({
  id: 'give_speech', title: 'נאום', icon: '🎤', category: 'media', level: 'simple', capital: 3, cooldown: 1,
  description: 'נאום לציבור: הבמה, הנושא, העמדה והטון קובעים מי יאהב את הדברים ומי יתנגד.',
  unavailable: (s, p) => {
    if (!VENUES[str(p, 'venue') as Venue]) return 'בחר במה';
    if (!TOPIC_BY_ID[str(p, 'topic')]) return 'בחר נושא';
    if (str(p, 'venue') === 'ceremony' && !isPM(s) && s.player.role !== 'minister') return 'בטקס ממלכתי נואמים ראש הממשלה והשרים';
    if (str(p, 'venue') === 'plenum' && s.government.caretaker && s.elections.phase === 'none') return 'הכנסטון התפזר – אין דיוני מליאה עד הבחירות';
    return null;
  },
  run: (s, p) => {
    const o = deliverSpeech(s, { venue: str(p, 'venue') as Venue, topic: str(p, 'topic'), stance: num(p, 'stance'), tone: (str(p, 'tone') || 'statesman') as Tone, audience: (str(p, 'audience') || '') as GroupId | '', words: num(p, 'words') });
    return { title: o.title, quip: o.text, people: o.lines };
  },
});

// ===== CAMPAIGN =====
def({
  id: 'campaign_rally', title: 'כנס בחירות', icon: '📢', category: 'campaign', level: 'simple', capital: 2, cooldown: 1,
  description: 'כנס תומכים (₪1.5 מיליון מקופת המפלגה). קמפיין +2 ופופולריות +1.',
  unavailable: (s) => (!getCapabilities(s).canCampaign ? 'רק מנהיג מפלגה' : monthsUntilElection(s) > 6 ? 'הקמפיין מתחיל חצי שנה לפני הבחירות' : s.parties[s.player.partyId].funds < 1.5 ? 'אין כסף במפלגה' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    party.funds -= 1.5;
    addCampaign(s, party.id, 2);
    applyEffects(s, { playerPopularity: 1 });
    return { title: 'כנס מוצלח', subtitle: 'קמפיין +2', quip: 'אלפי תומכים הגיעו, והכנס סוקר בתקשורת.' };
  },
});

def({
  id: 'campaign_ads', title: 'קמפיין פרסום', icon: '🖼️', category: 'campaign', level: 'simple', capital: 1, cooldown: 1,
  description: 'שלטי חוצות, דיגיטל ותשדירים (₪4 מיליון). קמפיין +4, עם תשואה פוחתת.',
  unavailable: (s) => (!getCapabilities(s).canCampaign ? 'רק מנהיג מפלגה' : monthsUntilElection(s) > 6 ? 'הקמפיין מתחיל חצי שנה לפני הבחירות' : s.parties[s.player.partyId].funds < 4 ? 'אין כסף במפלגה' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    party.funds -= 4;
    addCampaign(s, party.id, 4);
    return { title: 'הקמפיין עלה לאוויר', subtitle: 'קמפיין +4', quip: `הסלוגן: "${party.slogan}"` };
  },
});

def({
  id: 'debate', title: 'עימות טלוויזיוני', icon: '🎤', category: 'campaign', level: 'medium', capital: 4, cooldown: 2,
  description: 'עימות מול מועמדים אחרים. ניצחון: קמפיין +5; הפסד: קמפיין -3. הסיכוי תלוי במוניטין ובפופולריות.',
  unavailable: (s) => (!getCapabilities(s).canCampaign ? 'רק מנהיג מפלגה' : !inCampaign(s) ? 'עימותים מתקיימים רק בתקופת הבחירות' : null),
  run: (s) => {
    const win = rand(s) < 0.35 + s.player.reputation / 250 + me(s).popularity / 300;
    const party = s.parties[s.player.partyId];
    addCampaign(s, party.id, win ? 5 : -3);
    addNews(s, win ? `פרשנים: ${me(s).name} ניצח בעימות` : `פרשנים: ${me(s).name} התקשה בעימות`, win ? 'good' : 'bad', '🎤');
    return { title: win ? 'ניצחת בעימות' : 'העימות לא הלך טוב', status: win ? 'approved' : 'rejected' };
  },
});

def({
  id: 'seek_endorsement', title: 'התחייבות להמליץ', icon: '✍️', category: 'campaign', level: 'medium', capital: 8, cooldown: 1,
  description: 'מנהיג מפלגה אחרת מתחייב להמליץ עליך לנשיא אחרי הבחירות. הסיכוי תלוי בקרבה האידיאולוגית וביחסים.',
  unavailable: (s, p) => {
    if (!isPartyLeader(s)) return 'רק מנהיג מפלגה';
    if (monthsUntilElection(s) > 12) return 'רק בשנה שלפני הבחירות';
    const party = s.parties[str(p, 'partyId')];
    if (!party || party.id === s.player.partyId) return 'בחר מפלגה אחרת';
    if ((s.flags[`endorse_${party.id}`] ?? -1) === s.elections.scheduledTurn) return 'כבר התחייבו לך';
    return null;
  },
  run: (s, p) => {
    const party = s.parties[str(p, 'partyId')];
    const leader = s.politicians[party.leaderId];
    const mine = s.parties[s.player.partyId];
    const dist = Math.sqrt((party.ideology.economic - mine.ideology.economic) ** 2 + (party.ideology.security - mine.ideology.security) ** 2 + (party.ideology.religion - mine.ideology.religion) ** 2) / 2;
    const chanceOk = clamp(0.2 + (leader.loyalty - 50) / 90 + (0.8 - dist) * 0.5 + (s.parties[s.player.partyId].pollShare - party.pollShare) / 100, 0.03, 0.85);
    if (rand(s) < chanceOk) {
      s.flags[`endorse_${party.id}`] = s.elections.scheduledTurn;
      remember(s, leader.id, 'deal', 'התחייב להמליץ עליך', 6);
      addNews(s, `${leader.name}: "אחרי הבחירות נמליץ על ${me(s).name}"`, 'good', '✍️');
      return { title: `${party.name} התחייבה להמליץ עליך`, status: 'approved', subtitle: `הסיכוי היה ${Math.round(chanceOk * 100)}%`, quip: 'התחייבות פומבית, אבל המבחן האמיתי יהיה אחרי התוצאות.' };
    }
    leader.loyalty = clamp(leader.loyalty - 3);
    return { title: `${leader.name} לא מתחייב`, status: 'rejected', subtitle: `הסיכוי היה ${Math.round(chanceOk * 100)}%`, people: [{ icon: party.logo, label: leader.name, text: 'נחליט אחרי הבחירות.', tone: 'neutral' }] };
  },
});

def({
  id: 'make_promise', title: 'הבטחת בחירות', icon: '🤞', category: 'campaign', level: 'simple', capital: 2,
  description: 'התחייבות פומבית. מושכת מצביעים עכשיו; אם לא תקיים אותה, הציבור יזכור.',
  unavailable: (s, p) => (!getCapabilities(s).canMakePromises ? 'הבטחות רק כמנהיג מפלגה, בשנה שלפני הבחירות' : !PROMISE_BY_ID[str(p, 'promiseId')] ? 'בחר הבטחה' : PROMISE_BY_ID[str(p, 'promiseId')].kept(PROMISE_BY_ID[str(p, 'promiseId')].measure(s), PROMISE_BY_ID[str(p, 'promiseId')].measure(s)) ? 'זה כבר קרה: אי אפשר להבטיח את מה שכבר בוצע' : null),
  run: (s, p) => {
    const r = makePromise(s, str(p, 'promiseId'));
    return { title: r.title, subtitle: r.subtitle, status: r.status, quip: r.quip };
  },
});

// ===== KNESSETON SPEAKER =====
const speakerOnly = (s: GameState) => (isSpeaker(s) ? null : 'רק יו״ר הכנסטון');
const activeBill = (s: GameState, p: Params) => s.bills.find((b) => b.id === str(p, 'billId') && b.status === 'active');
def({
  id: 'speaker_schedule', title: 'קידום הצעה בסדר היום', icon: '📅', category: 'parliament', level: 'simple', capital: 4, cooldown: 1,
  description: 'היו״ר קובע מה עולה למליאה. קידום מהיר מגדיל את סיכויי ההצעה (+15).',
  unavailable: (s, p) => speakerOnly(s) ?? (activeBill(s, p) ? null : 'ההצעה לא פעילה'),
  run: (s, p) => { const b = activeBill(s, p)!; b.push += 15; return { title: `"${b.title}" עלתה לראש סדר היום`, quip: 'מי שקובע את סדר היום קובע הרבה.' }; },
});
def({
  id: 'speaker_delay', title: 'עיכוב הצעה', icon: '⏸️', category: 'parliament', level: 'simple', capital: 6, cooldown: 1,
  description: 'דחיית הדיון בהצעה. מקטין את סיכוייה (-15), אבל תומכיה יכעסו.',
  unavailable: (s, p) => speakerOnly(s) ?? (activeBill(s, p) ? null : 'ההצעה לא פעילה'),
  run: (s, p) => { const b = activeBill(s, p)!; b.push -= 15; applyEffects(s, { playerReputation: -1 }); return { title: `הדיון ב"${b.title}" נדחה`, quip: 'התומכים טוענים לשימוש פוליטי בסמכות.' }; },
});
def({
  id: 'speaker_mediate', title: 'תיווך בין קואליציה לאופוזיציה', icon: '🤝', category: 'parliament', level: 'medium', capital: 6, cooldown: 2,
  description: 'פגישה משותפת להורדת המתחים. מעלה את יציבות הממשלה ואת המוניטין שלך.',
  unavailable: speakerOnly,
  run: (s) => { s.flags.speakerMediations = (s.flags.speakerMediations ?? 0) + 1; applyEffects(s, { stability: 4, playerReputation: 3 }); return { title: 'הצלחת להרגיע את המליאה', quip: 'שני הצדדים יצאו וטענו שניצחו.' }; },
});
def({
  id: 'speaker_debate', title: 'דיון מיוחד במליאה', icon: '🎙️', category: 'parliament', level: 'simple', capital: 4, cooldown: 2,
  description: 'כינוס דיון מיוחד בנושא שבוער לציבור. מעלה את הפופולריות שלך.',
  unavailable: speakerOnly,
  run: (s) => { applyEffects(s, { playerPopularity: 3 }); return { title: 'דיון מיוחד התקיים במליאה', quip: 'הציבור ראה שהכנסטון עוסק במה שחשוב לו.' }; },
});
def({
  id: 'speaker_discipline', title: 'הרחקת ח״כים מפריעים', icon: '🚪', category: 'parliament', level: 'simple', capital: 3, cooldown: 2,
  description: 'אכיפת הסדר במליאה. מעלה מוניטין ויציבות, אבל מרגיז את המורחקים.',
  unavailable: speakerOnly,
  run: (s) => { applyEffects(s, { playerReputation: 2, stability: 2 }); return { title: 'הסדר במליאה הוחזר', quip: 'המורחקים כבר בדרך לאולפנים.' }; },
});
def({
  id: 'speaker_visit', title: 'אירוח מנהיג זר בכנסטון', icon: '🌍', category: 'parliament', level: 'medium', capital: 5, cooldown: 3,
  description: 'נאום של מנהיג זר במליאה. מחזק את מעמדך הבינלאומי ואת המוניטין.',
  unavailable: speakerOnly,
  run: (s) => { applyEffects(s, { playerReputation: 4, playerPopularity: 2 }); return { title: 'מנהיג זר נאם בכנסטון', quip: 'התמונות מהטקס הגיעו לכל העולם.' }; },
});
def({
  id: 'speaker_ethics', title: 'כינוס ועדת האתיקה', icon: '⚖️', category: 'parliament', level: 'simple', capital: 4, cooldown: 3,
  description: 'בירור תלונות על התנהגות חברי כנסטון. משפר את אמון הציבור במוסד.',
  unavailable: speakerOnly,
  run: (s) => { applyEffects(s, { playerReputation: 3 }); return { title: 'ועדת האתיקה פסקה', quip: 'הציבור אהב, החברים פחות.' }; },
});
def({
  id: 'speaker_open_day', title: 'יום פתוח בכנסטון', icon: '🏛️', category: 'parliament', level: 'simple', capital: 2, cooldown: 3,
  description: 'אלפי אזרחים מבקרים בכנסטון. מעלה פופולריות.',
  unavailable: speakerOnly,
  run: (s) => { applyEffects(s, { playerPopularity: 2 }); return { title: 'יום פתוח מוצלח בכנסטון', quip: 'תורים ארוכים, צילומים ליד המנורה.' }; },
});
def({
  id: 'speaker_reform', title: 'רפורמה בתקנון הכנסטון', icon: '📘', category: 'parliament', level: 'major', capital: 10, cooldown: 6,
  description: 'קיצור נאומים, שקיפות בהצבעות ושידור הוועדות. מוניטין גבוה ויציבות.',
  unavailable: speakerOnly,
  run: (s) => { s.flags.speakerReform = 1; applyEffects(s, { playerReputation: 5, stability: 3 }); return { title: 'תקנון הכנסטון עודכן', quip: 'הנאומים התקצרו. כמעט.' }; },
});

def({
  id: 'speaker_fast_track', title: 'קיצור הליכים להצעה', icon: '⏩', category: 'parliament', level: 'medium', capital: 8, cooldown: 1,
  description: 'היו״ר מקצר את זמני הדיון בהצעה מסוימת (+25 לסיכוייה). מי שחושב שזה שימוש לא ראוי בסמכות יפגע במוניטין שלך.',
  unavailable: (s, p) => speakerOnly(s) ?? (activeBill(s, p) ? null : 'ההצעה לא פעילה'),
  run: (s, p) => { const b = activeBill(s, p)!; b.push += 25; applyEffects(s, { playerReputation: -2 }); return { title: `"${b.title}" קודמה בהליך מקוצר`, quip: 'האופוזיציה טוענת שהיו״ר מנצל את הכיסא.' }; },
});
def({
  id: 'speaker_committees', title: 'חלוקת ועדות הכנסטון', icon: '🗂️', category: 'parliament', level: 'medium', capital: 7, cooldown: 4,
  description: 'דיון עם ראשי הסיעות על חלוקת ראשות הוועדות. מחזק את היציבות ואת המוניטין, ומשפר יחסים עם הסיעות.',
  unavailable: speakerOnly,
  run: (s) => {
    for (const party of Object.values(s.parties)) if (party.seats > 0 && party.id !== s.player.partyId) shiftPartyRelation(s, s.player.partyId, party.id, 1);
    applyEffects(s, { stability: 2, playerReputation: 3 });
    return { title: 'הוסכם על חלוקת הוועדות', quip: 'כל סיעה קיבלה משהו, ואף אחת לא מרוצה לגמרי.' };
  },
});
def({
  id: 'speaker_question_time', title: 'שעת שאלות לראש הממשלה', icon: '❓', category: 'parliament', level: 'simple', capital: 5, cooldown: 2,
  description: 'כינוס שעת שאלות שבה ראש הממשלה נדרש להשיב לחברי הכנסטון. מעלה פופולריות, אבל מערער מעט את הממשלה.',
  unavailable: speakerOnly,
  run: (s) => { applyEffects(s, { playerPopularity: 3, stability: -1 }); return { title: 'ראש הממשלה ענה לשאלות', quip: 'התשובות היו ארוכות, והשאלות קצרות.' }; },
});
def({
  id: 'speaker_leaders_meeting', title: 'ארוחה עם ראשי הסיעות', icon: '🍽️', category: 'parliament', level: 'simple', capital: 4, cooldown: 3,
  description: 'פגישה לא רשמית עם ראשי הסיעות. משפרת יחסים עם כל המפלגות, ללא יוצא מן הכלל.',
  unavailable: speakerOnly,
  run: (s) => {
    for (const party of Object.values(s.parties)) if (party.seats > 0 && party.id !== s.player.partyId) shiftPartyRelation(s, s.player.partyId, party.id, 2);
    return { title: 'ראשי הסיעות נפגשו אצל היו״ר', quip: 'דיברו על הכל חוץ מהדברים החשובים.' };
  },
});
def({
  id: 'speaker_briefing', title: 'תדריך ביטחוני לחברי הכנסטון', icon: '🛡️', category: 'parliament', level: 'simple', capital: 4, cooldown: 3,
  description: 'תדריך סגור עם גורמי הביטחון לכל חברי הכנסטון. מעלה אמון ויציבות.',
  unavailable: speakerOnly,
  run: (s) => { applyEffects(s, { stability: 2, playerReputation: 2, groups: { right: 1, center: 1 } }); return { title: 'התקיים תדריך ביטחוני לחברי הכנסטון', quip: 'כולם יצאו עם אותם פרטים ועם פרשנות אחרת.' }; },
});
def({
  id: 'speaker_youth', title: 'כנסטון הנוער', icon: '🎓', category: 'parliament', level: 'simple', capital: 3, cooldown: 3,
  description: 'מפגש נוער במליאה עם דיון בהצעות חוק. מעלה את הפופולריות בקרב צעירים וסטודנטים.',
  unavailable: speakerOnly,
  run: (s) => { applyEffects(s, { playerPopularity: 2, groups: { youth: 4, students: 3 } }); return { title: 'בני הנוער ישבו במליאה', quip: 'הם הצביעו מהר יותר מהמבוגרים.' }; },
});
def({
  id: 'speaker_inquiry', title: 'ועדת חקירה פרלמנטרית', icon: '🔎', category: 'parliament', level: 'major', capital: 9, cooldown: 6,
  description: 'הקמת ועדת חקירה בנושא שהציבור דורש לבדוק. מעלה מוניטין ואמון בכנסטון, אבל פוגעת ביציבות הממשלה ומרגיזה את הקואליציה.',
  unavailable: speakerOnly,
  run: (s) => { applyEffects(s, { playerReputation: 4, stability: -3, groups: { liberals: 3, left: 2, right: -1 } }); return { title: 'ועדת חקירה פרלמנטרית הוקמה', quip: 'הקואליציה לא שמחה, והציבור סקרן.' }; },
});

export const ACTIONS: Record<string, ActionDef> = Object.fromEntries(A.map((a) => [a.id, a]));

export function actionCapital(s: GameState, id: string, p: Params): number {
  const a = ACTIONS[id];
  if (!a) return 0;
  return typeof a.capital === 'function' ? a.capital(s, p) : a.capital ?? 0;
}

export function cooldownLeft(s: GameState, id: string, p: Params = {}): number {
  const key = cooldownKey(id, p);
  return Math.max(0, (s.player.actionCooldowns[key] ?? 0) - s.turn);
}
// per ministry or per bill: voting on (or pushing) one bill doesn't block the others in the same turn
const cooldownKey = (id: string, p: Params) => (p.ministryId ? `${id}_${p.ministryId}` : p.billId ? `${id}_${p.billId}` : p.opId ? `${id}_${p.opId}` : id);

export function checkAction(s: GameState, id: string, p: Params = {}): string | null {
  const a = ACTIONS[id];
  if (!a) return 'פעולה לא קיימת';
  if (s.gameOver) return 'המשחק נגמר';
  if (s.elections.phase === 'offers') return 'קודם צריך להחליט על הצעות הקואליציה';
  if (s.elections.phase === 'negotiation') return 'קודם צריך להרכיב ממשלה';
  const r = a.unavailable(s, p);
  if (r) return r;
  const cd = cooldownLeft(s, id, p);
  if (cd > 0) return `זמין שוב בעוד ${turnsText(cd)}`;
  if (actionCapital(s, id, p) > s.player.politicalCapital) return 'אין מספיק הון פוליטי';
  return null;
}

// ---------------- Reaction builder ----------------
export function buildReaction(prev: GameState, next: GameState, rr: RunResult, a: ActionDef, capital: number): Reaction {
  const stats: Reaction['stats'] = [];
  const dRev = next.economy.revenue - prev.economy.revenue;
  const dSpend = next.economy.spending - prev.economy.spending;
  const dDef = deficitPct(next) - deficitPct(prev);
  if (Math.abs(dRev) >= 0.05) stats.push({ icon: '📈', label: 'הכנסות המדינה', value: `${dRev > 0 ? '+' : ''}₪${round1(dRev)}B`, tone: dRev > 0 ? 'good' : 'bad' });
  if (Math.abs(dSpend) >= 0.05) stats.push({ icon: '💸', label: 'הוצאות שנתיות', value: `${dSpend > 0 ? '+' : ''}₪${round1(dSpend)}B`, tone: dSpend > 0 ? 'bad' : 'good' });
  const debtJump = next.economy.debt - prev.economy.debt;
  if (debtJump >= 0.05) stats.push({ icon: '🏦', label: 'חוב (חד-פעמי)', value: `+₪${round1(debtJump)}B`, tone: 'bad' });
  if (Math.abs(dDef) >= 0.05) stats.push({ icon: '📉', label: 'גירעון', value: `${dDef > 0 ? '+' : ''}${dDef.toFixed(1)}%`, tone: dDef > 0 ? 'bad' : 'good' });
  for (const svc of SERVICES) {
    const dq = next.services[svc.id].quality - prev.services[svc.id].quality + (next.services[svc.id].bonus - prev.services[svc.id].bonus);
    if (Math.abs(dq) >= 0.5) stats.push({ icon: svc.icon, label: `${svc.name} (צפי)`, value: `${dq > 0 ? '+' : ''}${dq.toFixed(1)}`, tone: dq > 0 ? 'good' : 'bad' });
  }
  const dAppr = next.government.approval - prev.government.approval;
  if (Math.abs(dAppr) >= 0.1) stats.push({ icon: '📊', label: 'שביעות רצון כללית', value: `${dAppr > 0 ? '+' : ''}${dAppr.toFixed(1)}`, tone: dAppr > 0 ? 'good' : 'bad' });
  const dPop = next.politicians[next.player.politicianId].popularity - prev.politicians[prev.player.politicianId].popularity;
  if (Math.abs(dPop) >= 0.5) stats.push({ icon: '⭐', label: 'הפופולריות שלך', value: `${dPop > 0 ? '+' : ''}${dPop.toFixed(0)}`, tone: dPop > 0 ? 'good' : 'bad' });
  if (capital) stats.push({ icon: '🎯', label: 'הון פוליטי', value: `-${capital}`, tone: 'neutral' });

  const deltas = GROUPS.map((g) => ({ g, d: next.population.groups[g.id].satisfaction - prev.population.groups[g.id].satisfaction }))
    .filter((x) => Math.abs(x.d) >= 0.4).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 5);
  const groups: ReactionLine[] = deltas.map(({ g, d }) => ({ icon: g.emoji, label: g.name, text: `${N.groupReaction(next, g.id, d)} (${d > 0 ? '+' : ''}${d.toFixed(1)})`, tone: d > 0.4 ? 'good' : d < -0.4 ? 'bad' : 'neutral' }));
  if (!groups.length && !['media', 'career', 'campaign', 'party'].includes(a.category)) {
    const g = GROUP_BY_ID.youth;
    groups.push({ icon: g.emoji, label: g.name, text: 'ההחלטה לא משפיעה עליהם ישירות.', tone: 'neutral' });
  }

  const people = [...(rr.people ?? [])];
  // everyone has an opinion: a rival and a voice of "the people" react to every decision
  if (people.length < 3 && a.id !== 'drama') {
    // reactions that follow the decision's real direction and each speaker's ideology; the generic chorus only fills in when nothing is clear
    const moved: Partial<Record<GroupId, number>> = Object.fromEntries(GROUPS.map((g) => [g.id, next.population.groups[g.id].satisfaction - prev.population.groups[g.id].satisfaction]));
    const named = decisionReactions(next, rr.title ?? a.title, moved, (rr.status ?? 'approved') !== 'rejected');
    people.push(...named.slice(0, 3 - people.length));
    if (people.length < 2) people.push(...N.chorus(next, (rr.status ?? 'approved') !== 'rejected', a.category).slice(0, 2 - people.length));
  }
  if (deficitPct(next) > 4.5 && dSpend > 0.5) {
    people.push({ icon: '🧠', label: 'היועץ', text: `${N.advisorTone(next)} הגירעון כבר ${deficitPct(next).toFixed(1)}%.`, tone: 'bad' });
  }
  return {
    title: rr.title ?? a.title,
    subtitle: rr.subtitle,
    status: rr.status ?? 'approved',
    stats: stats.slice(0, 6),
    groups,
    people,
    quip: rr.quip ?? N.actionJoke(next, a.category, rr.status ?? 'approved'),
  };
}

/** Public entry point used by the store. */
export function performAction(s0: GameState, id: string, p: Params = {}): ActionResult {
  const a = ACTIONS[id];
  const reason = checkAction(s0, id, p);
  if (!a || reason) {
    return { state: s0, reaction: { title: a?.title ?? 'פעולה', subtitle: reason ?? undefined, status: 'rejected', stats: [], groups: [], people: [] } };
  }
  const s = clone(s0);
  const capital = actionCapital(s, id, p);
  s.player.politicalCapital = clamp(s.player.politicalCapital - capital);
  if (a.cooldown) s.player.actionCooldowns[cooldownKey(id, p)] = s.turn + a.cooldown;
  const rr = a.run(s, p) ?? {};
  s.career.decisions += 1;
  return { state: s, reaction: buildReaction(s0, s, rr, a, capital) };
}

// ---------------- Cabinet meeting ----------------
export interface MeetingParticipant { id: string; name: string; title: string; stance: number; bubble: string }
export interface Meeting { actionId: string; params: Params; participants: MeetingParticipant[]; scale: number; persuaded: number; advisor: string }

function stanceOn(s: GameState, pol: Politician, ministry: Ministry | undefined, e: Effects, a: ActionDef, p: Params): number {
  let v = (pol.loyalty - 50) / 70;
  if (ministry) {
    const mine = ministry.categories.reduce((acc, c) => acc + (e.budget?.[c] ?? 0), 0);
    if (mine > 0) v += 0.7;
    if (mine < 0) v -= 0.9;
    if (ministry.id === 'finance') {
      const spend = Object.values(e.budget ?? {}).reduce((x, y) => x + (y ?? 0), 0) + (e.oneOffCost ?? 0) / 3;
      v -= clamp(spend / 4, -0.6, 1.2);
      if (e.taxes && Object.values(e.taxes).some((t) => (t ?? 0) < 0)) v -= 0.5;
    }
  }
  if (a.id === 'propose_law') {
    const law = LAW_BY_ID[str(p, 'lawId')];
    const party = s.parties[pol.partyId];
    if (law && party) {
      if (party.favoriteLaws.includes(law.id)) v += 0.9;
      if (party.hatedLaws.includes(law.id)) v -= 1.3;
      const d = Math.abs(law.ideology.economic - pol.ideology.economic) + Math.abs(law.ideology.security - pol.ideology.security) + Math.abs(law.ideology.religion - pol.ideology.religion);
      v += 0.5 - d / 3;
    }
  }
  return clamp(v, -1.5, 1.5);
}

export function prepareMeeting(s: GameState, id: string, p: Params): Meeting {
  const a = ACTIONS[id];
  const e = a.estimate?.(s, p) ?? {};
  const touched = new Set(Object.keys(e.budget ?? {}));
  const ministries = s.government.ministries.filter((m) => m.ministerId && m.ministerId !== s.player.politicianId);
  const pickM: Ministry[] = [];
  const fin = ministries.find((m) => m.id === 'finance');
  if (fin) pickM.push(fin);
  for (const m of ministries) if (m.categories.some((c) => touched.has(c)) && !pickM.includes(m)) pickM.push(m);
  if (a.domain) for (const m of ministries) if (m.domain === a.domain && !pickM.includes(m)) pickM.push(m);
  if (id === 'propose_law') {
    const law = LAW_BY_ID[str(p, 'lawId')];
    for (const m of ministries) if (law && m.domain === law.domain && !pickM.includes(m)) pickM.push(m);
    // coalition partner leaders always care about laws
    for (const pid of s.government.coalition) {
      const lid = s.parties[pid].leaderId;
      const lm = ministries.find((m) => m.ministerId === lid);
      if (lm && !pickM.includes(lm)) pickM.push(lm);
    }
  }
  for (const m of ministries) { if (pickM.length >= 4) break; if (!pickM.includes(m) && ['defense', 'transport', 'education'].includes(m.id)) pickM.push(m); }
  const participants = pickM.slice(0, 5).map((m) => {
    const pol = s.politicians[m.ministerId!];
    const st = stanceOn(s, pol, m, e, a, p);
    return { id: pol.id, name: pol.name, title: m.name.replace('משרד ה', 'שר ה').replace('המשרד ל', 'השר ל'), stance: st, bubble: N.meetingBubble(s, pol, st, m.domain) };
  });
  const spend = Object.values(e.budget ?? {}).reduce((x, y) => x + (y ?? 0), 0) + (e.oneOffCost ?? 0);
  const advisor = deficitPct(s) > 4 && spend > 0
    ? `אני ממליץ לקחת בחשבון שהגירעון כבר ${deficitPct(s).toFixed(1)}%.`
    : participants.filter((x) => x.stance < -0.1).length >= 2 ? 'שני שרים או יותר מתנגדים. כדאי לשכנע, לרכך או להתפשר לפני ההצבעה.' : 'נראה שיש רוב בממשלה להצעה.';
  return { actionId: id, params: p, participants, scale: 1, persuaded: 0, advisor };
}

export type MeetingChoice = 'approve' | 'persuade' | 'deal' | 'modify' | 'vote' | 'reject';

export function meetingStep(s0: GameState, m: Meeting, choice: MeetingChoice): { state: GameState; meeting: Meeting | null; result: ActionResult | null } {
  const s = clone(s0);
  const opp = m.participants.filter((x) => x.stance < -0.1);
  if (choice === 'reject') return { state: s0, meeting: null, result: { state: s0, reaction: { title: 'ההצעה נגנזה', status: 'info', stats: [], groups: [], people: [], quip: 'ההצעה לא הועלתה להצבעה. אפשר להעלות אותה שוב בהמשך.' } } };
  if (choice === 'persuade') {
    if (s.player.politicalCapital < 8) return { state: s0, meeting: m, result: null };
    s.player.politicalCapital -= 8;
    const parts = m.participants.map((x) => {
      if (x.stance >= -0.1) return x;
      const pol = s.politicians[x.id];
      const flip = rand(s) < 0.35 + pol.loyalty / 200;
      const stance = flip ? 0.3 : x.stance + 0.15;
      return { ...x, stance, bubble: flip ? pick(s, ['השתכנעתי. אתמוך.', 'בסדר, אתמוך הפעם.', 'הנימוקים משכנעים.']) : pick(s, ['עדיין לא שוכנעתי.', 'אני נשאר בעמדתי.', 'צריך הצעה טובה יותר.']) };
    });
    return { state: s, meeting: { ...m, participants: parts, persuaded: m.persuaded + 1 }, result: null };
  }
  if (choice === 'deal') {
    const parts = m.participants.map((x) => {
      if (x.stance >= -0.1) return x;
      const min = s.government.ministries.find((mm) => mm.ministerId === x.id);
      const cat = min?.categories[0];
      if (cat) applyDecision(s, { budget: { [cat]: 0.8 } });
      remember(s, x.id, 'deal', 'קיבל תוספת תמורת תמיכה', 6);
      return { ...x, stance: 0.4, bubble: cat ? 'עם תוספת של ₪800 מיליון למשרד, אתמוך.' : 'מקובל עליי.' };
    });
    return { state: s, meeting: { ...m, participants: parts }, result: null };
  }
  if (choice === 'modify') {
    const parts = m.participants.map((x) => ({ ...x, stance: x.stance + 0.35, bubble: x.stance + 0.35 > -0.1 ? 'בגרסה המתונה אפשר לתמוך.' : x.bubble }));
    return { state: s, meeting: { ...m, participants: parts, scale: 0.5, params: { ...m.params, scale: 0.5 } }, result: null };
  }
  const params = { ...m.params, ...(m.scale !== 1 ? { scale: m.scale } : {}) };
  if (choice === 'vote') {
    const yes = m.participants.filter((x) => x.stance > -0.1).length + 1; // + the PM
    const no = m.participants.length + 1 - yes;
    if (yes <= no) {
      return { state: s, meeting: null, result: { state: s, reaction: { title: `הממשלה דחתה את ההצעה (${yes}-${no})`, status: 'rejected', stats: [], groups: [], people: m.participants.map((x) => ({ icon: x.stance > -0.1 ? '👍' : '👎', label: x.name, text: x.bubble, tone: x.stance > -0.1 ? 'good' : 'bad' })) } } };
    }
  }
  if (choice === 'approve') {
    for (const x of opp) {
      remember(s, x.id, 'ignored', 'התעלמו מההתנגדות שלו בישיבה', -6);
      s.government.stability = clamp(s.government.stability - 1.5);
    }
  }
  const res = performAction(s, m.actionId, params);
  if (res.reaction) {
    res.reaction.people = [
      ...m.participants.map((x) => ({ icon: x.stance > -0.1 ? '👍' : '👎', label: x.name, text: x.bubble, tone: (x.stance > -0.1 ? 'good' : 'bad') as ReactionLine['tone'] })),
      ...res.reaction.people,
    ].slice(0, 6);
  }
  return { state: res.state, meeting: null, result: res };
}

export function actionNeedsMeeting(s: GameState, id: string, p: Params): boolean {
  const a = ACTIONS[id];
  return !!(a?.needsMeeting?.(s, p) && isPM(s) && s.government.ministries.some((m) => m.ministerId && m.ministerId !== s.player.politicianId));
}