import type { CaricatureSpec, Domain, GroupId, Ideology, Personality } from '../types/game';

export interface PartyDef {
  id: string; name: string; shortName: string; logo: string; color: string;
  ideology: Ideology; description: string; slogan: string; seats: number;
  affinity: Partial<Record<GroupId, number>>;
  preferredMinistries: string[];
  favoriteLaws: string[]; hatedLaws: string[];
  coalition: boolean;
}

export const PARTIES: PartyDef[] = [
  {
    id: 'kise', name: 'הכיסא', shortName: 'הכיסא', logo: '🪑', color: '#2563eb', coalition: true,
    ideology: { economic: 0.5, security: 0.6, religion: 0.2 },
    description: 'מפלגת השלטון. אידיאולוגיה: להישאר בשלטון.', slogan: 'רק לא לקום.', seats: 32,
    affinity: { right: 3, periphery: 2, elderly: 1.5, religious: 1, settlers: 0.8, lowIncome: 1, middleClass: 1, retirees: 1.5, selfEmployed: 1.2 },
    preferredMinistries: ['finance', 'defense', 'foreign', 'justice'], favoriteLaws: ['loyalty_law', 'chair_law'], hatedLaws: ['term_limits'],
  },
  {
    id: 'yesh', name: 'יש מחר (כנראה)', shortName: 'יש מחר', logo: '🌅', color: '#06b6d4', coalition: false,
    ideology: { economic: 0.1, security: 0.15, religion: -0.6 },
    description: 'מרכז. מבטיחים שמחר יהיה טוב יותר. כבר 12 שנה.', slogan: 'מחר. אולי מחרתיים.', seats: 22,
    affinity: { secular: 2.5, center: 2.5, middleClass: 2, employees: 1.5, highIncome: 1.3, reservists: 1.2, left: 1 },
    preferredMinistries: ['finance', 'education', 'foreign'], favoriteLaws: ['draft_equality', 'term_limits'], hatedLaws: ['draft_exemption'],
  },
  {
    id: 'kugel', name: 'אגודת הקוגל המאוחדת', shortName: 'הקוגל', logo: '🥘', color: '#475569', coalition: true,
    ideology: { economic: -0.3, security: 0.4, religion: 1 },
    description: 'כל תקציב הוא סגולה. כל משרד הוא ברכה.', slogan: 'יש לנו קוגל לכולם.', seats: 16,
    affinity: { haredim: 8, religious: 0.6, lowIncome: 0.4 },
    preferredMinistries: ['interior', 'housing', 'welfare'], favoriteLaws: ['draft_exemption', 'yeshiva_budget'], hatedLaws: ['draft_equality', 'shabbat_transit'],
  },
  {
    id: 'givaa', name: 'הגבעה הלאומית', shortName: 'הגבעה', logo: '⛰️', color: '#f59e0b', coalition: true,
    ideology: { economic: 0.4, security: 1, religion: 0.7 },
    description: 'קמים כל בוקר על גבעה חדשה.', slogan: 'עוד גבעה ועוד גבעה.', seats: 9,
    affinity: { settlers: 8, religious: 3, right: 1.5, soldiers: 0.5 },
    preferredMinistries: ['finance', 'agriculture', 'police'], favoriteLaws: ['hill_settlement'], hatedLaws: ['shabbat_transit'],
  },
  {
    id: 'smol', name: 'השמאל המאוחד (בערך)', shortName: 'השמאל', logo: '🌹', color: '#e11d48', coalition: false,
    ideology: { economic: -0.8, security: -0.7, religion: -0.8 },
    description: 'מאוחדים לגמרי, חוץ מבימי שני וחמישי.', slogan: 'נתאחד אחרי הפיצול.', seats: 10,
    affinity: { left: 4, students: 1.5, publicSector: 1.5, secular: 1, center: 0.8, lowIncome: 0.5 },
    preferredMinistries: ['welfare', 'education', 'health'], favoriteLaws: ['shabbat_transit', 'rent_control', 'public_housing'], hatedLaws: ['hill_settlement', 'loyalty_law'],
  },
  {
    id: 'generals', name: 'מפלגת הגנרלים בדימוס', shortName: 'הגנרלים', logo: '🎖️', color: '#64748b', coalition: false,
    ideology: { economic: 0.2, security: 0.5, religion: -0.2 },
    description: 'מדברים רק בפקודות. גם במסעדה.', slogan: 'קדימה, הסתער! (על הכיסא)', seats: 12,
    affinity: { reservists: 3, soldiers: 1.5, elderly: 1, middleClass: 1, center: 1, secular: 1 },
    preferredMinistries: ['defense', 'police', 'foreign'], favoriteLaws: ['reservist_benefits', 'draft_equality'], hatedLaws: ['draft_exemption'],
  },
  {
    id: 'beitenu', name: 'ביתנו הקטן', shortName: 'ביתנו', logo: '🏠', color: '#7c3aed', coalition: true,
    ideology: { economic: 0.6, security: 0.8, religion: -0.9 },
    description: 'חילוני, ימני, ובעיקר עצבני.', slogan: 'בית קטן, כעס גדול.', seats: 7,
    affinity: { secular: 1.5, right: 1, retirees: 1.5, periphery: 1, selfEmployed: 1 },
    preferredMinistries: ['defense', 'police', 'energy'], favoriteLaws: ['shabbat_transit', 'draft_equality'], hatedLaws: ['draft_exemption', 'yeshiva_budget'],
  },
  {
    id: 'startup', name: 'מפלגת האקזיט', shortName: 'האקזיט', logo: '🚀', color: '#10b981', coalition: false,
    ideology: { economic: 0.8, security: 0.0, religion: -0.6 },
    description: 'רוצים להפוך את המדינה ל-SaaS עם מנוי חודשי.', slogan: 'Move fast, break government.', seats: 6,
    affinity: { highIncome: 3, youth: 1.5, students: 1, center: 1.5, selfEmployed: 1.5 },
    preferredMinistries: ['science', 'economy', 'finance'], favoriteLaws: ['startup_tax', 'digital_gov'], hatedLaws: ['rent_control'],
  },
  {
    id: 'gimlaim', name: 'מפלגת הגמלאים הזועמים', shortName: 'הגמלאים', logo: '🧓', color: '#ea580c', coalition: false,
    ideology: { economic: -0.4, security: 0.2, religion: 0 },
    description: 'בני 84, צעירים ברוחם, זועמים במכתבים למערכת.', slogan: 'אנחנו עוד פה. בקושי, אבל פה.', seats: 6,
    affinity: { retirees: 4, elderly: 3 },
    preferredMinistries: ['welfare', 'health'], favoriteLaws: ['pension_boost'], hatedLaws: [],
  },
];

