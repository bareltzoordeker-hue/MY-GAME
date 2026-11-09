// Operation planning: choose the target, the leading and covering forces, the hour and the rules of engagement; see the odds and the
// price; take it to the security cabinet (persuade its members) and carry it out. The forces must fit the operation:
// a brigade does not lead an air campaign.
import { FRONT_TARGETS, OP_PLAN, PRECISION_USE, ROE, TIMES, type PlanRole, type RoeId, type TargetDef, type TimeId } from '../data/strikePlan';
import { DIFFICULTIES } from '../data/world';
import { FRONT_BY_ID, OPERATION_BY_ID, UNIT_BY_ID, type FrontId, type UnitId } from '../data/security';
import type { AfterAction, GameState, Politician } from '../types/game';
import { clamp } from '../utils';
import { cabinetMembers, intelFreshOf, setIntelFresh, stockOf, type OpMods, type OpOutcome, world } from './security';
import { addNews, applyEffects, logEvent } from './effects';
import { chance as roll, rand } from './rng';

export interface StrikePlan { opId: string; front: FrontId; target: string; lead: UnitId; cover: UnitId[]; intel?: UnitId; engineering?: UnitId; support?: UnitId; time: TimeId; roe: RoeId }

const AIR_OPS = ['air_campaign', 'targeted_strike', 'iran_strike'];
const GROUND_OPS = ['ground_raid', 'wide_ground'];

export const allowedUnits = (opId: string, role: PlanRole): UnitId[] => OP_PLAN[opId]?.roles[role] ?? [];
export const targetsFor = (front: FrontId, opId: string): TargetDef[] => FRONT_TARGETS[front].filter((t) => t.ops.includes(opId));
const readiness = (s: GameState, id: UnitId) => world(s).units[id]?.readiness ?? 70;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** The plan as action parameters, and back. */
export function planToParams(p: StrikePlan): Record<string, string> {
  return { opId: p.opId, front: p.front, target: p.target, lead: p.lead, cover: p.cover.join(','), intel: p.intel ?? '', engineering: p.engineering ?? '', support: p.support ?? '', time: p.time, roe: p.roe };
}
export function planFromParams(q: Record<string, unknown>): StrikePlan | null {
  const str = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : '');
  if (!str('lead') || !str('opId') || !str('front')) return null;
  return {
    opId: str('opId'), front: str('front') as FrontId, target: str('target'), lead: str('lead') as UnitId,
    cover: str('cover') ? (str('cover').split(',') as UnitId[]) : [], intel: (str('intel') || undefined) as UnitId | undefined,
    engineering: (str('engineering') || undefined) as UnitId | undefined, support: (str('support') || undefined) as UnitId | undefined,
    time: (str('time') || 'dusk') as TimeId, roe: (str('roe') || 'balanced') as RoeId,
  };
}

/** A sensible starting plan: the best-prepared units that may take each role. */
export function defaultPlan(s: GameState, opId: string, front: FrontId): StrikePlan {
  const best = (role: PlanRole, exclude: UnitId[] = []) => [...allowedUnits(opId, role)].filter((u) => !exclude.includes(u)).sort((a, b) => readiness(s, b) - readiness(s, a))[0];
  const lead = best('lead')!;
  const cover = best('cover', [lead]);
  return {
    opId, front, target: targetsFor(front, opId)[0]?.id ?? '', lead, cover: cover ? [cover] : [], intel: best('intel'),
    engineering: allowedUnits(opId, 'engineering').length ? best('engineering') : undefined, support: allowedUnits(opId, 'support').length ? best('support') : undefined,
    time: 'dusk', roe: 'balanced',
  };
}

export interface PlanEval {
  ok: boolean; issues: string[]; warnings: string[];
  chance: number; fallenEst: number; homeCivEst: number; enemyCivEst: number; cutEst: number; intlEst: number;
  target?: TargetDef; mods: OpMods;
}

