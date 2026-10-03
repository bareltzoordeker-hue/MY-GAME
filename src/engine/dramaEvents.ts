// ============================================================
// Dramatic events: dilemmas that hit the player almost every turn.
// Weights are driven by the state (tension, role, coalition), so the
// absurd stuff still lands on real systems.
// ============================================================
import { chance, pick, rand } from './rng';
import type { BudgetCategory, DramaEvent, Effects, GameState, GroupId, Politician } from '../types/game';
import { clamp, deficitPct } from '../utils';
import { GROUP_BY_ID, CATEGORY_BY_ID, MAJORITY } from '../data/world';
import { applyDecision } from './decisions';
import { applyEffects, remember } from './effects';
import { startCrisis } from './crises';
import { callEarlyElections } from './elections';
import { coalitionSeats } from './polls';
import { isPartyLeader, isPM, playerMinistry } from './roles';

export interface Outcome { text: string; tone: 'good' | 'bad' | 'neutral'; headline?: string }
export interface DramaOptionDef { id: string; label: string; hint?: string; allow?: (s: GameState) => boolean; resolve: (s: GameState, ev: DramaEvent) => Outcome }
export interface DramaDef {
  id: string;
  level: DramaEvent['level'];
  weight: (s: GameState) => number;
  make: (s: GameState) => Pick<DramaEvent, 'title' | 'text' | 'icon'> & Partial<Pick<DramaEvent, 'fromId' | 'partyId' | 'vars'>>;
  options: DramaOptionDef[];
}

// ---------- helpers ----------
/** Who may take a national decision: the PM, or the minister responsible for one of these portfolios. */
export function holds(s: GameState, ...ministries: string[]): boolean {
  if (isPM(s)) return true;
  const m = playerMinistry(s);
  if (!m || s.player.role !== 'minister') return false;
  return (m.origins ?? [m.id]).some((id) => ministries.includes(id));
}
const me = (s: GameState) => s.politicians[s.player.politicianId];
const fx = (s: GameState, e: Effects) => applyDecision(s, e);
const ministers = (s: GameState) => Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && p.ministryId);
const pol = (s: GameState, ev: DramaEvent) => s.politicians[ev.fromId ?? ''] as Politician | undefined;
const ok = (text: string, headline?: string): Outcome => ({ text, tone: 'good', headline });
const bad = (text: string, headline?: string): Outcome => ({ text, tone: 'bad', headline });
const meh = (text: string, headline?: string): Outcome => ({ text, tone: 'neutral', headline });
/** How heated the country is: 0 calm … ~1 boiling. Extreme events need heat. */
export function tension(s: GameState): number {
  return clamp((50 - s.government.approval) / 40 + (50 - s.government.stability) / 60 + Math.max(0, deficitPct(s) - 3.5) / 5 + s.crises.length * 0.15, 0, 1.5);
}
function angriestGroup(s: GameState): GroupId {
  return Object.values(s.population.groups).sort((a, b) => a.satisfaction - b.satisfaction)[0].id;
}
const GROUP_CAT: Partial<Record<GroupId, BudgetCategory>> = {
  youth: 'housing', families: 'education', lowIncome: 'welfare', retirees: 'welfare', elderly: 'health', students: 'education',
  reservists: 'defense', soldiers: 'defense', periphery: 'transport', haredim: 'education', publicSector: 'government', settlers: 'housing',
};

