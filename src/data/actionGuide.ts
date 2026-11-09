// The in-game actions guide: who can do what. The list of actions itself comes from the game's own action definitions,
// so a new action shows up in the guide by itself; this file only says which roles can use it (a test checks that none is left out).
import type { ActionCategory } from '../engine/decisions';

export type GuideRole = 'pm' | 'minister' | 'defense' | 'foreign' | 'economy' | 'internal' | 'leader' | 'mk' | 'speaker';

export const GUIDE_ROLES: { id: GuideRole; label: string; icon: string }[] = [
  { id: 'pm', label: 'ראש הממשלה', icon: '👔' },
  { id: 'minister', label: 'שר', icon: '🏛️' },
  { id: 'defense', label: 'שר הביטחון', icon: '🛡️' },
  { id: 'foreign', label: 'שר החוץ', icon: '🌍' },
  { id: 'economy', label: 'שר הכלכלה', icon: '📊' },
  { id: 'internal', label: 'השר לביטחון לאומי', icon: '🚓' },
  { id: 'leader', label: 'יו״ר מפלגה', icon: '🚩' },
  { id: 'mk', label: 'חבר כנסטון', icon: '🏟️' },
  { id: 'speaker', label: 'יו״ר הכנסטון', icon: '🔨' },
];

export const CATEGORY_LABEL: Record<ActionCategory | 'ministry_special', string> = {
  economy: 'כלכלה ותקציב', government: 'ממשלה וביטחון', parliament: 'כנסטון וחקיקה', ministry: 'ניהול משרד', projects: 'פרויקטים',
  media: 'תקשורת ונאומים', career: 'קריירה', party: 'מפלגה', campaign: 'קמפיין ובחירות', ministry_special: 'פעולות מיוחדות של המשרד',
};

const ALL: GuideRole[] = ['pm', 'minister', 'defense', 'foreign', 'economy', 'internal', 'leader', 'mk', 'speaker'];
const ANY_MEMBER: GuideRole[] = ['pm', 'minister', 'defense', 'foreign', 'economy', 'internal', 'leader', 'mk'];

/** Which roles can use an action. Exact ids first, then by prefix, then by category. */
export function actionRoles(id: string, category: ActionCategory): GuideRole[] {
  if (id.startsWith('speaker_')) return ['speaker'];
  if (id.startsWith('fm_')) return ['foreign', 'pm'];
  if (id.startsWith('eco_')) return ['economy', 'pm'];
  const exact: Record<string, GuideRole[]> = {
    security_operation: ['pm', 'defense'], unit_training: ['pm', 'defense'], refresh_intel: ['pm', 'defense'], diplomacy: ['pm', 'defense'],
    internal_security: ['pm', 'internal'], leave_coalition: ['leader'], no_confidence: ['mk', 'leader', 'speaker'], mutual_support: ['mk', 'leader', 'minister'],
    propose_law: ANY_MEMBER, repeal_law: ANY_MEMBER, push_bill: ANY_MEMBER, soften_bill: ANY_MEMBER, vote_bill: ANY_MEMBER,
    ministry_request_budget: ['minister', 'defense', 'foreign', 'economy', 'internal'],
    give_speech: ALL, press_conference: ALL,
  };
  if (exact[id]) return exact[id];
  switch (category) {
    case 'economy': case 'government': return ['pm'];
    case 'projects': return ['pm', 'minister', 'defense', 'foreign', 'economy', 'internal'];
    case 'ministry': return ['minister', 'defense', 'foreign', 'economy', 'internal', 'pm'];
    case 'media': return ANY_MEMBER;
    case 'career': return ['mk', 'minister', 'leader'];
    case 'party': case 'campaign': return ['leader'];
    case 'parliament': return ANY_MEMBER;
    default: return ANY_MEMBER;
  }
}

