// ============================================================
// Security and diplomacy: fronts, forces (real IDF units), operations,
// diplomatic channels and foreign relations. Static definitions only.
// Figures are game approximations, not intelligence assessments.
// ============================================================
import type { GroupId } from '../types/game';

export type FrontId = 'gaza' | 'lebanon' | 'iran' | 'yemen' | 'judea_samaria' | 'syria';
export type UnitId =
  | 'golani' | 'givati' | 'paratroopers' | 'nahal' | 'kfir' | 'armor' | 'commando' | 'matkal' | 'shayetet' | 'shaldag'
  | 'air_force' | 'navy' | 'u8200' | 'cyber' | 'air_defense' | 'home_front' | 'border_police';
export type ChannelId = 'usa' | 'egypt' | 'qatar' | 'jordan' | 'uae' | 'saudi' | 'pa';

export interface FrontDef { id: FrontId; name: string; icon: string; enemy: string; threat: number; desc: string; rocketRange: boolean }
export const FRONTS: FrontDef[] = [
  { id: 'gaza', name: 'רצועת עזה', icon: '🏚️', enemy: 'חמאס והג׳יהאד האסלאמי', threat: 45, rocketRange: true, desc: 'אחרי שנתיים של מלחמה. הסדר הפסקת האש שביר, והשאלה מי ישלוט ברצועה פתוחה.' },
  { id: 'lebanon', name: 'לבנון', icon: '⛰️', enemy: 'חיזבאללה', threat: 40, rocketRange: true, desc: 'הפסקת אש מנובמבר 2024. חיזבאללה נחלש אך מנסה להשתקם; צה״ל פועל נגד הפרות.' },
  { id: 'iran', name: 'איראן', icon: '☢️', enemy: 'משטר האייתוללות ושלוחיו', threat: 50, rocketRange: true, desc: 'אחרי המערכה ביוני 2025. תוכנית הגרעין נפגעה; החשש מהשתקמות ומטילים בליסטיים נמשך.' },
  { id: 'yemen', name: 'תימן', icon: '🚀', enemy: 'החות׳ים', threat: 35, rocketRange: true, desc: 'שיגורי טילים וכטב״מים לעבר אילת והמרכז, ופגיעה בשיט בים האדום.' },
  { id: 'judea_samaria', name: 'יהודה ושומרון', icon: '🏘️', enemy: 'תשתיות טרור מקומיות', threat: 45, rocketRange: false, desc: 'פיגועים, מבצעי מעצרים, אלימות מתנחלים והרשות הפלסטינית החלשה.' },
  { id: 'syria', name: 'סוריה', icon: '🏜️', enemy: 'גורמים חמושים ושלוחות איראניות', threat: 25, rocketRange: false, desc: 'שלטון חדש בדמשק. צה״ל מחזיק עמדות באזור החיץ בגולן.' },
];
export const FRONT_BY_ID = Object.fromEntries(FRONTS.map((f) => [f.id, f])) as Record<FrontId, FrontDef>;

