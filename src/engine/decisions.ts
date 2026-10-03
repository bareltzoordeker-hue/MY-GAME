// ============================================================
// Decision Engine. UI → performAction → ActionDef.run (draft) → Reaction.
// Every action changes the GameState; nothing is decorative.
// ============================================================
import { N } from './ai/narrative';
import { LAW_BY_ID } from '../data/laws';
import { MINISTRY_ACTIONS, type MinistryActionSpec } from '../data/ministryActions';
import { EXTRA_MINISTRY_ACTIONS, GENERIC_MINISTER_ACTIONS } from '../data/ministryActionsPlus';
import { startCrisis } from './crises';
import { NEW_MINISTRY_TEMPLATES } from '../data/ministries';
import { PROJECT_BY_ID } from '../data/projects';
import { PROMISE_BY_ID } from '../data/promises';
import {
  BUDGET_SENSITIVITY, CATEGORY_BY_ID, GROUPS, GROUP_BY_ID, MAJORITY, REGION_BY_ID, SERVICES, TAX_NAMES, TAX_SENSITIVITY,
} from '../data/world';
import { chance, pick, rand, randInt } from './rng';
import type {
  ActionResult, Bill, BudgetCategory, Domain, Effects, GameState, GroupId, Ideology, Ministry, Politician, Reaction, ReactionLine, Taxes,
} from '../types/game';
import { clamp, clone, deficitPct, newId, round1 } from '../utils';
import { aiPmDecides } from './aiGovernment';
import { setGameOver, setRole, syncRole } from './career';
import { randomCaricature } from './newGame';
import { addNews, applyEffects, logEvent, remember, scaleEffects } from './effects';
import { callEarlyElections } from './elections';
import { assignMinister, createMinistry, getMinistry, mergeMinistries, removeMinistry } from './government';
import { partyStance, proposeBill, repealLaw, voteBudget } from './parliament';
import { coalitionSeats } from './polls';
import { cancelProject, startProject } from './projects';
import { makePromise } from './promises';
import { allyHurt } from './alliances';
import { getCapabilities, isPM, isPartyLeader, ministryLawDomains, playerMinistry, turnsToElection } from './roles';

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

function ministryActionSpecs(m: Ministry): MinistryActionSpec[] {
  const own = (m.origins ?? [m.id]).flatMap((id) => [...(MINISTRY_ACTIONS[id] ?? []), ...(EXTRA_MINISTRY_ACTIONS[id] ?? [])]);
  return [...own, ...GENERIC_MINISTER_ACTIONS];
}

/** A minister (not PM) asking for money must get the PM's approval. */
function needsPmApproval(s: GameState, e: Effects): number {
  if (isPM(s)) return 0;
  const add = Object.values(e.budget ?? {}).reduce((a, v) => a + Math.max(0, v ?? 0), 0);
  const taxes = Object.values(e.taxes ?? {}).reduce((a, v) => a + Math.abs(v ?? 0), 0) * 5;
  return add + taxes;
}

function pmApproval(s: GameState, amount: number): RunResult | null {
  const pm = s.politicians[s.government.pmId];
  const { approved } = aiPmDecides(s, amount);
  if (approved) {
    return null;
  }
  remember(s, pm.id, 'ignored', 'ביקש כסף בתקופה קשה', -2);
  return {
    status: 'rejected', title: 'ראש הממשלה דחה את הבקשה',
    quip: `${pm.name}: "${pick(s, ['אין כסף. תתייעל.', 'לא עכשיו, יש בחירות באופק.', 'תחזור אליי אחרי התקציב.', 'אתה יודע מה הגירעון?'])}"`,
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
  description: 'לקחת עוד קצת מהעם. או להחזיר קצת, רגע לפני בחירות.',
  capital: (_s, p) => Math.round(Math.abs(num(p, 'delta')) * 5),
  unavailable: (s) => (getCapabilities(s).canSetTaxes ? null : 'רק ראש הממשלה קובע מסים'),
  estimate: (_s, p) => ({ taxes: { [str(p, 'tax')]: num(p, 'delta') } }),
  needsMeeting: (_s, p) => Math.abs(num(p, 'delta')) >= 2,
  run: (s, p) => {
    const tax = str(p, 'tax') as keyof Taxes;
    const d = num(p, 'delta');
    applyDecision(s, { taxes: { [tax]: d }, stability: d > 0 ? -2 : 0, partyMomentum: { [s.player.partyId]: d > 0 ? -1.5 * d : 1 * -d } });
    addNews(s, d > 0 ? `הממשלה מעלה את ה${TAX_NAMES[tax]} ב-${d}%` : `הורדת ${TAX_NAMES[tax]}: ${Math.abs(d)}% פחות`, d > 0 ? 'bad' : 'good', '🧾');
    return { title: `${TAX_NAMES[tax]} ${d > 0 ? '+' : ''}${d}%`, quip: d > 0 ? 'היועץ: "אף אחד לא אוהב מסים. חוץ מהאוצר."' : 'היועץ: "הציבור מרוצה. הגירעון פחות."' };
  },
});

def({
  id: 'adjust_budget', title: 'שינוי תקציב', icon: '💰', category: 'economy', level: 'medium',
  description: 'להזיז מיליארדים בין משרדים כמו כיסאות בחתונה. מישהו תמיד נשאר בלי.',
  capital: (_s, p) => (Math.abs(num(p, 'delta')) >= 3 ? 4 : 2),
  unavailable: (s) => (getCapabilities(s).canManageBudget ? null : 'רק ראש הממשלה מחלק את התקציב'),
  estimate: (_s, p) => ({ budget: { [str(p, 'category')]: num(p, 'delta') } }),
  needsMeeting: (s, p) => Math.abs(num(p, 'delta')) >= s.budget.allocations[str(p, 'category') as BudgetCategory] * 0.1,
  run: (s, p) => {
    const cat = str(p, 'category') as BudgetCategory;
    const d = num(p, 'delta');
    applyDecision(s, { budget: { [cat]: d } });
    // the responsible minister cares
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
  description: '₪8 מיליארד ממריצים את הכלכלה עכשיו. החשבון יגיע לנכדים, שעוד לא מצביעים.', capital: 8, cooldown: 6,
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
  id: 'austerity', title: 'תוכנית צנע', icon: '🪓', category: 'economy', level: 'major', domain: 'finance',
  description: '3% קיצוץ לכולם חוץ מהביטחון, כי עם הביטחון לא מתעסקים. גם לא עם הלשכה שלך.', capital: 10, cooldown: 8,
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
    addNews(s, 'תוכנית צנע: הממשלה מקצצת 3% בכל המשרדים', 'bad', '🪓');
  },
});

def({
  id: 'tax_enforcement', title: 'מבצע אכיפת מס', icon: '🔍', category: 'economy', level: 'simple', domain: 'finance',
  description: 'פשיטה על קופסאות הנעליים של העצמאים. הדגים הגדולים בקפריסין, אז מתחילים מהקטנים.', capital: 4, cooldown: 4,
  unavailable: (s) => (getCapabilities(s).canManageBudget ? null : 'רק ראש הממשלה'),
  estimate: () => ({ revenue: 5, groups: { selfEmployed: -4, highIncome: -2, lowIncome: 1 } }),
  run: (s) => { applyDecision(s, { revenue: 5, groups: { selfEmployed: -4, highIncome: -2, lowIncome: 1 } }); },
});

def({
  id: 'submit_budget', title: 'הגשת התקציב לכנסטון', icon: '📒', category: 'economy', level: 'medium',
  description: 'ההצבעה החשובה של השנה. כל שותף ייזכר פתאום שהוא צריך עוד מיליארד.', capital: 3,
  unavailable: (s) => (!isPM(s) ? 'רק ראש הממשלה' : s.budget.passed ? 'התקציב השנתי כבר אושר' : null),
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
    return { title: `התקציב נפל (${v.for}-${v.against})`, status: 'rejected', quip: 'זה אומר בחירות. תתחיל לחייך למצלמות.' };
  },
});

// ===== GOVERNMENT (PM) =====
def({
  id: 'appoint_minister', title: 'מינוי שר', icon: '🤝', category: 'government', level: 'simple', capital: 3,
  description: 'לבחור בין מי שמבין בתחום לבין מי שמאיים לפרק את הקואליציה. רמז: לא הראשון.',
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
      people.push({ icon: '😠', label: prev.name, text: pick(s, ['לא אשכח את זה.', 'זה עוד לא נגמר.', 'אני הולך לאולפנים.']), tone: 'bad' });
    }
    assignMinister(s, m.id, pol.id);
    remember(s, pol.id, 'appointed', `מונה ל${m.name}`, 15);
    people.push({ icon: '😊', label: pol.name, text: pick(s, ['כבוד גדול. ואחריות. בעיקר כבוד.', 'לא אכזב! (כנראה)', 'סוף סוף מכירים בכישרון שלי.']), tone: 'good' });
    if (m.agreementPartyId && m.agreementPartyId !== pol.partyId && s.government.coalition.includes(m.agreementPartyId)) {
      const lead = s.parties[m.agreementPartyId].leaderId;
      remember(s, lead, 'betrayal', `לקחת להם את ${m.name}`, -18);
      applyEffects(s, { stability: -6 });
      people.push({ icon: '💢', label: s.parties[m.agreementPartyId].name, text: 'הפרת את ההסכם הקואליציוני!', tone: 'bad' });
      m.agreementPartyId = pol.partyId;
    }
    addNews(s, `${pol.name} מונה ל${m.name}`, 'neutral', '🤝');
    return { title: `${pol.name} – ${m.name}`, people };
  },
});

def({
  id: 'fire_minister', title: 'פיטורי שר', icon: '🔥', category: 'government', level: 'medium', capital: 5,
  description: 'שר עף, אויב נולד. התיק עובר אליך, עם כל הבעיות.',
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
    addNews(s, `דרמה: ${min.name} פוטר מ${m.name}`, 'neutral', '🔥');
    logEvent(s, '🔥', `פיטרת את ${min.name}`, 2, 'neutral', 'government');
    return { title: `${min.name} פוטר`, people: [{ icon: '😡', label: min.name, text: pick(s, ['גיליתי על זה מהטלוויזיה!', 'אתה תצטער על זה.', 'אני מקים מפלגה חדשה. אולי.']), tone: 'bad' }] };
  },
});

