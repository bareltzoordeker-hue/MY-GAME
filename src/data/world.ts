import type { BudgetCategory, Difficulty, GroupId, RegionId, ServiceId } from '../types/game';

// The state is called "ישמעאל" and its parliament "הכנסטון"; everything else mirrors reality.
export const COUNTRY = 'ישמעאל';
export const PARLIAMENT = 'הכנסטון';
export const CENTRAL_BANK = 'בנק ישמעאל';
export const ARMY = 'צבא ההגנה לישמעאל';
export const SEATS = 120;
export const MAJORITY = 61;
export const THRESHOLD = 3.25;
export const TERM_YEARS = 4;
/** normal turn = 4 months; during the 4 months before an election each turn is 2 weeks */
export const TURN_MONTHS = 4;
export const CAMPAIGN_TURN_DAYS = 14;
/** kept for code that still counts in turns of the normal length */
export const TERM_TURNS = 12;

// ---------------- Population groups ----------------
export interface GroupDef { id: GroupId; name: string; emoji: string; share: number; base: number }
export const GROUPS: GroupDef[] = [
  { id: 'youth', name: 'צעירים', emoji: '🧑', share: 0.22, base: 45 },
  { id: 'elderly', name: 'מבוגרים', emoji: '🧓', share: 0.14, base: 50 },
  { id: 'families', name: 'משפחות', emoji: '👪', share: 0.35, base: 48 },
  { id: 'lowIncome', name: 'בעלי הכנסה נמוכה', emoji: '🪙', share: 0.25, base: 40 },
  { id: 'middleClass', name: 'מעמד הביניים', emoji: '🏠', share: 0.45, base: 46 },
  { id: 'highIncome', name: 'בעלי הכנסה גבוהה', emoji: '💼', share: 0.12, base: 55 },
  { id: 'soldiers', name: 'חיילים', emoji: '🪖', share: 0.06, base: 50 },
  { id: 'reservists', name: 'משרתי מילואים', emoji: '🎖️', share: 0.08, base: 40 },
  { id: 'haredim', name: 'חרדים', emoji: '🎩', share: 0.13, base: 52 },
  { id: 'secular', name: 'חילונים', emoji: '🏙️', share: 0.42, base: 42 },
  { id: 'religious', name: 'דתיים', emoji: '🕯️', share: 0.12, base: 52 },
  { id: 'arabs', name: 'ערבים', emoji: '🕌', share: 0.21, base: 35 },
  { id: 'olim', name: 'עולים', emoji: '✈️', share: 0.12, base: 44 },
  { id: 'center', name: 'תושבי המרכז', emoji: '🌆', share: 0.4, base: 44 },
  { id: 'periphery', name: 'תושבי הפריפריה', emoji: '🏘️', share: 0.35, base: 45 },
  { id: 'settlers', name: 'תושבי יהודה ושומרון', emoji: '⛰️', share: 0.05, base: 52 },
  { id: 'left', name: 'שמאלנים', emoji: '◀️', share: 0.18, base: 32 },
  { id: 'right', name: 'ימנים', emoji: '▶️', share: 0.35, base: 54 },
  { id: 'liberals', name: 'ליברלים', emoji: '⚖️', share: 0.15, base: 40 },
  { id: 'socialists', name: 'סוציאליסטים', emoji: '🤝', share: 0.12, base: 36 },
  { id: 'selfEmployed', name: 'עצמאים', emoji: '🧾', share: 0.1, base: 42 },
  { id: 'employees', name: 'שכירים', emoji: '👷', share: 0.45, base: 47 },
  { id: 'publicSector', name: 'עובדי ציבור', emoji: '🏛️', share: 0.15, base: 46 },
  { id: 'students', name: 'סטודנטים', emoji: '📚', share: 0.05, base: 42 },
  { id: 'retirees', name: 'גמלאים', emoji: '👴', share: 0.12, base: 44 },
];
export const GROUP_BY_ID = Object.fromEntries(GROUPS.map((g) => [g.id, g])) as Record<GroupId, GroupDef>;
const shareTotal = GROUPS.reduce((a, g) => a + g.share, 0);
export const groupWeight = (id: GroupId) => GROUP_BY_ID[id].share / shareTotal;