export interface UnitDef { id: UnitId; name: string; icon: string; kind: 'infantry' | 'armor' | 'special' | 'air' | 'navy' | 'intel' | 'defense' | 'police'; desc: string }
export const UNITS: UnitDef[] = [
  { id: 'golani', name: 'חטיבת גולני', icon: '🟤', kind: 'infantry', desc: 'חטיבת חי״ר סדירה. לחימה קרקעית ופשיטות.' },
  { id: 'givati', name: 'חטיבת גבעתי', icon: '🟣', kind: 'infantry', desc: 'חטיבת חי״ר סדירה. ניסיון רב בלחימה ברצועה.' },
  { id: 'paratroopers', name: 'חטיבת הצנחנים', icon: '🔴', kind: 'infantry', desc: 'חטיבת חי״ר מובחרת.' },
  { id: 'nahal', name: 'חטיבת הנח״ל', icon: '🟢', kind: 'infantry', desc: 'חטיבת חי״ר סדירה.' },
  { id: 'kfir', name: 'חטיבת כפיר', icon: '🟫', kind: 'infantry', desc: 'מתמחה בלוחמה ביהודה ושומרון.' },
  { id: 'armor', name: 'גייסות השריון', icon: '🛡️', kind: 'armor', desc: 'טנקי מרכבה ונגמ״שים.' },
  { id: 'commando', name: 'חטיבת הקומנדו', icon: '🎯', kind: 'special', desc: 'מגלן, אגוז, דובדבן ורימון: פשיטות ממוקדות.' },
  { id: 'matkal', name: 'סיירת מטכ״ל', icon: '🦉', kind: 'special', desc: 'יחידת העילית של אגף המודיעין. מבצעים מיוחדים.' },
  { id: 'shayetet', name: 'שייטת 13', icon: '🦇', kind: 'special', desc: 'הקומנדו הימי.' },
  { id: 'shaldag', name: 'יחידת שלדג', icon: '🦅', kind: 'special', desc: 'יחידה מיוחדת של חיל האוויר.' },
  { id: 'air_force', name: 'חיל האוויר', icon: '✈️', kind: 'air', desc: 'F-35, F-15 ו-F-16: תקיפות מדויקות ובעומק.' },
  { id: 'navy', name: 'חיל הים', icon: '⚓', kind: 'navy', desc: 'ספינות טילים וצוללות: הגנה על המים הכלכליים וסגר ימי.' },
  { id: 'u8200', name: 'יחידה 8200', icon: '📡', kind: 'intel', desc: 'מודיעין אותות. מעלה את סיכויי ההצלחה של כל מבצע.' },
  { id: 'cyber', name: 'מערך ההגנה בסייבר', icon: '💻', kind: 'intel', desc: 'הגנה על תשתיות ומבצעי סייבר התקפיים.' },
  { id: 'air_defense', name: 'מערך ההגנה האווירית', icon: '🛰️', kind: 'defense', desc: 'כיפת ברזל, קלע דוד, חץ ו"אור איתן". מקטין נזק מרקטות וטילים.' },
  { id: 'home_front', name: 'פיקוד העורף', icon: '🏠', kind: 'defense', desc: 'התגוננות אזרחית, מיגון והתרעה.' },
  { id: 'border_police', name: 'משמר הגבול', icon: '🚓', kind: 'police', desc: 'כוח משטרתי-צבאי ביהודה ושומרון ובערים.' },
];
export const UNIT_BY_ID = Object.fromEntries(UNITS.map((u) => [u.id, u])) as Record<UnitId, UnitDef>;

