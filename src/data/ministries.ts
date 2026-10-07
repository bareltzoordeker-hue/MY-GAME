import type { BudgetCategory, Domain, ServiceId } from '../types/game';

// ============================================================
// Government ministries (as in the outgoing government, 2026).
// initialParty = party of the current minister; portfolios without a minister are
// held by the prime minister's party (Likud).
// ============================================================

export interface MinistryDef {
  id: string; name: string; icon: string; domain: Domain; services: ServiceId[]; categories: BudgetCategory[];
  deep: boolean; satire?: boolean; initialParty: string; quip: string;
}

const M = (id: string, name: string, icon: string, domain: Domain, services: ServiceId[], categories: BudgetCategory[], deep: boolean, initialParty: string, quip: string): MinistryDef =>
  ({ id, name, icon, domain, services, categories, deep, initialParty, quip });

export const MINISTRIES: MinistryDef[] = [
  M('defense', 'משרד הביטחון', '🛡️', 'defense', ['security'], ['defense'], true, 'likud', 'אחראי על צבא ההגנה לישמעאל, התעשיות הביטחוניות והמילואים.'),
  M('finance', 'משרד האוצר', '💰', 'finance', [], [], true, 'rzp', 'מכין את התקציב, קובע מסים ומפקח על ההוצאה הממשלתית.'),
  M('foreign', 'משרד החוץ', '🌍', 'foreign', [], [], true, 'likud', 'אחראי על יחסי החוץ, השגרירויות וההסברה בעולם.'),
  M('justice', 'משרד המשפטים', '⚖️', 'law', [], [], true, 'likud', 'אחראי על מערכת המשפט, החקיקה הממשלתית והייעוץ המשפטי.'),
  M('national_security', 'המשרד לביטחון לאומי', '🚓', 'law', ['security'], ['police'], true, 'otzma', 'אחראי על המשטרה, שירות בתי הסוהר והכבאות.'),
  M('interior', 'משרד הפנים', '🪪', 'interior', ['govServices'], ['government'], true, 'likud', 'אחראי על הרשויות המקומיות, רשות האוכלוסין והתכנון.'),
  M('health', 'משרד הבריאות', '🏥', 'health', ['health'], ['health'], true, 'likud', 'אחראי על בתי החולים, קופות החולים וסל הבריאות.'),
  M('education', 'משרד החינוך', '🎓', 'education', ['education'], ['education'], true, 'likud', 'אחראי על מערכת החינוך, המורים ותוכניות הלימודים.'),
  M('transport', 'משרד התחבורה', '🚆', 'transport', ['transport'], ['transport'], true, 'likud', 'אחראי על כבישים, רכבות, תחבורה ציבורית ובטיחות בדרכים.'),
  M('economy', 'משרד הכלכלה והתעשייה', '📈', 'economy', [], [], true, 'likud', 'אחראי על התעשייה, המסחר, הייצוא והגנת הצרכן.'),
  M('housing', 'משרד הבינוי והשיכון', '🏗️', 'housing', ['housing'], ['housing'], true, 'likud', 'אחראי על דיור, שכונות חדשות ודיור ציבורי.'),
  M('energy', 'משרד האנרגיה והתשתיות', '⚡', 'energy', ['energy', 'infrastructure'], ['energy', 'infrastructure'], true, 'likud', 'אחראי על החשמל, הגז, המים והתשתיות הלאומיות.'),
  M('welfare', 'משרד הרווחה והביטחון החברתי', '🤝', 'welfare', ['welfare'], ['welfare'], true, 'likud', 'אחראי על שירותי הרווחה, הביטוח הלאומי ואוכלוסיות במצוקה.'),
  M('environment', 'המשרד להגנת הסביבה', '🌿', 'energy', [], [], false, 'likud', 'אחראי על איכות האוויר והמים, פסולת ושמירת טבע.'),
  M('agriculture', 'משרד החקלאות וביטחון המזון', '🌾', 'agriculture', [], ['agriculture'], false, 'likud', 'אחראי על החקלאות, המים לחקלאות וביטחון המזון.'),
  M('communications', 'משרד התקשורת', '📡', 'media', [], [], false, 'likud', 'אחראי על שוק התקשורת, הדואר והשידורים.'),
  M('culture', 'משרד התרבות והספורט', '🎭', 'culture', [], ['culture'], false, 'likud', 'אחראי על מוסדות התרבות, האמנות והספורט.'),
  M('tourism', 'משרד התיירות', '🏨', 'economy', [], [], false, 'likud', 'אחראי על קידום התיירות הנכנסת והפנימית.'),
  M('labor', 'משרד העבודה', '👷', 'welfare', [], [], false, 'likud', 'אחראי על שוק העבודה, הכשרות מקצועיות ומעונות יום.'),
  M('religious', 'המשרד לשירותי דת', '🕍', 'interior', [], [], false, 'likud', 'אחראי על המועצות הדתיות, הרבנות ובתי העלמין.'),
  M('jerusalem', 'המשרד לירושלים ומסורת ישראל', '🏛️', 'interior', [], [], false, 'likud', 'אחראי על פיתוח ירושלים ומורשתה.'),
  M('heritage', 'משרד המורשת', '📜', 'culture', [], [], false, 'otzma', 'אחראי על אתרי מורשת וארכיאולוגיה.'),
  M('negev_galilee', 'המשרד לפיתוח הנגב, הגליל והחוסן הלאומי', '🏜️', 'infrastructure', [], [], false, 'otzma', 'אחראי על פיתוח הפריפריה בצפון ובדרום.'),
  M('aliyah', 'משרד העלייה והקליטה', '✈️', 'interior', [], [], false, 'rzp', 'אחראי על קליטת עולים חדשים.'),
  M('science', 'משרד החדשנות, המדע והטכנולוגיה', '🔬', 'science', [], ['science'], false, 'likud', 'אחראי על מחקר, חלל ותשתיות מדע.'),
  M('regional', 'המשרד לשיתוף פעולה אזורי', '🤲', 'foreign', [], [], false, 'likud', 'אחראי על קשרים כלכליים ואזרחיים עם מדינות האזור.'),
  M('settlement', 'המשרד להתיישבות ולמשימות לאומיות', '🏡', 'interior', [], [], false, 'rzp', 'אחראי על ההתיישבות ועל משימות לאומיות.'),
  M('diaspora', 'המשרד לענייני התפוצות', '🕎', 'foreign', [], [], false, 'likud', 'אחראי על הקשר עם יהדות התפוצות ומאבק באנטישמיות.'),
  M('social_equality', 'המשרד לשוויון חברתי ולקידום מעמד האישה', '⚖️', 'welfare', [], [], false, 'likud', 'אחראי על צמצום פערים וקידום מעמד האישה.'),
  M('intelligence', 'משרד המודיעין', '🛰️', 'defense', [], [], false, 'likud', 'מתאם בין גופי המודיעין ומכין הערכות מדיניות.'),
];

