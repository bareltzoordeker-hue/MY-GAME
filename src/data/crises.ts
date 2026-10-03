import type { CrisisAction, Effects, GameState, GroupId, ServiceId } from '../types/game';
import { debtPct, deficitPct } from '../utils';

export interface CrisisDef {
  id: string;
  title: string;
  icon: string;
  category: string;
  ministryId?: string;
  duration: number;
  services: ServiceId[];
  groups: GroupId[];
  /** probability per turn given the state (0 = cannot happen). Must reflect the game state. */
  trigger: (s: GameState) => number;
  perTurn: Effects; // multiplied by severity
  impact: string[];
  actions: CrisisAction[];
  headline: string;
}

const q = (s: GameState, id: ServiceId) => s.services[id].quality;
const summer = (s: GameState) => s.date.month >= 5 && s.date.month <= 9;
const winter = (s: GameState) => s.date.month >= 11 || s.date.month <= 2;
const ratio = (s: GameState, c: keyof GameState['budget']['allocations']) => s.budget.allocations[c] / s.budget.needs[c];

const ignore: CrisisAction = { id: 'ignore', label: 'להתעלם ולקוות לטוב', hint: 'בלי עלות. המשבר ימשיך.', cost: 0, capital: 0, successChance: 0, effects: { playerPopularity: -2 } };