def({
  id: 'merge_ministries', title: 'איחוד משרדים', icon: '🧩', category: 'government', level: 'medium', capital: 8,
  description: 'שני משרדים, מנכ״ל אחד, 400 עובדים שלא מבינים איפה החדר שלהם.',
  unavailable: (s, p) => (!getCapabilities(s).canManageGovernment ? 'רק ראש הממשלה' : str(p, 'a') === str(p, 'b') ? 'בחר שני משרדים שונים' : null),
  run: (s, p) => {
    const merged = mergeMinistries(s, str(p, 'a'), str(p, 'b'));
    if (!merged) return { status: 'rejected', title: 'האיחוד נכשל' };
    applyDecision(s, { budget: { government: -0.4 }, groups: { center: 1, publicSector: -2 } });
    addNews(s, `קם ${merged.name}. אף אחד לא יודע איפה הכניסה`, 'satire', '🧩');
    return { title: `נוצר: ${merged.name}`, quip: 'בטווח הקצר: בלגן. בטווח הארוך: אולי חיסכון.' };
  },
});

def({
  id: 'create_ministry', title: 'הקמת משרד', icon: '🏗️', category: 'government', level: 'simple', capital: 4,
  description: 'עוד משרד, עוד לשכה, עוד נהג. ועוד שותף קואליציוני מחייך.',
  unavailable: (s) => (getCapabilities(s).canManageGovernment ? null : 'רק ראש הממשלה'),
  run: (s, p) => {
    const m = createMinistry(s, str(p, 'templateId'));
    if (!m) return { status: 'rejected', title: 'המשרד כבר קיים' };
    applyDecision(s, { groups: { center: -1.5, selfEmployed: -1, publicSector: 1 } });
    const t = NEW_MINISTRY_TEMPLATES.find((x) => x.id === str(p, 'templateId'));
    addNews(s, t?.satire ? `הוקם ${m.name}. תקציב: ₪300 מיליון. מטרה: לא ידועה` : `הוקם ${m.name}`, t?.satire ? 'satire' : 'neutral', m.icon);
    return { title: `הוקם ${m.name}`, quip: 'עכשיו צריך למנות לו שר. יש לך מישהו לרצות?' };
  },
});

def({
  id: 'remove_ministry', title: 'סגירת משרד', icon: '🗑️', category: 'government', level: 'simple', capital: 4,
  description: 'סוגרים משרד שאף אחד לא ידע שקיים. גם השר שלו לא.',
  unavailable: (s, p) => {
    if (!getCapabilities(s).canManageGovernment) return 'רק ראש הממשלה';
    const m = getMinistry(s, str(p, 'ministryId'));
    return m && !m.services.length && !m.categories.length && m.id !== 'finance' ? null : 'אי אפשר לסגור משרד שמנהל שירותים';
  },
  run: (s, p) => {
    const m = getMinistry(s, str(p, 'ministryId'))!;
    removeMinistry(s, m.id);
    applyDecision(s, { groups: { center: 1.5, selfEmployed: 1 } });
    addNews(s, `${m.name} נסגר. איש לא הבחין`, 'satire', '🗑️');
    return { title: `${m.name} נסגר` };
  },
});

def({
  id: 'coalition_gift', title: 'כספים קואליציוניים', icon: '🎁', category: 'government', level: 'simple', capital: 0, cooldown: 3,
  description: '₪1.5 מיליארד ״לצרכים ייעודיים״. כולם יודעים מה הייעוד: שקט.',
  unavailable: (s, p) => (!isPM(s) ? 'רק ראש הממשלה' : !s.government.coalition.includes(str(p, 'partyId')) || str(p, 'partyId') === s.player.partyId ? 'בחר שותפה קואליציונית' : null),
  run: (s, p) => {
    const party = s.parties[str(p, 'partyId')];
    const cat = (party.id === 'kugel' ? 'education' : party.id === 'givaa' ? 'housing' : 'welfare') as BudgetCategory;
    applyDecision(s, { budget: { [cat]: 1.5 }, groups: { center: -1.5, secular: party.id === 'kugel' ? -2 : 0 }, stability: 5 });
    remember(s, party.leaderId, 'favor', 'כספים קואליציוניים', 14);
    addNews(s, `₪1.5 מיליארד "כספים ייעודיים" ל${party.name}`, 'bad', '🎁');
    return { title: `${party.name} קיבלה ₪1.5 מיליארד`, people: [{ icon: party.logo, label: s.politicians[party.leaderId]?.name ?? party.name, text: 'עכשיו אפשר לדבר.', tone: 'good' }] };
  },
});

def({
  id: 'early_elections', title: 'הקדמת בחירות', icon: '🗳️', category: 'government', level: 'major', capital: 0,
  description: 'לפזר את הכנסטון ולהמר על הסקרים. מה כבר יכול להשתבש? הכול.',
  unavailable: (s) => (!isPM(s) ? 'רק ראש הממשלה' : turnsToElection(s) <= 3 ? 'הבחירות כבר קרובות' : null),
  run: (s) => { callEarlyElections(s, 'ראש הממשלה פיזר את הכנסטון'); return { title: 'הכנסטון התפזר', quip: 'הימור. נקווה שהסקרים צודקים הפעם.' }; },
});

// ===== PARLIAMENT =====
def({
  id: 'propose_law', title: 'הגשת הצעת חוק', icon: '📝', category: 'parliament', level: 'medium',
  description: 'כתבת חוק. עכשיו רק צריך 61 אנשים שלא סובלים אותך שיצביעו בעדו.',
  capital: (s) => (isPM(s) ? 4 : 6), cooldown: 2,
  unavailable: (s, p) => {
    const lawId = str(p, 'lawId');
    if (!LAW_BY_ID[lawId]) return 'חוק לא קיים';
    if (s.activeLaws.includes(lawId)) return 'החוק כבר בתוקף';
    if (s.bills.some((b) => b.lawId === lawId && b.status === 'active')) return 'כבר בדיון בכנסטון';
    const domains = ministryLawDomains(s);
    if (domains && !domains.includes(LAW_BY_ID[lawId].domain)) return 'לא בתחום האחריות של המשרד שלך';
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
      people.push({ icon: '🪑', label: 'ראש הממשלה', text: ok ? 'מאשר כהצעה ממשלתית.' : 'לא כהצעה ממשלתית. תגיש לבד.', tone: ok ? 'good' : 'bad' });
    }
    const bill = proposeBill(s, law.id, s.player.politicianId, gov, num(p, 'scale') === 0.5);
    if (!bill) return { status: 'rejected', title: 'לא ניתן להגיש' };
    applyEffects(s, { playerPopularity: 1, playerReputation: 1 });
    addNews(s, `${me(s).name} מגיש: ${law.title}`, 'neutral', law.icon);
    return { title: `הוגש: ${law.title}`, subtitle: gov ? 'הצעה ממשלתית — עוברת ישר לוועדה' : 'הצעה פרטית — קריאה טרומית בתור הבא', status: 'pending', people };
  },
});

def({
  id: 'repeal_law', title: 'ביטול חוק', icon: '🧨', category: 'parliament', level: 'major', capital: 10, cooldown: 3,
  description: 'מוחקים חוק שמישהו נלחם עליו שנתיים. הוא יזכור. לנצח.',
  unavailable: (s, p) => (!isPM(s) ? 'רק ראש הממשלה יכול לבטל חוק' : !s.activeLaws.includes(str(p, 'lawId')) ? 'החוק לא בתוקף' : null),
  needsMeeting: () => true,
  run: (s, p) => {
    const law = LAW_BY_ID[str(p, 'lawId')];
    const bill: Bill = { id: 'repeal', lawId: law.id, title: law.title, sponsorId: s.player.politicianId, isGovernment: true, stage: 'final', turnsInStage: 0, proposedTurn: s.turn, status: 'active', push: 0, modified: false };
    // repealing needs a majority too: parties that love the law vote against the repeal
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
    addNews(s, `${law.title} בוטל. ${pick(s, ['היוזמים מזועזעים', 'המתנגדים חוגגים', 'איש לא זוכר למה הוא עבר מלכתחילה'])}`, 'neutral', '🧨');
    logEvent(s, '🧨', `ביטלת את ${law.title}`, 2, 'neutral', 'law');
    return { title: `בוטל: ${law.title}`, subtitle: `${120 - against} תמכו בביטול` };
  },
});

def({
  id: 'push_bill', title: 'גיוס תמיכה להצעה', icon: '📣', category: 'parliament', level: 'simple', capital: 8, cooldown: 1,
  description: 'שיחות טלפון, הבטחות לג׳ובים ועוגיות. בעיקר הבטחות.',
  unavailable: (s, p) => (s.bills.find((b) => b.id === str(p, 'billId') && b.status === 'active') ? null : 'ההצעה לא פעילה'),
  run: (s, p) => {
    const b = s.bills.find((x) => x.id === str(p, 'billId'))!;
    b.push += 25;
    return { title: `התמיכה ב"${b.title}" עולה`, quip: 'כמה ח״כים קיבלו הבטחות. נקווה שלא יזכרו.' };
  },
});

def({
  id: 'soften_bill', title: 'ריכוך הצעה', icon: '🧈', category: 'parliament', level: 'simple', capital: 2,
  description: 'מורידים מהחוק את כל מה שהיה בו. נשארים שם יפה ותמונה לפרוטוקול.',
  unavailable: (s, p) => {
    const b = s.bills.find((x) => x.id === str(p, 'billId') && x.status === 'active');
    if (!b) return 'ההצעה לא פעילה';
    if (b.modified) return 'ההצעה כבר רוככה';
    return b.sponsorId === s.player.politicianId || (b.isGovernment && isPM(s)) ? null : 'רק היוזם יכול לרכך';
  },
  run: (s, p) => {
    const b = s.bills.find((x) => x.id === str(p, 'billId'))!;
    b.modified = true;
    return { title: `"${b.title}" רוכך`, quip: 'גרסה "מאוזנת". כלומר: אף אחד לא מרוצה לגמרי.' };
  },
});