export function evaluatePlan(s: GameState, plan: StrikePlan): PlanEval {
  const op = OPERATION_BY_ID[plan.opId];
  const spec = OP_PLAN[plan.opId];
  const issues: string[] = [];
  const warnings: string[] = [];
  const target = FRONT_TARGETS[plan.front]?.find((t) => t.id === plan.target);
  const empty: PlanEval = { ok: false, issues, warnings, chance: 0, fallenEst: 0, homeCivEst: 0, enemyCivEst: 0, cutEst: 0, intlEst: 0, target, mods: {} };
  if (!op || !spec) return { ...empty, issues: ['סוג מבצע לא מוכר'] };
  if (!op.fronts.includes(plan.front)) issues.push('המבצע לא מתאים לחזית הזו');
  if (!target || !target.ops.includes(plan.opId)) issues.push('בחר מטרה שמתאימה למבצע');
  if (!spec.roles.lead?.includes(plan.lead)) issues.push(`${UNIT_BY_ID[plan.lead]?.name ?? 'היחידה'} לא יכולה להוביל מבצע כזה`);
  const coverUnits = [...new Set(plan.cover)].filter((u) => u !== plan.lead);
  if (plan.cover.length > 2) issues.push('אפשר עד שתי יחידות מחפות');
  for (const u of coverUnits) if (!spec.roles.cover?.includes(u)) issues.push(`${UNIT_BY_ID[u]?.name ?? u} לא מתאימה לחיפוי במבצע כזה`);
  const check = (role: PlanRole, u?: UnitId) => { if (u && !spec.roles[role]?.includes(u)) issues.push(`${UNIT_BY_ID[u]?.name ?? u} לא מתאימה לתפקיד הזה במבצע כזה`); };
  check('intel', plan.intel); check('engineering', plan.engineering); check('support', plan.support);
  const have: Record<PlanRole, boolean> = { lead: !!plan.lead, cover: coverUnits.length > 0, intel: !!plan.intel, engineering: !!plan.engineering, support: !!plan.support };
  for (const r of spec.required) if (!have[r]) issues.push(r === 'engineering' ? 'מבצע קרקעי רחב דורש הנדסה קרבית' : r === 'intel' ? 'המבצע דורש מודיעין' : r === 'support' ? 'המבצע דורש סיוע והגנה לעורף' : 'חסר כוח מוביל');
  if (!TIMES[plan.time] || !ROE[plan.roe]) issues.push('בחר שעה וכללי פתיחה באש');
  if (issues.length) return { ...empty, issues };

  const time = TIMES[plan.time];
  const roe = ROE[plan.roe];
  const t = target!;
  const used: UnitId[] = [plan.lead, ...coverUnits, ...(plan.intel ? [plan.intel] : []), ...(plan.engineering ? [plan.engineering] : []), ...(plan.support ? [plan.support] : [])];
  for (const u of used) {
    const r = readiness(s, u);
    if (r < 40) warnings.push(`${UNIT_BY_ID[u].name} עייפה (כשירות ${r.toFixed(0)}). הסיכוי נפגע ויש יותר סיכון.`);
  }
  const lead = readiness(s, plan.lead);
  const coverAvg = coverUnits.length ? avg(coverUnits.map((u) => readiness(s, u))) : lead;
  const otherAvg = avg([plan.intel, plan.engineering, plan.support].filter((u): u is UnitId => !!u).map((u) => readiness(s, u))) || lead;
  const ready = 0.55 * lead + 0.25 * coverAvg + 0.2 * otherAvg;
  const intelQ = plan.intel ? readiness(s, plan.intel) : world(s).units.u8200.readiness;
  const stk = stockOf(s);
  const useP = PRECISION_USE[plan.opId] ?? 0;
  const lowPrecision = useP > 0 && stk.precision < useP * 1.2;
  const retaliates = (AIR_OPS.includes(plan.opId) || plan.opId === 'wide_ground') && !!FRONT_BY_ID[plan.front].rocketRange;
  const lowInterceptors = retaliates && stk.interceptors < 30;
  const fresh = intelFreshOf(s, plan.front);
  if (lowPrecision) warnings.push('מלאי התחמושת המדויקת נמוך: הסיכוי נפגע ויש יותר סיכון לאזרחים.');
  if (lowInterceptors) warnings.push('מלאי היירוטים נמוך: צפוי נזק רב יותר בעורף.');
  if (fresh < 50) warnings.push(`המודיעין על החזית ישן (רעננות ${Math.round(fresh)}). כדאי לרענן אותו לפני המבצע.`);
  const bonus = (lowPrecision ? -0.12 : 0) - (fresh < 50 ? (50 - fresh) / 400 : 0) + coverUnits.length * 0.025 + (plan.engineering && GROUND_OPS.includes(plan.opId) ? 0.04 : 0) + (t.intel - 60) / 500 + (plan.intel ? 0.03 : 0)
    + time.surprise + (AIR_OPS.includes(plan.opId) ? time.air : 0) + roe.success;
  const chance = clamp(0.42 + ready / 220 + intelQ / 500 - world(s).fronts[plan.front].threat / 400 - (DIFFICULTIES[s.difficulty].volatility - 1) * 0.1 + bonus, 0.12, 0.92);
  const casMult = time.own * (plan.engineering && GROUND_OPS.includes(plan.opId) ? 0.75 : 1) * (1 - 0.06 * coverUnits.length);
  const civMult = (plan.support ? 0.7 : 1) * (lowPrecision ? 1.25 : 1) * (lowInterceptors ? 1.4 : 1);
  const intlMult = roe.intl * (1 + t.collateral * time.civ * roe.civ * 0.4) * (isHasbara(s, plan) ? 0.8 : 1);
  const cutMult = t.value * roe.effect;
  const drains: Partial<Record<UnitId, number>> = {};
  const add = (u: UnitId, d: number) => { drains[u] = (drains[u] ?? 0) + d; };
  add(plan.lead, op.turns > 1 ? 22 : 10);
  for (const u of coverUnits) add(u, 6);
  if (plan.intel) add(plan.intel, 3);
  if (plan.engineering) add(plan.engineering, 8);
  if (plan.support) add(plan.support, 4);
  const fdef = op.id === 'iran_strike' ? 14 : 6;
  return {
    ok: true, issues, warnings, chance, target: t,
    fallenEst: Math.round(op.risk * 20 * casMult * 0.8), homeCivEst: Math.round(fdef * (1.4 - world(s).units.air_defense.readiness / 100) * civMult * 0.6),
    enemyCivEst: Math.round(t.collateral * 20 * time.civ * roe.civ), cutEst: Math.round(op.threatCut * cutMult), intlEst: op.intlCost * intlMult,
    mods: { chance, cutMult, casMult, civMult, intlMult, drains },
  };
}

