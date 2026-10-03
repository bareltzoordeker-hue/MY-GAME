import type { Effects, GameState, Ministry } from '../types/game';

/** A possible result of an action: picked at random by weight. */
export interface MinistryOutcome {
  w: number;
  text: string;
  effects?: Effects | ((s: GameState, m?: Ministry) => Effects);
  headline?: string;
  crisis?: string; // start this crisis
  tone?: 'good' | 'bad' | 'neutral';
}

export type ActionCat = 'policy' | 'law' | 'appoint' | 'media' | 'budget' | 'extreme';
export const ACTION_CATS: Record<ActionCat, string> = {
  policy: '📋 מדיניות', law: '📜 תקנות וחקיקה', appoint: '🪪 מינויים', media: '📣 תקשורת', budget: '💰 כסף', extreme: '☢️ קיצוני',
};

/** Dedicated actions per ministry — each ministry plays differently. */
export interface MinistryActionSpec {
  id: string;
  title: string;
  icon: string;
  desc: string;
  capital: number;
  cooldown: number;
  effects: (s: GameState, m?: Ministry) => Effects;
  metric?: { service: string; key: string; amount: number };
  satire?: string;
  cat?: ActionCat;
  /** acts without the PM's approval: happens anyway, but the PM and the coalition take it badly */
  rogue?: boolean;
  outcomes?: MinistryOutcome[];
  crisis?: string;
  /** direct changes to the ministry itself (efficiency, bureaucracy) */
  mutate?: (s: GameState, m: Ministry) => void;
}