def({
  id: 'vote_bill', title: 'הצבעה במליאה', icon: '🗳️', category: 'parliament', level: 'simple', capital: 0, cooldown: 1,
  description: 'אצבע אחת, השלכות רבות. המנהיג שלך סופר.',
  unavailable: (s, p) => (s.bills.find((b) => b.id === str(p, 'billId') && b.status === 'active') ? null : 'ההצעה לא פעילה'),
  run: (s, p) => {
    const b = s.bills.find((x) => x.id === str(p, 'billId'))!;
    const forIt = str(p, 'vote') === 'for';
    b.push += forIt ? 4 : -4;
    const party = s.parties[s.player.partyId];
    const partyFor = party.favoriteLaws.includes(b.lawId) || (b.isGovernment && s.government.coalition.includes(party.id));
    const leader = s.politicians[party.leaderId];
    const people: ReactionLine[] = [];
    if (!forIt) allyHurt(s, b.lawId);
    if (leader && !leader.isPlayer && forIt !== partyFor) {
      remember(s, leader.id, 'betrayal', `הצביע נגד הקו ב${b.title}`, -10);
      applyEffects(s, { playerPopularity: 2, playerReputation: 1 });
      people.push({ icon: '😤', label: leader.name, text: 'מרד?! נדבר אחר כך.', tone: 'bad' });
    } else if (leader && !leader.isPlayer) {
      leader.loyalty = clamp(leader.loyalty + 2);
    }
    return { title: `הצבעת ${forIt ? 'בעד' : 'נגד'} ${b.title}`, people };
  },
});

def({
  id: 'no_confidence', title: 'הצעת אי-אמון', icon: '⚔️', category: 'parliament', level: 'major', capital: 15, cooldown: 6,
  description: 'לנסות להפיל את הממשלה. בדרך כלל נכשל, תמיד מצטלם טוב.',
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
      return { title: 'הממשלה נפלה!', status: 'approved', quip: 'עכשיו צריך לנצח בבחירות. פרט קטן.' };
    }
    applyEffects(s, { partyMomentum: { [s.player.partyId]: -2 } });
    return { title: `אי-האמון נכשל (${govVotes} נגד)`, status: 'rejected', quip: 'לפחות היו כותרות.' };
  },
});

// ===== PROJECTS =====
def({
  id: 'start_project', title: 'השקת פרויקט', icon: '🏗️', category: 'projects', level: 'medium',
  description: 'אבן פינה, סרט, בורקס. הפרויקט עצמו? נדבר אחרי הבחירות.', capital: 3,
  unavailable: (s, p) => {
    const d = PROJECT_BY_ID[str(p, 'defId')];
    if (!d) return 'פרויקט לא קיים';
    if (s.projects.some((x) => x.defId === d.id && x.status === 'active')) return 'כבר בביצוע';
    if (isPM(s)) return null;
    const m = playerMinistry(s);
    if (s.player.role !== 'minister' || !m) return 'רק ראש הממשלה או השר האחראי';
    return (m.origins ?? [m.id]).includes(d.ministry) ? null : 'הפרויקט לא באחריות המשרד שלך';
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
    return { title: `יוצא לדרך: ${d.name}`, subtitle: `₪${d.cost}B · ${d.turns * 2} חודשים · ${REGION_BY_ID[d.region].name}`, quip: d.satire };
  },
});

def({
  id: 'cancel_project', title: 'ביטול פרויקט', icon: '🛑', category: 'projects', level: 'simple', capital: 4,
  description: 'חוסכים מיליארדים ומאכזבים אזור שלם. הם יזכרו את זה בקלפי.',
  unavailable: (s) => (getCapabilities(s).canStartProjects ? null : 'אין לך סמכות'),
  run: (s, p) => {
    const prj = s.projects.find((x) => x.id === str(p, 'projectId') && x.status === 'active');
    if (!prj || !cancelProject(s, prj.id)) return { status: 'rejected', title: 'לא נמצא' };
    applyDecision(s, { regionInvestment: { [prj.region]: -10 }, groups: { periphery: -2 } });
    if (prj.sponsorId !== s.player.politicianId) remember(s, prj.sponsorId, 'insult', `ביטלת את ${prj.name}`, -10);
    addNews(s, `בוטל: ${prj.name}. התושבים: "ידענו"`, 'bad', '🛑');
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
    if ((s.player.actionCooldowns[`m_${spec.id}`] ?? 0) > s.turn) return `זמין שוב בעוד ${(s.player.actionCooldowns[`m_${spec.id}`] - s.turn) * 2} חודשים`;
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
      people.push({ icon: '🤬', label: pm.name, text: pick(s, ['מי אישר את זה?! אף אחד!', 'קראתי על זה בעיתון. בעיתון!', 'זה הסוף שלך בממשלה הזאת.', 'נדבר. בלשכה. עכשיו.']), tone: 'bad' });
    } else {
      ask = needsPmApproval(s, eff);
      if (ask > 0) {
        const rej = pmApproval(s, ask);
        if (rej) return rej;
        people.push({ icon: '🪑', label: pm.name, text: 'אישר. בחריקת שיניים.', tone: 'good' });
      }
    }
    applyDecision(s, eff);
    spec.mutate?.(s, m);
    if (spec.metric) s.services[spec.metric.service as keyof GameState['services']].metrics[spec.metric.key] = (s.services[spec.metric.service as keyof GameState['services']].metrics[spec.metric.key] ?? 0) + spec.metric.amount;
    if (!isPM(s)) applyEffects(s, { playerReputation: 1, playerPopularity: 1 });
    let quip = spec.satire;
    let status: RunResult['status'] = 'approved';
    // random outcomes: the same action can go very differently
    if (spec.outcomes?.length) {
      const total = spec.outcomes.reduce((a, o) => a + o.w, 0);
      let r = rand(s) * total;
      const o = spec.outcomes.find((x) => (r -= x.w) <= 0) ?? spec.outcomes[0];
      const oe = typeof o.effects === 'function' ? o.effects(s, m) : o.effects;
      if (oe) applyDecision(s, oe);
      if (o.crisis && !s.crises.some((c) => c.defId === o.crisis)) startCrisis(s, o.crisis);
      if (o.headline) addNews(s, o.headline, o.tone === 'good' ? 'good' : o.tone === 'bad' ? 'bad' : 'satire', spec.icon);
      quip = o.text;
      if (o.tone === 'bad') status = 'rejected';
    }
    if (spec.crisis && !s.crises.some((c) => c.defId === spec.crisis)) startCrisis(s, spec.crisis, 3);
    const budgetAdd = Object.values(eff.budget ?? {}).reduce((a, v) => a + Math.max(0, v ?? 0), 0);
    s.career.moneyInvested += budgetAdd;
    if (spec.cat === 'extreme') s.career.memorable.push(`${spec.title} (${m.name})`);
    addNews(s, spec.satire ?? `${m.name}: ${spec.title}`, spec.satire ? 'satire' : 'neutral', spec.icon);
    return { title: `${spec.icon} ${spec.title}`, subtitle: m.name, quip, people, status };
  },
});

def({
  id: 'ministry_request_budget', title: 'בקשת תוספת תקציב', icon: '🙏', category: 'ministry', level: 'medium', capital: 4, cooldown: 3,
  description: 'לבקש מראש הממשלה עוד כסף. הוא יגיד ״אין״. אולי ״אין, אבל״.',
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
    return { title: `אושרה תוספת של ₪${amount} מיליארד`, status: 'approved', people: [{ icon: '🪑', label: s.politicians[s.government.pmId].name, text: 'אל תתרגל.', tone: 'neutral' }] };
  },
});

def({
  id: 'ministry_efficiency', title: 'תוכנית התייעלות', icon: '⚙️', category: 'ministry', level: 'simple', capital: 4, cooldown: 4,
  description: 'מילה מנומסת ל״כולם יעבדו קשה יותר ויכעסו עליך״.',
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
  id: 'ministry_union', title: 'פגישה עם הוועדים', icon: '🤝', category: 'ministry', level: 'simple', capital: 3, cooldown: 4,
  description: 'ארוחת צהריים, שלושה תקנים ושנה בלי שביתות. קוראים לזה ״שלום תעשייתי״.',
  unavailable: (s, p) => (ministryOf(s, p) && (isPM(s) || s.player.role === 'minister') ? null : 'אין משרד'),
  run: (s, p) => {
    const m = ministryOf(s, p)!;
    s.flags[`calm_${m.id}`] = s.turn + 6;
    for (const o of m.origins ?? []) s.flags[`calm_${o}`] = s.turn + 6;
    applyDecision(s, { groups: { publicSector: 2 } });
    return { title: 'הוועד חתם על שקט תעשייתי', subtitle: 'סיכוי לשביתה בתחום ירד לשנה', quip: 'עלה לך רק ארוחת צהריים ושלושה תקנים.' };
  },
});

def({
  id: 'consult_experts', title: 'התייעצות עם אנשי מקצוע', icon: '🧑‍🔬', category: 'ministry', level: 'simple', capital: 1, cooldown: 2,
  description: 'להקשיב לאנשים שמבינים, ואז לעשות מה שהסקרים אומרים.',
  unavailable: () => null,
  run: (s, p) => {
    const m = ministryOf(s, p);
    const domain = (str(p, 'domain') || m?.domain || 'management') as Domain;
    const pl = me(s);
    pl.expertise[domain] = clamp((pl.expertise[domain] ?? 20) + 5);
    applyEffects(s, { playerReputation: 1 });
    return { title: 'למדת משהו חדש', subtitle: `מומחיות +5 (${domain})`, quip: 'המומחים מסכימים שצריך עוד מומחים.' };
  },
});

// ===== MEDIA & CAREER (everyone) =====
// ===== MEDIA & CAREER: every appearance can go many ways, with real consequences =====
interface Roll { w: number; text: string; tone: 'good' | 'bad' | 'neutral'; fx?: Effects; headline?: string; extra?: (s: GameState) => string | void }
function rollOut(s: GameState, title: string, icon: string, list: Roll[]): RunResult {
  const pool = list.filter((x) => x.w > 0);
  const total = pool.reduce((a, x) => a + x.w, 0);
  let r = rand(s) * total;
  const o = pool.find((x) => (r -= x.w) <= 0) ?? pool[0];
  if (o.fx) applyDecision(s, o.fx);
  const more = o.extra?.(s);
  if (o.headline) addNews(s, o.headline, o.tone === 'good' ? 'good' : o.tone === 'bad' ? 'bad' : 'satire', icon);
  return { title, status: o.tone === 'good' ? 'approved' : o.tone === 'bad' ? 'rejected' : 'info', quip: more ? `${o.text} ${more}` : o.text };
}
const randomGroup = (s: GameState): GroupId => pick(s, GROUPS.map((g) => g.id));
const myLeader = (s: GameState) => s.politicians[s.parties[s.player.partyId].leaderId];
const rival = (s: GameState) => pick(s, Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && p.partyId !== s.player.partyId && s.parties[p.partyId]?.leaderId === p.id));