export interface OperationDef {
  id: string; name: string; icon: string; desc: string;
  fronts: FrontId[]; units: UnitId[];
  /** threat reduction on success */ threatCut: number;
  /** soldier casualty risk 0..1 (expected fallen on a bad day ≈ risk × 20) */ risk: number;
  cost: number; // ₪B one-off
  reservists: boolean; intlCost: number; // relations hit abroad
  turns: number; // how long it runs
  needsCabinet: boolean;
}
export const OPERATIONS: OperationDef[] = [
  { id: 'targeted_strike', name: 'סיכול ממוקד', icon: '🎯', desc: 'תקיפה מדויקת נגד מפקד או תשתית, על בסיס מודיעין.', fronts: ['gaza', 'lebanon', 'yemen', 'syria', 'judea_samaria'], units: ['air_force', 'u8200'], threatCut: 8, risk: 0.02, cost: 0.1, reservists: false, intlCost: 2, turns: 1, needsCabinet: false },
  { id: 'air_campaign', name: 'מערכה אווירית', icon: '✈️', desc: 'גל תקיפות נרחב נגד מאגרי נשק, משגרים ומפקדות. צפוי ירי לעבר העורף.', fronts: ['gaza', 'lebanon', 'yemen', 'syria'], units: ['air_force', 'u8200', 'air_defense'], threatCut: 18, risk: 0.05, cost: 1.5, reservists: false, intlCost: 8, turns: 1, needsCabinet: true },
  { id: 'ground_raid', name: 'פשיטה קרקעית ממוקדת', icon: '🪖', desc: 'כוח מובחר נכנס, משמיד תשתית ויוצא.', fronts: ['gaza', 'lebanon', 'syria'], units: ['commando', 'golani'], threatCut: 12, risk: 0.25, cost: 0.4, reservists: false, intlCost: 3, turns: 1, needsCabinet: true },
  { id: 'wide_ground', name: 'מבצע קרקעי רחב', icon: '🛡️', desc: 'כמה חטיבות וגיוס מילואים. פגיעה משמעותית באויב, במחיר כבד בנפגעים ובכלכלה.', fronts: ['gaza', 'lebanon'], units: ['golani', 'givati', 'paratroopers', 'armor', 'air_force'], threatCut: 35, risk: 0.8, cost: 6, reservists: true, intlCost: 15, turns: 2, needsCabinet: true },
  { id: 'special_op', name: 'מבצע מיוחד', icon: '🦉', desc: 'מבצע חשאי בעומק שטח האויב. סיכון גבוה, תמורה גבוהה.', fronts: ['lebanon', 'iran', 'syria', 'yemen'], units: ['matkal', 'shaldag', 'u8200'], threatCut: 15, risk: 0.18, cost: 0.3, reservists: false, intlCost: 4, turns: 1, needsCabinet: true },
  { id: 'naval_blockade', name: 'סגר ימי והחרמת משלוחים', icon: '⚓', desc: 'יירוט ספינות נשק בים.', fronts: ['yemen', 'gaza', 'lebanon'], units: ['navy', 'shayetet'], threatCut: 7, risk: 0.04, cost: 0.4, reservists: false, intlCost: 3, turns: 1, needsCabinet: false },
  { id: 'cyber_op', name: 'מבצע סייבר', icon: '💻', desc: 'שיבוש מערכות שליטה, תקשורת ופיננסים של האויב. בלי סיכון לכוחות.', fronts: ['iran', 'lebanon', 'gaza', 'yemen'], units: ['cyber', 'u8200'], threatCut: 6, risk: 0, cost: 0.2, reservists: false, intlCost: 1, turns: 1, needsCabinet: false },
  { id: 'arrests', name: 'מבצע מעצרים', icon: '🚓', desc: 'מעצר חשודים ופירוק חוליות ביהודה ושומרון.', fronts: ['judea_samaria'], units: ['kfir', 'commando', 'border_police'], threatCut: 10, risk: 0.06, cost: 0.2, reservists: false, intlCost: 2, turns: 1, needsCabinet: false },
  { id: 'iran_strike', name: 'תקיפה באיראן', icon: '☢️', desc: 'תקיפה של מתקני גרעין וטילים. צפויה תגובת טילים בליסטיים לעבר ישמעאל. מומלץ לתאם עם ארה״ב.', fronts: ['iran'], units: ['air_force', 'u8200', 'air_defense', 'home_front'], threatCut: 30, risk: 0.1, cost: 5, reservists: true, intlCost: 10, turns: 1, needsCabinet: true },
];
export const OPERATION_BY_ID = Object.fromEntries(OPERATIONS.map((o) => [o.id, o])) as Record<string, OperationDef>;

export interface ChannelDef { id: ChannelId; name: string; icon: string; role: string }
export const CHANNELS: ChannelDef[] = [
  { id: 'usa', name: 'ארה״ב', icon: '', role: 'בעלת הברית המרכזית: סיוע ביטחוני, גיבוי מדיני ותיווך.' },
  { id: 'egypt', name: 'מצרים', icon: '', role: 'מתווכת מרכזית מול עזה, שומרת על הסכם השלום.' },
  { id: 'qatar', name: 'קטאר', icon: '', role: 'ערוץ עקיף לחמאס. שנויה במחלוקת בישמעאל.' },
  { id: 'jordan', name: 'ירדן', icon: '', role: 'הסכם שלום, מעורבות במקומות הקדושים בירושלים.' },
  { id: 'uae', name: 'איחוד האמירויות', icon: '', role: 'שותפה בהסכמי אברהם.' },
  { id: 'saudi', name: 'סעודיה', icon: '', role: 'יעד לנורמליזציה. מתנה התקדמות בצעד מדיני מול הפלסטינים.' },
  { id: 'pa', name: 'הרשות הפלסטינית', icon: '🏛️', role: 'שולטת בשטחי A ובחלק מ-B. תיאום ביטחוני וכלכלי.' },
];
export const CHANNEL_BY_ID = Object.fromEntries(CHANNELS.map((c) => [c.id, c])) as Record<ChannelId, ChannelDef>;

/** Who is angry and who is pleased by a hawkish vs. a conciliatory move (used for reactions). */
export const HAWK_GROUPS: Partial<Record<GroupId, number>> = { right: 4, settlers: 3, reservists: -1, left: -4, liberals: -2, arabs: -3 };
export const DOVE_GROUPS: Partial<Record<GroupId, number>> = { left: 4, liberals: 2, arabs: 3, center: 1, right: -4, settlers: -6 };

/** Judea and Samaria under the Oslo Accords (share of the area, %). */
export const OSLO_AREAS_START = { A: 18, B: 22, C: 60 };
