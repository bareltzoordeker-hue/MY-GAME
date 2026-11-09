// Operation planning: which forces can lead, cover and support each kind of operation, what the targets are on each front,
// and what the time of day and the rules of engagement change. Game approximations, not operational advice.
import type { FrontId, UnitId } from './security';

export type PlanRole = 'lead' | 'cover' | 'intel' | 'engineering' | 'support';
export const ROLE_LABEL: Record<PlanRole, string> = { lead: 'כוח מוביל', cover: 'כוח מחפה', intel: 'מודיעין', engineering: 'הנדסה קרבית', support: 'סיוע והגנה' };
export const ROLE_HINT: Record<PlanRole, string> = {
  lead: 'היחידה שמבצעת את המשימה. רק יחידות שמתאימות לסוג המבצע מוצעות.',
  cover: 'חיפוי: מעלה את הסיכוי להצלחה ומקטין נפגעים. עד שתי יחידות.',
  intel: 'מודיעין לפני ובזמן המבצע: מעלה את הסיכוי ומפחית טעויות.',
  engineering: 'חבלה והנדסה קרבית: מקטינה נפגעים במבצעים קרקעיים, במיוחד מול מנהרות ומטעני חבלה.',
  support: 'הגנה אווירית ופיקוד העורף: מקטינים את הנזק לעורף מירי בתגובה.',
};

export interface OpPlanSpec { roles: Partial<Record<PlanRole, UnitId[]>>; required: PlanRole[] }
/** The units that may take each role in each kind of operation. A brigade does not lead an air campaign. */
export const OP_PLAN: Record<string, OpPlanSpec> = {
  targeted_strike: { roles: { lead: ['air_force', 'matkal', 'shaldag'], cover: ['air_force', 'u8200', 'navy'], intel: ['u8200', 'shin_bet'] }, required: ['lead'] },
  air_campaign: { roles: { lead: ['air_force'], cover: ['navy', 'u8200'], intel: ['u8200', 'shin_bet'], support: ['air_defense', 'home_front'] }, required: ['lead'] },
  ground_raid: { roles: { lead: ['golani', 'givati', 'paratroopers', 'nahal', 'kfir', 'commando'], cover: ['air_force', 'armor', 'artillery'], intel: ['u8200', 'shin_bet'], engineering: ['engineering'] }, required: ['lead'] },
  wide_ground: { roles: { lead: ['armor', 'golani', 'givati', 'paratroopers', 'nahal'], cover: ['air_force', 'artillery', 'navy'], intel: ['u8200', 'shin_bet'], engineering: ['engineering'], support: ['home_front', 'air_defense'] }, required: ['lead', 'engineering'] },
  special_op: { roles: { lead: ['matkal', 'shayetet', 'shaldag', 'commando'], cover: ['air_force', 'navy'], intel: ['u8200'] }, required: ['lead', 'intel'] },
  naval_blockade: { roles: { lead: ['navy'], cover: ['shayetet', 'air_force'], intel: ['u8200'] }, required: ['lead'] },
  cyber_op: { roles: { lead: ['u8200', 'cyber'], cover: ['cyber'], intel: ['shin_bet'] }, required: ['lead'] },
  arrests: { roles: { lead: ['commando', 'border_police', 'kfir'], cover: ['border_police', 'kfir', 'golani'], intel: ['shin_bet'] }, required: ['lead', 'intel'] },
  iran_strike: { roles: { lead: ['air_force'], cover: ['navy', 'u8200'], intel: ['u8200'], support: ['air_defense', 'home_front'] }, required: ['lead', 'intel', 'support'] },
};

