import type { BudgetCategory, Domain, EconomyShock, Effects, GroupId, Ideology, ServiceId } from '../types/game';

export interface LawDef {
  id: string;
  title: string;
  icon: string;
  domain: Domain;
  level: 'medium' | 'major';
  ideology: Ideology; // where the law sits; parties close to it support it
  description: string;
  /** permanent satisfaction offsets while law is active */
  groups: Partial<Record<GroupId, number>>;
  /** annual budget cost added to a category */
  budget?: { category: BudgetCategory; amount: number };
  serviceBonus?: Partial<Record<ServiceId, number>>;
  structural?: EconomyShock;
  revenueFactor?: number; // multiplier change on revenue (e.g. -0.01)
  onPass?: Effects;
  satire?: string;
}

export const LAWS: LawDef[] = [
  {
    id: 'draft_equality', title: 'חוק השוויון בנטל (סוף סוף? אולי?)', icon: '🪖', domain: 'defense', level: 'major',
    ideology: { economic: 0, security: 0.4, religion: -0.8 }, description: 'גיוס לכולם, כולל לומדי הקוגל. מנסים כבר 40 שנה.', satire: 'החוק עבר. 40 אלף צווי גיוס נשלחו. 39,800 חזרו עם ״לא נמצא בכתובת״.',
    groups: { haredim: -18, reservists: 10, secular: 8, soldiers: 5, center: 3, religious: -2 }, serviceBonus: { security: 4 },
    structural: { growth: 0.15 },
  },
  {
    id: 'draft_exemption', title: 'חוק הפטור הנצחי', icon: '📜', domain: 'defense', level: 'major',
    ideology: { economic: 0, security: 0.2, religion: 1 }, description: 'מעגן לנצח את מה שכבר קורה בפועל. נצח, אגב, זה עד הבג״ץ הבא.', satire: 'המילואימניקים קראו על החוק במוצב. אין שם קליטה, אז רק אחרי שלושה שבועות.',
    groups: { haredim: 14, reservists: -12, secular: -10, soldiers: -6, center: -4 }, serviceBonus: { security: -2 },
  },
  {
    id: 'yeshiva_budget', title: 'חוק הסגולה התקציבית', icon: '📖', domain: 'education', level: 'medium',
    ideology: { economic: -0.3, security: 0, religion: 1 }, description: 'תוספת קבועה לישיבות, כי תפילה זה גם סוג של תעסוקה.', satire: 'שר האוצר: ״זה לא כסף קואליציוני, זו השקעה רוחנית״.',
    groups: { haredim: 10, secular: -6, middleClass: -2, left: -3 }, budget: { category: 'education', amount: 2.5 },
  },
  {
    id: 'shabbat_transit', title: 'חוק האוטובוס של שבת', icon: '🚌', domain: 'transport', level: 'medium',
    ideology: { economic: -0.2, security: 0, religion: -1 }, description: 'אוטובוסים בשבת, בעיקר בשביל מי שאין לו רכב, אומץ או חברים.', satire: 'האוטובוס הראשון בשבת יצא בזמן. זה היה החלק הכי מדהים.',
    groups: { secular: 8, youth: 6, students: 5, lowIncome: 3, haredim: -10, religious: -6 }, budget: { category: 'transport', amount: 0.8 }, serviceBonus: { transport: 4 },
  },
  {
    id: 'rent_control', title: 'חוק בעל הבית הבוכה', icon: '🔑', domain: 'housing', level: 'medium',
    ideology: { economic: -0.9, security: 0, religion: 0 }, description: 'תקרה לעליית שכר דירה. בעלי הדירות כבר מפרסמים ״רק לסטודנטים שלא נושמים״.', satire: 'בעלי הדירות הקימו ארגון מחאה. המטה – בדירה שלהם בפריז.',
    groups: { youth: 8, students: 7, lowIncome: 5, highIncome: -6, selfEmployed: -2 }, structural: { growth: -0.1 }, serviceBonus: { housing: 3 },
  },
  {
    id: 'public_housing', title: 'חוק הדירה של כולם (בערך)', icon: '🏢', domain: 'housing', level: 'major',
    ideology: { economic: -0.8, security: 0, religion: 0 }, description: 'המדינה בונה דירות! במקומות שאף אחד לא רוצה לגור, אבל בונה.', satire: 'הדירה הראשונה חולקה לבן דוד של המנכ״ל. צירוף מקרים.',
    groups: { lowIncome: 9, youth: 5, families: 4, highIncome: -3 }, budget: { category: 'housing', amount: 3.5 }, serviceBonus: { housing: 8 },
  },
  {
    id: 'free_daycare', title: 'חוק המעון החינמי', icon: '🧸', domain: 'education', level: 'major',
    ideology: { economic: -0.6, security: 0, religion: 0 }, description: 'חינוך חינם מגיל 0, כי גם תינוקות צריכים לאהוב את הממשלה.', satire: 'ההורים בכו מאושר. הגננות בכו מסיבות אחרות.',
    groups: { families: 10, youth: 5, employees: 3, highIncome: -2 }, budget: { category: 'education', amount: 6 }, serviceBonus: { education: 5 },
    structural: { unemployment: -0.3, growth: 0.1 },
  },
  {
    id: 'startup_tax', title: 'חוק ״גם למיליונרים מגיע״', icon: '🚀', domain: 'economy', level: 'medium',
    ideology: { economic: 0.9, security: 0, religion: 0 }, description: 'הטבות מס להייטק, כדי שלא יעזבו לקפריסין. הם יעזבו בכל מקרה, אבל בלי מס.', satire: 'מנכ״ל הייטק הודה לממשלה בציוץ. מליסבון.',
    groups: { highIncome: 6, youth: 2, students: 2, left: -4, lowIncome: -2 }, structural: { growth: 0.35 }, revenueFactor: -0.012,
  },
  {
    id: 'digital_gov', title: 'חוק הטופס המקוון', icon: '💻', domain: 'management', level: 'medium',
    ideology: { economic: 0.3, security: 0, religion: 0 }, description: 'כל טופס גם באינטרנט! עדיין צריך להדפיס, לחתום, לסרוק ולשלוח בפקס.', satire: 'האתר הממשלתי החדש עלה. הוא תומך רק באינטרנט אקספלורר 6.',
    groups: { selfEmployed: 5, youth: 3, publicSector: -3, elderly: -1 }, serviceBonus: { govServices: 10 }, budget: { category: 'government', amount: 0.6 },
  },
  {
    id: 'hill_settlement', title: 'חוק גבעה 17 (ו-18, ו-19)', icon: '⛺', domain: 'housing', level: 'major',
    ideology: { economic: 0.3, security: 1, religion: 0.7 }, description: 'מכשיר גבעה שאף אחד לא ידע שקיימת, כולל מי שגר עליה.', satire: 'בגבעה 17 גרים ארבעה אנשים, עז ונציג תקשורת.',
    groups: { settlers: 14, right: 5, religious: 4, left: -12, center: -3 }, budget: { category: 'housing', amount: 1.5 },
  },
  {
    id: 'reservist_benefits', title: 'חוק ״תודה, נתראה בסבב הבא״', icon: '🎖️', domain: 'defense', level: 'medium',
    ideology: { economic: 0, security: 0.6, religion: 0 }, description: 'נקודות זיכוי, הנחות וחנייה שמורה. העבודה שלך עדיין לא תחכה לך.', satire: 'המילואימניק הראשון שניסה לממש את ההטבה: ״יש תור. שבעה חודשים״.',
    groups: { reservists: 14, soldiers: 5, families: 2, right: 2 }, budget: { category: 'defense', amount: 1.2 }, revenueFactor: -0.003,
  },
  {
    id: 'pension_boost', title: 'חוק הגמלאי המרוצה', icon: '🧓', domain: 'welfare', level: 'medium',
    ideology: { economic: -0.6, security: 0, religion: 0 }, description: 'העלאת קצבאות זקנה. מקרי לחלוטין שגמלאים מצביעים יותר מכולם.', satire: 'הגמלאים חוגגים. עם תה, ביסקוויטים וקללות לנהגי האוטובוס.',
    groups: { retirees: 14, elderly: 8, lowIncome: 3, youth: -2 }, budget: { category: 'welfare', amount: 3 }, serviceBonus: { welfare: 4 },
  },
  {
    id: 'term_limits', title: 'חוק ״מספיק, לך הביתה״', icon: '⏳', domain: 'law', level: 'major',
    ideology: { economic: 0, security: 0, religion: -0.2 }, description: 'ראש ממשלה – עד שמונה שנים. כן, גם הוא. במיוחד הוא.',
    groups: { center: 6, left: 6, secular: 3, youth: 3, right: -3 }, satire: 'בנצי כסאי הודיע שהוא ״לוקח את זה אישית״ ושמונה שנים זה ״רק חימום״.',
  },
  {
    id: 'loyalty_law', title: 'חוק החנפן הממלכתי', icon: '🤝', domain: 'law', level: 'medium',
    ideology: { economic: 0.2, security: 0.5, religion: 0.3 }, description: 'מנכ״לים ייבחרו לפי נאמנות. כישורים? זה עניין של נאמנות.',
    groups: { right: 2, left: -8, center: -5, publicSector: -6 }, serviceBonus: { govServices: -6 }, satire: 'המנכ״ל החדש של משרד הבריאות: הנהג של השר. לפחות הוא יודע איפה בית החולים.',
  },
  {
    id: 'chair_law', title: 'חוק הכיסא (חסינות בישיבה)', icon: '🪑', domain: 'law', level: 'major',
    ideology: { economic: 0.3, security: 0.4, religion: 0.3 }, description: 'אי אפשר להדיח ראש ממשלה בזמן שהוא יושב. הוא כבר לא קם.',
    groups: { left: -14, center: -9, secular: -5, right: 3 }, onPass: { stability: 12 }, satire: 'מעכשיו ראש הממשלה ישן בישיבה ואוכל בישיבה. הכיסא: מודל ארגונומי מיוחד.',
  },
  {
    id: 'vat_food', title: 'חוק הקוטג׳ הפטור', icon: '🥖', domain: 'economy', level: 'medium',
    ideology: { economic: -0.5, security: 0, religion: 0 }, description: 'לחם, חלב וקוטג׳ בלי מע״מ. הרשתות יורידו מחיר. חחח.', satire: 'המחיר ירד בשקל. אחרי שבוע עלה בשקל וחצי. ״עלויות לוגיסטיות״.',
    groups: { lowIncome: 8, families: 6, retirees: 4, middleClass: 3 }, revenueFactor: -0.014, structural: { inflation: -0.3 },
  },
  {
    id: 'phones_ban', title: 'חוק ״תסתכלו על המורה״', icon: '📵', domain: 'education', level: 'medium',
    ideology: { economic: 0, security: 0, religion: 0.2 }, description: 'טלפונים בלוקר. הילדים בהלם, המורים בהלם, הלוקרים בהלם.', satire: 'ביום הראשון של החוק גילו 400 תלמידים שיש להם חברים.',
    groups: { families: 4, elderly: 3, youth: -6, students: -1 }, serviceBonus: { education: 3 },
  },
  {
    id: 'dairy_reform', title: 'רפורמת הקוטג׳ הגדולה', icon: '🧀', domain: 'agriculture', level: 'medium',
    ideology: { economic: 0.6, security: 0, religion: 0 }, description: 'פתיחת שוק החלב ליבוא. הפרות המקומיות במשבר זהות.', satire: 'הקוטג׳ המיובא טעים יותר. אסור להגיד את זה בפריפריה.',
    groups: { families: 5, lowIncome: 4, periphery: -5, settlers: -2 }, structural: { inflation: -0.25 },
  },
  {
    id: 'mk_pension', title: 'חוק ״גם לנו מגיע״', icon: '🛋️', domain: 'law', level: 'medium',
    ideology: { economic: -0.1, security: 0, religion: 0 }, description: 'פנסיה תקציבית מפנקת לחברי הכנסטון. רק לנו, כי אנחנו עובדים קשה. לפעמים.',
    groups: { lowIncome: -6, middleClass: -6, youth: -5, center: -4, publicSector: -2 }, budget: { category: 'government', amount: 0.3 }, onPass: { stability: 8 },
    satire: 'החוק עבר ברוב של 119. ח״כ אחד היה בשירותים. הוא הצביע משם.',
  },
  {
    id: 'national_birthday', title: 'חוק יום ההולדת הלאומי', icon: '🎂', domain: 'culture', level: 'medium',
    ideology: { economic: 0, security: 0, religion: 0 }, description: 'יום חופש לאומי ביום ההולדת של השר. ״זה לא אישי, זה לאומי״.',
    groups: { employees: 4, students: 4, youth: 3, selfEmployed: -5, highIncome: -3 }, structural: { growth: -0.08 },
    satire: 'במצעד יום ההולדת הלאומי השתתפו 400 איש. 380 מהם עובדי המשרד.',
  },
];

