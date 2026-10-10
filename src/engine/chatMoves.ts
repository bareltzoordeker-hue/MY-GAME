// ============================================================
// Guided chat moves: instead of typing, the player picks a move (request, press, lobby, promise,
// recommend, threat, ask...), then what it is about (a law, a ministry's budget, a role), and the
// politician answers. When he wants something in return, his price appears as quick replies.
// ============================================================
import { LAWS, LAW_BY_ID } from '../data/laws';
import type { GameState, PendingOffer, Politician } from '../types/game';
import { feminize } from '../shared/gender';
import { clamp, deficitPct } from '../utils';
import { chance } from './rng';
import { remember } from './effects';
import { applyDecision } from './decisions';
import { assignMinister } from './government';
import { proposeBill } from './parliament';
import { syncRole } from './career';
import { canAppoint, chatTone, handleChatText, isPm, lawStance, lawTitle, pushChat, sendChat, sentiment, detectIntent, setTopic, matchMinistry } from './chat';

export type MoveKind = 'request' | 'press' | 'lobby' | 'promise' | 'recommend' | 'threat' | 'ask' | 'apology' | 'thanks';
export type Subject = 'law' | 'vote' | 'budget' | 'role' | 'info' | 'coalition' | 'none';
export interface MoveDef { kind: MoveKind; icon: string; label: string; desc: string; subjects: Subject[] }
export interface Move { kind: MoveKind; subject: Subject; lawId?: string; ministryId?: string; amount?: number; viaId?: string; polId?: string; topic?: string }
export type OfferAnswer = { type: 'accept'; index: number } | { type: 'counter'; lawId: string } | { type: 'refuse' } | { type: 'later' };

export const SUBJECT_LABEL: Record<Subject, string> = { law: 'חוק', vote: 'הצבעה על הצעה בדיון', budget: 'תקציב למשרד', role: 'תפקיד', info: 'מידע', coalition: 'הקואליציה', none: '' };
/** The label of a subject for this move and this politician: "raise the budget" from those who hold the purse, "back the raise" from the rest. */
export function subjectLabel(s: GameState, t: Politician, kind: MoveKind, subject: Subject): string {
  if (kind === 'request' && subject === 'budget') return canFund(s, t) ? 'שיעלה את התקציב של משרד' : 'שיתמוך בהעלאת התקציב של משרד';
  return SUBJECT_LABEL[subject];
}
export const ASK_TOPICS: { id: string; label: string }[] = [
  { id: 'polls', label: 'מה אומרים הסקרים' }, { id: 'economy', label: 'מצב הכלכלה' }, { id: 'security', label: 'המצב הביטחוני' }, { id: 'coalition', label: 'מצב הקואליציה' },
  { id: 'party', label: 'מה קורה בסיעה שלו' }, { id: 'news', label: 'החדשות האחרונות' }, { id: 'ministry', label: 'תקציב של משרד' }, { id: 'politician', label: 'דעתו על פוליטיקאי' }, { id: 'law', label: 'דעתו על חוק' },
];
export const BUDGET_STEPS = [0.5, 1, 2, 3];

const me = (s: GameState) => s.politicians[s.player.politicianId];
const financeMinister = (s: GameState): Politician | undefined => s.politicians[s.government.ministries.find((m) => m.id === 'finance')?.ministerId ?? ''];
const canFund = (s: GameState, t: Politician) => !isPm(s) && (t.id === s.government.pmId || t.id === financeMinister(s)?.id);
const canGiveRole = (s: GameState, t: Politician) => !isPm(s) && t.id === s.government.pmId;
const canLegislate = (s: GameState, t: Politician) => t.id === s.government.pmId || s.government.ministries.some((m) => m.ministerId === t.id) || s.parties[t.partyId]?.leaderId === t.id;
const ministryName = (s: GameState, id?: string) => s.government.ministries.find((m) => m.id === id)?.name ?? 'המשרד';
const category = (s: GameState, id?: string) => s.government.ministries.find((m) => m.id === id)?.categories[0] ?? 'government';
const activeBills = (s: GameState) => s.bills.filter((b) => b.status === 'active');
const favoriteOpen = (s: GameState, t: Politician, except?: string) => (s.parties[t.partyId]?.favoriteLaws ?? []).filter((l) => !s.activeLaws.includes(l) && l !== except && LAW_BY_ID[l]);