export interface LeaderDef {
  partyId: string; name: string; gender: 'm' | 'f'; domain: Domain; quirk: string;
  personality: Personality; caricature: Partial<CaricatureSpec>; ambition: string;
}

export const LEADERS: LeaderDef[] = [
  { partyId: 'kise', name: 'בנצי כסאי', gender: 'm', domain: 'management', quirk: 'מחזיק בכיסא מאז שהכיסא היה שרפרף.', personality: { ego: 1, ambition: 0.9, honesty: 0.25, aggression: 0.7 }, caricature: { hair: 'grey', nose: 0.9, mouth: 'smirk' }, ambition: 'להישאר לנצח' },
  { partyId: 'yesh', name: 'רוני מחרתיים', gender: 'm', domain: 'finance', quirk: 'מבטיח שמחר יהיה טוב יותר. מחר הוא אומר את זה שוב.', personality: { ego: 0.8, ambition: 0.9, honesty: 0.6, aggression: 0.5 }, caricature: { hair: 'comb', mouth: 'smile' }, ambition: 'ראשות הממשלה' },
  { partyId: 'kugel', name: 'הרב משולם קוגלמן', gender: 'm', domain: 'interior', quirk: 'רואה בכל סעיף תקציבי סגולה לפרנסה.', personality: { ego: 0.5, ambition: 0.6, honesty: 0.5, aggression: 0.4 }, caricature: { hair: 'hat', beard: 'long', glasses: true }, ambition: 'עוד תקציב לישיבות' },
  { partyId: 'givaa', name: 'אביתר גבעתי', gender: 'm', domain: 'agriculture', quirk: 'מתעורר כל בוקר על גבעה אחרת.', personality: { ego: 0.8, ambition: 0.8, honesty: 0.5, aggression: 0.9 }, caricature: { hair: 'kippah', beard: 'full', brows: 'angry' }, ambition: 'משרד האוצר' },
  { partyId: 'smol', name: 'שולה אדומי', gender: 'f', domain: 'welfare', quirk: 'מנהלת את השמאל המאוחד: היא, הוועד והחתול.', personality: { ego: 0.6, ambition: 0.6, honesty: 0.8, aggression: 0.6 }, caricature: { hair: 'curly', hairColor: '#b91c1c', glasses: true }, ambition: 'צדק חברתי (ומשרד הרווחה)' },
  { partyId: 'generals', name: 'אלוף (מיל.) דני דרגות', gender: 'm', domain: 'defense', quirk: 'מדבר רק בפקודות, גם במסעדה.', personality: { ego: 0.85, ambition: 0.85, honesty: 0.65, aggression: 0.6 }, caricature: { hair: 'beret', brows: 'angry', mouth: 'frown' }, ambition: 'ראשות הממשלה' },
  { partyId: 'beitenu', name: 'אבי ביתני', gender: 'm', domain: 'defense', quirk: 'חילוני, ימני, ובעיקר עצבני.', personality: { ego: 0.9, ambition: 0.7, honesty: 0.4, aggression: 0.95 }, caricature: { hair: 'bald', beard: 'stubble', brows: 'angry' }, ambition: 'משרד הביטחון' },
  { partyId: 'startup', name: 'נועה אקזיט', gender: 'f', domain: 'science', quirk: 'מציעה לעשות למדינה Pivot.', personality: { ego: 0.7, ambition: 0.8, honesty: 0.6, aggression: 0.4 }, caricature: { hair: 'bun', glasses: true, mouth: 'smile' }, ambition: 'IPO לאומי' },
  { partyId: 'gimlaim', name: 'זלמן ותיקי', gender: 'm', domain: 'welfare', quirk: 'בן 84. שולח פקסים לכל ישיבת ממשלה.', personality: { ego: 0.6, ambition: 0.4, honesty: 0.7, aggression: 0.7 }, caricature: { hair: 'grey', glasses: true, ears: 1, mouth: 'open' }, ambition: 'פנסיה כפולה' },
];

