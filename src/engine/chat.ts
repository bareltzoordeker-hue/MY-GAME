// ============================================================
// Chat with ministers and party leaders (and anyone found by name).
// The player writes freely; a local language engine (no server, no API key)
// reads the intent – threat, promise, request, apology, thanks, insult,
// question – and the politician answers according to their loyalty,
// personality, party values and memory. The state changes for real:
// relations, promises with deadlines, pushes on bills, retaliation.
// Politicians also write to the player on their own.
// ============================================================
import { LAWS } from '../data/laws';
import type { ChatMsg, ChatTopic, GameState, Politician } from '../types/game';
import { clamp } from '../utils';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { chance, pick, rand } from './rng';
import { shiftPartyRelation } from './relations';

export type Intent = 'threat' | 'promise' | 'request' | 'apology' | 'thanks' | 'insult' | 'question' | 'meet' | 'agree' | 'decline' | 'askwhat' | 'greet' | 'later' | 'conditional' | 'maybe' | 'other';

const MAX_CHAT = 60;

const PATTERNS: { intent: Intent; re: RegExp }[] = [
  { intent: 'threat', re: /אפיל|אפרסם|אחשוף|אפטר|אפרוש|אעזוב|אשבית|אצביע נגד|אפרק|אנקום|תתחרט|אאיים|איום|אדאג שתיפול|אודיע על|ננתק|אפסיק לתמוך|אסיר/ },
  { intent: 'conditional', re: /בתנאי|רק אם|בתמורה|מה אני מקבל|מה תיתן|מה אתה נותן|מה את נותנת|מה יוצא לי|תמורה|אם תתמוך|אם תצביע|אם תעזור|קודם אתה|קודם את/ },
  { intent: 'promise', re: /מבטיח|אבטיח|מתחייב|אדאג|אקדם|אעביר|אתן לך|אמנה|אעלה|אקצה|נותן לך|תקבל|הבטחה/ },
  { intent: 'request', re: /תתמוך|תצביע|אבקש|בקשה|מבקש|צריך אותך|צריכה אותך|עזור|סייע|תסכים|תצטרף|תסיר|תפסיק|תקדם|אשמח ש/ },
  { intent: 'apology', re: /סליחה|מתנצל|טעיתי|מצטער|אני מצטערת|מתנצלת/ },
  { intent: 'insult', re: /טיפש|שקרן|בוגד|פתטי|מביש|כישלון|תתבייש|מטומטם|אידיוט|חסר ערך|נוכל/ },
  { intent: 'askwhat', re: /מה רצית|מה אתה רוצה|מה את רוצה|מה רצתה|במה מדובר|על מה (רצית|את רוצה|אתה רוצה|מדובר)|מה הנושא|מה הבעיה|מה קרה|מה אתה מציע|מה את מציעה|מה אתה מבקש|מה את מבקשת|ספר לי|תספר|תפרט|תסביר|מה בדיוק|מה הבקשה|מה אפשר לעשות/ },
  { intent: 'meet', re: /בוא נדבר|בואי נדבר|נדבר|נתקשר|בוא נפגש|בואי נפגש|נפגש|נקבע|שנדבר|אשמח לדבר|אשמח להיפגש|אפשר לדבר|נשוחח|בוא נשב|נשב/ },
  { intent: 'later', re: /אחר כך|בתור הבא|תן לי (קצת |עוד |כמה )?(זמן|ימים|שבוע|שבועיים|חודש)|תני לי (קצת |עוד |כמה )?(זמן|ימים|שבוע)|אבדוק|אחשוב על זה|לא עכשיו|בהמשך|בשבוע הבא|אחזור אליך|אחזור אלייך|נחזור לזה|עוד לא|בינתיים לא|צריך זמן|צריכה זמן|אחרי הבחירות|בהזדמנות|לא היום|סבלנות|מאוחר יותר/ },
  { intent: 'maybe', re: /^(אולי|נשקול|אשקול|לא בטוח|לא בטוחה|נראה|תלוי|ייתכן|יכול להיות|אפשרי|קשה לי להגיד|לא יודע|לא יודעת)/ },
  { intent: 'decline', re: /^(לא|אין לי|לא מעוניין|לא מעוניינת|לא יכול|לא יכולה|אסרב|בלי|אין סיכוי|לא אעשה)/ },
  { intent: 'agree', re: /^(כן|בסדר|אוקיי|אוקי|מסכים|מסכימה|מקובל|סגור|אין בעיה|בטח|ברור|אעשה|אשמח|טוב|נהדר|מצוין|יופי|על כך|אני איתך)/ },
  { intent: 'greet', re: /^(שלום|היי|הי|בוקר טוב|ערב טוב|צהריים טובים|מה נשמע|מה שלומך|מה שלומך|אהלן|הלו)/ },
  { intent: 'thanks', re: /תודה|מעריך|גאה|כל הכבוד|עבודה מצוינת|אני איתך|נעבוד יחד|שיתוף פעולה|פגישה|קפה|שמח לעבוד|מקווה לעבוד|תמיכה/ },
  { intent: 'question', re: /\?|מה דעתך|מה אתה חושב|מה את חושבת|איך |למה |מתי |האם / },
];

export function detectIntent(text: string): Intent {
  const t = text.trim();
  for (const p of PATTERNS) if (p.re.test(t)) return p.intent;
  return 'other';
}

/** A free-text answer that isn't a plain yes/no: read its direction from the words. */
export function sentiment(text: string): 'yes' | 'no' | null {
  const neg = /לא אוכל|אי אפשר|קשה לי|לא רלוונטי|לא בא בחשבון|לא מתאים|אין מצב|שכח מזה|שכחי מזה|לא יקרה|לא אתמוך|לא אצביע|לא אעזור|לא מסכים|לא מסכימה|מתנגד|מתנגדת|לא מקובל|אין לי כוונה|תשכח|לא נראה לי|לא רוצה/;
  const pos = /בשמחה|אין בעיה|אני בעד|אדאג|אטפל|בוודאי|אתמוך|נעשה|אני איתך|סמוך עליי|סמכי עליי|אשתדל|אנסה|אפעל|אעזור|אסדר|נסדר|אעשה|אקדם|מקובל עליי|אני בעניין|נסגור|סגור|אתן|אביא|אעביר|נתמוך|תומך|תומכת|אצביע בעד|קיבלת|יש לך את זה|על זה אני/;
  if (neg.test(text)) return 'no';
  if (pos.test(text)) return 'yes';
  return null;
}