/** The moves that make sense with this politician, with the subjects each can be about. */
export function availableMoves(s: GameState, t: Politician): MoveDef[] {
  const out: MoveDef[] = [];
  const bills = activeBills(s).length > 0;
  const request: Subject[] = ['law'];
  if (bills) request.push('vote');
  if (!isPm(s)) request.push('budget'); // from the PM / finance minister: raise it; from anyone else: back the raise
  if (canGiveRole(s, t)) request.push('role');
  out.push({ kind: 'request', icon: '🙏', label: 'בקשה', desc: 'לבקש ממנו תמיכה בחוק, בהצבעה, בתקציב למשרד או בתפקיד', subjects: request });
  const press: Subject[] = [];
  if (canLegislate(s, t)) press.push('law');
  if (canFund(s, t)) press.push('budget');
  if (bills) press.push('vote');
  if (press.length) out.push({ kind: 'press', icon: '📢', label: 'ללחוץ עליו', desc: 'לדרוש ממנו לחוקק חוק, לתקצב משרד או להצביע בעד. לחץ שנכשל פוגע ביחסים', subjects: press });
  out.push({ kind: 'lobby', icon: '🤝', label: 'שידבר עם אחר', desc: 'לבקש שילחץ על ראש הממשלה, שר האוצר או פוליטיקאי אחר בשבילך', subjects: ['budget', 'law', 'role'] });
  const promise: Subject[] = ['law'];
  if (canAppoint(s)) promise.push('role');
  if (isPm(s)) promise.push('budget');
  out.push({ kind: 'promise', icon: '✍️', label: 'הבטחה', desc: 'להבטיח לקדם חוק, למנות לתפקיד או לתקצב. נרשמת עם מועד', subjects: promise });
  out.push({ kind: 'recommend', icon: '⭐', label: canAppoint(s) ? 'הצעת תפקיד' : 'המלצה לתפקיד', desc: canAppoint(s) ? 'להציע לו תפקיד בממשלה' : 'להמליץ עליו לתפקיד, כדי לשפר את היחסים', subjects: ['role'] });
  const threat: Subject[] = ['law'];
  if (bills) threat.push('vote');
  threat.push('budget');
  if (s.government.coalition.includes(s.player.partyId) && s.parties[s.player.partyId]?.leaderId === s.player.politicianId) threat.push('coalition');
  out.push({ kind: 'threat', icon: '⚠️', label: 'איום', desc: 'לאיים להצביע נגד, לפרוש או להפיל. עלול לעבוד, ועלול לחזור אליך', subjects: threat });
  out.push({ kind: 'ask', icon: '❓', label: 'שאלה', desc: 'לשאול על סקרים, כלכלה, ביטחון, קואליציה, משרד או פוליטיקאי', subjects: ['info'] });
  out.push({ kind: 'apology', icon: '🕊️', label: 'התנצלות', desc: 'לתקן יחסים שנפגעו', subjects: ['none'] });
  out.push({ kind: 'thanks', icon: '🙌', label: 'תודה ועידוד', desc: 'לחזק יחסים טובים', subjects: ['none'] });
  return out;
}

