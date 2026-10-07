import type { GameState, GroupId } from '../types/game';
import { deficitPct } from '../utils';

export interface PromiseDef {
  id: string;
  text: string;
  icon: string;
  groups: GroupId[];
  momentum: number; // campaign boost
  /** value measured at promise time and at deadline */
  measure: (s: GameState) => number;
  /** kept if measure(now) vs baseline satisfies this */
  kept: (now: number, baseline: number) => boolean;
}

export const PROMISES: PromiseDef[] = [
  { id: 'lower_income_tax', text: 'נוריד את מס ההכנסה ב-2%', icon: '💸', groups: ['middleClass', 'employees', 'highIncome'], momentum: 4, measure: (s) => s.economy.taxes.incomeTax, kept: (n, b) => n <= b - 2 },
  { id: 'lower_vat', text: 'נוריד את המע״מ', icon: '🛒', groups: ['lowIncome', 'families'], momentum: 4, measure: (s) => s.economy.taxes.vat, kept: (n, b) => n <= b - 1 },
  { id: 'education_boost', text: 'נגדיל את תקציב החינוך ב-10%', icon: '🎓', groups: ['families', 'students'], momentum: 3, measure: (s) => s.budget.allocations.education, kept: (n, b) => n >= b * 1.1 },
  { id: 'health_boost', text: 'נקצר את התורים לרופאים', icon: '🏥', groups: ['elderly', 'retirees'], momentum: 3, measure: (s) => s.services.health.quality, kept: (n, b) => n >= b + 6 },
  { id: 'housing', text: 'נוריד את מחירי הדיור לזוגות צעירים', icon: '🏠', groups: ['youth', 'families'], momentum: 5, measure: (s) => s.services.housing.quality, kept: (n, b) => n >= b + 8 },
  { id: 'rail', text: 'נחבר את הפריפריה ברכבת', icon: '🚆', groups: ['periphery'], momentum: 4, measure: (s) => s.services.transport.metrics.railKm ?? 0, kept: (n, b) => n >= b + 40 },
  { id: 'deficit', text: 'נאזן את התקציב (גירעון מתחת ל-2.5%)', icon: '⚖️', groups: ['highIncome', 'center'], momentum: 2, measure: (s) => deficitPct(s), kept: (n) => n < 2.5 },
  { id: 'cut_waste', text: 'נקצץ 10% במנגנון הממשלתי', icon: '✂️', groups: ['selfEmployed', 'center'], momentum: 3, measure: (s) => s.budget.allocations.government, kept: (n, b) => n <= b * 0.9 },
  { id: 'draft_law', text: 'נעביר את חוק השוויון בנטל', icon: '🪖', groups: ['reservists', 'secular'], momentum: 5, measure: (s) => (s.activeLaws.includes('draft_equality') ? 1 : 0), kept: (n) => n === 1 },
  { id: 'daycare', text: 'מעונות יום בחינם', icon: '🧸', groups: ['families', 'youth'], momentum: 5, measure: (s) => (s.activeLaws.includes('free_daycare') ? 1 : 0), kept: (n) => n === 1 },
  { id: 'unemployment', text: 'אבטלה מתחת ל-4%', icon: '👷', groups: ['employees', 'lowIncome'], momentum: 3, measure: (s) => s.economy.unemployment, kept: (n) => n < 4 },
  { id: 'state_commission', text: 'נקים ועדת חקירה ממלכתית לאירועי 7 באוקטובר', icon: '⚖️', groups: ['reservists', 'center', 'left'], momentum: 4, measure: (s) => (s.activeLaws.includes('oct7_state_commission') ? 1 : 0), kept: (n) => n === 1 },
  { id: 'draft_exemption', text: 'נעגן בחוק את מעמד לומדי התורה', icon: '📖', groups: ['haredim'], momentum: 4, measure: (s) => (s.activeLaws.includes('draft_exemption') || s.activeLaws.includes('torah_study_basic_law') ? 1 : 0), kept: (n) => n === 1 },
  { id: 'sovereignty', text: 'נחיל ריבונות ביהודה ושומרון', icon: '🏳️', groups: ['settlers', 'right'], momentum: 4, measure: (s) => (s.activeLaws.includes('settlement_sovereignty') ? 1 : 0), kept: (n) => n === 1 },
  { id: 'arab_crime', text: 'נמגר את הפשיעה בחברה הערבית', icon: '🕊️', groups: ['arabs'], momentum: 3, measure: (s) => (s.activeLaws.includes('arab_crime_plan') ? 1 : 0), kept: (n) => n === 1 },
  { id: 'reservists', text: 'חבילת הטבות למשרתי המילואים', icon: '🎖️', groups: ['reservists', 'soldiers'], momentum: 4, measure: (s) => (s.activeLaws.includes('reservist_benefits') ? 1 : 0), kept: (n) => n === 1 },
  { id: 'civil_marriage', text: 'נאפשר נישואים אזרחיים', icon: '💍', groups: ['secular', 'liberals', 'olim'], momentum: 3, measure: (s) => (s.activeLaws.includes('civil_marriage') ? 1 : 0), kept: (n) => n === 1 },
  { id: 'minimum_wage', text: 'נעלה את שכר המינימום', icon: '💼', groups: ['lowIncome', 'socialists', 'employees'], momentum: 3, measure: (s) => (s.activeLaws.includes('minimum_wage') ? 1 : 0), kept: (n) => n === 1 },
];
export const PROMISE_BY_ID = Object.fromEntries(PROMISES.map((p) => [p.id, p])) as Record<string, PromiseDef>;
