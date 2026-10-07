// ============================================================
// Dramatic events: dilemmas that reach the player during a turn.
// Weights are driven by the state (tension, role, coalition), and every
// option changes real numbers. Tone: serious and factual.
// ============================================================
import { chance, pick, rand } from './rng';
import type { BudgetCategory, DramaEvent, Effects, GameState, GroupId, Politician } from '../types/game';
import { clamp, deficitPct } from '../utils';
import { GROUP_BY_ID, CATEGORY_BY_ID, MAJORITY } from '../data/world';
import { applyDecision } from './decisions';
import { applyEffects, remember } from './effects';
import { startCrisis } from './crises';
import { BUDGET_PREF, callEarlyElections } from './elections';
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
const spend = (s: GameState, n: number) => { s.player.politicalCapital = clamp(s.player.politicalCapital - n); };
const ok = (text: string, headline?: string): Outcome => ({ text, tone: 'good', headline });
const bad = (text: string, headline?: string): Outcome => ({ text, tone: 'bad', headline });
const meh = (text: string, headline?: string): Outcome => ({ text, tone: 'neutral', headline });
/** How heated the country is: 0 calm … ~1.5 boiling. Extreme events need heat. */
export function tension(s: GameState): number {
  return clamp((50 - s.government.approval) / 40 + (50 - s.government.stability) / 60 + Math.max(0, deficitPct(s) - 3.5) / 5 + s.crises.length * 0.15, 0, 1.5);
}
function angriestGroup(s: GameState): GroupId {
  return Object.values(s.population.groups).sort((a, b) => a.satisfaction - b.satisfaction)[0].id;
}
const GROUP_CAT: Partial<Record<GroupId, BudgetCategory>> = {
  youth: 'housing', families: 'education', lowIncome: 'welfare', retirees: 'welfare', elderly: 'health', students: 'education',
  reservists: 'defense', soldiers: 'defense', periphery: 'transport', haredim: 'education', publicSector: 'government', settlers: 'housing',
  arabs: 'police', olim: 'housing', middleClass: 'housing', secular: 'transport',
};