export const CRISES: CrisisDef[] = [
  {
    id: 'transport_strike', title: 'שביתת נהגי האוטובוסים', icon: '🚌', category: 'תחבורה', ministryId: 'transport', duration: 3,
    services: ['transport'], groups: ['employees', 'students', 'youth'],
    trigger: (s) => (q(s, 'transport') < 45 ? 0.12 : 0) + (ratio(s, 'transport') < 0.9 ? 0.08 : 0),
    perTurn: { services: { transport: -3 }, groups: { employees: -2, students: -2, youth: -1.5 }, economy: { growth: -0.15 } },
    impact: ['30% מהקווים מושבתים', 'זמני נסיעה +25 דק׳'],
    actions: [
      { id: 'deal', label: 'הסכם שכר', hint: '₪1.2 מיליארד, פותר מיד', cost: 1.2, capital: 0, successChance: 1, effects: { groups: { publicSector: 2 } } },
      { id: 'order', label: 'צו מניעה', hint: '-10 הון פוליטי, 60% הצלחה', cost: 0, capital: 10, successChance: 0.6, effects: { groups: { publicSector: -4, left: -2 } } },
      ignore,
    ],
    headline: 'הנהגים שובתים, הפקקים חוגגים',
  },
  {
    id: 'er_collapse', title: 'קריסת חדרי המיון', icon: '🚑', category: 'בריאות', ministryId: 'health', duration: 2,
    services: ['health'], groups: ['elderly', 'retirees', 'families'],
    trigger: (s) => (winter(s) && q(s, 'health') < 50 ? 0.22 : 0) + (q(s, 'health') < 38 ? 0.1 : 0),
    perTurn: { services: { health: -3 }, groups: { elderly: -3, retirees: -3, families: -1.5 } },
    impact: ['המתנה של 14 שעות במיון', 'מיטות במסדרונות'],
    actions: [
      { id: 'emergency', label: 'תקציב חירום למיון', hint: '₪1.5 מיליארד', cost: 1.5, capital: 0, successChance: 1, effects: { services: { health: 3 }, groups: { elderly: 2 } } },
      { id: 'army_medics', label: 'גיוס חובשים צבאיים', hint: '-8 הון, 70% הצלחה', cost: 0.2, capital: 8, successChance: 0.7, effects: { groups: { soldiers: -2 } } },
      ignore,
    ],
    headline: 'גל שפעת: חולים ממתינים במסדרון, השר ממתין לסקר',
  },
  {
    id: 'teachers_strike', title: 'שביתת המורים', icon: '📚', category: 'חינוך', ministryId: 'education', duration: 2,
    services: ['education'], groups: ['families', 'students'],
    trigger: (s) => (s.date.month === 9 ? 0.15 : 0.03) * (ratio(s, 'education') < 0.95 || q(s, 'education') < 48 ? 2.5 : 0.3),
    perTurn: { services: { education: -3 }, groups: { families: -4, publicSector: -1 }, economy: { growth: -0.1 } },
    impact: ['2 מיליון ילדים בבית', 'הורים על סף התמוטטות'],
    actions: [
      { id: 'raise', label: 'תוספת שכר למורים', hint: '₪2 מיליארד בשנה', cost: 0, capital: 0, successChance: 1, effects: { budget: { education: 2 }, groups: { publicSector: 3 } } },
      { id: 'mediate', label: 'גישור בהובלת היועץ', hint: '-6 הון, 50% הצלחה', cost: 0, capital: 6, successChance: 0.5, effects: {} },
      ignore,
    ],
    headline: 'המורים שובתים; ההורים מגלים מה הילדים עושים כל היום',
  },
  {
    id: 'blackout', title: 'הפסקות חשמל מתגלגלות', icon: '🔌', category: 'אנרגיה', ministryId: 'energy', duration: 2,
    services: ['energy'], groups: ['families', 'selfEmployed'],
    trigger: (s) => (summer(s) && q(s, 'energy') < 52 ? 0.2 : 0) + (q(s, 'energy') < 38 ? 0.08 : 0),
    perTurn: { services: { energy: -4 }, groups: { families: -2, selfEmployed: -3 }, economy: { growth: -0.2 } },
    impact: ['הפסקות של 4 שעות', 'המזגנים דוממים'],
    actions: [
      { id: 'generators', label: 'שכירת גנרטורים', hint: '₪0.8 מיליארד', cost: 0.8, capital: 0, successChance: 0.9, effects: { economy: { inflation: 0.1 } } },
      { id: 'blame', label: 'להאשים את הממשלה הקודמת', hint: '-4 הון, 40% שהציבור יקנה', cost: 0, capital: 4, successChance: 0.4, effects: { playerPopularity: 1 } },
      ignore,
    ],
    headline: 'החשמל הלך; גם ההסברים',
  },
  {
    id: 'downgrade', title: 'איום בהורדת דירוג אשראי', icon: '📉', category: 'כלכלה', ministryId: 'finance', duration: 3,
    services: [], groups: ['highIncome', 'middleClass'],
    trigger: (s) => (deficitPct(s) > 5 ? 0.18 : 0) + (debtPct(s) > 80 ? 0.12 : 0),
    perTurn: { economy: { growth: -0.25, inflation: 0.2 }, groups: { highIncome: -2, middleClass: -1 } },
    impact: ['ריבית על החוב עולה', 'משקיעים בורחים'],
    actions: [
      { id: 'austerity', label: 'קיצוץ רוחבי של 3%', hint: 'מקטין גירעון, פוגע בשירותים', cost: 0, capital: 6, successChance: 1, effects: { budget: { education: -2.5, health: -2, welfare: -2.5, government: -1.5, defense: -3 }, groups: { publicSector: -3, lowIncome: -2 } } },
      { id: 'roadshow', label: 'מסע הרגעה בניו יורק', hint: '-5 הון, 50% הצלחה', cost: 0.05, capital: 5, successChance: 0.5, effects: {} },
      ignore,
    ],
    headline: 'סוכנות הדירוג "מודי׳ס-שמודי׳ס" מזהירה',
  },
  {
    id: 'cost_protest', title: 'מחאת יוקר המחיה', icon: '🪧', category: 'חברה', duration: 3,
    services: ['housing'], groups: ['youth', 'middleClass', 'students'],
    trigger: (s) => (s.economy.inflation > 4.5 ? 0.15 : 0) + (s.services.housing.satisfaction < 33 ? 0.1 : 0) + (s.government.approval < 30 ? 0.08 : 0),
    perTurn: { groups: { youth: -2, middleClass: -2, students: -2 }, stability: -2, playerPopularity: -1 },
    impact: ['אוהלים בשדרה', 'הסקרים צונחים'],
    actions: [
      { id: 'package', label: 'חבילת הקלות ליוקר המחיה', hint: '₪3 מיליארד', cost: 3, capital: 0, successChance: 1, effects: { groups: { youth: 3, middleClass: 3, lowIncome: 2 } } },
      { id: 'committee', label: 'להקים ועדה ציבורית', hint: '-3 הון, 50% להרגיע', cost: 0.02, capital: 3, successChance: 0.5, effects: {} },
      ignore,
    ],
    headline: 'העם דורש קוטג׳ בפחות מ-10 שקלים',
  },
  {
    id: 'cyber', title: 'מתקפת סייבר על "גמל-נט"', icon: '👾', category: 'ביטחון', ministryId: 'defense', duration: 1,
    services: ['govServices', 'security'], groups: ['selfEmployed', 'retirees'],
    trigger: (s) => 0.015 + (q(s, 'security') < 50 ? 0.03 : 0),
    perTurn: { services: { govServices: -6, security: -2 }, groups: { selfEmployed: -3, retirees: -2 } },
    impact: ['אתרי הממשלה קורסים', 'קצבאות מתעכבות'],
    actions: [
      { id: 'experts', label: 'צוות סייבר חירום', hint: '₪0.4 מיליארד', cost: 0.4, capital: 0, successChance: 0.9, effects: { serviceBonus: { security: 1 } } },
      ignore,
    ],
    headline: 'האקרים פרצו לאתר הממשלה; לא מצאו שם כלום',
  },
  {
    id: 'border', title: 'מתיחות בגבול הדמיוני', icon: '🚨', category: 'ביטחון', ministryId: 'defense', duration: 2,
    services: ['security'], groups: ['reservists', 'soldiers', 'periphery'],
    trigger: (s) => 0.02 + (q(s, 'security') < 50 ? 0.06 : 0) + (ratio(s, 'defense') < 0.9 ? 0.04 : 0),
    perTurn: { groups: { reservists: -3, periphery: -2, families: -1 }, economy: { growth: -0.2 }, services: { security: -2 } },
    impact: ['גיוס מילואים נרחב', 'התיירות נעצרת'],
    actions: [
      { id: 'reinforce', label: 'תגבור כוחות', hint: '₪2 מיליארד', cost: 2, capital: 0, successChance: 0.85, effects: { groups: { right: 2 } } },
      { id: 'diplomacy', label: 'ערוץ דיפלומטי שקט', hint: '-8 הון, 60% הצלחה', cost: 0, capital: 8, successChance: 0.6, effects: { groups: { left: 2 } } },
      ignore,
    ],
    headline: 'כוננות בצפון; השר מבטיח "תגובה חסרת תקדים" (שוב)',
  },
  {
    id: 'water', title: 'משבר מים', icon: '🚱', category: 'תשתיות', ministryId: 'infrastructure', duration: 2,
    services: ['infrastructure'], groups: ['periphery', 'families'],
    trigger: (s) => (summer(s) && q(s, 'infrastructure') < 48 ? 0.15 : 0),
    perTurn: { services: { infrastructure: -3 }, groups: { periphery: -3, families: -1 } },
    impact: ['ברזים יבשים בפריפריה'],
    actions: [
      { id: 'tankers', label: 'מכליות מים', hint: '₪0.5 מיליארד', cost: 0.5, capital: 0, successChance: 1, effects: {} },
      ignore,
    ],
    headline: 'הברזים יבשים; השר ממליץ "להתקלח פחות"',
  },
  {
    id: 'layoffs', title: 'גל פיטורים בהייטק', icon: '💼', category: 'כלכלה', ministryId: 'economy', duration: 3,
    services: [], groups: ['youth', 'highIncome', 'center'],
    trigger: (s) => (s.economy.growth < 1 ? 0.2 : 0) + (s.economy.unemployment > 7 ? 0.08 : 0),
    perTurn: { economy: { unemployment: 0.4, growth: -0.15 }, groups: { youth: -2, highIncome: -2, center: -1 } },
    impact: ['אלפי מפוטרים', 'ירידה בהכנסות ממסים'],
    actions: [
      { id: 'grants', label: 'מענקי השבה לעבודה', hint: '₪1.5 מיליארד', cost: 1.5, capital: 0, successChance: 0.9, effects: { economy: { unemployment: -0.3 } } },
      { id: 'hackathon', label: 'האקתון לאומי', hint: '-2 הון, 25% הצלחה', cost: 0.01, capital: 2, successChance: 0.25, effects: {} },
      ignore,
    ],
    headline: 'סטארטאפים מפטרים; קומבוצ׳ה במשרדים נגמרת',
  },
  {
    id: 'scandal', title: 'פרשת מכונות הקפה', icon: '☕', category: 'פוליטיקה', duration: 2,
    services: [], groups: ['center', 'left', 'middleClass'],
    trigger: (s) => {
      const govPols = Object.values(s.politicians).filter((p) => p.active && p.ministryId && !p.isPlayer);
      const dishonest = govPols.filter((p) => p.personality.honesty < 0.35).length;
      return 0.01 + dishonest * 0.012;
    },
    perTurn: { stability: -3, groups: { center: -2, left: -1 }, playerPopularity: -1 },
    impact: ['חקירה במשרד ממשלתי', 'מכונות אספרסו ב-₪40 אלף'],
    actions: [
      { id: 'fire', label: 'להשעות את המעורבים', hint: '-5 הון, נאמנות שרים יורדת', cost: 0, capital: 5, successChance: 1, effects: { stability: -2, playerReputation: 3 } },
      { id: 'spin', label: 'לתקוף את התקשורת', hint: '50% שיעבוד', cost: 0, capital: 3, successChance: 0.5, effects: { groups: { right: 1, left: -3 } } },
      ignore,
    ],
    headline: 'חשד: מכונות קפה ב-40 אלף ש״ח נרכשו ב"מכרז דחוף"',
  },
  {
    id: 'quake', title: 'רעידת אדמה קלה', icon: '🌋', category: 'אסון טבע', duration: 1,
    services: ['infrastructure', 'housing'], groups: ['periphery', 'families'],
    trigger: (s) => 0.008 + (q(s, 'infrastructure') < 40 ? 0.004 : 0),
    perTurn: { services: { infrastructure: -6, housing: -3 }, groups: { periphery: -3 }, economy: { growth: -0.3 } },
    impact: ['נזק לבניינים ישנים', 'בניין אחד נבנה בלי היתר (כמובן)'],
    actions: [
      { id: 'rebuild', label: 'קרן שיקום', hint: '₪3 מיליארד', cost: 3, capital: 0, successChance: 1, effects: { groups: { periphery: 3 } } },
      ignore,
    ],
    headline: 'רעידה של 5.1; הבניין היחיד שנפל – משרד התכנון',
  },
  {
    id: 'draft_riots', title: 'הפגנות נגד הגיוס', icon: '🎩', category: 'חברה', duration: 2,
    services: ['transport'], groups: ['haredim', 'secular', 'employees'],
    trigger: (s) => (s.activeLaws.includes('draft_equality') ? 0.22 : 0),
    perTurn: { services: { transport: -2 }, groups: { haredim: -3, secular: -1, employees: -1 } },
    impact: ['כבישים חסומים', 'המשטרה בכוננות'],
    actions: [
      { id: 'dialog', label: 'שולחן עגול עם הרבנים', hint: '-6 הון, 60%', cost: 0, capital: 6, successChance: 0.6, effects: { groups: { haredim: 3 } } },
      { id: 'police', label: 'תגבור משטרה', hint: '₪0.3 מיליארד', cost: 0.3, capital: 0, successChance: 0.8, effects: { groups: { haredim: -3, secular: 2 } } },
      ignore,
    ],
    headline: 'צומת בר-אילן? כאן צומת קוגל-אילן, חסום שוב',
  },
];
// Started only by decisions (declaring war), never at random.
CRISES.push({
  id: 'war', title: 'מלחמה בגבול הדמיוני', icon: '💥', category: 'ביטחון', ministryId: 'defense', duration: 4,
  services: ['security', 'transport'], groups: ['reservists', 'families', 'periphery'],
  trigger: () => 0,
  perTurn: { economy: { growth: -0.5, unemployment: 0.15 }, groups: { reservists: -4, families: -3, periphery: -3, left: -2, right: 1 }, services: { security: -1, transport: -1 }, oneOffCost: 1.5 },
  impact: ['300 אלף מילואימניקים בשטח', 'אזעקות בפריפריה', 'הבורסה במגמת ירידה', 'הפרשנים בשמחה'],
  actions: [
    { id: 'ceasefire', label: 'הפסקת אש בתיווך בינלאומי', hint: '-10 הון, 60% הצלחה', cost: 0, capital: 10, successChance: 0.6, effects: { groups: { left: 4, right: -5, families: 3 } } },
    { id: 'escalate', label: 'הסלמה: "ניצחון מוחלט"', hint: '₪6 מיליארד, 45% הצלחה', cost: 6, capital: 0, successChance: 0.45, effects: { groups: { right: 6, settlers: 4, left: -6 }, playerPopularity: 3 } },
    { id: 'photo_op', label: 'סיור מצולם בחזית עם קסדה', hint: '-3 הון, 30% שזה מסיים משהו', cost: 0, capital: 3, successChance: 0.3, effects: { playerPopularity: 3 } },
  ],
  headline: 'מלחמה! הפרשנים באולפנים 24/7, המילואימניקים בשטח',
});

export const CRISIS_BY_ID = Object.fromEntries(CRISES.map((c) => [c.id, c])) as Record<string, CrisisDef>;