/** Laws worth listing first for this politician and move: open bills, his party's favourites, his ministry's laws, then all. */
export function lawChoices(s: GameState, t: Politician, subject: Subject): { group: string; id: string; title: string }[] {
  const out: { group: string; id: string; title: string }[] = [];
  const seen = new Set<string>();
  const add = (group: string, ids: string[]) => { for (const id of ids) if (!seen.has(id) && LAW_BY_ID[id]) { seen.add(id); out.push({ group, id, title: LAW_BY_ID[id].title }); } };
  if (subject === 'vote') { add('הצעות בדיון', activeBills(s).map((b) => b.lawId)); return out; }
  add('הצעות בדיון', activeBills(s).map((b) => b.lawId));
  add(`מועדפים על ${s.parties[t.partyId]?.shortName ?? 'המפלגה שלו'}`, favoriteOpen(s, t));
  const held = s.government.ministries.filter((m) => m.ministerId === t.id).map((m) => m.id);
  if (held.length) add('חוקי המשרד שלו', LAWS.filter((l) => !s.activeLaws.includes(l.id) && l.ministries?.some((m) => held.includes(m))).map((l) => l.id));
  const mine = s.government.ministries.filter((m) => m.ministerId === s.player.politicianId).map((m) => m.id);
  if (mine.length) add('חוקי המשרד שלך', LAWS.filter((l) => !s.activeLaws.includes(l.id) && l.ministries?.some((m) => mine.includes(m))).map((l) => l.id));
  add('כל החוקים', LAWS.filter((l) => !s.activeLaws.includes(l.id)).map((l) => l.id));
  return out;
}

const askText = (s: GameState, m: Move): string => {
  switch (m.topic) {
    case 'polls': return 'מה אומרים הסקרים?';
    case 'economy': return 'מה דעתך על הכלכלה?';
    case 'security': return 'מה דעתך על המצב הביטחוני?';
    case 'coalition': return 'מה המצב בקואליציה?';
    case 'party': return 'מה קורה אצלכם בסיעה?';
    case 'news': return 'ראית את החדשות?';
    case 'ministry': return `מה המצב של תקציב ${ministryName(s, m.ministryId)}?`;
    case 'politician': return `מה דעתך על ${s.politicians[m.polId ?? '']?.name ?? 'הפוליטיקאי'}?`;
    case 'law': return `מה דעתך על ${lawTitle(m.lawId)}?`;
    default: return 'מה נשמע?';
  }
};

/** What the player "says" for a move. */
export function moveText(s: GameState, t: Politician, m: Move): string {
  const law = lawTitle(m.lawId);
  const min = ministryName(s, m.ministryId);
  const amount = m.amount ?? 1;
  const via = s.politicians[m.viaId ?? ''];
  const lobbyAbout = m.subject === 'budget' ? `תוספת תקציב ל${min}` : m.subject === 'law' ? `קידום ${law}` : `תפקיד בשבילי`;
  switch (m.kind) {
    case 'request':
      return m.subject === 'vote' ? `אשמח לתמיכה שלך בהצבעה על "${law}".` : m.subject === 'budget' ? (canFund(s, t) ? `תוכל להעלות את התקציב של ${min} ב-₪${amount} מיליארד?` : `אשמח לתמיכתך בהעלאת התקציב של ${min} ב-₪${amount} מיליארד.`) : m.subject === 'role' ? `אשמח שתשקול אותי לתפקיד ${min}.` : `אני מבקש שתתמוך ב${law}.`;
    case 'press':
      return m.subject === 'budget' ? `אני דורש תוספת של ₪${amount} מיליארד ל${min}. זה לא יכול לחכות.` : m.subject === 'vote' ? `אני מצפה שתצביע בעד "${law}".` : `אני לוחץ עליך לחוקק את ${law}. הגיע הזמן.`;
    case 'lobby':
      return `תוכל לדבר עם ${via?.name ?? 'ראש הממשלה'} על ${lobbyAbout}?`;
    case 'promise':
      return m.subject === 'role' ? `אני מבטיח לך את ${min}.` : m.subject === 'budget' ? `אני מבטיח תוספת תקציב ל${min}.` : `אני מבטיח לקדם את ${law}.`;
    case 'recommend':
      return canAppoint(s) ? `אני מציע לך את ${min}.` : `אני ממליץ עליך לתפקיד ${min}.`;
    case 'threat':
      return m.subject === 'vote' ? `אם לא תצביע בעד "${law}", אפרוש מהתמיכה בך.` : m.subject === 'budget' ? `אם התקציב של ${min} לא יאושר, אצביע נגד התקציב כולו.` : m.subject === 'coalition' ? `אם זה לא ישתנה, ${s.parties[s.player.partyId]?.shortName ?? 'המפלגה'} תפרוש מהקואליציה.` : `אם לא תתמוך ב${law}, אצביע נגדך.`;
    case 'ask': return askText(s, m);
    case 'apology': return 'אני מתנצל על מה שקרה בינינו.';
    case 'thanks': return 'תודה על התמיכה. אני מעריך את זה.';
  }
}