// ---- laws for ministries that had none of their own ----
LAWS.push(
  {
    id: 'dental_care', title: 'חוק ״תפתח רחב״', icon: '🦷', domain: 'health', level: 'medium',
    ideology: { economic: -0.5, security: 0, religion: 0 }, description: 'טיפולי שיניים חינם עד גיל 18. מגיל 19 – תתפלל.', satire: 'רופאי השיניים מחו. בפה סגור.',
    groups: { families: 7, lowIncome: 4, youth: 2, highIncome: -1 }, budget: { category: 'health', amount: 1.2 }, serviceBonus: { health: 3 },
  },
  {
    id: 'nurse_ratio', title: 'חוק האחות האחת לשמונה', icon: '🩺', domain: 'health', level: 'major',
    ideology: { economic: -0.4, security: 0, religion: 0 }, description: 'אחות לשמונה מטופלים ולא לעשרים ושבעה. מהפכה.', satire: 'האחיות שמחו. חוץ מזה שעדיין אין אחיות.',
    groups: { elderly: 5, retirees: 5, publicSector: 6, families: 2 }, budget: { category: 'health', amount: 2.5 }, serviceBonus: { health: 7 },
  },
  {
    id: 'solar_roofs', title: 'חוק הגג הירוק', icon: '🔆', domain: 'energy', level: 'medium',
    ideology: { economic: -0.1, security: 0, religion: 0 }, description: 'פאנלים על כל בניין חדש. הקבלנים כבר מתמחרים את זה פי שלושה.', satire: 'הפאנל הראשון הותקן הפוך. ״זה עובד גם בלילה?״',
    groups: { left: 5, youth: 3, selfEmployed: -2, families: 1 }, budget: { category: 'energy', amount: 0.6 }, serviceBonus: { energy: 6 },
  },
  {
    id: 'gas_royalties', title: 'חוק ״הגז שלנו (קצת)״', icon: '🔥', domain: 'energy', level: 'medium',
    ideology: { economic: -0.6, security: 0, religion: 0 }, description: 'יותר כסף לציבור ממאגרי הגז. הטייקונים מעבירים את היאכטות לנמל אחר.', satire: 'הטייקון הראשון הגיב: ״אני עובר לגור באסדה״.',
    groups: { lowIncome: 4, left: 4, highIncome: -5 }, revenueFactor: 0.006, structural: { growth: -0.05 },
  },
  {
    id: 'fast_track', title: 'חוק ״תבנו כבר!״', icon: '🛤️', domain: 'infrastructure', level: 'major',
    ideology: { economic: 0.4, security: 0, religion: 0 }, description: 'מכרזים בחודשים ולא בעשורים. השכנים יתנגדו בכל מקרה, על עיקרון.', satire: 'הכביש הראשון במסלול המהיר נתקע בגלל צב נדיר שאף אחד לא ראה.',
    groups: { periphery: 5, selfEmployed: 3, left: -3, center: 1 }, serviceBonus: { infrastructure: 6, transport: 2 }, structural: { growth: 0.15 },
  },
  {
    id: 'digital_embassies', title: 'חוק השגריר בטיקטוק', icon: '🌐', domain: 'foreign', level: 'medium',
    ideology: { economic: 0.3, security: 0.1, religion: 0 }, description: 'סוגרים 12 שגרירויות ופותחים חשבון טיקטוק בכל שפה.',
    groups: { youth: 3, center: 2, elderly: -2, publicSector: -3 }, budget: { category: 'government', amount: -0.4 },
    satire: 'השגריר הראשון בטיקטוק עשה 2 מיליון צפיות. על ריקוד. אף אחד לא זוכר את המדינה.',
  },
);

export const LAW_BY_ID = Object.fromEntries(LAWS.map((l) => [l.id, l])) as Record<string, LawDef>;