export interface TargetDef {
  id: string; name: string; icon: string;
  /** operations that can hit it */ ops: string[];
  /** multiplier on the threat reduction */ value: number;
  /** risk to civilians, 0..1 */ collateral: number;
  /** baseline intelligence quality, 0..100 */ intel: number;
}
const CYBER: TargetDef = { id: 'cyber_ctrl', name: 'מערכות שליטה ותקשורת', icon: '💻', ops: ['cyber_op'], value: 1, collateral: 0, intel: 70 };
export const FRONT_TARGETS: Record<FrontId, TargetDef[]> = {
  gaza: [
    { id: 'launchers', name: 'משגרי רקטות', icon: '🚀', ops: ['targeted_strike', 'air_campaign', 'ground_raid', 'wide_ground'], value: 1.0, collateral: 0.5, intel: 62 },
    { id: 'tunnels', name: 'מנהרות תקיפה', icon: '🕳️', ops: ['ground_raid', 'wide_ground'], value: 1.3, collateral: 0.3, intel: 55 },
    { id: 'command', name: 'מפקדות ומרכזי שליטה', icon: '🏢', ops: ['targeted_strike', 'air_campaign'], value: 1.1, collateral: 0.6, intel: 68 },
    { id: 'leaders', name: 'בכירי הארגון', icon: '🎯', ops: ['targeted_strike', 'special_op'], value: 1.2, collateral: 0.4, intel: 50 },
    CYBER,
  ],
  lebanon: [
    { id: 'precision', name: 'טילים מדויקים', icon: '🎯', ops: ['targeted_strike', 'air_campaign', 'special_op'], value: 1.3, collateral: 0.3, intel: 60 },
    { id: 'radwan', name: 'כוח רדואן ותשתיות בגבול', icon: '🪖', ops: ['ground_raid', 'wide_ground', 'air_campaign'], value: 1.1, collateral: 0.4, intel: 58 },
    { id: 'supply', name: 'צירי הברחה ואספקה', icon: '🚚', ops: ['targeted_strike', 'air_campaign'], value: 0.9, collateral: 0.2, intel: 66 },
    { id: 'leaders', name: 'בכירי חיזבאללה', icon: '🎯', ops: ['targeted_strike', 'special_op'], value: 1.2, collateral: 0.5, intel: 48 },
    CYBER,
  ],
  iran: [
    { id: 'nuclear', name: 'אתרי גרעין', icon: '☢️', ops: ['iran_strike', 'special_op', 'cyber_op'], value: 1.5, collateral: 0.2, intel: 55 },
    { id: 'missiles', name: 'בסיסי טילים בליסטיים', icon: '🚀', ops: ['iran_strike', 'air_campaign'], value: 1.2, collateral: 0.3, intel: 60 },
    { id: 'scientists', name: 'מדענים ומפקדים', icon: '🎯', ops: ['special_op', 'targeted_strike'], value: 1.0, collateral: 0.3, intel: 45 },
    CYBER,
  ],
  yemen: [
    { id: 'ports', name: 'נמלים ותשתיות שיט', icon: '⚓', ops: ['naval_blockade', 'air_campaign'], value: 1.1, collateral: 0.3, intel: 64 },
    { id: 'launchers', name: 'משגרי טילים וכטב״מים', icon: '🚀', ops: ['air_campaign', 'targeted_strike'], value: 1.0, collateral: 0.3, intel: 58 },
    { id: 'leaders', name: 'בכירי החות׳ים', icon: '🎯', ops: ['targeted_strike', 'special_op'], value: 1.1, collateral: 0.4, intel: 46 },
    CYBER,
  ],
  judea_samaria: [
    { id: 'cells', name: 'חוליות טרור', icon: '🕵️', ops: ['arrests', 'ground_raid', 'targeted_strike'], value: 1.1, collateral: 0.3, intel: 72 },
    { id: 'workshops', name: 'מעבדות נשק', icon: '🔧', ops: ['arrests', 'ground_raid'], value: 1.0, collateral: 0.2, intel: 68 },
    { id: 'leaders', name: 'מפקדים מקומיים', icon: '🎯', ops: ['arrests', 'targeted_strike', 'special_op'], value: 1.2, collateral: 0.3, intel: 60 },
  ],
  syria: [
    { id: 'transfers', name: 'העברות נשק', icon: '🚚', ops: ['targeted_strike', 'air_campaign'], value: 1.0, collateral: 0.2, intel: 63 },
    { id: 'proxies', name: 'שלוחות איראניות', icon: '🪖', ops: ['targeted_strike', 'ground_raid', 'special_op'], value: 1.1, collateral: 0.3, intel: 52 },
    CYBER,
  ],
};

export type TimeId = 'dawn' | 'day' | 'dusk' | 'night';
export const TIMES: Record<TimeId, { label: string; icon: string; surprise: number; civ: number; own: number; air: number; hint: string }> = {
  dawn: { label: 'שחר', icon: '🌅', surprise: 0.08, civ: 0.85, own: 1.0, air: 0, hint: 'הפתעה גבוהה ופחות אזרחים ברחוב.' },
  day: { label: 'יום', icon: '☀️', surprise: -0.04, civ: 1.25, own: 0.9, air: 0.03, hint: 'תמיכה אווירית מדויקת, אבל יותר אזרחים וקשה להפתיע.' },
  dusk: { label: 'בין ערביים', icon: '🌇', surprise: 0.02, civ: 1.0, own: 1.0, air: 0, hint: 'איזון בין ההפתעה לתמיכה אווירית.' },
  night: { label: 'לילה', icon: '🌙', surprise: 0.06, civ: 0.7, own: 1.15, air: -0.02, hint: 'הפתעה ומעט אזרחים, אבל ראות נמוכה ויותר סכנה ללוחמים.' },
};
export type RoeId = 'cautious' | 'balanced' | 'maximum';
export const ROE: Record<RoeId, { label: string; effect: number; civ: number; intl: number; success: number; hint: string }> = {
  cautious: { label: 'זהירות מירבית', effect: 0.85, civ: 0.6, intl: 0.8, success: -0.02, hint: 'פחות פגיעה באזרחים ופחות לחץ בינלאומי, אבל תוצאה מוגבלת יותר.' },
  balanced: { label: 'מאוזנת', effect: 1, civ: 1, intl: 1, success: 0, hint: 'ברירת המחדל.' },
  maximum: { label: 'עוצמה מירבית', effect: 1.2, civ: 1.5, intl: 1.4, success: 0.02, hint: 'פגיעה גדולה יותר באויב, במחיר אזרחי ובינלאומי גבוה.' },
};

/** Precision munitions an operation uses up (out of a stock of 100). */
export const PRECISION_USE: Record<string, number> = { targeted_strike: 6, air_campaign: 25, iran_strike: 35, wide_ground: 10, ground_raid: 4, special_op: 3 };