export const DRAMAS: DramaDef[] = [
  // ======================= NORMAL (cynical daily politics) =======================
  {
    id: 'sushi', level: 'normal',
    weight: (s) => (ministers(s).length ? 1 : 0) + s.crises.length * 0.8,
    make: (s) => {
      const p = pick(s, ministers(s));
      return { icon: '🍣', title: 'סושי ב-1,800 שקל', fromId: p.id, text: `${p.name} צולם במסעדת יוקרה, מזמין "מגש הטעימות של השף" בזמן ש${s.crises[0]?.title ?? 'חצי מדינה מחכה לאוטובוס'}. הקבלה כבר ברשת.` };
    },
    options: [
      { id: 'back', label: 'לגבות אותו', hint: 'הוא יאהב אותך. הציבור – פחות', resolve: (s, ev) => { remember(s, ev.fromId!, 'favor', 'גיבית אותו בפרשת הסושי', 12); fx(s, { playerPopularity: -3, groups: { lowIncome: -2, middleClass: -1 } }); return bad('"אדם צריך לאכול", אמרת. הציבור שאל: מה בדיוק?', `${pol(s, ev)?.name} נשאר. גם הוואסאבי`); } },
      { id: 'condemn', label: 'לגנות בפומבי', hint: 'פופולריות עכשיו, אויב לתמיד', resolve: (s, ev) => { remember(s, ev.fromId!, 'insult', 'גינה אותי בפרשת הסושי', -18); fx(s, { playerPopularity: 3, playerReputation: 2 }); return ok('"זה לא מקובל!", אמרת, ומיד הזמנת פיצה משפחתית. בהנחה.'); } },
      { id: 'blame', label: 'להאשים את המסעדה', hint: 'אבסורד שעשוי לעבוד', resolve: (s) => { const w = chance(s, 0.5); fx(s, { playerPopularity: w ? 2 : -2 }); return w ? ok('משרד הבריאות פשט על המסעדה. "ביקורת שגרתית", כמובן.', 'מסעדת הסושי נסגרה מסיבות תברואתיות מפתיעות') : bad('הבעלים פרסם שהשר ביקש "הנחת חבר כנסטון". אאוץ׳.'); } },
    ],
  },
  {
    id: 'whatsapp_leak', level: 'normal',
    weight: (s) => 0.8 + (100 - s.parties[s.player.partyId].cohesion) / 80,
    make: () => ({ icon: '💬', title: 'קבוצת הווטסאפ דלפה', text: 'צילומי מסך מקבוצת "הנהגה – סודי ביותר 🤫" מסתובבים ברשת. בהם אתה כותב על אחד השותפים: "הוא חכם כמו כיסא פלסטיק".' }),
    options: [
      { id: 'deny', label: 'להכחיש: "זה פוטושופ"', hint: '50% שזה יעבוד', resolve: (s) => (chance(s, 0.5) ? (fx(s, { playerPopularity: 1 }), ok('מומחה טען שהפונט חשוד. הסיפור מת.')) : (fx(s, { playerPopularity: -5, playerReputation: -3 }), bad('פורסמה הקלטה קולית. הפונט היה תקין.', 'הוקלט: "חכם כמו כיסא פלסטיק"'))) },
      { id: 'laugh', label: 'להודות ולצחוק על עצמך', hint: 'דורש מוניטין', resolve: (s) => (s.player.reputation > 42 ? (fx(s, { playerPopularity: 4 }), ok('"גם כיסא פלסטיק צריך אהבה". הציבור צחק. השותף פחות.')) : (fx(s, { playerPopularity: -3 }), bad('ניסית להיות מצחיק. התקשורת החליטה שלא.'))) },
      { id: 'hunt', label: 'לצוד את המדליף', hint: '-5 הון, מישהו ייפגע', resolve: (s) => { s.player.politicalCapital = clamp(s.player.politicalCapital - 5); const sus = pick(s, s.parties[s.player.partyId].memberIds.filter((id) => id !== s.player.politicianId)); if (sus) remember(s, sus, 'insult', 'נחשד בהדלפה', -15); fx(s, { stability: -2, playerPopularity: 1 }); return meh(`${s.politicians[sus]?.name ?? 'מישהו'} נחשד. הוא נשבע בחתול שלו שזה לא הוא.`); } },
    ],
  },
  {
    id: 'billionaire', level: 'normal',
    weight: (s) => 0.7 + (deficitPct(s) > 4 ? 0.6 : 0),
    make: () => ({ icon: '🛥️', title: 'מיליארדר עם הצעה', text: 'איל הון "שמעדיף לא להזכיר את שמו" (כולם יודעים מי) מציע ₪3 מיליארד לפרויקט לאומי. תמורה: "תיקון טכני קטן" בחוק ההגבלים. מאוד קטן. כמעט בלתי נראה.' }),
    options: [
      { id: 'take', allow: (s) => holds(s, 'finance'), label: 'לקחת את הכסף', hint: '+₪3B, מוניטין ↓, סיכון לפרשה', resolve: (s) => { fx(s, { revenue: 3, playerReputation: -8, groups: { highIncome: 3, left: -4 } }); if (chance(s, 0.45)) { startCrisis(s, 'scandal', 2); return bad('שלושה חודשים אחר כך: "פרשת היאכטה". חקירה נפתחה.', 'פרשת היאכטה: חשד לתיקון חוק תמורת תרומה'); } return meh('הכסף הגיע. ה"תיקון הטכני" עבר בשלוש בלילה. אף אחד לא שם לב. בינתיים.'); } },
      { id: 'refuse', label: 'לסרב בנימוס', resolve: (s) => { fx(s, { playerReputation: 3 }); return ok('סירבת. הוא שלח עוגת שוקולד עם פתק: "עוד נדבר".'); } },
      { id: 'leak', label: 'להדליף את ההצעה לתקשורת', hint: 'פופולריות ↑, יש לך אויב עם עיתון', resolve: (s) => { fx(s, { playerPopularity: 4, playerReputation: 3, partyMomentum: { [s.player.partyId]: -2 } }); return ok('כותרת ענק: "סירב למיליארדים". העיתון של המיליארדר מתחיל להשמיץ אותך מחר.', 'חשיפה: מיליארדר ניסה לקנות תיקון חוק'); } },
    ],
  },
  {
    id: 'wedding_dance', level: 'normal',
    weight: () => 0.8,
    make: () => ({ icon: '💃', title: 'הריקוד שהפך לוויראלי', text: 'סרטון שלך רוקד "מקרנה" בחתונה של בן דוד של יועץ התקשורת עבר 4 מיליון צפיות. תגובה פופולרית: "זה מסביר הרבה על התקציב".' }),
    options: [
      { id: 'tiktok', label: 'לרקוד שוב בטיקטוק', hint: 'צעירים ↑ מוניטין ↓', resolve: (s) => { fx(s, { groups: { youth: 4, students: 2, elderly: -1 }, playerPopularity: 3, playerReputation: -3 }); return ok('#מקרנה_לאומית במקום הראשון. היועץ מבקש להעלות לו משכורת.'); } },
      { id: 'sorry', label: 'להתנצל ב"כבוד הממלכתי"', resolve: (s) => { fx(s, { playerPopularity: -1, playerReputation: 1 }); return meh('נאום רציני על "כבוד המשרה". 11 צפיות. 9 מהן של אמא שלך.'); } },
      { id: 'campaign', label: 'להפוך את זה לסלוגן', hint: 'רק למנהיגי מפלגות', resolve: (s) => { if (isPartyLeader(s)) { s.elections.campaignBoost[s.player.partyId] = (s.elections.campaignBoost[s.player.partyId] ?? 0) + 3; return ok('"רוקדים לעתיד!" – השלטים כבר בדפוס.'); } fx(s, { playerPopularity: 2 }); return meh('המפלגה דחתה את הסלוגן. אבל הסטיקרים כבר הודפסו.'); } },
    ],
  },
  {
    id: 'salad_war', level: 'normal',
    weight: () => 0.5,
    make: () => ({ icon: '🥗', title: 'מלחמת הסלטים במזנון', text: 'הנהלת הכנסטון החליפה את החומוס בממרח עדשים "בריא ובר-קיימא". 40 ח״כים חתמו על עצומה. שניים מאיימים בשביתת רעב (חלקית, עד ארוחת הצהריים).' }),
    options: [
      { id: 'hummus', label: 'להחזיר את החומוס', resolve: (s) => { fx(s, { playerPopularity: 2, groups: { right: 1, periphery: 1 } }); return ok('החומוס חזר. 40 ח״כים הצביעו לראשונה פה אחד על משהו.', 'הכנסטון אחוד: החומוס חוזר'); } },
      { id: 'lentils', label: 'לתמוך בעדשים', resolve: (s) => { fx(s, { groups: { left: 2, youth: 1, right: -2 } }); return meh('"עדשים זה עתיד". הימין הכריז על העדשים כ"אג׳נדה".'); } },
      { id: 'committee', label: 'להקים ועדה ציבורית', hint: '-2 הון', resolve: (s) => { s.player.politicalCapital = clamp(s.player.politicalCapital - 2); return meh('ועדת "חומוס-עדשים" תגיש מסקנות בעוד שלוש שנים. כרגע: טחינה.', 'הוקמה ועדה ציבורית לבחינת סוגיית הממרחים'); } },
    ],
  },
  {
    id: 'vegas_mk', level: 'normal',
    weight: (s) => (isPM(s) && s.bills.some((b) => b.status === 'active' && b.isGovernment) ? 1.1 : 0),
    make: (s) => {
      const p = pick(s, Object.values(s.politicians).filter((x) => x.active && !x.isPlayer && s.government.coalition.includes(x.partyId) && !x.ministryId));
      return { icon: '🎰', title: 'ח״כ נעלם בלאס וגאס', fromId: p?.id, text: `${p?.name ?? 'ח״כ קואליציה'} טס ל"כנס בינלאומי לשקיפות" בלאס וגאס. הוא לא עונה. ההצבעה על החוק שלך – בעוד יומיים, והרוב תלוי בו.` };
    },
    options: [
      { id: 'fly', label: 'להטיס אותו בחזרה במטוס פרטי', hint: '₪20 מיליון, ציבור כועס', resolve: (s) => { fx(s, { oneOffCost: 0.02, stability: 2, groups: { middleClass: -2 } }); return meh('הוא נחת, הצביע, ונרדם באמצע. ההצבעה עברה. חשבונית המטוס – בדרך לתקשורת.', 'מטוס פרטי ב-₪20 מיליון הביא ח״כ להצבעה'); } },
      { id: 'pair', label: 'לסגור "קיזוז" עם האופוזיציה', hint: '-6 הון', resolve: (s) => { s.player.politicalCapital = clamp(s.player.politicalCapital - 6); return ok('האופוזיציה הסכימה לקזז. בתמורה: יום חופש לכנסטון ביום ההולדת של ראש האופוזיציה.'); } },
      { id: 'lose', label: 'לוותר', hint: 'החוק נחלש מאוד', resolve: (s) => { for (const b of s.bills.filter((x) => x.status === 'active' && x.isGovernment)) b.push -= 25; return bad('בלי הקול שלו, החוק נראה רע. הוא בינתיים העלה סטורי מהקזינו.'); } },
    ],
  },
  {
    id: 'mayor_tractor', level: 'normal',
    weight: (s) => 0.6 + Math.max(0, 50 - s.population.groups.periphery.satisfaction) / 25,
    make: () => ({ icon: '🚜', title: 'ראש עיר על טרקטור', text: 'ראש עיריית "מצפה-שכחו-אותנו" חסם את הכביש הראשי עם טרקטור. "לא אזוז עד שתגיע הרכבת. או לפחות אוטובוס. או סתם מישהו מהממשלה".' }),
    options: [
      { id: 'pay', allow: (s) => holds(s, 'infrastructure', 'interior', 'transport'), label: 'לתת לו ₪500 מיליון', hint: 'פריפריה ↑, תקדים מסוכן', resolve: (s) => { fx(s, { budget: { infrastructure: 0.5 }, groups: { periphery: 4, center: -1 }, regionInvestment: { negev: 8 } }); s.flags.tractor_precedent = (s.flags.tractor_precedent ?? 0) + 1; return ok('הטרקטור זז. מחר בבוקר: 14 ראשי ערים הזמינו טרקטורים.', 'גל טרקטורים: ראשי ערים מגלים שיטה חדשה'); } },
      { id: 'police', allow: (s) => holds(s, 'police'), label: 'לשלוח משטרה', resolve: (s) => { fx(s, { groups: { periphery: -5, right: 1 } }); return bad('הטרקטור נגרר. התמונות של ראש העיר נגרר אחריו – לכל המהדורות.'); } },
      { id: 'visit', label: 'לנסוע אליו בעצמך', hint: '-4 הון, פופולריות ↑', resolve: (s) => { s.player.politicalCapital = clamp(s.player.politicalCapital - 4); fx(s, { playerPopularity: 3, groups: { periphery: 2 } }); return ok('ישבתם על הטרקטור, אכלתם בורקס, הבטחת "לבחון". הוא בכה. גם המצלמות.'); } },
    ],
  },
  {
    id: 'podcast', level: 'normal',
    weight: () => 0.7,
    make: () => ({ icon: '🎧', title: 'הזמנה לפודקאסט הכי גדול', text: '"חיים וכאלה עם עמית" – 3 שעות של שיחה, בלי עריכה, עם מנחה שאוכל גרעינים לאורך כל הפרק.' }),
    options: [
      { id: 'go', label: 'ללכת. מה כבר יכול לקרות?', hint: '60% הצלחה גדולה', resolve: (s) => (rand(s) < 0.45 + s.player.reputation / 300 ? (fx(s, { playerPopularity: 7, groups: { youth: 3 } }), ok('הקטע שבו הסברת את הגירעון עם גרעינים – הפך למם לאומי.', 'הפרק עם המנחה והגרעינים שבר שיא')) : (fx(s, { playerPopularity: -6 }), bad('בשעה השנייה אמרת "אני לא בטוח מה זה אינפלציה". בשעה השלישית ניסית להסביר.'))) },
      { id: 'spokes', label: 'לשלוח את הדובר', resolve: (s) => { fx(s, { playerPopularity: -1 }); return meh('הדובר דיבר 3 שעות ולא אמר כלום. מקצועי מאוד.'); } },
      { id: 'no', label: 'לסרב', resolve: () => meh('המנחה פתח את הפרק ב"סירב להגיע. מעניין למה". 2 מיליון האזנות.') },
    ],
  },
  {
    id: 'grandson_barmitzva', level: 'normal',
    weight: (s) => (isPM(s) && s.government.coalition.length > 1 ? 0.9 : 0),
    make: (s) => {
      const pid = pick(s, s.government.coalition.filter((id) => id !== s.player.partyId));
      const l = s.politicians[s.parties[pid].leaderId];
      return { icon: '🎁', title: 'בר מצווה לנכד', fromId: l?.id, partyId: pid, text: `${l?.name} חוגג בר מצווה לנכד ב"אולם קיסר". 1,200 מוזמנים. ברור לכולם שמצופה ממך "מתנה משמעותית". לא, הוא לא מתכוון למעטפה.` };
    },
    options: [
      { id: 'gift', label: 'מתנה קואליציונית: ₪400 מיליון למוסדות שלו', hint: 'נאמנות ↑↑ ציבור ↓', resolve: (s, ev) => { const party = s.parties[ev.partyId!]; const cat = (party.id === 'kugel' ? 'education' : 'welfare') as BudgetCategory; fx(s, { budget: { [cat]: 0.4 }, groups: { center: -2, secular: -1 }, stability: 4 }); remember(s, ev.fromId!, 'favor', 'מתנה לבר המצווה', 18); return meh('"איזה ראש ממשלה!", נאם הסבא. המיקרופון היה פתוח.', `"מתנת בר מצווה" של ₪400 מיליון למוסדות ${party.shortName}`); } },
      { id: 'card', label: 'כרטיס ברכה וספר תהילים', resolve: (s, ev) => { remember(s, ev.fromId!, 'insult', 'כרטיס ברכה. כרטיס!', -10); return bad('הכרטיס הוקרא בקול מהבמה. בטון מעליב.'); } },
      { id: 'sing', label: 'להגיע ולשיר עם הלהקה', hint: '-3 הון', resolve: (s, ev) => { s.player.politicalCapital = clamp(s.player.politicalCapital - 3); remember(s, ev.fromId!, 'favor', 'הגיע ושר', 8); fx(s, { playerPopularity: 1 }); return ok('שרת "יום הולדת שמח" במקום "סימן טוב". אף אחד לא תיקן אותך. מאהבה.'); } },
    ],
  },
  {
    id: 'goat', level: 'normal',
    weight: (s) => (s.government.coalition.includes(s.player.partyId) ? 0.7 : 0),
    make: (s) => {
      const opp = Object.values(s.parties).filter((p) => !s.government.coalition.includes(p.id) && p.seats > 0).sort((a, b) => b.seats - a.seats)[0];
      return { icon: '🐐', title: 'עז במליאה', partyId: opp?.id, text: `ראש ${opp?.name ?? 'האופוזיציה'} הכניס עז לאולם המליאה. "היא מייצגת את הממשלה: אוכלת הכול ולא מייצרת כלום". העז אכלה את הצעת התקציב.` };
    },
    options: [
      { id: 'laugh', label: 'לצחוק ולהמשיך', resolve: (s) => { fx(s, { playerPopularity: 2 }); return ok('אמרת "לפחות העז קראה את ההצעה". מחיאות כפיים, גם מהאופוזיציה.'); } },
      { id: 'ethics', label: 'תלונה לוועדת האתיקה', hint: '-2 הון', resolve: (s, ev) => { s.player.politicalCapital = clamp(s.player.politicalCapital - 2); if (ev.partyId) applyEffects(s, { partyMomentum: { [ev.partyId]: -2 } }); return meh('ועדת האתיקה השעתה את העז ליומיים.', 'תקדים: עז הושעתה מהכנסטון'); } },
      { id: 'two', label: 'להביא שתי עזים מחר', hint: 'פופולריות ↑ מוניטין ↓↓', resolve: (s) => { fx(s, { playerPopularity: 4, playerReputation: -5 }); return meh('מליאת הכנסטון: 3 עזים, 41 ח״כים, אפס החלטות. יום רגיל.', 'מרוץ העזים בכנסטון מסלים'); } },
    ],
  },
  {
    id: 'fake_poll', level: 'normal',
    weight: (s) => (isPartyLeader(s) ? 0.7 : 0),
    make: (s) => ({ icon: '📉', title: 'סקר מזויף', text: `"סקר" שמראה את ${s.parties[s.player.partyId].name} ב-2 מנדטים מסתובב בכל קבוצות הווטסאפ. המקור: "חבר של בן דוד שעובד בסקרים".` }),
    options: [
      { id: 'ignore', label: 'להתעלם', resolve: (s) => { applyEffects(s, { partyMomentum: { [s.player.partyId]: -2 } }); return meh('אמא שלך שלחה לך את הסקר. שלוש פעמים.'); } },
      { id: 'counter', label: 'לפרסם סקר נגדי', hint: '₪1 מיליון מקופת המפלגה', resolve: (s) => { s.parties[s.player.partyId].funds -= 1; applyEffects(s, { partyMomentum: { [s.player.partyId]: 3 } }); return ok('הסקר שלכם הראה 34 מנדטים. גם הוא, כנראה, מזויף. אבל שלך.'); } },
      { id: 'sue', label: 'לתבוע את "הבן דוד"', hint: '-3 הון', resolve: (s) => { s.player.politicalCapital = clamp(s.player.politicalCapital - 3); fx(s, { playerPopularity: -1 }); return bad('הבן דוד התגלה כבוט. הבוט נתן ראיון לערוץ 12.5.'); } },
    ],
  },
  {
    id: 'heatwave', level: 'normal',
    weight: (s) => (s.date.month >= 5 && s.date.month <= 9 ? 1.2 : 0.1),
    make: () => ({ icon: '🥵', title: 'גל חום של 47 מעלות', text: 'המזגן בלשכה שלך הוא היחיד שעובד ברחוב. מישהו העלה סרטון של התור מחוץ לחלון.' }),
    options: [
      { id: 'open', label: 'לפתוח את הלשכה לציבור', resolve: (s) => { fx(s, { playerPopularity: 4, groups: { elderly: 2 } }); return ok('180 אזרחים, 3 כלבים ופעיל אופוזיציה אחד ישנו אצלך. מגניב.', '"הלשכה הממוזגת": הפוליטיקאי שפתח את הדלתות'); } },
      { id: 'blame', label: 'להאשים את משרד האנרגיה', resolve: (s) => { const m = s.government.ministries.find((x) => x.id === 'energy'); if (m?.ministerId && m.ministerId !== s.player.politicianId) remember(s, m.ministerId, 'insult', 'האשים אותי בגל החום', -10); fx(s, { playerPopularity: 1 }); return meh('"השמש היא אחריות משרד האנרגיה". שר האנרגיה: "השמש היא אחריות השמש".'); } },
      { id: 'ignore', label: 'להוריד את התריס', resolve: (s) => { fx(s, { playerPopularity: -3 }); return bad('הצלם תפס אותך מוריד את התריס. התמונה תהיה על כרזות האופוזיציה.'); } },
    ],
  },
  {
    id: 'unicorn', level: 'normal',
    weight: (s) => (s.economy.growth > 2.5 ? 0.7 : 0.2),
    make: () => ({ icon: '🦄', title: 'אקזיט של 20 מיליארד', text: 'סטארטאפ צבריאני שמפתח "בלוקצ׳יין לחומוס" נמכר לענקית אמריקאית. המייסדים, בני 26, כבר בדרך לליסבון.' }),
    options: [
      { id: 'tax', allow: (s) => holds(s, 'finance'), label: 'מס אקזיטים מיוחד', hint: 'הכנסות ↑ הייטק ↓', resolve: (s) => { if (!isPM(s)) { fx(s, { playerPopularity: 1 }); return meh('הצעת. אף אחד לא שאל אותך.'); } fx(s, { revenue: 4, groups: { highIncome: -4, lowIncome: 2 }, economy: { growth: -0.1 } }); return meh('₪4 מיליארד לקופה. 30 סטארטאפים עברו לקפריסין "למטרות מזג אוויר".'); } },
      { id: 'credit', label: 'לקחת קרדיט', resolve: (s) => { fx(s, { playerPopularity: 3 }); return ok('"זה בזכות המדיניות שלי". המייסדים: "מי זה?".', 'הפוליטיקאים מתחרים על הקרדיט לאקזיט'); } },
      { id: 'selfie', label: 'להצטלם עם המייסדים', resolve: (s) => { fx(s, { groups: { youth: 2 }, playerPopularity: 1 }); return meh('הסלפי עלה. המייסדים מצמצמים עיניים. אחד מהם לובש קפוצ׳ון של מפלגה אחרת.'); } },
    ],
  },
  {
    id: 'cablecar_shabbat', level: 'normal',
    weight: () => 0.5,
    make: () => ({ icon: '🚡', title: 'האם הרכבל עובד בשבת?', text: 'רכבל ירושלמה – שאף אחד לא נוסע בו – הפך למוקד המשבר הדתי-חילוני הגדול של העשור.' }),
    options: [
      { id: 'no', allow: (s) => holds(s, 'transport', 'interior'), label: 'לא בשבת', resolve: (s) => { fx(s, { groups: { haredim: 4, religious: 2, secular: -4 } }); return meh('הרכבל עומד בשבת. גם ביום ראשון, אגב, בגלל תקלה.'); } },
      { id: 'yes', allow: (s) => holds(s, 'transport', 'interior'), label: 'כן בשבת', resolve: (s) => { fx(s, { groups: { secular: 4, youth: 2, haredim: -5 } }); return meh('הרכבל פעל בשבת. נסעו בו 4 תיירים ועיתונאי.', 'ההיסטוריה נכתבה: 4 נוסעים ברכבל בשבת'); } },
      { id: 'committee', allow: (s) => holds(s, 'transport', 'interior'), label: 'ועדה משותפת לרבנים ומהנדסים', hint: '-2 הון', resolve: (s) => { s.player.politicalCapital = clamp(s.player.politicalCapital - 2); fx(s, { groups: { haredim: -1, secular: -1 } }); return meh('הוועדה המליצה על רכבל ש"נוסע לאט מאוד בשבת". כולם כועסים באותה מידה. הוגן.'); } },
    ],
  },
  {
    id: 'minister_gaffe', level: 'normal',
    weight: (s) => (ministers(s).length ? 0.8 : 0),
    make: (s) => {
      const p = pick(s, ministers(s));
      const line = pick(s, ['"הפקקים הם סימן לכלכלה חזקה"', '"מי שרעב שיאכל קוטג׳ במבצע"', '"האינפלציה זה עניין של גישה"', '"הפריפריה? זה ליד אילתיה, לא?"', '"אני לא קורא דוחות, אני מרגיש אותם"']);
      return { icon: '🎙️', title: 'פליטת פה בשידור חי', fromId: p.id, text: `${p.name} אמר בראיון: ${line}. המגישה פשוט שתקה 8 שניות.` };
    },
    options: [
      { id: 'defend', label: '"הוצא מהקשרו"', resolve: (s, ev) => { remember(s, ev.fromId!, 'favor', 'גיבה אותי', 8); fx(s, { playerPopularity: -2, playerReputation: -2 }); return bad('הקשר מלא פורסם. הוא היה גרוע יותר.'); } },
      { id: 'distance', label: 'להסתייג', resolve: (s, ev) => { remember(s, ev.fromId!, 'insult', 'הסתייג ממני', -8); fx(s, { playerReputation: 2 }); return ok('"זו לא עמדת הממשלה". הוא כבר הקליט התנצלות. עם אותה פליטה.'); } },
      { id: 'meme', label: 'להפוך את זה לבדיחה', resolve: (s) => { fx(s, { playerPopularity: 2, groups: { youth: 2 } }); return meh('ציוץ אחד שלך עם אימוג׳י של קוטג׳ – 200 אלף לייקים. הקואליציה פחות צוחקת.'); } },
    ],
  },
  {
    id: 'rival_bloc', level: 'breaking',
    weight: (s) => (isPartyLeader(s) && s.turn > 3 ? 0.5 : 0),
    make: (s) => {
      const others = Object.values(s.parties).filter((p) => p.id !== s.player.partyId && p.seats > 0 && !s.alliances.some((a) => a.partyId === p.id));
      const a = others.sort((x, y) => y.seats - x.seats)[0];
      const b = others.filter((p) => p.id !== a?.id).sort((x, y) => Math.abs(x.ideology.economic - (a?.ideology.economic ?? 0)) - Math.abs(y.ideology.economic - (a?.ideology.economic ?? 0)))[0];
      return { icon: '🤝', title: 'גוש חדש נגדך', partyId: a?.id, vars: { other: b?.id ?? '' }, text: `${a?.name} ו${b?.name} הודיעו על "ברית אסטרטגית לשחרור המדינה ממך". מסיבת עיתונאים משותפת, חיבוקים מביכים, אפס תוכנית.` };
    },
    options: [
      { id: 'counter', label: 'להציע ברית למפלגה השנייה', hint: '-8 הון, 50%', resolve: (s, ev) => { s.player.politicalCapital = clamp(s.player.politicalCapital - 8); const other = String(ev.vars.other); if (other && chance(s, 0.5)) { s.alliances.push({ partyId: other, kind: 'votes', strength: 45, since: s.turn, demand: 'פירוק הגוש היריב' }); return ok(`${s.parties[other].name} עזבה את הגוש שעה אחרי ההכרזה. שיא עולמי.`, 'הגוש החדש התפרק אחרי 58 דקות'); } applyEffects(s, { partyMomentum: { [ev.partyId!]: 4, [other]: 3 } }); return bad('הם סירבו, והדליפו את ההצעה. הגוש רק התחזק.'); } },
      { id: 'mock', label: 'ללעוג: "ברית הכישלונות"', resolve: (s, ev) => { applyEffects(s, { partyMomentum: { [ev.partyId!]: 3, [String(ev.vars.other)]: 2, [s.player.partyId]: 1 } }); fx(s, { playerPopularity: 2 }); return meh('הכינוי תפס. גם הגוש תפס – 3 מנדטים בסקר.'); } },
      { id: 'ignore', label: 'להתעלם בהפגנתיות', resolve: (s, ev) => { applyEffects(s, { partyMomentum: { [ev.partyId!]: 4, [String(ev.vars.other)]: 3 } }); return bad('התעלמת. הם לא. הסקר הבא: מהפך?'); } },
    ],
  },

  // ======================= EXTREME (BREAKING) =======================
  {
    id: 'market_crash', level: 'extreme',
    weight: (s) => (s.flags.drama_crash_cd ?? 0) > s.turn ? 0 : 0.12 + (deficitPct(s) > 4.5 ? 0.35 : 0) + (s.economy.growth < 1.2 ? 0.3 : 0) + tension(s) * 0.15,
    make: () => ({ icon: '📉', title: 'קריסה בבורסה: -18% ביום אחד', text: 'הבורסה של צבריה צנחה 18%. "יום שני השחור-כחול". השקל מתרסק, המשקיעים בורחים, ובקבוצת הווטסאפ של ההייטקיסטים מישהו כתב רק "😶".' }),
    options: [
      { id: 'bailout', allow: (s) => holds(s, 'finance'), label: 'חבילת חילוץ של ₪15 מיליארד', hint: 'חוב ↑↑, הכלכלה נבלמת', resolve: (s) => { s.flags.drama_crash_cd = s.turn + 12; fx(s, { oneOffCost: 15, economy: { growth: -0.3, unemployment: 0.2 }, groups: { highIncome: 2, lowIncome: -3 } }); return meh('השוק התייצב. החוב זינק. מישהו יספר לנכדים שלנו.', 'הממשלה מזרימה ₪15 מיליארד לעצור את הקריסה'); } },
      { id: 'nothing', allow: (s) => holds(s, 'finance'), label: '"השוק יתקן את עצמו"', hint: 'מיתון אפשרי', resolve: (s) => { s.flags.drama_crash_cd = s.turn + 12; fx(s, { economy: { growth: -1.8, unemployment: 1, inflation: -0.3 }, groups: { highIncome: -6, middleClass: -4, youth: -3 } }); startCrisis(s, 'layoffs', 3); return bad('השוק תיקן את עצמו – ישר לתוך מיתון. גל פיטורים בדרך.', 'מיתון: הממשלה בחרה לא להתערב'); } },
      { id: 'blame', label: 'להאשים את האופוזיציה ואת "גורמים זרים"', hint: 'פופולריות קצרה, כלכלה סובלת', resolve: (s) => { s.flags.drama_crash_cd = s.turn + 12; fx(s, { economy: { growth: -1.2, unemployment: 0.6 }, playerPopularity: 2, playerReputation: -6, groups: { right: 2, left: -4, highIncome: -4 } }); return meh('הבסיס אהב. סוכנויות הדירוג – פחות.', '"גורמים זרים" הואשמו בקריסה. הגורמים הזרים מכחישים'); } },
    ],
  },
  {
    id: 'general_strike', level: 'extreme',
    weight: (s) => (s.flags.drama_strike_cd ?? 0) > s.turn ? 0 : 0.08 + Math.max(0, 48 - s.population.groups.publicSector.satisfaction) / 40 + (s.economy.inflation > 4 ? 0.25 : 0),
    make: () => ({ icon: '🛑', title: 'שביתה כללית!', text: '"ההסתדרות של כולם" השביתה את המדינה: נמלים, בתי חולים, רכבות, בנקים – ואפילו המזנון בכנסטון. היו״ר הודיע: "אנחנו לא נשבור. רק את הכלכלה".' }),
    options: [
      { id: 'cave', allow: (s) => holds(s), label: 'להיכנע לדרישות', hint: 'עובדי ציבור ↑↑, גירעון ↑', resolve: (s) => { s.flags.drama_strike_cd = s.turn + 10; fx(s, { budget: { welfare: 2, education: 1.5, health: 1.5, government: 1 }, groups: { publicSector: 10, lowIncome: 2, highIncome: -2 } }); return meh('הסכם קיבוצי חדש. היו״ר יצא עם חיוך ועם שלוש מכוניות צמודות חדשות.', 'השביתה הסתיימה: הממשלה נכנעה'); } },
      { id: 'orders', allow: (s) => holds(s), label: 'צווי ריתוק', hint: '-15 הון, 60% לשבור', resolve: (s) => { s.flags.drama_strike_cd = s.turn + 10; s.player.politicalCapital = clamp(s.player.politicalCapital - 15); if (chance(s, 0.6)) { fx(s, { groups: { publicSector: -8, highIncome: 3, right: 2 }, playerReputation: 3 }); return ok('בית הדין לעבודה אישר. המדינה חזרה לעבוד. הוועדים לא ישכחו.', 'צווי ריתוק שברו את השביתה'); } fx(s, { groups: { publicSector: -10 }, economy: { growth: -0.8 }, stability: -8 }); return bad('העובדים התעלמו מהצווים. התמונות מהנמל הריק – בכל העולם.'); } },
      { id: 'wait', allow: (s) => holds(s), label: 'לחכות שיתעייפו', hint: 'הכלכלה משלמת', resolve: (s) => { s.flags.drama_strike_cd = s.turn + 10; fx(s, { economy: { growth: -1, unemployment: 0.3 }, groups: { families: -3, employees: -3, publicSector: -3 }, playerPopularity: -4 }); startCrisis(s, 'transport_strike', 2); return bad('שבועיים בלי רכבות. ההורים מאמינים שאתה אישית אחראי. הם צודקים.'); } },
    ],
  },
  {
    id: 'siege', level: 'extreme',
    weight: (s) => (s.flags.drama_siege_cd ?? 0) > s.turn ? 0 : Math.max(0, tension(s) - 0.35) * 0.9,
    make: (s) => {
      const g = angriestGroup(s);
      return { icon: '🔥', title: 'מאות אלפים מקיפים את הכנסטון', vars: { group: g }, text: `${GROUP_BY_ID[g].emoji} ${GROUP_BY_ID[g].name} יצאו לרחובות. צמתים חסומים, תופים, שלט ענק עם הפרצוף שלך וקרניים. "לא נזוז עד שיקשיבו לנו!"` };
    },
    options: [
      { id: 'speech', label: 'לצאת אליהם ולנאום', hint: 'הימור: +10 או -10', resolve: (s, ev) => { s.flags.drama_siege_cd = s.turn + 8; const g = String(ev.vars.group) as GroupId; if (rand(s) < 0.4 + me(s).popularity / 200 + s.player.reputation / 300) { fx(s, { playerPopularity: 10, groups: { [g]: 8 } }); s.career.memorable.push('הנאום מול המפגינים'); return ok('"אני שומע אתכם". הם שמעו אותך. מישהו התחיל לשיר. רגע היסטורי.', 'הנאום מול ההמון: "אני שומע אתכם"'); } fx(s, { playerPopularity: -10, groups: { [g]: -4 }, stability: -5 }); return bad('זרקו עליך עגבנייה. המיקרופון נפל. העגבנייה – ויראלית.', 'העגבנייה שנשמעה בכל העולם'); } },
      { id: 'give', allow: (s) => holds(s), label: 'להיענות לדרישה המרכזית', hint: 'עולה כסף, מרגיע', resolve: (s, ev) => { s.flags.drama_siege_cd = s.turn + 8; const g = String(ev.vars.group) as GroupId; const cat = GROUP_CAT[g] ?? 'welfare'; fx(s, { budget: { [cat]: 3 }, groups: { [g]: 9 }, stability: 3 }); return meh(`₪3 מיליארד ל${CATEGORY_BY_ID[cat].name}. ההפגנה התפזרה. המפגינים הבאים כבר בדרך – למדו שזה עובד.`, 'ההפגנה הסתיימה: הממשלה נענתה'); } },
      { id: 'rain', allow: (s) => holds(s), label: 'לחכות שירד גשם', hint: '40% שזה עובד', resolve: (s, ev) => { s.flags.drama_siege_cd = s.turn + 8; const g = String(ev.vars.group) as GroupId; if (chance(s, 0.4)) return ok('ירד גשם. המפגינים הלכו הביתה. המטאורולוג קיבל עיטור.'); fx(s, { groups: { [g]: -7 }, stability: -8, playerPopularity: -5 }); return bad('שמש. 30 מעלות. המחאה גדלה פי שניים והביאה מנגלים.', 'המחאה הופכת לפסטיבל: אוהלים, מנגלים, דרישות'); } },
    ],
  },
  {
    id: 'pm_hospital', level: 'extreme',
    weight: (s) => (!isPM(s) && s.turn > 4 && (s.flags.drama_hosp_cd ?? 0) <= s.turn ? 0.18 : 0),
    make: (s) => ({ icon: '🏥', title: 'ראש הממשלה אושפז', fromId: s.government.pmId, text: `${s.politicians[s.government.pmId]?.name} אושפז ל"בדיקות שגרתיות" בשתיים בלילה, עם 4 רופאים ו-12 יועצי תקשורת. ואקום שלטוני. כולם מחכים לראות מי זז ראשון.` }),
    options: [
      { id: 'grab', label: 'להציג את עצמך כ"כתובת היציבה"', hint: 'כוח ↑, ראש הממשלה יזכור', resolve: (s, ev) => { s.flags.drama_hosp_cd = s.turn + 15; const w = me(s).power > 40 ? chance(s, 0.6) : chance(s, 0.3); remember(s, ev.fromId!, 'betrayal', 'ניסה לרשת אותי מבית החולים', -25); if (w) { me(s).power = clamp(me(s).power + 12); fx(s, { playerPopularity: 5 }); return ok('התקשורת קוראת לך "המבוגר האחראי". ראש הממשלה צפה בזה מהמיטה.', 'בזמן האשפוז: כוכב חדש עולה'); } fx(s, { playerPopularity: -4 }); return bad('"חמדן", "לא היה לו סבלנות" – הכותרות לא סלחניות.'); } },
      { id: 'flowers', label: 'זר פרחים וברכת החלמה', resolve: (s, ev) => { s.flags.drama_hosp_cd = s.turn + 15; remember(s, ev.fromId!, 'favor', 'שלח פרחים', 14); return ok('הוא חזר אחרי יומיים, שזוף. הזר שלך הוא היחיד שהוא זכר.'); } },
      { id: 'leak', label: 'להדליף "שזה רציני"', hint: 'מסוכן', resolve: (s, ev) => { s.flags.drama_hosp_cd = s.turn + 15; const pmParty = s.politicians[ev.fromId!]?.partyId; if (pmParty) applyEffects(s, { partyMomentum: { [pmParty]: -6 } }); fx(s, { playerReputation: -5 }); if (chance(s, 0.4)) { remember(s, ev.fromId!, 'betrayal', 'הדליף על הבריאות שלי', -35); return bad('נחשפת כמדליף. ראש הממשלה, בריא לגמרי, הודיע: "נסגור חשבון".'); } return meh('הסקרים של ראש הממשלה צנחו. אף אחד לא יודע מי הדליף. כמעט אף אחד.'); } },
    ],
  },
  {
    id: 'war_scare', level: 'extreme',
    weight: (s) => (s.flags.drama_war_cd ?? 0) > s.turn ? 0 : 0.07 + (s.services.security.quality < 55 ? 0.2 : 0),
    make: () => ({ icon: '🚨', title: 'פיצוץ בגבול הדמיוני', text: 'פיצוץ עז במתקן בגבול. הרמטכ״ל מבקש לגייס 100 אלף מילואימניקים "עכשיו". הבורסה ננעלת, הסופרים מתרוקנים מנייר טואלט, ובטלוויזיה – 14 פרשנים בו זמנית.' }),
    options: [
      { id: 'full', allow: (s) => holds(s, 'defense'), label: 'גיוס מלא', hint: '₪4B, ביטחון ↑, כלכלה ↓', resolve: (s) => { s.flags.drama_war_cd = s.turn + 10; fx(s, { oneOffCost: 4, services: { security: 6 }, economy: { growth: -0.6 }, groups: { reservists: -5, right: 5, families: -2 }, stability: 6 }); return meh('100 אלף בשטח תוך 48 שעות. המתיחות נרגעה. המילואימניקים חזרו לעבודה ולהודעות "איפה היית?".', 'גיוס מילואים נרחב: המתיחות נרגעת'); } },
      { id: 'partial', allow: (s) => holds(s, 'defense'), label: 'גיוס חלקי ומעקב', hint: '₪1.5B', resolve: (s) => { s.flags.drama_war_cd = s.turn + 10; fx(s, { oneOffCost: 1.5, services: { security: 2 }, groups: { right: -1 } }); if (chance(s, 0.35)) { startCrisis(s, 'border', 2); return bad('המתיחות לא נרגעה. משבר ביטחוני מתמשך.'); } return ok('הערכת המצב הייתה נכונה. הפרשנים התאכזבו.'); } },
      { id: 'diplomacy', allow: (s) => holds(s, 'defense', 'foreign'), label: 'ערוץ דיפלומטי שקט', hint: '-10 הון, 50%', resolve: (s) => { s.flags.drama_war_cd = s.turn + 10; s.player.politicalCapital = clamp(s.player.politicalCapital - 10); if (chance(s, 0.5)) { fx(s, { groups: { left: 4, center: 2 }, playerReputation: 5 }); return ok('שיחה אחת בלילה, ושקט. אף אחד לא יודע מה נאמר. מושלם.', 'בכירים: "ערוץ שקט מנע הסלמה"'); } fx(s, { groups: { right: -6 }, services: { security: -4 } }); startCrisis(s, 'border', 3); return bad('הצד השני לא ענה לטלפון. הימין קורא לך "חלש".'); } },
    ],
  },
  {
    id: 'cabinet_revolt', level: 'extreme',
    weight: (s) => (isPM(s) && s.government.stability < 55 && (s.flags.drama_revolt_cd ?? 0) <= s.turn ? 0.25 + (55 - s.government.stability) / 60 : 0),
    make: (s) => {
      const rebels = ministers(s).sort((a, b) => a.loyalty - b.loyalty).slice(0, 3);
      return { icon: '⚔️', title: 'מרד בממשלה', vars: { ids: rebels.map((r) => r.id).join(',') }, text: `${rebels.map((r) => r.name).join(', ')} שלחו לך מכתב משותף: "או שינוי כיוון ותקציבים – או שאנחנו מפילים את הממשלה". המכתב הודלף לפני שהגיע אליך.` };
    },
    options: [
      { id: 'buy', label: 'לקנות אותם: ₪1B לכל אחד', resolve: (s, ev) => { s.flags.drama_revolt_cd = s.turn + 8; for (const id of String(ev.vars.ids).split(',').filter(Boolean)) { const m = s.government.ministries.find((x) => x.ministerId === id); const cat = m?.categories[0]; if (cat) fx(s, { budget: { [cat]: 1 } }); remember(s, id, 'deal', 'קיבל תקציב במרד', 15); } fx(s, { stability: 8, groups: { center: -2 } }); return meh('שקט. לעכשיו. המורדים כבר מתכננים את המרד הבא – הוא משתלם.', 'המרד נקנה: ₪3 מיליארד לשרים המורדים'); } },
      { id: 'fire', label: 'לפטר את כולם', hint: 'מסוכן מאוד לקואליציה', resolve: (s, ev) => { s.flags.drama_revolt_cd = s.turn + 8; for (const id of String(ev.vars.ids).split(',').filter(Boolean)) { const p = s.politicians[id]; const m = s.government.ministries.find((x) => x.ministerId === id); if (m) m.ministerId = s.government.pmId; if (p) { p.ministryId = null; remember(s, id, 'fired', 'פוטר במרד', -35); } } fx(s, { stability: -12, playerPopularity: 3, playerReputation: 3 }); s.career.memorable.push('פיטר שלושה שרים בבת אחת'); return meh('"יום הסכינים הארוכות" של צבריה. הציבור מתרשם. השותפות – בפאניקה.', 'ראש הממשלה פיטר את המורדים'); } },
      { id: 'elections', label: '"רוצים בחירות? בבקשה."', resolve: (s) => { s.flags.drama_revolt_cd = s.turn + 8; callEarlyElections(s, 'מרד שרים'); return meh('הכנסטון מתפזר. המורדים מגלים שבסקרים הם לא עוברים את אחוז החסימה.'); } },
    ],
  },
  {
    id: 'phone_hack', level: 'extreme',
    weight: (s) => (s.flags.drama_phone_cd ?? 0) > s.turn ? 0 : 0.1 + (s.services.security.quality < 50 ? 0.1 : 0),
    make: () => ({ icon: '📱', title: 'הטלפון שלך נפרץ', text: 'האקרים אנונימיים: "יש לנו 6 שנים של הודעות. כולל אלה לאמא שלך וקבוצת הווטסאפ \'הנהגה – סודי ביותר\'". הפרסום – בעוד 48 שעות.' }),
    options: [
      { id: 'first', label: 'לפרסם הכול בעצמך קודם', hint: 'כאב קטן עכשיו', resolve: (s) => { s.flags.drama_phone_cd = s.turn + 15; fx(s, { playerPopularity: -2, playerReputation: 5 }); return ok('הציבור גילה שאתה שולח לאמא מתכונים ומדבקות של חתולים. אהדה מפתיעה.', 'פרסם בעצמו: ההודעות המביכות ביותר – של אמא שלו'); } },
      { id: 'court', label: 'צו איסור פרסום', hint: '-8 הון, 70%', resolve: (s) => { s.flags.drama_phone_cd = s.turn + 15; s.player.politicalCapital = clamp(s.player.politicalCapital - 8); if (chance(s, 0.7)) return ok('הצו התקבל. הכותרת היחידה: "פוליטיקאי מוציא צו איסור פרסום". כולם משערים.'); fx(s, { playerPopularity: -9 }); return bad('הצו נדחה. הכול פורסם. כולל "הוא חכם כמו כיסא פלסטיק".', 'פרסום: 6 שנים של הודעות'); } },
      { id: 'deny', label: 'להכחיש הכול מראש', hint: 'הימור', resolve: (s) => { s.flags.drama_phone_cd = s.turn + 15; if (chance(s, 0.5)) return ok('ההאקרים התגלו כנער בן 15 שבלף. הוא קיבל הצעת עבודה ממשרד הביטחון.'); fx(s, { playerPopularity: -10, playerReputation: -6 }); return bad('הכחשת. ואז פורסם צילום מסך של ההכחשה – מהטלפון שלך – עם "לול" בסוף.'); } },
    ],
  },
  {
    id: 'defector', level: 'breaking',
    weight: (s) => (isPM(s) && coalitionSeats(s) < MAJORITY + 3 ? 0.6 : 0),
    make: (s) => {
      const p = pick(s, Object.values(s.politicians).filter((x) => x.active && !x.isPlayer && !s.government.coalition.includes(x.partyId) && s.parties[x.partyId]?.leaderId !== x.id));
      return { icon: '🦘', title: 'ח״כ אופוזיציה מוכן לערוק', fromId: p?.id, text: `${p?.name} שולח הודעה בשתיים בלילה: "אני מוכן לעבור אליכם. תנאי קטן: משרד. כל משרד. אפילו האסטרטגי".` };
    },
    options: [
      { id: 'accept', label: 'לקבל אותו (+1 מנדט לקואליציה)', hint: 'מרכז ↓, תקדים', resolve: (s, ev) => { const p = pol(s, ev); if (!p) return meh('הוא התחרט.'); const from = s.parties[p.partyId]; const to = s.parties[s.player.partyId]; from.memberIds = from.memberIds.filter((x) => x !== p.id); from.seats = Math.max(0, from.seats - 1); to.memberIds.push(p.id); to.seats += 1; p.partyId = to.id; remember(s, p.id, 'promise', 'משרד בממשלה', 10, s.turn + 6, 'role'); fx(s, { groups: { center: -3, left: -2 }, stability: 4 }); return meh(`${p.name} ערק. במפלגה הקודמת שלו כבר תולים את התמונה שלו – על לוח החצים.`, `עריקה: ${p.name} עובר לקואליציה תמורת "משרד כלשהו"`); } },
      { id: 'refuse', label: 'לסרב ולהדליף', resolve: (s) => { fx(s, { playerReputation: 4, playerPopularity: 2 }); return ok('"אנחנו לא קונים ח״כים". נשמע טוב. בעיקר כי לא היה לך משרד פנוי.'); } },
    ],
  },
];

export const DRAMA_BY_ID = Object.fromEntries(DRAMAS.map((d) => [d.id, d])) as Record<string, DramaDef>;