def({
  id: 'press_conference', title: 'מסיבת עיתונאים', icon: '🎙️', category: 'media', level: 'simple', capital: 3, cooldown: 1,
  description: 'מיקרופון, דגל וחמש שאלות. כל אחת יכולה להתפוצץ.',
  unavailable: () => null,
  run: (s) => {
    const me0 = me(s);
    return rollOut(s, 'מסיבת עיתונאים', '🎙️', [
      { w: 4 + s.player.reputation / 20, tone: 'good', text: 'ענית על כל השאלות בלי לענות על אף אחת. מקצוען.', fx: { playerPopularity: 4, partyMomentum: { [s.player.partyId]: 1 } } },
      { w: 2.5, tone: 'bad', text: 'עיתונאית שאלה על "פרשת מכונות הקפה". גמגמת 11 שניות. ספרו.', fx: { playerPopularity: -4, playerReputation: -2 }, headline: `${me0.name} גמגם 11 שניות מול שאלה על מכונות הקפה` },
      { w: 2, tone: 'neutral', text: 'בהתלהבות הכרזת על "תוכנית לאומית" שלא קיימת. עכשיו צריך להמציא אותה.', fx: { playerPopularity: 3, playerReputation: -3 }, extra: (x) => { const l = myLeader(x); if (l && !l.isPlayer) remember(x, l.id, 'insult', 'הכריז על תוכנית בלי לתאם', -6); return l && !l.isPlayer ? `${l.name} שמע על התוכנית מהטלוויזיה.` : ''; } },
      { w: 1.2, tone: 'neutral', text: 'המיקרופון נפל, אתה תפסת אותו באוויר. הסרטון: 2 מיליון צפיות.', fx: { playerPopularity: 2, groups: { youth: 3 } }, headline: 'תפיסת המיקרופון של השנה' },
      { w: 1.5, tone: 'bad', text: 'השמש סינוורה, אמרת "צבריה" עם ס׳. ממים לשבוע.', fx: { playerPopularity: -2, playerReputation: -1, groups: { youth: 2 } } },
    ]);
  },
});

def({
  id: 'tv_interview', title: 'ראיון באולפן', icon: '📺', category: 'media', level: 'simple', capital: 2, cooldown: 2,
  description: 'מגישה קשוחה, שידור חי, אפס עריכה. המוניטין שלך משנה את הסיכויים.',
  unavailable: () => null,
  run: (s) => {
    const g = randomGroup(s);
    const r = rival(s);
    return rollOut(s, 'ראיון באולפן', '📺', [
      { w: 3 + s.player.reputation / 15, tone: 'good', text: 'הברקת. המגישה אפילו חייכה. פעם ראשונה מאז 2019.', fx: { playerPopularity: 6, playerReputation: 2, partyMomentum: { [s.player.partyId]: 2 } }, headline: `${me(s).name} הבריק באולפן` },
      { w: 3, tone: 'bad', text: `אמרת משהו על ${GROUP_BY_ID[g].name} שעדיף היה לא להגיד. הם לא שכחו.`, fx: { groups: { [g]: -7 }, playerPopularity: -3 }, headline: `סערה: ${me(s).name} התבטא נגד ${GROUP_BY_ID[g].name}` },
      { w: r ? 2 : 0, tone: 'neutral', text: `תקפת את ${r?.name} בשידור. הוא כבר מתקשר לעורך דין.`, fx: { playerPopularity: 2 }, extra: (x) => { if (r) { remember(x, r.id, 'insult', 'תקף אותי באולפן', -12); x.politicians[r.id].popularity = clamp(x.politicians[r.id].popularity - 3); } } },
      { w: 1.2, tone: 'neutral', text: 'יצאת מהאולפן באמצע הראיון בטריקת דלת. הבסיס מריע, המרכז מגלגל עיניים.', fx: { groups: { right: 3, center: -3 }, playerPopularity: 1 }, headline: `${me(s).name} עזב את האולפן באמצע שידור חי` },
      { w: 1.5, tone: 'bad', text: 'המיקרופון נשאר פתוח אחרי הראיון. כולם שמעו מה אתה חושב על המנהיג שלך.', fx: { playerPopularity: -2 }, extra: (x) => { const l = myLeader(x); if (l && !l.isPlayer) remember(x, l.id, 'betrayal', 'נשמע מקלל אותי במיקרופון פתוח', -15); return l && !l.isPlayer ? `${l.name} שמע. ${l.name} זוכר.` : ''; }, headline: 'מיקרופון פתוח: מה הוא באמת חושב' },
    ]);
  },
});

def({
  id: 'tweet_storm', title: 'ציוץ חריף', icon: '🐦', category: 'media', level: 'simple', capital: 0, cooldown: 1,
  description: 'שלוש בלילה, אצבעות מהירות, שיקול דעת איטי.',
  unavailable: () => null,
  run: (s) => {
    const r = rival(s);
    return rollOut(s, 'ציוץ חריף', '🐦', [
      { w: 4, tone: 'good', text: 'הציוץ התפוצץ. 80 אלף שיתופים. אמא שלך שיתפה פעמיים.', fx: { playerPopularity: 5, groups: { youth: 3 } }, headline: `הציוץ של ${me(s).name} הפך לוויראלי` },
      { w: 3, tone: 'bad', text: 'סערת רשת. מחקת. מישהו צילם מסך. תמיד מישהו מצלם מסך.', fx: { playerPopularity: -5, playerReputation: -3 }, headline: `${me(s).name} מחק ציוץ. צילום המסך כבר בכל מקום` },
      { w: r ? 2 : 0, tone: 'neutral', text: `${r?.name} ענה לך. ועכשיו זו מלחמת ציוצים שכל המדינה עוקבת אחריה.`, fx: { playerPopularity: 2 }, extra: (x) => { if (r) { x.politicians[r.id].popularity = clamp(x.politicians[r.id].popularity + 2); remember(x, r.id, 'insult', 'מלחמת ציוצים', -8); } } },
      { w: 1.5, tone: 'neutral', text: 'שגיאת כתיב בציוץ הפכה לסלוגן. המפלגה כבר מדפיסה חולצות.', fx: { playerPopularity: 2, partyMomentum: { [s.player.partyId]: 2 } } },
    ]);
  },
});

def({
  id: 'attack_opponent', title: 'מתקפה על יריב', icon: '🥊', category: 'media', level: 'simple', capital: 4, cooldown: 2,
  description: 'מכה מתחת לחגורה. לפעמים היא חוזרת אליך.',
  unavailable: (s, p) => (s.politicians[str(p, 'politicianId')]?.active ? null : 'בחר יריב'),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    remember(s, t.id, 'insult', 'תקף אותי בתקשורת', -14);
    const strong = (me(s).popularity - t.popularity) / 100;
    const res = rollOut(s, `מתקפה על ${t.name}`, '🥊', [
      { w: 4 + strong * 6, tone: 'good', text: `${t.name} מתגונן בכל האולפנים. בדיוק מה שרצית.`, fx: { playerPopularity: 3, partyMomentum: { [s.player.partyId]: 2, [t.partyId]: -3 } }, extra: (x) => { x.politicians[t.id].popularity = clamp(x.politicians[t.id].popularity - 7); } },
      { w: 2.5, tone: 'bad', text: `הציבור ריחם על ${t.name}. ממש. הוא קיבל עוגה מאלמנה בפריפריה.`, fx: { playerPopularity: -4, partyMomentum: { [t.partyId]: 3 } }, extra: (x) => { x.politicians[t.id].popularity = clamp(x.politicians[t.id].popularity + 4); }, headline: `גל אהדה ל${t.name} אחרי המתקפה` },
      { w: 1.5, tone: 'bad', text: `${t.name} הגיש תביעת לשון הרע. ₪2 מיליון. עורך הדין שלך כבר מחייך.`, fx: { playerCapital: -6, playerReputation: -3 }, headline: `${t.name} תובע את ${me(s).name}` },
      { w: 1.5, tone: 'neutral', text: `${t.name} חשף בתגובה סרטון שלך שר קריוקי ב-2008. תיקו.`, fx: { playerPopularity: -1, groups: { youth: 2 } }, extra: (x) => { x.politicians[t.id].popularity = clamp(x.politicians[t.id].popularity - 2); } },
    ]);
    return { ...res, people: [{ icon: '😠', label: t.name, text: pick(s, ['אני זוכר את זה.', 'תראה אותי בבחירות.', 'שקרן! (גם אני, אבל בכל זאת)']), tone: 'bad' }] };
  },
});

def({
  id: 'visit_region', title: 'סיור באזור', icon: '🚐', category: 'media', level: 'simple', capital: 2, cooldown: 2,
  description: 'חומוס, לחיצות ידיים ומצלמות. מה שיקרה שם – יגיע לחדשות.',
  unavailable: (_s, p) => (REGION_BY_ID[str(p, 'regionId') as keyof typeof REGION_BY_ID] ? null : 'בחר אזור'),
  run: (s, p) => {
    const r = REGION_BY_ID[str(p, 'regionId') as keyof typeof REGION_BY_ID];
    const per = ['north', 'negev', 'eilat', 'hills'].includes(r.id);
    const st = s.population.regions[r.id];
    return rollOut(s, `סיור ב${r.name}`, '🚐', [
      { w: 4, tone: 'good', text: `קיבלו אותך בחום ב${r.name}. סבתא מקומית האכילה אותך בכוח.`, fx: { playerPopularity: 3, groups: per ? { periphery: 3 } : { center: 2 } }, extra: () => { st.satisfaction = clamp(st.satisfaction + 5); } },
      { w: 2.5, tone: 'bad', text: `בוז ב${r.name}: "איפה הייתם 4 שנים?!". מישהו זרק עגבנייה. החטיא. בקושי.`, fx: { playerPopularity: -4 }, extra: () => { st.satisfaction = clamp(st.satisfaction - 2); }, headline: `${me(s).name} קיבל בוז ב${r.name}` },
      { w: 2, tone: 'neutral', text: `הבטחת על המקום "כביש חדש תוך שנה". אף אחד לא האמין, כולם צילמו.`, fx: { playerPopularity: 2, playerReputation: -2, regionInvestment: { [r.id]: 4 } } },
      { w: 1.2, tone: 'bad', text: 'החומוס היה... שונה. בילית את הערב בשירותים של תחנת דלק.', fx: { playerCapital: -3 }, headline: 'השר והחומוס: סיפור שלא נגמר טוב' },
      { w: 1.5, tone: 'good', text: `גילית בעיה אמיתית ב${r.name} ודחפת לפתרון. מוזר, אבל זה עבד.`, fx: { playerReputation: 5, playerPopularity: 3, regionInvestment: { [r.id]: 6 } } },
    ]);
  },
});

