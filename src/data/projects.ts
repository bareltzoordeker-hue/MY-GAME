import type { GroupId, RegionId, ServiceId } from '../types/game';

export interface ProjectDef {
  id: string; name: string; icon: string; service: ServiceId; region: RegionId;
  cost: number; turns: number; bonus: number; groups: Partial<Record<GroupId, number>>;
  ministry: string; metric?: { key: string; amount: number }; satire?: string;
}

export const PROJECTS: ProjectDef[] = [
  { id: 'lightrail_negev', name: 'הרכבת הקלה של הנגב (הכבדה)', icon: '🚋', service: 'transport', region: 'negev', cost: 16, turns: 12, bonus: 6, groups: { periphery: 5, students: 2 }, ministry: 'transport', satire: 'הקרון הראשון יצא לדרך. הנוסע הראשון: כבש תועה.', metric: { key: 'railKm', amount: 40 } },
  { id: 'highway_65', name: 'כביש 6.5', icon: '🛣️', service: 'transport', region: 'north', cost: 9, turns: 8, bonus: 4, groups: { periphery: 3, employees: 2 }, ministry: 'transport', satire: 'כביש 6.5: כמו כביש 6, רק עם חצי מהמחלפים וכפליים מהפקקים.', metric: { key: 'roadKm', amount: 60 } },
  { id: 'galil_rail', name: 'רכבת הגליל המהירה (יחסית)', icon: '🚄', service: 'transport', region: 'north', cost: 14, turns: 14, bonus: 6, groups: { periphery: 5, youth: 2 }, ministry: 'transport', satire: 'הרכבת המהירה מגיעה לגליל בשעתיים. האוטובוס – בשעה וחצי.', metric: { key: 'railKm', amount: 90 } },
  { id: 'cablecar', name: 'רכבל ירושלמה', icon: '🚡', service: 'transport', region: 'jerusalem', cost: 2, turns: 6, bonus: 1.5, groups: { center: 1 }, ministry: 'transport', satire: 'מחבר בין שני מקומות שאף אחד לא צריך להגיע אליהם.' },
  { id: 'sea_tunnel', name: 'מנהרה מתחת לים (למה?)', icon: '🌊', service: 'transport', region: 'center', cost: 30, turns: 24, bonus: 3, groups: { center: 2 }, ministry: 'transport', satire: 'מובילה לקפריסין. בערך.' },
  { id: 'negev_hospital', name: 'בית חולים בנגב', icon: '🏥', service: 'health', region: 'negev', cost: 6, turns: 10, bonus: 6, groups: { periphery: 4, elderly: 2, families: 2 }, ministry: 'health', satire: 'בית החולים נבנה. עכשיו רק צריך רופאים שמוכנים לגור בנגב.', metric: { key: 'beds', amount: 600 } },
  { id: 'er_expansion', name: 'הרחבת חדרי מיון ארצית', icon: '🚑', service: 'health', region: 'center', cost: 3, turns: 5, bonus: 4, groups: { elderly: 2, retirees: 2 }, ministry: 'health', satire: 'חדר המיון הורחב. התור, משום מה, גם.', metric: { key: 'beds', amount: 300 } },
  { id: 'classrooms', name: '500 כיתות חדשות', icon: '🏫', service: 'education', region: 'shfela', cost: 4, turns: 6, bonus: 5, groups: { families: 3 }, ministry: 'education', satire: '500 כיתות חדשות. 400 מהן עם מזגן שעובד.', metric: { key: 'classrooms', amount: 500 } },
  { id: 'galil_university', name: 'אוניברסיטה בגליל', icon: '🎓', service: 'education', region: 'north', cost: 7, turns: 12, bonus: 4, groups: { students: 6, periphery: 3 }, ministry: 'education', satire: 'האוניברסיטה נפתחה. הסטודנטים עדיין מעדיפים את תל אביב בגלל הברים.' },
  { id: 'desalination', name: 'מתקן התפלה בחוף הכרמלון', icon: '💧', service: 'infrastructure', region: 'haifa', cost: 5, turns: 8, bonus: 7, groups: { periphery: 1, families: 1 }, ministry: 'infrastructure', satire: 'המים מותפלים, הדגים מתלוננים.' },
  { id: 'smart_city', name: 'עיר חכמה באילתיה', icon: '🏙️', service: 'infrastructure', region: 'eilat', cost: 4, turns: 8, bonus: 3, groups: { youth: 1 }, ministry: 'infrastructure', satire: 'הרמזורים חכמים. הנהגים פחות.' },
  { id: 'solar_farm', name: 'חוות סולארית ענקית בנגב', icon: '☀️', service: 'energy', region: 'negev', cost: 6, turns: 8, bonus: 8, groups: { periphery: 2, left: 2 }, ministry: 'energy', satire: 'החווה הסולארית הענקית נראית מהחלל. גם מהגבעה, מה שמעצבן את המתיישבים.', metric: { key: 'renewables', amount: 6 } },
  { id: 'gas_rig', name: 'אסדת גז חדשה', icon: '🛢️', service: 'energy', region: 'haifa', cost: 5, turns: 6, bonus: 6, groups: { highIncome: 2, left: -3 }, ministry: 'energy', satire: 'האסדה החדשה: מיליארדים לקופה, וצילום אוויר מושלם לפוסטים של השמאל.' },
  { id: 'affordable_housing', name: 'שכונת "דיור בר-השגה (בתיאוריה)"', icon: '🏘️', service: 'housing', region: 'sharon', cost: 8, turns: 10, bonus: 7, groups: { youth: 5, families: 3 }, ministry: 'housing', satire: 'הדירות ״בהישג יד״. של מי – לא כתוב.', metric: { key: 'units', amount: 12000 } },
  { id: 'periphery_housing', name: 'תוכנית "בנה ביתך בפריפריה"', icon: '🏡', service: 'housing', region: 'negev', cost: 5, turns: 8, bonus: 5, groups: { periphery: 4, families: 2 }, ministry: 'housing', satire: '״בנה ביתך בפריפריה״. לבנות – קל. לקבל רישיון – אגדה.', metric: { key: 'units', amount: 8000 } },
  { id: 'cyber_shield', name: 'כיפת סייבר לאומית', icon: '🛰️', service: 'security', region: 'center', cost: 3, turns: 6, bonus: 4, groups: { right: 1, highIncome: 1 }, ministry: 'defense', satire: 'הכיפה מגינה על מערכות המדינה. הסיסמה שלה: 123456.' },
  { id: 'police_stations', name: 'תחנות משטרה בפריפריה', icon: '🚓', service: 'security', region: 'negev', cost: 2, turns: 4, bonus: 3, groups: { periphery: 3, elderly: 1 }, ministry: 'police', satire: 'התחנות החדשות פתוחות 8:00–16:00. פשיעה בבקשה רק בשעות האלה.' },
  { id: 'digital_forms', name: 'ממשל דיגיטלי (טפסים ב-PDF)', icon: '🖨️', service: 'govServices', region: 'jerusalem', cost: 1.5, turns: 6, bonus: 7, groups: { selfEmployed: 3 }, ministry: 'interior', satire: 'הטפסים עכשיו ב-PDF. צריך להדפיס, למלא בעט ולסרוק. התקדמות.' },
];
export const PROJECT_BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p])) as Record<string, ProjectDef>;