/** Named politicians per party (besides leader) */
export const PARTY_SIZE: Record<string, number> = { kise: 11, yesh: 6, generals: 5, kugel: 6, givaa: 4, beitenu: 4, smol: 4, startup: 3, gimlaim: 3 };

export const FIRST_M = ['מוטי', 'אבי', 'יוסי', 'שמוליק', 'דודו', 'צחי', 'אלי', 'קובי', 'רמי', 'ששון', 'ניסים', 'גדי', 'עמית', 'ירון', 'אהרל׳ה', 'בועז', 'שאול', 'תומר', 'יגאל', 'פיני', 'חזי', 'ציון', 'משה', 'עוזי'];
export const FIRST_F = ['מירי', 'אורנה', 'שרית', 'דנה', 'גלית', 'רינה', 'יעל', 'ציפי', 'נורית', 'מיכל', 'אתי', 'לימור', 'חני', 'סיגל', 'טלי'];
export const LAST = ['כספי', 'תקציבי', 'שולחני', 'מינויי', 'קואליציוני', 'הדלפי', 'נאומי', 'ועדתי', 'פריימריזי', 'מקורבי', 'ספינר', 'פרוטוקולי', 'דוברי', 'זגזגי', 'כנסטוני', 'הבטחתי', 'סקרני', 'עסקני', 'לובינסקי', 'מליאתי', 'ג׳ובניק', 'פשרני', 'תקני', 'צ׳ופרי', 'מחאתי'];
export const HAREDI_FIRST = ['יעקב', 'מאיר', 'אליהו', 'שמעון', 'ישראל', 'אשר', 'חיים'];
export const HAREDI_LAST = ['גפילטע', 'צ׳ולנטי', 'קיגלר', 'שטריימל', 'זיצפלייש', 'ירושלמי-קוגל', 'פשטידלמן'];