/** Extra portfolio-specific actions, merged into MINISTRY_ACTIONS below. */
const MORE: Record<string, MinistryActionSpec[]> = {
  finance: [
    { id: 'propose_income_cut', title: 'הצעה: הורדת מס הכנסה ב-1%', icon: '💸', desc: 'להוריד מס הכנסה ב-1%. ראש הממשלה צריך לאשר, ולהתעלם מהגירעון.', satire: 'מעמד הביניים יקבל ₪83 בחודש. מספיק לחצי קוטג׳ וחניה.', capital: 5, cooldown: 8, effects: () => ({ taxes: { incomeTax: -1 } }) },
    { id: 'propose_vat_cut', title: 'הצעה: הורדת מע״מ ב-1%', icon: '🛒', desc: 'להוריד מע״מ ב-1%. הרשתות יחליטו אם להעביר את זה הלאה. הן לא יעבירו.', satire: 'הסופרים הורידו מחיר ב-1%. ואז העלו ב-1.5%. ״עלויות״.', capital: 5, cooldown: 8, effects: () => ({ taxes: { vat: -1 } }) },
    { id: 'propose_corp_raise', title: 'הצעה: העלאת מס חברות ב-1%', icon: '🏢', desc: 'להעלות מס חברות ב-1%. ההייטק מאיים לעזוב, כמו בכל שבוע.', satire: 'שלוש חברות הודיעו שהן עוברות לקפריסין. אחת באמת עברה. השתיים האחרות נכנסו לפאניקה בקבוצת ווטסאפ.', capital: 6, cooldown: 8, effects: () => ({ taxes: { corporateTax: 1 } }) },
  ],
  infrastructure: [
    { id: 'road_repair', title: 'מבצע "בור לא בכביש"', icon: '🕳️', desc: 'מתקנים בורות לפני שהם הופכים לבריכות ציבוריות.', satire: 'הבור הגדול בכביש 4 תוקן. הנהגים מתגעגעים. ״הוא היה כמו בן משפחה״.', capital: 2, cooldown: 6, effects: () => ({ budget: { infrastructure: 0.6 }, serviceBonus: { infrastructure: 2, transport: 1 }, groups: { periphery: 2 } }) },
    { id: 'water_reuse', title: 'מיחזור מי שפכים לחקלאות', icon: '♻️', desc: 'מי שפכים מטוהרים לחקלאות. לא לשאול מה בעגבנייה.', satire: 'החקלאים מרוצים. הצרכנים לא שואלים. כולם רגועים.', capital: 3, cooldown: 8, effects: () => ({ budget: { infrastructure: 0.8 }, serviceBonus: { infrastructure: 3 }, groups: { periphery: 2, left: 1 } }) },
  ],
  agriculture: [
    { id: 'water_quota', title: 'הגדלת מכסות מים לחקלאים', icon: '💧', desc: 'עוד מים לחקלאים. משרד התשתיות מחפש מים לשתות.', satire: 'החקלאים קיבלו מים. העיר הסמוכה קיבלה הודעה ״להתקלח בתור״.', capital: 3, cooldown: 8, effects: () => ({ groups: { periphery: 3, settlers: 2 }, serviceBonus: { infrastructure: -1 } }) },
    { id: 'import_tomatoes', title: 'פתיחת יבוא עגבניות', icon: '🍅', desc: 'יבוא עגבניות. המחיר יורד, הטרקטורים עולים לכביש.', satire: 'העגבנייה המיובאת זולה ב-40%. החקלאים זרקו עגבניות מקומיות על הכנסטון. מבוזבז.', capital: 4, cooldown: 10, effects: () => ({ economy: { inflation: -0.15 }, groups: { families: 3, lowIncome: 2, periphery: -4 } }) },
  ],
  science: [
    { id: 'brain_gain', title: 'תוכנית "חזרת המוחות"', icon: '🧠', desc: 'מענקים למדענים שחוזרים מחו״ל. חלקם יחזרו. לחופשה.', satire: 'המדען הראשון חזר, ראה את מחירי הדירות, וחזר לבוסטון.', capital: 3, cooldown: 8, effects: () => ({ budget: { science: 0.6 }, economy: { growth: 0.15 }, groups: { students: 2, highIncome: 1 } }) },
    { id: 'ai_lab', title: 'מעבדת AI לאומית', icon: '🤖', desc: 'מודל שפה שמדבר רק בפקודות של הגנרלים.', capital: 3, cooldown: 10, effects: () => ({ budget: { science: 1 }, economy: { growth: 0.2 }, groups: { youth: 2 } }), satire: 'מודל ה-AI הלאומי ענה על השאלה הראשונה: ״תלוי בסקרים״.' },
  ],
  culture: [
    { id: 'football', title: 'תקציב לליגת הכדורגל', icon: '⚽', desc: 'אצטדיונים חדשים. האוהדים זוכרים מי שילם. וגם מי לא.', satire: 'האצטדיון החדש נחנך בהפסד 0:4. האוהדים האשימו את השר.', capital: 2, cooldown: 6, effects: () => ({ budget: { culture: 0.5 }, groups: { periphery: 2, employees: 1, right: 1 } }) },
    { id: 'theater_cuts', title: 'קיצוץ בתיאטראות "לא נאמנים"', icon: '🎭', desc: 'קיצוץ בתיאטראות ״לא נאמנים״. האמנים כבר כותבים מחזה עליך.', satire: 'המחזה ״השר שקיצץ״ רץ בסולד אאוט. במימון פרטי.', capital: 4, cooldown: 10, effects: () => ({ budget: { culture: -0.3 }, groups: { right: 3, left: -5, secular: -2 } }) },
  ],
  economy: [
    { id: 'cut_red_tape', title: 'קיצוץ ביורוקרטיה לעסקים', icon: '📋', desc: 'רישיון עסק בשבוע ולא בשנה. הפקידים בהלם.', satire: 'הרישיון הראשון ניתן בשבוע. הפקיד שנתן אותו נשלח לייעוץ.', capital: 3, cooldown: 8, effects: () => ({ serviceBonus: { govServices: 3 }, economy: { growth: 0.15 }, groups: { selfEmployed: 4 } }) },
    { id: 'min_wage', title: 'העלאת שכר המינימום', icon: '💵', desc: 'העלאת שכר המינימום. העסקים הקטנים כבר מדפיסים שלט ״סגור״.', satire: 'שכר המינימום עלה ב-₪300. הקוטג׳ עלה ב-₪2. חשבון פשוט.', capital: 4, cooldown: 10, effects: () => ({ groups: { lowIncome: 5, employees: 2, selfEmployed: -4 }, economy: { inflation: 0.15, unemployment: 0.1 } }) },
  ],
  foreign: [
    { id: 'peace_summit', title: 'פסגה אזורית', icon: '🕊️', desc: 'תמונה משותפת, הצהרה כללית וארוחה טובה.', satire: 'הפסגה הסתיימה בהצלחה: כולם הסכימו שהקינוח היה מצוין.', capital: 4, cooldown: 10, effects: () => ({ playerPopularity: 3, playerReputation: 4, groups: { left: 3, center: 2, right: -1 }, economy: { growth: 0.1 } }) },
    { id: 'trade_deal', title: 'הסכם סחר חופשי', icon: '🤝', desc: 'יצוא עולה, חקלאים מקומיים בוכים.', satire: 'ההסכם נחתם. הדבר הראשון שיובא: עגבניות. החקלאים כבר בדרך.', capital: 3, cooldown: 10, effects: () => ({ economy: { growth: 0.25, inflation: -0.1 }, groups: { highIncome: 2, periphery: -2 } }) },
  ],
  justice: [
    { id: 'pardon', title: 'המלצה על חנינות לחג', icon: '🕊️', desc: 'חנינות לחג. רחמים, או ״קומבינה״. תלוי במי שמספר.', satire: 'אחד המחוננים הודה בטלוויזיה. ״חג שמח, ותודה לשר״.', capital: 3, cooldown: 8, effects: () => ({ groups: { religious: 2, left: -2 }, playerPopularity: -1 }) },
    { id: 'small_claims', title: 'תביעות קטנות אונליין', icon: '💻', desc: 'סכסוכי שכנים נפתרים בזום. עם מיוט.', satire: 'הדיון הראשון בזום נמשך שעתיים. השופט שכח לבטל מיוט.', capital: 2, cooldown: 8, effects: () => ({ budget: { government: 0.2 }, serviceBonus: { govServices: 2 }, groups: { selfEmployed: 2, middleClass: 1 } }) },
  ],
  strategic: [
    { id: 'think_tank', title: 'כנס "חשיבה אסטרטגית" במלון', icon: '🏨', desc: '3 ימים, 200 משתתפים, מסקנה אחת: צריך עוד כנס.', capital: 1, cooldown: 4, effects: () => ({ oneOffCost: 0.01, playerReputation: 1, groups: { center: -1 } }), satire: 'הכנס האסטרטגי הסתיים בהמלצה לקיים כנס אסטרטגי.' },
    { id: 'rebrand', title: 'מיתוג מחדש של המשרד', icon: '🎨', desc: 'לוגו חדש. עדיין אף אחד לא יודע מה עושים פה.', capital: 1, cooldown: 6, effects: () => ({ oneOffCost: 0.005, playerPopularity: 1 }), satire: 'הלוגו החדש של המשרד: סימן שאלה. מדויק.' },
  ],
  // ministries the PM can create during the game
  innovation: [
    { id: 'gov_apps', title: 'אפליקציה לכל משרד', icon: '📱', desc: '27 אפליקציות, אף אחת לא מתחברת.', satire: 'האפליקציה הממשלתית קיבלה דירוג של כוכב אחד. מהשר.', capital: 2, cooldown: 6, effects: () => ({ budget: { science: 0.4 }, serviceBonus: { govServices: 2 }, groups: { youth: 2 } }) },
    { id: 'sandbox', title: 'ארגז חול רגולטורי', icon: '🧪', desc: 'סטארטאפים בלי רגולציה. מה כבר יכול לקרות.', satire: 'הסטארטאפ הראשון בארגז החול שבר את ארגז החול.', capital: 3, cooldown: 8, effects: () => ({ economy: { growth: 0.2 }, groups: { highIncome: 2, left: -1 } }) },
  ],
  periphery: [
    { id: 'tax_benefits', title: 'הטבות מס לפריפריה', icon: '🏜️', desc: 'מי שגר רחוק משלם פחות. מי שגר קרוב כבר מחפש דירה רחוקה. על הנייר.', satire: '40 אלף תושבי המרכז רשמו כתובת בנגב. רובם עדיין בדיזנגוף.', capital: 3, cooldown: 8, effects: () => ({ groups: { periphery: 6, center: -2 }, regionInvestment: { negev: 8, north: 8 } }) },
    { id: 'factory', title: 'הקמת מפעל באזור עדיפות', icon: '🏭', desc: '400 משרות וטקס הנחת אבן פינה.', satire: 'אבן הפינה הונחה. גם אבן הפינה של הקדנציה הקודמת. ושל זו שלפניה.', capital: 3, cooldown: 10, effects: () => ({ budget: { infrastructure: 0.5 }, economy: { unemployment: -0.15 }, groups: { periphery: 4 }, regionInvestment: { negev: 12 } }) },
  ],
  happiness: [
    { id: 'national_hug', title: 'יום החיבוק הלאומי', icon: '🤗', desc: 'כולם מתחבקים. חוץ מהקואליציה.', capital: 1, cooldown: 6, effects: () => ({ playerPopularity: 2, groups: { families: 1 } }), satire: 'יום החיבוק הלאומי נגמר בשלוש תביעות על הטרדה.' },
    { id: 'happiness_index', title: 'מדד האושר הממשלתי', icon: '📈', desc: 'מודדים אושר ומשנים את השיטה עד שיוצא גבוה.', satire: 'מדד האושר עלה ב-40%. בעיקר במשרד לשמחה לאומית.', capital: 1, cooldown: 8, effects: () => ({ playerReputation: -2, playerPopularity: 2 }) },
  ],
  hasbara: [
    { id: 'influencers', title: 'משלחת משפיענים', icon: '📸', desc: '20 משפיענים, 4 ימים, 0 תוכן על המדינה.', satire: 'המשפיענית הראשונה פרסמה 40 סטוריז. כולם מהבריכה במלון.', capital: 2, cooldown: 6, effects: () => ({ oneOffCost: 0.01, playerPopularity: 2, groups: { youth: 2 } }) },
    { id: 'press_war_room', title: 'חמ״ל תגובות ברשת', icon: '🖥️', desc: 'מגיבים לכל ציוץ. גם לבוטים.', satire: 'החמ״ל ניהל ויכוח של 6 שעות עם בוט. הבוט ניצח.', capital: 2, cooldown: 6, effects: () => ({ playerPopularity: 1, partyMomentum: {} }) },
  ],
  jerusalem_affairs: [
    { id: 'old_city', title: 'שיפוץ העיר העתיקה', icon: '🏛️', desc: 'שיפוץ העיר העתיקה. הארכיאולוגים מאיימים לשבור משהו.', satire: 'בשיפוץ נמצא מטבע עתיק. עליו: פרצוף של שר. מהתקופה הקודמת.', capital: 3, cooldown: 8, effects: () => ({ budget: { culture: 0.5 }, regionInvestment: { jerusalem: 10 }, groups: { religious: 3, haredim: 2 } }) },
    { id: 'light_rail_jlm', title: 'קו רכבת קלה נוסף בירושלמה', icon: '🚋', desc: 'עבודות של שמונה שנים. הפקקים – מיד.', satire: 'הקו החדש ייפתח ב-2032. בינתיים הכביש סגור עד 2033.', capital: 3, cooldown: 10, effects: () => ({ budget: { transport: 0.8 }, serviceBonus: { transport: 2 }, regionInvestment: { jerusalem: 8 } }) },
  ],
};

