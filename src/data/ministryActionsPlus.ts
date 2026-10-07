// ============================================================
// Actions every minister can take, whatever the portfolio:
// appointments, management, public communication, and pressure on the PM.
// ============================================================
import type { BudgetCategory, Ministry } from '../types/game';
import type { MinistryActionSpec } from './ministryActions';

const cat = (m?: Ministry): BudgetCategory | undefined => m?.categories[0];
const bud = (m: Ministry | undefined, amount: number) => (cat(m) ? { [cat(m)!]: amount } : {});
const svc = (m: Ministry | undefined, amount: number) => (m?.services[0] ? { [m.services[0]]: amount } : {});

export const GENERIC_MINISTER_ACTIONS: MinistryActionSpec[] = [
  { id: 'gen_pro_dg', cat: 'appoint', title: 'מינוי מנכ״ל מקצועי', icon: '🎓', desc: 'מנכ״ל עם ניסיון בתחום: יעילות המשרד +12. חברי המפלגה היו מעדיפים מינוי פוליטי.', capital: 4, cooldown: 4,
    effects: () => ({ playerReputation: 5 }), mutate: (_s, m) => { m.efficiency = Math.min(100, m.efficiency + 12); },
    outcomes: [
      { w: 7, text: 'המנכ״ל החדש הציג תוכנית עבודה מסודרת, והמשרד התחיל לעבוד מהר יותר.', tone: 'good' },
      { w: 3, text: 'חברי המפלגה מבקרים את המינוי: "לא מינית אחד משלנו".', tone: 'neutral' },
    ] },
  { id: 'gen_political_dg', cat: 'appoint', title: 'מינוי מנכ״ל מקורב', icon: '🤝', desc: 'מינוי איש אמון מהמפלגה: שליטה מלאה במשרד, אבל יעילות -10 וחשש לביקורת.', capital: 3, cooldown: 4,
    effects: () => ({ playerReputation: -3, stability: 1 }), mutate: (_s, m) => { m.efficiency = Math.max(0, m.efficiency - 10); m.bureaucracy = Math.min(100, m.bureaucracy + 4); },
    outcomes: [
      { w: 6, text: 'המינוי עבר. במשרד מתלוננים על חוסר ניסיון.', tone: 'neutral' },
      { w: 4, text: 'נציבות שירות המדינה פתחה בבדיקה של המינוי.', effects: { playerPopularity: -3, playerReputation: -3 }, headline: 'בדיקה: מינוי פוליטי לתפקיד מנכ״ל', tone: 'bad' },
    ] },
  { id: 'gen_work_plan', cat: 'policy', title: 'תוכנית עבודה שנתית', icon: '🗂️', desc: 'יעדים מדידים לכל אגף: יעילות +5, ביורוקרטיה -5.', capital: 2, cooldown: 3,
    effects: () => ({ playerReputation: 2 }), mutate: (_s, m) => { m.efficiency = Math.min(100, m.efficiency + 5); m.bureaucracy = Math.max(0, m.bureaucracy - 5); },
    note: 'התוכנית פורסמה לציבור, וביקורת המדינה תבחן את העמידה ביעדים.' },
  { id: 'gen_transparency', cat: 'media', title: 'פרסום דוח שקיפות', icon: '📊', desc: 'פרסום יומן השר, הוצאות המשרד ונתוני ביצוע. מחזק אמון.', capital: 1, cooldown: 3,
    effects: () => ({ playerReputation: 4, groups: { center: 1, liberals: 1 } }) },
  { id: 'gen_field_tour', cat: 'media', title: 'סיור עבודה בשטח', icon: '🚐', desc: 'פגישות עם עובדי המשרד ועם הציבור שמקבל את השירות.', capital: 1, cooldown: 2,
    effects: () => ({}),
    outcomes: [
      { w: 7, text: 'הסיור חשף בעיות אמיתיות, וחלקן טופלו מיד.', effects: (_s, m) => ({ playerPopularity: 2, services: svc(m, 1) }), tone: 'good' },
      { w: 3, text: 'הסיור נתפס כאירוע יחסי ציבור בלי תוכן.', effects: { playerPopularity: -1 }, tone: 'neutral' },
    ] },
  { id: 'gen_press', cat: 'media', title: 'הצגת הישגי המשרד בתקשורת', icon: '🎙️', desc: 'מסיבת עיתונאים על פעילות המשרד. עובד טוב כשיש הישגים אמיתיים.', capital: 2, cooldown: 2,
    effects: () => ({}),
    outcomes: [
      { w: 6, text: 'הנתונים שהוצגו התקבלו היטב.', effects: { playerPopularity: 3 }, tone: 'good' },
      { w: 4, text: 'עיתונאים הציגו נתונים סותרים. הסיקור היה ביקורתי.', effects: { playerPopularity: -2, playerReputation: -1 }, tone: 'bad' },
    ] },
  { id: 'gen_committee', cat: 'law', title: 'הופעה בוועדת הכנסטון', icon: '📑', desc: 'הצגת עמדת המשרד ומענה לשאלות ח״כים מכל הסיעות.', capital: 1, cooldown: 2,
    effects: () => ({ playerReputation: 2 }), note: 'הדיון היה ענייני. חברי הוועדה ביקשו נתונים נוספים.' },
  { id: 'gen_regulation', cat: 'law', title: 'הפחתת רגולציה בתחום המשרד', icon: '📉', desc: 'ביטול טפסים ואישורים מיותרים: ביורוקרטיה -8.', capital: 2, cooldown: 3,
    effects: () => ({ groups: { selfEmployed: 2, center: 1 } }), mutate: (_s, m) => { m.bureaucracy = Math.max(0, m.bureaucracy - 8); } },
  { id: 'gen_pressure_pm', cat: 'budget', title: 'לחץ על ראש הממשלה לתוספת תקציב', icon: '🚪', desc: 'הבהרה שבלי תוספת לא תוכל להמשיך בתפקיד. עלול לעבוד, ועלול לפגוע ביחסים.', capital: 3, cooldown: 4,
    effects: () => ({}),
    outcomes: [
      { w: 5, text: 'ראש הממשלה אישר תוספת של ₪1.5 מיליארד למשרד.', effects: (_s, m) => ({ budget: bud(m, 1.5) }), tone: 'good' },
      { w: 5, text: 'ראש הממשלה סירב, והסירוב פורסם. נשארת בתפקיד, ומעמדך נפגע.', effects: { playerReputation: -4, playerPopularity: -2 }, headline: 'השר איים להתפטר, ונשאר בתפקיד', tone: 'bad' },
    ] },
  { id: 'gen_internal_audit', cat: 'policy', title: 'ביקורת פנימית במשרד', icon: '🔎', desc: 'בדיקת מכרזים, מינויים והתקשרויות. עשויה לחשוף ליקויים.', capital: 2, cooldown: 3,
    effects: () => ({ playerReputation: 2 }),
    outcomes: [
      { w: 7, text: 'הביקורת מצאה ליקויים קטנים שתוקנו.', tone: 'good' },
      { w: 3, text: 'הביקורת חשפה ליקויים חמורים מתקופות קודמות. הם עלו לכותרות.', effects: { playerReputation: 3, stability: -2 }, headline: 'ביקורת פנימית חשפה ליקויים במשרד ממשלתי', tone: 'neutral' },
    ] },
  { id: 'gen_union_clash', cat: 'extreme', title: 'עימות עם ועד העובדים', icon: '⚔️', desc: 'ביטול הסכמים קיבוציים כדי להוריד עלויות ולהגביר יעילות. עלול להוביל לשביתה.', capital: 5, cooldown: 4,
    effects: (_s, m) => ({ groups: { publicSector: -10, right: 2, selfEmployed: 3 }, services: svc(m, -3) }), mutate: (_s, m) => { m.efficiency = Math.min(100, m.efficiency + 10); m.bureaucracy = Math.max(0, m.bureaucracy - 10); },
    outcomes: [
      { w: 5, text: 'הוועד נכנע לחלק מהדרישות. המשרד יעיל יותר; האווירה קשה.', tone: 'good' },
      { w: 5, text: 'הוועד הכריז על שביתה. השירות לציבור שובש.', crisis: 'transport_strike', headline: 'שביתה במשרד ממשלתי בעקבות עימות עם השר', tone: 'bad' },
    ] },
];

/** Reserved for portfolio-specific extensions; the main catalogue lives in MINISTRY_ACTIONS. */
export const EXTRA_MINISTRY_ACTIONS: Record<string, MinistryActionSpec[]> = {};
