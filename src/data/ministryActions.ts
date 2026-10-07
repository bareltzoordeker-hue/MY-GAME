import type { Effects, GameState, Ministry } from '../types/game';

// ============================================================
// Ministry actions: what a minister (or the PM instructing them) can do.
// Every action changes real numbers. Tone: factual. Cooldowns are in turns
// (a turn is 4 months; 2 weeks during an election campaign).
// ============================================================

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
  policy: '📋 מדיניות', law: '📜 תקנות וחקיקה', appoint: '🪪 מינויים', media: '📣 הסברה', budget: '💰 תקציב', extreme: '⚠️ צעדים חריגים',
};

export interface MinistryActionSpec {
  id: string;
  title: string;
  icon: string;
  desc: string;
  capital: number;
  cooldown: number;
  effects: (s: GameState, m?: Ministry) => Effects;
  metric?: { service: string; key: string; amount: number };
  /** a short factual note shown after the action (when it has no random outcomes) */
  note?: string;
  cat?: ActionCat;
  /** acts without the PM's approval: happens anyway, but the PM and the coalition take it badly */
  rogue?: boolean;
  outcomes?: MinistryOutcome[];
  crisis?: string;
  /** direct changes to the ministry itself (efficiency, bureaucracy) */
  mutate?: (s: GameState, m: Ministry) => void;
}

type Fx = Effects | ((s: GameState, m?: Ministry) => Effects);
const act = (cat: ActionCat, id: string, icon: string, title: string, desc: string, capital: number, cooldown: number, effects: Fx, more: Partial<MinistryActionSpec> = {}): MinistryActionSpec =>
  ({ cat, id, icon, title, desc, capital, cooldown, effects: typeof effects === 'function' ? effects : () => effects, ...more });
const out = (w: number, tone: MinistryOutcome['tone'], text: string, effects?: MinistryOutcome['effects'], headline?: string, crisis?: string): MinistryOutcome =>
  ({ w, tone, text, effects, headline, crisis });