def({
  id: 'committee_work', title: 'עבודת ועדה', icon: '📑', category: 'career', level: 'simple', capital: 0, cooldown: 1,
  description: 'משעמם, אבל בונה מומחיות ומוניטין. ולפעמים מתגלה שערורייה.',
  unavailable: (s) => (s.player.role === 'pm' ? 'אין לך זמן לוועדות' : null),
  run: (s, p) => {
    const domain = (str(p, 'domain') || 'economy') as Domain;
    const pl = me(s);
    pl.expertise[domain] = clamp((pl.expertise[domain] ?? 20) + 6);
    pl.power = clamp(pl.power + 2);
    const victim = pick(s, Object.values(s.politicians).filter((x) => x.active && !x.isPlayer && x.ministryId));
    return rollOut(s, 'יום ארוך בוועדה', '📑', [
      { w: 5, tone: 'good', text: 'קראת 400 עמודים. אף אחד אחר לא קרא. מומחיות +6.', fx: { playerReputation: 3 } },
      { w: victim ? 1.5 : 0, tone: 'good', text: `בדיון גילית ש${victim?.name} העביר תקציב לחברה של גיסו. כותרת ראשית!`, fx: { playerReputation: 6, playerPopularity: 4 }, extra: (x) => { if (victim) remember(x, victim.id, 'insult', 'חשף אותי בוועדה', -15); }, headline: `נחשף בוועדה: תקציב ממשלתי עבר לחברה של גיס השר` },
      { w: 1.5, tone: 'bad', text: 'נרדמת בשידור חי מערוץ הכנסטון. מישהו הוסיף מוזיקה של ערש.', fx: { playerPopularity: -3, groups: { youth: 2 } }, headline: 'ח״כ נרדם בוועדה; הסרטון הפך ללהיט' },
      { w: 1.5, tone: 'neutral', text: 'צעקת על יו״ר הוועדה. הוא הוציא אותך. התקשורת אהבה.', fx: { playerPopularity: 2, playerReputation: 1 } },
    ]);
  },
});

def({
  id: 'reality_show', title: 'להשתתף בריאליטי "השרדות: כנסטון"', icon: '🏝️', category: 'media', level: 'medium', capital: 5, cooldown: 12,
  description: 'אי בודד, 12 פוליטיקאים, ואף אחד לא יודע לבשל אורז.',
  unavailable: (s) => (s.player.role === 'pm' ? 'ראש ממשלה לא נוסע לאי. בדרך כלל.' : null),
  run: (s) => rollOut(s, 'השרדות: כנסטון', '🏝️', [
    { w: 3, tone: 'good', text: 'ניצחת! בנית מחסה, הדחת שלושה שרים, ובכית בגמר. אומה מתאהבת.', fx: { playerPopularity: 12, playerReputation: -5, groups: { youth: 5 } }, headline: `${me(s).name} זכה בהשרדות: כנסטון` },
    { w: 3, tone: 'bad', text: 'הודחת ראשון. אחרי שאכלת את כל הבננות של השבט.', fx: { playerPopularity: -6, playerReputation: -4 }, headline: 'הודח ראשון מהאי: "הוא אכל את כל הבננות"' },
    { w: 2, tone: 'neutral', text: 'ריב ענק על קוקוס הפך לפרק הנצפה בשנה. אתה בפנים, אבל בלי כבוד.', fx: { playerPopularity: 4, playerReputation: -6 } },
  ]),
});

def({
  id: 'protest_speech', title: 'לנאום בהפגנה', icon: '📢', category: 'media', level: 'simple', capital: 3, cooldown: 3,
  description: 'קהל, מגפון ותחושת שליחות. באופוזיציה – חובה. בקואליציה – מסוכן.',
  unavailable: () => null,
  run: (s) => {
    const inGov = s.government.coalition.includes(s.player.partyId);
    const lean = me(s).ideology.security > 0 ? 'right' : 'left';
    return rollOut(s, 'נאום בהפגנה', '📢', [
      { w: 4, tone: 'good', text: 'הקהל צעק את השם שלך. הפעם בהתלהבות.', fx: { playerPopularity: 5, groups: { [lean]: 4 }, partyMomentum: { [s.player.partyId]: 2 } }, extra: (x) => { if (inGov) { remember(x, x.government.pmId, 'insult', 'נאם בהפגנה נגד הממשלה', -12); return 'ראש הממשלה צפה. מהבונקר.'; } } },
      { w: 2, tone: 'bad', text: 'הקהל לא זיהה אותך. מישהו שאל אם אתה מהמשטרה.', fx: { playerPopularity: -3 } },
      { w: 1.5, tone: 'bad', text: 'ההפגנה התדרדרה לעימות עם המשטרה. אתה בתמונה, בדיוק באמצע.', fx: { playerPopularity: -2, playerReputation: -4, groups: { right: lean === 'right' ? 2 : -3, left: lean === 'left' ? 2 : -3 } }, headline: 'עימותים בהפגנה; ח״כ צולם באמצע' },
    ]);
  },
});

def({
  id: 'leak_rival', title: 'להדליף חומר מביך על יריב', icon: '🗂️', category: 'media', level: 'simple', capital: 4, cooldown: 4,
  description: 'מעטפה חומה, עיתונאי ידיד, ומשפט "גורם בכיר".',
  unavailable: (s, p) => (s.politicians[str(p, 'politicianId')]?.active ? null : 'בחר יריב'),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    return rollOut(s, `הדלפה על ${t.name}`, '🗂️', [
      { w: 4, tone: 'good', text: `${t.name} מבלה את השבוע בהכחשות. אף אחד לא יודע שזה אתה.`, extra: (x) => { x.politicians[t.id].popularity = clamp(x.politicians[t.id].popularity - 9); }, headline: `חשיפה: הפרשה המביכה של ${t.name}` },
      { w: 3, tone: 'bad', text: 'העיתונאי חשף את המקור. אותך. "לא הייתה לו ברירה". הייתה לו.', fx: { playerReputation: -8, playerPopularity: -4 }, extra: (x) => { remember(x, t.id, 'betrayal', 'הדליף עליי', -25); }, headline: `${me(s).name} הוא המקור להדלפה על ${t.name}` },
      { w: 1.5, tone: 'neutral', text: 'החומר התגלה כמשעמם. "הוא אוכל פיצה עם אננס". חצי מדינה בעדו עכשיו.', extra: (x) => { x.politicians[t.id].popularity = clamp(x.politicians[t.id].popularity + 3); } },
    ]);
  },
});

def({
  id: 'write_book', title: 'לכתוב ספר: "אני והכיסא"', icon: '📕', category: 'media', level: 'medium', capital: 4, cooldown: 16,
  description: 'זיכרונות, סודות, וכמה חשבונות פתוחים.',
  unavailable: () => null,
  run: (s) => rollOut(s, 'הספר יצא', '📕', [
    { w: 3, tone: 'good', text: 'רב מכר! אפילו קראו אותו. חלקים ממנו.', fx: { playerPopularity: 5, playerReputation: 3 }, headline: '"אני והכיסא" – רב המכר של העונה' },
    { w: 3, tone: 'bad', text: 'הפרק על ישיבות הממשלה גרם לשלושה שרים לא לדבר איתך.', fx: { stability: -5, playerPopularity: 2 }, extra: (x) => { for (const m of Object.values(x.politicians).filter((q) => q.ministryId && !q.isPlayer).slice(0, 3)) remember(x, m.id, 'betrayal', 'כתב עליי בספר', -10); }, headline: 'הספר של השר חושף: "בישיבות הממשלה אוכלים בורקס ולא מחליטים"' },
    { w: 2, tone: 'bad', text: 'נמכרו 140 עותקים. 120 קנתה המפלגה.', fx: { playerPopularity: -2 } },
  ]),
});

def({
  id: 'charity_photo', title: 'צילום בהתנדבות בבית תמחוי', icon: '🍲', category: 'media', level: 'simple', capital: 1, cooldown: 3,
  description: 'סינר, מצקת, צלם. 12 דקות של נתינה.',
  unavailable: () => null,
  run: (s) => rollOut(s, 'התנדבות מצולמת', '🍲', [
    { w: 5, tone: 'good', text: 'תמונה מרגשת. אנשים התרגשו. בעיקר הצלם.', fx: { playerPopularity: 3, groups: { lowIncome: 2 } } },
    { w: 3, tone: 'bad', text: 'מתנדבת חשפה שעזבת אחרי 12 דקות, כולל הצילומים.', fx: { playerPopularity: -4, groups: { lowIncome: -3 } }, headline: 'ההתנדבות של השר: 12 דקות, 40 תמונות' },
    { w: 1.5, tone: 'neutral', text: 'שפכת מרק על ראש עיר. הוא חייך. אחר כך הוא לא חייך.', fx: { playerPopularity: 1 } },
  ]),
});

// ===== PM: national drama =====
def({
  id: 'state_emergency', title: 'להכריז מצב חירום לאומי', icon: '🚨', category: 'government', level: 'major', capital: 10, cooldown: 16,
  description: 'הכנסטון מתכנס בזום, ההחלטות עוברות בלי דיון. מאוד יעיל. מאוד מפחיד.',
  unavailable: (s) => (isPM(s) ? null : 'רק ראש הממשלה'),
  run: (s) => {
    applyDecision(s, { stability: 12, playerReputation: -6, groups: { left: -10, center: -6, right: 3, elderly: 2 } });
    addNews(s, 'מצב חירום לאומי! הכנסטון יתכנס בזום. מומלץ לא לשאול למה', 'bad', '🚨');
    return { title: 'מצב חירום הוכרז', quip: 'הסיבה הרשמית: "המצב". הסיבה האמיתית: גם "המצב".' };
  },
});

