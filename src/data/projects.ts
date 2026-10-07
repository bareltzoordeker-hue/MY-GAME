import type { GroupId, RegionId, ServiceId } from '../types/game';

// National projects, modelled on real plans. Cost in ₪ billions (total), turns = 2-month simulation steps.
export interface ProjectDef {
  id: string; name: string; icon: string; service: ServiceId; region: RegionId;
  cost: number; turns: number; bonus: number; groups: Partial<Record<GroupId, number>>;
  ministry: string; metric?: { key: string; amount: number };
  /** A short factual note shown when the project starts. */
  note?: string;
}

export const PROJECTS: ProjectDef[] = [
  { id: 'metro_gush_dan', name: 'המטרו של גוש דן (שלב א׳)', icon: '🚇', service: 'transport', region: 'center', cost: 40, turns: 30, bonus: 9, groups: { center: 5, employees: 3, youth: 2 }, ministry: 'transport', note: 'הפרויקט התחבורתי הגדול בתולדות המדינה. יימשך שנים ארוכות.', metric: { key: 'railKm', amount: 50 } },
  { id: 'lightrail_purple', name: 'הקו הסגול של הרכבת הקלה', icon: '🚋', service: 'transport', region: 'center', cost: 8, turns: 12, bonus: 4, groups: { center: 3, students: 2 }, ministry: 'transport', note: 'העבודות ישבשו את התנועה בגוש דן עד לסיום.', metric: { key: 'railKm', amount: 27 } },
  { id: 'jerusalem_blue_line', name: 'הקו הכחול של הרכבת הקלה בירושלים', icon: '🚋', service: 'transport', region: 'jerusalem', cost: 6, turns: 12, bonus: 4, groups: { center: 1, students: 2, haredim: 1 }, ministry: 'transport', metric: { key: 'railKm', amount: 23 } },
  { id: 'eilat_rail', name: 'מסילת הרכבת לאילת', icon: '🚄', service: 'transport', region: 'eilat', cost: 18, turns: 20, bonus: 5, groups: { periphery: 4, selfEmployed: 2, left: -1 }, ministry: 'transport', note: 'ארגוני הסביבה מזהירים מפגיעה בשמורות הטבע בערבה.', metric: { key: 'railKm', amount: 260 } },
  { id: 'galil_rail', name: 'הרכבת לקריית שמונה', icon: '🚆', service: 'transport', region: 'north', cost: 12, turns: 16, bonus: 6, groups: { periphery: 5, youth: 2 }, ministry: 'transport', metric: { key: 'railKm', amount: 70 } },
  { id: 'route6_north', name: 'הארכת כביש 6 צפונה', icon: '🛣️', service: 'transport', region: 'north', cost: 7, turns: 8, bonus: 3, groups: { periphery: 3, employees: 2 }, ministry: 'transport', metric: { key: 'roadKm', amount: 40 } },
  { id: 'js_roads', name: 'כבישי עוקף ושדרוג כבישים ביהודה ושומרון', icon: '🛣️', service: 'transport', region: 'judea_samaria', cost: 4, turns: 8, bonus: 2, groups: { settlers: 6, right: 2, left: -3 }, ministry: 'transport', note: 'הפרויקט נתמך בימין ומבוקר בשמאל ובקהילה הבינלאומית.', metric: { key: 'roadKm', amount: 60 } },
  { id: 'negev_hospital', name: 'בית חולים חדש בבאר שבע', icon: '🏥', service: 'health', region: 'negev', cost: 6, turns: 12, bonus: 6, groups: { periphery: 4, elderly: 2, families: 2, arabs: 2 }, ministry: 'health', note: 'האתגר הגדול יהיה לגייס רופאים ואחיות לנגב.', metric: { key: 'beds', amount: 600 } },
  { id: 'er_expansion', name: 'הרחבת חדרי המיון ברחבי הארץ', icon: '🚑', service: 'health', region: 'center', cost: 3, turns: 5, bonus: 4, groups: { elderly: 2, retirees: 2 }, ministry: 'health', metric: { key: 'beds', amount: 300 } },
  { id: 'mental_health', name: 'מרכזי חוסן ובריאות נפש', icon: '🧠', service: 'health', region: 'north', cost: 2, turns: 4, bonus: 3, groups: { reservists: 4, families: 2, periphery: 2 }, ministry: 'health', note: 'מענה לנפגעי טראומה, לוחמים ותושבי קו העימות.' },
  { id: 'classrooms', name: '500 כיתות לימוד חדשות', icon: '🏫', service: 'education', region: 'shfela', cost: 4, turns: 6, bonus: 5, groups: { families: 3 }, ministry: 'education', metric: { key: 'classrooms', amount: 500 } },
  { id: 'galil_university', name: 'אוניברסיטה בקריית שמונה', icon: '🎓', service: 'education', region: 'north', cost: 5, turns: 12, bonus: 4, groups: { students: 6, periphery: 3 }, ministry: 'education', note: 'הכרה במכללת תל-חי כאוניברסיטה והרחבת הקמפוס.' },
  { id: 'arab_schools', name: 'צמצום פערים בחינוך הערבי', icon: '📘', service: 'education', region: 'north', cost: 3, turns: 6, bonus: 3, groups: { arabs: 6, families: 1, left: 1 }, ministry: 'education', metric: { key: 'classrooms', amount: 200 } },
  { id: 'desalination', name: 'מתקן התפלה בגליל המערבי', icon: '💧', service: 'infrastructure', region: 'north', cost: 5, turns: 8, bonus: 7, groups: { periphery: 1, families: 1 }, ministry: 'energy' },
  { id: 'envelope_rebuild', name: 'שיקום יישובי עוטף עזה', icon: '🧱', service: 'infrastructure', region: 'negev', cost: 8, turns: 10, bonus: 5, groups: { periphery: 6, families: 2, reservists: 2 }, ministry: 'negev_galilee', note: 'בנייה מחדש של הבתים, מבני הציבור והמרחבים המוגנים.' },
  { id: 'north_shelters', name: 'מיגון יישובי קו העימות בצפון', icon: '🛡️', service: 'security', region: 'north', cost: 4, turns: 6, bonus: 4, groups: { periphery: 5, families: 3 }, ministry: 'defense' },
  { id: 'solar_arava', name: 'חוות סולאריות בערבה ובנגב', icon: '☀️', service: 'energy', region: 'eilat', cost: 6, turns: 8, bonus: 8, groups: { periphery: 2, left: 2 }, ministry: 'energy', metric: { key: 'renewables', amount: 6 } },
  { id: 'gas_field', name: 'פיתוח מאגר גז ימי חדש', icon: '🛢️', service: 'energy', region: 'haifa', cost: 5, turns: 6, bonus: 6, groups: { highIncome: 2, left: -3 }, ministry: 'energy', note: 'יגדיל את הכנסות המדינה; ארגוני הסביבה מתנגדים.' },
  { id: 'affordable_housing', name: 'דירה בהנחה: 12,000 יחידות', icon: '🏘️', service: 'housing', region: 'sharon', cost: 8, turns: 10, bonus: 7, groups: { youth: 5, families: 3 }, ministry: 'housing', metric: { key: 'units', amount: 12000 } },
  { id: 'periphery_housing', name: 'שכונות חדשות בנגב ובגליל', icon: '🏡', service: 'housing', region: 'negev', cost: 5, turns: 8, bonus: 5, groups: { periphery: 4, families: 2 }, ministry: 'housing', metric: { key: 'units', amount: 8000 } },
  { id: 'jerusalem_housing', name: 'תוכנית דיור לירושלים', icon: '🏢', service: 'housing', region: 'jerusalem', cost: 6, turns: 10, bonus: 5, groups: { haredim: 3, youth: 2, families: 2 }, ministry: 'housing', metric: { key: 'units', amount: 9000 } },
  { id: 'iron_beam', name: 'פריסת מערכת לייזר ליירוט (אור איתן)', icon: '🔦', service: 'security', region: 'north', cost: 5, turns: 6, bonus: 6, groups: { right: 2, periphery: 3, families: 1 }, ministry: 'defense', note: 'יירוט רקטות וכטב״מים בעלות נמוכה מאוד לכל יירוט.' },
  { id: 'cyber_shield', name: 'מגן סייבר לאומי', icon: '🛰️', service: 'security', region: 'center', cost: 3, turns: 6, bonus: 4, groups: { right: 1, highIncome: 1 }, ministry: 'defense' },
  { id: 'police_stations', name: 'תחנות משטרה ביישובים הערביים', icon: '🚓', service: 'security', region: 'north', cost: 2, turns: 4, bonus: 3, groups: { arabs: 4, periphery: 2 }, ministry: 'national_security' },
  { id: 'digital_gov', name: 'ממשל דיגיטלי: שירותים מקוונים', icon: '💻', service: 'govServices', region: 'jerusalem', cost: 1.5, turns: 6, bonus: 7, groups: { selfEmployed: 3, youth: 1 }, ministry: 'interior' },
];
export const PROJECT_BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p])) as Record<string, ProjectDef>;