export const MINISTRY_ACTIONS: Record<string, MinistryActionSpec[]> = {
  // ===================== DEFENSE =====================
  defense: [
    act('budget', 'def_f35', '✈️', 'רכש טייסת F-35 נוספת', 'הרחבת חיל האוויר במימון הסיוע האמריקאי ותוספת מתקציב המדינה. משפר הרתעה לטווח ארוך.', 4, 4,
      { budget: { defense: 2 }, serviceBonus: { security: 4 }, groups: { right: 3, reservists: 1 } }, { note: 'המטוסים יגיעו בתוך כמה שנים; ההשפעה המלאה תורגש בהדרגה.' }),
    act('budget', 'def_iron_dome', '🛡️', 'הצטיידות בסוללות ומיירטים לכיפת ברזל', 'מלאי מיירטים וסוללות נוספות להגנת העורף מפני רקטות.', 3, 3,
      { budget: { defense: 1.5 }, services: { security: 3 }, groups: { periphery: 4, families: 2 } }),
    act('budget', 'def_laser', '🔦', 'האצת מערכת הלייזר "אור איתן"', 'יירוט רקטות וכטב״מים בעלות נמוכה. דורש השקעה עכשיו וחוסך בהמשך.', 3, 4,
      { budget: { defense: 1 }, serviceBonus: { security: 3 }, groups: { periphery: 2, right: 1 }, economy: { growth: 0.05 } }),
    act('policy', 'def_8200', '💻', 'תגבור יחידה 8200 ומערך הסייבר', 'הרחבת כוח האדם המודיעיני והטכנולוגי. משפר התרעה ומקצר זמני תגובה.', 3, 3,
      { budget: { defense: 0.8 }, serviceBonus: { security: 2 }, groups: { youth: 1, highIncome: 1 } }),
    act('policy', 'def_reserve_relief', '🎖️', 'הקלת נטל המילואים', 'צמצום ימי המילואים באמצעות הגדלת הצבא הסדיר וגיוס מתגייסים חדשים.', 4, 3,
      { budget: { defense: 1.2 }, groups: { reservists: 7, families: 2, selfEmployed: 2 }, services: { security: -1 } }, { metric: { service: 'security', key: 'reserveDays', amount: -10 } }),
    act('policy', 'def_north_brigade', '🪖', 'הקמת חטיבת הגנה מרחבית בצפון', 'כוח קבע ומילואים מקומי לאבטחת יישובי קו העימות.', 3, 4,
      { budget: { defense: 0.9 }, services: { security: 2 }, groups: { periphery: 5, reservists: -1 } }),
    act('policy', 'def_haredi_brigade', '📘', 'הרחבת המסלולים לחרדים בצה״ל', 'חטיבת החשמונאים ומסלולים מותאמים לאורח חיים חרדי. מגדיל גיוס בלי כפייה.', 3, 3, {},
      { outcomes: [
        out(6, 'good', 'מאות צעירים חרדים התגייסו למסלולים החדשים. גם המילואימניקים מברכים.', { groups: { reservists: 3, secular: 2, haredim: -1 }, services: { security: 1 } }, 'שיא בגיוס חרדים למסלולים המותאמים'),
        out(4, 'neutral', 'ההנהגה החרדית קראה להחרים את המסלולים. הגיוס עלה מעט בלבד.', { groups: { haredim: -3, secular: 1 } }),
      ] }),
    act('budget', 'def_export', '🤝', 'עסקת יצוא ביטחוני', 'מכירת מערכות הגנה למדינה ידידותית. מכניס הכנסות ומחזק קשרים.', 3, 3, { revenue: 3 },
      { outcomes: [
        out(7, 'good', 'העסקה נחתמה. התעשיות הביטחוניות מגייסות עובדים.', { economy: { growth: 0.1, unemployment: -0.05 } }, 'עסקת יצוא ביטחוני בהיקף של מיליארדים'),
        out(3, 'bad', 'ארגוני זכויות אדם בחו״ל מבקרים את העסקה בשל המדינה הקונה.', { playerReputation: -3, groups: { left: -3 } }),
      ] }),
    act('policy', 'def_rehab', '🧠', 'רפורמה באגף השיקום', 'טיפול נפשי מיידי ללוחמים, קיצור ועדות ותמיכה במשפחות.', 3, 3,
      { budget: { defense: 0.7 }, groups: { reservists: 6, soldiers: 3, families: 2 } }),
    act('extreme', 'def_unilateral_strike', '🎯', 'תקיפה יזומה בלי אישור הקבינט', 'פעולה צבאית על דעת שר הביטחון בלבד. עלולה להצליח, ועלולה להצית הסלמה.', 10, 6, { oneOffCost: 0.5 },
      { rogue: true, outcomes: [
        out(5, 'good', 'התקיפה פגעה ביעד חשוב. הציבור מגבה, ראש הממשלה זועם על חוסר התיאום.', { groups: { right: 5 }, services: { security: 2 }, playerPopularity: 3 }, 'תקיפה מדויקת; מחלוקת על התיאום בקבינט'),
        out(5, 'bad', 'הצד השני הגיב בירי. העורף בכוננות, והאחריות עליך.', { groups: { periphery: -5, families: -3 }, playerPopularity: -4 }, 'הסלמה בעקבות תקיפה שלא תואמה', 'border'),
      ] }),
  ],

  // ===================== FINANCE =====================
  finance: [
    act('budget', 'fin_income_cut', '💸', 'הצעה: הורדת מס הכנסה ב-1%', 'הקלה למעמד הביניים. עולה כ-₪11 מיליארד בשנה בהכנסות. דורש אישור ראש הממשלה.', 5, 3, { taxes: { incomeTax: -1 } }),
    act('budget', 'fin_vat_cut', '🛒', 'הצעה: הורדת מע״מ ב-1%', 'הורדת יוקר המחיה לכל הציבור, בעיקר לשכבות החלשות. פוגע בהכנסות.', 5, 3, { taxes: { vat: -1 } }),
    act('budget', 'fin_corp_raise', '🏢', 'הצעה: העלאת מס חברות ב-1%', 'הגדלת ההכנסות על חשבון החברות הגדולות. ההייטק מזהיר מפגיעה בהשקעות.', 6, 3, { taxes: { corporateTax: 1 } }),
    act('policy', 'fin_purchase_tax', '🏠', 'העלאת מס רכישה על דירה שלישית', 'מקרר את שוק הדיור ומעודד מכירת דירות להשקעה.', 4, 3,
      { revenue: 1.5, serviceBonus: { housing: 2 }, groups: { youth: 3, highIncome: -3 } }),
    act('policy', 'fin_pension', '👵', 'הגדלת קצבאות הזקנה', 'תוספת לקצבת הזקנה ולהשלמת ההכנסה. מצמצם עוני בקרב קשישים.', 4, 3,
      { budget: { welfare: 1.5 }, groups: { elderly: 5, retirees: 5, lowIncome: 2 } }),
    act('policy', 'fin_coalition_cuts', '✂️', 'קיצוץ בכספים הקואליציוניים', 'הפניית כספים ייעודיים של השותפות לצמצום הגירעון. שותפי הקואליציה יתנגדו.', 6, 4,
      { revenue: 2, stability: -6, groups: { center: 3, secular: 2, haredim: -4, settlers: -2 }, playerReputation: 3 }),
    act('policy', 'fin_competition', '🧾', 'רפורמת יבוא: "מה שטוב לאירופה"', 'אימוץ תקני יבוא אירופיים להורדת מחירים ולהגברת התחרות.', 4, 4,
      { economy: { inflation: -0.3, growth: 0.1 }, groups: { families: 3, lowIncome: 2, periphery: -1 } }),
    act('policy', 'fin_bank_competition', '🏦', 'פתיחת המערכת הבנקאית לתחרות', 'רישוי בנקים דיגיטליים וחברות אשראי חדשות.', 3, 4,
      { economy: { growth: 0.1 }, groups: { middleClass: 2, selfEmployed: 2, youth: 1 } }),
    act('law', 'fin_arrangements', '📚', 'חוק ההסדרים: רפורמות מבניות', 'צירוף רפורמות לחוק התקציב. יעיל, אבל חברי הכנסטון מבקרים את העקיפה של הדיון.', 5, 4,
      { economy: { growth: 0.2 }, playerReputation: -2, stability: -2 }, { mutate: (_s, m) => { m.efficiency = Math.min(100, m.efficiency + 4); } }),
    act('extreme', 'fin_freeze', '🧊', 'הקפאת העברות תקציביות למשרדים', 'עצירה של כל העברה שלא אושרה. מקטין את הגירעון ומעורר עימות עם כל השרים.', 8, 6,
      { revenue: 3, stability: -8, groups: { publicSector: -4, center: 1 } }, { rogue: true }),
  ],

  // ===================== FOREIGN =====================
  foreign: [
    act('policy', 'for_normalization', '🕊️', 'קידום הסכם נורמליזציה', 'ערוצי שיחות עם מדינה ערבית נוספת להצטרפות להסכמי אברהם.', 5, 4, {},
      { outcomes: [
        out(3, 'good', 'הושגה התקדמות משמעותית: נפתחה נציגות ונחתם הסכם סחר ראשוני.', { economy: { growth: 0.3 }, groups: { center: 4, highIncome: 3, right: 1 }, playerPopularity: 5, playerReputation: 5 }, 'פריצת דרך: הסכם נורמליזציה נוסף'),
        out(4, 'neutral', 'השיחות נמשכות. הצד השני דורש התקדמות בסוגיה הפלסטינית.', { playerReputation: 1 }),
        out(3, 'bad', 'השיחות הודלפו ונעצרו בעקבות ביקורת בעולם הערבי.', { playerReputation: -2 }),
      ] }),
    act('policy', 'for_us_visit', '🤝', 'ביקור עבודה בוושינגטון', 'פגישות בקונגרס ובממשל לחיזוק הסיוע הביטחוני ותיאום מדיני.', 3, 2, { playerReputation: 3, groups: { center: 2, right: 1 } },
      { note: 'הביקור חיזק את התיאום עם הממשל האמריקאי.' }),
    act('policy', 'for_europe', '🌍', 'שיחות לשדרוג הסכם הסחר עם האיחוד האירופי', 'חיזוק הקשרים הכלכליים והמחקריים עם אירופה. האיחוד מציב תנאים מדיניים.', 4, 4,
      { economy: { growth: 0.15 }, groups: { highIncome: 2, students: 2, liberals: 2 } }),
    act('policy', 'for_un', '🏛️', 'מערכה דיפלומטית באו״ם', 'פעילות לבלימת החלטות נגד ישמעאל במוסדות הבינלאומיים.', 3, 2, {},
      { outcomes: [
        out(5, 'good', 'ההחלטה נבלמה בזכות תמיכת מדינות ידידותיות.', { playerReputation: 3, groups: { right: 2, center: 1 } }),
        out(5, 'bad', 'ההחלטה עברה ברוב גדול. הפגיעה בעיקר תדמיתית.', { playerReputation: -1 }),
      ] }),
    act('policy', 'for_hasbara', '📣', 'הגברת ההסברה הבינלאומית', 'מערך דוברים, תוכן דיגיטלי ומשלחות לקמפוסים בחו״ל.', 2, 2,
      { budget: { government: 0.3 }, groups: { right: 2, center: 1 } }),
    act('budget', 'for_embassies', '🏢', 'פתיחת שגרירויות באפריקה ובאסיה', 'הרחבת הנוכחות הדיפלומטית בשווקים מתפתחים.', 3, 4,
      { budget: { government: 0.2 }, economy: { growth: 0.05 }, playerReputation: 2 }),
    act('policy', 'for_aid', '🌍', 'משלחות סיוע הומניטרי לחו״ל', 'משלחות רפואה, מים וחקלאות במדינות מתפתחות. משפר את מעמד המדינה בעולם.', 2, 3,
      { oneOffCost: 0.1, playerReputation: 3, groups: { left: 2, liberals: 1 } }),
    act('extreme', 'for_recall', '📤', 'החזרת שגריר להתייעצויות', 'מחאה דיפלומטית חריפה נגד מדינה שפעלה נגד ישמעאל.', 4, 4,
      { groups: { right: 4, left: -2 }, economy: { growth: -0.05 }, playerPopularity: 2 }),
  ],

  // ===================== JUSTICE =====================
  justice: [
    act('law', 'jus_selection', '⚖️', 'קידום שינוי בוועדה לבחירת שופטים', 'שינוי הרכב הוועדה כך שלפוליטיקאים יהיה רוב. נתמך בימין; מעורר מחאה רחבה.', 8, 4,
      { groups: { right: 5, settlers: 3, left: -8, liberals: -8, center: -4 }, stability: -3 }, { crisis: 'cost_protest' }),
    act('law', 'jus_dialogue', '🤝', 'מתווה מוסכם לרפורמה המשפטית', 'שיחות עם האופוזיציה ועם נציגי מערכת המשפט על שינויים בהסכמה רחבה.', 6, 4, {},
      { outcomes: [
        out(4, 'good', 'הושג מתווה מוסכם. הציבור מברך על ההסכמה הרחבה.', { groups: { center: 5, liberals: 2, right: 1 }, stability: 4, playerReputation: 6 }, 'הסכמה רחבה על מתווה לרפורמה'),
        out(6, 'neutral', 'השיחות נכשלו. כל צד מאשים את האחר.', { playerReputation: 1 }),
      ] }),
    act('budget', 'jus_courts', '🏛️', 'תקנים נוספים לשופטים ולבתי המשפט', 'קיצור זמני ההמתנה להליכים משפטיים.', 3, 3,
      { budget: { government: 0.4 }, serviceBonus: { govServices: 2 }, groups: { center: 2, selfEmployed: 1 } }),
    act('policy', 'jus_legal_aid', '📄', 'הרחבת הסיוע המשפטי', 'ייצוג משפטי חינם לנפגעי עבירה ולשכבות חלשות.', 2, 3,
      { budget: { welfare: 0.3 }, groups: { lowIncome: 3, arabs: 1, left: 1 } }),
    act('appoint', 'jus_ag_split', '🪪', 'הצעה לפיצול תפקיד היועץ המשפטי לממשלה', 'הפרדה בין ייעוץ לממשלה לבין העמדה לדין. שנוי במחלוקת חריפה.', 6, 4,
      { groups: { right: 4, left: -6, liberals: -5 }, playerReputation: -2 }),
    act('policy', 'jus_cybercrime', '🛡️', 'חקיקה נגד פשיעה ברשת והונאות', 'הגנה על אזרחים מפני הונאות טלפון ואשראי.', 2, 3,
      { groups: { elderly: 3, retirees: 2, center: 1 }, playerReputation: 2 }),
    act('policy', 'jus_prisons', '🔒', 'רפורמה בענישה: עבודות שירות ושיקום', 'הקטנת הצפיפות בבתי הסוהר והגברת השיקום.', 3, 4,
      { budget: { police: -0.2 }, groups: { left: 2, liberals: 2, right: -2 } }),
  ],

  // ===================== NATIONAL SECURITY (police, prisons, fire) =====================
  national_security: [
    act('budget', 'ns_police_recruit', '🚓', 'גיוס 2,000 שוטרים', 'הגדלת הנוכחות המשטרתית ברחובות ובפריפריה.', 3, 3,
      { budget: { police: 1 }, services: { security: 2 }, groups: { periphery: 3, elderly: 2, right: 2 } }),
    act('policy', 'ns_arab_crime', '🕊️', 'מבצע נגד ארגוני הפשיעה בחברה הערבית', 'יחידה ייעודית, איסוף נשק לא חוקי ומאבק בגביית "דמי חסות".', 4, 3,
      { budget: { police: 0.8 }, groups: { arabs: 6, center: 1 } }, { outcomes: [
        out(6, 'good', 'מספר אירועי הירי ירד. ראשי הרשויות מברכים.', { services: { security: 1 } }, 'ירידה באירועי הירי ביישובים הערביים'),
        out(4, 'neutral', 'נתפסו מאות כלי נשק, אך הפשיעה ממשיכה ברמה גבוהה.', {}),
      ] }),
    act('policy', 'ns_firearms', '🔫', 'הקלה בקבלת רישיון לנשק אישי', 'יותר אזרחים חמושים. נתמך בימין; ארגוני נשים ושמאל מתנגדים.', 3, 3,
      { groups: { right: 5, settlers: 4, left: -5, liberals: -3 } }),
    act('policy', 'ns_firefighters', '🚒', 'תגבור הכבאות והצלה', 'רכבים, מטוסי כיבוי ולוחמי אש נוספים.', 2, 3,
      { budget: { police: 0.4 }, services: { security: 1 }, groups: { periphery: 2, families: 1 } }),
    act('policy', 'ns_protest_policy', '🪧', 'הנחיות חדשות לטיפול בהפגנות', 'מדיניות אכיפה תקיפה יותר נגד חסימת כבישים.', 3, 3,
      { groups: { right: 4, left: -6, liberals: -4 }, stability: 1 }),
    act('policy', 'ns_civil_guard', '🦺', 'הרחבת המשמר האזרחי וכיתות הכוננות', 'מתנדבים מאומנים ביישובים לחיזוק תחושת הביטחון.', 2, 3,
      { budget: { police: 0.3 }, groups: { periphery: 3, settlers: 2 } }),
    act('extreme', 'ns_temple_mount', '🕌', 'שינוי הסדרי הביקור בהר הבית', 'צעד חד-צדדי ללא תיאום. עלול להצית מתיחות ביטחונית ומדינית חריפה.', 8, 6,
      { groups: { right: 5, settlers: 5, arabs: -10, center: -4, left: -6 }, stability: -6, playerReputation: -4 }, { rogue: true, crisis: 'border' }),
  ],

  // ===================== INTERIOR =====================
  interior: [
    act('policy', 'int_digital', '💻', 'שירותי משרד הפנים באינטרנט', 'תעודות, דרכונים ושינויי כתובת בלי לחכות בתור.', 2, 3,
      { budget: { government: 0.3 }, serviceBonus: { govServices: 4 }, groups: { youth: 2, selfEmployed: 2 } }, { metric: { service: 'govServices', key: 'bureaucracyDays', amount: -5 } }),
    act('budget', 'int_local_grants', '🏘️', 'מענקי איזון לרשויות חלשות', 'סיוע לרשויות המקומיות בפריפריה ובחברה הערבית.', 3, 3,
      { budget: { government: 0.6 }, groups: { periphery: 4, arabs: 3 }, regionInvestment: { north: 3, negev: 3 } }),
    act('policy', 'int_planning', '🗺️', 'קיצור הליכי תכנון ובנייה', 'ועדות מקומיות מקבלות סמכויות לאשר היתרי בנייה מהר יותר.', 3, 4,
      { serviceBonus: { housing: 3 }, groups: { youth: 2, selfEmployed: 2, left: -1 } }),
    act('policy', 'int_negev_villages', '⛺', 'הסדרת הכפרים הבדואים בנגב', 'תכנון, תשתיות והכרה ביישובים קיימים, לצד אכיפה בבנייה חדשה.', 5, 4,
      { budget: { infrastructure: 0.6 }, groups: { arabs: 5, periphery: 1, right: -3 } }),
    act('policy', 'int_merge_councils', '🧩', 'איחוד רשויות מקומיות קטנות', 'חיסכון בהוצאות מנהלה ושיפור השירות. ראשי הרשויות מתנגדים.', 4, 4,
      { budget: { government: -0.3 }, groups: { periphery: -2, center: 1 }, playerReputation: 2 }),
    act('law', 'int_citizenship', '🛂', 'החמרת חוק האזרחות ואיחוד המשפחות', 'הגבלת איחוד משפחות מטעמי ביטחון ודמוגרפיה.', 4, 4,
      { groups: { right: 4, arabs: -7, left: -4, liberals: -3 } }),
  ],

  // ===================== HEALTH =====================
  health: [
    act('budget', 'hea_doctors', '🩺', 'מענקים לרופאים ואחיות בפריפריה', 'תמריצים לעבודה בבתי החולים בצפון ובדרום.', 3, 3,
      { budget: { health: 0.8 }, serviceBonus: { health: 2 }, groups: { periphery: 4, elderly: 1 } }, { metric: { service: 'health', key: 'doctorShortage', amount: -150 } }),
    act('budget', 'hea_beds', '🛏️', 'פתיחת 500 מיטות אשפוז', 'הורדת הצפיפות בבתי החולים ובמחלקות הפנימיות.', 3, 3,
      { budget: { health: 1.2 }, services: { health: 3 }, groups: { elderly: 3, retirees: 2, families: 1 } }, { metric: { service: 'health', key: 'beds', amount: 500 } }),
    act('policy', 'hea_mental', '🧠', 'תוכנית לאומית לבריאות הנפש', 'מרכזי חוסן, טיפול לנפגעי טראומה וקיצור תורים לפסיכולוגים.', 3, 3,
      { budget: { health: 0.7 }, groups: { reservists: 4, youth: 3, families: 2, periphery: 2 } }),
    act('policy', 'hea_wait_times', '⏱️', 'יעדי זמני המתנה לרופאים מומחים', 'חיוב קופות החולים לעמוד בזמני המתנה מקסימליים.', 3, 3,
      { budget: { health: 0.5 }, serviceBonus: { health: 2 }, groups: { middleClass: 2, elderly: 2 } }),
    act('policy', 'hea_prevention', '🍎', 'תוכנית רפואה מונעת', 'בדיקות סקר, חיסונים והסברה. חוסך בטווח הארוך.', 2, 3,
      { budget: { health: 0.3 }, serviceBonus: { health: 1 }, groups: { families: 1 } }),
    act('policy', 'hea_private_cap', '🏥', 'הגבלת הרפואה הפרטית בבתי חולים ציבוריים', 'מחזק את הרפואה הציבורית; רופאים בכירים מתנגדים.', 4, 4,
      { serviceBonus: { health: 2 }, groups: { lowIncome: 3, socialists: 3, highIncome: -2 } }),
    act('extreme', 'hea_strike_orders', '📋', 'צווי ריתוק לרופאים המתמחים', 'חיוב רופאים לחזור לעבודה במהלך שביתה.', 6, 6,
      { groups: { publicSector: -5, elderly: 2 }, services: { health: 2 } }, { outcomes: [
        out(6, 'good', 'הרופאים חזרו לעבודה. המשא ומתן נמשך.', {}),
        out(4, 'bad', 'מאות מתמחים הגישו התפטרות. מחלקות קורסות.', { services: { health: -4 } }, 'גל התפטרויות של רופאים מתמחים', 'er_collapse'),
      ] }),
  ],

  // ===================== EDUCATION =====================
  education: [
    act('budget', 'edu_teachers', '👩‍🏫', 'העלאת שכר המורים המתחילים', 'משיכת מורים איכותיים ומניעת נשירה מהמקצוע.', 4, 3,
      { budget: { education: 1.5 }, serviceBonus: { education: 3 }, groups: { publicSector: 3, families: 2 } }, { metric: { service: 'education', key: 'teacherShortage', amount: -600 } }),
    act('budget', 'edu_class_size', '🏫', 'הקטנת הצפיפות בכיתות', 'בניית כיתות וגיוס מורים לצמצום מספר התלמידים בכיתה.', 4, 3,
      { budget: { education: 1.2 }, serviceBonus: { education: 2 }, groups: { families: 3 } }, { metric: { service: 'education', key: 'classSize', amount: -1 } }),
    act('law', 'edu_core', '📐', 'חיוב לימודי ליבה בכל בתי הספר', 'מתמטיקה ואנגלית גם במוסדות החרדיים כתנאי לתקצוב.', 6, 4,
      { groups: { secular: 4, liberals: 3, center: 2, haredim: -8 }, economy: { growth: 0.05 }, stability: -3 }),
    act('policy', 'edu_tech', '💡', 'תוכנית טכנולוגית בפריפריה', 'מגמות מחשבים והנדסה בבתי ספר בצפון ובדרום.', 3, 3,
      { budget: { education: 0.6 }, groups: { periphery: 3, youth: 2 }, economy: { growth: 0.05 } }),
    act('policy', 'edu_arab_gap', '📘', 'צמצום פערים בחינוך הערבי', 'תוספת שעות ומורים לבתי הספר בחברה הערבית.', 3, 3,
      { budget: { education: 0.6 }, groups: { arabs: 5, left: 1 } }),
    act('policy', 'edu_values', '🇮🇱', 'תוכנית לימודים בזהות ומורשת', 'הרחבת לימודי מורשת ישראל ואזרחות.', 3, 4,
      { groups: { religious: 3, right: 3, secular: -2, liberals: -2 } }),
    act('policy', 'edu_daycare', '🧸', 'סבסוד מעונות יום', 'הורדת עלות המעונות להורים עובדים.', 3, 3,
      { budget: { education: 1 }, groups: { families: 5, youth: 2, employees: 1 }, economy: { growth: 0.05 } }),
    act('policy', 'edu_higher', '🎓', 'הרחבת מלגות להשכלה גבוהה', 'מלגות לסטודנטים מהפריפריה ולמשרתי מילואים.', 2, 3,
      { budget: { education: 0.5 }, groups: { students: 4, reservists: 2, periphery: 1 } }),
  ],

  // ===================== TRANSPORT =====================
  transport: [
    act('budget', 'tra_buses', '🚌', 'תגבור התחבורה הציבורית', 'קווים חדשים, תדירות גבוהה יותר ונתיבי תחבורה ציבורית.', 3, 3,
      { budget: { transport: 0.8 }, serviceBonus: { transport: 2 }, groups: { students: 3, youth: 2, lowIncome: 2 } }),
    act('policy', 'tra_shabbat', '🚍', 'תחבורה ציבורית בשבת בערים שמבקשות', 'הסדר מקומי לפי בקשת הרשויות. החילונים בעד, המפלגות הדתיות נגד.', 5, 4,
      { groups: { secular: 6, youth: 3, liberals: 3, haredim: -7, religious: -4 }, stability: -4 }),
    act('policy', 'tra_congestion', '🚗', 'אגרת גודש בכניסה לגוש דן', 'תשלום על כניסה למרכז בשעות העומס, וההכנסות לתחבורה הציבורית.', 5, 4,
      { revenue: 1, serviceBonus: { transport: 2 }, groups: { center: -3, employees: -2, left: 2 } }),
    act('policy', 'tra_safety', '🚦', 'תוכנית לאומית לבטיחות בדרכים', 'מצלמות אכיפה, הפרדות בכבישים ותיקון "כבישי דמים".', 2, 3,
      { budget: { transport: 0.4 }, groups: { families: 2, periphery: 2 } }),
    act('policy', 'tra_electric', '🔌', 'מעבר לאוטובוסים חשמליים', 'הפחתת זיהום אוויר בערים.', 3, 4,
      { budget: { transport: 0.5, energy: 0.2 }, groups: { left: 2, center: 1, youth: 1 } }),
    act('policy', 'tra_reform_taxis', '🚕', 'פתיחת שוק המוניות לתחרות', 'אפליקציות שיתוף נסיעות לצד המוניות.', 3, 4,
      { economy: { inflation: -0.05 }, groups: { youth: 3, center: 2, selfEmployed: -2 } }),
    act('extreme', 'tra_rail_night', '🌙', 'רכבת לילה ובסופי שבוע באישור עצמאי', 'הפעלת רכבות בלילה ובשבת בלי אישור הממשלה.', 7, 6,
      { groups: { secular: 6, youth: 4, haredim: -8 }, stability: -6 }, { rogue: true }),
  ],

  // ===================== ECONOMY & INDUSTRY =====================
  economy: [
    act('policy', 'eco_sme_loans', '🏪', 'הלוואות בערבות מדינה לעסקים קטנים', 'סיוע לעסקים קטנים ובינוניים, כולל עסקים של משרתי מילואים.', 3, 3,
      { oneOffCost: 1, groups: { selfEmployed: 5, reservists: 2 }, economy: { growth: 0.1 } }),
    act('policy', 'eco_industry_zones', '🏭', 'אזורי תעשייה חדשים בפריפריה', 'הטבות מס למפעלים שעוברים לנגב ולגליל.', 3, 4,
      { revenue: -0.5, groups: { periphery: 4, employees: 2 }, economy: { unemployment: -0.1 }, regionInvestment: { negev: 4, north: 4 } }),
    act('policy', 'eco_cost_of_living', '🛒', 'מאבק במחירי המזון', 'פיקוח על מוצרי יסוד ופתיחת השוק לרשתות בינלאומיות.', 4, 3,
      { economy: { inflation: -0.2 }, groups: { families: 3, lowIncome: 3, highIncome: -1 } }),
    act('policy', 'eco_women_work', '👩‍💼', 'שילוב נשים חרדיות וערביות בתעסוקה', 'הכשרות מקצועיות ומעונות יום ליד מקומות העבודה.', 3, 3,
      { budget: { welfare: 0.3 }, groups: { arabs: 3, haredim: 1, families: 2 }, economy: { growth: 0.1, unemployment: -0.1 } }),
    act('policy', 'eco_foreign_workers', '👷', 'הגדלת מכסת העובדים הזרים בבנייה', 'מענה למחסור בעובדים באתרי הבנייה.', 3, 3,
      { serviceBonus: { housing: 2 }, groups: { selfEmployed: 2, employees: -1, socialists: -2 } }),
    act('policy', 'eco_export', '📦', 'עידוד יצוא לשווקים חדשים', 'נספחים מסחריים ומימון השתתפות בתערוכות.', 2, 3,
      { economy: { growth: 0.1 }, groups: { highIncome: 2, employees: 1 } }),
  ],

  // ===================== HOUSING =====================
  housing: [
    act('policy', 'hou_discount', '🏷️', 'הגרלות "דירה בהנחה"', 'דירות במחיר מופחת לזוגות צעירים ולחסרי דיור.', 3, 3,
      { budget: { housing: 1 }, serviceBonus: { housing: 3 }, groups: { youth: 5, families: 3 } }, { metric: { service: 'housing', key: 'units', amount: 5000 } }),
    act('policy', 'hou_public', '🏢', 'הרחבת הדיור הציבורי', 'בניית דירות ציבוריות לזכאים ולמשפחות במצוקה.', 4, 4,
      { budget: { housing: 1.2 }, groups: { lowIncome: 5, socialists: 3, elderly: 2 } }),
    act('policy', 'hou_long_rent', '🔑', 'דירה להשכרה ארוכת טווח', 'חוזים ל-10 שנים במחירים מפוקחים בפרויקטים ממשלתיים.', 3, 3,
      { budget: { housing: 0.6 }, groups: { youth: 4, students: 2, middleClass: 2 } }),
    act('policy', 'hou_urban_renewal', '🏗️', 'האצת התחדשות עירונית', 'תמ״א 38 ופינוי-בינוי במסלול מהיר.', 3, 3,
      { serviceBonus: { housing: 2 }, groups: { center: 3, elderly: 1, selfEmployed: 2 } }),
    act('policy', 'hou_haredi_city', '🏙️', 'תכנון עיר חדשה לציבור החרדי', 'מענה למצוקת הדיור בציבור החרדי.', 4, 4,
      { budget: { housing: 0.8 }, groups: { haredim: 6, secular: -1 } }),
    act('policy', 'hou_arab_housing', '🏘️', 'תוכניות בנייה ביישובים הערביים', 'הפשרת קרקעות ותכנון שכונות חדשות.', 3, 4,
      { budget: { housing: 0.5 }, groups: { arabs: 5, right: -1 } }),
    act('extreme', 'hou_land_release', '🌾', 'שחרור קרקעות חקלאיות למגורים', 'הגדלת היצע הקרקעות בצורה מהירה. החקלאים והירוקים מתנגדים.', 6, 6,
      { serviceBonus: { housing: 5 }, groups: { youth: 4, periphery: -3, left: -3 } }),
  ],

  // ===================== ENERGY & INFRASTRUCTURE =====================
  energy: [
    act('policy', 'ene_solar_roofs', '☀️', 'סולארי על הגגות', 'הקלות רגולטוריות ותמריצים להתקנת פאנלים סולאריים.', 3, 3,
      { budget: { energy: 0.4 }, serviceBonus: { energy: 2 }, groups: { left: 2, periphery: 2 } }, { metric: { service: 'energy', key: 'renewables', amount: 2 } }),
    act('policy', 'ene_gas_export', '🛢️', 'הגדלת יצוא הגז', 'הכנסות גבוהות למדינה; ארגוני סביבה מזהירים מפגיעה במשק המקומי.', 4, 4,
      { revenue: 3, groups: { highIncome: 2, left: -3 }, economy: { growth: 0.15 } }),
    act('budget', 'ene_grid', '⚡', 'שדרוג רשת החשמל', 'הקטנת הסיכון להפסקות חשמל בקיץ.', 3, 3,
      { budget: { energy: 0.8 }, serviceBonus: { energy: 3 } }, { metric: { service: 'energy', key: 'blackoutRisk', amount: -6 } }),
    act('policy', 'ene_reform', '🔌', 'רפורמה בחברת החשמל', 'פתיחת ייצור החשמל לתחרות. ועד העובדים מתנגד.', 5, 4,
      { economy: { inflation: -0.1, growth: 0.1 }, groups: { publicSector: -4, families: 2 } }),
    act('budget', 'ene_water', '💧', 'מתקן התפלה חדש והחלפת צנרת', 'שיפור אספקת המים בפריפריה.', 3, 4,
      { budget: { infrastructure: 0.7 }, serviceBonus: { infrastructure: 3 }, groups: { periphery: 3 } }),
    act('policy', 'ene_roads', '🛣️', 'תיקון כבישים ותשתיות בפריפריה', 'שיפור תשתיות הכבישים והניקוז.', 2, 3,
      { budget: { infrastructure: 0.6 }, serviceBonus: { infrastructure: 2, transport: 1 }, groups: { periphery: 2 } }),
  ],

  // ===================== WELFARE =====================
  welfare: [
    act('budget', 'wel_social_workers', '🤝', 'העלאת שכר העובדים הסוציאליים', 'מניעת עזיבה של עובדים סוציאליים ושיפור הטיפול במשפחות.', 3, 3,
      { budget: { welfare: 0.6 }, serviceBonus: { welfare: 3 }, groups: { publicSector: 3, lowIncome: 2 } }),
    act('policy', 'wel_food_security', '🍲', 'תוכנית לאומית לביטחון תזונתי', 'כרטיסי מזון למשפחות במצוקה.', 3, 3,
      { budget: { welfare: 0.8 }, groups: { lowIncome: 5, families: 2 } }, { metric: { service: 'welfare', key: 'poverty', amount: -0.5 } }),
    act('policy', 'wel_disability', '♿', 'הגדלת קצבאות הנכות', 'העלאת הקצבה לנכים והתאמתה ליוקר המחיה.', 3, 3,
      { budget: { welfare: 1 }, groups: { lowIncome: 3, families: 2, socialists: 2 } }),
    act('policy', 'wel_at_risk_youth', '🧒', 'תוכנית לבני נוער בסיכון', 'מועדוניות, מנטורים ומניעת נשירה.', 2, 3,
      { budget: { welfare: 0.4 }, groups: { youth: 2, families: 2, periphery: 1 } }),
    act('policy', 'wel_elderly', '👴', 'מערך סיעוד לקשישים בבית', 'הרחבת שעות הסיעוד ומניעת בדידות.', 3, 3,
      { budget: { welfare: 0.7 }, groups: { elderly: 5, retirees: 3 } }),
    act('policy', 'wel_negative_tax', '💳', 'הרחבת מס הכנסה שלילי', 'השלמת הכנסה לעובדים בשכר נמוך.', 3, 3,
      { revenue: -0.8, groups: { lowIncome: 4, employees: 2 }, economy: { unemployment: -0.05 } }),
  ],

  // ===================== SMALLER PORTFOLIOS =====================
  environment: [
    act('law', 'env_climate', '🌍', 'חוק אקלים ויעדי הפחתת פליטות', 'יעדים מחייבים להפחתת פליטות עד 2050.', 4, 4, { groups: { left: 4, youth: 3, liberals: 2, selfEmployed: -2 } }),
    act('policy', 'env_plastic', '🛍️', 'מס על כלים חד-פעמיים', 'הפחתת זיהום הפלסטיק. משפחות חרדיות נפגעות במיוחד.', 3, 4, { revenue: 0.3, groups: { left: 3, haredim: -4 } }),
    act('policy', 'env_haifa', '🏭', 'צמצום זיהום האוויר במפרץ חיפה', 'תוכנית לפינוי מפעלים מזהמים.', 3, 4, { budget: { energy: 0.3 }, groups: { periphery: 2, families: 2 }, regionInvestment: { haifa: 5 } }),
    act('policy', 'env_nature', '🌳', 'הכרזה על שמורות טבע חדשות', 'הגנה על שטחים פתוחים מפני בנייה.', 2, 4, { groups: { left: 2, youth: 1 }, serviceBonus: { housing: -1 } }),
    act('policy', 'env_recycling', '♻️', 'מהפכת מחזור ופסולת', 'הקמת מתקני מחזור והפחתת הטמנה.', 2, 3, { budget: { infrastructure: 0.3 }, groups: { left: 2, center: 1 } }),
  ],
  agriculture: [
    act('budget', 'agr_water_quota', '💧', 'הגדלת מכסות המים לחקלאים', 'תמיכה בחקלאות בפריפריה.', 3, 3, { budget: { agriculture: 0.4 }, groups: { periphery: 3, settlers: 1 } }),
    act('policy', 'agr_import', '🍅', 'פתיחת יבוא תוצרת חקלאית', 'הורדת מחירי ירקות ופירות; החקלאים מוחים.', 4, 4, { economy: { inflation: -0.15 }, groups: { families: 3, lowIncome: 2, periphery: -4 } }),
    act('policy', 'agr_security', '🌾', 'ביטחון מזון לשעת חירום', 'מאגרי מזון ומלאי אסטרטגי.', 2, 3, { budget: { agriculture: 0.3 }, services: { security: 1 }, groups: { periphery: 1 } }),
    act('policy', 'agr_workers', '👨‍🌾', 'עובדים זרים לחקלאות', 'מענה למחסור בידיים עובדות במשקים.', 2, 3, { groups: { periphery: 3, socialists: -1 } }),
    act('policy', 'agr_agritech', '🔬', 'עידוד אגרוטק וחקלאות מדייקת', 'מענקים לסטארטאפים בחקלאות.', 2, 3, { budget: { agriculture: 0.3, science: 0.2 }, economy: { growth: 0.05 }, groups: { periphery: 1, youth: 1 } }),
  ],
  communications: [
    act('law', 'com_reform', '📡', 'רפורמה בשוק התקשורת', 'שינוי הרגולציה על ערוצי הטלוויזיה והמדיה. האופוזיציה מזהירה מפגיעה בחופש העיתונות.', 6, 4, { groups: { right: 3, left: -5, liberals: -4 }, playerReputation: -2 }),
    act('policy', 'com_fiber', '🌐', 'סיבים אופטיים בכל יישוב', 'אינטרנט מהיר גם בפריפריה.', 3, 3, { budget: { infrastructure: 0.4 }, groups: { periphery: 3, youth: 2, selfEmployed: 1 }, economy: { growth: 0.05 } }),
    act('policy', 'com_broadcast', '📻', 'שינויים בתאגיד השידור הציבורי', 'קיצוץ או שינוי מבני בשידור הציבורי.', 6, 6, { budget: { culture: -0.3 }, groups: { right: 3, left: -5, liberals: -4 } }),
    act('policy', 'com_postal', '✉️', 'הפרטה חלקית של דואר ישמעאל', 'שיפור השירות; העובדים מתנגדים.', 3, 4, { groups: { publicSector: -3, selfEmployed: 2 }, serviceBonus: { govServices: 1 } }),
    act('policy', 'com_cellular', '📱', 'הורדת מחירי הסלולר והאינטרנט', 'עידוד תחרות בין החברות.', 2, 3, { economy: { inflation: -0.05 }, groups: { youth: 2, families: 2 } }),
  ],
  culture: [
    act('budget', 'cul_periphery', '🎭', 'תרבות בפריפריה', 'מימון מופעים ומרכזי תרבות בעיירות הפיתוח.', 2, 3, { budget: { culture: 0.3 }, groups: { periphery: 3 } }),
    act('policy', 'cul_loyalty', '🎬', 'תנאי "נאמנות בתרבות" לתמיכה במוסדות', 'הגבלת תקציב ליצירות שנתפסות כפוגעות במדינה.', 4, 4, { groups: { right: 4, left: -6, liberals: -5 } }),
    act('budget', 'cul_sport', '⚽', 'השקעה בספורט עממי', 'מתקני ספורט שכונתיים ולימודי שחייה.', 2, 3, { budget: { culture: 0.4 }, groups: { youth: 2, families: 2, periphery: 1 } }),
    act('budget', 'cul_olympics', '🏅', 'מסלול מצוינות אולימפי', 'תמיכה בספורטאים לקראת המשחקים.', 2, 4, { budget: { culture: 0.2 }, playerPopularity: 2 }),
    act('policy', 'cul_film', '🎥', 'תמריצי מס להפקות קולנוע', 'משיכת הפקות בינלאומיות.', 2, 4, { revenue: -0.1, economy: { growth: 0.03 }, groups: { secular: 1, liberals: 1 } }),
  ],
  tourism: [
    act('media', 'tou_campaign', '✈️', 'קמפיין תיירות בינלאומי', 'החזרת התיירות הנכנסת אחרי שנות המלחמה.', 2, 3, { budget: { government: 0.3 }, economy: { growth: 0.08 }, groups: { selfEmployed: 3 }, regionInvestment: { eilat: 3, jerusalem: 3 } }),
    act('policy', 'tou_hotels', '🏨', 'הקלות להקמת מלונות', 'הגדלת מספר החדרים והורדת המחירים.', 2, 3, { economy: { growth: 0.05 }, groups: { selfEmployed: 2, periphery: 1 } }),
    act('policy', 'tou_eilat', '🏖️', 'חבילת סיוע לאילת', 'הנחות טיסה ותמריצים לתיירות פנים.', 2, 3, { budget: { government: 0.2 }, regionInvestment: { eilat: 6 }, groups: { periphery: 2 } }),
    act('policy', 'tou_north', '⛰️', 'שיקום התיירות בגליל', 'מענקים לצימרים ולאטרקציות שנפגעו מהלחימה.', 2, 3, { budget: { government: 0.3 }, regionInvestment: { north: 6 }, groups: { periphery: 3, selfEmployed: 2 } }),
    act('policy', 'tou_pilgrims', '⛪', 'עידוד תיירות צליינים', 'שיתוף פעולה עם כנסיות ומארגני סיורים.', 1, 3, { economy: { growth: 0.03 }, regionInvestment: { jerusalem: 3 } }),
  ],
  labor: [
    act('policy', 'lab_training', '🛠️', 'הכשרות מקצועיות למקצועות מבוקשים', 'הסבת עובדים להייטק, בנייה וסיעוד.', 2, 3, { budget: { welfare: 0.3 }, economy: { unemployment: -0.15 }, groups: { employees: 2, lowIncome: 2 } }),
    act('policy', 'lab_haredi_men', '📚', 'שילוב גברים חרדים בתעסוקה', 'מסלולי לימוד ועבודה מותאמים.', 3, 3, { groups: { haredim: 1, secular: 2 }, economy: { growth: 0.05 } }),
    act('policy', 'lab_reservist_protect', '🛡️', 'הגנה על משרתי מילואים מפיטורים', 'הרחבת החוק והאכיפה נגד מעסיקים.', 2, 3, { groups: { reservists: 4, selfEmployed: -1 } }),
    act('policy', 'lab_enforcement', '⚖️', 'אכיפת זכויות עובדים', 'מפקחים נוספים נגד הלנת שכר וניצול.', 2, 3, { budget: { government: 0.1 }, groups: { employees: 2, lowIncome: 2, socialists: 2 } }),
  ],
  religious: [
    act('budget', 'rel_councils', '🕍', 'תקציב למועצות הדתיות', 'שיפור שירותי הדת ביישובים.', 2, 3, { budget: { government: 0.3 }, groups: { religious: 3, haredim: 2, secular: -1 } }),
    act('policy', 'rel_kashrut', '🍽️', 'רפורמה בכשרות', 'פתיחת הכשרות לתחרות בפיקוח הרבנות.', 4, 4, { groups: { secular: 2, liberals: 2, haredim: -4 }, economy: { inflation: -0.03 } }),
    act('policy', 'rel_mikvaot', '💧', 'שיפוץ מקוואות ובתי כנסת', 'שדרוג מבני דת בפריפריה.', 1, 3, { budget: { government: 0.2 }, groups: { religious: 2, periphery: 1 } }),
    act('policy', 'rel_conversion', '📜', 'רפורמה בגיור', 'הקלה על גיור עולים מברית המועצות לשעבר.', 4, 4, { groups: { olim: 4, liberals: 2, haredim: -4 } }),
  ],
  jerusalem: [
    act('budget', 'jer_east', '🏙️', 'תוכנית לצמצום פערים במזרח ירושלים', 'תשתיות, חינוך ותעסוקה.', 3, 4, { budget: { government: 0.4 }, groups: { arabs: 3, left: 2, right: -1 }, regionInvestment: { jerusalem: 4 } }),
    act('policy', 'jer_hightech', '💼', 'עידוד הייטק בירושלים', 'הטבות לחברות שעוברות לבירה.', 2, 3, { economy: { growth: 0.05 }, regionInvestment: { jerusalem: 4 }, groups: { youth: 1 } }),
    act('policy', 'jer_old_city', '🏛️', 'שימור העיר העתיקה', 'שיקום מבנים ותיירות.', 2, 4, { budget: { culture: 0.2 }, regionInvestment: { jerusalem: 3 }, groups: { religious: 1 } }),
    act('policy', 'jer_housing', '🏢', 'דיור לצעירים בירושלים', 'עצירת ההגירה השלילית מהעיר.', 3, 3, { budget: { housing: 0.4 }, groups: { youth: 2, haredim: 1 }, regionInvestment: { jerusalem: 3 } }),
  ],
  heritage: [
    act('policy', 'her_sites', '🏺', 'פיתוח אתרי מורשת', 'שיקום אתרים ארכיאולוגיים ותיירות מורשת.', 2, 3, { budget: { culture: 0.2 }, groups: { religious: 2, right: 1 } }),
    act('policy', 'her_oct7', '🕯️', 'הנצחת אירועי 7 באוקטובר', 'אתרי זיכרון ותיעוד עדויות.', 2, 4, { budget: { culture: 0.2 }, groups: { reservists: 2, families: 2, periphery: 2 } }),
    act('policy', 'her_js_sites', '⛰️', 'פיתוח אתרי מורשת ביהודה ושומרון', 'השקעה באתרים היסטוריים בשטח C.', 3, 4, { groups: { settlers: 4, right: 2, left: -3 } }),
    act('policy', 'her_schools', '📖', 'סיורי מורשת לבתי הספר', 'כל תלמיד יבקר באתרי מורשת מרכזיים.', 2, 3, { budget: { education: 0.2 }, groups: { religious: 1, families: 1 } }),
  ],
  negev_galilee: [
    act('budget', 'ng_envelope', '🧱', 'תנופה לעוטף עזה', 'מענקים לתושבים חוזרים ופיתוח היישובים.', 3, 3, { budget: { infrastructure: 0.8 }, groups: { periphery: 5, families: 2 }, regionInvestment: { negev: 6 } }),
    act('budget', 'ng_north_rebuild', '🏡', 'שיקום יישובי הצפון', 'שיקום בתים, עסקים ומבני ציבור שנפגעו.', 3, 3, { budget: { infrastructure: 0.8 }, groups: { periphery: 5, selfEmployed: 2 }, regionInvestment: { north: 6 } }),
    act('policy', 'ng_young_settlers', '🌱', 'עידוד צעירים לעבור לנגב ולגליל', 'מענקי מעבר והנחות בדיור.', 2, 3, { budget: { housing: 0.3 }, groups: { youth: 2, periphery: 3 }, regionInvestment: { negev: 3, north: 3 } }),
    act('policy', 'ng_resilience', '💪', 'מרכזי חוסן קהילתיים', 'ליווי נפשי לתושבי קו העימות.', 2, 3, { budget: { health: 0.2 }, groups: { periphery: 3, families: 2 } }),
  ],
  aliyah: [
    act('policy', 'ali_france', '✈️', 'קמפיין עלייה מצרפת ומארה״ב', 'מענקי קליטה ומסלולי תעסוקה לעולים.', 2, 3, { budget: { welfare: 0.3 }, groups: { olim: 3, right: 1 }, economy: { growth: 0.03 } }),
    act('policy', 'ali_licenses', '🩺', 'הכרה מהירה ברישיונות מקצועיים', 'רופאים, מהנדסים ואחיות עולים יעבדו מהר יותר במקצועם.', 2, 3, { groups: { olim: 4 }, serviceBonus: { health: 1 } }),
    act('policy', 'ali_housing', '🏠', 'דיור לעולים בפריפריה', 'מרכזי קליטה ודירות מסובסדות.', 2, 3, { budget: { housing: 0.2 }, groups: { olim: 3, periphery: 1 } }),
    act('policy', 'ali_ethiopia', '🧳', 'העלאת בני הקהילה האתיופית הממתינים', 'השלמת עליית הממתינים לאיחוד משפחות.', 3, 4, { budget: { welfare: 0.3 }, groups: { olim: 3, religious: 1, liberals: 1 } }),
  ],
  science: [
    act('policy', 'sci_brain_gain', '🧠', 'החזרת מדענים מחו״ל', 'מענקי קליטה למדענים ולחוקרים שחוזרים.', 3, 3, { budget: { science: 0.5 }, economy: { growth: 0.1 }, groups: { students: 2, highIncome: 1 } }),
    act('policy', 'sci_ai', '🤖', 'תוכנית לאומית לבינה מלאכותית', 'מחשוב-על, מחקר והכשרת כוח אדם.', 3, 3, { budget: { science: 0.8 }, economy: { growth: 0.15 }, groups: { youth: 2, highIncome: 1 } }),
    act('policy', 'sci_space', '🛰️', 'תוכנית חלל אזרחית', 'לוויינים למחקר ולתקשורת.', 2, 4, { budget: { science: 0.4 }, playerReputation: 2 }),
    act('policy', 'sci_innovation_periphery', '💡', 'מרכזי חדשנות בפריפריה', 'חממות טכנולוגיות בבאר שבע ובקריית שמונה.', 2, 3, { budget: { science: 0.3 }, groups: { periphery: 2, youth: 2 }, regionInvestment: { negev: 2, north: 2 } }),
  ],
  regional: [
    act('policy', 'reg_water', '💧', 'שיתוף פעולה אזורי במים ובאנרגיה', 'פרויקטים משותפים עם ירדן ומצרים.', 3, 4, { economy: { growth: 0.05 }, groups: { left: 2, center: 1 }, playerReputation: 2 }),
    act('policy', 'reg_trade', '🚢', 'מסדרון סחר אזורי', 'קידום מסדרון הסחר מהודו לאירופה דרך ישמעאל.', 3, 4, { economy: { growth: 0.1 }, groups: { highIncome: 2, center: 1 } }),
    act('policy', 'reg_gulf', '🤝', 'משלחת עסקית למפרץ', 'הרחבת הקשרים עם מדינות הסכמי אברהם.', 2, 3, { economy: { growth: 0.05 }, groups: { highIncome: 1, center: 1 } }),
  ],
  settlement: [
    act('budget', 'set_infrastructure', '🏡', 'תשתיות להתיישבות ביהודה ושומרון', 'כבישים, מים וחשמל ליישובים.', 3, 3, { budget: { housing: 0.5 }, groups: { settlers: 5, right: 2, left: -4 }, regionInvestment: { judea_samaria: 6 } }),
    act('policy', 'set_outposts', '⛺', 'הסדרת מאחזים', 'הכשרת מאחזים קיימים כשכונות של יישובים. מעורר ביקורת בינלאומית.', 5, 4, { groups: { settlers: 6, right: 3, left: -6, liberals: -3 }, playerReputation: -3 }),
    act('policy', 'set_new_towns', '🏘️', 'הקמת יישובים חדשים בגליל ובנגב', 'התיישבות במחוזות הפריפריה בתוך הקו הירוק.', 3, 4, { budget: { housing: 0.4 }, groups: { periphery: 3, settlers: 1, right: 1 }, regionInvestment: { negev: 3, north: 3 } }),
    act('policy', 'set_national_tasks', '🎯', 'גרעינים תורניים ומשימות לאומיות', 'מימון קהילות משימתיות בערים מעורבות.', 2, 3, { budget: { education: 0.2 }, groups: { religious: 3, settlers: 2, arabs: -3 } }),
  ],
  diaspora: [
    act('policy', 'dia_antisemitism', '🛡️', 'מאבק באנטישמיות בעולם', 'תמיכה בקהילות יהודיות ובארגוני הסברה.', 2, 3, { budget: { government: 0.1 }, groups: { right: 1, olim: 1 }, playerReputation: 1 }),
    act('policy', 'dia_youth', '✈️', 'תוכניות לנוער יהודי מחו״ל', 'תגלית ומסע לחיזוק הקשר עם המדינה.', 2, 3, { budget: { education: 0.1 }, groups: { olim: 2 }, economy: { growth: 0.02 } }),
    act('policy', 'dia_reform', '🕎', 'הסדר התפילה בכותל', 'מתחם תפילה שוויוני לזרמים הלא-אורתודוקסיים.', 5, 4, { groups: { liberals: 4, olim: 2, haredim: -6, religious: -2 }, stability: -3 }),
  ],
  social_equality: [
    act('policy', 'soc_women', '👩', 'תוכנית למיגור האלימות נגד נשים', 'מקלטים, אזיקים אלקטרוניים ושירותי סיוע.', 3, 3, { budget: { welfare: 0.3, police: 0.2 }, groups: { families: 2, liberals: 3, left: 1 } }),
    act('policy', 'soc_wage_gap', '💼', 'צמצום פערי השכר בין נשים לגברים', 'שקיפות שכר ואכיפה.', 2, 3, { groups: { liberals: 2, employees: 1 } }),
    act('policy', 'soc_arab', '📈', 'תוכנית חומש לחברה הערבית', 'השקעה בתשתיות, חינוך ותעסוקה ביישובים הערביים.', 4, 4, { budget: { government: 0.6 }, groups: { arabs: 6, left: 2, right: -2 }, economy: { growth: 0.05 } }),
    act('policy', 'soc_elderly', '🧓', 'מאבק בבדידות הקשישים', 'מתנדבים, מועדונים וקווי סיוע.', 1, 3, { budget: { welfare: 0.1 }, groups: { elderly: 3 } }),
  ],
  intelligence: [
    act('policy', 'intl_warning', '🛰️', 'שיפור ההתרעה המודיעינית', 'תיאום בין גופי המודיעין ולקחי 7 באוקטובר.', 3, 3, { budget: { defense: 0.3 }, serviceBonus: { security: 2 } }),
    act('policy', 'intl_cyber_defense', '🔐', 'הגנת סייבר על תשתיות לאומיות', 'הגנה על חשמל, מים ובתי חולים מפני מתקפות.', 2, 3, { budget: { defense: 0.2 }, services: { security: 1, govServices: 1 } }),
    act('policy', 'intl_foreign_influence', '🕵️', 'מאבק בהשפעה זרה ברשתות', 'זיהוי ונטרול קמפיינים של מדינות עוינות.', 2, 3, { groups: { center: 1 }, playerReputation: 1 }),
  ],

  // ===================== MINISTRIES THE PM CAN CREATE =====================
  strategic: [
    act('policy', 'str_iran', '☢️', 'מערכה מדינית נגד תוכנית הגרעין האיראנית', 'תיאום עם מעצמות ופעילות מול הסוכנות לאנרגיה אטומית.', 3, 3, { playerReputation: 2, groups: { right: 2, center: 1 } }),
    act('policy', 'str_bds', '📣', 'מאבק בתנועת החרם', 'פעילות משפטית והסברתית נגד חרמות.', 2, 3, { budget: { government: 0.1 }, groups: { right: 2 } }),
  ],
  periphery: [
    act('budget', 'per_grants', '🏘️', 'מענקים לרשויות בפריפריה', 'השקעה בתשתיות קהילתיות.', 2, 3, { budget: { infrastructure: 0.4 }, groups: { periphery: 4 } }),
    act('policy', 'per_jobs', '🏭', 'משרות ממשלתיות לפריפריה', 'העברת יחידות ממשלתיות לצפון ולדרום.', 3, 4, { groups: { periphery: 4, publicSector: -2 } }),
  ],
  cyber: [
    act('policy', 'cyb_shield', '🛡️', 'מגן סייבר לאומי', 'הגנה על מערכות ממשלתיות ועל עסקים קטנים.', 2, 3, { budget: { science: 0.3 }, services: { govServices: 2, security: 1 } }),
    act('policy', 'cyb_talent', '👩‍💻', 'הכשרת מומחי סייבר', 'תוכניות לצעירים מהפריפריה.', 2, 3, { budget: { education: 0.2 }, groups: { youth: 2, periphery: 1 } }),
  ],
  public_diplomacy: [
    act('media', 'pd_campaign', '📣', 'קמפיין הסברה בינלאומי', 'תוכן ברשתות ובתקשורת הזרה.', 2, 3, { budget: { government: 0.2 }, groups: { right: 2 } }),
    act('media', 'pd_delegations', '🎤', 'משלחות דוברים לקמפוסים', 'שגרירים צעירים בקמפוסים בעולם.', 1, 3, { groups: { students: 1, right: 1 } }),
  ],
  national_resilience: [
    act('budget', 'nr_shelters', '🛡️', 'מיגון מוסדות חינוך ובתים', 'מרחבים מוגנים בבתי ספר ובבתים ישנים.', 3, 3, { budget: { defense: 0.6 }, groups: { families: 3, periphery: 3 } }),
    act('policy', 'nr_trauma', '🧠', 'טיפול בפוסט-טראומה בקהילה', 'מרכזי חוסן ופסיכולוגים בקהילות.', 2, 3, { budget: { health: 0.3 }, groups: { reservists: 3, periphery: 2 } }),
  ],
};
