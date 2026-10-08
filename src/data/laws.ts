import { MINISTRY_LAWS } from './ministryLaws.generated';
import type { BudgetCategory, Domain, EconomyShock, Effects, GroupId, Ideology, ServiceId } from '../types/game';

// ============================================================
// Real laws and bills on the agenda (2026). Neutral descriptions.
// ideology: where the bill sits on the three axes – parties close to it tend to support it;
// each party's red lines (data/parties.ts) override everything.
// ============================================================

export interface LawDef {
  id: string;
  title: string;
  icon: string;
  domain: Domain;
  level: 'medium' | 'major';
  ideology: Ideology;
  description: string;
  /** permanent satisfaction offsets while law is active */
  groups: Partial<Record<GroupId, number>>;
  /** annual budget cost added to a category */
  budget?: { category: BudgetCategory; amount: number };
  serviceBonus?: Partial<Record<ServiceId, number>>;
  structural?: EconomyShock;
  revenueFactor?: number;
  onPass?: Effects;
  /** ministry-specific laws: only these ministries' ministers may propose them */
  ministries?: string[];
  /** legacy field – unused in v2 (kept so older saves still type-check) */
  satire?: string;
}

const I = (security: number, economic: number, religion: number): Ideology => ({ security, economic, religion });

const CORE_LAWS: LawDef[] = [
  // ---------- security & state ----------
  { id: 'draft_equality', title: 'חוק השוויון בנטל', icon: '🪖', domain: 'defense', level: 'major', ideology: I(0.3, 0, -0.8),
    description: 'גיוס חובה לכלל הציבור, כולל תלמידי ישיבות, עם יעדי גיוס וסנקציות.',
    groups: { haredim: -18, reservists: 12, secular: 8, soldiers: 5, liberals: 3, religious: -1 }, serviceBonus: { security: 4 }, structural: { growth: 0.15 } },
  { id: 'draft_exemption', title: 'חוק הגיוס – הסדרת מעמד לומדי התורה', icon: '📖', domain: 'defense', level: 'major', ideology: I(0.3, -0.2, 0.9),
    description: 'עיגון בחוק של פטור או דחיית שירות לתלמידי ישיבות.',
    groups: { haredim: 14, religious: 2, reservists: -14, secular: -10, soldiers: -5, liberals: -5 } },
  { id: 'torah_study_basic_law', title: 'חוק יסוד: לימוד תורה', icon: '📚', domain: 'education', level: 'major', ideology: I(0.2, -0.2, 1),
    description: 'עיגון לימוד התורה כערך יסוד במעמד חוקתי.',
    groups: { haredim: 10, religious: 2, secular: -10, reservists: -8, liberals: -6 } },
  { id: 'death_penalty_terror', title: 'חוק עונש מוות למחבלים', icon: '⚖️', domain: 'law', level: 'medium', ideology: I(1, 0, 0.4),
    description: 'אפשרות להטיל עונש מוות על מחבלים שהורשעו ברצח על רקע לאומני.',
    groups: { right: 6, settlers: 5, left: -8, arabs: -10, liberals: -4 } },
  { id: 'reservist_benefits', title: 'חוק הטבות למשרתי המילואים', icon: '🎖️', domain: 'defense', level: 'medium', ideology: I(0.3, 0, 0),
    description: 'הטבות מס, מענקים והגנה תעסוקתית למשרתי המילואים ולמשפחותיהם.',
    groups: { reservists: 12, soldiers: 4, families: 2, selfEmployed: 2 }, budget: { category: 'defense', amount: 3 } },
  { id: 'oct7_state_commission', title: 'הקמת ועדת חקירה ממלכתית לאירועי 7 באוקטובר', icon: '🔎', domain: 'law', level: 'major', ideology: I(-0.3, 0, -0.3),
    description: 'ועדה ממלכתית בראשות שופט לחקר הכשלים שהובילו לאירועי 7 באוקטובר.',
    groups: { left: 6, center: 4, reservists: 5, liberals: 4, right: -4 } },
  { id: 'police_powers', title: 'הרחבת סמכויות המשטרה', icon: '🚓', domain: 'law', level: 'medium', ideology: I(0.8, 0, 0.2),
    description: 'סמכויות חיפוש ומעצר מורחבות במצבי חירום ובמאבק בפשיעה.',
    groups: { right: 4, periphery: 2, elderly: 2, liberals: -6, arabs: -5, left: -4 }, serviceBonus: { security: 2 } },
  { id: 'arab_crime_plan', title: 'תוכנית לאומית למיגור הפשיעה בחברה הערבית', icon: '🛡️', domain: 'law', level: 'medium', ideology: I(-0.2, -0.3, 0),
    description: 'תגבור שוטרים, אכיפה נגד ארגוני פשיעה ותוכניות מניעה ביישובים הערביים.',
    groups: { arabs: 10, left: 2, periphery: 1 }, budget: { category: 'police', amount: 2 }, serviceBonus: { security: 2 } },
  { id: 'hostages_families', title: 'חוק סיוע למשפחות החטופים והנופלים', icon: '🎗️', domain: 'welfare', level: 'medium', ideology: I(0, -0.2, 0),
    description: 'סיוע כלכלי, נפשי ותעסוקתי למשפחות החטופים, הנופלים ונפגעי הטרור.',
    groups: { families: 4, reservists: 3, soldiers: 2, center: 2 }, budget: { category: 'welfare', amount: 1 } },

  // ---------- judiciary & governance ----------
  { id: 'judicial_selection', title: 'שינוי הרכב הוועדה לבחירת שופטים', icon: '🏛️', domain: 'law', level: 'major', ideology: I(0.7, 0.2, 0.4),
    description: 'הגדלת משקל נציגי הממשלה והכנסת בוועדה שבוחרת את השופטים.',
    groups: { right: 6, religious: 3, settlers: 4, left: -12, liberals: -12, center: -5, highIncome: -3 }, structural: { growth: -0.1 } },
  { id: 'override_clause', title: 'פסקת ההתגברות', icon: '🔁', domain: 'law', level: 'major', ideology: I(0.7, 0.1, 0.5),
    description: 'אפשרות לכנסת לחוקק מחדש חוק שבית המשפט העליון פסל.',
    groups: { right: 6, haredim: 4, settlers: 4, left: -14, liberals: -14, center: -6 }, structural: { growth: -0.15 } },
  { id: 'ag_split', title: 'פיצול תפקיד היועץ המשפטי לממשלה', icon: '✂️', domain: 'law', level: 'medium', ideology: I(0.6, 0, 0.2),
    description: 'הפרדה בין תפקיד היועץ המשפטי לתפקיד התובע הכללי.',
    groups: { right: 4, left: -8, liberals: -8 } },
  { id: 'term_limits', title: 'הגבלת כהונת ראש הממשלה', icon: '⏳', domain: 'law', level: 'medium', ideology: I(-0.2, 0, -0.3),
    description: 'הגבלת כהונת ראש הממשלה לשתי קדנציות או שמונה שנים.',
    groups: { center: 5, liberals: 6, left: 5, right: -4 } },
  { id: 'communications_reform', title: 'רפורמה בשוק התקשורת והשידורים', icon: '📡', domain: 'media', level: 'medium', ideology: I(0.4, 0.4, 0.1),
    description: 'שינוי מבנה הרגולציה על ערוצי הטלוויזיה והשידור הציבורי.',
    groups: { right: 3, liberals: -2, left: -5 } },
  { id: 'nation_state_plus', title: 'תיקון לחוק הלאום – עידוד התיישבות יהודית', icon: '🏳️', domain: 'interior', level: 'medium', ideology: I(0.8, 0, 0.5),
    description: 'הרחבת הסעיף בחוק הלאום בנוגע לעידוד התיישבות יהודית.',
    groups: { right: 5, settlers: 4, arabs: -12, left: -8, liberals: -4 } },

  // ---------- religion & state ----------
  { id: 'civil_marriage', title: 'חוק ברית הזוגיות – נישואים אזרחיים', icon: '💍', domain: 'interior', level: 'major', ideology: I(-0.2, 0.2, -0.9),
    description: 'אפשרות להינשא בישראל שלא דרך הרבנות.',
    groups: { secular: 8, olim: 10, liberals: 8, left: 6, haredim: -10, religious: -8 } },
  { id: 'shabbat_transit', title: 'תחבורה ציבורית בשבת', icon: '🚌', domain: 'transport', level: 'medium', ideology: I(-0.2, 0, -0.8),
    description: 'הפעלת קווי תחבורה ציבורית מוגבלים בשבת בערים שיבקשו זאת.',
    groups: { secular: 8, youth: 6, students: 4, olim: 4, haredim: -12, religious: -8 }, budget: { category: 'transport', amount: 1 } },
  { id: 'rabbinical_courts', title: 'הרחבת סמכויות בתי הדין הרבניים', icon: '📜', domain: 'law', level: 'medium', ideology: I(0.4, 0, 0.9),
    description: 'הסמכת בתי הדין הרבניים לדון בתיקים אזרחיים בהסכמת הצדדים.',
    groups: { haredim: 6, religious: 4, secular: -8, liberals: -8 } },
  { id: 'core_curriculum', title: 'לימודי ליבה חובה בכל מוסדות החינוך', icon: '🧮', domain: 'education', level: 'medium', ideology: I(0, 0.3, -0.6),
    description: 'התניית מימון מוסדות חינוך בלימוד מתמטיקה, אנגלית ומדעים.',
    groups: { haredim: -12, secular: 5, liberals: 5, highIncome: 2 }, budget: { category: 'education', amount: 1 }, structural: { growth: 0.1 } },
  { id: 'yeshiva_budget', title: 'הגדלת תקציבי הישיבות', icon: '🕍', domain: 'education', level: 'medium', ideology: I(0.2, -0.3, 0.9),
    description: 'תוספת תקציב למוסדות תורניים ולמלגות אברכים.',
    groups: { haredim: 10, religious: 2, secular: -6, reservists: -6 }, budget: { category: 'education', amount: 2 } },

  // ---------- economy, welfare & housing ----------
  { id: 'minimum_wage', title: 'העלאת שכר המינימום ל-7,000 ₪', icon: '💵', domain: 'welfare', level: 'medium', ideology: I(-0.2, -0.7, 0),
    description: 'העלאה הדרגתית של שכר המינימום.',
    groups: { lowIncome: 10, employees: 4, socialists: 6, selfEmployed: -5, highIncome: -3 }, structural: { unemployment: 0.1, inflation: 0.1 } },
  { id: 'vat_basics', title: 'ביטול מע״מ על מוצרי יסוד', icon: '🛒', domain: 'finance', level: 'medium', ideology: I(0, -0.4, 0.2),
    description: 'פטור ממע״מ על לחם, חלב, ביצים, ירקות ופירות.',
    groups: { lowIncome: 8, families: 6, haredim: 4, retirees: 4, olim: 3, socialists: 3, liberals: -2 }, revenueFactor: -0.012 },
  { id: 'tech_tax_relief', title: 'הטבות מס להייטק ולחדשנות', icon: '💡', domain: 'science', level: 'medium', ideology: I(0.1, 0.8, -0.2),
    description: 'הקלות מס לחברות טכנולוגיה ולמשקיעים בחדשנות.',
    groups: { highIncome: 6, liberals: 5, center: 3, youth: 2, socialists: -4 }, revenueFactor: -0.004, structural: { growth: 0.2 } },
  { id: 'pension_boost', title: 'הגדלת קצבאות הזקנה', icon: '👴', domain: 'welfare', level: 'medium', ideology: I(0, -0.5, 0.1),
    description: 'העלאת קצבת הזקנה והשלמת ההכנסה לקשישים.',
    groups: { retirees: 10, elderly: 8, olim: 3, socialists: 3 }, budget: { category: 'welfare', amount: 3 } },
  { id: 'free_daycare', title: 'מעונות יום מסובסדים מגיל אפס', icon: '👶', domain: 'education', level: 'medium', ideology: I(-0.1, -0.4, -0.1),
    description: 'סבסוד מעונות יום ופיקוח ממשלתי מלידה.',
    groups: { families: 10, youth: 6, employees: 3, socialists: 3 }, budget: { category: 'education', amount: 3 }, structural: { growth: 0.1 } },
  { id: 'public_housing', title: 'הרחבת הדיור הציבורי', icon: '🏢', domain: 'housing', level: 'medium', ideology: I(-0.2, -0.7, 0),
    description: 'בנייה של אלפי דירות דיור ציבורי ודיור להשכרה ארוכת טווח.',
    groups: { lowIncome: 8, socialists: 6, youth: 3, olim: 3, highIncome: -2 }, budget: { category: 'housing', amount: 3 }, serviceBonus: { housing: 3 } },
  { id: 'rent_control', title: 'חוק שכירות הוגנת', icon: '🔑', domain: 'housing', level: 'medium', ideology: I(-0.2, -0.6, -0.1),
    description: 'הגבלת שיעור עליית שכר הדירה בחידוש חוזה.',
    groups: { youth: 8, students: 6, socialists: 5, liberals: -5, highIncome: -4 }, serviceBonus: { housing: -2 } },
  { id: 'housing_land_reform', title: 'רפורמה בקרקעות ובתכנון לדיור', icon: '🏗️', domain: 'housing', level: 'major', ideology: I(0.1, 0.5, 0),
    description: 'קיצור הליכי תכנון, שחרור קרקעות מדינה והתחדשות עירונית.',
    groups: { youth: 6, families: 5, middleClass: 4, periphery: 2 }, serviceBonus: { housing: 6 } },
  { id: 'national_health_plan', title: 'תוכנית לאומית לקיצור תורים ברפואה', icon: '🩺', domain: 'health', level: 'medium', ideology: I(0, -0.3, 0),
    description: 'תקנים לרופאים ואחיות ומיטות אשפוז נוספות, בדגש על הפריפריה.',
    groups: { elderly: 6, retirees: 5, families: 3, periphery: 4 }, budget: { category: 'health', amount: 3 }, serviceBonus: { health: 5 } },
  { id: 'digital_gov', title: 'דיגיטציה של שירותי הממשלה', icon: '💻', domain: 'management', level: 'medium', ideology: I(0, 0.3, -0.1),
    description: 'כל השירותים הממשלתיים זמינים באינטרנט עם הזדהות דיגיטלית.',
    groups: { selfEmployed: 5, youth: 4, center: 3 }, budget: { category: 'government', amount: 1 }, serviceBonus: { govServices: 6 } },
  { id: 'gas_export', title: 'הגדלת יצוא הגז הטבעי', icon: '🔥', domain: 'energy', level: 'medium', ideology: I(0.2, 0.6, 0),
    description: 'הגדלת מכסות היצוא ממאגרי הגז.',
    groups: { highIncome: 3, liberals: 3, left: -3 }, revenueFactor: 0.006 },
  { id: 'renewable_energy', title: 'יעד 30% אנרגיה מתחדשת', icon: '☀️', domain: 'energy', level: 'medium', ideology: I(-0.3, -0.1, -0.2),
    description: 'קידום אנרגיה סולארית ואגירה כדי להגיע ל-30% אנרגיה מתחדשת.',
    groups: { left: 4, youth: 4, liberals: 2 }, budget: { category: 'energy', amount: 2 }, serviceBonus: { energy: 4 } },
  { id: 'gaza_envelope_rehab', title: 'חוק שיקום עוטף עזה והצפון', icon: '🧱', domain: 'infrastructure', level: 'medium', ideology: I(0.1, -0.2, 0),
    description: 'מענקים, הטבות מס ותשתיות לשיקום יישובי עוטף עזה והצפון.',
    groups: { periphery: 8, reservists: 3, families: 2 }, budget: { category: 'infrastructure', amount: 3 }, serviceBonus: { infrastructure: 3 } },
  { id: 'negev_recognition', title: 'הסדרת ההתיישבות הבדואית בנגב', icon: '🏘️', domain: 'housing', level: 'medium', ideology: I(-0.3, -0.2, 0),
    description: 'הכרה ביישובים והשקעה בתשתיות, לצד אכיפת תכנון.',
    groups: { arabs: 8, periphery: 2, right: -3 }, budget: { category: 'housing', amount: 1 } },
  { id: 'arab_local_budget', title: 'תוכנית חומש לחברה הערבית', icon: '📊', domain: 'interior', level: 'medium', ideology: I(-0.4, -0.3, 0),
    description: 'השקעה בתשתיות, חינוך ותעסוקה ביישובים הערביים.',
    groups: { arabs: 10, left: 3, right: -3 }, budget: { category: 'government', amount: 2 } },

  // ---------- territory & diplomacy ----------
  { id: 'settlement_sovereignty', title: 'החלת ריבונות על שטחי C', icon: '🗺️', domain: 'foreign', level: 'major', ideology: I(1, 0.1, 0.6),
    description: 'החלת החוק הישמעאלי על שטחי C ביהודה ושומרון.',
    groups: { settlers: 14, right: 8, religious: 4, left: -14, arabs: -12, liberals: -6 } },
  { id: 'palestinian_state', title: 'הכרה בעקרון שתי המדינות ומשא ומתן מדיני', icon: '🕊️', domain: 'foreign', level: 'major', ideology: I(-0.9, 0, -0.2),
    description: 'החלטה עקרונית על משא ומתן לפתרון שתי המדינות.',
    groups: { left: 12, arabs: 8, liberals: 3, right: -12, settlers: -16, religious: -6 } },
  { id: 'land_transfer', title: 'העברת שטחים במסגרת הסדר מדיני', icon: '🤝', domain: 'foreign', level: 'major', ideology: I(-1, 0, -0.2),
    description: 'אישור העברת שטחים לשליטה פלסטינית במסגרת הסכם.',
    groups: { left: 6, arabs: 6, settlers: -18, right: -14, religious: -4 } },
];

export const LAWS: LawDef[] = [...CORE_LAWS, ...MINISTRY_LAWS];

export const LAW_BY_ID = Object.fromEntries(LAWS.map((l) => [l.id, l])) as Record<string, LawDef>;
