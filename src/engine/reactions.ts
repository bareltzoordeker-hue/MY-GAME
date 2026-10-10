// What politicians say after a decision. The reaction follows the decision's real direction (security, economy, religion)
// and each speaker's real ideology: a right-wing leader does not condemn a tough security step, and a left-wing one does not praise it.
import { GROUP_POS } from './speech';
import type { GameState, GroupId, Ideology, Politician, ReactionLine } from '../types/game';
import { pick } from './rng';

type Stance = 'support' | 'oppose' | 'neutral';
interface Dir { axis: keyof Ideology; sign: 1 | -1; strength: number }

/** Which way the decision pushed the country, from how the population groups moved. */
export function decisionDirection(deltas: Partial<Record<GroupId, number>>): Dir | null {
  const score: Record<keyof Ideology, number> = { security: 0, economic: 0, religion: 0 };
  for (const [g, d] of Object.entries(deltas) as [GroupId, number][]) {
    const pos = GROUP_POS[g];
    if (!pos || !d) continue;
    for (const axis of ['security', 'economic', 'religion'] as const) score[axis] += (pos[axis] ?? 0) * d;
  }
  const axis = (Object.keys(score) as (keyof Ideology)[]).sort((a, b) => Math.abs(score[b]) - Math.abs(score[a]))[0];
  const strength = Math.abs(score[axis]);
  if (strength < 1.2) return null;
  return { axis, sign: score[axis] > 0 ? 1 : -1, strength };
}

const stanceOf = (p: Politician, d: Dir): Stance => {
  const v = p.ideology[d.axis] * d.sign;
  return v > 0.25 ? 'support' : v < -0.25 ? 'oppose' : 'neutral';
};

type Pool = Record<Stance, string[]>;
// {s} = the decision's title
const LINES: Record<string, Record<'up' | 'down', Pool>> = {
  security: {
    up: {
      support: ['יד קשה זה מה שהאויב מבין. {s} הוא צעד בכיוון הנכון.', 'סוף סוף מדיניות ביטחונית ברורה: {s}. צריך להמשיך ולהעמיק.', '{s} מחזיר הרתעה. אנחנו מברכים.', 'מי שמבין את המזרח התיכון יודע ש{s} הכרחי.'],
      oppose: ['כוח לבד לא יפתור את זה. {s} בלי אופק מדיני יוביל לסבב נוסף.', '{s} הוא מתכון למחיר דמים. מי ישלם? תושבי הפריפריה והמילואימניקים.', 'ממשלה שיודעת רק להפעיל כוח מפסידה את היום שאחרי. {s} לא יפתור כלום.', 'אנחנו לא נתנגד לביטחון, אבל {s} נעשה בלי שום תכנית ליום שאחרי.'],
      neutral: ['נבחן את {s} לפי התוצאות בשטח, לא לפי ההודעות.', 'אם {s} ייושם נכון ובלי פגיעה באזרחים, אין לנו התנגדות עקרונית.', 'נבקש תדריך בוועדת החוץ והביטחון על {s}.'],
    },
    down: {
      support: ['{s} פותח חלון הזדמנויות מדיני. מברכים על האומץ.', 'מי שרוצה ביטחון אמיתי צריך גם מהלכים מדיניים. {s} בכיוון הנכון.', 'סוף סוף מישהו מדבר על יום שאחרי: {s}.'],
      oppose: ['{s} משדר חולשה לאויב, והאויב מקשיב.', 'זו הרמת ידיים. הרתעה לא בונים ככה: {s} יעלה לנו בדם.', 'לא נשב בשקט כשמוותרים על ביטחון: {s} מסוכן.'],
      neutral: ['{s} יכול להיות מהלך נכון, אם יש גב מדיני ובדיקה מסודרת.', 'נבדוק את {s} לפני שנחליט.'],
    },
  },
  economic: {
    up: {
      support: ['{s} משחרר את המשק. כך מייצרים צמיחה ומשרות.', 'פחות רגולציה ויותר תחרות: {s} הוא בדיוק מה שהמשק צריך.', 'סוף סוף מדיניות כלכלית אחראית: {s}.'],
      oppose: ['{s} פוגע בחלשים ובמעמד הביניים, והם ישלמו על זה.', 'זו מדיניות לטובת העשירים: {s} לא ירגיש בשכר המינימום.', 'נילחם נגד {s} בכנסטון ובמחאה הציבורית.'],
      neutral: ['נבחן אם {s} באמת יוריד מחירים או רק ישפר את המאזן.', 'נעקוב אחרי ההשפעה של {s} על יוקר המחיה.'],
    },
    down: {
      support: ['סוף סוף השקעה אמיתית באנשים: {s}.', '{s} הוא מה שמדינה צריכה לעשות כשיש פערים. מברכים.', 'הציבור מחכה לצעד כזה: {s}. חבל שלקח כל כך הרבה זמן.'],
      oppose: ['{s} נראה טוב בכותרת ועולה לנו בגירעון. מי יממן?', 'הממשלה מבזבזת כסף שאין לה על {s}. הדור הבא ישלם.', 'התערבות ממשלתית כזאת, {s}, רק תעלה מחירים.'],
      neutral: ['לא ברור איך {s} ימומן. נדרוש מקור תקציבי.', 'נעקוב אחרי היישום של {s}.'],
    },
  },
  religion: {
    up: {
      support: ['{s} שומר על אופי המדינה ועל המסורת. אנחנו מברכים.', 'סוף סוף מישהו מקשיב לציבור שומר המצוות: {s}.', '{s} מחזק את הזהות היהודית של המדינה.'],
      oppose: ['{s} הוא כפייה דתית שהציבור החילוני לא ישתוק עליה.', 'מדינה מודרנית לא מכתיבה אורח חיים: {s} פוגע בחופש.', 'לא נאפשר ל{s} לעבור בלי מאבק.'],
      neutral: ['נבחן את {s} מול העקרונות של החקיקה הקיימת.', '{s} ידרוש הסברים בוועדה.'],
    },
    down: {
      support: ['סוף סוף חופש בחירה: {s}.', '{s} הוא צעד לכיוון מדינה של כל אזרחיה. מברכים.', 'הציבור החילוני מחכה לצעד כזה כבר שנים: {s}.'],
      oppose: ['{s} פוגע בצביון היהודי של המדינה, ואנחנו לא נשתוק.', 'זו פגיעה במסורת: {s} חוצה קו אדום.', 'הציבור הדתי יגיב ל{s} בכל דרך.'],
      neutral: ['נבדוק את {s} לעומק לפני שנחליט.', 'מדובר בנושא רגיש, ונשמע את כל הצדדים לגבי {s}.'],
    },
  },
};
const FAIL: Record<'support' | 'oppose', string[]> = {
  support: ['חבל ש{s} לא הצליח. זה היה צעד נכון.', 'הכיוון של {s} נכון. הביצוע נכשל, וצריך לתקן.'],
  oppose: ['{s} נכשל, כמו שהזהרנו.', 'הכישלון של {s} מוכיח שהמהלך לא נבנה כראוי.', 'מי שהתעלם מאזהרות קיבל את התוצאה: {s} נכשל.'],
};
// no clear direction: competence, money and politics
const NEUTRAL: string[] = ['הציבור יבחן את התוצאות ולא את ההודעות על {s}.', 'נעקוב אחרי היישום של {s} ונדרוש דוחות.', '{s}: כיוון סביר, והביצוע יקבע.', 'מי יממן את {s}? נדרוש מקור תקציבי.', 'ננסח שאילתה לשר על {s}.'];

