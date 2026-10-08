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

const ignore: CrisisAction = { id: 'ignore', label: 'לא לנקוט צעד כרגע', hint: 'בלי עלות. המשבר ימשיך ויחריף.', cost: 0, capital: 0, successChance: 0, effects: { playerPopularity: -2 } };

export const CRISES: CrisisDef[] = [
  {
    id: 'transport_strike', title: 'שביתת נהגי האוטובוסים', icon: '🚌', category: 'תחבורה', ministryId: 'transport', duration: 6,
    services: ['transport'], groups: ['employees', 'students', 'youth'],
    trigger: (s) => (q(s, 'transport') < 45 ? 0.12 : 0) + (ratio(s, 'transport') < 0.9 ? 0.08 : 0),
    perTurn: { services: { transport: -3 }, groups: { employees: -2, students: -2, youth: -1.5 }, economy: { growth: -0.15 } },
    impact: ['30% מהקווים מושבתים', 'זמני הנסיעה מתארכים בעשרות דקות'],
    actions: [
      { id: 'deal', label: 'הסכם שכר', hint: '₪1.2 מיליארד, מסיים את השביתה מיד', cost: 1.2, capital: 0, successChance: 1, effects: { groups: { publicSector: 2 } } },
      { id: 'order', label: 'פנייה לבית הדין לעבודה', hint: '-10 הון פוליטי, 60% הצלחה', cost: 0, capital: 10, successChance: 0.6, effects: { groups: { publicSector: -4, left: -2 } } },
      ignore,
    ],
    headline: 'שביתת נהגי האוטובוסים: עומסי תנועה כבדים בכל הארץ',
  },
  {
    id: 'er_collapse', title: 'קריסת חדרי המיון', icon: '🚑', category: 'בריאות', ministryId: 'health', duration: 4,
    services: ['health'], groups: ['elderly', 'retirees', 'families'],
    trigger: (s) => (winter(s) && q(s, 'health') < 50 ? 0.22 : 0) + (q(s, 'health') < 38 ? 0.1 : 0),
    perTurn: { services: { health: -3 }, groups: { elderly: -3, retirees: -3, families: -1.5 } },
    impact: ['המתנה של שעות ארוכות במיון', 'מטופלים מאושפזים במסדרונות'],
    actions: [
      { id: 'emergency', label: 'תקציב חירום למיון', hint: '₪1.5 מיליארד', cost: 1.5, capital: 0, successChance: 1, effects: { services: { health: 3 }, groups: { elderly: 2 } } },
      { id: 'army_medics', label: 'סיוע של חובשים ורופאים מצה״ל', hint: '-8 הון, 70% הצלחה', cost: 0.2, capital: 8, successChance: 0.7, effects: { groups: { soldiers: -2 } } },
      ignore,
    ],
    headline: 'גל תחלואה: עומס חריג בחדרי המיון',
  },
  {
    id: 'teachers_strike', title: 'שביתת המורים', icon: '📚', category: 'חינוך', ministryId: 'education', duration: 4,
    services: ['education'], groups: ['families', 'students'],
    trigger: (s) => (s.date.month === 9 ? 0.15 : 0.03) * (ratio(s, 'education') < 0.95 || q(s, 'education') < 48 ? 2.5 : 0.3),
    perTurn: { services: { education: -3 }, groups: { families: -4, publicSector: -1 }, economy: { growth: -0.1 } },
    impact: ['מאות אלפי תלמידים בבית', 'הורים נעדרים מהעבודה'],
    actions: [
      { id: 'raise', label: 'תוספת שכר למורים', hint: '₪2 מיליארד בשנה', cost: 0, capital: 0, successChance: 1, effects: { budget: { education: 2 }, groups: { publicSector: 3 } } },
      { id: 'mediate', label: 'גישור בין ארגוני המורים למשרד', hint: '-6 הון, 50% הצלחה', cost: 0, capital: 6, successChance: 0.5, effects: {} },
      ignore,
    ],
    headline: 'שביתת המורים: מאות אלפי תלמידים בבית',
  },
  {
    id: 'blackout', title: 'הפסקות חשמל מתגלגלות', icon: '🔌', category: 'אנרגיה', ministryId: 'energy', duration: 4,
    services: ['energy'], groups: ['families', 'selfEmployed'],
    trigger: (s) => (summer(s) && q(s, 'energy') < 52 ? 0.2 : 0) + (q(s, 'energy') < 38 ? 0.08 : 0),
    perTurn: { services: { energy: -4 }, groups: { families: -2, selfEmployed: -3 }, economy: { growth: -0.2 } },
    impact: ['הפסקות חשמל של שעות', 'עסקים ומפעלים מושבתים'],
    actions: [
      { id: 'generators', label: 'גנרטורים ותחנות כוח זמניות', hint: '₪0.8 מיליארד', cost: 0.8, capital: 0, successChance: 0.9, effects: { economy: { inflation: 0.1 } } },
      { id: 'demand', label: 'הפחתת ביקושים בתיאום עם התעשייה', hint: '-4 הון, 50% הצלחה', cost: 0, capital: 4, successChance: 0.5, effects: { economy: { growth: -0.05 } } },
      ignore,
    ],
    headline: 'הפסקות חשמל מתגלגלות בגל החום',
  },
  {
    id: 'downgrade', title: 'איום בהורדת דירוג אשראי', icon: '📉', category: 'כלכלה', ministryId: 'finance', duration: 6,
    services: [], groups: ['highIncome', 'middleClass'],
    trigger: (s) => (deficitPct(s) > 5 ? 0.18 : 0) + (debtPct(s) > 80 ? 0.12 : 0),
    perTurn: { economy: { growth: -0.25, inflation: 0.2 }, groups: { highIncome: -2, middleClass: -1 } },
    impact: ['הריבית על החוב עולה', 'משקיעים זרים מצמצמים השקעות'],
    actions: [
      { id: 'austerity', label: 'קיצוץ רוחבי של 3%', hint: 'מקטין גירעון, פוגע בשירותים', cost: 0, capital: 6, successChance: 1, effects: { budget: { education: -2.5, health: -2, welfare: -2.5, government: -1.5, defense: -3 }, groups: { publicSector: -3, lowIncome: -2 } } },
      { id: 'roadshow', label: 'פגישות הרגעה עם חברות הדירוג', hint: '-5 הון, 50% הצלחה', cost: 0.05, capital: 5, successChance: 0.5, effects: {} },
      ignore,
    ],
    headline: 'חברת דירוג בינלאומית מזהירה מהורדת דירוג',
  },
  {
    id: 'cost_protest', title: 'מחאת יוקר המחיה', icon: '🪧', category: 'חברה', duration: 6,
    services: ['housing'], groups: ['youth', 'middleClass', 'students'],
    trigger: (s) => (s.economy.inflation > 4.5 ? 0.15 : 0) + (s.services.housing.satisfaction < 33 ? 0.1 : 0) + (s.government.approval < 30 ? 0.08 : 0),
    perTurn: { groups: { youth: -2, middleClass: -2, students: -2 }, stability: -2, playerPopularity: -1 },
    impact: ['מאהלי מחאה בערים הגדולות', 'התמיכה בממשלה יורדת'],
    actions: [
      { id: 'package', label: 'חבילת הקלות ליוקר המחיה', hint: '₪3 מיליארד', cost: 3, capital: 0, successChance: 1, effects: { groups: { youth: 3, middleClass: 3, lowIncome: 2 } } },
      { id: 'committee', label: 'להקים ועדה ציבורית', hint: '-3 הון, 50% להרגיע', cost: 0.02, capital: 3, successChance: 0.5, effects: {} },
      ignore,
    ],
    headline: 'מחאת יוקר המחיה מתרחבת: מאהלים בערים הגדולות',
  },
  {
    id: 'cyber', title: 'מתקפת סייבר על מערכות ממשלתיות', icon: '👾', category: 'ביטחון', ministryId: 'defense', duration: 2,
    services: ['govServices', 'security'], groups: ['selfEmployed', 'retirees'],
    trigger: (s) => 0.015 + (q(s, 'security') < 50 ? 0.03 : 0),
    perTurn: { services: { govServices: -6, security: -2 }, groups: { selfEmployed: -3, retirees: -2 } },
    impact: ['אתרי הממשלה מושבתים', 'תשלומי קצבאות מתעכבים'],
    actions: [
      { id: 'experts', label: 'צוות חירום של מערך הסייבר', hint: '₪0.4 מיליארד', cost: 0.4, capital: 0, successChance: 0.9, effects: { serviceBonus: { security: 1 } } },
      ignore,
    ],
    headline: 'מתקפת סייבר השביתה שירותים ממשלתיים',
  },
  {
    id: 'border', title: 'מתיחות ביטחונית בגבולות', icon: '🚨', category: 'ביטחון', ministryId: 'defense', duration: 4,
    services: ['security'], groups: ['reservists', 'soldiers', 'periphery'],
    trigger: (s) => 0.02 + (q(s, 'security') < 50 ? 0.06 : 0) + (ratio(s, 'defense') < 0.9 ? 0.04 : 0),
    perTurn: { groups: { reservists: -3, periphery: -2, families: -1 }, economy: { growth: -0.2 }, services: { security: -2 } },
    impact: ['גיוס מילואים נרחב', 'פגיעה בתיירות ובכלכלה'],
    actions: [
      { id: 'reinforce', label: 'תגבור כוחות', hint: '₪2 מיליארד', cost: 2, capital: 0, successChance: 0.85, effects: { groups: { right: 2 } } },
      { id: 'diplomacy', label: 'מסרים דרך מתווכים בינלאומיים', hint: '-8 הון, 60% הצלחה', cost: 0, capital: 8, successChance: 0.6, effects: { groups: { left: 2 } } },
      ignore,
    ],
    headline: 'כוננות גבוהה בגבולות; גיוס מילואים',
  },
  {
    id: 'water', title: 'משבר מים', icon: '🚱', category: 'תשתיות', ministryId: 'energy', duration: 4,
    services: ['infrastructure'], groups: ['periphery', 'families'],
    trigger: (s) => (summer(s) && q(s, 'infrastructure') < 48 ? 0.15 : 0),
    perTurn: { services: { infrastructure: -3 }, groups: { periphery: -3, families: -1 } },
    impact: ['הפסקות מים ביישובי הפריפריה'],
    actions: [
      { id: 'tankers', label: 'אספקת מים חלופית ותיקון צנרת', hint: '₪0.5 מיליארד', cost: 0.5, capital: 0, successChance: 1, effects: {} },
      ignore,
    ],
    headline: 'משבר מים: הפסקות אספקה ביישובי הפריפריה',
  },
  {
    id: 'layoffs', title: 'גל פיטורים בהייטק', icon: '💼', category: 'כלכלה', ministryId: 'economy', duration: 6,
    services: [], groups: ['youth', 'highIncome', 'center'],
    trigger: (s) => (s.economy.growth < 1 ? 0.2 : 0) + (s.economy.unemployment > 7 ? 0.08 : 0),
    perTurn: { economy: { unemployment: 0.4, growth: -0.15 }, groups: { youth: -2, highIncome: -2, center: -1 } },
    impact: ['אלפי עובדים פוטרו', 'ירידה בהכנסות ממסים'],
    actions: [
      { id: 'grants', label: 'מענקי השבה לעבודה', hint: '₪1.5 מיליארד', cost: 1.5, capital: 0, successChance: 0.9, effects: { economy: { unemployment: -0.3 } } },
      { id: 'hackathon', label: 'תוכנית הסבה מקצועית', hint: '-2 הון, 35% הצלחה', cost: 0.01, capital: 2, successChance: 0.35, effects: {} },
      ignore,
    ],
    headline: 'גל פיטורים בהייטק: אלפי עובדים פוטרו',
  },
  {
    id: 'scandal', title: 'חשד לשחיתות במשרד ממשלתי', icon: '🔎', category: 'פוליטיקה', duration: 4,
    services: [], groups: ['center', 'left', 'middleClass'],
    trigger: (s) => {
      const govPols = Object.values(s.politicians).filter((p) => p.active && p.ministryId && !p.isPlayer);
      const dishonest = govPols.filter((p) => p.personality.honesty < 0.35).length;
      return 0.01 + dishonest * 0.012;
    },
    perTurn: { stability: -3, groups: { center: -2, left: -1 }, playerPopularity: -1 },
    impact: ['חקירה משטרתית במשרד ממשלתי', 'חשד למינויים ומכרזים לא תקינים'],
    actions: [
      { id: 'fire', label: 'להשעות את המעורבים', hint: '-5 הון, נאמנות שרים יורדת', cost: 0, capital: 5, successChance: 1, effects: { stability: -2, playerReputation: 3 } },
      { id: 'spin', label: 'להגן על המשרד ולהמתין לחקירה', hint: '50% שהסערה תשכך', cost: 0, capital: 3, successChance: 0.5, effects: { groups: { right: 1, left: -3 } } },
      ignore,
    ],
    headline: 'חקירה: חשד למכרזים לא תקינים במשרד ממשלתי',
  },
  {
    id: 'quake', title: 'רעידת אדמה', icon: '🌋', category: 'אסון טבע', duration: 2,
    services: ['infrastructure', 'housing'], groups: ['periphery', 'families'],
    trigger: (s) => 0.008 + (q(s, 'infrastructure') < 40 ? 0.004 : 0),
    perTurn: { services: { infrastructure: -6, housing: -3 }, groups: { periphery: -3 }, economy: { growth: -0.3 } },
    impact: ['נזק לבניינים ישנים', 'משפחות פונו מבתיהן'],
    actions: [
      { id: 'rebuild', label: 'קרן שיקום', hint: '₪3 מיליארד', cost: 3, capital: 0, successChance: 1, effects: { groups: { periphery: 3 } } },
      ignore,
    ],
    headline: 'רעידת אדמה בעוצמה 5.1: נזק לבניינים ישנים',
  },
  {
    id: 'draft_riots', title: 'הפגנות נגד הגיוס', icon: '🪧', category: 'חברה', duration: 4,
    services: ['transport'], groups: ['haredim', 'secular', 'employees'],
    trigger: (s) => (s.activeLaws.includes('draft_equality') ? 0.22 : 0),
    perTurn: { services: { transport: -2 }, groups: { haredim: -3, secular: -1, employees: -1 } },
    impact: ['כבישים חסומים', 'המשטרה בכוננות'],
    actions: [
      { id: 'dialog', label: 'הידברות עם הנהגת הציבור החרדי', hint: '-6 הון, 60%', cost: 0, capital: 6, successChance: 0.6, effects: { groups: { haredim: 3 } } },
      { id: 'police', label: 'תגבור משטרה', hint: '₪0.3 מיליארד', cost: 0.3, capital: 0, successChance: 0.8, effects: { groups: { haredim: -3, secular: 2 } } },
      ignore,
    ],
    headline: 'הפגנות נגד חוק הגיוס: צמתים מרכזיים נחסמו',
  },
];
// Started only by decisions (a wide military operation), never at random.
CRISES.push({
  id: 'war', title: 'מלחמה', icon: '💥', category: 'ביטחון', ministryId: 'defense', duration: 8,
  services: ['security', 'transport'], groups: ['reservists', 'families', 'periphery'],
  trigger: () => 0,
  perTurn: { economy: { growth: -0.5, unemployment: 0.15 }, groups: { reservists: -4, families: -3, periphery: -3, left: -2, right: 1 }, services: { security: -1, transport: -1 }, oneOffCost: 1.5 },
  impact: ['מאות אלפי משרתי מילואים מגויסים', 'אזעקות ופגיעות בעורף', 'פגיעה קשה בכלכלה'],
  actions: [
    { id: 'ceasefire', label: 'הפסקת אש בתיווך בינלאומי', hint: '-10 הון, 60% הצלחה', cost: 0, capital: 10, successChance: 0.6, effects: { groups: { left: 4, right: -5, families: 3 } } },
    { id: 'escalate', label: 'הרחבת המערכה הצבאית', hint: '₪6 מיליארד, 45% הצלחה', cost: 6, capital: 0, successChance: 0.45, effects: { groups: { right: 6, settlers: 4, left: -6 }, playerPopularity: 3 } },
    { id: 'home_front', label: 'סיוע לעורף ולמפונים', hint: '₪2 מיליארד, לא מסיים את המלחמה', cost: 2, capital: 0, successChance: 0.2, effects: { groups: { families: 4, periphery: 4 }, stability: 3 } },
  ],
  headline: 'מלחמה: גיוס מילואים נרחב והעורף בכוננות',
});

export const CRISIS_BY_ID = Object.fromEntries(CRISES.map((c) => [c.id, c])) as Record<string, CrisisDef>;
