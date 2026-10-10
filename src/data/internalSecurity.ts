// Internal-security options: the police, the Shin Bet's domestic work, prisons and public order.
// Open to the prime minister and to the minister of national security (not to the defense minister).
import type { Effects } from '../types/game';

export interface InternalOption {
  id: string;
  icon: string;
  title: string;
  desc: string;
  capital: number;
  cooldown: number;
  /** annual budget added to the police line, in ₪B (a real, lasting cost) */
  cost?: number;
  /** chance it works as planned; the police budget and the ministry's efficiency push it up */
  base: number;
  good: Effects;
  bad: Effects;
  goodText: string;
  badText: string;
}

export const INTERNAL_OPTIONS: InternalOption[] = [
  { id: 'crime_sweep', icon: '🚓', title: 'מבצע ארצי נגד ארגוני פשיעה', desc: 'פשיטות מתואמות על ארגוני הפשיעה, החרמת נשק ורכוש.', capital: 6, cooldown: 4, cost: 0.4, base: 0.65,
    good: { services: { security: 3 }, groups: { arabs: 4, periphery: 3, families: 2, right: 2 }, playerPopularity: 2 }, bad: { groups: { arabs: -2, liberals: -1 }, playerReputation: -1 },
    goodText: 'עשרות עצורים ומאות כלי נשק נתפסו. התושבים מדווחים על ירידה בירי.', badText: 'המבצע נחשף מראש, והחשודים נעלמו. הציבור שואל איפה המשטרה.' },
  { id: 'terror_cells', icon: '🕵️', title: 'סיכול חוליות טרור', desc: 'פעילות משותפת של השב״כ והמשטרה נגד תשתיות טרור בפנים המדינה.', capital: 5, cooldown: 3, base: 0.7,
    good: { services: { security: 3 }, groups: { right: 3, settlers: 2, families: 2 }, stability: 2 }, bad: { groups: { right: -2 }, stability: -1 },
    goodText: 'חוליה תוכננה לפיגוע סוכלה ברגע האחרון. מערכת הביטחון מקבלת מחמאות.', badText: 'הסיכול נכשל חלקית: חשוד ברח ומתקיים מצוד.' },
  { id: 'arrests', icon: '⛓️', title: 'מעצרים נגד מסיתים ופורעי חוק', desc: 'מעצרים מנהליים ופליליים נגד מסיתים ואלימים בהפגנות ובמרשתת.', capital: 4, cooldown: 3, base: 0.7,
    good: { groups: { right: 4, settlers: 2, left: -3, arabs: -3, liberals: -3 }, services: { security: 1 } }, bad: { groups: { left: -2, liberals: -3, right: -1 }, playerReputation: -2 },
    goodText: 'המעצרים הרגיעו את השטח, ארגוני זכויות האדם מוחים.', badText: 'בית המשפט שחרר את רוב העצורים ופסק נגד המשטרה.' },
  { id: 'border_police', icon: '🚔', title: 'תגבור מג״ב בערים מעורבות', desc: 'כוחות מג״ב נוספים בלוד, עכו, רמלה וחיפה בימי מתיחות.', capital: 4, cooldown: 3, cost: 0.4, base: 0.75,
    good: { services: { security: 2 }, groups: { right: 2, families: 2, arabs: -2 } }, bad: { groups: { arabs: -4, left: -2 }, stability: -1 },
    goodText: 'נוכחות כוחות הרגיעה את הערים המעורבות.', badText: 'אירוע אלים בין שוטרים לתושבים הלהיב את הרוחות.' },
  { id: 'community_policing', icon: '🏘️', title: 'שיטור קהילתי בשכונות', desc: 'שוטר קבוע לכל שכונה ומוקדי שיטור בשכונות מוזנחות.', capital: 3, cooldown: 4, cost: 0.5, base: 0.8,
    good: { services: { security: 2 }, groups: { periphery: 3, families: 3, elderly: 2, arabs: 1 }, playerPopularity: 1 }, bad: { groups: { periphery: -1 } },
    goodText: 'תחושת הביטחון בשכונות עולה, ותושבים משתפים פעולה עם המשטרה.', badText: 'מחסור בכוח אדם עיכב את הפריסה. התוצאות יגיעו מאוחר יותר.' },
  { id: 'gun_licenses', icon: '🔫', title: 'הרחבת רישיונות נשק', desc: 'הקלות במתן רישיונות נשק לאזרחים שעברו הכשרה.', capital: 3, cooldown: 5, base: 0.6,
    good: { groups: { right: 4, settlers: 3, periphery: 2, liberals: -3, left: -3 }, services: { security: 1 } }, bad: { groups: { liberals: -4, left: -3, families: -2 }, playerReputation: -2 },
    goodText: 'אלפי אזרחים הגישו בקשות. תומכי המהלך מדברים על הרתעה.', badText: 'אירוע ירי עם נשק מורשה הביא לביקורת חריפה על המדיניות.' },
  { id: 'prison_reform', icon: '🏢', title: 'שיפור תנאי הכליאה והשיקום', desc: 'הרחבת שטחי מחיה ותוכניות שיקום לאסירים כדי להפחית חזרה לפשע.', capital: 3, cooldown: 5, cost: 0.6, base: 0.75,
    good: { groups: { liberals: 3, left: 2, right: -2, arabs: 1 }, services: { security: 1 } }, bad: { groups: { right: -3 }, playerReputation: -1 },
    goodText: 'שיעור החזרה לפשע יורד בהדרגה. הימין מבקר: "אסירים בפינוק".', badText: 'הוצאות הכליאה עלו מעבר לתכנון והתוכנית נבלמה.' },
  { id: 'cyber_fraud', icon: '💻', title: 'יחידה נגד פשיעת רשת והונאות', desc: 'חיזוק היחידה הארצית נגד הונאות טלפוניות ופשיעה ברשת.', capital: 3, cooldown: 4, cost: 0.3, base: 0.75,
    good: { groups: { elderly: 3, families: 2, youth: 1 }, services: { security: 1 }, playerPopularity: 1 }, bad: { groups: { elderly: -1 } },
    goodText: 'כמה רשתות הונאה פורקו. המשפחות מדווחות על ירידה בניסיונות.', badText: 'המבצעים נתקלו בקושי לאתר את הנאשמים בחו״ל.' },
  { id: 'riot_response', icon: '🛡️', title: 'מענה להפגנה אלימה', desc: 'הנחיה למשטרה להגיב בכוח מוגבר להפגנה שיצאה משליטה.', capital: 5, cooldown: 3, base: 0.55,
    good: { stability: 3, groups: { right: 2, center: 1 }, playerPopularity: 1 }, bad: { stability: -4, groups: { liberals: -3, left: -3, youth: -3 }, playerReputation: -2 },
    goodText: 'המהומה הוכלה במהירות ובלי נפגעים.', badText: 'תמונות של אלימות משטרתית עלו לכותרות והפגנות נוספות נקראו.' },
  { id: 'traffic_enforcement', icon: '🚦', title: 'אכיפה נגד נהיגה פרועה', desc: 'שוטרים נוספים בכבישים, מצלמות והחרמת רכבים מסוכנים.', capital: 2, cooldown: 3, cost: 0.2, base: 0.8,
    good: { groups: { families: 3, elderly: 2, youth: -2 }, services: { security: 1 } }, bad: { groups: { youth: -3, selfEmployed: -1 } },
    goodText: 'מספר ההרוגים בכבישים ירד בחודשים האחרונים.', badText: 'הקנסות הכבדים עוררו כעס ולא ירדה כמות התאונות.' },
];
export const INTERNAL_BY_ID = Object.fromEntries(INTERNAL_OPTIONS.map((o) => [o.id, o]));