def({
  id: 'cabinet_purge', title: 'לטהר את הממשלה', icon: '🧹', category: 'government', level: 'major', capital: 12, cooldown: 16,
  description: 'כל שר עם נאמנות מתחת ל-40 – בחוץ. בבת אחת. בשידור חי.',
  unavailable: (s) => (isPM(s) ? null : 'רק ראש הממשלה'),
  run: (s) => {
    const victims = s.government.ministries.filter((m) => m.ministerId && m.ministerId !== s.player.politicianId && s.politicians[m.ministerId].loyalty < 40);
    for (const m of victims) {
      const p = s.politicians[m.ministerId!];
      p.ministryId = null;
      m.ministerId = s.government.pmId;
      remember(s, p.id, 'fired', 'טוהר מהממשלה', -35);
    }
    applyDecision(s, { stability: -4 * victims.length, playerPopularity: 2 + victims.length, playerReputation: 2 });
    addNews(s, `"ליל הסכינים הקצרות": ראש הממשלה פיטר ${victims.length} שרים`, 'bad', '🧹');
    s.career.memorable.push(`טיהר ${victims.length} שרים בלילה אחד`);
    return { title: `${victims.length} שרים פוטרו`, subtitle: victims.map((m) => m.name).join(', ') || 'אף אחד – כולם נאמנים. מחשיד.', quip: 'עכשיו אתה מחזיק בעשרה תיקים. בהצלחה עם ישיבות הבוקר.' };
  },
});

def({
  id: 'cash_handout', title: 'מענק ₪1,000 לכל אזרח לפני הבחירות', icon: '💵', category: 'government', level: 'major', capital: 6, cooldown: 24,
  description: '₪10 מיליארד מהקופה לכיס של כל אחד. מקרה לגמרי שזה לפני הבחירות.',
  unavailable: (s) => (isPM(s) ? null : 'רק ראש הממשלה'),
  run: (s) => {
    applyDecision(s, { oneOffCost: 10, economy: { inflation: 0.7, growth: 0.3 }, playerPopularity: 7, groups: Object.fromEntries(GROUPS.map((g) => [g.id, 4])) as Partial<Record<GroupId, number>> });
    addNews(s, 'כל אזרח יקבל ₪1,000. "אין קשר לבחירות", הבהירו בלשכה', 'satire', '💵');
    return { title: 'כל אזרח קיבל ₪1,000', quip: 'הקניונים חוגגים. בנק צבריה פחות.' };
  },
});

def({
  id: 'birthday_holiday', title: 'יום חופש לאומי ביום ההולדת שלך', icon: '🎂', category: 'government', level: 'simple', capital: 3, cooldown: 24,
  description: 'מצעד, זיקוקים ועוגה ממלכתית.',
  unavailable: (s) => (isPM(s) ? null : 'רק ראש הממשלה'),
  run: (s) => {
    applyDecision(s, { economy: { growth: -0.1 }, groups: { employees: 3, students: 3, selfEmployed: -5, left: -3 }, playerPopularity: 1, playerReputation: -3 });
    return { title: 'הוכרז "יום הכיסא"', quip: 'בעלי העסקים פתחו בכל זאת. עם שלט "חוגגים בלי".' };
  },
});

def({
  id: 'nation_address', title: 'נאום לאומה בפריים טיים', icon: '🎥', category: 'government', level: 'simple', capital: 4, cooldown: 4,
  description: '20 דקות, דגל, ומבט עמוק למצלמה.',
  unavailable: (s) => (isPM(s) ? null : 'רק ראש הממשלה'),
  run: (s) => rollOut(s, 'נאום לאומה', '🎥', [
    { w: 4, tone: 'good', text: 'נאום מרגש. אפילו אנשי האופוזיציה הנהנו. בטעות.', fx: { playerPopularity: 5, stability: 3 }, headline: 'נאום ראש הממשלה ריגש את האומה' },
    { w: 3, tone: 'bad', text: 'הנאום נמשך 58 דקות. הרייטינג ירד מ-30% ל-4%.', fx: { playerPopularity: -3 }, headline: 'הנאום שלא נגמר: 58 דקות, אפס חדשות' },
    { w: 1.5, tone: 'neutral', text: 'הטלפרומפטר נתקע. אילתרת 6 דקות על ילדותך. מוזר, אבל נגע ללב.', fx: { playerPopularity: 2, playerReputation: -1 } },
  ]),
});

def({
  id: 'postpone_elections', title: 'לדחות את הבחירות "בגלל המצב"', icon: '⏸️', category: 'government', level: 'major', capital: 15, cooldown: 30,
  description: 'שנה נוספת על הכיסא. בג״ץ, הרחוב והאופוזיציה – פחות מתלהבים.',
  unavailable: (s) => (!isPM(s) ? 'רק ראש הממשלה' : turnsToElection(s) > 8 ? 'עוד מוקדם לדחות – הבחירות רחוקות' : null),
  run: (s) => {
    applyDecision(s, { groups: { left: -15, center: -12, secular: -6, right: 2 }, stability: -10, playerReputation: -12 });
    if (!s.crises.some((c) => c.defId === 'cost_protest')) startCrisis(s, 'cost_protest', 3);
    if (rand(s) < 0.4) {
      applyEffects(s, { playerPopularity: -8 });
      addNews(s, 'בג״ץ ביטל את דחיית הבחירות. ראש הממשלה: "שופטים לא נבחרים!"', 'bad', '⚖️');
      return { title: 'בג״ץ ביטל את הדחייה', status: 'rejected', quip: 'הבחירות במועדן. והמחאה – גם.' };
    }
    s.elections.scheduledTurn += 6;
    addNews(s, 'הבחירות נדחו בשנה "בגלל המצב". המצב: ראש הממשלה בסקרים', 'bad', '⏸️');
    s.career.memorable.push('דחה את הבחירות בשנה');
    return { title: 'הבחירות נדחו בשנה', quip: 'דמוקרטיה זה כמו טלוויזיה: אפשר לעשות לה השהיה.' };
  },
});

def({
  id: 'media_enemy', title: 'להכריז על התקשורת "אויבת העם"', icon: '📵', category: 'government', level: 'medium', capital: 5, cooldown: 12,
  description: 'מי שלא איתך – נגדך. ובעיקר העיתונאים.',
  unavailable: (s) => (isPM(s) ? null : 'רק ראש הממשלה'),
  run: (s) => {
    applyDecision(s, { groups: { right: 5, settlers: 2, left: -10, center: -5 }, playerReputation: -6, playerPopularity: 2 });
    addNews(s, 'ראש הממשלה הכריז על התקשורת "אויבת העם". התקשורת: "אנחנו מסקרים את זה"', 'bad', '📵');
    return { title: 'התקשורת הוכרזה "אויבת העם"', quip: 'מחר כל הכותרות יעסקו בך. בדיוק כמו שרצית.' };
  },
});

def({
  id: 'declare_war_pm', title: 'להכריז מלחמה', icon: '💥', category: 'government', level: 'major', capital: 12, cooldown: 30,
  description: 'הסקרים בשמיים, הכלכלה בבור, והמילואימניקים בשטח.',
  unavailable: (s) => (!isPM(s) ? 'רק ראש הממשלה' : s.crises.some((c) => c.defId === 'war') ? 'כבר יש מלחמה' : null),
  run: (s) => {
    applyDecision(s, { oneOffCost: 4, economy: { growth: -0.9, unemployment: 0.3 }, groups: { right: 8, settlers: 6, reservists: -8, families: -4, left: -10 }, stability: 10, playerPopularity: 7 });
    startCrisis(s, 'war', 3);
    s.career.memorable.push('הכריז מלחמה');
    return { title: 'מלחמה!', quip: 'אפקט "התלכדות סביב הדגל": הסקרים עולים לחודשיים. אחר כך מגיעה ועדת חקירה.' };
  },
});

def({
  id: 'network', title: 'קפה עם פוליטיקאי', icon: '☕', category: 'career', level: 'simple', capital: 5, cooldown: 1,
  description: 'אספרסו כפול, חיוכים מזויפים ונאמנות זמנית.',
  unavailable: (s, p) => (s.politicians[str(p, 'politicianId')]?.active && str(p, 'politicianId') !== s.player.politicianId ? null : 'בחר פוליטיקאי'),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    const gain = randInt(s, 6, 12) - Math.round(t.personality.ego * 4);
    remember(s, t.id, 'support', 'שתינו קפה', gain);
    me(s).power = clamp(me(s).power + 1);
    return { title: `קפה עם ${t.name}`, subtitle: `נאמנות +${Math.round(gain * 0.6)}`, people: [{ icon: '☕', label: t.name, text: pick(s, ['נעים מאוד. אתה משלם?', 'אני זוכר חברים.', 'בוא נדבר על העתיד. שלי.']), tone: 'good' }] };
  },
});

def({
  id: 'support_leader', title: 'גיבוי פומבי למנהיג', icon: '🙌', category: 'career', level: 'simple', capital: 0, cooldown: 3,
  description: 'להגיד בטלוויזיה שהמנהיג גאון. גם כשהוא לא.',
  unavailable: (s) => (isPartyLeader(s) ? 'אתה המנהיג' : null),
  run: (s) => {
    const l = s.politicians[s.parties[s.player.partyId].leaderId];
    remember(s, l.id, 'support', 'גיבה אותי בתקשורת', 12);
    applyEffects(s, { playerReputation: -1 });
    return { title: `גיבית את ${l.name}`, people: [{ icon: '😌', label: l.name, text: 'זה נאמנות. אני זוכר.', tone: 'good' }] };
  },
});

def({
  id: 'ask_position', title: 'לבקש תפקיד', icon: '🙋', category: 'career', level: 'simple', capital: 3, cooldown: 4,
  description: 'לדפוק על הדלת של המנהיג ולהזכיר לו שאתה קיים. הוא שכח.',
  unavailable: (s) => (s.player.role !== 'mk' ? 'כבר יש לך תפקיד' : isPartyLeader(s) ? 'אתה המנהיג' : null),
  run: (s) => {
    const leader = s.politicians[s.parties[s.player.partyId].leaderId];
    const pl = me(s);
    const inGov = s.government.coalition.includes(pl.partyId);
    const ok = leader.loyalty > 58 && pl.power > 32 && s.player.reputation > 40;
    if (!ok) {
      leader.loyalty = clamp(leader.loyalty - 3);
      return { title: 'לא עכשיו', status: 'rejected', people: [{ icon: '🤨', label: leader.name, text: 'תוכיח את עצמך קודם.', tone: 'bad' }] };
    }
    if (inGov) {
      const free = s.government.ministries.filter((m) => (m.agreementPartyId === pl.partyId && (!m.ministerId || m.ministerId === s.government.pmId)) || m.satire);
      const target = free[0];
      if (target) {
        assignMinister(s, target.id, pl.id);
        setRole(s, 'minister', `מונה ל${target.name}`);
        return { title: `מונית ל${target.name}!`, status: 'approved', quip: target.satire ? 'זה המשרד לנושאים אסטרטגיים כלליים. לפחות יש נהג.' : undefined };
      }
    }
    pl.committee = 'ועדת הכספים';
    pl.power = clamp(pl.power + 8);
    s.career.memorable.push('מונה ליו״ר ועדת הכספים');
    return { title: 'קיבלת ראשות ועדה', status: 'approved', subtitle: 'ועדת הכספים' };
  },
});