/** Features that are not a single action: they are described by hand. */
export const GUIDE_FEATURES: { id: string; icon: string; title: string; desc: string; roles: GuideRole[]; where: string }[] = [
  { id: 'planning_room', icon: '🎖️', title: 'חמ״ל תכנון מבצע', desc: 'בוחרים מטרה, כוח מוביל, יחידות מחפות, מודיעין, הנדסה קרבית וסיוע, שעה וכללי פתיחה באש. רואים סיכוי להצלחה, נפגעים צפויים, אזרחים בצד השני, מחיר בינלאומי ועמדת הקבינט, ומבצעים.', roles: ['pm', 'defense'], where: 'ביטחון ומדיניות ← "לתכנן" בכרטיס החזית' },
  { id: 'saved_plans', icon: '💾', title: 'תוכניות שמורות', desc: 'שומרים תוכנית בלי לבצע אותה, ומבצעים אותה כשהמצב מתאים. הסיכוי מתעדכן לפי המצב הנוכחי. אפשר לשמור גם הצעה של שר הביטחון.', roles: ['pm', 'defense'], where: 'ביטחון ומדיניות ← תוכניות שמורות' },
  { id: 'after_action', icon: '📋', title: 'דוח אחרי פעולה', desc: 'אחרי כל מבצע מתוכנן: שלבי הביצוע, נפגעים לפי יחידה, מטרה שנפגעה, כשלי מודיעין והשלכות ארוכות טווח.', roles: ['pm', 'defense'], where: 'ביטחון ומדיניות ← בראש המסך' },
  { id: 'cabinet_persuade', icon: '🗣️', title: 'שכנוע הקבינט והסברה', desc: 'שיחה אישית עם חבר קבינט (3 הון), תדריך מודיעין לכולם (2 הון), והכנת הסברה שמקטינה את המחיר הבינלאומי (2 הון).', roles: ['pm', 'defense'], where: 'חמ״ל התכנון' },
  { id: 'stocks', icon: '📦', title: 'מלאים ומודיעין', desc: 'מלאי תחמושת מדויקת ויירוטים, ורעננות המודיעין לפי חזית. מלאי נמוך ומודיעין ישן מורידים את סיכויי ההצלחה.', roles: ['pm', 'defense'], where: 'ביטחון ומדיניות ← מלאים ומודיעין' },
  { id: 'strike_proposal', icon: '📥', title: 'הצעת תקיפה משר הביטחון', desc: 'כראש ממשלה, שר הביטחון מביא הצעה מלאה עם דוח: יעד, כוחות, רמת איום, סיכוי, ביטחון מודיעיני, נפגעים ועמדת הקבינט. אפשר לאשר, לדחות או לשמור לתכנון.', roles: ['pm'], where: 'לוח בקרה ← החלטות ממתינות' },
  { id: 'minister_requests', icon: '🙏', title: 'בקשות מהשרים', desc: 'השרים פונים אליך: שר החוץ ושר הכלכלה בהצעות מדיניות וסחר, שרים בבקשה להשיק פרויקט, והשר לביטחון לאומי במבצע משטרתי. התדירות נקבעת בהגדרות.', roles: ['pm'], where: 'לוח בקרה ← החלטות ממתינות; שמירה והגדרות' },
  { id: 'portfolio_choice', icon: '🧩', title: 'חלוקת תיקים בקואליציה', desc: 'כיו״ר מפלגה שמצטרפת לקואליציה, בוחרים מי מהמפלגה מקבל כל תיק: לפי מומחיות, לפי דירוג ברשימה או ידנית.', roles: ['leader'], where: 'הצעות קואליציוניות' },
  { id: 'ministry_filter', icon: '🏛️', title: 'סינון לפי משרד וחיפוש חופשי', desc: 'במסכי הפרויקטים, החוקים, המשרד שלי, הביטחון ולשכות יש שורת משרדים עם "כל המשרדים" ושדה חיפוש חופשי.', roles: ALL, where: 'מסכי הפרויקטים והחוקים' },
];