interface Out { text: string; hint?: string; offer?: PendingOffer }
/** Records what the player owes. `phrase` is what he says back ("you commit to ..."), `note` is the hint under the message. */
const recordObligation = (s: GameState, t: Politician, kind: 'law' | 'vote' | 'role', lawId?: string): { phrase: string; note: string } => {
  if (kind === 'law' && lawId) { remember(s, t.id, 'promise', `לקדם את ${lawTitle(lawId)}`, 8, s.turn + 12, lawId); return { phrase: `לקדם את ${lawTitle(lawId)}`, note: `הבטחת לקדם את ${lawTitle(lawId)} (נרשמה עם מועד)` }; }
  if (kind === 'vote') { remember(s, t.id, 'favor', 'הבטחת הצבעה לצידו', 6); return { phrase: 'להצביע איתי בהצבעות הקרובות', note: 'הבטחת להצביע לצידו' }; }
  remember(s, t.id, 'promise', 'תפקיד או תיק', 8, s.turn + 6, 'role');
  return { phrase: 'להבטיח לי תפקיד בממשלה', note: 'הבטחת לו תפקיד (נרשם עם מועד)' };
};
const priceOptions = (s: GameState, t: Politician, except?: string): PendingOffer['options'] => {
  const o: PendingOffer['options'] = favoriteOpen(s, t, except).slice(0, 3).map((id) => ({ kind: 'law' as const, lawId: id, label: `לקדם את ${lawTitle(id)}` }));
  o.push({ kind: 'vote', label: 'להצביע איתו בהצבעות הקרובות' });
  if (canAppoint(s)) o.push({ kind: 'role', label: 'להבטיח לו תפקיד בממשלה' });
  return o.slice(0, 4);
};

const bonusFromLobby = (s: GameState, t: Politician): number => ((s.flags[`lobby_${t.id}`] ?? -99) >= s.turn - 8 ? 0.15 : 0);

function askLaw(s: GameState, t: Politician, lawId: string, pressure: boolean): Out {
  const st = lawStance(s, t, lawId);
  const tn = chatTone(t);
  const bill = s.bills.find((b) => b.lawId === lawId && b.status === 'active');
  const title = lawTitle(lawId);
  if (st === 'redline') return { text: `${title} זה קו אדום עבורי ועבור ${s.parties[t.partyId]?.shortName}. לא נתמוך בשום מצב.`, hint: 'אי אפשר לשכנע אותו בזה, גם לא בתמורה.' };
  if (st === 'against' && tn !== 'friendly') return { text: `אני מתנגד ל${title}. אין לי עניין לתמוך.`, hint: 'הוא מתנגד לתוכן החוק.' };
  const ok = st === 'for' || tn === 'friendly' || (tn === 'neutral' && chance(s, pressure ? 0.35 : 0.45));
  if (ok) {
    if (bill) bill.push = Math.min(80, bill.push + (pressure ? 14 : 10));
    remember(s, t.id, 'support', `נענה לבקשה בנושא ${title}`, 3);
    s.flags[`lobby_${t.id}`] = s.turn;
    return { text: `בסדר, אתמוך ב${title}${pressure ? ', אבל לא אהבתי את הלחץ' : ''}.`, hint: bill ? 'התמיכה בהצעה גדלה.' : 'אין כרגע הצעה פעילה. הבקשה נרשמה.' };
  }
  if (pressure) remember(s, t.id, 'ignored', 'לחץ עליי', -2);
  return { text: `אני לא יכול להתחייב על ${title} כך סתם. אצטרך משהו בתמורה: מה שחשוב ל${s.parties[t.partyId]?.shortName ?? 'סיעה'}.`, hint: 'בחר מה לתת בתמורה.', offer: { action: 'law_support', lawId, options: priceOptions(s, t, lawId) } };
}