const STOP = new Set(['חוק', 'חוקי', 'הסדרת', 'הצעת', 'תיקון', 'לחוק', 'בנושא', 'המשרד', 'משרד', 'השר', 'שר']);
const tokens = (s: string) => s.replace(/[׳'"״,.:;()\-–?!]/g, ' ').split(/\s+/).map((w) => w.replace(/^[והבלכמש]{1,2}(?=.{4})/, '')).filter((w) => w.length >= 4 && !STOP.has(w));

/** The law the text refers to (by a distinctive word in its title), if any. */
export function matchLaw(text: string): (typeof LAWS)[number] | null {
  const t = text.replace(/[׳'"״]/g, '');
  let best: { law: (typeof LAWS)[number]; score: number } | null = null;
  for (const law of LAWS) {
    let score = 0;
    for (const w of tokens(law.title)) if (t.includes(w)) score += 1;
    const alias: Record<string, string[]> = { draft_equality: ['גיוס', 'שוויון בנטל'], draft_exemption: ['פטור', 'גיוס חרדים'], judicial_selection: ['שופטים', 'רפורמה משפטית'], override_clause: ['התגברות'], oct7_state_commission: ['ועדת חקירה', 'חקירה ממלכתית'], minimum_wage: ['שכר מינימום'], rent_control: ['שכר דירה', 'פיקוח'], civil_marriage: ['נישואים אזרחיים'] };
    for (const a of alias[law.id] ?? []) if (t.includes(a)) score += 2;
    if (score > 0 && (!best || score > best.score)) best = { law, score };
  }
  return best?.law ?? null;
}

const mentionsRole = (t: string) => /תיק|שר\b|שרות|סגן שר|מינוי|ועדה|ראשות/.test(t);
const mentionsMoney = (t: string) => /תקציב|כסף|מיליון|מיליארד|תוספת|מימון|הקצבה/.test(t);

const tone = (p: Politician): 'friendly' | 'neutral' | 'hostile' => (p.loyalty >= 60 ? 'friendly' : p.loyalty <= 30 ? 'hostile' : 'neutral');
const once = (s: GameState, id: string, intent: string) => {
  const k = `chat_${id}_${intent}`;
  if ((s.flags[k] ?? -1) === s.turn) return false;
  s.flags[k] = s.turn;
  return true;
};

function push(s: GameState, id: string, m: Omit<ChatMsg, 'turn'>) {
  s.chats ??= {};
  const list = (s.chats[id] ??= []);
  list.push({ ...m, turn: s.turn });
  if (list.length > MAX_CHAT) list.shift();
  if (m.from === 'them') { s.chatUnread ??= {}; s.chatUnread[id] = (s.chatUnread[id] ?? 0) + 1; }
}

export function markRead(s: GameState, id: string): void {
  if (s.chatUnread?.[id]) delete s.chatUnread[id];
}
export const unreadTotal = (s: GameState) => Object.values(s.chatUnread ?? {}).reduce((a, b) => a + b, 0);

/** People the player can write to by default: ministers and party leaders. */
export function chatContacts(s: GameState): Politician[] {
  const ids = new Set<string>();
  for (const m of s.government.ministries) if (m.ministerId) ids.add(m.ministerId);
  for (const p of Object.values(s.parties)) if (p.seats > 0 || p.pollShare >= 2) ids.add(p.leaderId);
  ids.add(s.government.pmId);
  for (const id of Object.keys(s.chats ?? {})) ids.add(id);
  return [...ids].map((id) => s.politicians[id]).filter((p) => p && p.active && !p.isPlayer);
}

/** Search every active politician by (part of) the name. */
export function searchPoliticians(s: GameState, q: string): Politician[] {
  const n = q.trim();
  if (!n) return [];
  return Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && p.name.includes(n)).sort((a, b) => b.popularity - a.popularity).slice(0, 12);
}

// ---------------- the replies ----------------
const R = {
  thanks: { friendly: ['תודה. אני מעריך את הדברים, ואשמח להמשיך לעבוד יחד.', 'שמח לשמוע. נמשיך כך.'], neutral: ['תודה. נראה איך זה מתקדם.', 'מקובל. אשמח לשיתוף פעולה ענייני.'], hostile: ['המילים נעימות. המעשים חשובים יותר.', 'נשמע טוב, אבל לא שכחתי מה שקרה.'] },
  apology: { friendly: ['אין צורך להתנצל. הלאה.', 'תודה על הדברים. זה מאחורינו.'], neutral: ['אני מקבל את ההתנצלות. נראה אותה גם במעשים.', 'מעריך את הכנות.'], hostile: ['ההתנצלות התקבלה, אבל אמון לא חוזר בשיחה אחת.', 'נראה. לא שכחתי.'] },
  insult: { friendly: ['זה לא ראוי, ואני מופתע ממך.', 'אני מקווה שזו הייתה פליטת פה.'], neutral: ['אני לא מוכן לשיחה בטון הזה.', 'זה לא עניני. נדבר כשתהיה שיחה ראויה.'], hostile: ['שיחה כזו לא תמשיך. אזכור את זה.', 'תקבל את התשובה שלי בהצבעה.'] },
  other: { friendly: ['קיבלתי. תרצה לפרט?', 'שמעתי. נשמח להמשיך את השיחה.'], neutral: ['קיבלתי. אפשר לפרט למה אתה מתכוון?', 'אני מקשיב.'], hostile: ['אני לא בטוח מה אתה מבקש ממני.', 'תגיע לעניין.'] },
  promiseGeneric: { friendly: ['אני סומך עליך. נראה את זה בפועל.', 'תודה. מקווה שנוכל לקדם את זה יחד.'], neutral: ['אשמח. אבדוק את זה כשזה יגיע לשולחן.', 'הבטחות בפוליטיקה נמדדות בביצוע.'], hostile: ['שמעתי הבטחות בעבר. נראה.', 'אני אחכה לראות.'] },
};
const line = (s: GameState, group: keyof typeof R, t: ReturnType<typeof tone>) => pick(s, R[group][t]);

function lawStance(s: GameState, p: Politician, lawId: string): 'for' | 'against' | 'redline' | 'neutral' {
  const party = s.parties[p.partyId];
  if (!party) return 'neutral';
  if (party.redLines?.includes(lawId)) return 'redline';
  if (party.favoriteLaws.includes(lawId)) return 'for';
  if (party.hatedLaws.includes(lawId)) return 'against';
  return 'neutral';
}

interface Reply { text: string; hint?: string }

// ---------------- conversations with a thread ----------------
/** Only the prime minister hands out budgets, so only they get budget demands. */
const isPm = (s: GameState) => s.government.pmId === s.player.politicianId;
/** Only the prime minister or a party leader hands out jobs, so only they get job requests. */
/** A minister only complains about money when his ministry really gets less than its need. */
const underfunded = (s: GameState, p: Politician): boolean => {
  const m = s.government.ministries.find((x) => x.ministerId === p.id || x.id === p.ministryId);
  const cat = m?.categories[0];
  return !!cat && s.budget.allocations[cat] / Math.max(0.1, s.budget.needs[cat]) < 0.97;
};
const canAppoint = (s: GameState) => isPm(s) || s.parties[s.player.partyId]?.leaderId === s.player.politicianId;
const lawTitle = (id?: string) => LAWS.find((l) => l.id === id)?.title ?? 'החוק';
const TALK_INTENTS: Intent[] = ['meet', 'agree', 'askwhat', 'greet', 'question', 'thanks'];

/** What a politician who is unhappy actually complains about – from their memory, their ministry and their party. */
function grievance(s: GameState, t: Politician): { demand: NonNullable<ChatTopic['demand']>; text: string; lawId?: string } {
  const open = t.memory.find((m) => m.kind === 'promise' && !m.resolved);
  if (open?.ref === 'role') return { demand: 'role', text: 'הובטח לי תפקיד, והוא עדיין לא ניתן. אני מצפה שהעניין יטופל.' };
  if (open?.ref) return { demand: 'law', lawId: open.ref, text: `הובטח לי שתקדם את ${lawTitle(open.ref)}. עברו חודשים ושום דבר לא זז.` };
  if (t.ministryId && isPm(s) && underfunded(s, t)) return { demand: 'budget', text: 'המשרד שלי לא עומד במשימות בתקציב הנוכחי. אני מצפה לתוספת תקציב לתחום.' };
  const fav = s.parties[t.partyId]?.favoriteLaws[0];
  if (fav) return { demand: 'law', lawId: fav, text: `${lawTitle(fav)} חשוב לנו, ואני לא רואה שאתה מקדם אותו.` };
  return { demand: 'respect', text: 'אני מרגיש שאני לא שותף להחלטות. אני מצפה ליחס אחר: להתייעץ איתי לפני שמחליטים.' };
}

const setTopic = (s: GameState, id: string, topic: ChatTopic | null) => {
  s.chatTopics ??= {};
  if (topic) s.chatTopics[id] = topic; else delete s.chatTopics[id];
};

/**
 * Continues the thread the politician opened ("כדאי שנדבר", "אני מבקש שתקדם…"), so a short answer
 * like "בוא נדבר" or "בסדר" is understood in context. Returns null when the message is not part of the thread.
 */
/** Answers about the state of things (polls, economy, security, coalition, the player): real numbers, said in character. */
function knowledge(s: GameState, t: Politician, text: string): Reply | null {
  const tn = tone(t);
  const party = s.parties[t.partyId];
  const mine = s.parties[s.player.partyId];
  const poll = s.polls[s.polls.length - 1];
  const inGov = s.government.coalition.includes(t.partyId);
  const pm = s.politicians[s.government.pmId];
  if (/מה שלומ|מה נשמע|מה קורה|מה המצב איתך|איך אתה/.test(text)) {
    return { text: tn === 'hostile' ? 'עסוק. מה אתה צריך?' : pick(s, [`בסדר, תודה. יום עמוס ב${inGov ? 'ממשלה' : 'אופוזיציה'}. ומה איתך?`, 'עמוס כרגיל, אבל טוב. מה איתך?', `מחזיק מעמד. ב${party?.shortName ?? 'סיעה'} יש הרבה עבודה עכשיו.`]) };
  }
  if (/סקר|מנדט|כמה אתם|כמה אנחנו/.test(text) && poll) {
    const his = Math.round(poll.seats[t.partyId] ?? 0);
    const yours = Math.round(poll.seats[s.player.partyId] ?? 0);
    return { text: `לפי הסקר האחרון ${party?.shortName ?? 'אנחנו'} ב-${his} מנדטים${t.partyId !== s.player.partyId ? ` ו${mine?.shortName ?? 'אתם'} ב-${yours}` : ''}. ${his >= yours ? 'אנחנו במגמה טובה.' : 'יש לנו עבודה לעשות.'}` };
  }
  if (/כלכל|אינפלצי|יוקר המחיה|אבטל|צמיח|גירעון/.test(text)) {
    const e = s.economy;
    const bad = e.inflation > 4 || e.unemployment > 6 || e.growth < 1;
    return { text: `האינפלציה ${e.inflation.toFixed(1)}%, האבטלה ${e.unemployment.toFixed(1)}% והצמיחה ${e.growth.toFixed(1)}%. ${bad ? (inGov ? 'המצב לא פשוט, וצריך צעדים אמיצים.' : 'הממשלה הזאת מפסידה את הכלכלה.') : (inGov ? 'הכלכלה מחזיקה, וזה לא מובן מאליו.' : 'הכלכלה מחזיקה למרות הממשלה, לא בזכותה.')}` };
  }
  if (/ביטחון|מלחמ|עזה|חמאס|חיזבאללה|לבנון|איראן|צבא|צה״ל|צה"ל/.test(text)) {
    const hawk = (party?.ideology.security ?? 0) > 0.3;
    return { text: hawk ? pick(s, ['צריך להכות באויב חזק ולהחזיר את ההרתעה. אין מקום לוויתורים עכשיו.', 'הביטחון קודם לכל. אתמוך בכל צעד שמחזק את צה״ל.']) : pick(s, ['כוח לבד לא יפתור את זה. צריך גם מהלך מדיני.', 'אני תומך בצה״ל, אבל צריך אופק מדיני ולא רק עוד סבב.']) };
  }
  if (/קואליצי|ממשלה|ראש הממשלה|יציבות/.test(text)) {
    const st = s.government.stability;
    return { text: inGov ? `${st > 55 ? 'הקואליציה יציבה' : 'הקואליציה מתנדנדת'}${pm && pm.id !== t.id ? `, ו${pm.name} יודע שהוא צריך אותנו` : ''}. ${st > 55 ? 'נישאר כל עוד מקיימים את ההסכמים.' : 'אם לא יקיימו את ההסכמים, נשקול את צעדינו.'}` : `הממשלה הזאת ${st > 55 ? 'מחזיקה בינתיים' : 'בדרך החוצה'}, ואנחנו נעשה הכל כדי להחליף אותה.` };
  }
  if (/בחירות|הקדמת|פיזור/.test(text)) {
    return { text: inGov ? 'אין סיבה ללכת לבחירות עכשיו. הציבור רוצה יציבות.' : 'כמה שיותר מהר. הציבור רוצה שינוי.' };
  }
  if (/דעתך עליי|חושב עליי|סומך עליי|אנחנו בסדר/.test(text)) {
    return { text: t.loyalty >= 60 ? 'אני סומך עליך. עבדנו טוב יחד, ואני רוצה שזה יימשך.' : t.loyalty <= 30 ? 'בכנות? איבדתי אמון. יהיה צריך מעשים כדי לשנות את זה.' : 'יש בינינו כבוד הדדי, אבל אמון נבנה לאט. תלוי מה תעשה מכאן.' };
  }
  const other = matchPolitician(s, text, t.id);
  if (other && /דעתך|חושב על|חושבת על|מה איתו|מה אתו|סומך על|מה עם|איך הוא|מי זה|על |מכיר/.test(text)) {
    const rel = t.relationships[other.id] ?? 0;
    const same = other.partyId === t.partyId;
    const word = rel > 30 ? 'בן ברית. עובדים יחד טוב, ואני סומך עליו.' : rel < -30 ? 'לא סומך עליו. תיזהר ממנו, הוא זוכר חשבונות.' : 'יחסים ענייניים. לא חבר, לא אויב.';
    return { text: `${other.name}? ${same ? 'חבר סיעה שלי. ' : ''}${word}` };
  }
  const mm = matchMinistry(s, text);
  if (mm) {
    const cat = mm.categories[0];
    const minister = mm.ministerId ? s.politicians[mm.ministerId] : null;
    if (cat && /תקציב|כסף|מצב|מימון/.test(text)) {
      const pct = Math.round((100 * s.budget.allocations[cat]) / Math.max(0.1, s.budget.needs[cat]));
      return { text: `${mm.name} מקבל ${pct}% מהצורך שלו (₪${s.budget.allocations[cat].toFixed(1)} מיליארד מתוך ₪${s.budget.needs[cat].toFixed(1)}). ${pct < 95 ? 'זה לא מספיק, ומי שמנהל אותו יודע את זה.' : 'זה סביר. אפשר לחיות עם זה.'}` };
    }
    if (/מי |השר|מנהל|אחראי/.test(text)) return { text: minister ? `${mm.name} בידי ${minister.name}${minister.id === t.id ? ', כלומר אצלי' : minister.partyId === t.partyId ? ', חבר סיעה שלי' : ''}.` : `${mm.name} בלי שר קבוע כרגע. ראש הממשלה מחזיק אותו.` };
  }
  if (/מה אתה רוצה להיות|השאיפה|הצעד הבא|לאן אתה שואף|מה המטרה שלך|לאן אתה הולך/.test(text)) {
    return { text: t.ambitionTarget ? `אני לא מסתיר: ${t.ambitionTarget}. ${t.personality.ambition > 0.6 ? 'וזה יקרה.' : 'אם זה יגיע, טוב. אם לא, גם בסדר.'}` : 'אני במקום שאני רוצה להיות בו. בינתיים.' };
  }
  if (/המפלגה שלך|הסיעה שלך|מה אתם רוצים|מה חשוב לכם|מה חשוב לך/.test(text)) {
    const fav = (party?.favoriteLaws ?? []).slice(0, 2).map((id) => LAWS.find((l) => l.id === id)?.title).filter(Boolean);
    return { text: fav.length ? `מה שחשוב ל${party?.shortName}: ${fav.join(' ו')}. על זה לא נוותר.` : `${party?.shortName ?? 'הסיעה'} רוצה להשפיע על כיוון המדינה, ולא רק להיות שם.` };
  }
  return null;
}

function dialog(s: GameState, t: Politician, intent0: Intent, law: ReturnType<typeof matchLaw>, text = ''): Reply | null {
  const topic = s.chatTopics?.[t.id];
  if (!topic) return null;
  if (s.turn - topic.turn > 3) { setTopic(s, t.id, null); return null; }
  const party = s.parties[t.partyId];
  // a free-text answer inside an open topic: read its direction instead of asking to repeat
  const sent = intent0 === 'other' ? sentiment(text) : null;
  const intent: Intent = sent === 'yes' ? 'agree' : sent === 'no' ? 'decline' : intent0;
  const ask = topic.kind === 'unhappy' ? (topic.demand === 'law' && topic.lawId ? `שתקדם את ${lawTitle(topic.lawId)}` : topic.demand === 'role' ? 'הבטחה לתפקיד' : topic.demand === 'budget' ? 'תוספת תקציב למשרד' : 'שתתייעץ איתי לפני החלטות')
    : topic.kind === 'coop' ? (topic.lawId ? `שנקדם יחד את ${lawTitle(topic.lawId)}` : 'שיתוף פעולה בינינו') : 'תשובה';
  if (intent === 'later') {
    setTopic(s, t.id, { ...topic, turn: s.turn });
    return { text: pick(s, [`בסדר, אחכה. אבל לא לנצח: ${ask}, ונדבר שוב בתור הבא.`, `אני יכול לחכות קצת. רק אל תשכח: ${ask}.`]), hint: 'השיחה נשארת פתוחה. הוא יזכור שדחית.' };
  }
  if (intent === 'conditional') {
    setTopic(s, t.id, { ...topic, turn: s.turn });
    const offer = party?.favoriteLaws.find((l) => !s.activeLaws.includes(l));
    return { text: topic.kind === 'coop' ? 'סבבה, מה התנאי שלך? אם זה בתחום שלי, נסגור.' : `מה אתה רוצה בתמורה? אם זו תמיכה בהצבעה או בחוק שלך, אני פתוח${offer ? `, ובמיוחד אם נקדם גם את ${lawTitle(offer)}` : ''}. תגיד במפורש.`, hint: 'אפשר לנקוב בחוק או בתפקיד שאתה מבקש בתמורה. הוא ישקול.' };
  }
  if (intent === 'maybe') {
    setTopic(s, t.id, { ...topic, turn: s.turn });
    return { text: pick(s, [`אני צריך תשובה ברורה: ${ask}. כן או לא?`, `"אולי" לא עוזר לי. ${ask}, זה אפשרי מבחינתך או לא?`]), hint: 'הוא מחכה לתשובה ברורה, או להצעה נגדית.' };
  }
  const yes = intent === 'agree' || intent === 'promise' || intent === 'request' || intent === 'apology' || intent === 'thanks';
  const talk = TALK_INTENTS.includes(intent);
  const no = intent === 'decline';
  const lid = topic.lawId ?? law?.id;

  switch (topic.kind) {
    case 'unhappy': {
      if (topic.stage === 'opened' && (talk || intent === 'apology' || intent === 'promise')) {
        const g = topic.demand === 'role' && canAppoint(s) ? { demand: 'role' as const, text: `המטרה שלי היא: ${t.ambitionTarget}. אשמח להבטחה שתתמוך בי כשיגיע הזמן.`, lawId: undefined } : grievance(s, t);
        setTopic(s, t.id, { ...topic, stage: 'explained', demand: g.demand, lawId: g.lawId });
        remember(s, t.id, 'support', 'הקשבת לטענות שלי', 3);
        return { text: `תודה שהקשבת. ${g.text} מה אתה מציע?`, hint: 'הפוליטיקאי פירט את הטענה שלו. אפשר להבטיח, להתנצל או לסרב.' };
      }
      if (topic.stage === 'explained' && (yes || intent === 'meet')) {
        const d = topic.demand;
        setTopic(s, t.id, null);
        if (d === 'law' && topic.lawId) { remember(s, t.id, 'promise', `לקדם את ${lawTitle(topic.lawId)}`, 8, s.turn + 6, topic.lawId); return { text: `תודה. אני מעריך את זה, ואזכור. רשמתי: ${lawTitle(topic.lawId)}.`, hint: 'נרשמה הבטחה עם מועד. תקבל תזכורת לפני שיגיע.' }; }
        if (d === 'role') { remember(s, t.id, 'promise', 'תפקיד או תיק', 8, s.turn + 3, 'role'); return { text: 'תודה. אני מצפה לתפקיד כפי שנאמר, ואזכור את הפנייה.', hint: 'נרשמה הבטחה לתפקיד עם מועד (שנה).' }; }
        if (d === 'budget') { remember(s, t.id, 'favor', 'הסכמה לתוספת תקציב', 8); return { text: 'תודה. אחכה לראות את זה בתקציב. אם לא – נחזור לשיחה הזו.', hint: 'היחסים השתפרו. כדי לקיים, בקש תוספת תקציב לשר מראש הממשלה או אשר אותה.' }; }
        remember(s, t.id, 'support', 'הבטחת יחס אחר', 8);
        return { text: 'תודה. זה כל מה שביקשתי. אעריך שתתייעץ איתי בהמשך.', hint: 'היחסים השתפרו.' };
      }
      if (topic.stage === 'explained' && (intent === 'askwhat' || intent === 'question')) {
        const g = grievance(s, t);
        return { text: `אסביר שוב: ${g.text}` };
      }
      if (no) {
        setTopic(s, t.id, null);
        remember(s, t.id, 'insult', 'סירב לשמוע אותי', -8);
        return { text: 'אז אין לנו על מה לדבר. אצטרך לשקול את צעדיי.', hint: 'היחסים נפגעו.' };
      }
      return null;
    }
    case 'praise': {
      if (talk || yes) {
        remember(s, t.id, 'support', 'שיחה חיובית', 4);
        if (topic.lawId) {
          for (const b of s.bills.filter((x) => x.lawId === topic.lawId && x.status === 'active')) b.push += 10;
          setTopic(s, t.id, null);
          return { text: `בשמחה. אני איתך בהצבעה על ${lawTitle(topic.lawId)}.`, hint: 'התמיכה בהצעה גדלה.' };
        }
        setTopic(s, t.id, { ...topic, stage: 'explained' });
        if (law) return null;
        return { text: 'בשמחה. במה אפשר לעזור? אפשר לציין חוק שחשוב לך, תקציב או תפקיד.' };
      }
      return no ? { text: 'בסדר גמור. אני כאן אם תצטרך.' } : null;
    }
    case 'coop': {
      const pick1 = lid ?? party?.favoriteLaws[0];
      if (topic.stage === 'opened' && (talk || yes)) {
        if (!pick1) { setTopic(s, t.id, null); return { text: 'אשמח לעבוד יחד. תציע נושא ונבדוק.' }; }
        setTopic(s, t.id, { ...topic, stage: 'explained', lawId: pick1 });
        return { text: `הרעיון: שנקדם יחד את ${lawTitle(pick1)}. הצעה משותפת תגדיל את הסיכוי שתעבור, ושנינו נרוויח מזה. מה דעתך?`, hint: 'הוצעה הצעה משותפת. תשובה חיובית תרשום התחייבות הדדית.' };
      }
      if (topic.stage === 'explained' && yes && topic.lawId) {
        remember(s, t.id, 'promise', `לתמוך בהצעה של ${t.name}: ${lawTitle(topic.lawId)}`, 6, s.turn + 4, topic.lawId);
        for (const b of s.bills.filter((x) => x.lawId === topic.lawId && x.status === 'active')) b.push += 8;
        shiftPartyRelation(s, s.player.partyId, t.partyId, 2);
        setTopic(s, t.id, null);
        return { text: `מצוין. נתאם את ההגשה, ואני סומך עליך שתתמוך גם בהצעה שלנו.`, hint: 'נרשמה התחייבות הדדית. היחסים בין המפלגות השתפרו.' };
      }
      if (no) { setTopic(s, t.id, null); return { text: 'הבנתי. ההצעה נשארת פתוחה אם תשנה את דעתך.' }; }
      return null;
    }
    case 'ask_law': {
      if (yes || intent === 'meet') {
        remember(s, t.id, 'promise', `לקדם את ${lawTitle(lid)}`, 6, s.turn + 6, lid);
        for (const b of s.bills.filter((x) => x.lawId === lid && x.status === 'active')) b.push += 6;
        setTopic(s, t.id, null);
        return { text: `תודה. ${lawTitle(lid)} חשוב לנו, ונזכור מי עזר.`, hint: 'נרשמה הבטחה עם מועד. תקבל תזכורת לפני שיגיע.' };
      }
      if (intent === 'askwhat' || intent === 'question' || intent === 'greet') {
        setTopic(s, t.id, { ...topic, stage: 'explained' });
        return { text: `${lawTitle(lid)} קרוב לליבה האידיאולוגית של ${party?.shortName ?? 'המפלגה'} ולבוחרים שלנו. אשמח לתמיכתך. תוכל לעזור?` };
      }
      if (no) { setTopic(s, t.id, null); remember(s, t.id, 'insult', 'סירב לבקשה', -3); return { text: 'חבל. נזכור זאת בהצבעות.', hint: 'היחסים נפגעו מעט.' }; }
      return null;
    }
    case 'warn_law': {
      if (talk || yes) {
        const red = party?.redLines?.includes(lid ?? '');
        setTopic(s, t.id, null);
        remember(s, t.id, 'support', 'שיחה על חוק שנוי במחלוקת', 2);
        return { text: `${lawTitle(lid)} ${red ? 'הוא קו אדום' : 'פוגע בעקרונות'} של ${party?.shortName ?? 'המפלגה'}. אם תרכך את ההצעה או תציע תמורה ממשית, אשקול מחדש. אחרת נצביע נגד.`, hint: 'אפשר לרכך את ההצעה (פעולת "ריכוך") או להציע תמורה בשיחה.' };
      }
      return no ? (setTopic(s, t.id, null), { text: 'אז נפגש בהצבעה.' }) : null;
    }
    case 'campaign': {
      if (talk || yes) {
        shiftPartyRelation(s, s.player.partyId, t.partyId, 2);
        setTopic(s, t.id, null);
        return { text: 'ברמה העקרונית אפשר לבחון הסכם עודפים או שיתוף פעולה אחרי הבחירות. נחזור לזה כשהסקרים יתייצבו.', hint: 'היחסים בין המפלגות השתפרו מעט. הסכם עודפים אפשר לעשות במסך מפת היחסים.' };
      }
      return no ? (setTopic(s, t.id, null), { text: 'בסדר. נדבר אחרי הבחירות.' }) : null;
    }
  }
  return null;
}

// ---------------- understanding: subjects, deals, context ----------------
const norm = (x: string) => x.replace(/[׳'"״]/g, '');
type Ministry = GameState['government']['ministries'][number];

/** The ministry the text talks about ("תיק החינוך", "משרד הביטחון", "ביטחון לאומי"), the longest match wins. */
export function matchMinistry(s: GameState, text: string): Ministry | null {
  const t = norm(text);
  let best: { m: Ministry; len: number } | null = null;
  for (const m of s.government.ministries) {
    const full = norm(m.name);
    const core = full.replace(/^(משרד|המשרד) (ה|ל)?/, '');
    const first = core.split(/ ו| /)[0];
    const keys = [full, core, core.replace(/^ה/, ''), first].filter((k) => k.length >= 4);
    for (const k of keys) if (t.includes(k) && (!best || k.length > best.len)) best = { m, len: k.length };
  }
  return best?.m ?? null;
}

/** Another politician named in the text (full name, or a distinctive surname), never the one we talk to. */
export function matchPolitician(s: GameState, text: string, exceptId?: string): Politician | null {
  const t = norm(text);
  let best: { p: Politician; len: number } | null = null;
  for (const p of Object.values(s.politicians)) {
    if (!p.active || p.isPlayer || p.id === exceptId) continue;
    const name = norm(p.name).replace(/^(אלוף|תא״ל|הרב|ד״ר|פרופ׳|\(מיל\.\))\s*/g, '');
    const parts = name.split(' ').filter((w) => w.length >= 3);
    const keys = [name, parts[parts.length - 1]].filter((k) => k && k.length >= 4);
    for (const k of keys) if (t.includes(k) && (!best || k.length > best.len)) best = { p, len: k.length };
  }
  return best?.p ?? null;
}

interface DealSide { kind: 'law' | 'role' | 'budget' | 'support'; lawId?: string; ministryId?: string; text: string }
export interface Deal { give: DealSide | null; want: DealSide | null }

const GIVE_RE = /אתן|אמנה|אעביר|אקדם|אתמוך|אצביע|אאשר|תקבל|תקבלי|יהיה לך|אדאג|אקצה|אוסיף|אבטיח|מבטיח|אני נותן|אני מציע|אתה מקבל|את מקבלת|אעזור|אשמור/;
const WANT_RE = /לחץ|תלחץ|תדבר עם|דבר עם|תשכנע|שכנע|תעזור לי|תגיד ל|תפעיל|תתמוך|תתמכי|תצביע|תצביעי|תעזור|תעזרי|תן לי|תני לי|תיתן לי|תיתני לי|תמנה אותי|תסכים|תסכימי|תצטרף|תצטרפי|אני רוצה|אני צריך|אני צריכה|תעביר|תקדם|תפסיק|תסיר|תסגור|תהיה איתי|תישאר|תישארי|תוותר|תמשוך|אבקש|מבקש|מבקשת/;
const ROLE_RE = /תיק|שר\b|שרה\b|סגן|ועדה|תפקיד|ראשות|משרד/;
const SUPPORT_RE = /תמיכה|תתמוך|תתמכי|תצביע|תצביעי|בעד|הצבעה|קואליציה|תישאר|תישארי/;

function sideOf(s: GameState, seg: string): DealSide | null {
  const m = matchMinistry(s, seg);
  // money without the word "law": a budget, even if some law title shares a word or two
  if (mentionsMoney(seg) && !/חוק|רפורמ/.test(seg)) return { kind: 'budget', ministryId: m?.id, text: seg };
  const law = matchLaw(seg);
  if (law) return { kind: 'law', lawId: law.id, text: seg };
  if (mentionsMoney(seg)) return { kind: 'budget', ministryId: m?.id, text: seg };
  if (m && ROLE_RE.test(seg)) return { kind: 'role', ministryId: m.id, text: seg };
  if (ROLE_RE.test(seg)) return { kind: 'role', text: seg };
  if (mentionsMoney(seg)) return { kind: 'budget', ministryId: m?.id, text: seg };
  if (SUPPORT_RE.test(seg)) return { kind: 'support', text: seg };
  return null;
}

/** "אתמוך בחוק X אם תיתן לי את תיק החינוך" -> what the player gives and what the player wants. */
export function parseDeal(s: GameState, text: string): Deal {
  const segs = text.split(/\s(?:אם|בתנאי ש|בתמורה ל|בתמורה|ובתמורה|אבל רק אם|כל עוד|ואז|ואתה|ואת)\s|,|\sאבל\s/).map((x) => x.trim()).filter(Boolean);
  let give: DealSide | null = null;
  let want: DealSide | null = null;
  for (const seg of segs) {
    const side = sideOf(s, seg);
    if (!side) continue;
    const g = GIVE_RE.test(seg);
    const w = WANT_RE.test(seg);
    if (w && !want) want = side;
    else if (g && !give) give = side;
    else if (!w && !g && !give) give = side;
  }
  return { give, want };
}

/** What the last few messages were about, so "זה" / "על זה" refers to it. */
export function recentContext(s: GameState, id: string): { law: ReturnType<typeof matchLaw>; ministry: Ministry | null } {
  const msgs = (s.chats?.[id] ?? []).slice(-6).reverse();
  let law: ReturnType<typeof matchLaw> = null;
  let ministry: Ministry | null = null;
  for (const m of msgs) {
    law ??= matchLaw(m.text);
    ministry ??= matchMinistry(s, m.text);
    if (law && ministry) break;
  }
  const topicLaw = s.chatTopics?.[id]?.lawId;
  if (!law && topicLaw) law = LAWS.find((l) => l.id === topicLaw) ?? null;
  return { law, ministry };
}
const REFERS_BACK = /(^|\s)(זה|הזה|על זה|את זה|בעניין הזה|בנושא הזה|בזה|אותו|לזה|עליו)(\s|[.?!,]|$)/;

/** How much a thing the player offers is worth to this politician (0..3). */
function valueOf(s: GameState, t: Politician, side: DealSide): number {
  if (side.kind === 'law' && side.lawId) {
    const st = lawStance(s, t, side.lawId);
    return st === 'for' ? 3 : st === 'neutral' ? 1 : 0;
  }
  if (side.kind === 'role') return canAppoint(s) ? (side.ministryId ? 3 : 2) : 0;
  if (side.kind === 'budget') return isPm(s) ? 2 : 0;
  return 1;
}

/** Both sides of a deal are on the table: the politician weighs them and answers both parts. */
function negotiate(s: GameState, t: Politician, deal: Deal): Reply {
  const give = deal.give!;
  const want = deal.want!;
  const party = s.parties[t.partyId];
  const name = (x: DealSide) => (x.kind === 'law' && x.lawId ? lawTitle(x.lawId) : x.kind === 'role' ? (x.ministryId ? s.government.ministries.find((m) => m.id === x.ministryId)?.name ?? 'תיק' : 'תפקיד') : x.kind === 'budget' ? 'תוספת תקציב' : 'תמיכה');
  // the player wants a job from someone who can't give one
  if (want.kind === 'role') {
    const canGive = t.id === s.government.pmId || (party?.leaderId === t.id && t.partyId === s.player.partyId);
    if (!canGive) return { text: `${name(want)}? זה לא בידיים שלי. דבר עם ${t.id === s.government.pmId ? 'עצמך' : s.politicians[s.government.pmId]?.name ?? 'ראש הממשלה'} או עם יו״ר הסיעה שלך.` };
  }
  if (want.kind === 'law' && want.lawId && lawStance(s, t, want.lawId) === 'redline') {
    return { text: `גם בתמורה ל${name(give)}, לא. ${lawTitle(want.lawId)} זה קו אדום של ${party?.shortName ?? 'הסיעה'}.` };
  }
  const v = valueOf(s, t, give);
  if (give.kind === 'role' && !canAppoint(s)) return { text: `אתה מציע לי ${name(give)}, אבל אתה לא זה שממנה. כשתוכל להבטיח את זה באמת, נדבר.` };
  if (give.kind === 'budget' && !isPm(s)) return { text: 'תוספת תקציב זה לא בסמכות שלך. תציע משהו שאתה יכול לקיים.' };
  const need = want.kind === 'law' && want.lawId ? (lawStance(s, t, want.lawId) === 'against' ? 3 : lawStance(s, t, want.lawId) === 'for' ? 0 : 2) : want.kind === 'support' ? 2 : 1;
  if (v >= need) {
    // record the player's side as a tracked promise, and deliver the politician's side
    if (give.kind === 'law' && give.lawId) remember(s, t.id, 'promise', `לקדם את ${lawTitle(give.lawId)}`, 8, s.turn + 6, give.lawId);
    else if (give.kind === 'role') remember(s, t.id, 'promise', give.ministryId ? `למנות ל${name(give)}` : 'תפקיד או תיק', 8, s.turn + 3, 'role');
    else if (give.kind === 'budget') remember(s, t.id, 'favor', 'הבטחה לתקציב', 5);
    else remember(s, t.id, 'favor', 'הבטחת תמיכה', 4);
    if (want.kind === 'law' && want.lawId) {
      for (const b of s.bills.filter((x) => x.lawId === want.lawId && x.status === 'active')) b.push += 15;
      remember(s, t.id, 'support', `סיכם לתמוך ב${lawTitle(want.lawId)}`, 3);
    } else remember(s, t.id, 'support', 'סיכם עסקה', 3);
    setTopic(s, t.id, null);
    return { text: pick(s, [`סגור. ${name(give)} מצידך, ${name(want)} מצידי. אני אזכור את החלק שלך.`, `עסקה. אני נותן ${name(want)}, ואתה ${name(give)}. אם לא תקיים, נדבר אחרת.`]), hint: 'העסקה נרשמה: ההבטחה שלך עם מועד, והוא כבר פעל מצידו.' };
  }
  const extra = party?.favoriteLaws.find((l) => !s.activeLaws.includes(l) && l !== give.lawId);
  if (v > 0 && extra) {
    setTopic(s, t.id, { kind: 'coop', stage: 'explained', turn: s.turn, lawId: extra });
    return { text: `${name(give)} זה התחלה, אבל לא מספיק בשביל ${name(want)}. אם תוסיף גם את ${lawTitle(extra)}, סגרנו.`, hint: 'הצעה נגדית. תשובה חיובית תסגור את העסקה.' };
  }
  return { text: v === 0 ? `${name(give)} לא שווה לי הרבה. בשביל ${name(want)} תצטרך להציע משהו ש${party?.shortName ?? 'הסיעה'} באמת רוצה.` : `על ${name(want)} אני לא מוכן ללכת בשביל ${name(give)}. תציע יותר.` };
}

const LOBBY_RE = /לחץ|תלחץ|תדבר עם|דבר עם|תשכנע|שכנע|תפעיל|תעזור לי מול|תגיד ל/;
const PM_RE = /ראש הממשלה|רה״מ|רה"מ|ראש ממשלה|שר האוצר/;

/** "לחץ על ראש הממשלה להגדיל את התקציב שלי": the politician agrees (or not) to put in a word, and the PM remembers it. */
function lobby(s: GameState, t: Politician, text: string): Reply | null {
  if (!LOBBY_RE.test(text)) return null;
  const target = PM_RE.test(text) ? s.politicians[s.government.pmId] : matchPolitician(s, text, t.id);
  if (!target || target.id === t.id) return null;
  const tn = tone(t);
  const m = matchMinistry(s, text) ?? s.government.ministries.find((x) => x.ministerId === s.player.politicianId);
  const law = matchLaw(text);
  const subject = law ? `קידום ${law.title}` : mentionsRole(text) ? 'תפקיד בשבילך' : mentionsMoney(text) ? `תוספת תקציב ל${m?.name ?? 'המשרד שלך'}` : 'העניין שלך';
  if (tn === 'hostile') return { text: `שאדבר עם ${target.name} בשבילך? אחרי מה שהיה בינינו, לא.`, hint: 'הוא לא ישתדל בשבילך כל עוד היחסים גרועים.' };
  const rel = t.relationships[target.id] ?? 0;
  if (rel < -30) return { text: `${target.name} לא מקשיב לי בימים אלה. אם אדבר איתו, זה רק יזיק לך. תנסה דרך מישהו אחר.` };
  const weight = tn === 'friendly' ? 4 : 2;
  remember(s, target.id, 'support', `${t.name} דיבר איתי בעד ${subject}`, weight);
  remember(s, t.id, 'favor', `השתדל בשבילך אצל ${target.name}`, 2);
  setTopic(s, t.id, null);
  return { text: pick(s, [`בסדר, אדבר עם ${target.name} על ${subject}. אני לא מבטיח תוצאה, אבל המילה שלי שווה שם משהו.`, `אעלה את זה בפני ${target.name}. ${subject} זה דבר שאפשר להסביר, ואני אסביר.`]), hint: `${target.name} שמע ממנו מילה טובה: היחס שלו אליך השתפר (+${weight}). זה מעלה את הסיכוי לאישורים.` };
}

/** Instead of "לא הבנתי": a focused question built from whatever was recognizable. */
function clarify(s: GameState, t: Politician, text: string, tn: ReturnType<typeof tone>): Reply {
  const words = tokens(text);
  const near = words.length ? LAWS.find((l) => words.some((w) => l.title.includes(w))) : undefined;
  if (near) return { text: `התכוונת ל${near.title}? אם כן, תגיד מה אתה מבקש ממני בעניין: תמיכה, קידום או דעה.` };
  const m = matchMinistry(s, text);
  if (m) return { text: `אתה מדבר על ${m.name}? אפשר לשאול אותי על התקציב שלו, על השר, או להציע משהו בעניין.` };
  const other = matchPolitician(s, text, t.id);
  if (other) return { text: `${other.name}? אם אתה שואל מה דעתי עליו, תשאל ישירות. אם אתה מבקש שאדבר איתו, תגיד על מה.` };
  if (tn === 'hostile') return { text: 'תגיע לעניין.' };
  return { text: pick(s, ['לא בטוח שהבנתי. אתה מבקש ממני תמיכה, מציע לי משהו, או שואל על עמדה?', 'תנסח את זה אחרת: מה אתה רוצה שיקרה, ומה אתה נותן?']) };
}

/** A touch of personality on top of the reply, so politicians don't all sound the same. */
function voice(s: GameState, t: Politician, r: Reply): Reply {
  const roll = side(s, `voice${t.id}${(s.chats?.[t.id] ?? []).length}`);
  if (roll > 0.4 || r.text.length > 160) return r;
  const tn = tone(t);
  const ego = t.personality.ego > 0.6;
  const amb = t.personality.ambition > 0.6;
  const pre = tn === 'hostile' ? '' : ego ? pick(s, ['תשמע. ', 'אני אגיד לך בדיוק. ', '']) : pick(s, ['תראה. ', 'בוא נהיה ישירים. ', '']);
  const post = tn === 'friendly' && amb ? pick(s, [' נמשיך מכאן.', ' יש לנו עוד הרבה לעשות יחד.', '']) : '';
  if (!pre && !post) return r;
  const text = pre && /^[א-ת]/.test(r.text) ? pre + r.text : r.text;
  return { ...r, text: text + post };
}

function handle(s: GameState, t: Politician, text: string): Reply {
  return voice(s, t, handleRaw(s, t, text));
}

function handleRaw(s: GameState, t: Politician, text: string): Reply {
  const me = s.politicians[s.player.politicianId];
  const intent = detectIntent(text);
  const tn = tone(t);
  // "זה" / "על זה" refers to what the conversation was about
  const ctx = recentContext(s, t.id);
  const law = matchLaw(text) ?? (REFERS_BACK.test(text) ? ctx.law : null);
  // a full deal in one sentence ("אתמוך ב-X אם תיתן לי Y"): answer both parts
  const deal = parseDeal(s, text);
  if (deal.give && deal.want && !(deal.want.kind === 'budget' && t.id !== s.government.pmId)) return negotiate(s, t, deal);
  // "לחץ על ראש הממשלה בשביל התקציב שלי": a lobbying request, also as the price of a deal
  const lobbied = lobby(s, t, text);
  if (lobbied) return lobbied;
  const threaded = dialog(s, t, intent, law, text);
  if (threaded) return threaded;
  const fresh = (intent === 'other' || intent === 'question' || TALK_INTENTS.includes(intent) || intent === 'decline' || intent === 'later' || intent === 'conditional' || intent === 'maybe') ? true : once(s, t.id, `${intent}:${law?.id ?? ''}`);
  if (!fresh) return { text: pick(s, ['כבר דיברנו על זה היום. נחזור לנושא בהמשך.', 'את הנקודה הבנתי. אין לי מה להוסיף כרגע.']) };

  switch (intent) {
    case 'threat': {
      const pConcede = clamp(0.22 + (me.power - t.power) / 150 + (s.player.role === 'pm' ? 0.18 : 0) - t.personality.ego * 0.25 - (tn === 'friendly' ? 0 : 0.05), 0.05, 0.75);
      if (rand(s) < pConcede) {
        remember(s, t.id, 'insult', 'איים עליי בשיחה', -8);
        if (law) for (const b of s.bills.filter((x) => x.lawId === law.id && x.status === 'active')) b.push += 10;
        return { text: pick(s, ['אני לא אוהב לעבוד תחת איומים, אבל אשקול מחדש את העמדה שלי.', 'הבנתי את המסר. אתאים את ההתנהלות שלי.']), hint: 'האיום עבד, אבל הוא ייזכר לרעה.' };
      }
      remember(s, t.id, 'insult', 'איים עליי בשיחה', -18);
      if (chance(s, 0.35)) {
        addNews(s, `${t.name}: "${me.name} איים עליי בשיחה פרטית"`, 'bad', '🗯️');
        applyEffects(s, { playerReputation: -3 });
        return { text: 'איומים לא ירתיעו אותי. אני אספר על השיחה הזו בפומבי.', hint: 'האיום נכשל והשיחה דלפה.' };
      }
      return { text: pick(s, ['איומים לא עובדים עליי. אזכור את השיחה הזו.', 'אם זו הדרך שבחרת, התגובה שלי תהיה בהצבעה.']), hint: 'האיום נכשל והיחסים נפגעו.' };
    }
    case 'promise': {
      if (law) {
        remember(s, t.id, 'promise', `לקדם את ${law.title}`, 8, s.turn + 6, law.id);
        return { text: `${line(s, 'promiseGeneric', tn)} רשמתי: ${law.title}.`, hint: 'נרשמה הבטחה עם מועד (שנתיים). תקבל תזכורת לפני שיגיע.' };
      }
      if (mentionsRole(text)) {
        remember(s, t.id, 'promise', 'תפקיד או תיק', 8, s.turn + 3, 'role');
        return { text: `${line(s, 'promiseGeneric', tn)} אני מצפה לתפקיד כפי שנאמר.`, hint: 'נרשמה הבטחה לתפקיד עם מועד (שנה).' };
      }
      if (mentionsMoney(text)) {
        remember(s, t.id, 'favor', 'הבטחה לתקציב', 5);
        return { text: `${line(s, 'promiseGeneric', tn)} אחכה לראות את זה בתקציב.`, hint: 'יחסים השתפרו מעט. הבטחה כללית לא נרשמת עם מועד; כדי לקבוע התחייבות, נקוב בחוק או בתפקיד.' };
      }
      remember(s, t.id, 'favor', 'הבטחה כללית', 4);
      return { text: line(s, 'promiseGeneric', tn), hint: 'הבטחה כללית משפרת מעט את היחסים. כדי להתחייב, נקוב בחוק או בתפקיד מסוים.' };
    }
    case 'request': {
      if (law) {
        const st = lawStance(s, t, law.id);
        const bill = s.bills.find((b) => b.lawId === law.id && b.status === 'active');
        if (st === 'redline') return { text: `זה קו אדום עבורי ועבור ${s.parties[t.partyId]?.shortName}. לא נתמוך ב${law.title} בשום מצב.` };
        if (st === 'against' && tn !== 'friendly') return { text: `אני מתנגד ל${law.title}. אין לי עניין לתמוך.` };
        const ok = st === 'for' || tn === 'friendly' || (tn === 'neutral' && chance(s, 0.45));
        if (ok) {
          if (bill) bill.push += 10;
          remember(s, t.id, 'support', `נענה לבקשה בנושא ${law.title}`, 3);
          return { text: pick(s, [`בסדר, אתמוך ב${law.title}.`, `אפעל בעד ${law.title} בסיעה שלי.`]), hint: bill ? 'התמיכה בהצעה גדלה.' : 'אין כרגע הצעה פעילה בנושא. הבקשה נרשמה.' };
        }
        return { text: pick(s, ['אני לא יכול להתחייב על זה כרגע.', 'אצטרך משהו בתמורה כדי לתמוך בזה.']), hint: 'אפשר להציע תמורה (הבטחה לחוק, לתפקיד או לתקציב).' };
      }
      return { text: tn === 'hostile' ? 'אני לא בעמדה לעזור לך כרגע.' : pick(s, ['במה בדיוק אתה מבקש שאתמוך? ציין חוק או נושא.', 'אשמח לעזור אם תפרט במה מדובר.']) };
    }
    case 'apology': {
      remember(s, t.id, 'support', 'התנצל בפניי', tn === 'hostile' ? 4 : 7);
      return { text: line(s, 'apology', tn), hint: 'היחסים השתפרו.' };
    }
    case 'thanks': {
      remember(s, t.id, 'support', 'שיחה חיובית', 5);
      shiftPartyRelation(s, s.player.partyId, t.partyId, 1);
      return { text: line(s, 'thanks', tn), hint: 'היחסים השתפרו.' };
    }
    case 'insult': {
      remember(s, t.id, 'insult', 'העליב אותי בשיחה', -15);
      shiftPartyRelation(s, s.player.partyId, t.partyId, -3);
      return { text: line(s, 'insult', tn), hint: 'היחסים נפגעו.' };
    }
    case 'question': {
      if (law) {
        const st = lawStance(s, t, law.id);
        const word = st === 'for' ? 'תומך' : st === 'against' ? 'מתנגד' : st === 'redline' ? 'מתנגד נחרצות' : 'מתלבט';
        return { text: `בנושא ${law.title}: אני ${word}. ${st === 'redline' ? 'זה קו אדום של הסיעה.' : st === 'neutral' ? 'אני צריך לראות את הנוסח ואת התמורה.' : `זה תואם את עמדת ${s.parties[t.partyId]?.shortName}.`}` };
      }
      const known = knowledge(s, t, text);
      if (known) return known;
      return { text: pick(s, ['השאלה חשובה. אשמח לדון בזה פנים אל פנים.', 'אין לי עמדה סופית. מה דעתך?', 'אני מעדיף לענות בפגישה ולא בכתב.']) };
    }
    case 'greet':
      return { text: tn === 'hostile' ? 'שלום. מה אתה רוצה?' : pick(s, ['שלום. מה תרצה לדבר עליו?', 'היי. במה אפשר לעזור?', 'שלום, טוב לשמוע ממך. על מה נדבר?']) };
    case 'meet': {
      remember(s, t.id, 'support', 'ביקש לדבר', tn === 'hostile' ? 1 : 3);
      if (tn === 'hostile') return { text: 'אני מוכן לשמוע, אבל אל תצפה להפתעות. על מה תרצה לדבר?' };
      return { text: pick(s, ['בוודאי. על מה תרצה שנדבר: חוק, תקציב, תפקיד או שיתוף פעולה?', 'אשמח. מה הנושא? אפשר לציין חוק מסוים, תקציב או תפקיד.']) };
    }
    case 'agree':
      return { text: tn === 'hostile' ? 'טוב. נראה מה יצא מזה.' : pick(s, ['מצוין. על מה תרצה שנדבר?', 'יופי. תפרט מה אתה מציע ואחשוב על זה.']) };
    case 'decline':
      return { text: tn === 'friendly' ? 'בסדר, נחזור לזה בהזדמנות.' : 'מובן. אם תשנה את דעתך – אני כאן.' };
    case 'askwhat': {
      if (t.loyalty < 30) {
        const g = grievance(s, t);
        setTopic(s, t.id, { kind: 'unhappy', stage: 'explained', turn: s.turn, demand: g.demand, lawId: g.lawId });
        return { text: `אם אתה שואל: ${g.text} מה אתה מציע?`, hint: 'הפוליטיקאי פירט את הטענה שלו. אפשר להבטיח, להתנצל או לסרב.' };
      }
      return { text: pick(s, ['אין לי בקשה מסוימת כרגע, רציתי להתעדכן. אם חשוב לך משהו – ציין חוק, תקציב או תפקיד.', 'שום דבר דחוף. אם יש משהו שאתה צריך ממני, תגיד.']) };
    }
    case 'later':
      return { text: pick(s, ['בסדר, אחכה לשמוע ממך.', 'אין בעיה. כשתהיה מוכן, תכתוב לי.']) };
    case 'conditional':
      return { text: 'תגיד מה אתה מציע ומה אתה מבקש בתמורה, ונראה אם יש עסקה.' };
    case 'maybe':
      return { text: pick(s, ['כשתחליט, תגיד לי.', 'בסדר. תחשוב על זה, ואני כאן.']) };
    default: {
      // a message with a subject but no clear verb: answer the subject instead of asking to repeat
      if (law) {
        const st = lawStance(s, t, law.id);
        const word = st === 'for' ? 'תומך' : st === 'against' ? 'מתנגד' : st === 'redline' ? 'מתנגד נחרצות' : 'מתלבט';
        return { text: `בנושא ${law.title}: אני ${word}. אם אתה מבקש משהו ממני, תגיד זאת במפורש.` };
      }
      const known = knowledge(s, t, text);
      if (known) return known;
      if (mentionsMoney(text)) return { text: 'תקציב זה עניין של ראש הממשלה ושל שר האוצר. אם אתה מציע משהו בתמורה לתמיכה, תפרט.' };
      if (mentionsRole(text)) return { text: 'מינויים הם עניין של ראש הממשלה. אם אתה מבטיח תפקיד, אמור זאת במפורש ואני אזכור.' };
      return clarify(s, t, text, tn);
    }
  }
}

/** The player writes to a politician. Returns false if the text was empty. */
export function sendChat(s: GameState, targetId: string, text: string): boolean {
  const t = s.politicians[targetId];
  const msg = text.trim().slice(0, 400);
  if (!t || !msg || t.isPlayer) return false;
  push(s, targetId, { from: 'me', text: msg });
  markRead(s, targetId);
  const r = handle(s, t, msg);
  push(s, targetId, { from: 'them', text: r.text, hint: r.hint });
  markRead(s, targetId);
  return true;
}

// ---------------- politicians write on their own ----------------
interface Opening { text: string; topic?: Omit<ChatTopic, 'turn' | 'stage'> }

/** Deterministic 0..1 value from the seed, the turn and a key – chat chatter must not shift the game's main random sequence. */
function side(s: GameState, key: string): number {
  let h = 2166136261;
  for (const c of `${s.seed}|${s.turn}|${key}`) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 100000) / 100000;
}

/** Everything this politician could say right now, given who they are and what is going on. */
function openings(s: GameState, p: Politician): Opening[] {
  const me = s.politicians[s.player.politicianId].name;
  const party = s.parties[p.partyId];
  const pn = party?.shortName ?? 'הסיעה';
  const inGov = s.government.coalition.includes(p.partyId);
  // each politician cares about a different bill: their party's own first, otherwise one picked per person
  const active = s.bills.filter((b) => b.status === 'active');
  const own = active.filter((b) => party?.favoriteLaws.includes(b.lawId));
  const pool = own.length ? own : active;
  const open = pool.length ? pool[Math.floor(side(s, `bill${p.id}`) * pool.length)] : undefined;
  const campaign = s.campaign?.electionDay !== undefined;
  const ministry = p.ministryId ? s.government.ministries.find((m) => m.id === p.ministryId)?.name : undefined;
  const favs = party?.favoriteLaws.filter((l) => !s.activeLaws.includes(l)) ?? [];
  const fav = favs.length ? favs[Math.floor(side(s, `fav${p.id}`) * favs.length)] : undefined;
  const rival = Object.values(s.politicians).filter((x) => x.active && !x.isPlayer && x.partyId !== p.partyId && x.id !== s.player.politicianId && x.power > 40);
  const out: Opening[] = [];
  const add = (text: string, topic?: Opening['topic']) => out.push({ text, topic });

  // complaints need a cause: nothing has happened on the first turn, and "broken promises" needs a promise
  const brokenPromise = p.memory.some((m) => m.kind === 'betrayal' && !m.resolved);
  if (p.loyalty < 30 && s.turn >= 1) {
    add(`${me}, אני לא מרוצה מההתנהלות כלפיי ולכן אני שוקל את צעדיי. כדאי שנדבר.`, { kind: 'unhappy' });
    add(`לא התייעצת איתי לפני ההחלטות האחרונות, ${me}. אני מצפה ליחס אחר.`, { kind: 'unhappy', demand: 'respect' });
    add('שמעתי דברים שנאמרו עליי, ואני מניח שלא בלי ידיעתך. אפשר לשוחח?', { kind: 'unhappy' });
    if (brokenPromise) add('אני מרגיש שהבטחות לא מתקיימות. אשמח להבין איפה אנחנו עומדים.', { kind: 'unhappy' });
    if (ministry && isPm(s) && underfunded(s, p)) add(`${ministry} נשחק ואני לא יכול להמשיך כך. אני רוצה פגישה דחופה על התקציב.`, { kind: 'unhappy', demand: 'budget' });
    if (inGov) {
      if (brokenPromise) add(`אני מצפה להתחייבויות שניתנו. אם זה לא ישתנה, ${pn} תשקול את המשך דרכה בקואליציה.`, { kind: 'unhappy' });
      add(`בסיעה של ${pn} מתחילים לשאול למה אנחנו בקואליציה. תן לי סיבה להסביר להם.`, { kind: 'unhappy' });
    } else {
      add('אנחנו מתנגדים למדיניות שלך, ונפעל נגדה בכנסטון.');
      add(`המדיניות שלך פוגעת בבוחרים של ${pn}. נילחם בה בכנסטון ובתקשורת.`);
      add('אל תצפה לתמיכה שלנו בהצבעות הקרובות.');
    }
  } else if (p.loyalty > 70) {
    add(`${me}, רציתי לומר שאני מעריך את שיתוף הפעולה בינינו. אם אפשר לעזור במשהו – אני כאן.`, { kind: 'praise' });
    add('ראיתי את הדברים שלך בתקשורת. נשמע לי נכון. כדאי שנמשיך בקו הזה.', { kind: 'praise' });
    add(`${pn} מאחוריך. מה הצעד הבא?`, { kind: 'praise' });
    add('אם צריך שאדבר עם עמיתים בסיעה בשבילך, אני זמין.', { kind: 'praise' });
    if (open) add(`אני עוקב אחרי ${open.title}. אם צריך תמיכה שלי בהצבעה, תגיד.`, { kind: 'praise', lawId: open.lawId });
    if (open) add(`דיברתי עם כמה חברים על ${open.title}. יש מקום להסכמות, אם נרצה.`, { kind: 'praise', lawId: open.lawId });
    add('יש לי רעיון לשיתוף פעולה. אשמח להיפגש.', { kind: 'coop' });
    if (fav) add(`מה דעתך שנגיש יחד הצעה בנושא ${lawTitle(fav)}? זה יחזק את שנינו.`, { kind: 'coop', lawId: fav });
  } else {
    if (ministry && isPm(s) && underfunded(s, p)) add(`אשמח לפגישה קצרה על ${ministry}. יש כמה נושאים שדורשים החלטה.`, { kind: 'unhappy', demand: 'budget' });
    else if (ministry) add(`אני נלחם על התקציב של ${ministry} מול ראש הממשלה ושר האוצר. אשמח לתמיכה שלך בעניין.`, { kind: 'coop' });
    if (p.ambitionTarget && canAppoint(s)) add(`אני חושב על הצעד הבא שלי: ${p.ambitionTarget}. אשמח לשמוע מה דעתך.`, { kind: 'unhappy', demand: 'role' });
    if (fav) add(`${pn} מקדמת את ${lawTitle(fav)}. אולי נוכל לשתף פעולה?`, { kind: 'coop', lawId: fav });
    add('הסקרים זזים. כדאי שנתאם עמדות לפני ההצבעות הבאות.', { kind: 'coop' });
    if ((s.chats?.[p.id] ?? []).some((m) => m.from === 'me')) add('היה לי רעיון בעקבות השיחה האחרונה שלנו. אפשר לדבר?', { kind: 'coop' });
    if (rival.length) {
      const r = rival[Math.floor(side(s, `rival${p.id}`) * rival.length)];
      add(`שמעתי ש${r.name} (${s.parties[r.partyId]?.shortName ?? ''}) מתכנן מהלך שיכול להשפיע עליך. כדאי לבדוק לפני שיהיה מאוחר.`);
    }
  }
  if (open && party && (party.favoriteLaws.includes(open.lawId) || party.hatedLaws.includes(open.lawId))) {
    if (party.favoriteLaws.includes(open.lawId)) add(`אני מבקש שתקדם את ${open.title}. זה חשוב לנו, ואנחנו נזכור מי עזר.`, { kind: 'ask_law', lawId: open.lawId });
    else add(`אני מזהיר אותך: ${pn} תתנגד ל${open.title} בכל כוחה.`, { kind: 'warn_law', lawId: open.lawId });
  }
  if (campaign && !inGov) {
    add('הבחירות מתקרבות. אולי כדאי שנדבר על שיתוף פעולה אחרי היום שאחרי.', { kind: 'campaign' });
    add('אנחנו בוחנים הסכם עודפים. תהיה פתוח לשיחה?', { kind: 'campaign' });
  }
  return out;
}

function proactive(s: GameState, p: Politician): Opening | null {
  const said = new Set((s.chats?.[p.id] ?? []).filter((m) => m.from === 'them').map((m) => m.text));
  const fresh = openings(s, p).filter((o) => !said.has(o.text));
  return fresh.length ? fresh[Math.floor(side(s, `pick${p.id}`) * fresh.length)] : null;
}

/** Once per turn: a couple of politicians write to the player. */
export function chatTick(s: GameState): void {
  if (s.gameOver || s.elections.phase !== 'none') return;
  const pool = chatContacts(s).filter((p) => p.id !== s.player.politicianId);
  let sent = 0;
  for (const p of pool.sort((a, b) => side(s, `order${a.id}`) - side(s, `order${b.id}`))) {
    if (sent >= 2) break;
    if (side(s, `go${p.id}`) >= (p.loyalty < 30 || p.loyalty > 70 ? 0.3 : 0.16)) continue;
    const o = proactive(s, p);
    if (!o) continue;
    push(s, p.id, { from: 'them', text: o.text, proactive: true });
    setTopic(s, p.id, o.topic ? { ...o.topic, stage: 'opened', turn: s.turn } : null);
    sent += 1;
    logEvent(s, '💬', `${p.name} כתב לך הודעה`, 1, 'neutral', 'chat');
  }
}