// ------------------------------------------------------------ the security cabinet
export interface CabinetMember { id: string; name: string; title: string; lean: number; stance: 'support' | 'undecided' | 'oppose'; text: string; persuaded: boolean }

const briefKey = (p: StrikePlan) => `brief_${p.opId}_${p.front}`;
const persuadeKey = (id: string) => `persuade_${id}`;
const hasbaraKey = (p: StrikePlan) => `hasbara_${p.opId}_${p.front}`;
export const isHasbara = (s: GameState, p: StrikePlan) => (s.flags[hasbaraKey(p)] ?? -1) >= s.turn;
/** Prepared public diplomacy for the operation (2 capital): the international price falls by a fifth. */
export function planHasbara(s: GameState, plan: StrikePlan): boolean {
  if (isHasbara(s, plan) || s.player.politicalCapital < 2) return false;
  s.player.politicalCapital -= 2;
  s.flags[hasbaraKey(plan)] = s.turn;
  return true;
}
export const isBriefed = (s: GameState, p: StrikePlan) => (s.flags[briefKey(p)] ?? -1) >= s.turn;
export const isPersuaded = (s: GameState, id: string) => (s.flags[persuadeKey(id)] ?? -1) >= s.turn;

function leanOf(s: GameState, m: Politician, plan: StrikePlan, ev: PlanEval): { lean: number; worry: string } {
  if (m.isPlayer) return { lean: 1, worry: '' };
  const hawk = m.ideology.security;
  const t = ev.target!;
  const time = TIMES[plan.time];
  const roe = ROE[plan.roe];
  const collateral = t.collateral * time.civ * roe.civ * 0.5 * (1 - Math.max(0, hawk));
  const casualties = (ev.fallenEst / 20) * 0.3 * (1 - Math.max(0, hawk) * 0.7);
  const odds = (ev.chance - 0.5) * 0.6;
  const intl = (ev.intlEst / 12) * 0.25 * (1 - Math.max(0, hawk) * 0.5);
  const base = hawk * 1.2 + (m.loyalty - 50) / 80 + 0.1;
  const lean = base + odds - collateral - casualties - intl + (isPersuaded(s, m.id) ? 0.35 : 0) + (isBriefed(s, plan) ? 0.15 : 0) + (m.id === s.government.ministries.find((x) => x.id === 'defense')?.ministerId ? 0.15 : 0);
  const worries: [number, string][] = [[collateral, 'פגיעה באזרחים'], [casualties, 'מחיר בנפגעים'], [-odds, 'סיכוי נמוך להצלחה'], [intl, 'לחץ בינלאומי']];
  return { lean, worry: worries.sort((a, b) => b[0] - a[0])[0][1] };
}