def({
  id: 'run_primaries', title: 'קריאת תיגר על ההנהגה', icon: '⚔️', category: 'career', level: 'major', capital: 20, cooldown: 8,
  description: 'סכין בגב, בחיוך, בשידור חי. מנצחים – הכיסא שלך. מפסידים – נתראה בפודקאסט.',
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
      addNews(s, `רעידת אדמה: ${pl.name} ניצח את ${leader.name} בפריימריז`, 'good', '👑');
      if (s.government.pmId === leader.id) {
        s.government.pmId = pl.id;
        if (pl.ministryId) { const m = getMinistry(s, pl.ministryId); if (m) m.ministerId = pl.id; }
        for (const m of s.government.ministries) if (m.ministerId === leader.id) m.ministerId = pl.id;
        s.career.governmentsFormed += 1;
      }
      syncRole(s);
      return { title: 'ניצחת בפריימריז!', status: 'approved', subtitle: `אתה ${s.player.role === 'pm' ? 'ראש הממשלה' : 'מנהיג ' + party.name}` };
    }
    remember(s, leader.id, 'betrayal', 'ניסה להדיח אותי', -35);
    pl.power = clamp(pl.power - 15);
    s.flags.failed_primaries = s.turn;
    addNews(s, `${pl.name} הובס בפריימריז. ${leader.name}: "נסגור חשבון"`, 'bad', '💀');
    s.career.failures.push(`הפסיד בפריימריז ב${party.name}`);
    return { title: 'הפסדת בפריימריז', status: 'rejected', subtitle: `סיכויי הניצחון היו ${Math.round(pWin * 100)}%`, quip: 'המנהיג לא שוכח. בכלל.' };
  },
});

def({
  id: 'switch_party', title: 'מעבר מפלגה', icon: '🦘', category: 'career', level: 'major', capital: 15, cooldown: 12,
  description: 'אידיאולוגיה זה זמני. מקום ריאלי – זה נצחי.',
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
    addNews(s, `${pl.name} עובר ל${to.name}. ב${from.name}: "בוגד"`, 'bad', '🦘');
    syncRole(s);
    return { title: `ברוך הבא ל${to.name}`, subtitle: `מקום ${s.player.listRank} ברשימה (בינתיים)` };
  },
});

def({
  id: 'resign', title: 'התפטרות', icon: '🚪', category: 'career', level: 'major', capital: 0,
  description: 'לחזור ״למשפחה״. המשפחה כבר החליפה מנעול.',
  unavailable: () => null,
  run: (s) => {
    setGameOver(s, 'resigned', 'התפטרת');
    return { title: 'התפטרת', status: 'info' };
  },
});

// ===== PARTY (leader) =====
def({
  id: 'rename_party', title: 'מיתוג מחדש', icon: '🎨', category: 'party', level: 'simple', capital: 3, cooldown: 6,
  description: 'שם חדש, לוגו חדש, אותם אנשים בדיוק. כמו תמיד.',
  unavailable: (s, p) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : str(p, 'name').trim().length < 2 ? 'שם קצר מדי' : null),
  run: (s, p) => {
    const party = s.parties[s.player.partyId];
    const old = party.name;
    party.name = str(p, 'name').trim().slice(0, 32);
    party.shortName = party.name.slice(0, 14);
    if (str(p, 'logo')) party.logo = str(p, 'logo');
    if (str(p, 'color')) party.color = str(p, 'color');
    party.momentum = clamp(party.momentum + (rand(s) < 0.5 ? 3 : -2), -40, 40);
    addNews(s, `${old} היא מעכשיו "${party.name}". הסקרים מבולבלים`, 'satire', party.logo);
    return { title: `"${party.name}"`, quip: 'המיתוג עלה 2 מיליון. הלוגו – אימוג׳י.' };
  },
});

def({
  id: 'promote_member', title: 'קידום חבר מפלגה', icon: '⬆️', category: 'party', level: 'simple', capital: 3, cooldown: 1,
  description: 'מקום טוב ברשימה = חבר נאמן. לחודשיים.',
  unavailable: (s, p) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : s.politicians[str(p, 'politicianId')]?.partyId !== s.player.partyId ? 'רק חברי המפלגה' : null),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    t.power = clamp(t.power + 6);
    remember(s, t.id, 'favor', 'קודם ברשימה', 12);
    for (const id of s.parties[s.player.partyId].memberIds) if (id !== t.id && !s.politicians[id].isPlayer) s.politicians[id].loyalty = clamp(s.politicians[id].loyalty - 1.5);
    return { title: `${t.name} קודם`, people: [{ icon: '😄', label: t.name, text: 'ידעתי שאתה מעריך אותי!', tone: 'good' }] };
  },
});

def({
  id: 'demote_member', title: 'הורדה ברשימה', icon: '⬇️', category: 'party', level: 'simple', capital: 3, cooldown: 1,
  description: 'מסר ברור לכולם. והוא כבר מחפש מפלגה אחרת.',
  unavailable: (s, p) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : s.politicians[str(p, 'politicianId')]?.partyId !== s.player.partyId ? 'רק חברי המפלגה' : null),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    t.power = clamp(t.power - 8);
    remember(s, t.id, 'insult', 'הורד ברשימה', -20);
    return { title: `${t.name} הורד ברשימה`, people: [{ icon: '😤', label: t.name, text: 'תזכור את היום הזה.', tone: 'bad' }] };
  },
});

def({
  id: 'expel_member', title: 'הוצאה מהמפלגה', icon: '🚫', category: 'party', level: 'medium', capital: 8, cooldown: 4,
  description: 'זורקים אותו החוצה. הוא לוקח איתו מנדט ופודקאסט.',
  unavailable: (s, p) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : s.politicians[str(p, 'politicianId')]?.partyId !== s.player.partyId || str(p, 'politicianId') === s.player.politicianId ? 'רק חברי המפלגה' : null),
  run: (s, p) => {
    const t = s.politicians[str(p, 'politicianId')];
    const party = s.parties[s.player.partyId];
    party.memberIds = party.memberIds.filter((id) => id !== t.id);
    t.active = false;
    t.quirk = 'הוצא מהמפלגה. עכשיו יש לו פודקאסט.';
    if (t.ministryId) { const m = getMinistry(s, t.ministryId); if (m) m.ministerId = s.government.pmId; t.ministryId = null; }
    party.seats = Math.max(1, party.seats - 1);
    party.cohesion = clamp(party.cohesion + (t.loyalty < 40 ? 8 : -6));
    addNews(s, `${t.name} הוצא מ${party.name}`, 'neutral', '🚫');
    return { title: `${t.name} בחוץ`, subtitle: `המפלגה ירדה ל-${party.seats} מנדטים בכנסטון` };
  },
});

def({
  id: 'recruit_star', title: 'גיוס כוכב', icon: '🌟', category: 'party', level: 'medium', capital: 10, cooldown: 6,
  description: 'מגייסים סלב שלא יודע מה זו ועדת כספים. הוותיקים כבר מחדדים סכינים.',
  unavailable: (s) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : s.parties[s.player.partyId].funds < 2 ? 'אין מספיק כסף במפלגה' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    const kinds = [
      { t: 'אלוף במילואים', d: 'defense' as Domain }, { t: 'כלכלנית בכירה', d: 'economy' as Domain }, { t: 'מגיש טלוויזיה', d: 'media' as Domain },
      { t: 'מנהלת בית חולים', d: 'health' as Domain }, { t: 'מנכ״ל הייטק', d: 'science' as Domain }, { t: 'מנהלת בית ספר', d: 'education' as Domain },
    ];
    const k = pick(s, kinds);
    const id = newId(s, 'pol');
    const gender = rand(s) < 0.5 ? 'f' : 'm';
    const pol: Politician = {
      id, name: `${pick(s, gender === 'f' ? ['נועה', 'מיכל', 'רוני', 'שירה'] : ['גיא', 'עומר', 'אורי', 'יואב'])} ${pick(s, ['כוכבי', 'זוהר', 'פריים-טיים', 'מגנטי'])}`,
      gender, partyId: party.id, ministryId: null, committee: null, mainDomain: k.d, expertise: { [k.d]: 82 }, power: 40, loyalty: 70,
      popularity: 62, experience: 0, personality: { ego: 0.8, ambition: 0.9, honesty: 0.6, aggression: 0.4 }, ideology: { ...party.ideology },
      memory: [], relationships: {}, caricature: randomCaricature(s, gender, party.id), quirk: `${k.t} לשעבר. מגיע עם יחצ״נית.`, cooldownUntil: s.turn + 4,
      isPlayer: false, active: true, ambitionTarget: 'משרד בכיר',
    };
    s.politicians[id] = pol;
    party.memberIds.push(id);
    party.funds -= 2;
    applyEffects(s, { partyMomentum: { [party.id]: 5 } });
    for (const mid of party.memberIds) if (mid !== id && !s.politicians[mid].isPlayer) s.politicians[mid].loyalty = clamp(s.politicians[mid].loyalty - 2);
    addNews(s, `${party.name} מגייסת: ${pol.name}, ${k.t}`, 'good', '🌟');
    return { title: `הצטרף/ה: ${pol.name}`, subtitle: k.t, quip: 'הוותיקים במפלגה כבר מחשבים מי יורד ברשימה.' };
  },
});

def({
  id: 'fundraise', title: 'גיוס תרומות', icon: '💵', category: 'party', level: 'simple', capital: 2, cooldown: 2,
  description: 'ערב התרמה חוקי לגמרי. לגמרי. תפסיקו לשאול.',
  unavailable: (s) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    const amount = round1(1.5 + me(s).popularity / 30 + rand(s));
    party.funds += amount;
    return { title: `גויסו ₪${amount} מיליון`, quip: 'כל התרומות דווחו. כן, גם הקרפ מהמזנון.' };
  },
});