function fundMinistry(s: GameState, t: Politician, ministryId: string, amount: number, pressure: boolean): Out {
  const min = ministryName(s, ministryId);
  const cat = category(s, ministryId);
  const pol = me(s);
  const funding = s.budget.allocations[cat] / Math.max(0.1, s.budget.needs[cat]);
  const p = clamp(0.3 + (t.loyalty - 50) / 100 + (pol.power - 50) / 250 + clamp((funding - 0.85) * 1.2, -0.3, 0.4) - (funding >= 1 ? 0 : Math.max(0, deficitPct(s) - 3) * 0.1) - amount * 0.04 + bonusFromLobby(s, t) + Math.min(0.25, 0.07 * (s.flags[`backers_${ministryId}`] ?? 0)) - (pressure ? 0.08 : 0), 0.04, 0.9);
  if (chance(s, p)) {
    applyDecision(s, { budget: { [cat]: amount } });
    remember(s, t.id, 'favor', `אישר תוספת ל${min}`, 4);
    const backers = s.flags[`backers_${ministryId}`] ?? 0;
    s.flags[`backers_${ministryId}`] = 0;
    return { text: `בסדר. ₪${amount} מיליארד נוספים ל${min}. אל תבקש שוב מהר.`, hint: backers ? `התקציב עודכן, גם בזכות ${backers} תומכים שגייסת.` : 'התקציב עודכן.' };
  }
  if (p < 0.15) {
    if (pressure) remember(s, t.id, 'ignored', 'לחץ עליי על תקציב', -2);
    return { text: `אין לי מאיפה להוסיף ל${min} עכשיו. הגירעון והלחצים מכל כיוון.`, hint: 'הסיכוי עולה כשהמשרד ממומן פחות, כשהיחסים טובים, וכשמישהו שוכנע לדבר עליך קודם.' };
  }
  return { text: `אני יכול לשקול תוספת ל${min}, אבל לא בחינם. מה אתה נותן לי?`, hint: 'בחר מה לתת בתמורה.', offer: { action: 'fund', ministryId, amount, options: priceOptions(s, t) } };
}

/** A politician who cannot fund a ministry can still back the raise: it makes the PM / finance minister more willing later. */
function backBudget(s: GameState, t: Politician, ministryId: string, amount: number): Out {
  const min = ministryName(s, ministryId);
  const inGov = s.government.coalition.includes(t.partyId);
  const p = clamp(0.35 + (t.loyalty - 50) / 100 + (inGov ? 0.1 : -0.05) + (t.ministryId === ministryId ? 0.3 : 0), 0.05, 0.92);
  if (chance(s, p)) return backed(s, t, ministryId, `בסדר, אתמוך בהעלאת התקציב של ${min}. כשזה יגיע לשולחן, אדבר בעד.`);
  if (p < 0.15) return { text: `אני לא יכול לתמוך בהעלאה ל${min} עכשיו: יש לנו סדרי עדיפויות אחרים.`, hint: 'היחסים והעמדה של המפלגה שלו קובעים.' };
  return { text: `אתמוך בהעלאה ל${min}, אבל אני צריך משהו בתמורה. מה אתה נותן לי?`, hint: 'בחר מה לתת בתמורה.', offer: { action: 'back_budget', ministryId, amount, options: priceOptions(s, t) } };
}
function backed(s: GameState, t: Politician, ministryId: string, text: string): Out {
  remember(s, t.id, 'support', `תמך בהעלאת התקציב ל${ministryName(s, ministryId)}`, 3);
  s.flags[`backers_${ministryId}`] = (s.flags[`backers_${ministryId}`] ?? 0) + 1;
  return { text, hint: `נרשמה תמיכה. כל תומך מעלה את הסיכוי שראש הממשלה ושר האוצר יאשרו תוספת ל${ministryName(s, ministryId)}.` };
}