export const MINISTRY_ACTIONS: Record<string, MinistryActionSpec[]> = {
  transport: [
    { id: 'night_buses', title: 'קווי לילה', icon: '🌙', desc: 'אוטובוסים אחרי חצות. בעיקר לשיכורים ולאחיות.', satire: 'קו הלילה הראשון יצא. נהג אחד, ארבעה נוסעים ושני חתולים.', capital: 2, cooldown: 4, effects: () => ({ budget: { transport: 0.4 }, serviceBonus: { transport: 2 }, groups: { youth: 3, students: 2 } }) },
    { id: 'bus_lanes', title: 'נתיבי תחבורה ציבורית', icon: '🚌', desc: 'נתיב לאוטובוס, פקק לכל השאר. דמוקרטיה של אספלט.', satire: 'נהגי הרכבים הפרטיים הקימו קבוצת ווטסאפ: ״נתיב תחבורה ציבורית זה גם שלנו״.', capital: 5, cooldown: 6, effects: () => ({ serviceBonus: { transport: 4 }, groups: { employees: 1, center: 1, selfEmployed: -3, periphery: -1 } }) },
    { id: 'student_transit', title: 'תחבורה חינם לסטודנטים', icon: '🎫', desc: 'רב-קו חינם לסטודנטים. כדי שיגיעו להפגנות בזמן.', satire: 'הסטודנטים חוגגים. בעיקר בדרך לבר.', capital: 3, cooldown: 8, effects: () => ({ budget: { transport: 0.6 }, groups: { students: 6, youth: 2 } }) },
    { id: 'taxi_reform', title: 'רפורמת המוניות', icon: '🚕', desc: 'פתיחת שוק המוניות לאפליקציות. נהגי המוניות מכינים טרקטורים.', capital: 6, cooldown: 8, effects: () => ({ serviceBonus: { transport: 1.5 }, groups: { youth: 3, selfEmployed: -4 }, economy: { inflation: -0.05 } }), satire: 'נהגי המוניות חסמו את איילון. זה לא שינה הרבה.' },
  ],
  education: [
    { id: 'teacher_raise', title: 'העלאת שכר מורים', icon: '🧑‍🏫', desc: 'מורים מרוויחים יותר. אולי יישארו עד דצמבר.', satire: 'המורים קיבלו העלאה. הם ישמחו לספר לכם על זה. בהפסקה של 10 דקות.', capital: 3, cooldown: 8, effects: () => ({ budget: { education: 2.5 }, serviceBonus: { education: 3 }, groups: { publicSector: 5, families: 2 } }) },
    { id: 'small_classes', title: 'הקטנת כיתות', icon: '🪑', desc: 'עד 28 תלמידים בכיתה. בתיאוריה.', satire: 'הכיתות קטנו. אין מספיק כיתות. התלמידים לומדים במסדרון. בקבוצות של 28.', capital: 3, cooldown: 8, effects: () => ({ budget: { education: 3 }, serviceBonus: { education: 4 }, groups: { families: 4 } }) },
    { id: 'math_hours', title: '5 יח״ל לכולם', icon: '➗', desc: 'עוד שעות מתמטיקה. הילדים מתכננים מרד.', satire: 'התלמידים פתרו את המשוואה: מתמטיקה + שישי = תסכול.', capital: 2, cooldown: 6, effects: () => ({ budget: { education: 0.5 }, serviceBonus: { education: 1.5 }, groups: { youth: -2, highIncome: 1 } }) },
    { id: 'bagrut_reform', title: 'רפורמת הבגרויות', icon: '📝', desc: 'מבטלים בחינות. או מוסיפים. תלוי בשר.', capital: 5, cooldown: 10, effects: () => ({ serviceBonus: { education: 2 }, groups: { students: 2, publicSector: -3 } }), satire: 'זו הרפורמה ה-14 בעשור. המורים כבר לא מרימים את הראש.' },
    { id: 'digital_school', title: 'מחשב לכל ילד', icon: '💻', desc: 'מחשב נייד לכל תלמיד. שישמש בעיקר לטיקטוק.', satire: 'בשבוע הראשון: 40% מהמחשבים נמצאו בחנויות יד שנייה.', capital: 2, cooldown: 8, effects: () => ({ budget: { education: 0.8 }, serviceBonus: { education: 2 }, groups: { youth: 2, families: 2 } }) },
  ],
  finance: [
    { id: 'across_cut', title: 'קיצוץ רוחבי של 2%', icon: '✂️', desc: 'כל המשרדים מקצצים 2%. כל השרים זועמים 100%.', satire: 'שבעה שרים איימו להתפטר. אף אחד לא התפטר. כולם קיצצו.', capital: 8, cooldown: 6, effects: (s) => ({ budget: { education: -s.budget.allocations.education * 0.02, health: -s.budget.allocations.health * 0.02, welfare: -s.budget.allocations.welfare * 0.02, transport: -s.budget.allocations.transport * 0.02, government: -s.budget.allocations.government * 0.02, defense: -s.budget.allocations.defense * 0.02 }, groups: { publicSector: -3 } }) },
    { id: 'enforcement', title: 'מבצע אכיפת מס', icon: '🔍', desc: 'מחפשים את הכסף בקופסאות נעליים. של הקטנים.', satire: 'מס הכנסה פשט על 400 עצמאים. הטייקון של הקומה העליונה ראה מהחלון.', capital: 4, cooldown: 4, effects: () => ({ revenue: 5, groups: { selfEmployed: -4, highIncome: -2, lowIncome: 1 } }) },
    { id: 'wealth_fund', title: 'קרן עושר לאומית', icon: '🏦', desc: 'חוסכים לדורות הבאים. ולבחירות הבאות.', satire: 'הקרן נפתחה. הפוליטיקאי הראשון כבר הציע ״רק לשאול ממנה קצת״.', capital: 4, cooldown: 12, effects: () => ({ economy: { inflation: -0.2, growth: 0.1 }, groups: { highIncome: 1 }, playerReputation: 3 }) },
  ],
  health: [
    { id: 'er_doctors', title: 'תקנים לרופאים במיון', icon: '🩺', desc: '500 תקנים חדשים במיון. עכשיו רק צריך 500 רופאים.', satire: 'התקנים נפתחו. הרופאים נשארו בגרמניה.', capital: 3, cooldown: 6, effects: () => ({ budget: { health: 1.5 }, serviceBonus: { health: 3 }, groups: { elderly: 3, families: 1 } }) },
    { id: 'queues', title: 'מבצע קיצור תורים', icon: '⏱️', desc: 'ניתוחים גם בערב. המנתחים עדיין לא אוהבים אותך.', satire: 'התור לניתוח ירד מ-14 חודשים ל-11. החגיגות נמשכו 3 חודשים.', capital: 2, cooldown: 6, effects: () => ({ budget: { health: 1 }, serviceBonus: { health: 2 }, groups: { families: 2, retirees: 2 } }) },
    { id: 'nurse_raise', title: 'הסכם שכר לאחיות', icon: '💉', desc: 'הסכם שכר לאחיות. מונע שביתה. כנראה. אולי.', satire: 'האחיות חתמו. בעט של בית החולים. שאול.', capital: 2, cooldown: 8, effects: () => ({ budget: { health: 1 }, serviceBonus: { health: 2 }, groups: { publicSector: 4 } }) },
  ],
  defense: [
    { id: 'reservist_grant', title: 'מענק מילואים', icon: '🎖️', desc: 'מענק לכל מי שעשה 30+ ימים. שווה בערך ארוחה אחת בתל אביב.', satire: 'המילואימניקים קיבלו מענק. הבוס שלהם קיבל התקף לב.', capital: 2, cooldown: 6, effects: () => ({ budget: { defense: 1 }, groups: { reservists: 6, families: 1 } }) },
    { id: 'procurement', title: 'רכש מטוסים חדשים', icon: '✈️', desc: 'מטוסים חדשים. יגיעו ב-2034. אולי.', satire: 'המטוס הראשון הגיע. בלי טייס. ״זה בהזמנה הבאה״.', capital: 4, cooldown: 10, effects: () => ({ budget: { defense: 3 }, serviceBonus: { security: 5 }, groups: { right: 2, left: -2 } }) },
    { id: 'shorter_service', title: 'קיצור שירות החובה', icon: '⏳', desc: 'חודשיים פחות. הצבא בהלם, האמהות במסיבה.', satire: 'הצבא הודיע שזה ״סיכון אסטרטגי״. החיילים הודיעו שזה ״וואו״.', capital: 6, cooldown: 12, effects: () => ({ serviceBonus: { security: -3 }, groups: { soldiers: 6, youth: 3, reservists: -3, right: -2 }, economy: { growth: 0.15 } }) },
  ],
  housing: [
    { id: 'lottery', title: 'הגרלת "מחיר מטרה"', icon: '🎟️', desc: 'דירות בהנחה, למי שזוכה. כלומר לא אתה.', satire: 'בהגרלה השתתפו 400 אלף זוגות. זכו 2,000. השאר קיבלו מכתב ״תודה על ההשתתפות״.', capital: 2, cooldown: 6, effects: () => ({ budget: { housing: 1.5 }, serviceBonus: { housing: 3 }, groups: { youth: 4, families: 2 } }) },
    { id: 'rent_aid', title: 'סיוע בשכר דירה לזוגות צעירים', icon: '🔑', desc: 'מענק שכר דירה לצעירים. בעלי הדירות כבר מעלים מחיר.', satire: 'שבוע אחרי המענק עלה שכר הדירה בדיוק בגובה המענק. מדויק להפליא.', capital: 2, cooldown: 6, effects: () => ({ budget: { housing: 1.2 }, groups: { youth: 5, students: 2 }, economy: { inflation: 0.05 } }) },
    { id: 'urban_renewal', title: 'פינוי-בינוי מואץ', icon: '🏚️', desc: 'פינוי-בינוי מואץ. השכנים מתווכחים, הקבלן מחייך.', satire: 'הבניין הראשון פונה. הדיירים יחזרו ב-2031. אולי.', capital: 4, cooldown: 10, effects: () => ({ serviceBonus: { housing: 4, infrastructure: 1 }, groups: { center: 2, elderly: -2, selfEmployed: 2 } }), metric: { service: 'housing', key: 'units', amount: 5000 } },
    { id: 'planning', title: 'רפורמת תכנון ובנייה', icon: '📐', desc: 'היתר בנייה בפחות משבע שנים. מהפכה.', satire: 'ההיתר הראשון ניתן תוך 6 שנים ו-11 חודשים. ניצחון.', capital: 6, cooldown: 10, effects: () => ({ serviceBonus: { housing: 5 }, groups: { youth: 2, selfEmployed: 2, left: -1 } }) },
  ],
  welfare: [
    { id: 'food_basket', title: 'סל מזון לנזקקים', icon: '🧺', desc: 'תווי מזון לחגים. באיור של השר.', satire: 'תווי המזון הגיעו אחרי החג. ״עיכוב בהדפסה של התמונה של השר״.', capital: 2, cooldown: 4, effects: () => ({ budget: { welfare: 1 }, serviceBonus: { welfare: 2 }, groups: { lowIncome: 5 } }) },
    { id: 'social_workers', title: 'תקנים לעובדים סוציאליים', icon: '🧑‍⚕️', desc: '800 תקנים לעובדים סוציאליים. עם משכורת שלא מספיקה לעובד סוציאלי.', satire: 'התקנים אוישו. העובדים הסוציאליים פנו לעזרה. לעצמם.', capital: 2, cooldown: 8, effects: () => ({ budget: { welfare: 0.8 }, serviceBonus: { welfare: 3 }, groups: { publicSector: 3, lowIncome: 2 } }) },
    { id: 'negative_tax', title: 'מס הכנסה שלילי', icon: '➖', desc: 'מענק לעובדים בשכר נמוך. הטפסים ארוכים יותר מהמענק.', satire: 'הטופס כולל 14 עמודים. 30% מהזכאים ויתרו בעמוד 3.', capital: 4, cooldown: 10, effects: () => ({ budget: { welfare: 2 }, groups: { lowIncome: 5, employees: 2 }, economy: { unemployment: -0.25 } }) },
    { id: 'pension_bump', title: 'תוספת לקצבת זקנה', icon: '👵', desc: '₪200 בחודש לכל גמלאי. מקרי לגמרי שהם מצביעים.', satire: 'הגמלאים קיבלו תוספת. הם שלחו מכתב תודה. בפקס.', capital: 2, cooldown: 8, effects: () => ({ budget: { welfare: 1.5 }, groups: { retirees: 6, elderly: 3 } }) },
  ],
  energy: [
    { id: 'renewables', title: 'האצת אנרגיה מתחדשת', icon: '🌞', desc: 'פאנלים על כל גג ממשלתי. גם על גגות שדולפים.', satire: 'הפאנלים הותקנו. השמש, כרגיל, לא שיתפה פעולה בחורף.', capital: 3, cooldown: 6, effects: () => ({ budget: { energy: 1 }, serviceBonus: { energy: 3 }, groups: { left: 2, youth: 1 } }), metric: { service: 'energy', key: 'renewables', amount: 2 } },
    { id: 'gas_deal', title: 'עסקת גז ייצוא', icon: '🛢️', desc: 'כסף מהגז לקופה. השמאל כבר מכין הפגנה בים.', satire: 'העסקה נחתמה על סיפון יאכטה. ״במקרה״.', capital: 4, cooldown: 12, effects: () => ({ revenue: 6, groups: { highIncome: 2, left: -3 }, economy: { growth: 0.2 } }) },
    { id: 'smart_grid', title: 'רשת חשמל חכמה', icon: '🔌', desc: 'פחות הפסקות, יותר חיישנים שמרגלים אחרי המזגן שלך.', satire: 'הרשת החכמה זיהתה שהשר משאיר את המזגן דולק כשהוא בחו״ל.', capital: 3, cooldown: 8, effects: () => ({ budget: { energy: 1.2 }, serviceBonus: { energy: 4 } }) },
    { id: 'price_freeze', title: 'הקפאת מחירי החשמל', icon: '🧊', desc: 'הקפאת מחירי החשמל. חברת החשמל בוכה, המזגנים צוחקים.', satire: 'חברת החשמל ביקשה חילוץ. בחושך.', capital: 3, cooldown: 8, effects: () => ({ serviceBonus: { energy: -3 }, groups: { families: 3, selfEmployed: 3 }, economy: { inflation: -0.15 } }) },
  ],
  interior: [
    { id: 'digital_id', title: 'תעודת זהות דיגיטלית', icon: '📱', desc: 'סוף לתורים, התחלה לסיסמאות שנשכחות.', satire: 'מערכת הזיהוי הדיגיטלית ביקשה מהשר לזהות את עצמו. היא לא הצליחה.', capital: 3, cooldown: 10, effects: () => ({ budget: { government: 0.4 }, serviceBonus: { govServices: 5 }, groups: { youth: 2, selfEmployed: 2, elderly: -1 } }) },
    { id: 'local_grants', title: 'מענקי איזון לרשויות', icon: '🏘️', desc: 'כסף לרשויות בפריפריה. ראשי ערים מחייכים, ומבקשים עוד.', satire: 'ראש עיר אחד בנה בכסף כיכר עם פסל שלו. ״יצירת אמנות מקומית״.', capital: 2, cooldown: 6, effects: () => ({ budget: { government: 1 }, groups: { periphery: 4 }, regionInvestment: { negev: 5, north: 5 } }) },
    { id: 'one_stop', title: 'מרכז שירות "הכול במקום אחד"', icon: '🪪', desc: 'תעודת זהות בלי לקחת יום חופש. בתיאוריה.', satire: 'במרכז החדש: מכונת מספרים חכמה. המספר שלך: 847. עכשיו בתור: 12.', capital: 2, cooldown: 8, effects: () => ({ budget: { government: 0.5 }, serviceBonus: { govServices: 4 }, groups: { selfEmployed: 3, employees: 1 } }) },
  ],
  police: [
    { id: 'community_policing', title: 'שיטור קהילתי', icon: '🚲', desc: 'שוטר שמכיר את השכונה. ואת כולם בה. ואת הסודות שלהם.', satire: 'השוטר הקהילתי מכיר עכשיו את כל הרכילות בשכונה. הוא כבר כותב ספר.', capital: 2, cooldown: 6, effects: () => ({ budget: { police: 0.6 }, serviceBonus: { security: 2 }, groups: { periphery: 2, families: 1 } }) },
    { id: 'traffic_cams', title: 'מצלמות אכיפה', icon: '📸', desc: 'פחות תאונות, יותר דוחות. בעיקר יותר דוחות.', satire: 'המצלמה הראשונה צילמה את רכב השר. הדוח בוטל ״מטעמי ביטחון״.', capital: 3, cooldown: 8, effects: () => ({ revenue: 1, serviceBonus: { transport: 1.5 }, groups: { employees: -2, selfEmployed: -2 } }) },
    { id: 'more_cops', title: 'גיוס 2,000 שוטרים', icon: '👮', desc: '2,000 שוטרים חדשים. 400 מהם ילכו לאבטח שרים.', satire: 'השוטרים החדשים גויסו. רובם לחסום הפגנות נגד השוטרים החדשים.', capital: 2, cooldown: 8, effects: () => ({ budget: { police: 1 }, serviceBonus: { security: 2 }, groups: { elderly: 2, periphery: 2 } }) },
  ],
  infrastructure: [
    { id: 'pipes', title: 'החלפת צנרת לאומית', icon: '🔧', desc: 'החלפת צנרת לאומית. לא סקסי, מאוד נחוץ, אף אחד לא יצביע בגללו.', satire: 'הצנרת הוחלפה. תושבי שלוש ערים גילו שהמים אמורים להיות שקופים.', capital: 2, cooldown: 8, effects: () => ({ budget: { infrastructure: 1 }, serviceBonus: { infrastructure: 3 } }) },
  ],
  agriculture: [
    { id: 'farm_subsidy', title: 'סובסידיה לחקלאים', icon: '🚜', desc: 'סובסידיה לחקלאים, כדי שהעגבנייה תישאר כחול-לבן. ויקרה.', satire: 'החקלאים קיבלו את הכסף והפגינו בכל זאת. מתוך הרגל.', capital: 2, cooldown: 6, effects: () => ({ budget: { agriculture: 0.8 }, groups: { periphery: 4, settlers: 2 } }) },
  ],
  science: [
    { id: 'grants', title: 'מענקי חדשנות', icon: '🧪', desc: 'כסף לסטארטאפים. חלקם אפילו יצליחו. לא כאן.', satire: 'הסטארטאפ הראשון שקיבל מענק עבר לפורטוגל. עם המענק.', capital: 2, cooldown: 6, effects: () => ({ budget: { science: 1 }, economy: { growth: 0.25 }, groups: { highIncome: 2, students: 2 } }) },
  ],
  culture: [
    { id: 'festival', title: 'פסטיבל לאומי', icon: '🎪', desc: 'מוזיקה, אוכל ונאום ארוך של השר.', satire: 'הקהל שר את כל השירים. בנאום של השר – שקט מוחלט, חוץ מנחירות.', capital: 1, cooldown: 4, effects: () => ({ budget: { culture: 0.3 }, groups: { secular: 2, youth: 2, left: 1 }, playerPopularity: 2 }) },
  ],
  economy: [
    { id: 'jobs', title: 'תוכנית "חזרה לעבודה"', icon: '👷', desc: 'הכשרות למובטלים. בעיקר בעיצוב מצגות.', satire: 'בוגרי התוכנית יודעים עכשיו לעצב מצגת על למה אין להם עבודה.', capital: 2, cooldown: 6, effects: () => ({ budget: { welfare: 0.8 }, economy: { unemployment: -0.35 }, groups: { lowIncome: 3, employees: 1 } }) },
  ],
  foreign: [
    { id: 'world_tour', title: 'סיור הסברה עולמי', icon: '🛫', desc: '14 מדינות ב-5 ימים. התמונות מדהימות.', capital: 2, cooldown: 4, effects: () => ({ playerPopularity: 3, playerReputation: 2, oneOffCost: 0.02 }), satire: 'בתמונות: השר בכל בירה בעולם. בפגישות: אף אחד.' },
  ],
  justice: [
    { id: 'courts', title: 'ייעול בתי המשפט', icon: '⚖️', desc: 'פחות דחיות, יותר פסקי דין. בתיאוריה.', satire: 'התיק הראשון שקודם במסלול המהיר הוגש ב-2011.', capital: 3, cooldown: 8, effects: () => ({ serviceBonus: { govServices: 2 }, playerReputation: 3, groups: { center: 1 } }) },
  ],
  strategic: [
    { id: 'strategy_paper', title: 'מסמך אסטרטגי לאומי', icon: '📄', desc: '300 עמודים שאף אחד לא יקרא.', capital: 1, cooldown: 4, effects: () => ({ playerReputation: 1 }), satire: 'המסמך הוגש. המסקנה: צריך מסמך נוסף.' },
  ],
};

for (const [id, list] of Object.entries(MORE)) MINISTRY_ACTIONS[id] = [...(MINISTRY_ACTIONS[id] ?? []), ...list];