def({
  id: 'party_line', title: 'שינוי קו המפלגה', icon: '🧭', category: 'party', level: 'medium', capital: 6, cooldown: 6,
  description: 'אתמול ימין, היום מרכז, מחר מה שהסקר אומר.',
  unavailable: (s) => (!getCapabilities(s).canManageParty ? 'רק מנהיג המפלגה' : null),
  run: (s, p) => {
    const axis = str(p, 'axis') as keyof Ideology;
    const dir = num(p, 'dir') > 0 ? 1 : -1;
    const party = s.parties[s.player.partyId];
    party.ideology[axis] = clamp(party.ideology[axis] + dir * 0.2, -1, 1);
    me(s).ideology[axis] = party.ideology[axis];
    const map: Record<keyof Ideology, [GroupId[], GroupId[]]> = {
      economic: [['highIncome', 'selfEmployed'], ['lowIncome', 'publicSector']],
      security: [['right', 'settlers', 'reservists'], ['left']],
      religion: [['religious', 'haredim'], ['secular']],
    };
    const [up, down] = dir > 0 ? map[axis] : [map[axis][1], map[axis][0]];
    for (const g of up) party.affinity[g] = (party.affinity[g] ?? 0) + 0.4;
    for (const g of down) party.affinity[g] = Math.max(0, (party.affinity[g] ?? 0) - 0.4);
    for (const id of party.memberIds) {
      const m = s.politicians[id];
      if (!m.isPlayer && Math.abs(m.ideology[axis] - party.ideology[axis]) > 0.4) remember(s, id, 'insult', 'שינה את הקו', -6);
    }
    const names = { economic: ['ימינה כלכלית', 'שמאלה כלכלית'], security: ['ניצית יותר', 'יונית יותר'], religion: ['מסורתית יותר', 'חילונית יותר'] };
    addNews(s, `${party.name} זזה ${names[axis][dir > 0 ? 0 : 1]}`, 'neutral', '🧭');
    return { title: `המפלגה זזה ${names[axis][dir > 0 ? 0 : 1]}` };
  },
});

// ===== CAMPAIGN =====
def({
  id: 'campaign_rally', title: 'כנס בחירות', icon: '📢', category: 'campaign', level: 'simple', capital: 2, cooldown: 1,
  description: 'במה, דגלים ונאום. חצי מהקהל הגיע בשביל הסנדוויצ׳ים.',
  unavailable: (s) => (!getCapabilities(s).canCampaign ? 'רק מנהיג מפלגה' : turnsToElection(s) > 8 ? 'מוקדם מדי לקמפיין (8 תורות לפני בחירות)' : s.parties[s.player.partyId].funds < 1.5 ? 'אין כסף במפלגה' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    party.funds -= 1.5;
    addCampaign(s, party.id, 2);
    applyEffects(s, { playerPopularity: 1 });
    return { title: 'כנס מוצלח', subtitle: 'קמפיין +2', quip: 'אלפים הגיעו. חלקם בשביל הסנדוויצ׳ים.' };
  },
});

def({
  id: 'campaign_ads', title: 'קמפיין פרסום', icon: '🖼️', category: 'campaign', level: 'simple', capital: 1, cooldown: 1,
  description: 'שלטי חוצות עם הפרצוף שלך, מחויך מדי. ₪4 מיליון.',
  unavailable: (s) => (!getCapabilities(s).canCampaign ? 'רק מנהיג מפלגה' : turnsToElection(s) > 8 ? 'מוקדם מדי לקמפיין' : s.parties[s.player.partyId].funds < 4 ? 'אין כסף במפלגה' : null),
  run: (s) => {
    const party = s.parties[s.player.partyId];
    party.funds -= 4;
    addCampaign(s, party.id, 4);
    return { title: 'הקמפיין עלה לאוויר', subtitle: 'קמפיין +4', quip: `הסלוגן: "${party.slogan}"` };
  },
});

def({
  id: 'debate', title: 'עימות טלוויזיוני', icon: '🎤', category: 'campaign', level: 'medium', capital: 4, cooldown: 4,
  description: 'שעה של צעקות. מי שמגמגם פחות – מנצח.',
  unavailable: (s) => (!getCapabilities(s).canCampaign ? 'רק מנהיג מפלגה' : turnsToElection(s) > 4 ? 'עימותים רק בחצי השנה לפני הבחירות' : null),
  run: (s) => {
    const win = rand(s) < 0.35 + s.player.reputation / 250 + me(s).popularity / 300;
    const party = s.parties[s.player.partyId];
    addCampaign(s, party.id, win ? 5 : -3);
    addNews(s, win ? `${me(s).name} ניצח בעימות` : `${me(s).name} גמגם בעימות; הממים כבר ברשת`, win ? 'good' : 'bad', '🎤');
    return { title: win ? 'ניצחת בעימות!' : 'העימות לא הלך טוב', status: win ? 'approved' : 'rejected' };
  },
});

def({
  id: 'seek_endorsement', title: 'התחייבות להמליץ', icon: '✍️', category: 'campaign', level: 'medium', capital: 8, cooldown: 2,
  description: 'מנהיג אחר מבטיח להמליץ עליך לנשיא. הבטחות פוליטיות תקפות עד הבוקר.',
  unavailable: (s, p) => {
    if (!isPartyLeader(s)) return 'רק מנהיג מפלגה';
    if (turnsToElection(s) > 8) return 'רק בשנה וחצי שלפני הבחירות';
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
      return { title: `${party.name} התחייבה להמליץ עליך`, status: 'approved', subtitle: `סיכוי היה ${Math.round(chanceOk * 100)}%`, quip: 'התחייבות בפוליטיקה תקפה עד שהיא לא.' };
    }
    leader.loyalty = clamp(leader.loyalty - 3);
    return { title: `${leader.name} לא מתחייב`, status: 'rejected', subtitle: `סיכוי היה ${Math.round(chanceOk * 100)}%`, people: [{ icon: party.logo, label: leader.name, text: 'נראה אחרי הבחירות.', tone: 'neutral' }] };
  },
});

def({
  id: 'make_promise', title: 'הבטחת בחירות', icon: '🤞', category: 'campaign', level: 'simple', capital: 2,
  description: 'להבטיח עכשיו, להתנצל אחר כך. כמו כולם.',
  unavailable: (s, p) => (!getCapabilities(s).canMakePromises ? 'הבטחות רק כמנהיג מפלגה, בשנה שלפני הבחירות' : !PROMISE_BY_ID[str(p, 'promiseId')] ? 'בחר הבטחה' : null),
  run: (s, p) => {
    const r = makePromise(s, str(p, 'promiseId'));
    return { title: r.title, subtitle: r.subtitle, status: r.status, quip: r.quip };
  },
});

export const ACTIONS: Record<string, ActionDef> = Object.fromEntries(A.map((a) => [a.id, a]));
export { ministryActionSpecs };

export function actionCapital(s: GameState, id: string, p: Params): number {
  const a = ACTIONS[id];
  if (!a) return 0;
  return typeof a.capital === 'function' ? a.capital(s, p) : a.capital ?? 0;
}

export function cooldownLeft(s: GameState, id: string, p: Params = {}): number {
  const key = cooldownKey(id, p);
  return Math.max(0, (s.player.actionCooldowns[key] ?? 0) - s.turn);
}
const cooldownKey = (id: string, p: Params) => (p.ministryId ? `${id}_${p.ministryId}` : id);

export function checkAction(s: GameState, id: string, p: Params = {}): string | null {
  const a = ACTIONS[id];
  if (!a) return 'פעולה לא קיימת';
  if (s.gameOver) return 'המשחק נגמר';
  if (s.elections.phase === 'negotiation') return 'קודם צריך להרכיב ממשלה';
  const r = a.unavailable(s, p);
  if (r) return r;
  const cd = cooldownLeft(s, id, p);
  if (cd > 0) return `זמין שוב בעוד ${cd * 2} חודשים`;
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
  if (!groups.length && a.category !== 'media' && a.category !== 'career') {
    const g = GROUP_BY_ID.youth;
    groups.push({ icon: g.emoji, label: g.name, text: 'לא ממש מעניין אותי כרגע.', tone: 'neutral' });
  }

  const people = [...(rr.people ?? [])];
  // everyone has an opinion: a rival and a voice of "the people" react to every decision
  if (people.length < 3 && a.id !== 'drama') people.push(...N.chorus(next, (rr.status ?? 'approved') !== 'rejected').slice(0, 3 - people.length));
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
    : participants.filter((x) => x.stance < -0.1).length >= 2 ? 'אני ממליץ לא להתחיל מלחמה בתוך הממשלה.' : 'נראה שיש רוב. אבל אל תסמוך על אף אחד.';
  return { actionId: id, params: p, participants, scale: 1, persuaded: 0, advisor };
}

export type MeetingChoice = 'approve' | 'persuade' | 'deal' | 'modify' | 'vote' | 'reject';

export function meetingStep(s0: GameState, m: Meeting, choice: MeetingChoice): { state: GameState; meeting: Meeting | null; result: ActionResult | null } {
  const s = clone(s0);
  const opp = m.participants.filter((x) => x.stance < -0.1);
  if (choice === 'reject') return { state: s0, meeting: null, result: { state: s0, reaction: { title: 'ההצעה נגנזה', status: 'info', stats: [], groups: [], people: [], quip: 'אולי בפעם אחרת.' } } };
  if (choice === 'persuade') {
    if (s.player.politicalCapital < 8) return { state: s0, meeting: m, result: null };
    s.player.politicalCapital -= 8;
    const parts = m.participants.map((x) => {
      if (x.stance >= -0.1) return x;
      const pol = s.politicians[x.id];
      const flip = rand(s) < 0.35 + pol.loyalty / 200;
      const stance = flip ? 0.3 : x.stance + 0.15;
      return { ...x, stance, bubble: flip ? pick(s, ['טוב, שכנעת אותי. הפעם.', 'בסדר. אבל זה רשום אצלי.', 'אוקיי, אני איתך.']) : pick(s, ['עדיין לא.', 'נחמד שניסית.', 'תביא משהו טוב יותר.']) };
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
      return { ...x, stance: 0.4, bubble: cat ? 'עם עוד ₪800 מיליון? אני בפנים.' : 'עסקה זו עסקה.' };
    });
    return { state: s, meeting: { ...m, participants: parts }, result: null };
  }
  if (choice === 'modify') {
    const parts = m.participants.map((x) => ({ ...x, stance: x.stance + 0.35, bubble: x.stance + 0.35 > -0.1 ? 'גרסה מרוככת? אפשר לחיות עם זה.' : x.bubble }));
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