export function cabinetPreview(s: GameState, plan: StrikePlan): CabinetMember[] {
  const ev = evaluatePlan(s, plan);
  if (!ev.ok) return [];
  return cabinetMembers(s).map((m) => {
    const { lean, worry } = leanOf(s, m, plan, ev);
    const stance = lean >= 0.1 ? 'support' : lean > -0.1 ? 'undecided' : 'oppose';
    const text = stance === 'support' ? (ev.chance >= 0.65 ? 'תומך. התוכנית נראית מוצקה.' : 'תומך. צריך לפעול.') : stance === 'undecided' ? `מתלבט. מה שמטריד אותי: ${worry}.` : `מתנגד. מה שמטריד אותי: ${worry}.`;
    const ministry = s.government.ministries.find((x) => x.ministerId === m.id);
    return { id: m.id, name: m.name, title: m.id === s.government.pmId ? 'ראש הממשלה' : ministry ? ministry.name : 'חבר הקבינט', lean, stance, text, persuaded: isPersuaded(s, m.id) };
  });
}

/** A briefing for the whole cabinet (2 capital): the intelligence picture makes the plan more convincing. */
export function briefCabinet(s: GameState, plan: StrikePlan): boolean {
  if (isBriefed(s, plan) || s.player.politicalCapital < 2) return false;
  s.player.politicalCapital -= 2;
  s.flags[briefKey(plan)] = s.turn;
  return true;
}
/** A personal talk with one member (3 capital). */
export function persuadeMember(s: GameState, memberId: string): boolean {
  if (isPersuaded(s, memberId) || s.player.politicalCapital < 3 || !s.politicians[memberId]) return false;
  s.player.politicalCapital -= 3;
  s.flags[persuadeKey(memberId)] = s.turn;
  return true;
}

/** The vote on the plan: a bit of chance on top of where each member leans. */
export function planCabinetVote(s: GameState, plan: StrikePlan): { yes: number; no: number; passed: boolean; lines: { icon: string; label: string; text: string; tone: 'good' | 'bad' }[] } {
  const members = cabinetPreview(s, plan);
  let yes = 0;
  let no = 0;
  const lines: { icon: string; label: string; text: string; tone: 'good' | 'bad' }[] = [];
  for (const m of members) {
    const ok = m.lean + (rand(s) - 0.5) * 0.3 > -0.05;
    if (ok) yes += 1; else no += 1;
    lines.push({ icon: ok ? '👍' : '👎', label: m.name, text: ok ? m.text.replace(/^מתנגד|^מתלבט/, 'תומך') : m.text.replace(/^תומך|^מתלבט/, 'מתנגד'), tone: ok ? 'good' : 'bad' });
  }
  return { yes, no, passed: yes > no, lines: lines.slice(0, 6) };
}

// ------------------------------------------------------------ the after-action report
/** Builds the phases and the report on a planned operation that has just been carried out. The phases agree with the overall result:
 *  a failed operation breaks down at one phase. */