// ---------------- Budget ----------------
export interface CategoryDef { id: BudgetCategory; name: string; icon: string; initial: number; services: ServiceId[] }
export const CATEGORIES: CategoryDef[] = [
  { id: 'defense', name: 'ביטחון', icon: '🛡️', initial: 138, services: ['security'] },
  { id: 'education', name: 'חינוך', icon: '🎓', initial: 96, services: ['education'] },
  { id: 'health', name: 'בריאות', icon: '🏥', initial: 70, services: ['health'] },
  { id: 'welfare', name: 'רווחה וביטוח', icon: '🤝', initial: 112, services: ['welfare'] },
  { id: 'transport', name: 'תחבורה', icon: '🚆', initial: 32, services: ['transport'] },
  { id: 'housing', name: 'דיור', icon: '🏗️', initial: 12, services: ['housing'] },
  { id: 'infrastructure', name: 'תשתיות', icon: '🚧', initial: 20, services: ['infrastructure'] },
  { id: 'police', name: 'משטרה', icon: '🚓', initial: 18, services: ['security'] },
  { id: 'agriculture', name: 'חקלאות', icon: '🌾', initial: 6, services: [] },
  { id: 'energy', name: 'אנרגיה', icon: '⚡', initial: 8, services: ['energy'] },
  { id: 'science', name: 'מדע וחדשנות', icon: '🔬', initial: 10, services: [] },
  { id: 'culture', name: 'תרבות וספורט', icon: '🎭', initial: 5, services: [] },
  { id: 'government', name: 'מנגנון ממשלתי', icon: '🏢', initial: 70, services: ['govServices'] },
];
export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<BudgetCategory, CategoryDef>;

/** Satisfaction change per +10% of a category's allocation (announcement effect). */
export const BUDGET_SENSITIVITY: Record<BudgetCategory, Partial<Record<GroupId, number>>> = {
  defense: { soldiers: 2, reservists: 2.5, right: 2, settlers: 1.5, left: -1.5, liberals: -0.3 },
  education: { families: 2, students: 2, publicSector: 1.5, youth: 1, left: 0.5, arabs: 1, socialists: 1 },
  health: { elderly: 2, retirees: 2.5, families: 1, lowIncome: 1, publicSector: 1, socialists: 1.2, arabs: 0.8 },
  welfare: { lowIncome: 3, haredim: 2, retirees: 1.5, left: 1, highIncome: -1, right: -0.5, socialists: 2.5, arabs: 1.2, liberals: -0.8 },
  transport: { periphery: 2, youth: 1.5, employees: 1.5, center: 1, students: 1 },
  housing: { youth: 3, families: 2, students: 1.5, lowIncome: 1, olim: 1.5, socialists: 1 },
  infrastructure: { periphery: 1.5, center: 1, selfEmployed: 0.5 },
  police: { elderly: 1, periphery: 1, right: 1, center: 0.5, arabs: 1.5 },
  agriculture: { periphery: 2, settlers: 1 },
  energy: { selfEmployed: 1, families: 0.5 },
  science: { students: 2, highIncome: 1, youth: 0.5, liberals: 1.2 },
  culture: { left: 1.5, secular: 1, center: 1, youth: 0.5 },
  government: { publicSector: 1.5, center: -1, right: -0.5, left: -0.5, selfEmployed: -1, liberals: -1.5 },
};

