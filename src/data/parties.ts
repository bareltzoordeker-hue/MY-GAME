import type { GroupId, Ideology } from '../types/game';

// ============================================================
// The parties running for the 26th Knesset (election 27.10.2026).
// ideology: security = left (-1) .. right (+1)   (political-security axis)
//           economic = socialist (-1) .. liberal / free-market (+1)
//           religion = secular (-1) .. religious (+1)
// seats  = seats of the outgoing (25th) Knesset members now on this list
// poll   = average of the last 10 polls before the game starts (research/01)
// redLines = laws the party will not vote for, even inside a coalition
// Descriptions are neutral and factual.
// ============================================================

export interface PartyDef {
  id: string; name: string; shortName: string; letters: string; color: string;
  ideology: Ideology; description: string; seats: number; poll: number;
  affinity: Partial<Record<GroupId, number>>;
  preferredMinistries: string[];
  favoriteLaws: string[]; hatedLaws: string[]; redLines: string[];
  /** part of the outgoing (transitional) government */
  coalition: boolean;
  /** bloc used by pollsters: 'gov' (outgoing coalition), 'opp', 'arab' */
  bloc: 'gov' | 'opp' | 'arab';
}

export const PARTIES: PartyDef[] = [
  {
    id: 'likud', name: 'הליכוד', shortName: 'הליכוד', letters: 'מחל', color: '#1d4ed8', coalition: true, bloc: 'gov',
    ideology: { security: 0.7, economic: 0.5, religion: 0.2 },
    description: 'מפלגת הימין הגדולה, בראשות בנימין נתניהו. מובילה את הממשלה היוצאת.', seats: 34, poll: 23.2,
    affinity: { right: 3, periphery: 2, elderly: 1.4, religious: 1, settlers: 1, lowIncome: 1, middleClass: 1, retirees: 1.4, selfEmployed: 1.2 },
    preferredMinistries: ['pmo', 'finance', 'defense', 'foreign', 'justice'],
    favoriteLaws: ['judicial_selection', 'override_clause', 'ag_split', 'communications_reform'], hatedLaws: ['oct7_state_commission', 'term_limits'], redLines: ['palestinian_state'],
  },
  {
    id: 'yashar', name: 'ישר!', shortName: 'ישר', letters: 'יש', color: '#0891b2', coalition: false, bloc: 'opp',
    ideology: { security: 0.15, economic: 0.2, religion: -0.2 },
    description: 'מפלגת מרכז בראשות גדי איזנקוט, הרמטכ״ל לשעבר. דגש על ביטחון, ממלכתיות וחינוך.', seats: 2, poll: 21.7,
    affinity: { center: 2, secular: 1.5, reservists: 2.5, middleClass: 1.6, soldiers: 1.2, liberals: 1, employees: 1.2 },
    preferredMinistries: ['defense', 'education', 'finance'],
    favoriteLaws: ['draft_equality', 'oct7_state_commission', 'reservist_benefits'], hatedLaws: ['draft_exemption', 'override_clause'], redLines: ['draft_exemption'],
  },
  {
    id: 'together', name: 'ביחד', shortName: 'ביחד', letters: 'רק', color: '#16a34a', coalition: false, bloc: 'opp',
    ideology: { security: 0.3, economic: 0.5, religion: -0.35 },
    description: 'רשימה משותפת לנפתלי בנט ויאיר לפיד, ראשי הממשלה לשעבר. ימין-מרכז ליברלי.', seats: 25, poll: 11,
    affinity: { secular: 1.6, center: 2, middleClass: 2, highIncome: 1.4, liberals: 2, reservists: 1.4, right: 0.6, employees: 1.2 },
    preferredMinistries: ['pmo', 'finance', 'defense', 'foreign', 'education'],
    favoriteLaws: ['draft_equality', 'term_limits', 'oct7_state_commission', 'tech_tax_relief'], hatedLaws: ['draft_exemption', 'override_clause'], redLines: ['draft_exemption'],
  },
  {
    id: 'democrats', name: 'הדמוקרטים', shortName: 'הדמוקרטים', letters: 'אמת', color: '#dc2626', coalition: false, bloc: 'opp',
    ideology: { security: -0.7, economic: -0.6, religion: -0.8 },
    description: 'איחוד העבודה ומרצ בראשות יאיר גולן. שמאל-מרכז סוציאל-דמוקרטי.', seats: 4, poll: 9.1,
    affinity: { left: 4, secular: 1.6, socialists: 2.5, students: 1.4, publicSector: 1.4, center: 1, liberals: 1.2 },
    preferredMinistries: ['welfare', 'education', 'health', 'environment'],
    favoriteLaws: ['civil_marriage', 'shabbat_transit', 'minimum_wage', 'public_housing', 'oct7_state_commission'], hatedLaws: ['override_clause', 'settlement_sovereignty', 'death_penalty_terror'], redLines: ['override_clause', 'settlement_sovereignty'],
  },
  {
    id: 'shas', name: 'ש״ס', shortName: 'ש״ס', letters: 'שס', color: '#1f2937', coalition: false, bloc: 'gov',
    ideology: { security: 0.5, economic: -0.5, religion: 0.9 },
    description: 'מפלגה חרדית-ספרדית בראשות אריה דרעי. דגש על רווחה, דת ומשפחות.', seats: 11, poll: 8,
    affinity: { haredim: 3, religious: 2, lowIncome: 2, periphery: 1.6, families: 1 },
    preferredMinistries: ['interior', 'welfare', 'religious', 'health', 'housing'],
    favoriteLaws: ['draft_exemption', 'yeshiva_budget', 'rabbinical_courts', 'vat_basics'], hatedLaws: ['draft_equality', 'civil_marriage', 'shabbat_transit'], redLines: ['draft_equality', 'civil_marriage'],
  },
  {
    id: 'utj', name: 'יהדות התורה', shortName: 'יהדות התורה', letters: 'ג', color: '#334155', coalition: false, bloc: 'gov',
    ideology: { security: 0.3, economic: -0.4, religion: 1 },
    description: 'מפלגה חרדית-אשכנזית (דגל התורה ואגודת ישראל). דגש על לימוד תורה ומוסדות החינוך החרדי.', seats: 7, poll: 7.7,
    affinity: { haredim: 7, religious: 0.5, lowIncome: 0.5 },
    preferredMinistries: ['housing', 'interior', 'jerusalem', 'religious'],
    favoriteLaws: ['draft_exemption', 'yeshiva_budget', 'torah_study_basic_law'], hatedLaws: ['draft_equality', 'shabbat_transit', 'civil_marriage', 'core_curriculum'], redLines: ['draft_equality', 'shabbat_transit', 'core_curriculum'],
  },
  {
    id: 'otzma', name: 'עוצמה יהודית', shortName: 'עוצמה יהודית', letters: 'ב', color: '#ea580c', coalition: true, bloc: 'gov',
    ideology: { security: 1, economic: -0.1, religion: 0.6 },
    description: 'מפלגת ימין בראשות איתמר בן גביר. דגש על ביטחון אישי, משילות והתיישבות.', seats: 6, poll: 7.5,
    affinity: { right: 2.5, settlers: 2.5, religious: 1.5, periphery: 1.4, youth: 0.8 },
    preferredMinistries: ['national_security', 'negev_galilee', 'heritage'],
    favoriteLaws: ['death_penalty_terror', 'settlement_sovereignty', 'police_powers'], hatedLaws: ['palestinian_state', 'oct7_state_commission'], redLines: ['palestinian_state', 'land_transfer'],
  },
  {
    id: 'rzp', name: 'הציונות הדתית-זהות', shortName: 'הציונות הדתית', letters: 'ט', color: '#b45309', coalition: true, bloc: 'gov',
    ideology: { security: 0.95, economic: 0.4, religion: 0.75 },
    description: 'רשימה משותפת לבצלאל סמוטריץ׳ ולמשה פייגלין. ציונות דתית, התיישבות וכלכלה חופשית.', seats: 7, poll: 6,
    affinity: { settlers: 6, religious: 3, right: 1.6 },
    preferredMinistries: ['finance', 'settlement', 'defense', 'justice'],
    favoriteLaws: ['settlement_sovereignty', 'judicial_selection', 'override_clause'], hatedLaws: ['palestinian_state', 'shabbat_transit', 'civil_marriage'], redLines: ['palestinian_state', 'land_transfer'],
  },
  {
    id: 'yb', name: 'ישראל ביתנו', shortName: 'ישראל ביתנו', letters: 'ל', color: '#7c3aed', coalition: false, bloc: 'opp',
    ideology: { security: 0.7, economic: 0.4, religion: -0.9 },
    description: 'מפלגת ימין חילונית בראשות אביגדור ליברמן. דגש על גיוס לכולם, ביטחון ועולים.', seats: 7, poll: 8.1,
    affinity: { secular: 2, right: 1.4, olim: 4, retirees: 1.2, periphery: 1 },
    preferredMinistries: ['defense', 'finance', 'national_security', 'aliyah'],
    favoriteLaws: ['draft_equality', 'civil_marriage', 'shabbat_transit', 'death_penalty_terror'], hatedLaws: ['draft_exemption', 'yeshiva_budget'], redLines: ['draft_exemption'],
  },
  {
    id: 'joint', name: 'הרשימה המשותפת', shortName: 'המשותפת', letters: 'ודם', color: '#059669', coalition: false, bloc: 'arab',
    ideology: { security: -1, economic: -0.7, religion: -0.2 },
    description: 'איחוד חד״ש, תע״ל ובל״ד. ייצוג האוכלוסייה הערבית, שוויון ושמאל חברתי.', seats: 5, poll: 7.6,
    affinity: { arabs: 5, left: 1.4, socialists: 1.4, lowIncome: 0.8 },
    preferredMinistries: [],
    favoriteLaws: ['arab_crime_plan', 'arab_local_budget', 'public_housing', 'palestinian_state'], hatedLaws: ['death_penalty_terror', 'settlement_sovereignty', 'nation_state_plus'], redLines: ['settlement_sovereignty'],
  },
  {
    id: 'raam', name: 'רע״ם', shortName: 'רע״ם', letters: 'עם', color: '#15803d', coalition: false, bloc: 'arab',
    ideology: { security: -0.5, economic: -0.3, religion: 0.55 },
    description: 'הרשימה הערבית המאוחדת בראשות מנסור עבאס. שילוב בפוליטיקה ודגש על תקציבים לחברה הערבית.', seats: 5, poll: 5,
    affinity: { arabs: 4, religious: 0.4, lowIncome: 0.8 },
    preferredMinistries: [],
    favoriteLaws: ['arab_crime_plan', 'arab_local_budget', 'negev_recognition'], hatedLaws: ['death_penalty_terror', 'settlement_sovereignty', 'nation_state_plus'], redLines: ['nation_state_plus'],
  },
  {
    id: 'bluewhite', name: 'כחול לבן', shortName: 'כחול לבן', letters: 'כן', color: '#2563eb', coalition: false, bloc: 'opp',
    ideology: { security: 0.25, economic: 0.1, religion: -0.2 },
    description: 'מפלגת מרכז בראשות בני גנץ.', seats: 5, poll: 1.2,
    affinity: { center: 1.4, reservists: 1, middleClass: 1 },
    preferredMinistries: ['defense'],
    favoriteLaws: ['draft_equality', 'reservist_benefits'], hatedLaws: ['override_clause'], redLines: [],
  },
  {
    id: 'reservists', name: 'המילואימניקים והמפלגה הכלכלית', shortName: 'המילואימניקים', letters: 'מ', color: '#4d7c0f', coalition: false, bloc: 'opp',
    ideology: { security: 0.55, economic: 0.6, religion: -0.2 },
    description: 'רשימה משותפת ליועז הנדל ולירון זליכה. דגש על המילואימניקים, שוויון בנטל ושקיפות כלכלית.', seats: 0, poll: 2.5,
    affinity: { reservists: 4, selfEmployed: 1.2, right: 0.6, liberals: 0.8 },
    preferredMinistries: ['defense', 'finance'],
    favoriteLaws: ['draft_equality', 'reservist_benefits'], hatedLaws: ['draft_exemption'], redLines: ['draft_exemption'],
  },
  {
    id: 'amcha', name: 'עמך ישראל', shortName: 'עמך ישראל', letters: 'עי', color: '#a16207', coalition: false, bloc: 'gov',
    ideology: { security: 0.9, economic: 0.2, religion: 0.2 },
    description: 'מפלגת ימין חדשה בראשות עופר וינטר, תת-אלוף במילואים.', seats: 0, poll: 2.6,
    affinity: { right: 1.6, reservists: 1.4, settlers: 1, soldiers: 1 },
    preferredMinistries: ['defense', 'foreign'],
    favoriteLaws: ['death_penalty_terror', 'reservist_benefits', 'settlement_sovereignty'], hatedLaws: ['palestinian_state'], redLines: ['palestinian_state'],
  },
  {
    id: 'noam', name: 'נעם', shortName: 'נעם', letters: 'ני', color: '#78350f', coalition: false, bloc: 'gov',
    ideology: { security: 0.85, economic: -0.1, religion: 0.95 },
    description: 'מפלגה דתית-לאומית שמרנית בראשות אבי מעוז.', seats: 1, poll: 0.4,
    affinity: { religious: 1, settlers: 0.6 },
    preferredMinistries: [],
    favoriteLaws: ['rabbinical_courts'], hatedLaws: ['civil_marriage', 'shabbat_transit'], redLines: ['civil_marriage'],
  },
  {
    id: 'israel_first', name: 'ישראל ראשונה', shortName: 'ישראל ראשונה', letters: 'ר', color: '#0e7490', coalition: false, bloc: 'gov',
    ideology: { security: 0.75, economic: 0.6, religion: -0.3 },
    description: 'רשימה בראשות שרן השכל, סגנית שר החוץ.', seats: 1, poll: 0.4,
    affinity: { right: 0.6, liberals: 0.6 },
    preferredMinistries: ['foreign'],
    favoriteLaws: ['tech_tax_relief'], hatedLaws: ['palestinian_state'], redLines: ['palestinian_state'],
  },
];

export const PARTY_BY_ID = Object.fromEntries(PARTIES.map((p) => [p.id, p])) as Record<string, PartyDef>;

export const SKINS = ['#f2c9a0', '#e8b48a', '#d49a6a', '#f5d6b8', '#c68642', '#e0ac69'];
export const HAIR_COLORS = ['#1f2937', '#4b3621', '#6b4423', '#9ca3af', '#d1d5db', '#a16207', '#111827'];
export const SUITS = ['#1e293b', '#334155', '#1e3a8a', '#3f3f46', '#7f1d1d', '#14532d', '#44403c'];
