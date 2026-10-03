import type { BudgetCategory, Difficulty, GroupId, RegionId, ServiceId } from '../types/game';

export const COUNTRY = 'צבריה';
export const PARLIAMENT = 'הכנסטון';
export const SEATS = 120;
export const MAJORITY = 61;
export const THRESHOLD = 3.25;
export const TERM_TURNS = 24; // 4 years

// ---------------- Population groups ----------------
export interface GroupDef { id: GroupId; name: string; emoji: string; share: number; base: number }
export const GROUPS: GroupDef[] = [
  { id: 'youth', name: 'צעירים', emoji: '👨‍🎓', share: 0.22, base: 45 },
  { id: 'elderly', name: 'מבוגרים', emoji: '🧔', share: 0.14, base: 50 },
  { id: 'families', name: 'משפחות', emoji: '👨‍👩‍👧', share: 0.35, base: 48 },
  { id: 'lowIncome', name: 'הכנסה נמוכה', emoji: '🪙', share: 0.25, base: 40 },
  { id: 'middleClass', name: 'מעמד הביניים', emoji: '🏠', share: 0.45, base: 46 },
  { id: 'highIncome', name: 'הכנסה גבוהה', emoji: '💰', share: 0.12, base: 55 },
  { id: 'soldiers', name: 'חיילים', emoji: '🪖', share: 0.06, base: 50 },
  { id: 'reservists', name: 'מילואימניקים', emoji: '🎖️', share: 0.08, base: 42 },
  { id: 'haredim', name: 'חרדים', emoji: '🎩', share: 0.13, base: 55 },
  { id: 'secular', name: 'חילונים', emoji: '🏖️', share: 0.42, base: 42 },
  { id: 'religious', name: 'דתיים', emoji: '🕯️', share: 0.12, base: 52 },
  { id: 'center', name: 'תושבי המרכז', emoji: '🏙️', share: 0.4, base: 44 },
  { id: 'periphery', name: 'תושבי הפריפריה', emoji: '🏘️', share: 0.35, base: 46 },
  { id: 'settlers', name: 'מתיישבי הגבעות', emoji: '⛰️', share: 0.05, base: 55 },
  { id: 'left', name: 'שמאלנים', emoji: '🕊️', share: 0.18, base: 30 },
  { id: 'right', name: 'ימנים', emoji: '🦁', share: 0.35, base: 58 },
  { id: 'selfEmployed', name: 'עצמאים', emoji: '🧾', share: 0.1, base: 42 },
  { id: 'employees', name: 'שכירים', emoji: '👷', share: 0.45, base: 47 },
  { id: 'publicSector', name: 'עובדי ציבור', emoji: '🏛️', share: 0.15, base: 46 },
  { id: 'students', name: 'סטודנטים', emoji: '📚', share: 0.05, base: 42 },
  { id: 'retirees', name: 'גמלאים', emoji: '🧓', share: 0.12, base: 44 },
];
export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<GroupId, GroupDef>;
const shareTotal = GROUPS.reduce((a, g) => a + g.share, 0);
export const groupWeight = (id: GroupId) => GROUP_BY_ID[id].share / shareTotal;