function askRole(s: GameState, t: Politician, ministryId: string): Out {
  const m = s.government.ministries.find((x) => x.id === ministryId);
  const pol = me(s);
  if (!m) return { text: 'על איזה תפקיד מדובר?' };
  if (m.ministerId && m.ministerId !== t.id && s.politicians[m.ministerId]?.active && m.ministerId !== pol.id) return { text: `${m.name} תפוס ב${s.politicians[m.ministerId].name}, ואני לא מתכנן להחליף אותו.`, hint: 'בקש תיק שמוחזק על ידי ראש הממשלה, או שיחליף שר בהסכמה.' };
  const p = clamp(0.2 + (t.loyalty - 50) / 100 + (pol.power - 40) / 150, 0.05, 0.8);
  if (chance(s, p)) {
    assignMinister(s, m.id, pol.id);
    syncRole(s);
    remember(s, t.id, 'appointed', `מינה אותי ל${m.name}`, 6);
    return { text: `בסדר, אני ממנה אותך ל${m.name}.`, hint: 'מונית לתפקיד.' };
  }
  return { text: `אני לא מוכן למנות אותך ל${m.name} עכשיו. תוכיח את עצמך בתפקיד הנוכחי, ונדבר.`, hint: 'הכוח הפוליטי והיחסים משפיעים על ההחלטה.' };
}

function lobbyVia(s: GameState, t: Politician, m: Move): Out {
  const target = s.politicians[m.viaId ?? ''] ?? s.politicians[s.government.pmId];
  const tn = chatTone(t);
  if (!target || target.id === t.id) return { text: 'אני לא צריך לדבר עם עצמי. תבחר מישהו אחר.' };
  const subject = m.subject === 'budget' ? `תוספת תקציב ל${ministryName(s, m.ministryId)}` : m.subject === 'law' ? `קידום ${lawTitle(m.lawId)}` : 'תפקיד בשבילך';
  if (tn === 'hostile') return { text: `שאדבר עם ${target.name} בשבילך? אחרי מה שהיה בינינו, לא.`, hint: 'הוא לא ישתדל בשבילך כל עוד היחסים גרועים.' };
  const rel = t.relationships[target.id] ?? 0;
  if (rel < -30) return { text: `${target.name} לא מקשיב לי בימים אלה. אם אדבר איתו, זה רק יזיק לך. נסה דרך מישהו אחר.` };
  const weight = tn === 'friendly' ? 4 : 2;
  remember(s, target.id, 'support', `${t.name} דיבר איתי בעד ${subject}`, weight);
  s.flags[`lobby_${target.id}`] = s.turn;
  return { text: `בסדר, אדבר עם ${target.name} על ${subject}. אני לא מבטיח תוצאה, אבל המילה שלי שווה שם משהו.`, hint: `${target.name} שמע ממנו מילה טובה (+${weight}). בשמונה התורות הקרובים זה מעלה את הסיכוי לאישור.` };
}

function promiseMove(s: GameState, t: Politician, m: Move): Out {
  if (m.subject === 'role') { remember(s, t.id, 'promise', `למנות ל${ministryName(s, m.ministryId)}`, 10, s.turn + 6, 'role'); return { text: `תודה. אני מצפה לתפקיד ${ministryName(s, m.ministryId)} כפי שהובטח, ואזכור.`, hint: 'נרשמה הבטחה לתפקיד עם מועד (שנה).' }; }
  if (m.subject === 'budget') { const cat = category(s, m.ministryId); remember(s, t.id, 'promise', `תוספת תקציב ל${ministryName(s, m.ministryId)}`, 8, s.turn + 12, `budget:${cat}`); return { text: `אחכה לראות את זה בתקציב של ${ministryName(s, m.ministryId)}.`, hint: 'נרשמה הבטחה עם מועד. היא מתקיימת כשהמשרד ממומן במלואו.' }; }
  remember(s, t.id, 'promise', `לקדם את ${lawTitle(m.lawId)}`, 8, s.turn + 12, m.lawId);
  return { text: `תודה. אני מעריך את זה, ואזכור. רשמתי: ${lawTitle(m.lawId)}.`, hint: 'נרשמה הבטחה עם מועד (שנתיים). תקבל תזכורת לפני שיגיע.' };
}