export const DRAMAS: DramaDef[] = [
  // ======================= NORMAL =======================
  {
    id: 'bereaved_father', level: 'normal',
    weight: (s) => 0.9 + (s.activeLaws.includes('oct7_state_commission') ? -0.5 : 0.3),
    make: () => ({ icon: '🕯️', title: 'אב שכול מתפרץ בטקס', text: 'בטקס זיכרון ממלכתי קם אב שכול וקרא לעברך: "הבן שלי נפל, ואף אחד לא לקח אחריות. איפה ועדת החקירה?" הטקס הופסק לכמה דקות, והתיעוד מופץ בכל הערוצים.' }),
    options: [
      { id: 'meet', label: 'לגשת אליו ולהזמין אותו לפגישה אישית', hint: '-3 הון, אמפתיה', resolve: (s) => { spend(s, 3); fx(s, { playerPopularity: 3, playerReputation: 3, groups: { reservists: 2, families: 2 } }); return ok('נפגשתם למחרת לשיחה ארוכה. הוא לא שינה את עמדתו, אבל אמר בתקשורת שהרגיש שהקשבת.', 'פגישה בין האב השכול לבין חבר הממשלה'); } },
      { id: 'commission', label: 'להתחייב לתמוך בוועדת חקירה ממלכתית', hint: 'משפחות ↑, שותפים מסוימים ↓', resolve: (s) => { remember(s, s.government.pmId, s.government.pmId === s.player.politicianId ? 'favor' : 'insult', 'התחייב לוועדה ממלכתית', s.government.pmId === s.player.politicianId ? 0 : -8); fx(s, { playerPopularity: 4, groups: { reservists: 4, families: 3, left: 3, center: 3, right: -2 } }); return ok('ההתחייבות התקבלה בהערכה בקרב המשפחות. עכשיו יצפו שתפעל לממש אותה.', 'התחייבות לתמוך בוועדת חקירה ממלכתית'); } },
      { id: 'silent', label: 'להמשיך בטקס בלי להגיב', resolve: (s) => { fx(s, { playerPopularity: -4, groups: { reservists: -3, families: -2 } }); return bad('השתיקה נתפסה כאדישות. ארגוני המשפחות מבקרים אותך בחריפות.'); } },
    ],
  },
  {
    id: 'ptsd_veteran', level: 'normal',
    weight: () => 0.8,
    make: () => ({ icon: '🎖️', title: 'לוחם הלום קרב מוחה מול אגף השיקום', text: 'לוחם מילואים שאובחן עם פוסט-טראומה הפגין מול משרדי אגף השיקום: "חודשים אני מחכה לוועדה רפואית. אני לא מצליח לעבוד ולא לישון." עשרות לוחמים הצטרפו אליו.' }),
    options: [
      { id: 'reform', allow: (s) => holds(s, 'defense', 'finance', 'welfare'), label: 'רפורמה מיידית באגף השיקום', hint: '₪1 מיליארד בשנה', resolve: (s) => { fx(s, { budget: { defense: 1 }, groups: { reservists: 6, soldiers: 3, families: 2 }, playerPopularity: 3 }); return ok('קיצור זמני ההמתנה, טיפול נפשי מיידי וליווי אישי לכל לוחם. ארגוני הנכים מברכים.', 'רפורמה באגף השיקום: טיפול מיידי ללוחמים'); } },
      { id: 'visit', label: 'להגיע אליהם ולהקשיב', hint: '-3 הון', resolve: (s) => { spend(s, 3); fx(s, { playerPopularity: 2, groups: { reservists: 2 } }); return meh('שוחחת עם הלוחמים. הם מעריכים את ההגעה, אבל מחכים לשינוי ממשי.'); } },
      { id: 'committee', label: 'להעביר לבחינת ועדה', resolve: (s) => { fx(s, { playerPopularity: -2, groups: { reservists: -4 } }); return bad('ארגוני הלוחמים: "עוד ועדה. בינתיים אנשים קורסים."', 'הלוחמים: "הממשלה מושכת זמן"'); } },
    ],
  },
  {
    id: 'arab_crime', level: 'normal',
    weight: (s) => 0.7 + Math.max(0, 45 - s.population.groups.arabs.satisfaction) / 30,
    make: () => ({ icon: '🕊️', title: 'רצח נוסף בחברה הערבית', text: 'אם לשלושה נרצחה בירי בעיר בגליל. מתחילת השנה נרצחו עשרות בני אדם בחברה הערבית. ראשי הרשויות הכריזו על שביתה כללית ודורשים טיפול לאומי באלימות ובארגוני הפשיעה.' }),
    options: [
      { id: 'plan', allow: (s) => holds(s, 'national_security', 'finance'), label: 'תוכנית לאומית נגד הפשיעה', hint: '₪1.5 מיליארד, משטרה ושיקום', resolve: (s) => { fx(s, { budget: { police: 1, welfare: 0.5 }, services: { security: 2 }, groups: { arabs: 7, left: 2, center: 1 } }); return ok('יחידה ייעודית במשטרה, איסוף נשק לא חוקי ותוכניות חינוך ותעסוקה. ראשי הרשויות מברכים בזהירות.', 'הממשלה אישרה תוכנית לאומית נגד הפשיעה בחברה הערבית'); } },
      { id: 'shin_bet', allow: (s) => holds(s, 'national_security'), label: 'לשלב את השב״כ במאבק', hint: 'יעיל, שנוי במחלוקת', resolve: (s) => { fx(s, { services: { security: 2 }, groups: { arabs: 2, liberals: -3, right: 2 } }); return meh('מספר המקרים ירד, אבל ארגוני זכויות האדם מזהירים מפגיעה בפרטיות.'); } },
      { id: 'condemn', label: 'להוציא הודעת גינוי', resolve: (s) => { fx(s, { groups: { arabs: -3 }, playerPopularity: -1 }); return bad('ראשי הרשויות: "גינויים לא עוצרים כדורים."'); } },
    ],
  },
  {
    id: 'reservist_business', level: 'normal',
    weight: (s) => 0.6 + Math.max(0, 50 - s.population.groups.reservists.satisfaction) / 30,
    make: () => ({ icon: '🪖', title: 'עסק של משרת מילואים קרס', text: 'בעל עסק קטן שעשה יותר מ-200 ימי מילואים בשנה האחרונה פרסם מכתב פתוח: "העסק שלי קרס בזמן שהייתי במילואים. המענקים לא הגיעו." המכתב שותף מאות אלפי פעמים.' }),
    options: [
      { id: 'fund', allow: (s) => holds(s, 'finance', 'economy', 'defense'), label: 'קרן סיוע לעסקי משרתי מילואים', hint: '₪2 מיליארד', resolve: (s) => { fx(s, { oneOffCost: 2, groups: { reservists: 6, selfEmployed: 4, families: 1 } }); return ok('הקרן נפתחה: הלוואות בערבות מדינה ומענקים לעסקים שנפגעו.', 'קרן סיוע לעסקי משרתי המילואים'); } },
      { id: 'call', label: 'להתקשר אליו אישית', hint: '-2 הון', resolve: (s) => { spend(s, 2); fx(s, { playerPopularity: 2 }); return meh('השיחה פורסמה ברשתות. הוא הודה, אבל ציין שהבעיה מערכתית.'); } },
      { id: 'existing', label: 'להפנות למענקים הקיימים', resolve: (s) => { fx(s, { groups: { reservists: -3, selfEmployed: -2 } }); return bad('משרתי המילואים: "המענקים הקיימים לא מגיעים בזמן."'); } },
    ],
  },
  {
    id: 'minister_expenses', level: 'normal',
    weight: (s) => (ministers(s).length ? 0.8 : 0),
    make: (s) => {
      const p = pick(s, ministers(s));
      return { icon: '🧾', title: 'פרסום על הוצאות שר', fromId: p.id, text: `תחקיר עיתונאי חשף ש${p.name} טס עם פמליה גדולה לכנס בחו״ל, בעלות של מאות אלפי שקלים מכספי ציבור, בזמן ש${s.crises[0]?.title ?? 'משפחות רבות מתקשות בתשלום שכר הדירה'}.` };
    },
    options: [
      { id: 'back', label: 'לגבות אותו', hint: 'השר ירוויח, הציבור פחות', resolve: (s, ev) => { remember(s, ev.fromId!, 'favor', 'גיבה אותי בפרשת ההוצאות', 12); fx(s, { playerPopularity: -3, groups: { lowIncome: -2, middleClass: -1 } }); return bad('"הנסיעה הייתה חיונית", אמרת. התגובות ברשת היו קשות.', `${pol(s, ev)?.name}: "הנסיעה אושרה כדין"`); } },
      { id: 'refund', label: 'לדרוש החזר כספי', hint: 'מוניטין ↑, יחסים ↓', resolve: (s, ev) => { remember(s, ev.fromId!, 'insult', 'דרש ממני החזר', -12); fx(s, { playerPopularity: 3, playerReputation: 3 }); return ok('השר החזיר חלק מההוצאות ופרסם התנצלות.', 'בעקבות הביקורת: השר יחזיר את ההוצאות'); } },
      { id: 'audit', label: 'להעביר לבדיקת מבקר המדינה', hint: '-2 הון', resolve: (s) => { spend(s, 2); fx(s, { playerReputation: 2 }); return meh('מבקר המדינה יבדוק את הנסיעה. הסערה נרגעה בינתיים.'); } },
    ],
  },
  {
    id: 'faction_recording', level: 'normal',
    weight: (s) => 0.6 + (100 - s.parties[s.player.partyId].cohesion) / 90,
    make: () => ({ icon: '🎧', title: 'הקלטה מישיבת סיעה', text: 'הקלטה מישיבה סגורה של הסיעה פורסמה. בה נשמעת ביקורת חריפה שלך על אחד השותפים הפוליטיים.' }),
    options: [
      { id: 'own', label: 'לעמוד מאחורי הדברים', hint: 'עקביות, יחסים ↓', resolve: (s) => { fx(s, { playerReputation: 2, stability: -2 }); return meh('אמרת שזו ביקורת עניינית ושאתה עומד מאחוריה. השותף נעלב.'); } },
      { id: 'apologize', label: 'להתנצל בפני השותף', hint: '-2 הון', resolve: (s) => { spend(s, 2); fx(s, { playerPopularity: -1, stability: 1 }); return ok('השיחה ביניכם הרגיעה את הרוחות.'); } },
      { id: 'leaker', label: 'לחפש את המדליף בסיעה', hint: '-5 הון, מישהו ייפגע', resolve: (s) => { spend(s, 5); const sus = pick(s, s.parties[s.player.partyId].memberIds.filter((id) => id !== s.player.politicianId)); if (sus) remember(s, sus, 'insult', 'נחשד בהדלפה', -15); fx(s, { stability: -2 }); return meh(`${s.politicians[sus]?.name ?? 'אחד החברים'} נחשד בהדלפה. הוא מכחיש בתוקף, והאווירה בסיעה מתוחה.`); } },
    ],
  },
  {
    id: 'donor_offer', level: 'normal',
    weight: (s) => 0.6 + (deficitPct(s) > 4 ? 0.5 : 0),
    make: () => ({ icon: '💼', title: 'איש עסקים עם הצעה', text: 'איש עסקים בולט מציע לממן פרויקט לאומי ב-₪3 מיליארד. הוא מבקש "תיקון טכני" בחוק ההגבלים העסקיים שיקל על החברות שלו.' }),
    options: [
      { id: 'take', allow: (s) => holds(s, 'finance', 'economy'), label: 'לקבל את ההצעה', hint: '+₪3B, סיכון לחקירה', resolve: (s) => { fx(s, { revenue: 3, playerReputation: -8, groups: { highIncome: 3, left: -4 } }); if (chance(s, 0.45)) { startCrisis(s, 'scandal', 2); return bad('כעבור כמה חודשים נפתחה בדיקה: חשד לתיקון חוק תמורת תרומה.', 'בדיקה: חשד לקשר בין תרומה לתיקון חקיקה'); } return meh('הכסף הועבר והתיקון עבר בוועדה. בינתיים בלי הדים.'); } },
      { id: 'refuse', label: 'לסרב', resolve: (s) => { fx(s, { playerReputation: 3 }); return ok('סירבת. התיקון לא יקודם.'); } },
      { id: 'expose', label: 'לחשוף את ההצעה בפומבי', hint: 'פופולריות ↑, יריב חזק', resolve: (s) => { fx(s, { playerPopularity: 4, playerReputation: 3, partyMomentum: { [s.player.partyId]: -2 } }); return ok('החשיפה עוררה הדים. כלי התקשורת של איש העסקים מתחילים לבקר אותך.', 'חשיפה: הצעת מימון תמורת שינוי חקיקה'); } },
    ],
  },
  {
    id: 'absent_mk', level: 'normal',
    weight: (s) => (isPM(s) && s.bills.some((b) => b.status === 'active' && b.isGovernment) ? 1 : 0),
    make: (s) => {
      const p = pick(s, Object.values(s.politicians).filter((x) => x.active && !x.isPlayer && s.government.coalition.includes(x.partyId) && !x.ministryId));
      return { icon: '✈️', title: 'ח״כ קואליציה בחו״ל לפני הצבעה', fromId: p?.id, text: `${p?.name ?? 'ח״כ מהקואליציה'} נמצא בחו״ל ולא יספיק לחזור להצבעה על הצעת חוק ממשלתית. בלי הקול שלו הרוב בסכנה.` };
    },
    options: [
      { id: 'pair', label: 'לסגור קיזוז עם האופוזיציה', hint: '-6 הון', resolve: (s) => { spend(s, 6); return ok('האופוזיציה הסכימה לקזז. ההצבעה תתקיים כמתוכנן.'); } },
      { id: 'delay', label: 'לדחות את ההצבעה', hint: 'ההצעה נחלשת מעט', resolve: (s) => { for (const b of s.bills.filter((x) => x.status === 'active' && x.isGovernment)) b.push -= 8; return meh('ההצבעה נדחתה בשבוע. האופוזיציה טוענת שהקואליציה מתפרקת.'); } },
      { id: 'lose', label: 'להצביע בכל זאת', hint: 'סיכון לכישלון', resolve: (s) => { for (const b of s.bills.filter((x) => x.status === 'active' && x.isGovernment)) b.push -= 25; return bad('בלי הקול שלו, ההצעה בסכנה ממשית.'); } },
    ],
  },
  {
    id: 'mayor_hunger_strike', level: 'normal',
    weight: (s) => 0.6 + Math.max(0, 50 - s.population.groups.periphery.satisfaction) / 25,
    make: () => ({ icon: '🏘️', title: 'ראש עיר בפריפריה בשביתת רעב', text: 'ראש עיר בנגב פתח בשביתת רעב מול משרד ראש הממשלה. הוא דורש תקציב לתחבורה ציבורית, למרפאות ולמיגון: "תושבי הפריפריה לא אזרחים סוג ב׳."' }),
    options: [
      { id: 'pay', allow: (s) => holds(s, 'energy', 'interior', 'transport', 'negev_galilee'), label: 'תקציב ייעודי לעיר', hint: '₪500 מיליון, תקדים', resolve: (s) => { fx(s, { budget: { infrastructure: 0.5 }, groups: { periphery: 4, center: -1 }, regionInvestment: { negev: 8 } }); s.flags.mayor_precedent = (s.flags.mayor_precedent ?? 0) + 1; return ok('השביתה הסתיימה. ראשי ערים נוספים כבר מבקשים פגישות.', 'הממשלה הקצתה תקציב לעיר בנגב'); } },
      { id: 'visit', label: 'להגיע לאוהל המחאה', hint: '-4 הון', resolve: (s) => { spend(s, 4); fx(s, { playerPopularity: 3, groups: { periphery: 2 } }); return ok('שוחחתם שעה ארוכה. הוא הסכים להפסיק את השביתה בתמורה לצוות עבודה משותף.'); } },
      { id: 'ignore', label: 'לא להתערב', resolve: (s) => { fx(s, { groups: { periphery: -5 }, playerPopularity: -2 }); return bad('השביתה נמשכת, ותושבי הפריפריה מצטרפים למחאה.'); } },
    ],
  },
  {
    id: 'podcast', level: 'normal',
    weight: () => 0.6,
    make: () => ({ icon: '🎧', title: 'הזמנה לראיון עומק בפודקאסט', text: 'פודקאסט פופולרי מזמין אותך לראיון של שלוש שעות, בלי עריכה ובלי הכנה מוקדמת של השאלות.' }),
    options: [
      { id: 'go', label: 'להתראיין', hint: 'הצלחה תלויה במוניטין', resolve: (s) => (rand(s) < 0.45 + s.player.reputation / 300 ? (fx(s, { playerPopularity: 6, groups: { youth: 3 } }), ok('ראיון אישי ומעמיק. הציבור הצעיר הכיר צד חדש שלך.', 'הראיון הארוך שתפס את הקהל הצעיר')) : (fx(s, { playerPopularity: -5 }), bad('שאלות מקצועיות בכלכלה תפסו אותך לא מוכן. קטעים מהראיון מופצים בביקורת.'))) },
      { id: 'spokes', label: 'לשלוח את הדובר', resolve: (s) => { fx(s, { playerPopularity: -1 }); return meh('הדובר הציג את העמדות, אבל בלי הדים מיוחדים.'); } },
      { id: 'no', label: 'לסרב', resolve: () => meh('המנחה ציין שסירבת להגיע.') },
    ],
  },
  {
    id: 'partner_demand', level: 'normal',
    weight: (s) => (isPM(s) && s.government.coalition.length > 1 ? 0.9 : 0),
    make: (s) => {
      const pid = pick(s, s.government.coalition.filter((id) => id !== s.player.partyId));
      const l = s.politicians[s.parties[pid].leaderId];
      return { icon: '📋', title: 'שותפה קואליציונית מציבה דרישה', fromId: l?.id, partyId: pid, text: `${l?.name}, יו״ר ${s.parties[pid].name}, מודיע שהסיעה לא תתמוך בהצעות הממשלה עד שיועבר תקציב שסוכם בהסכם הקואליציוני.` };
    },
    options: [
      { id: 'pay', label: 'להעביר ₪400 מיליון כפי שסוכם', hint: 'נאמנות ↑, ציבור ↓', resolve: (s, ev) => { const cat = BUDGET_PREF[ev.partyId!] ?? 'welfare'; fx(s, { budget: { [cat]: 0.4 }, groups: { center: -2 }, stability: 4 }); remember(s, ev.fromId!, 'favor', 'העביר את התקציב שסוכם', 18); return meh('התקציב הועבר והסיעה חזרה להצביע עם הקואליציה.', `₪400 מיליון לנושאים של ${s.parties[ev.partyId!].shortName}`); } },
      { id: 'refuse', label: 'לסרב ולהציע לדון בתקציב הבא', resolve: (s, ev) => { remember(s, ev.fromId!, 'insult', 'סירב לקיים הסכם', -12); fx(s, { stability: -4 }); return bad('הסיעה הודיעה שתצביע לפי שיקול דעתה בשבועות הקרובים.'); } },
      { id: 'meet', label: 'פגישה אישית לגישור', hint: '-3 הון', resolve: (s, ev) => { spend(s, 3); remember(s, ev.fromId!, 'favor', 'נפגש איתי', 8); return ok('סוכם על לוח זמנים להעברת התקציב. המשבר נדחה.'); } },
    ],
  },
  {
    id: 'plenum_protest', level: 'normal',
    weight: (s) => (s.government.coalition.includes(s.player.partyId) ? 0.6 : 0),
    make: (s) => {
      const opp = Object.values(s.parties).filter((p) => !s.government.coalition.includes(p.id) && p.seats > 0).sort((a, b) => b.seats - a.seats)[0];
      return { icon: '📢', title: 'מחאה סוערת במליאה', partyId: opp?.id, text: `חברי ${opp?.name ?? 'האופוזיציה'} עלו לדוכן והפריעו לנאום שלך במחאה על מדיניות הממשלה. יו״ר הכנסטון הוציא כמה מהם מהאולם.` };
    },
    options: [
      { id: 'calm', label: 'להמשיך את הנאום בשקט', resolve: (s) => { fx(s, { playerPopularity: 2, playerReputation: 1 }); return ok('המשכת בנאום בשקט ובאיפוק. גם פרשנים מהצד השני ציינו את זה.'); } },
      { id: 'ethics', label: 'להגיש תלונה לוועדת האתיקה', hint: '-2 הון', resolve: (s, ev) => { spend(s, 2); if (ev.partyId) applyEffects(s, { partyMomentum: { [ev.partyId]: -2 } }); return meh('ועדת האתיקה תדון בתלונה.'); } },
      { id: 'attack', label: 'להשיב בתקיפות', hint: 'בסיס ↑, מרכז ↓', resolve: (s) => { fx(s, { playerPopularity: 2, playerReputation: -3, groups: { center: -2 } }); return meh('חילופי הדברים החריפים עלו לכותרות.', 'סערה במליאה'); } },
    ],
  },
  {
    id: 'fake_news', level: 'normal',
    weight: (s) => (isPartyLeader(s) ? 0.7 : 0),
    make: (s) => ({ icon: '📲', title: 'קמפיין מידע כוזב ברשתות', text: `סקר מפוברק ופוסטים כוזבים על ${s.parties[s.player.partyId].name} מופצים ברשתות על ידי חשבונות מזויפים. חלק מהחשבונות מזוהים כמופעלים מחו״ל.` }),
    options: [
      { id: 'ignore', label: 'להתעלם', resolve: (s) => { applyEffects(s, { partyMomentum: { [s.player.partyId]: -2 } }); return meh('המידע הכוזב ממשיך להתפשט.'); } },
      { id: 'counter', label: 'לפרסם תגובה ונתונים אמיתיים', hint: '₪1 מיליון מקופת המפלגה', resolve: (s) => { s.parties[s.player.partyId].funds -= 1; applyEffects(s, { partyMomentum: { [s.player.partyId]: 3 } }); return ok('התגובה המהירה עצרה את ההתפשטות.'); } },
      { id: 'report', label: 'לפנות לוועדת הבחירות ולמערך הסייבר', hint: '-3 הון', resolve: (s) => { spend(s, 3); fx(s, { playerReputation: 2 }); return ok('החשבונות הוסרו, והפרשה סוקרה כניסיון התערבות זר.', 'ניסיון התערבות זרה בבחירות נחשף'); } },
    ],
  },
  {
    id: 'wildfires', level: 'normal',
    weight: (s) => (s.date.month >= 5 && s.date.month <= 10 ? 1 : 0.1),
    make: () => ({ icon: '🔥', title: 'שריפות ענק בהרי ירושלים', text: 'גל חום קיצוני הוביל לשריפות בהרי ירושלים ובכרמל. יישובים פונו, ומטוסי כיבוי מחו״ל בדרך.' }),
    options: [
      { id: 'fund', allow: (s) => holds(s, 'national_security', 'interior', 'finance'), label: 'תקציב חירום לכבאות ולשיקום', hint: '₪1.2 מיליארד', resolve: (s) => { fx(s, { oneOffCost: 1.2, services: { security: 1 }, groups: { families: 2, periphery: 2 } }); return ok('המענה המהיר צומצם את הנזקים, והמפונים חזרו לבתיהם תוך ימים.', 'הממשלה אישרה תקציב חירום לנפגעי השריפות'); } },
      { id: 'visit', label: 'להגיע למרכז הפינוי', hint: '-3 הון', resolve: (s) => { spend(s, 3); fx(s, { playerPopularity: 2 }); return meh('נפגשת עם המפונים ועם הכבאים.'); } },
      { id: 'blame', label: 'לייחס אחריות למשרד האחראי', resolve: (s) => { const m = s.government.ministries.find((x) => x.id === 'national_security'); if (m?.ministerId && m.ministerId !== s.player.politicianId) remember(s, m.ministerId, 'insult', 'האשים אותי בשריפות', -10); fx(s, { playerPopularity: -1, stability: -2 }); return bad('הציבור לא אהב את חילופי ההאשמות בזמן אמת.'); } },
    ],
  },
  {
    id: 'exit', level: 'normal',
    weight: (s) => (s.economy.growth > 2.5 ? 0.6 : 0.2),
    make: () => ({ icon: '💡', title: 'אקזיט של מיליארדי דולרים', text: 'חברת סייבר ישמעאלית נמכרה לחברה אמריקאית בעסקה של מיליארדי דולרים. העסקה צפויה להכניס לקופת המדינה מיסים גבוהים.' }),
    options: [
      { id: 'invest', allow: (s) => holds(s, 'finance', 'science'), label: 'להשקיע חלק מההכנסות בחינוך טכנולוגי', hint: 'מדע ↑', resolve: (s) => { fx(s, { budget: { science: 1, education: 0.5 }, groups: { youth: 2, highIncome: 1 } }); return ok('תוכנית להכשרת צעירים מהפריפריה בתחומי הטכנולוגיה.'); } },
      { id: 'credit', label: 'לברך ולציין את מדיניות הממשלה', resolve: (s) => { fx(s, { playerPopularity: 2 }); return meh('הברכה התקבלה, אבל פרשנים ציינו שהממשלה לא הייתה מעורבת.'); } },
      { id: 'debt', allow: (s) => holds(s, 'finance'), label: 'להעביר את העודף להקטנת החוב', resolve: (s) => { fx(s, { revenue: 2, playerReputation: 2 }); return ok('חברות הדירוג ציינו לחיוב את האחריות הפיסקלית.'); } },
    ],
  },
  {
    id: 'shabbat_works', level: 'normal',
    weight: () => 0.6,
    make: () => ({ icon: '🚆', title: 'מחלוקת על עבודות רכבת בשבת', text: 'רכבת ישמעאל מתכננת עבודות תשתית דחופות בשבת, כדי לא לשבש את התנועה באמצע השבוע. המפלגות החרדיות מאיימות על יציבות הקואליציה.' }),
    options: [
      { id: 'no', allow: (s) => holds(s, 'transport'), label: 'לדחות את העבודות לימי חול', hint: 'פקקים, חרדים ↑', resolve: (s) => { fx(s, { groups: { haredim: 4, religious: 2, secular: -3, center: -2 }, economy: { growth: -0.05 } }); return meh('העבודות יתבצעו בלילות באמצע השבוע. נוסעים רבים יתעכבו.'); } },
      { id: 'yes', allow: (s) => holds(s, 'transport'), label: 'לאשר עבודות בשבת', hint: 'חילונים ↑, קואליציה ↓', resolve: (s) => { fx(s, { groups: { secular: 3, center: 2, haredim: -5 }, stability: s.government.coalition.some((p) => ['shas', 'utj'].includes(p)) ? -5 : 0 }); return meh('העבודות אושרו. המפלגות החרדיות שוקלות את צעדיהן.', 'סערה קואליציונית סביב עבודות בשבת'); } },
      { id: 'compromise', allow: (s) => holds(s, 'transport'), label: 'פשרה: רק עבודות פיקוח נפש', hint: '-2 הון', resolve: (s) => { spend(s, 2); fx(s, { groups: { haredim: -1, secular: -1 } }); return meh('פשרה: בשבת יבוצעו רק עבודות בטיחות דחופות.'); } },
    ],
  },
  {
    id: 'minister_statement', level: 'normal',
    weight: (s) => (ministers(s).length ? 0.7 : 0),
    make: (s) => {
      const p = pick(s, ministers(s));
      return { icon: '🎙️', title: 'התבטאות שנויה במחלוקת של שר', fromId: p.id, text: `${p.name} התבטא בראיון באופן שנתפס כפוגעני כלפי ציבור שלם. דרישות להתנצלות מגיעות גם מתוך הקואליציה.` };
    },
    options: [
      { id: 'defend', label: '"הדברים הוצאו מהקשרם"', resolve: (s, ev) => { remember(s, ev.fromId!, 'favor', 'גיבה אותי', 8); fx(s, { playerPopularity: -2, playerReputation: -2 }); return bad('הראיון המלא פורסם, והביקורת התגברה.'); } },
      { id: 'distance', label: 'להסתייג מהדברים', resolve: (s, ev) => { remember(s, ev.fromId!, 'insult', 'הסתייג ממני', -8); fx(s, { playerReputation: 2 }); return ok('"אלה אינם עמדות הממשלה". השר פרסם הבהרה.'); } },
      { id: 'apology', label: 'לדרוש מהשר להתנצל', hint: '-2 הון', resolve: (s, ev) => { spend(s, 2); remember(s, ev.fromId!, 'insult', 'דרש ממני התנצלות', -5); fx(s, { playerReputation: 3, playerPopularity: 1 }); return ok('השר התנצל, והסערה שככה.'); } },
    ],
  },
  {
    id: 'rival_bloc', level: 'breaking',
    weight: (s) => (isPartyLeader(s) && s.turn > 1 ? 0.5 : 0),
    make: (s) => {
      const others = Object.values(s.parties).filter((p) => p.id !== s.player.partyId && p.seats > 0 && !s.alliances.some((a) => a.partyId === p.id));
      const a = others.sort((x, y) => y.seats - x.seats)[0];
      const b = others.filter((p) => p.id !== a?.id).sort((x, y) => Math.abs(x.ideology.economic - (a?.ideology.economic ?? 0)) - Math.abs(y.ideology.economic - (a?.ideology.economic ?? 0)))[0];
      return { icon: '🤝', title: 'גוש פוליטי חדש נגדך', partyId: a?.id, vars: { other: b?.id ?? '' }, text: `${a?.name} ו${b?.name} הודיעו על ברית פוליטית משותפת, במטרה למנוע ממך להרכיב את הממשלה הבאה.` };
    },
    options: [
      { id: 'counter', label: 'להציע ברית למפלגה השנייה', hint: '-8 הון, 50%', resolve: (s, ev) => { spend(s, 8); const other = String(ev.vars.other); if (other && chance(s, 0.5)) { s.alliances.push({ partyId: other, kind: 'votes', strength: 45, since: s.turn, demand: 'פירוק הגוש היריב' }); return ok(`${s.parties[other].name} פרשה מהגוש ובחרה בתיאום איתך.`, 'הגוש החדש התפרק'); } applyEffects(s, { partyMomentum: { [ev.partyId!]: 4, [other]: 3 } }); return bad('ההצעה נדחתה ופורסמה. הגוש התחזק.'); } },
      { id: 'criticize', label: 'לבקר: "ברית בלי תוכנית"', resolve: (s, ev) => { applyEffects(s, { partyMomentum: { [ev.partyId!]: 2, [String(ev.vars.other)]: 2, [s.player.partyId]: 1 } }); fx(s, { playerPopularity: 1 }); return meh('הביקורת סוקרה, אבל הגוש עלה מעט בסקרים.'); } },
      { id: 'ignore', label: 'לא להגיב', resolve: (s, ev) => { applyEffects(s, { partyMomentum: { [ev.partyId!]: 4, [String(ev.vars.other)]: 3 } }); return bad('הגוש מתחזק בסקרים.'); } },
    ],
  },

  // ======================= SCANDALS & INVESTIGATIONS =======================
  {
    id: 'aide_investigation', level: 'normal',
    weight: (s) => 0.35 + (s.player.reputation < 40 ? 0.2 : 0),
    make: () => ({ icon: '🔎', title: 'יועץ בכיר בלשכתך נחקר', text: 'המשטרה חקרה באזהרה יועץ בכיר בלשכתך בחשד לקבלת טובות הנאה מאיש עסקים. אין חשד נגדך, אבל התקשורת שואלת מה ידעת.' }),
    options: [
      { id: 'suspend', label: 'להשעות את היועץ עד סוף החקירה', hint: 'מוניטין ↑, צוות נחלש', resolve: (s) => { fx(s, { playerReputation: 4 }); me(s).power = clamp(me(s).power - 2); return ok('השעית את היועץ והודעת על שיתוף פעולה מלא עם החקירה.', 'היועץ הושעה עד לסיום החקירה'); } },
      { id: 'back', label: 'לגבות אותו', hint: 'סיכון אם יתברר שהחשד מבוסס', resolve: (s) => { if (chance(s, 0.4)) { startCrisis(s, 'scandal', 2); fx(s, { playerReputation: -7, playerPopularity: -4 }); return bad('החקירה התרחבה, והגיבוי שנתת נראה עכשיו כטעות.', 'החקירה נגד היועץ מתרחבת'); } fx(s, { playerReputation: -1 }); return meh('החקירה נסגרה מחוסר ראיות. הגיבוי שלך הוכח כנכון, אבל חלק מהציבור נשאר חשדן.'); } },
      { id: 'transparency', label: 'לפרסם את יומן הלשכה ולהזמין בדיקה', hint: '-3 הון', resolve: (s) => { spend(s, 3); fx(s, { playerReputation: 5, playerPopularity: 1 }); return ok('השקיפות הרגיעה את הסערה. פרשנים ציינו את הצעד לחיוב.'); } },
    ],
  },
  {
    id: 'conflict_of_interest', level: 'normal',
    weight: (s) => (s.player.role === 'minister' || isPM(s) ? 0.35 : 0.1),
    make: () => ({ icon: '📑', title: 'חשד לניגוד עניינים', text: 'תחקיר עיתונאי חושף שקרוב משפחה שלך מחזיק מניות בחברה שזכתה במכרז של משרד ממשלתי. אתה לא היית מעורב בהחלטה.' }),
    options: [
      { id: 'recuse', label: 'הסדר ניגוד עניינים מול היועמ״ש', hint: 'מוניטין ↑', resolve: (s) => { fx(s, { playerReputation: 4 }); return ok('חתמת על הסדר ניגוד עניינים, והנושא ירד מסדר היום.'); } },
      { id: 'deny', label: 'להכחיש כל קשר', resolve: (s) => { if (chance(s, 0.35)) { fx(s, { playerReputation: -6, playerPopularity: -3 }); return bad('נחשפו מסמכים נוספים. ההכחשה הפכה לבעיה בפני עצמה.', 'מסמכים חדשים בפרשת ניגוד העניינים'); } fx(s, { playerReputation: -1 }); return meh('הסיפור נשכח אחרי כמה ימים.'); } },
      { id: 'attack', label: 'לתקוף את התחקיר כ"רדיפה פוליטית"', hint: 'בסיס ↑, מרכז ↓', resolve: (s) => { fx(s, { groups: { right: 2, center: -3, liberals: -3 }, playerReputation: -3 }); return meh('הבסיס התגייס לצדך; מצביעי המרכז פחות.'); } },
    ],
  },
  {
    id: 'minister_investigation', level: 'breaking',
    weight: (s) => (isPM(s) && ministers(s).some((p) => p.personality.honesty < 0.4) ? 0.35 : 0),
    make: (s) => {
      const p = pick(s, ministers(s).filter((x) => x.personality.honesty < 0.4).concat(ministers(s)).slice(0, 4));
      return { icon: '🚔', title: 'שר בממשלה נחקר', fromId: p.id, text: `המשטרה פתחה בחקירה נגד ${p.name} בחשד להפרת אמונים במינויים במשרד. ${p.name} מכחיש כל עבירה. האופוזיציה דורשת שיפרוש.` };
    },
    options: [
      { id: 'suspend', label: 'להשעות אותו מתפקידו עד סוף החקירה', hint: 'מוניטין ↑, מפלגתו כועסת', resolve: (s, ev) => { const p = pol(s, ev); if (p?.ministryId) { const m = s.government.ministries.find((x) => x.id === p.ministryId); if (m) m.ministerId = s.government.pmId; p.ministryId = null; } if (p) remember(s, p.id, 'fired', 'הושעה בחקירה', -20); fx(s, { playerReputation: 5, stability: -4 }); return ok('השר הושעה. התיק הועבר זמנית לראש הממשלה.', 'ראש הממשלה השעה את השר הנחקר'); } },
      { id: 'keep', label: 'להשאיר אותו ("חזקת החפות")', hint: 'יציבות נשמרת, מוניטין ↓', resolve: (s, ev) => { if (ev.fromId) remember(s, ev.fromId, 'favor', 'השאיר אותי בתפקיד', 10); fx(s, { playerReputation: -3, groups: { center: -2, liberals: -2 } }); return meh('השר נשאר בתפקיד. ארגוני מנהל תקין עתרו לבג״ץ.'); } },
      { id: 'ag', label: 'להמתין לחוות דעת היועמ״ש', hint: '-2 הון', resolve: (s) => { spend(s, 2); return meh('היועמ״ש תגיש חוות דעת בתור הבא. בינתיים הסערה נמשכת.'); } },
    ],
  },
  {
    id: 'pm_trial', level: 'normal',
    weight: (s) => (s.player.personId === 'likud_1' && !s.flags.trial_done ? 0.6 : 0),
    make: () => ({ icon: '⚖️', title: 'המשפט בתיקים 1000, 2000 ו-4000', text: 'בית המשפט המחוזי קבע ימי חקירה נגדית רצופים בעדותך. אתה מכחיש את כל ההאשמות, ועד להכרעה עומדת לך חזקת החפות. השאלה היא איך לשלב את הדיונים עם ניהול המדינה.' }),
    options: [
      { id: 'testify', label: 'להעיד כמתוכנן', hint: '-6 הון (זמן)', resolve: (s) => { spend(s, 6); fx(s, { playerReputation: 1 }); return meh('העדת כמתוכנן. הדיונים גזלו זמן ניכר מסדר היום של הממשלה.'); } },
      { id: 'postpone', label: 'לבקש דחייה בשל אירועים ביטחוניים ומדיניים', hint: 'בית המשפט יחליט', resolve: (s) => { if (chance(s, 0.5)) return ok('בית המשפט נעתר לחלק מהבקשה וקיצר את ימי הדיונים.'); fx(s, { groups: { center: -2, liberals: -2 }, playerReputation: -2 }); return bad('הבקשה נדחתה. מבקרים טוענים שזה ניסיון למשוך זמן.'); } },
      { id: 'speak', label: 'לדבר בפומבי נגד ניהול ההליך', hint: 'בסיס ↑, מרכז ↓', resolve: (s) => { fx(s, { groups: { right: 3, left: -4, center: -2, liberals: -3 }, playerReputation: -3 }); return meh('הבסיס התגייס לצדך. מבקרים טוענים שהדברים פוגעים באמון במערכת המשפט.'); } },
    ],
  },

  // ======================= EXTREME (BREAKING) =======================
  {
    id: 'terror_attack', level: 'extreme',
    weight: (s) => ((s.flags.drama_terror_cd ?? 0) > s.turn ? 0 : 0.12 + (s.services.security.quality < 55 ? 0.15 : 0) + tension(s) * 0.05),
    make: () => ({ icon: '🚨', title: 'פיגוע', text: 'פיגוע ירי בצומת מרכזי. יש הרוגים ופצועים. המחבל נוטרל. הציבור בהלם, והממשלה נדרשת להגיב.' }),
    options: [
      { id: 'operation', allow: (s) => holds(s, 'defense', 'national_security'), label: 'מבצע מעצרים ממוקד', hint: '₪0.5B, ביטחון ↑', resolve: (s) => { s.flags.drama_terror_cd = s.turn + 3; fx(s, { oneOffCost: 0.5, services: { security: 3 }, groups: { right: 3, settlers: 2 }, stability: 3 }); return ok('כוחות הביטחון עצרו את המעורבים בתשתית. תחושת הביטחון השתפרה בהדרגה.', 'מבצע מעצרים בעקבות הפיגוע'); } },
      { id: 'closure', allow: (s) => holds(s, 'defense'), label: 'סגר ונוכחות מוגברת', hint: 'ביטחון ↑, כלכלה ↓', resolve: (s) => { s.flags.drama_terror_cd = s.turn + 3; fx(s, { services: { security: 2 }, economy: { growth: -0.1 }, groups: { right: 2, arabs: -2, left: -2 } }); return meh('הסגר יימשך כמה ימים. ארגוני זכויות האדם מבקרים את הענישה הקולקטיבית.'); } },
      { id: 'visit', label: 'לבקר את הפצועים ולחזק את המשפחות', hint: '-3 הון', resolve: (s) => { s.flags.drama_terror_cd = s.turn + 3; spend(s, 3); fx(s, { playerPopularity: 3, stability: 2 }); return ok('ביקרת בבית החולים ובבתי המשפחות.'); } },
    ],
  },
  {
    id: 'market_crash', level: 'extreme',
    weight: (s) => ((s.flags.drama_crash_cd ?? 0) > s.turn ? 0 : 0.1 + (deficitPct(s) > 4.5 ? 0.35 : 0) + (s.economy.growth < 1.2 ? 0.3 : 0) + tension(s) * 0.15),
    make: () => ({ icon: '📉', title: 'קריסה בבורסה', text: 'הבורסה בתל אביב צנחה ב-12% ביום אחד, והשקל נחלש בחדות. משקיעים זרים מוכרים, ובנק ישמעאל מתכנס לישיבת חירום.' }),
    options: [
      { id: 'bailout', allow: (s) => holds(s, 'finance'), label: 'חבילת סיוע של ₪15 מיליארד', hint: 'חוב ↑↑, יציבות', resolve: (s) => { s.flags.drama_crash_cd = s.turn + 4; fx(s, { oneOffCost: 15, economy: { growth: -0.3, unemployment: 0.2 }, groups: { highIncome: 2, lowIncome: -2 } }); return meh('השווקים התייצבו, אבל החוב הציבורי עלה משמעותית.', 'הממשלה מזרימה ₪15 מיליארד לייצוב השווקים'); } },
      { id: 'nothing', allow: (s) => holds(s, 'finance'), label: 'לא להתערב', hint: 'סיכון למיתון', resolve: (s) => { s.flags.drama_crash_cd = s.turn + 4; fx(s, { economy: { growth: -1.8, unemployment: 1, inflation: -0.3 }, groups: { highIncome: -6, middleClass: -4, youth: -3 } }); startCrisis(s, 'layoffs', 3); return bad('השווקים המשיכו לרדת והמשק נכנס להאטה. גל פיטורים בדרך.', 'האטה כלכלית: הממשלה בחרה לא להתערב'); } },
      { id: 'reassure', label: 'הודעה משותפת עם נגיד הבנק', hint: '-6 הון, 60%', resolve: (s) => { s.flags.drama_crash_cd = s.turn + 4; spend(s, 6); if (chance(s, 0.6)) { fx(s, { playerReputation: 4 }); return ok('ההודעה הרגיעה את השווקים. הירידות נעצרו.'); } fx(s, { economy: { growth: -0.8, unemployment: 0.4 } }); return bad('השווקים לא נרגעו. הירידות נמשכו עוד כמה ימים.'); } },
    ],
  },
  {
    id: 'general_strike', level: 'extreme',
    weight: (s) => ((s.flags.drama_strike_cd ?? 0) > s.turn ? 0 : 0.08 + Math.max(0, 48 - s.population.groups.publicSector.satisfaction) / 40 + (s.economy.inflation > 4 ? 0.25 : 0)),
    make: () => ({ icon: '🛑', title: 'שביתה כללית', text: 'ההסתדרות הכריזה על שביתה כללית: נמלים, נמל התעופה, משרדי ממשלה ובנקים מושבתים. יו״ר ההסתדרות: "השביתה תימשך עד שהממשלה תחזור לשולחן המשא ומתן."' }),
    options: [
      { id: 'cave', allow: (s) => holds(s, 'finance', 'labor'), label: 'להיענות לדרישות', hint: 'עובדי ציבור ↑↑, גירעון ↑', resolve: (s) => { s.flags.drama_strike_cd = s.turn + 4; fx(s, { budget: { welfare: 2, education: 1.5, health: 1.5, government: 1 }, groups: { publicSector: 10, lowIncome: 2, highIncome: -2 } }); return meh('נחתם הסכם קיבוצי חדש. הגירעון יגדל.', 'השביתה הסתיימה: הממשלה נענתה לדרישות'); } },
      { id: 'orders', allow: (s) => holds(s, 'finance', 'labor'), label: 'פנייה לבית הדין לעבודה', hint: '-15 הון, 60%', resolve: (s) => { s.flags.drama_strike_cd = s.turn + 4; spend(s, 15); if (chance(s, 0.6)) { fx(s, { groups: { publicSector: -8, highIncome: 3, right: 2 }, playerReputation: 3 }); return ok('בית הדין הורה על חזרה לעבודה ועל משא ומתן.', 'בית הדין לעבודה: לחזור לעבודה'); } fx(s, { groups: { publicSector: -10 }, economy: { growth: -0.8 }, stability: -8 }); return bad('בית הדין דחה את הבקשה. השביתה נמשכת.'); } },
      { id: 'negotiate', allow: (s) => holds(s, 'finance', 'labor'), label: 'משא ומתן ופשרה', hint: 'עולה פחות, לוקח זמן', resolve: (s) => { s.flags.drama_strike_cd = s.turn + 4; fx(s, { budget: { welfare: 0.8, health: 0.6 }, economy: { growth: -0.3 }, groups: { publicSector: 4, families: -1 } }); return meh('אחרי שבוע הושגה פשרה. הנזק למשק מוגבל.'); } },
    ],
  },
  {
    id: 'mass_protest', level: 'extreme',
    weight: (s) => ((s.flags.drama_siege_cd ?? 0) > s.turn ? 0 : Math.max(0, tension(s) - 0.35) * 0.9),
    make: (s) => {
      const g = angriestGroup(s);
      return { icon: '🪧', title: 'מחאה המונית', vars: { group: g }, text: `${GROUP_BY_ID[g].emoji} ${GROUP_BY_ID[g].name} יצאו להפגנה המונית מול הכנסטון ובצמתים ברחבי הארץ. המפגינים דורשים שינוי מיידי במדיניות.` };
    },
    options: [
      { id: 'speech', label: 'לפנות למפגינים ישירות', hint: 'הימור', resolve: (s, ev) => { s.flags.drama_siege_cd = s.turn + 3; const g = String(ev.vars.group) as GroupId; if (rand(s) < 0.4 + me(s).popularity / 200 + s.player.reputation / 300) { fx(s, { playerPopularity: 8, groups: { [g]: 7 } }); s.career.memorable.push('הנאום מול המפגינים'); return ok('הנאום הכן התקבל בכבוד. נציגי המחאה הסכימו להיפגש.', '"אני שומע אתכם": הנאום מול המפגינים'); } fx(s, { playerPopularity: -8, groups: { [g]: -4 }, stability: -5 }); return bad('המפגינים קטעו את הנאום. התמונות מהאירוע מופצות בביקורת.'); } },
      { id: 'give', allow: (s) => holds(s, 'finance'), label: 'להיענות לדרישה המרכזית', hint: '₪3 מיליארד', resolve: (s, ev) => { s.flags.drama_siege_cd = s.turn + 3; const g = String(ev.vars.group) as GroupId; const cat = GROUP_CAT[g] ?? 'welfare'; fx(s, { budget: { [cat]: 3 }, groups: { [g]: 9 }, stability: 3 }); return meh(`₪3 מיליארד ל${CATEGORY_BY_ID[cat].name}. המחאה התפזרה, וקבוצות אחרות לומדות שמחאה עובדת.`, 'הממשלה נענתה לדרישות המפגינים'); } },
      { id: 'dialogue', label: 'להקים צוות הידברות עם נציגי המחאה', hint: '-5 הון, 50%', resolve: (s, ev) => { s.flags.drama_siege_cd = s.turn + 3; spend(s, 5); const g = String(ev.vars.group) as GroupId; if (chance(s, 0.5)) { fx(s, { groups: { [g]: 4 }, stability: 2 }); return ok('הצוות הציג מתווה מוסכם, והמחאה נרגעה.'); } fx(s, { groups: { [g]: -5 }, stability: -6, playerPopularity: -4 }); return bad('נציגי המחאה פרשו מהשיחות, והמחאה התרחבה.', 'המחאה מתרחבת'); } },
    ],
  },
  {
    id: 'pm_hospital', level: 'extreme',
    weight: (s) => (!isPM(s) && s.turn > 2 && (s.flags.drama_hosp_cd ?? 0) <= s.turn ? 0.15 : 0),
    make: (s) => ({ icon: '🏥', title: 'ראש הממשלה אושפז', fromId: s.government.pmId, text: `${s.politicians[s.government.pmId]?.name} אושפז בלילה לבדיקות. מצבו מוגדר יציב, אבל במערכת הפוליטית כבר מדברים על היום שאחרי.` }),
    options: [
      { id: 'grab', label: 'להציג את עצמך כמנהיג חלופי', hint: 'כוח ↑, ראש הממשלה יזכור', resolve: (s, ev) => { s.flags.drama_hosp_cd = s.turn + 5; const w = me(s).power > 40 ? chance(s, 0.6) : chance(s, 0.3); remember(s, ev.fromId!, 'betrayal', 'ניצל את האשפוז שלי', -25); if (w) { me(s).power = clamp(me(s).power + 12); fx(s, { playerPopularity: 5 }); return ok('פרשנים מציינים אותך כמי שמוכן להנהגה.', 'בזמן האשפוז: מועמד חדש להנהגה'); } fx(s, { playerPopularity: -4 }); return bad('המהלך נתפס כחסר רגישות.'); } },
      { id: 'wishes', label: 'לאחל החלמה מהירה', resolve: (s, ev) => { s.flags.drama_hosp_cd = s.turn + 5; remember(s, ev.fromId!, 'favor', 'איחל החלמה', 14); return ok('ראש הממשלה חזר לעבודה כעבור ימים ספורים והודה לך על הפנייה.'); } },
      { id: 'transparency', label: 'לדרוש שקיפות רפואית', hint: 'מוניטין ↑, יחסים ↓', resolve: (s, ev) => { s.flags.drama_hosp_cd = s.turn + 5; remember(s, ev.fromId!, 'insult', 'דרש לפרסם את מצבי הרפואי', -12); fx(s, { playerReputation: 3 }); return meh('לשכת ראש הממשלה פרסמה סיכום רפואי. בלשכה לא אהבו את הדרישה.'); } },
    ],
  },
  {
    id: 'border_escalation', level: 'extreme',
    weight: (s) => ((s.flags.drama_war_cd ?? 0) > s.turn ? 0 : 0.07 + (s.services.security.quality < 55 ? 0.2 : 0)),
    make: () => ({ icon: '🚀', title: 'הסלמה בגבול הצפון', text: 'ירי רקטות וכטב״מים לעבר יישובי הגליל. מערכת ההגנה האווירית יירטה את רובם, אך נגרמו נזקים. הרמטכ״ל מציג לקבינט כמה אפשרויות תגובה.' }),
    options: [
      { id: 'strike', allow: (s) => holds(s, 'defense'), label: 'תקיפה ממוקדת של חיל האוויר', hint: '₪1B, הרתעה ↑, סיכון להסלמה', resolve: (s) => { s.flags.drama_war_cd = s.turn + 4; fx(s, { oneOffCost: 1, services: { security: 4 }, groups: { right: 4, periphery: 2 }, stability: 4 }); if (chance(s, 0.3)) { startCrisis(s, 'border', 2); return bad('התקיפה הצליחה, אבל הצד השני הגיב בירי נוסף. ימי לחימה בצפון.'); } return ok('התקיפה פגעה במשגרים ובמפקדים. השקט חזר לגבול.', 'חיל האוויר תקף בתגובה לירי'); } },
      { id: 'reserves', allow: (s) => holds(s, 'defense'), label: 'גיוס מילואים ותגבור הגבול', hint: '₪3B, כלכלה ↓', resolve: (s) => { s.flags.drama_war_cd = s.turn + 4; fx(s, { oneOffCost: 3, services: { security: 5 }, economy: { growth: -0.4 }, groups: { reservists: -4, right: 3, families: -2 }, stability: 5 }); return meh('עשרות אלפי משרתי מילואים גויסו. המתיחות ירדה, והמחיר הכלכלי והאישי ניכר.', 'גיוס מילואים בצפון'); } },
      { id: 'mediation', allow: (s) => holds(s, 'defense', 'foreign'), label: 'מסר דרך מתווכים בינלאומיים', hint: '-10 הון, 50%', resolve: (s) => { s.flags.drama_war_cd = s.turn + 4; spend(s, 10); if (chance(s, 0.5)) { fx(s, { groups: { left: 3, center: 2 }, playerReputation: 5 }); return ok('בתיווך בינלאומי הושגה הבנה, והירי נפסק.', 'בתיווך בינלאומי: הירי נפסק'); } fx(s, { groups: { right: -5 }, services: { security: -3 } }); startCrisis(s, 'border', 2); return bad('התיווך נכשל, והירי נמשך. בימין מבקרים את ההססנות.'); } },
    ],
  },
  {
    id: 'cabinet_revolt', level: 'extreme',
    weight: (s) => (isPM(s) && s.government.stability < 55 && (s.flags.drama_revolt_cd ?? 0) <= s.turn ? 0.25 + (55 - s.government.stability) / 60 : 0),
    make: (s) => {
      const rebels = ministers(s).sort((a, b) => a.loyalty - b.loyalty).slice(0, 3);
      return { icon: '⚔️', title: 'מרד שרים', vars: { ids: rebels.map((r) => r.id).join(',') }, text: `${rebels.map((r) => r.name).join(', ')} פרסמו מכתב משותף: אם לא יהיה שינוי במדיניות ובתקציבים, הם יפעלו להפלת הממשלה.` };
    },
    options: [
      { id: 'budgets', label: 'להעניק תוספות תקציב למשרדיהם', hint: '₪1B לכל משרד', resolve: (s, ev) => { s.flags.drama_revolt_cd = s.turn + 3; for (const id of String(ev.vars.ids).split(',').filter(Boolean)) { const m = s.government.ministries.find((x) => x.ministerId === id); const cat = m?.categories[0]; if (cat) fx(s, { budget: { [cat]: 1 } }); remember(s, id, 'deal', 'קיבל תקציב במרד', 15); } fx(s, { stability: 8, groups: { center: -2 } }); return meh('המשבר נרגע בינתיים, אבל נוצר תקדים: לחץ משתלם.', 'המשבר בממשלה נפתר בתוספות תקציב'); } },
      { id: 'fire', label: 'להעביר אותם מתפקידם', hint: 'מסוכן לקואליציה', resolve: (s, ev) => { s.flags.drama_revolt_cd = s.turn + 3; for (const id of String(ev.vars.ids).split(',').filter(Boolean)) { const p = s.politicians[id]; const m = s.government.ministries.find((x) => x.ministerId === id); if (m) m.ministerId = s.government.pmId; if (p) { p.ministryId = null; remember(s, id, 'fired', 'פוטר במרד', -35); } } fx(s, { stability: -12, playerPopularity: 3, playerReputation: 3 }); s.career.memorable.push('פיטר שלושה שרים בבת אחת'); return meh('השרים הועברו מתפקידם. הציבור מתרשם מהנחישות; השותפות מודאגות.', 'ראש הממשלה פיטר את השרים המורדים'); } },
      { id: 'elections', label: 'ללכת לבחירות', resolve: (s) => { s.flags.drama_revolt_cd = s.turn + 3; callEarlyElections(s, 'מרד שרים'); return meh('הכנסטון מתפזר. הבחירות יתקיימו בתוך כ-90 יום.'); } },
    ],
  },
  {
    id: 'phone_hack', level: 'extreme',
    weight: (s) => ((s.flags.drama_phone_cd ?? 0) > s.turn ? 0 : 0.1 + (s.services.security.quality < 50 ? 0.1 : 0)),
    make: () => ({ icon: '📱', title: 'פריצה לטלפון שלך', text: 'קבוצת האקרים המזוהה עם מדינה עוינת טוענת שפרצה לטלפון שלך ומאיימת לפרסם התכתבויות פרטיות בתוך 48 שעות.' }),
    options: [
      { id: 'cyber', label: 'לפנות למערך הסייבר הלאומי', hint: '-4 הון', resolve: (s) => { s.flags.drama_phone_cd = s.turn + 5; spend(s, 4); if (chance(s, 0.7)) { fx(s, { playerReputation: 2 }); return ok('מערך הסייבר זיהה את הפריצה ובלם את הפרסום. החומר שפורסם התגלה כמזויף.', 'מערך הסייבר: ניסיון השפעה זר נבלם'); } fx(s, { playerPopularity: -5 }); return bad('חלק מההתכתבויות פורסמו. רובן אישיות, אבל חלקן מביכות פוליטית.'); } },
      { id: 'first', label: 'להקדים ולפרסם הודעה לציבור', hint: 'כאב קטן עכשיו', resolve: (s) => { s.flags.drama_phone_cd = s.turn + 5; fx(s, { playerPopularity: -1, playerReputation: 4 }); return ok('ההודעה הפומבית ניטרלה את האיום. הציבור הבין שמדובר בהתקפה זרה.'); } },
      { id: 'ignore', label: 'להתעלם מהאיום', hint: 'הימור', resolve: (s) => { s.flags.drama_phone_cd = s.turn + 5; if (chance(s, 0.5)) return ok('האיום התגלה כבלוף.'); fx(s, { playerPopularity: -7, playerReputation: -4 }); return bad('ההתכתבויות פורסמו, והתגובה שלך התעכבה.'); } },
    ],
  },
  {
    id: 'defector', level: 'breaking',
    weight: (s) => (isPM(s) && coalitionSeats(s) < MAJORITY + 3 ? 0.6 : 0),
    make: (s) => {
      const p = pick(s, Object.values(s.politicians).filter((x) => x.active && !x.isPlayer && !s.government.coalition.includes(x.partyId) && s.parties[x.partyId]?.leaderId !== x.id));
      return { icon: '🔀', title: 'ח״כ אופוזיציה מוכן לעבור לקואליציה', fromId: p?.id, text: `${p?.name} פנה אליך בשקט: הוא מוכן לפרוש מסיעתו ולהצטרף לקואליציה, בתמורה לתפקיד בממשלה.` };
    },
    options: [
      { id: 'accept', label: 'לקבל אותו (+1 מנדט לקואליציה)', hint: 'מרכז ↓, הבטחה לתפקיד', resolve: (s, ev) => { const p = pol(s, ev); if (!p) return meh('הוא חזר בו.'); const from = s.parties[p.partyId]; const to = s.parties[s.player.partyId]; from.memberIds = from.memberIds.filter((x) => x !== p.id); from.seats = Math.max(0, from.seats - 1); to.memberIds.push(p.id); to.seats += 1; p.partyId = to.id; remember(s, p.id, 'promise', 'תפקיד בממשלה', 10, s.turn + 3, 'role'); fx(s, { groups: { center: -3, left: -2 }, stability: 4 }); return meh(`${p.name} עבר לקואליציה. בסיעתו הקודמת מאשימים אותו בבגידה בבוחרים.`, `${p.name} פורש מסיעתו ומצטרף לקואליציה`); } },
      { id: 'refuse', label: 'לסרב', resolve: (s) => { fx(s, { playerReputation: 4, playerPopularity: 1 }); return ok('סירבת. "אנחנו לא בונים קואליציה על עריקות", אמרת.'); } },
    ],
  },
];

export const DRAMA_BY_ID = Object.fromEntries(DRAMAS.map((d) => [d.id, d])) as Record<string, DramaDef>;