export function buildAfterAction(s: GameState, plan: StrikePlan, ev: PlanEval, o: OpOutcome): AfterAction {
  const op = OPERATION_BY_ID[plan.opId];
  const t = ev.target!;
  const cover = [...new Set(plan.cover)].filter((u) => u !== plan.lead);
  const intelUnit = plan.intel ?? 'u8200';
  const stages: { icon: string; ok: string; bad: string }[] = [
    { icon: '📡', ok: `${UNIT_BY_ID[intelUnit].name}: המידע על היעד (${t.name}) אומת.`, bad: `${UNIT_BY_ID[intelUnit].name}: המידע על היעד (${t.name}) התברר כחלקי.` },
    { icon: '🚀', ok: `${UNIT_BY_ID[plan.lead].name}: פתיחה כמתוכנן בשעת ${TIMES[plan.time].label}.`, bad: `${UNIT_BY_ID[plan.lead].name}: התנגדות בלתי צפויה בפתיחה.` },
  ];
  for (const u of cover) stages.push({ icon: '🛡️', ok: `${UNIT_BY_ID[u].name}: חיפוי לכוח המוביל.`, bad: `${UNIT_BY_ID[u].name}: החיפוי לא הספיק ברגע הקריטי.` });
  if (plan.engineering) stages.push({ icon: '🧱', ok: `${UNIT_BY_ID[plan.engineering].name}: פינוי מטענים ופריצת הדרך.`, bad: `${UNIT_BY_ID[plan.engineering].name}: עומס מטענים שלא היה ידוע מראש.` });
  stages.push({ icon: '🏁', ok: 'הכוחות סיימו את המשימה וחזרו בשלום.', bad: 'המבצע הופסק לפני שהושלם.' });
  const failAt = o.success ? -1 : Math.min(stages.length - 1, Math.floor(rand(s) * (stages.length - 1)));
  const phases = stages.map((st, i) => ({ icon: st.icon, text: i === failAt || (!o.success && i === stages.length - 1) ? st.bad : st.ok, ok: !(i === failAt || (!o.success && i === stages.length - 1)) }));
  // who was hurt: the leading force carries most of it
  const unitCasualties: { unit: string; fallen: number }[] = [];
  if (o.fallen > 0) {
    const share = plan.engineering ? 0.2 : 0;
    const eng = Math.round(o.fallen * share);
    const cov = cover.length ? Math.round(o.fallen * 0.2) : 0;
    unitCasualties.push({ unit: plan.lead, fallen: o.fallen - eng - cov });
    if (cov) unitCasualties.push({ unit: cover[0], fallen: cov });
    if (eng) unitCasualties.push({ unit: plan.engineering!, fallen: eng });
  }
  const intelFailure = !o.success && (failAt === 0 || t.intel < 65);
  const enemyCivilians = Math.round(ev.enemyCivEst * (o.success ? 0.8 : 1.3) * (intelFailure ? 1.5 : 1));
  const targetHitPct = o.success ? Math.min(100, 70 + Math.round(rand(s) * 30)) : 20 + Math.round(rand(s) * 35);
  const drain = ev.mods.drains?.[plan.lead] ?? 0;
  const longTerm: string[] = [];
  if (enemyCivilians >= 10) longTerm.push('תמונות מהשטח עלו ברשתות; צפוי לחץ בינלאומי ובקשות לחקירה.');
  if (o.success && o.cut >= 10) longTerm.push('צפויה תקופה של רגיעה יחסית בחזית.');
  if (o.fallen >= 3) longTerm.push('משפחות הנופלים ידרשו תחקיר ותשובות.');
  if (intelFailure) longTerm.push('ייפתח תחקיר מודיעיני על הכשל.');
  if (drain >= 20) longTerm.push(`${UNIT_BY_ID[plan.lead].name}: נדרשים כמה חודשי התאוששות.`);
  // what the operation costs in stock, in fresh intelligence and in the enemy's answer
  const stk = stockOf(s);
  stk.precision = clamp(stk.precision - (PRECISION_USE[plan.opId] ?? 0));
  if (FRONT_BY_ID[plan.front].rocketRange && (AIR_OPS.includes(plan.opId) || plan.opId === 'wide_ground')) stk.interceptors = clamp(stk.interceptors - (plan.opId === 'iran_strike' ? 25 : 10));
  setIntelFresh(s, plan.front, intelFreshOf(s, plan.front) + (plan.intel ? 10 : 0) - (intelFailure ? 15 : 0));
  if (enemyCivilians >= 10 || plan.roe === 'maximum') { s.flags[`retal_${plan.front}`] = s.turn + 2; longTerm.push('האויב צפוי להגיב: סיכוי גבוה יותר לירי ולאירועים בחזית בשני התורות הקרובים.'); }
  if (!o.success && roll(s, 0.3)) {
    const air = AIR_OPS.includes(plan.opId);
    const text = air ? 'כלי טיס אבד במהלך המבצע; הצוות חולץ.' : 'לוחם נפל בשבי במהלך המבצע; ממשלת ישמעאל פועלת לשחררו.';
    applyEffects(s, { groups: air ? {} : { families: -4, right: -2 }, stability: air ? -2 : -3, playerPopularity: air ? -1 : -2 });
    addNews(s, text, 'bad', air ? '✈️' : '🪖');
    logEvent(s, air ? '✈️' : '🪖', text, 3, 'bad', 'security');
    longTerm.push(text);
  }
  if (!longTerm.length) longTerm.push('אין השלכות ארוכות טווח מיוחדות.');
  return { turn: s.turn, opIcon: op.icon, title: `${op.name} – ${FRONT_BY_ID[plan.front].name}`, front: plan.front, success: o.success, phases, unitCasualties, targetName: t.name, targetHitPct, enemyCivilians, homeCivilians: o.civilians, threatCut: o.cut, intelFailure, longTerm };
}