function recommendMove(s: GameState, t: Politician, m: Move): Out {
  if (canAppoint(s)) return promiseMove(s, t, { ...m, kind: 'promise', subject: 'role' });
  remember(s, t.id, 'favor', 'המליץ עליי לתפקיד', 6);
  s.flags[`rec_${t.id}`] = s.turn;
  return { text: `תודה על ההמלצה. אני מעריך שחשבת עליי ל${ministryName(s, m.ministryId)}.`, hint: 'ההמלצה נרשמה: היחסים השתפרו, ולראש הממשלה יש עוד סיבה לשקול אותו.' };
}

/** Plays the move: the player's message, the politician's answer and, if he names a price, the pending offer. */
export function playMove(s: GameState, targetId: string, m: Move): boolean {
  const t = s.politicians[targetId];
  if (!t || t.isPlayer) return false;
  const text = moveText(s, t, m);
  pushChat(s, targetId, { from: 'me', text: me(s).gender === 'f' ? feminize(text) : text });
  let out: Out;
  switch (m.kind) {
    case 'request':
      out = m.subject === 'budget' ? (canFund(s, t) ? fundMinistry(s, t, m.ministryId ?? '', m.amount ?? 1, false) : backBudget(s, t, m.ministryId ?? '', m.amount ?? 1)) : m.subject === 'role' ? askRole(s, t, m.ministryId ?? '') : askLaw(s, t, m.lawId ?? '', false);
      break;
    case 'press':
      out = m.subject === 'budget' ? fundMinistry(s, t, m.ministryId ?? '', m.amount ?? 1, true) : askLaw(s, t, m.lawId ?? '', true);
      if (m.subject === 'law' && !out.offer && out.hint === 'אין כרגע הצעה פעילה. הבקשה נרשמה.' && canLegislate(s, t) && !s.activeLaws.includes(m.lawId ?? '') && !activeBills(s).some((b) => b.lawId === m.lawId) && !(s.government.caretaker && s.elections.phase === 'none')) {
        const b = proposeBill(s, m.lawId!, t.id, t.id === s.government.pmId);
        if (b) out = { text: `${out.text} אני מגיש את ההצעה בעצמי.`, hint: 'הוא הגיש את ההצעה.' };
      }
      break;
    case 'lobby': out = lobbyVia(s, t, m); break;
    case 'promise': out = promiseMove(s, t, m); break;
    case 'recommend': out = recommendMove(s, t, m); break;
    default: {
      // threat, ask, apology, thanks: the text goes through the conversation engine, which already knows them
      const r = handleChatText(s, t, text);
      out = { text: r.text, hint: r.hint };
    }
  }
  s.chatTopics ??= {};
  if (out.offer) setTopic(s, targetId, { kind: 'offer', stage: 'explained', turn: s.turn, lawId: out.offer.lawId, offer: out.offer });
  else if (s.chatTopics[targetId]?.kind === 'offer') setTopic(s, targetId, null);
  pushChat(s, targetId, { from: 'them', text: out.text, hint: out.hint });
  return true;
}

const pendingOffer = (s: GameState, id: string): PendingOffer | undefined => (s.chatTopics?.[id]?.kind === 'offer' ? s.chatTopics[id].offer : undefined);
export { pendingOffer };