const fill = (t: string, subject: string) => t.replace(/\{s\}/g, `"${subject}"`);

/** Up to three named reactions: the main rival, someone from the other side, someone from the same side. */
export function decisionReactions(s: GameState, subject: string, deltas: Partial<Record<GroupId, number>>, ok: boolean): ReactionLine[] {
  const dir = decisionDirection(deltas);
  const me = s.politicians[s.player.politicianId];
  const inGov = s.government.coalition.includes(s.player.partyId);
  const leaders = Object.values(s.parties)
    .filter((p) => p.seats > 0 && p.id !== s.player.partyId)
    .map((p) => s.politicians[p.leaderId])
    .filter((l): l is Politician => !!l && l.active && l.id !== me.id);
  if (!leaders.length) return [];
  const out: ReactionLine[] = [];
  const used = new Set<string>();
  const say = (p: Politician, st: Stance) => {
    used.add(p.id);
    const pool: string[] | undefined = !dir ? NEUTRAL : ok ? LINES[dir.axis][dir.sign > 0 ? 'up' : 'down'][st] : st === 'neutral' ? NEUTRAL : FAIL[st];
    const tone: ReactionLine['tone'] = st === 'support' ? (ok ? 'good' : 'neutral') : st === 'oppose' ? 'bad' : 'neutral';
    out.push({ icon: st === 'support' ? '👍' : st === 'oppose' ? '👎' : '🗣️', label: p.name, tone, text: fill(pick(s, pool ?? NEUTRAL), subject) });
  };
  // the rival: the PM (if the player is in opposition) or the largest opposition leader (if in government)
  const rivalId = inGov ? leaders.filter((l) => !s.government.coalition.includes(l.partyId)).sort((a, b) => s.parties[b.partyId].seats - s.parties[a.partyId].seats)[0]?.id : s.government.pmId;
  const rival = rivalId && rivalId !== me.id ? s.politicians[rivalId] : undefined;
  if (rival) say(rival, dir ? stanceOf(rival, dir) : 'neutral');
  if (dir) {
    const rated = leaders.filter((l) => !used.has(l.id)).map((l) => ({ l, v: l.ideology[dir.axis] * dir.sign }));
    const opposer = rated.filter((x) => x.v < -0.25).sort((a, b) => a.v - b.v)[0];
    const supporter = rated.filter((x) => x.v > 0.25).sort((a, b) => b.v - a.v)[0];
    if (opposer) say(opposer.l, 'oppose');
    if (supporter) say(supporter.l, 'support');
  } else if (out.length < 2) {
    const other = leaders.find((l) => !used.has(l.id));
    if (other) say(other, 'neutral');
  }
  return out.slice(0, 3);
}
