// ============================================================
// Detailed map layers. Schematic, not to scale: the positions only show who is next to whom.
// City values are the regional value of the layer adjusted by a fixed local factor (no separate city simulation).
// ============================================================

export type CityLayer = 'unemployment' | 'income' | 'satisfaction' | 'investment' | 'infrastructure' | 'services';

export interface CityDef {
  id: string; name: string; x: number; y: number; r: number; blurb: string;
  /** multiplier for income and unemployment, additive offset for the other layers */
  mod: Record<CityLayer, number>;
}

const city = (id: string, name: string, x: number, y: number, r: number, mod: Partial<Record<CityLayer, number>>, blurb: string): CityDef =>
  ({ id, name, x, y, r, blurb, mod: { unemployment: 1, income: 1, satisfaction: 0, investment: 0, infrastructure: 0, services: 0, ...mod } });

/** Gush Dan, in a 320x360 viewBox. West = Mediterranean. */
export const GUSH_DAN: CityDef[] = [
  city('herzliya', 'הרצליה', 95, 42, 21, { income: 1.35, unemployment: 0.7, satisfaction: 3, investment: 6, infrastructure: 2, services: 4 }, 'עיר חוף עם הייטק ותעשייה עתירת ידע.'),
  city('ramat_hasharon', 'רמת השרון', 158, 58, 17, { income: 1.3, unemployment: 0.7, satisfaction: 4, investment: 2, infrastructure: 0, services: 5 }, 'פרבר ירוק ויוקרתי יחסית.'),
  city('tel_aviv', 'תל אביב-יפו', 110, 140, 34, { income: 1.45, unemployment: 0.65, satisfaction: 0, investment: 12, infrastructure: 8, services: 6 }, 'המרכז הכלכלי והתרבותי. יוקר מחיה גבוה, עומסי תנועה ותחבורה ציבורית עמוסה.'),
  city('ramat_gan', 'רמת גן', 168, 148, 22, { income: 1.15, unemployment: 0.8, satisfaction: 1, investment: 6, infrastructure: 3, services: 2 }, 'מגדלי משרדים ובורסת היהלומים, לצד שכונות ותיקות.'),
  city('givatayim', 'גבעתיים', 148, 188, 14, { income: 1.2, unemployment: 0.75, satisfaction: 2, investment: 1, infrastructure: 1, services: 3 }, 'עיר קטנה וצפופה בלב הגוש.'),
  city('bnei_brak', 'בני ברק', 208, 112, 20, { income: 0.62, unemployment: 1.35, satisfaction: -3, investment: -8, infrastructure: -5, services: -4 }, 'העיר הצפופה ביותר בישמעאל. אוכלוסייה חרדית צעירה והכנסה ממוצעת נמוכה.'),
  city('petah_tikva', 'פתח תקווה', 256, 90, 26, { income: 1.0, unemployment: 0.95, satisfaction: 0, investment: 3, infrastructure: 1, services: 0 }, 'עיר גדולה במזרח הגוש עם אזורי תעשייה ומרכזי תעסוקה.'),
  city('kiryat_ono', 'קריית אונו', 238, 160, 12, { income: 1.05, unemployment: 0.85, satisfaction: 1, investment: 0, infrastructure: 0, services: 1 }, 'עיר מגורים בצד המזרחי של הגוש.'),
  city('or_yehuda', 'אור יהודה', 222, 205, 12, { income: 0.85, unemployment: 1.1, satisfaction: -1, investment: 1, infrastructure: 1, services: -1 }, 'עיר קטנה ליד כבישי הגישה ואזורי התעשייה.'),
  city('holon', 'חולון', 135, 238, 24, { income: 0.95, unemployment: 1.0, satisfaction: 0, investment: 2, infrastructure: 1, services: 0 }, 'עיר תעשייה וחינוך בצומת כבישים ראשיים.'),
  city('bat_yam', 'בת ים', 86, 270, 20, { income: 0.8, unemployment: 1.2, satisfaction: -2, investment: -3, infrastructure: -2, services: -2 }, 'עיר חוף דרומית. אוכלוסייה מגוונת ושכונות ותיקות הזקוקות להתחדשות.'),
  city('rishon', 'ראשון לציון', 160, 315, 30, { income: 1.05, unemployment: 0.9, satisfaction: 1, investment: 4, infrastructure: 2, services: 1 }, 'העיר הגדולה בדרום הגוש: מגורים, מסחר וצמיחה מהירה.'),
];

/** The Ayalon highway and the light-rail red line, drawn under the cities */
export const GUSH_DAN_ROADS = {
  ayalon: 'M190,24 L186,100 L178,160 L168,215 L162,270 L158,335',
  lightRail: 'M256,90 L208,114 L168,148 L112,142 L110,190 L88,268',
};

/** The Judea and Samaria map (Oslo areas), in a 260x380 viewBox */
export const WEST_BANK_OUTLINE = 'M112,12 L172,8 L214,40 L230,108 L224,190 L238,262 L206,330 L152,368 L104,340 L84,270 L70,190 L78,110 L92,52 Z';

export interface AreaCityDef { id: string; name: string; x: number; y: number; size: number }
/** Palestinian cities around which areas A and B are drawn; `size` is a relative weight */
export const AREA_CITIES: AreaCityDef[] = [
  { id: 'jenin', name: 'ג׳נין', x: 128, y: 48, size: 0.85 },
  { id: 'tulkarm', name: 'טול כרם', x: 86, y: 96, size: 0.7 },
  { id: 'nablus', name: 'שכם', x: 140, y: 108, size: 1.2 },
  { id: 'qalqilya', name: 'קלקיליה', x: 82, y: 152, size: 0.55 },
  { id: 'ramallah', name: 'רמאללה', x: 138, y: 192, size: 1.0 },
  { id: 'jericho', name: 'יריחו', x: 206, y: 214, size: 0.65 },
  { id: 'bethlehem', name: 'בית לחם', x: 136, y: 270, size: 0.65 },
  { id: 'hebron', name: 'חברון', x: 126, y: 322, size: 1.25 },
];
/** Israeli communities in area C, as small markers (schematic) */
export const AREA_C_MARKERS: [number, number][] = [
  [104, 74], [168, 76], [182, 130], [108, 130], [176, 168], [112, 228], [170, 240], [190, 276], [100, 296], [162, 300], [196, 172], [150, 150], [90, 214],
];