// ------------------------------------------------------------ saved plans: prepared now, carried out later
export const MAX_SAVED_PLANS = 8;
export interface SavedPlan { id: string; name: string; turn: number; plan: StrikePlan }

export function listSavedPlans(s: GameState): SavedPlan[] {
  return (world(s).savedPlans ?? []).map((x) => ({ id: x.id, name: x.name, turn: x.turn, plan: planFromParams(x.plan)! })).filter((x) => x.plan && OPERATION_BY_ID[x.plan.opId]);
}

/** Saves the plan without carrying it out. No cost. Returns false when the plan is not valid or the list is full. */
export function savePlan(s: GameState, plan: StrikePlan): boolean {
  const w = world(s);
  w.savedPlans ??= [];
  if (w.savedPlans.length >= MAX_SAVED_PLANS || !evaluatePlan(s, plan).ok) return false;
  const op = OPERATION_BY_ID[plan.opId];
  const t = FRONT_TARGETS[plan.front].find((x) => x.id === plan.target);
  w.savedPlans.push({ id: `plan_${s.turn}_${w.savedPlans.length}_${Math.floor(rand(s) * 1e6)}`, name: `${op.name} – ${FRONT_BY_ID[plan.front].name}${t ? `: ${t.name}` : ''}`, turn: s.turn, plan: planToParams(plan) });
  return true;
}

export function deleteSavedPlan(s: GameState, id: string): boolean {
  const w = world(s);
  const n = w.savedPlans?.length ?? 0;
  w.savedPlans = (w.savedPlans ?? []).filter((x) => x.id !== id);
  return w.savedPlans.length < n;
}

// ------------------------------------------------------------ a minister's proposal comes as a full plan with a report
type ReportRow = { label: string; value: string; tone?: 'good' | 'bad' | 'warn' };

/** How sure the intelligence picture is: the quality of the information on the target and the readiness of the unit that gathers it. */
export const intelConfidence = (s: GameState, plan: StrikePlan, t: TargetDef) => Math.round(0.5 * t.intel + 0.3 * readiness(s, plan.intel ?? 'u8200') + 0.2 * intelFreshOf(s, plan.front));

/** The plan the defense minister would bring: the best-prepared forces and the most valuable target. skill: his expertise bonus on the odds. */
export function proposeStrikePlan(s: GameState, opId: string, front: FrontId, hawkLean: number, skill: number): { plan: StrikePlan; ev: PlanEval } | null {
  if (!OP_PLAN[opId] || !FRONT_TARGETS[front]) return null;
  const targets = targetsFor(front, opId);
  if (!targets.length || !allowedUnits(opId, 'lead').length) return null;
  const roe: RoeId = hawkLean > 0.5 ? 'maximum' : hawkLean < -0.2 ? 'cautious' : 'balanced';
  const plan: StrikePlan = { ...defaultPlan(s, opId, front), target: [...targets].sort((a, b) => b.value - a.value)[0].id, roe };
  const ev = evaluatePlan(s, plan);
  if (!ev.ok) return null;
  const chance = clamp(ev.chance + skill, 0.12, 0.92);
  return { plan, ev: { ...ev, chance, mods: { ...ev.mods, chance } } };
}