function grant(s: GameState, t: Politician, o: PendingOffer): string {
  if (o.action === 'back_budget') { backed(s, t, o.ministryId ?? '', ''); return `תמיכה בהעלאת התקציב של ${ministryName(s, o.ministryId)}`; }
  if (o.action === 'fund') {
    const cat = category(s, o.ministryId);
    applyDecision(s, { budget: { [cat]: o.amount ?? 1 } });
    remember(s, t.id, 'favor', `אישר תוספת ל${ministryName(s, o.ministryId)}`, 4);
    return `₪${o.amount ?? 1} מיליארד נוספים ל${ministryName(s, o.ministryId)}`;
  }
  const bill = s.bills.find((b) => b.lawId === o.lawId && b.status === 'active');
  if (bill) bill.push = Math.min(80, bill.push + 12);
  remember(s, t.id, 'support', `סיכם לתמוך ב${lawTitle(o.lawId)}`, 3);
  return `תמיכה ב${lawTitle(o.lawId)}`;
}

/** The player answers the price: accept an option, offer another law, refuse, or ask for time. */
export function answerOffer(s: GameState, targetId: string, a: OfferAnswer): boolean {
  const t = s.politicians[targetId];
  const o = pendingOffer(s, targetId);
  if (!t || !o) return false;
  if (a.type === 'refuse') {
    pushChat(s, targetId, { from: 'me', text: me(s).gender === 'f' ? 'אני לא מוכנה לשלם את המחיר הזה.' : 'אני לא מוכן לשלם את המחיר הזה.' });
    remember(s, t.id, 'ignored', 'סירב להצעה שלי', -1);
    setTopic(s, targetId, null);
    pushChat(s, targetId, { from: 'them', text: 'חבל. אם תשנה את דעתך, אני כאן.' });
    return true;
  }
  if (a.type === 'later') {
    pushChat(s, targetId, { from: 'me', text: 'תן לי לחשוב על זה.' });
    s.chatTopics![targetId].turn = s.turn;
    pushChat(s, targetId, { from: 'them', text: 'בסדר, אחכה. אבל לא לנצח.' });
    return true;
  }
  let opt = a.type === 'accept' ? o.options[a.index] : { kind: 'law' as const, lawId: a.lawId, label: `לקדם את ${lawTitle(a.lawId)}` };
  if (!opt) return false;
  pushChat(s, targetId, { from: 'me', text: a.type === 'accept' ? `מסכים: ${opt.label}.` : `מה דעתך על ${opt.label} במקום?` });
  if (a.type === 'counter') {
    const st = lawStance(s, t, a.lawId);
    if (st === 'against' || st === 'redline') { pushChat(s, targetId, { from: 'them', text: `${lawTitle(a.lawId)}? זה בכלל לא מה שחשוב לנו. תציע משהו אחר.`, hint: 'הוא עדיין מחכה להצעה.' }); return true; }
    if (st !== 'for') { pushChat(s, targetId, { from: 'them', text: `${lawTitle(a.lawId)} לא מספיק עבורי. תציע משהו שחשוב באמת ל${s.parties[t.partyId]?.shortName ?? 'סיעה'}.`, hint: 'הצעות שהסיעה אוהבת מתקבלות; אחרות לא.' }); return true; }
  }
  const what = grant(s, t, o);
  const mine = recordObligation(s, t, opt.kind, opt.lawId);
  setTopic(s, targetId, null);
  pushChat(s, targetId, { from: 'them', text: `סגור. ${what} מצידי, ואתה מתחייב ${mine.phrase} מצידך. אני אזכור את החלק שלך.`, hint: `העסקה נרשמה: ${mine.note}.` });
  return true;
}

/** Typing while an offer is open: "כן" accepts the first price, "לא" refuses, "אחר כך" asks for time. */
export function sendChatSmart(s: GameState, targetId: string, text: string): boolean {
  const o = pendingOffer(s, targetId);
  if (o) {
    const intent = detectIntent(text);
    const sent = sentiment(text);
    const yes = intent === 'agree' || sent === 'yes';
    const no = intent === 'decline' || sent === 'no';
    if (yes || no || intent === 'later') {
      return answerOffer(s, targetId, yes ? { type: 'accept', index: 0 } : no ? { type: 'refuse' } : { type: 'later' });
    }
  }
  return sendChat(s, targetId, text);
}

export { matchMinistry };
