import type { Effects, GameState, Ministry } from '../types/game';
import type { MinistryActionSpec } from './ministryActions';

// ============================================================
// Wartime ministry actions. They appear only while a war is on (the war crisis,
// or a front in active fighting) and give every ministry something concrete to do:
// the Transport Ministry cuts public transport on exposed routes, the Interior Ministry
// limits the size of gatherings, and so on. Each one trades safety against daily life.
// ============================================================

/** A war is on: the war crisis is active, or at least one front is in open fighting. */
export const atWar = (s: GameState): boolean =>
  s.crises.some((c) => c.defId === 'war') || Object.values(s.world?.fronts ?? {}).some((f) => f.status === 'fighting');

const W = (id: string, icon: string, title: string, desc: string, capital: number, effects: Effects | ((s: GameState, m?: Ministry) => Effects), more: Partial<MinistryActionSpec> = {}): MinistryActionSpec => ({
  cat: 'war', id: `war_${id}`, icon, title, desc, capital, cooldown: 2, effects: typeof effects === 'function' ? effects : () => effects, ...more,
});

export const WAR_ACTIONS: Record<string, MinistryActionSpec[]> = {
  transport: [
    W('cut_transit', '🚌', 'צמצום תחבורה ציבורית לאזורים מסוימים', 'מצמצם קווי אוטובוס ורכבת לאזורים חשופים ולשעות מסוימות. מקטין את החשיפה וחוסך כסף, אבל פוגע במי שתלוי בתחבורה ציבורית.', 3,
      { budget: { transport: -0.4 }, services: { transport: -3 }, serviceBonus: { security: 1 }, groups: { lowIncome: -3, students: -2, elderly: -2, periphery: -3, employees: -1 } }, { note: 'הקווים יחזרו לפעול כשהמצב הביטחוני יאפשר זאת.' }),
    W('priority_routes', '🛣️', 'מסדרונות תנועה לכוחות ולציוד', 'שמירת נתיבים וצירים לתנועת כוחות, ציוד ואספקה. מזרז את הגיוס אבל מעמיס על האזרחים.', 2,
      { services: { transport: -1 }, serviceBonus: { security: 2 }, groups: { reservists: 2, soldiers: 2, middleClass: -1 } }),
    W('airport_limits', '✈️', 'הגבלת טיסות ופעילות בנמל התעופה', 'מצמצם טיסות בשעות סכנה ומעביר חלק מהפעילות לנמלים חלופיים. מגן על הנוסעים ופוגע בתיירות ובמסחר.', 3,
      { economy: { growth: -0.1 }, serviceBonus: { security: 1 }, groups: { highIncome: -2, selfEmployed: -2, secular: -1 } }),
  ],
  interior: [
    W('gathering_limits', '👥', 'הגבלת מספר המשתתפים בהתכנסויות', 'מגביל את מספר האנשים בכל אירוע או התכנסות במקום אחד, לפי הנחיות פיקוד העורף. מקטין את הסיכון באזעקות, אבל פוגע באירועים, בבתי תפילה ובעסקים.', 2,
      { services: { security: 2 }, economy: { growth: -0.05 }, groups: { secular: -2, religious: -2, haredim: -2, selfEmployed: -3, youth: -2, families: 1 } }, { note: 'ההגבלה מתעדכנת לפי רמת האיום בכל אזור.' }),
    W('local_authorities', '🏛️', 'סמכויות חירום לרשויות מקומיות', 'מרחיב את סמכויות הרשויות המקומיות לסגירת מוסדות ולפינוי. תגובה מהירה יותר בשטח, ופחות פיקוח מרכזי.', 2,
      { serviceBonus: { security: 1 }, groups: { periphery: 2, publicSector: 1, liberals: -1 } }),
    W('evacuation_support', '🚐', 'ארגון פינוי תושבים מקו העימות', 'פינוי מסודר של יישובים בסמוך לגבול ללינה זמנית. מציל חיים ועולה כסף ושיבוש חיים.', 4,
      { oneOffCost: 1.2, services: { security: 2, housing: -1 }, groups: { periphery: 1, families: 1, settlers: -1 } }),
  ],
  national_security: [
    W('police_reinforcement', '🚓', 'תגבור משטרה ומשמר הגבול בעורף', 'מעביר כוחות משטרה לנקודות רגישות ולמוקדי התרעה. מחזק את תחושת הביטחון, ומותיר פחות כוחות לעבירות רגילות.', 3,
      { budget: { police: 0.8 }, services: { security: 2 }, groups: { right: 2, families: 1, periphery: 1 } }),
    W('protest_limits', '📢', 'הגבלת הפגנות ועצרות בנקודות רגישות', 'מגביל את גודל ההפגנות ומיקומן בזמן אזעקות. מקטין סיכון, אך מעורר ביקורת על פגיעה בחופש המחאה.', 3,
      { services: { security: 2 }, stability: 1, groups: { liberals: -3, left: -2, right: 1 } }, { note: 'ארגוני זכויות האדם מבקשים לעקוב אחר השימוש בסמכות.' }),
    W('checkpoints', '🚧', 'חסימות ובדיקות בצמתים מרכזיים', 'בדיקות ביטחוניות בצמתים ובכניסות לערים. מקשה על מחבלים ומעכב את התנועה.', 2,
      { services: { security: 2, transport: -1 }, groups: { middleClass: -1, right: 1 } }),
  ],
  defense: [
    W('reserve_call_up', '🎖️', 'צו גיוס מילואים נוסף', 'גיוס נוסף של יחידות מילואים. מחזק את הכוחות ופוגע בכלכלה ובמשפחות המשרתים.', 4,
      { budget: { defense: 1.5 }, serviceBonus: { security: 4 }, economy: { growth: -0.15 }, groups: { reservists: -4, soldiers: 1, right: 2, families: -1 } }),
    W('munitions', '🏭', 'האצת ייצור תחמושת וציוד', 'הרחבת קווי הייצור של התעשייה הביטחונית ורכש חירום. משפר מוכנות ומעמיס על התקציב.', 4,
      { budget: { defense: 2 }, serviceBonus: { security: 3 }, economy: { growth: 0.05 }, groups: { right: 1, highIncome: 1 } }),
    W('home_front', '🛡️', 'תגבור הגנה אווירית על ערים ועל תשתיות', 'העברת סוללות ומיירטים להגנה על ריכוזי אוכלוסייה ותשתיות חיוניות.', 4,
      { budget: { defense: 1 }, services: { security: 3 }, groups: { periphery: 3, families: 2, center: 2 } }),
  ],
  health: [
    W('hospital_readiness', '🏥', 'היערכות בתי חולים לקליטת נפגעים', 'פינוי מיטות, תגבור צוותים והקמת מערך חירום. משפר את היכולת לטפל בנפגעים ומעמיס על שאר הטיפולים.', 3,
      { budget: { health: 1.2 }, serviceBonus: { health: 3 }, services: { health: -1 }, groups: { families: 1, elderly: -1 } }),
    W('postpone_elective', '🗓️', 'דחיית ניתוחים וטיפולים שאינם דחופים', 'מפנה מיטות וצוותים לטיפול בנפגעים. פוגע בחולים שממתינים ובשביעות הרצון.', 2,
      { services: { health: -3 }, serviceBonus: { security: 1 }, groups: { elderly: -3, retirees: -2, families: -2 } }),
    W('blood_drive', '🩸', 'מבצע לאומי לתרומות דם', 'מבצע הסברה ואיסוף מלאי דם לחירום. עולה מעט ומחזק את תחושת השותפות.', 1,
      { serviceBonus: { health: 1 }, groups: { youth: 1, families: 1, center: 1 } }),
  ],
  education: [
    W('remote_learning', '💻', 'מעבר ללמידה מרחוק באזורים חשופים', 'סוגר בתי ספר באזורי סכנה ועובר ללמידה מרחוק. מגן על התלמידים ופוגע בלמידה ובהורים העובדים.', 3,
      { services: { education: -3 }, serviceBonus: { security: 1 }, groups: { families: -3, students: -2, youth: -2, employees: -1 } }),
    W('reservist_childcare', '🧒', 'מסגרות חירום לילדי משרתי מילואים', 'פתיחת צהרונים ומסגרות לילדי המשרתים. מקל על המשפחות ועולה כסף.', 2,
      { budget: { education: 0.5 }, groups: { reservists: 3, families: 2, employees: 1 } }),
    W('shelter_drills', '🛎️', 'תרגול ונהלי מיגון בבתי ספר', 'הכנת מקלטים ותרגול התנהגות באזעקה. מחזק את הביטחון בבתי הספר.', 1,
      { services: { security: 1 }, groups: { families: 1 } }),
  ],
  finance: [
    W('business_compensation', '💼', 'מענקי פיצוי לעסקים באזורי לחימה', 'פיצוי עסקים שנפגעו מהלחימה ומהגבלות. עולה כסף רב ומרגיע את השוק.', 4,
      { oneOffCost: 3, economy: { growth: 0.05 }, groups: { selfEmployed: 4, periphery: 3, highIncome: 1 } }),
    W('reservist_package', '🎗️', 'חבילת סיוע למשרתי מילואים ולמשפחותיהם', 'מענקים, הטבות מס והקלות במשכנתאות. מגבירה את שביעות הרצון, ומגדילה את הגירעון.', 4,
      { oneOffCost: 2, groups: { reservists: 5, families: 2, employees: 1 } }),
    W('war_loan', '🏦', 'הנפקת איגרות חוב למימון המלחמה', 'גיוס חוב בשוק הבינלאומי למימון הוצאות הלחימה. נותן אוויר לתקציב ומעלה את החוב.', 3,
      { revenue: 2, groups: { highIncome: -1 } }, { note: 'דירוג האשראי יושפע מגובה החוב.' }),
  ],
  economy: [
    W('small_business_aid', '🏪', 'תכנית סיוע לעסקים קטנים בעורף', 'מענקים והלוואות בערבות מדינה לעסקים קטנים. שומר מקומות עבודה.', 3,
      { oneOffCost: 1.5, economy: { unemployment: -0.05 }, groups: { selfEmployed: 3, employees: 1 } }),
    W('price_watch', '🧾', 'פיקוח זמני על מחירי מוצרי יסוד', 'מגביל עליות מחירים של מוצרי יסוד בזמן המלחמה. מקל על משקי בית, ופוגע ברווחי הקמעונאים.', 3,
      { economy: { inflation: -0.2 }, groups: { lowIncome: 3, middleClass: 2, selfEmployed: -2 } }),
    W('supply_chain', '🚢', 'הבטחת שרשראות אספקה וייבוא חיוני', 'הסכמים עם ספקים ונמלים חלופיים. מייצב את המחירים בטווח הבינוני.', 3,
      { economy: { growth: 0.05, inflation: -0.1 }, groups: { highIncome: 1, selfEmployed: 1 } }),
  ],
  foreign: [
    W('diplomatic_campaign', '🌍', 'מאמץ דיפלומטי לתמיכה בינלאומית', 'מסע פגישות ופניות לבעלות הברית לתמיכה מדינית וצבאית. מחזק את הלגיטימציה.', 3,
      { serviceBonus: { security: 1 }, playerReputation: 2, groups: { center: 1, right: 1 } }),
    W('ceasefire_talks', '🕊️', 'פתיחת ערוץ לעצירת אש בתיווך', 'מגעים עם מתווכים לעצירת אש. מקטין את הסלמה, ומעורר ביקורת מהימין.', 4,
      { serviceBonus: { security: 1 }, groups: { left: 3, center: 1, right: -2, reservists: 1 } }),
    W('weapons_deals', '🛩️', 'הבטחת אספקת נשק מבעלות ברית', 'משא ומתן על אספקת נשק ותחמושת בשעת חירום. מחזק את הצבא ויוצר תלות.', 3,
      { serviceBonus: { security: 3 }, groups: { right: 1 } }),
  ],
  justice: [
    W('emergency_regs', '📜', 'הפעלת תקנות שעת חירום', 'הרחבת סמכויות הממשלה לפי חוק לשעת חירום, למשך זמן מוגבל. מגביר שליטה ויעילות ופוגע באמון של קבוצות שחוששות מפגיעה בדמוקרטיה.', 4,
      { stability: 2, serviceBonus: { security: 1 }, groups: { liberals: -3, left: -2, right: 1 } }, { note: 'התקנות מוגבלות בזמן ודורשות אישור הכנסטון.' }),
    W('legal_aid', '⚖️', 'סיוע משפטי למפונים ולמשרתי מילואים', 'ייצוג משפטי ללא עלות בענייני דיור, תעסוקה ופיצויים. מקל על המשפחות.', 2,
      { groups: { reservists: 2, families: 1, lowIncome: 1 } }),
  ],
  housing: [
    W('temporary_housing', '🏨', 'פתרונות דיור זמניים למפונים', 'מלונות ודירות זמניות למי שפונה מביתו. מציל מצוקה ועולה כסף.', 4,
      { oneOffCost: 1.5, services: { housing: -1 }, groups: { periphery: 3, families: 2 } }),
    W('eviction_freeze', '🔒', 'הקפאת פינויים והסדרי דחייה בשכר דירה', 'מניעת פינוי דיירים שנפגעו מהמלחמה. מקל על שוכרים ופוגע במשכירים.', 2,
      { groups: { lowIncome: 3, middleClass: 1, selfEmployed: -1, highIncome: -1 } }),
  ],
  energy: [
    W('protect_infrastructure', '⚡', 'הגנה על תחנות כוח ותשתיות אנרגיה', 'תגבור מיגון והגנה על מתקנים חיוניים. מצמצם את הסיכון לפגיעה באספקה.', 3,
      { budget: { energy: 0.8 }, serviceBonus: { energy: 3, security: 1 } }),
    W('priority_supply', '🏥', 'תיעדוף אספקת חשמל לבתי חולים ולצבא', 'במקרה של מחסור, חשמל קודם למוסדות חיוניים. מגן על הלוחמים ועל הנפגעים, ופוגע ברצף האספקה לצרכנים.', 2,
      { services: { energy: -2 }, serviceBonus: { security: 1, health: 1 }, groups: { families: -1, selfEmployed: -1 } }),
  ],
  welfare: [
    W('trauma_support', '🧠', 'מוקדי סיוע נפשי לאוכלוסייה ולמשפחות', 'הרחבת טיפול נפשי ומוקדי חירום. משפר את החוסן הנפשי.', 3,
      { budget: { welfare: 1 }, serviceBonus: { welfare: 3 }, groups: { families: 3, reservists: 2, elderly: 1 } }),
    W('bereaved_families', '🕯️', 'סיוע ללוויית ולליווי משפחות שכולות', 'ליווי אישי ותמיכה כלכלית למשפחות שכולות ולנפגעים. מחזק את האמון ועולה כסף.', 3,
      { oneOffCost: 0.8, groups: { families: 3, reservists: 2, soldiers: 1 } }),
    W('elderly_check', '👵', 'מבצע בדיקת מצב קשישים בבידוד', 'מוקדי ביקור וסיוע לקשישים בודדים בעת אזעקות. מציל חיים ועולה מעט.', 2,
      { serviceBonus: { welfare: 2 }, groups: { elderly: 3, retirees: 2 } }),
  ],
  environment: [
    W('hazmat_cleanup', '☣️', 'פינוי חומרים מסוכנים ושיקום אזורים שנפגעו', 'ניקוי אתרים שנפגעו מפגיעות ושריפות. מצמצם סיכון בריאותי ועולה כסף.', 3,
      { oneOffCost: 0.5, groups: { periphery: 2, families: 1 } }),
    W('industrial_safety', '🏭', 'הגברת בטיחות במפעלים כימיים בקו העימות', 'סגירת קווי ייצור מסוכנים והעברת מלאים. מגן על האזור ופוגע בתפוקה.', 3,
      { economy: { growth: -0.03 }, serviceBonus: { security: 1 }, groups: { periphery: 2, selfEmployed: -1 } }),
  ],
  agriculture: [
    W('food_reserve', '🌾', 'מלאי חירום של מזון', 'רכש ואחסון מלאי בסיסי למקרה של שיבוש באספקה. עולה כסף ומרגיע.', 3,
      { oneOffCost: 1, groups: { middleClass: 1, lowIncome: 1, families: 1 } }),
    W('frontline_farms', '🚜', 'סיוע לחקלאים בקו העימות', 'פיצוי ועובדים חלופיים לחקלאים באזורי לחימה. שומר על ייצור המזון.', 3,
      { budget: { agriculture: 0.8 }, groups: { periphery: 3, selfEmployed: 2 } }),
  ],
  communications: [
    W('emergency_broadcast', '📡', 'שידורי חירום והתרעות בכל הערוצים', 'חיבור כל הערוצים והאפליקציות למערכת התרעה אחת. מקצר זמני תגובה ומציל חיים.', 2,
      { serviceBonus: { security: 2 }, groups: { families: 2, center: 1 } }),
    W('fake_news', '📵', 'ניטור ומאבק בחדשות כוזבות ובמבצעי השפעה', 'שיתוף פעולה עם הפלטפורמות והסרת תוכן מטעה. מצמצם בהלה ומעורר ויכוח על חופש הביטוי.', 3,
      { stability: 1, groups: { liberals: -2, center: 1, right: 1 } }),
  ],
  culture: [
    W('events_ban', '🎭', 'ביטול או צמצום אירועי תרבות ופנאי', 'מבטל הופעות ואירועים גדולים בעת סכנה. מקטין סיכון ופוגע בעוסקים בתחום ובמצב הרוח.', 2,
      { services: { security: 1 }, groups: { secular: -2, youth: -3, selfEmployed: -2 } }),
    W('shelter_culture', '🎻', 'תכנית תרבות ואמנות בעורף ובמקלטים', 'אמנים מופיעים בפני משפחות ומפונים. משפר את מצב הרוח בעלות נמוכה.', 1,
      { groups: { families: 2, youth: 1, secular: 1 } }),
  ],
  tourism: [
    W('hotel_evacuees', '🏨', 'מענקים למלונות המפנים ולמגזר התיירות', 'תשלום עבור אכסון מפונים ומענקי הישרדות לעסקי תיירות. מחזק את המגזר ועולה כסף.', 3,
      { oneOffCost: 1, groups: { selfEmployed: 3, periphery: 2 } }),
    W('close_sites', '🏞️', 'סגירת אתרי תיירות בקו העימות', 'סוגר אתרים וטיולים באזורים מסוכנים. מגן על המטיילים ופוגע בעסקים המקומיים.', 2,
      { serviceBonus: { security: 1 }, groups: { selfEmployed: -2, periphery: -1 } }),
  ],
  labor: [
    W('reservist_jobs', '🧰', 'הגנת מקום עבודה למשרתי מילואים', 'אוסר פיטורים של משרתי מילואים ומרחיב הטבות. מגן על המשרתים ופוגע בעסקים קטנים.', 3,
      { groups: { reservists: 4, employees: 2, selfEmployed: -1 } }),
    W('furlough_deals', '📑', 'הסדרי חל״ת מוסכמים בעורף', 'מעבר מסודר לחופשה ללא תשלום עם פיצוי חלקי. שומר על מקומות עבודה בטווח הקצר.', 3,
      { oneOffCost: 0.8, economy: { unemployment: -0.05 }, groups: { employees: 2, selfEmployed: 1 } }),
  ],
  religious: [
    W('prayer_limits', '🕍', 'הגבלת התכנסות בבתי כנסת ובבתי תפילה', 'מגביל את מספר המתפללים בעת התרעות בהתאם להנחיות פיקוד העורף. מקטין סיכון ופוגע בציבור הדתי והחרדי.', 2,
      { services: { security: 2 }, groups: { religious: -2, haredim: -2 } }),
    W('military_rabbinate', '✡️', 'תגבור הרבנות הצבאית ושירותי קבורה', 'הרחבת שירותי הדת והקבורה בחזית ובעורף. מחזק את כבוד המשפחות.', 2,
      { groups: { reservists: 1, religious: 2, families: 1 } }),
  ],
  jerusalem: [
    W('jerusalem_security', '🕌', 'תגבור הביטחון בעיר ובמקומות הקדושים', 'כוחות נוספים בעיר העתיקה ובצמתים. מקטין את הסיכון, ומגביר מתח.', 3,
      { services: { security: 2 }, groups: { right: 1, center: 1, arabs: -1 } }),
    W('jerusalem_business', '🛍️', 'סיוע לעסקים בעיר בעת לחימה', 'מענקים לעסקים שנפגעו בגלל ההגבלות והירידה בתיירות.', 2,
      { oneOffCost: 0.5, groups: { selfEmployed: 2, center: 1 } }),
  ],
  heritage: [
    W('heritage_protect', '🏛️', 'הגנה על אתרי מורשת וארכיונים', 'פינוי אוספים ומיגון אתרים לאומיים מפני פגיעה. שומר על הזיכרון הלאומי.', 2,
      { groups: { secular: 1, religious: 1, center: 1 } }),
    W('memorial_program', '🕯️', 'הנצחה ותיעוד של הנופלים והמשפחות', 'תכנית ממלכתית להנצחה ותיעוד. מחזקת את האחדות ועולה מעט.', 2,
      { oneOffCost: 0.3, groups: { families: 2, soldiers: 1, reservists: 1 } }),
  ],
  negev_galilee: [
    W('frontline_plan', '🏘️', 'תכנית חירום ליישובי קו העימות', 'מיגון, תגבור צוותים ושירותים ליישובי הצפון והדרום. מחזק את האמון בפריפריה.', 4,
      { budget: { infrastructure: 1 }, groups: { periphery: 4, families: 1 } }),
    W('temporary_relocation', '🚌', 'פינוי וישוב זמני ליישובים סמוכים לגבול', 'מעביר תושבים ללינה זמנית ושומר על קהילות. עולה כסף ושובר שגרה.', 4,
      { oneOffCost: 1, services: { housing: -1 }, groups: { periphery: 2, families: 1 } }),
  ],
  aliyah: [
    W('olim_emergency', '🛫', 'סיוע חירום לעולים חדשים', 'מוקדי סיוע בשפות אחרות ותמיכה ממשלתית. שומר על האמון של עולים.', 2,
      { groups: { olim: 4 } }),
    W('pause_absorption', '⏸️', 'עצירה זמנית של קליטה באזורי לחימה', 'מעביר עולים חדשים לאזורים בטוחים. מקטין סיכון ופוגע בתכנון.', 2,
      { serviceBonus: { security: 1 }, groups: { olim: -2 } }),
  ],
  science: [
    W('defense_rnd', '🔬', 'הפניית מו״פ לטכנולוגיות הגנה', 'מימון אקדמיה ותעשייה לפיתוח מיירטים, לייזר וסייבר. משפר את היכולת הביטחונית.', 3,
      { budget: { science: 0.8 }, serviceBonus: { security: 3 }, groups: { highIncome: 1, students: 1 } }),
    W('tech_volunteers', '🧑‍💻', 'גיוס מתנדבי הייטק למאמץ המלחמתי', 'קריאה למומחים לסייע בפתרונות מידע ולוגיסטיקה. עלות נמוכה ומחזקת את הלכידות.', 1,
      { serviceBonus: { security: 1 }, groups: { youth: 1, highIncome: 1 } }),
  ],
  regional: [
    W('arab_coordination', '🤝', 'תיאום עם מדינות ערב ומתווכים אזוריים', 'ערוצי תיאום ביטחוני ומדיני עם מצרים, ירדן ומדינות המפרץ. מקטין סיכון להסלמה.', 3,
      { stability: 1, serviceBonus: { security: 1 }, groups: { center: 1, left: 1, arabs: 1 } }),
  ],
  settlement: [
    W('settlement_security', '🏕️', 'תגבור הביטחון ביישובי הספר ובשטחים', 'כיתות כוננות, מיגון וכוחות נוספים ביישובים. מחזק את תחושת הביטחון.', 3,
      { services: { security: 1 }, groups: { settlers: 3, right: 1 } }),
    W('victims_support', '🧡', 'סיוע לנפגעים ולמפונים מיישובים', 'פיצויים ודיור זמני לנפגעים. מחזק את האמון ועולה כסף.', 2,
      { oneOffCost: 0.6, groups: { settlers: 2, families: 1 } }),
  ],
  diaspora: [
    W('diaspora_support', '🌐', 'גיוס תמיכת קהילות יהודיות בעולם', 'קמפיין תמיכה והתרמה בקהילות. מביא כסף ותמיכה ציבורית.', 2,
      { revenue: 0.3, playerReputation: 1, groups: { right: 1, center: 1 } }),
    W('diaspora_security', '🛡️', 'סיוע בביטחון לקהילות מותקפות בחו״ל', 'שיתוף מומחים ומימון להגנה על בתי כנסת ומוסדות. מחזק את הקשר עם הקהילות.', 2,
      { oneOffCost: 0.3, groups: { right: 1, religious: 1 } }),
  ],
  social_equality: [
    W('minority_support', '🧡', 'סיוע לאוכלוסיות מוחלשות בשעת מלחמה', 'סיוע במזון, דיור וטיפול לאוכלוסיות שנפגעו במיוחד. מצמצם פערים בזמן משבר.', 3,
      { oneOffCost: 0.8, groups: { arabs: 2, lowIncome: 2, elderly: 2 } }),
    W('shared_society', '🤲', 'מיזמי חוסן משותף ליהודים וערבים', 'תכנית חוסן קהילתית לשמירה על שקט פנימי. מחזקת את האמון.', 2,
      { stability: 1, groups: { arabs: 2, left: 1, center: 1 } }),
  ],
  intelligence: [
    W('collection_boost', '🕵️', 'הרחבת איסוף וסיכול מודיעיני', 'תגבור מקורות והסיכולים. משפר את ההתרעה ומעורר שאלות על פרטיות.', 3,
      { serviceBonus: { security: 3 }, groups: { liberals: -1, right: 1 } }),
    W('early_warning', '📡', 'מערך התרעה מוקדמת משולב', 'חיבור בין גופי המודיעין והפיקוד. מקצר זמני תגובה.', 3,
      { serviceBonus: { security: 2 } }),
  ],
  strategic: [
    W('threat_analysis', '🧭', 'ניתוח איומים ותכנון אסטרטגי', 'צוות לתכנון הלחימה והיום שאחריה. משפר את החלטות הקבינט.', 2,
      { serviceBonus: { security: 2 }, playerReputation: 1 }),
  ],
  periphery: [
    W('rebuild_periphery', '🏗️', 'שיקום תשתיות בפריפריה שנפגעו', 'תיקון כבישים, חשמל ומים באזורים שנפגעו. מחזק את האמון ועולה כסף.', 3,
      { budget: { infrastructure: 0.8 }, groups: { periphery: 3 } }),
  ],
  cyber: [
    W('cyber_defense', '🔐', 'הגנת סייבר על תשתיות לאומיות', 'מערכות מים, חשמל ובנקים מוגנות מפני מתקפות. מקטין סיכון לשיבוש.', 3,
      { serviceBonus: { security: 2, govServices: 1 }, groups: { highIncome: 1 } }),
    W('block_incitement', '🧯', 'חסימת מתקפות והסתה ברשת', 'שיתוף פעולה עם הפלטפורמות והסרת חשבונות עוינים. מצמצם בהלה ומעורר ויכוח על צנזורה.', 2,
      { stability: 1, groups: { liberals: -1, right: 1 } }),
  ],
  public_diplomacy: [
    W('global_campaign', '📣', 'מבצע הסברה בינלאומי', 'מסרים ומראיינים בשפות זרות בערוצים בינלאומיים. משפר את התדמית ועולה כסף.', 3,
      { oneOffCost: 0.4, playerReputation: 1, groups: { center: 1, right: 1 } }),
  ],
  national_resilience: [
    W('resilience_centers', '🛠️', 'הקמת מרכזי חוסן ומקלטים', 'מקלטים ציבוריים וממ״דים נוספים. מגן על האוכלוסייה לטווח ארוך.', 4,
      { budget: { infrastructure: 1 }, serviceBonus: { security: 2 }, groups: { periphery: 3, families: 2 } }),
    W('volunteer_training', '🧑‍🤝‍🧑', 'הכשרת מתנדבים לשעת חירום', 'קורסי עזרה ראשונה וניהול מוקדים. מחזקת את הקהילות בעלות נמוכה.', 1,
      { serviceBonus: { welfare: 1, security: 1 }, groups: { youth: 2, students: 1 } }),
  ],
};