export const QUIRKS = [
  'מצטלם עם כל תינוק במדינה. כולל תינוקות של אחרים.',
  'פעיל בטיקטוק יותר מאשר במשרד.',
  'מגיע לכל ישיבה באיחור של שעה ויוצא אחרי עשר דקות.',
  'מאמין שכל בעיה נפתרת בוועדה.',
  'כבר הודיע שלוש פעמים על פרישה מהפוליטיקה.',
  'מתייעץ עם האסטרולוגית שלו לפני כל הצבעה.',
  'מדליף לעיתונאים גם את רשימת הקניות.',
  'נאם 9 שעות רצוף נגד חוק שהוא עצמו הציע.',
  'מכנה כל קיצוץ "התייעלות" וכל תוספת "צדק".',
  'יש לו דובר, סגן דובר ודובר לדובר.',
  'זוכר את יום ההולדת של כל ח״כ, ואת כל עלבון.',
  'עבר בין ארבע מפלגות בשלוש שנים.',
  'המציא את המונח "קוגל קואליציוני".',
  'חותם על כל עצומה, כולל נגד עצמו.',
  'טוען שהמציא את הוויז.',
  'מסרב לנסוע בתחבורה ציבורית "מטעמי ביטחון".',
  'מגיע לכנסטון על קורקינט חשמלי עם אבטחה.',
  'מקליט פודקאסט על עצמו.',
  'מומחה עולמי לפתיחת סרטים בטקסים.',
  'מצייץ ב-3 בלילה, מתנצל ב-9 בבוקר.',
];

/** Party-flavoured quirks: every party has its political stereotypes. */
export const PARTY_QUIRKS: Record<string, string[]> = {
  kise: ['מגיע לכל אירוע עם צלם אישי ושלט "הכי ותיק".', 'מסביר כל כישלון ב"הממשלה הקודמת" – גם כשהוא היה בה.', 'מנהל קבוצת ווטסאפ של 4,000 פעילים. כולם עם כוכבים.'],
  yesh: ['נואם על "מעמד הביניים" מתוך וילה בהרצליה.', 'מתחיל כל משפט ב"בואו נהיה כנים".', 'יש לו מצגת לכל דבר. גם לארוחת שישי.'],
  kugel: ['לא מחליט כלום בלי להתייעץ, ואז מחליט מה שתכנן מראש.', 'יודע בעל פה כל סעיף תקציבי של מוסדות תורניים.', 'מביא קוגל לכל ישיבת ועדה. הוועדה רגועה יותר.'],
  givaa: ['מגיע לכנסטון עם טנדר מאובק ובקבוק מים של 5 ליטר.', 'סופר גבעות לפני השינה.', 'מצטלם עם כבשה ב-90% מהפוסטים.'],
  smol: ['מגיע לכל הפגנה. גם לכאלה שלא קשורות.', 'כותב פוסטים של 3,000 מילה. 12 לייקים.', 'רוכב על אופניים לכנסטון, מצטלם כל יום.'],
  generals: ['קורא לעוזרים "חיילים" ולארוחת צהריים "תדריך".', 'מסביר כל סוגיה עם מפה ומקל.', 'קם ב-5:00. מודיע על זה ב-5:01.'],
  beitenu: ['אומר "אני אומר את זה בפשטות" ואז מדבר 20 דקות.', 'מאיים לפרוש מהקואליציה פעמיים בשבוע.', 'שונא את כולם בערך באותה מידה.'],
  startup: ['מדבר רק בראשי תיבות באנגלית.', 'עשה אקזיט, איבד הכול בקריפטו, נכנס לפוליטיקה.', 'רוצה להחליף את הכנסטון ב-DAO.'],
  gimlaim: ['זוכר כל נאום מ-1974. בפרטים.', 'מגיע לישיבות עם כיסא מתקפל משלו.', 'שולח פקסים, ומתקשר לוודא שהגיעו.'],
};

export const AMBITIONS = ['להיות שר', 'משרד בכיר', 'ראשות ועדה', 'ראשות המפלגה', 'כותרת בעיתון', 'תקציב לעיר שלו', 'להישאר ברשימה'];

export const SKINS = ['#f2c9a0', '#e8b48a', '#d49a6a', '#f5d6b8', '#c68642', '#e0ac69'];
export const HAIR_COLORS = ['#1f2937', '#4b3621', '#6b4423', '#9ca3af', '#d1d5db', '#a16207', '#111827'];
export const SUITS = ['#1e293b', '#334155', '#1e3a8a', '#3f3f46', '#7f1d1d', '#14532d', '#44403c'];