/** Satisfaction change per +1 percentage point of a tax. */
export const TAX_SENSITIVITY: Record<'incomeTax' | 'vat' | 'corporateTax', Partial<Record<GroupId, number>>> = {
  incomeTax: { highIncome: -3, middleClass: -2.5, employees: -2, selfEmployed: -2, publicSector: -1, youth: -1, lowIncome: -0.5, left: 0.5, liberals: -2.5, socialists: 1 },
  vat: { lowIncome: -3, families: -2.5, middleClass: -2, retirees: -2, students: -1.5, youth: -1.5, periphery: -1.5, haredim: -1.5, olim: -1.5, arabs: -1.5, socialists: -1 },
  corporateTax: { highIncome: -2, selfEmployed: -1.5, right: -0.5, left: 1, lowIncome: 0.5, liberals: -2, socialists: 2 },
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
// Schematic map in a 300x600 viewBox (not to scale, no political statement)
export const REGIONS: RegionDef[] = [
  { id: 'north', name: 'הגליל והצפון', share: 0.12, incomeFactor: 0.82, unempFactor: 1.25, infra: 46, path: 'M112,20 L214,8 L236,58 L226,122 L152,126 L120,96 Z', labelX: 175, labelY: 70, blurb: 'הגליל, העמקים ורמת הגולן. סמוך לגבול הצפון.' },
  { id: 'haifa', name: 'חיפה והקריות', share: 0.11, incomeFactor: 0.95, unempFactor: 1.05, infra: 58, path: 'M96,96 L120,96 L152,126 L142,166 L92,166 L86,130 Z', labelX: 117, labelY: 136, blurb: 'מטרופולין הצפון, הנמל והתעשייה.' },
  { id: 'sharon', name: 'השרון', share: 0.12, incomeFactor: 1.15, unempFactor: 0.85, infra: 66, path: 'M80,166 L142,166 L140,206 L74,210 Z', labelX: 108, labelY: 190, blurb: 'ערי השרון והמושבים.' },
  { id: 'center', name: 'גוש דן', share: 0.22, incomeFactor: 1.3, unempFactor: 0.75, infra: 74, path: 'M74,210 L140,206 L137,246 L68,250 Z', labelX: 104, labelY: 230, blurb: 'המרכז הכלכלי. יוקר מחיה ועומסי תנועה.' },
  { id: 'judea_samaria', name: 'יהודה ושומרון', share: 0.05, incomeFactor: 0.85, unempFactor: 0.9, infra: 42, path: 'M142,166 L192,150 L208,202 L202,286 L172,300 L152,282 L147,250 L140,206 Z', labelX: 175, labelY: 220, blurb: 'יישובים ישראליים לצד אוכלוסייה פלסטינית (שטחי A, B, C).' },
  { id: 'jerusalem', name: 'ירושלים', share: 0.12, incomeFactor: 0.82, unempFactor: 1.1, infra: 54, path: 'M137,246 L147,250 L152,282 L172,300 L152,312 L128,292 Z', labelX: 147, labelY: 286, blurb: 'הבירה. אוכלוסייה מגוונת ומורכבת.' },
  { id: 'shfela', name: 'השפלה', share: 0.12, incomeFactor: 0.95, unempFactor: 1, infra: 56, path: 'M68,250 L137,246 L128,292 L120,332 L56,332 Z', labelX: 96, labelY: 290, blurb: 'ערי השפלה והדרום-מרכז.' },
  { id: 'negev', name: 'הנגב', share: 0.11, incomeFactor: 0.74, unempFactor: 1.45, infra: 38, path: 'M56,332 L120,332 L152,312 L178,322 L172,422 L142,502 L122,522 L86,422 Z', labelX: 125, labelY: 405, blurb: 'באר שבע, עוטף עזה, היישובים הבדואיים והעיירות.' },
  { id: 'eilat', name: 'אילת והערבה', share: 0.03, incomeFactor: 0.9, unempFactor: 1.2, infra: 48, path: 'M122,522 L142,502 L172,422 L177,472 L152,562 L140,592 L130,562 Z', labelX: 150, labelY: 535, blurb: 'אילת, הערבה ומושבי החקלאות.' },
];
export const REGION_BY_ID = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<RegionId, RegionDef>;
/** Gaza Strip outline for the map (not an Israeli region) */
export const GAZA_PATH = 'M40,318 L56,332 L62,352 L36,346 Z';

// ---------------- Difficulty ----------------
export interface DifficultyDef {
  id: Difficulty; name: string; desc: string; icon: string;
  eventRate: number; volatility: number; aiAggression: number; loyaltyDrift: number;
  economyBias: number; needFactor: number; startDebt: number; capitalGain: number;
}
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { id: 'easy', name: 'קל', icon: '🟢', desc: 'כלכלה יציבה, שותפים נאמנים ופחות משברים.', eventRate: 0.6, volatility: 0.6, aiAggression: 0.5, loyaltyDrift: 1.2, economyBias: 0.6, needFactor: 0.98, startDebt: 1350, capitalGain: 1.3 },
  normal: { id: 'normal', name: 'רגיל', icon: '🟡', desc: 'מצב פוליטי וכלכלי מאתגר, כמו במציאות.', eventRate: 1, volatility: 1, aiAggression: 1, loyaltyDrift: 1, economyBias: 0, needFactor: 1.05, startDebt: 1450, capitalGain: 1 },
  hard: { id: 'hard', name: 'קשה', icon: '🟠', desc: 'גירעון גבוה, קואליציה שבירה ותקשורת עוינת.', eventRate: 1.35, volatility: 1.3, aiAggression: 1.4, loyaltyDrift: 0.85, economyBias: -0.5, needFactor: 1.1, startDebt: 1550, capitalGain: 0.85 },
  chaos: { id: 'chaos', name: 'קיצוני', icon: '🔴', desc: 'משברים תכופים, יריבים אגרסיביים וכלכלה תנודתית.', eventRate: 2, volatility: 1.8, aiAggression: 2, loyaltyDrift: 0.7, economyBias: -0.8, needFactor: 1.12, startDebt: 1650, capitalGain: 0.8 },
};

/** Generic media types – headlines in the game are never attributed to real outlets. */
export const OUTLETS = ['עיתון יומי', 'מהדורת החדשות', 'אתר חדשות', 'עיתון כלכלי', 'תוכנית אקטואליה', 'רדיו', 'רשתות חברתיות', 'פרשן פוליטי'];

export const ADVISOR = { name: 'היועץ', title: 'היועץ האסטרטגי' };