/** The report that comes with the proposal, as rows. */
export function proposalReport(s: GameState, plan: StrikePlan, ev: PlanEval): ReportRow[] {
  const t = ev.target!;
  const threat = world(s).fronts[plan.front].threat;
  const members = cabinetPreview(s, plan);
  const yes = members.filter((m) => m.stance === 'support').length;
  const conf = intelConfidence(s, plan, t);
  const cover = [...new Set(plan.cover)].filter((u) => u !== plan.lead).map((u) => UNIT_BY_ID[u].name).join(', ');
  const rows: ReportRow[] = [
    { label: 'יעד', value: t.name },
    { label: 'כוח מוביל', value: UNIT_BY_ID[plan.lead].name },
  ];
  if (cover) rows.push({ label: 'כוחות מחפים', value: cover });
  rows.push(
    { label: 'רמת איום בחזית', value: String(Math.round(threat)), tone: threat >= 65 ? 'bad' : undefined },
    { label: 'סיכוי להצלחה', value: `${Math.round(ev.chance * 100)}%`, tone: ev.chance >= 0.7 ? 'good' : ev.chance < 0.5 ? 'bad' : 'warn' },
    { label: 'ביטחון מודיעיני', value: String(conf), tone: conf >= 70 ? 'good' : conf < 55 ? 'bad' : 'warn' },
    { label: 'נפגעים צפויים בצה״ל', value: `עד ${ev.fallenEst}` },
    { label: 'נפגעים בעורף מירי בתגובה', value: `עד ${ev.homeCivEst}` },
    { label: 'אזרחים בצד השני (הערכה)', value: String(ev.enemyCivEst), tone: ev.enemyCivEst >= 10 ? 'warn' : undefined },
    { label: 'הפחתת איום צפויה', value: String(ev.cutEst) },
    { label: 'מחיר בינלאומי', value: ev.intlEst.toFixed(1) },
    { label: 'עלות', value: `₪${OPERATION_BY_ID[plan.opId].cost}B` },
  );
  if (OPERATION_BY_ID[plan.opId].needsCabinet) rows.push({ label: 'עמדת הקבינט', value: `${yes} מתוך ${members.length} תומכים`, tone: yes > members.length / 2 ? 'good' : 'warn' });
  for (const w of ev.warnings) rows.push({ label: 'אזהרה', value: w, tone: 'warn' });
  return rows;
}

/** The chief of staff's advice on the plan. */
export function chiefAdvice(s: GameState, plan: StrikePlan, ev: PlanEval): string[] {
  if (!ev.ok) return [];
  const out: string[] = [];
  const stk = stockOf(s);
  const useP = PRECISION_USE[plan.opId] ?? 0;
  if (intelFreshOf(s, plan.front) < 50) out.push('המודיעין על החזית ישן. כדאי לרענן אותו לפני המבצע.');
  if (useP > 0 && stk.precision < useP * 1.2) out.push('מלאי התחמושת המדויקת נמוך. כדאי לצמצם את המבצע או לדחות אותו.');
  if (FRONT_BY_ID[plan.front].rocketRange && (AIR_OPS.includes(plan.opId) || plan.opId === 'wide_ground') && stk.interceptors < 30) out.push('מלאי היירוטים נמוך. צפוי נזק רב יותר בעורף.');
  if (ev.chance < 0.5) out.push('סיכוי ההצלחה נמוך. כדאי לחזק את הכוחות או לדחות.');
  if (ev.enemyCivEst >= 12 && plan.roe !== 'cautious') out.push('הפגיעה באזרחים צפויה גבוהה. שעה שקטה יותר או כללי פתיחה באש זהירים יקטינו אותה.');
  if (!out.length) out.push('אין לי הסתייגויות. התוכנית מאוזנת.');
  return out;
}