// ---------------- Budget ----------------
export interface CategoryDef { id: BudgetCategory; name: string; icon: string; initial: number; services: ServiceId[] }
export const CATEGORIES: CategoryDef[] = [
  { id: 'defense', name: 'ביטחון', icon: '🛡️', initial: 105, services: ['security'] },
  { id: 'education', name: 'חינוך', icon: '🎓', initial: 90, services: ['education'] },
  { id: 'health', name: 'בריאות', icon: '🏥', initial: 66, services: ['health'] },
  { id: 'welfare', name: 'רווחה וביטוח', icon: '🤝', initial: 90, services: ['welfare'] },
  { id: 'transport', name: 'תחבורה', icon: '🚆', initial: 30, services: ['transport'] },
  { id: 'housing', name: 'דיור', icon: '🏗️', initial: 12, services: ['housing'] },
  { id: 'infrastructure', name: 'תשתיות', icon: '🚧', initial: 20, services: ['infrastructure'] },
  { id: 'police', name: 'משטרה', icon: '🚓', initial: 18, services: ['security'] },
  { id: 'agriculture', name: 'חקלאות', icon: '🌾', initial: 6, services: [] },
  { id: 'energy', name: 'אנרגיה', icon: '⚡', initial: 8, services: ['energy'] },
  { id: 'science', name: 'מדע וחדשנות', icon: '🔬', initial: 10, services: [] },
  { id: 'culture', name: 'תרבות וספורט', icon: '🎭', initial: 5, services: [] },
  { id: 'government', name: 'מנגנון ממשלתי', icon: '🏢', initial: 50, services: ['govServices'] },
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<BudgetCategory, CategoryDef>;

/** Satisfaction change per +10% of a category's allocation (announcement effect). */
export const BUDGET_SENSITIVITY: Record<BudgetCategory, Partial<Record<GroupId, number>>> = {
  defense: { soldiers: 2, reservists: 2.5, right: 2, settlers: 1.5, left: -1.5 },
  education: { families: 2, students: 2, publicSector: 1.5, youth: 1, left: 0.5 },
  health: { elderly: 2, retirees: 2.5, families: 1, lowIncome: 1, publicSector: 1 },
  welfare: { lowIncome: 3, haredim: 2, retirees: 1.5, left: 1, highIncome: -1, right: -0.5 },
  transport: { periphery: 2, youth: 1.5, employees: 1.5, center: 1, students: 1 },
  housing: { youth: 3, families: 2, students: 1.5, lowIncome: 1 },
  infrastructure: { periphery: 1.5, center: 1, selfEmployed: 0.5 },
  police: { elderly: 1, periphery: 1, right: 1, center: 0.5 },
  agriculture: { periphery: 2, settlers: 1 },
  energy: { selfEmployed: 1, families: 0.5 },
  science: { students: 2, highIncome: 1, youth: 0.5 },
  culture: { left: 1.5, secular: 1, center: 1, youth: 0.5 },
  government: { publicSector: 1.5, center: -1, right: -0.5, left: -0.5, selfEmployed: -1 },
};

/** Satisfaction change per +1 percentage point of a tax. */
export const TAX_SENSITIVITY: Record<'incomeTax' | 'vat' | 'corporateTax', Partial<Record<GroupId, number>>> = {
  incomeTax: { highIncome: -3, middleClass: -2.5, employees: -2, selfEmployed: -2, publicSector: -1, youth: -1, lowIncome: -0.5, left: 0.5 },
  vat: { lowIncome: -3, families: -2.5, middleClass: -2, retirees: -2, students: -1.5, youth: -1.5, periphery: -1.5, haredim: -1.5 },
  corporateTax: { highIncome: -2, selfEmployed: -1.5, right: -0.5, left: 1, lowIncome: 0.5 },
};
export const TAX_NAMES = { incomeTax: 'מס הכנסה', vat: 'מע״מ', corporateTax: 'מס חברות' } as const;

// ---------------- Services ----------------
export interface ServiceDef { id: ServiceId; name: string; icon: string; categories: BudgetCategory[]; groups: Partial<Record<GroupId, number>> }
export const SERVICES: ServiceDef[] = [
  { id: 'health', name: 'בריאות', icon: '🏥', categories: ['health'], groups: { elderly: 1, retirees: 1, families: 0.6, lowIncome: 0.6 } },
  { id: 'education', name: 'חינוך', icon: '🎓', categories: ['education'], groups: { families: 1, students: 0.8, youth: 0.5, publicSector: 0.5 } },
  { id: 'transport', name: 'תחבורה', icon: '🚆', categories: ['transport'], groups: { employees: 0.7, youth: 0.7, periphery: 0.7, center: 0.6, students: 0.6 } },
  { id: 'housing', name: 'דיור', icon: '🏗️', categories: ['housing'], groups: { youth: 1, families: 0.7, students: 0.7, lowIncome: 0.5 } },
  { id: 'security', name: 'ביטחון', icon: '🛡️', categories: ['defense', 'police'], groups: { right: 0.8, settlers: 1, reservists: 0.6, soldiers: 0.6, periphery: 0.4, elderly: 0.3 } },
  { id: 'welfare', name: 'רווחה', icon: '🤝', categories: ['welfare'], groups: { lowIncome: 1, retirees: 0.7, haredim: 0.6 } },
  { id: 'infrastructure', name: 'תשתיות', icon: '🚧', categories: ['infrastructure'], groups: { periphery: 0.6, center: 0.3, selfEmployed: 0.3 } },
  { id: 'energy', name: 'אנרגיה', icon: '⚡', categories: ['energy'], groups: { selfEmployed: 0.4, families: 0.3 } },
  { id: 'govServices', name: 'שירותי ממשל', icon: '🏢', categories: ['government'], groups: { selfEmployed: 0.5, publicSector: 0.4 } },
];
export const SERVICE_BY_ID = Object.fromEntries(SERVICES.map((s) => [s.id, s])) as Record<ServiceId, ServiceDef>;

// ---------------- Regions ----------------
export interface RegionDef {
  id: RegionId; name: string; share: number; incomeFactor: number; unempFactor: number; infra: number;
  path: string; labelX: number; labelY: number; blurb: string;
}
// Stylised map in a 300x600 viewBox
export const REGIONS: RegionDef[] = [
  { id: 'north', name: 'הגליל העליון-עליון', share: 0.1, incomeFactor: 0.8, unempFactor: 1.3, infra: 45, path: 'M120,20 L230,15 L240,70 L215,115 L150,120 L120,95 Z', labelX: 180, labelY: 65, blurb: 'נוף מדהים, אוטובוס פעם ביום.' },
  { id: 'haifa', name: 'מפרץ הכרמלון', share: 0.11, incomeFactor: 0.95, unempFactor: 1.05, infra: 58, path: 'M95,95 L120,95 L150,120 L145,175 L95,175 L85,140 Z', labelX: 117, labelY: 140, blurb: 'עיר נמל עם רכבל לשום מקום.' },
  { id: 'sharon', name: 'השרון הירוק', share: 0.12, incomeFactor: 1.15, unempFactor: 0.85, infra: 66, path: 'M85,175 L145,175 L150,225 L80,225 Z', labelX: 115, labelY: 202, blurb: 'וילות, תותים ופקקים.' },
  { id: 'hills', name: 'הגבעות', share: 0.05, incomeFactor: 0.85, unempFactor: 0.9, infra: 40, path: 'M150,120 L215,115 L225,200 L190,260 L150,225 L145,175 Z', labelX: 185, labelY: 185, blurb: 'בכל שבוע גבעה חדשה.' },
  { id: 'center', name: 'בועת המרכז', share: 0.22, incomeFactor: 1.3, unempFactor: 0.75, infra: 72, path: 'M80,225 L150,225 L148,270 L72,275 Z', labelX: 112, labelY: 250, blurb: 'סטארטאפים, חומוס ב-70 שקל.' },
  { id: 'jerusalem', name: 'ירושלמה', share: 0.13, incomeFactor: 0.8, unempFactor: 1.1, infra: 52, path: 'M148,270 L150,225 L190,260 L185,300 L150,305 Z', labelX: 166, labelY: 275, blurb: 'בירה נצחית, חניה זמנית.' },
  { id: 'shfela', name: 'השפלה הנמוכה', share: 0.12, incomeFactor: 0.95, unempFactor: 1, infra: 55, path: 'M72,275 L148,270 L150,305 L140,345 L60,340 Z', labelX: 105, labelY: 308, blurb: 'קניונים בלי סוף.' },
  { id: 'negev', name: 'הנגב הנשכח', share: 0.12, incomeFactor: 0.75, unempFactor: 1.45, infra: 38, path: 'M60,340 L140,345 L150,305 L185,300 L190,380 L165,480 L130,520 L95,430 Z', labelX: 135, labelY: 400, blurb: 'מלא פוטנציאל. כבר 70 שנה.' },
  { id: 'eilat', name: 'אילתיה', share: 0.03, incomeFactor: 0.9, unempFactor: 1.2, infra: 48, path: 'M130,520 L165,480 L160,560 L148,590 L138,560 Z', labelX: 150, labelY: 545, blurb: 'פטור ממע״מ, לא מחום.' },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;

// ---------------- Difficulty ----------------
export interface DifficultyDef {
  id: Difficulty; name: string; desc: string; icon: string;
  eventRate: number; volatility: number; aiAggression: number; loyaltyDrift: number;
  economyBias: number; needFactor: number; startDebt: number; capitalGain: number;
}
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { id: 'easy', name: 'קל', icon: '🍰', desc: 'כלכלה סלחנית, שרים נאמנים, מעט משברים.', eventRate: 0.6, volatility: 0.6, aiAggression: 0.5, loyaltyDrift: 1.2, economyBias: 0.6, needFactor: 0.98, startDebt: 1150, capitalGain: 1.3 },
  normal: { id: 'normal', name: 'רגיל', icon: '⚖️', desc: 'הפוליטיקה כמו שהיא: לא הוגנת, אבל צפויה.', eventRate: 1, volatility: 1, aiAggression: 1, loyaltyDrift: 1, economyBias: 0, needFactor: 1.05, startDebt: 1250, capitalGain: 1 },
  hard: { id: 'hard', name: 'קשה', icon: '🔥', desc: 'גירעון, קואליציה שבירה ותקשורת עוינת.', eventRate: 1.35, volatility: 1.3, aiAggression: 1.4, loyaltyDrift: 0.85, economyBias: -0.5, needFactor: 1.1, startDebt: 1380, capitalGain: 0.85 },
  chaos: { id: 'chaos', name: 'כאוס', icon: '🌪️', desc: 'כל שבוע פרשה, כל שר רוצה להיות ראש ממשלה.', eventRate: 2, volatility: 1.8, aiAggression: 2, loyaltyDrift: 0.7, economyBias: -0.8, needFactor: 1.12, startDebt: 1450, capitalGain: 0.8 },
};

export const OUTLETS = [
  'ידיעות אחרונות-ממש', 'הארץ שלנו', 'ישראל אתמול', 'ערוץ 12.5', 'כאן-ושם', 'מקור קרוב', 'גלובס-שקל', 'וואלה-באמת', 'קבוצת הווטסאפ של השכונה',
];

export const ADVISOR = { name: 'מוטי ספין', title: 'היועץ האסטרטגי' };
