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
import type { ChatMsg, GameState, Politician } from '../types/game';
import { clamp } from '../utils';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { chance, pick, rand } from './rng';
import { shiftPartyRelation } from './relations';

export type Intent = 'threat' | 'promise' | 'request' | 'apology' | 'thanks' | 'insult' | 'question' | 'other';

const MAX_CHAT = 60;
const FREE_PER_TURN = 3;

const PATTERNS: { intent: Intent; re: RegExp }[] = [
  { intent: 'threat', re: /אפיל|אפרסם|אחשוף|אפטר|אפרוש|אעזוב|אשבית|אצביע נגד|אפרק|אנקום|תתחרט|אאיים|איום|אדאג שתיפול|אודיע על|ננתק|אפסיק לתמוך|אסיר/ },
  { intent: 'promise', re: /מבטיח|אבטיח|מתחייב|אדאג|אקדם|אעביר|אתן לך|אמנה|אעלה|אקצה|נותן לך|תקבל|הבטחה/ },
  { intent: 'request', re: /תתמוך|תצביע|אבקש|בקשה|מבקש|צריך אותך|צריכה אותך|עזור|סייע|תסכים|תצטרף|תסיר|תפסיק|תקדם|אשמח ש/ },
  { intent: 'apology', re: /סליחה|מתנצל|טעיתי|מצטער|אני מצטערת|מתנצלת/ },
  { intent: 'insult', re: /טיפש|שקרן|בוגד|פתטי|מביש|כישלון|תתבייש|מטומטם|אידיוט|חסר ערך|נוכל/ },
  { intent: 'thanks', re: /תודה|מעריך|גאה|כל הכבוד|עבודה מצוינת|אני איתך|נעבוד יחד|שיתוף פעולה|נפגש|פגישה|קפה|שמח לעבוד|מקווה לעבוד|תמיכה/ },
  { intent: 'question', re: /\?|מה דעתך|מה אתה חושב|מה את חושבת|איך |למה |מתי |האם / },
];

export function detectIntent(text: string): Intent {
  const t = text.trim();
  for (const p of PATTERNS) if (p.re.test(t)) return p.intent;
  return 'other';
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

function handle(s: GameState, t: Politician, text: string): Reply {
  const me = s.politicians[s.player.politicianId];
  const intent = detectIntent(text);
  const tn = tone(t);
  const law = matchLaw(text);
  const fresh = (intent === 'other' || intent === 'question') ? true : once(s, t.id, intent);
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
      return { text: pick(s, ['השאלה חשובה. אשמח לדון בזה פנים אל פנים.', 'אין לי עמדה סופית. מה דעתך?', 'אני מעדיף לענות בפגישה ולא בכתב.']) };
    }
    default:
      return { text: line(s, 'other', tn) };
  }
}

/** The player writes to a politician. Returns false if the text was empty. */
export function sendChat(s: GameState, targetId: string, text: string): boolean {
  const t = s.politicians[targetId];
  const msg = text.trim().slice(0, 400);
  if (!t || !msg || t.isPlayer) return false;
  push(s, targetId, { from: 'me', text: msg });
  markRead(s, targetId);
  const key = `chat_n_${targetId}`;
  const n = (s.flags[key] ?? 0) as number;
  const sameTurn = (s.flags[`${key}_turn`] ?? -1) === s.turn;
  const count = sameTurn ? n + 1 : 1;
  s.flags[key] = count;
  s.flags[`${key}_turn`] = s.turn;
  if (count > FREE_PER_TURN) {
    push(s, targetId, { from: 'them', text: 'דיברנו כבר הרבה היום. בוא נמשיך בתור הבא.' });
    return true;
  }
  const r = handle(s, t, msg);
  push(s, targetId, { from: 'them', text: r.text, hint: r.hint });
  markRead(s, targetId);
  return true;
}

// ---------------- politicians write on their own ----------------
function proactive(s: GameState, p: Politician): string | null {
  const me = s.politicians[s.player.politicianId];
  const inGov = s.government.coalition.includes(p.partyId);
  const party = s.parties[p.partyId];
  const open = s.bills.find((b) => b.status === 'active');
  const campaign = s.campaign?.electionDay !== undefined;
  if (p.loyalty < 30) {
    return pick(s, [
      `${me.name}, אני לא מרוצה מההתנהלות כלפיי ולכן אני שוקל את צעדיי. כדאי שנדבר.`,
      inGov ? `אני מצפה להתחייבויות שניתנו. אם זה לא ישתנה, ${party?.shortName ?? 'הסיעה'} תשקול את המשך דרכה בקואליציה.` : 'אנחנו מתנגדים למדיניות שלך, ונפעל נגדה בכנסטון.',
    ]);
  }
  if (p.loyalty > 70) {
    return pick(s, [
      `${me.name}, רציתי לומר שאני מעריך את שיתוף הפעולה בינינו. אם אפשר לעזור במשהו – אני כאן.`,
      open ? `אני עוקב אחרי ${open.title}. אם צריך תמיכה שלי בהצבעה, תגיד.` : 'יש לי רעיון לשיתוף פעולה. אשמח להיפגש.',
    ]);
  }
  if (open && (party?.favoriteLaws.includes(open.lawId) || party?.hatedLaws.includes(open.lawId))) {
    const fav = party.favoriteLaws.includes(open.lawId);
    return fav ? `אני מבקש שתקדם את ${open.title}. זה חשוב לנו, ואנחנו נזכור מי עזר.` : `אני מזהיר אותך: ${party.shortName} תתנגד ל${open.title} בכל כוחה.`;
  }
  if (campaign && !inGov) return pick(s, ['הבחירות מתקרבות. אולי כדאי שנדבר על שיתוף פעולה אחרי היום שאחרי.', 'אנחנו בוחנים הסכם עודפים. תהיה פתוח לשיחה?']);
  return null;
}

/** Once per turn: a couple of politicians write to the player. */
export function chatTick(s: GameState): void {
  if (s.gameOver || s.elections.phase !== 'none') return;
  const pool = chatContacts(s).filter((p) => p.id !== s.player.politicianId);
  let sent = 0;
  for (const p of pool.sort(() => rand(s) - 0.5)) {
    if (sent >= 2) break;
    if (!chance(s, p.loyalty < 30 || p.loyalty > 70 ? 0.28 : 0.1)) continue;
    const text = proactive(s, p);
    if (!text) continue;
    push(s, p.id, { from: 'them', text, proactive: true });
    sent += 1;
    logEvent(s, '💬', `${p.name} כתב לך הודעה`, 1, 'neutral', 'chat');
  }
}