/** Ministries the PM can create (real portfolios that existed in past governments). */
export const NEW_MINISTRY_TEMPLATES: { id: string; name: string; icon: string; domain: Domain; satire?: boolean }[] = [
  { id: 'strategic', name: 'המשרד לעניינים אסטרטגיים', icon: '♟️', domain: 'foreign' },
  { id: 'periphery', name: 'המשרד לפיתוח הפריפריה', icon: '🏘️', domain: 'infrastructure' },
  { id: 'cyber', name: 'המשרד לסייבר ולמערך הדיגיטל', icon: '💻', domain: 'science' },
  { id: 'public_diplomacy', name: 'המשרד להסברה', icon: '📣', domain: 'media' },
  { id: 'national_resilience', name: 'המשרד לחוסן לאומי ולשיקום', icon: '🧱', domain: 'welfare' },
];

export const DOMAIN_NAMES: Record<Domain, string> = {
  economy: 'כלכלה', finance: 'אוצר', defense: 'ביטחון', education: 'חינוך', health: 'בריאות', transport: 'תחבורה',
  law: 'משפט ואכיפה', foreign: 'חוץ', infrastructure: 'תשתיות', management: 'ניהול', welfare: 'רווחה', energy: 'אנרגיה וסביבה',
  agriculture: 'חקלאות', interior: 'פנים', media: 'תקשורת', housing: 'דיור', science: 'מדע', culture: 'תרבות',
};
