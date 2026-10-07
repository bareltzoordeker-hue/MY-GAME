import type { CaricatureSpec, Domain } from '../types/game';

// ============================================================
// The real roster: Knesset members (25th Knesset) and the lists
// running for the 26th Knesset (election 27.10.2026).
// Sources: research/01-lists-and-polls.md, research/02-current-knesset-government.md
// rank = place on the party's list for the 26th Knesset (0 = not on the list / not running)
// fame 1..5 = how well-known the person is (drives power & popularity)
// role = current position: ministry id, 'pm', 'speaker', 'deputy:<ministry>'
// Skills are public areas of activity (portfolios held, professional background) – not opinions.
// ============================================================

export interface PersonDef {
  id: string;
  name: string;
  gender: 'm' | 'f';
  party: string;
  rank: number;
  mk?: boolean;
  role?: string;
  fame: 1 | 2 | 3 | 4 | 5;
  domain: Domain;
  skills?: Partial<Record<Domain, number>>;
  look?: Partial<CaricatureSpec>;
  bio?: string;
  /** spelling of the Hebrew name not verified against an official Hebrew source */
  unverified?: boolean;
}

type Extra = Partial<Omit<PersonDef, 'party' | 'rank' | 'name' | 'gender' | 'fame' | 'domain'>>;
const people: PersonDef[] = [];
const P = (party: string, rank: number, name: string, gender: 'm' | 'f', fame: PersonDef['fame'], domain: Domain, extra: Extra = {}) => {
  people.push({ id: extra.id ?? (rank ? `${party}_${rank}` : `${party}_x${people.filter((p) => p.party === party && !p.rank).length + 1}`), name, gender, party, rank, fame, domain, ...extra });
};

// ---------------- הליכוד ----------------
P('likud', 1, 'בנימין נתניהו', 'm', 5, 'foreign', { mk: true, role: 'pm', skills: { foreign: 95, defense: 85, economy: 85, media: 90, finance: 75 }, look: { hair: 'grey', hairColor: '#cfcfcf', mouth: 'smirk', nose: 0.7 }, bio: 'ראש הממשלה ויו״ר הליכוד' });
P('likud', 2, 'אלי כהן', 'm', 4, 'energy', { role: 'energy', skills: { energy: 70, foreign: 70, economy: 65, management: 60 }, look: { hair: 'comb', hairColor: '#2a2a2a' }, bio: 'שר האנרגיה, לשעבר שר החוץ' });
P('likud', 3, 'אמיר אוחנה', 'm', 4, 'law', { mk: true, role: 'speaker', skills: { law: 75, management: 65, defense: 50 }, look: { hair: 'bald', beard: 'stubble', hairColor: '#3a3a3a' }, bio: 'יו״ר הכנסת' });
P('likud', 4, 'יריב לוין', 'm', 4, 'law', { mk: true, role: 'justice', skills: { law: 90, management: 70, interior: 55 }, look: { hair: 'grey', glasses: true }, bio: 'המשנה לראש הממשלה ושר המשפטים' });
P('likud', 5, 'מירי רגב', 'f', 5, 'transport', { role: 'transport', skills: { transport: 75, culture: 65, media: 80 }, look: { hair: 'curly', hairColor: '#2b1a12' }, bio: 'שרת התחבורה' });
P('likud', 6, 'ישראל כ״ץ', 'm', 4, 'defense', { mk: true, role: 'defense', skills: { defense: 65, transport: 80, finance: 65, foreign: 60 }, look: { hair: 'grey', hairColor: '#d4d4d4' }, bio: 'שר הביטחון, לשעבר שר התחבורה והאוצר' });
P('likud', 7, 'גדעון סער', 'm', 4, 'foreign', { role: 'foreign', skills: { foreign: 75, law: 80, education: 70, interior: 65 }, look: { hair: 'grey', hairColor: '#bdbdbd' }, bio: 'שר החוץ' });
P('likud', 8, 'אופיר כץ', 'm', 3, 'management', { mk: true, skills: { management: 70, media: 55 }, look: { hair: 'comb', hairColor: '#2a2a2a' }, bio: 'יו״ר הקואליציה' });
P('likud', 9, 'טליק גואילי', 'f', 3, 'welfare', { skills: { welfare: 55, media: 50 }, look: { hair: 'long', hairColor: '#5a3a22' } });
P('likud', 10, 'יואב קיש', 'm', 4, 'education', { role: 'education', skills: { education: 70, defense: 55, media: 60 }, look: { hair: 'comb', hairColor: '#3b2a1a' }, bio: 'שר החינוך' });
P('likud', 11, 'יעקב ברדוגו', 'm', 4, 'media', { skills: { media: 85, law: 50 }, look: { hair: 'comb', beard: 'stubble', hairColor: '#1f1f1f' }, bio: 'איש תקשורת' });
P('likud', 12, 'מיקי זוהר', 'm', 4, 'culture', { role: 'culture', skills: { culture: 65, management: 60, media: 60 }, look: { hair: 'comb', hairColor: '#1f1f1f' }, bio: 'שר התרבות והספורט' });
P('likud', 13, 'אלמוג כהן', 'm', 3, 'law', { role: 'deputy:pmo', skills: { law: 55, defense: 50 }, look: { hair: 'bald', beard: 'full', hairColor: '#2a2a2a' } });
P('likud', 14, 'עמיחי שיקלי', 'm', 3, 'foreign', { role: 'diaspora', skills: { foreign: 60, media: 60 }, look: { hair: 'comb', beard: 'stubble', hairColor: '#2a2a2a' }, bio: 'שר התפוצות' });
P('likud', 15, 'אלישע מדן', 'm', 1, 'management', { unverified: true });
P('likud', 16, 'דוד פטר', 'm', 1, 'defense', { unverified: true });
P('likud', 17, 'משה סעדה', 'm', 2, 'law', { mk: true, skills: { law: 65 }, look: { hair: 'bald', hairColor: '#333' } });
P('likud', 18, 'חיים כץ', 'm', 3, 'welfare', { skills: { welfare: 65, economy: 55 }, look: { hair: 'grey', glasses: true }, bio: 'לשעבר שר הרווחה והכלכלה' });
P('likud', 19, 'דודי אמסלם', 'm', 4, 'interior', { role: 'regional', skills: { interior: 55, management: 60, media: 65 }, look: { hair: 'bald', hairColor: '#333' }, bio: 'השר לשיתוף פעולה אזורי' });
P('likud', 20, 'אתי עטייה', 'f', 2, 'welfare', { mk: true, skills: { welfare: 55 } });
P('likud', 21, 'בועז ביסמוט', 'm', 3, 'media', { mk: true, skills: { media: 75, defense: 60, foreign: 55 }, look: { hair: 'grey', glasses: true }, bio: 'יו״ר ועדת החוץ והביטחון' });
P('likud', 22, 'דוד ביטן', 'm', 3, 'economy', { mk: true, skills: { economy: 60, management: 60 }, look: { hair: 'bald', hairColor: '#444' } });
P('likud', 23, 'שלמה קרעי', 'm', 4, 'media', { mk: true, role: 'communications', skills: { media: 70, science: 50 }, look: { hair: 'kippah', beard: 'stubble', glasses: true, hairColor: '#2a2a2a' }, bio: 'שר התקשורת' });
P('likud', 24, 'ניר ברקת', 'm', 4, 'economy', { mk: true, role: 'economy', skills: { economy: 80, management: 75, science: 60 }, look: { hair: 'grey', hairColor: '#cfcfcf' }, bio: 'שר הכלכלה, לשעבר ראש עיריית ירושלים' });
P('likud', 25, 'גילה גמליאל', 'f', 3, 'science', { mk: true, role: 'science', skills: { science: 65, management: 55 }, look: { hair: 'long', hairColor: '#3b2a1a' }, bio: 'שרת החדשנות, המדע והטכנולוגיה' });
P('likud', 26, 'אלי גולדשמידט', 'm', 1, 'management', { unverified: true });
P('likud', 27, 'ארז תדמור', 'm', 2, 'media', { skills: { media: 60 } });
P('likud', 28, 'שלמה לרנר', 'm', 1, 'economy', { unverified: true });
P('likud', 29, 'איציק בונצל', 'm', 1, 'interior', { unverified: true });
P('likud', 30, 'משה בנימין פרץ', 'm', 1, 'management', { unverified: true });
P('likud', 31, 'שוקי אוחנה', 'm', 1, 'interior', { unverified: true });
P('likud', 32, 'זאב אלקין', 'm', 3, 'housing', { mk: true, skills: { housing: 70, foreign: 60, management: 70 }, look: { hair: 'comb', glasses: true, beard: 'stubble', hairColor: '#4a4a4a' }, bio: 'שר, לשעבר שר הבינוי והשיכון' });
P('likud', 33, 'עמית הלוי', 'm', 2, 'defense', { mk: true, skills: { defense: 55 } });
P('likud', 34, 'קרן אטיאס-בובליל', 'f', 1, 'welfare', { unverified: true });
P('likud', 35, 'אביחי בוארון', 'm', 2, 'law', { mk: true, skills: { law: 55 }, look: { hair: 'kippah', beard: 'stubble' } });
P('likud', 36, 'אפי נוה', 'm', 2, 'law', { skills: { law: 70 }, bio: 'לשעבר ראש לשכת עורכי הדין' });
P('likud', 37, 'שרון סעדה', 'f', 1, 'welfare', { unverified: true });
P('likud', 38, 'חנוך מילביצקי', 'm', 2, 'law', { mk: true, skills: { law: 55 } });
P('likud', 39, 'נתנאל אוחיון', 'm', 1, 'management', { unverified: true });
P('likud', 40, 'מאי גולן', 'f', 3, 'welfare', { mk: true, role: 'social_equality', skills: { welfare: 55, media: 65 }, look: { hair: 'long', hairColor: '#1f1a17' }, bio: 'השרה לשוויון חברתי ולקידום מעמד האישה' });
P('likud', 0, 'אבי דיכטר', 'm', 3, 'defense', { mk: true, role: 'agriculture', skills: { defense: 80, agriculture: 60, law: 60 }, look: { hair: 'grey', glasses: true }, bio: 'שר החקלאות, לשעבר ראש השב״כ' });
P('likud', 0, 'עידית סילמן', 'f', 3, 'energy', { role: 'environment', skills: { energy: 55, health: 50 }, look: { hair: 'long', hairColor: '#3b2a1a' }, bio: 'השרה להגנת הסביבה' });
P('likud', 0, 'יולי אדלשטיין', 'm', 3, 'defense', { mk: true, skills: { defense: 65, foreign: 65, health: 60 }, look: { hair: 'grey', glasses: true, beard: 'stubble' }, bio: 'לשעבר יו״ר הכנסת' });

// ---------------- ישר! ----------------
P('yashar', 1, 'גדי איזנקוט', 'm', 5, 'defense', { skills: { defense: 95, management: 75, education: 55 }, look: { hair: 'grey', hairColor: '#bdbdbd', brows: 'flat' }, bio: 'לשעבר הרמטכ״ל' });
P('yashar', 2, 'יורם כהן', 'm', 3, 'defense', { skills: { defense: 85, law: 60 }, look: { hair: 'kippah', hairColor: '#9a9a9a', glasses: true }, bio: 'לשעבר ראש השב״כ' });
P('yashar', 3, 'אורית פרקש-הכהן', 'f', 3, 'energy', { mk: true, skills: { energy: 75, economy: 70, law: 65 }, look: { hair: 'long', hairColor: '#4a3020' }, bio: 'לשעבר שרת התיירות והמדע' });
P('yashar', 4, 'עדי אלטשולר', 'f', 3, 'education', { skills: { education: 80, welfare: 70 }, look: { hair: 'long', hairColor: '#6b4423' }, bio: 'יזמית חברתית, כלת פרס ישראל' });
P('yashar', 5, 'מתן כהנא', 'm', 3, 'interior', { skills: { defense: 70, interior: 65 }, look: { hair: 'kippah', hairColor: '#3a3a3a' }, bio: 'לשעבר השר לשירותי דת' });
P('yashar', 6, 'חילי טרופר', 'm', 3, 'education', { mk: true, skills: { education: 75, culture: 70 }, look: { hair: 'comb', beard: 'full', hairColor: '#3b2a1a' }, bio: 'לשעבר שר התרבות והספורט' });
P('yashar', 7, 'שאול מרידור', 'm', 2, 'finance', { skills: { finance: 90, economy: 75 }, look: { glasses: true, hair: 'grey' }, bio: 'לשעבר הממונה על התקציבים באוצר' });
P('yashar', 8, 'תאיר איפרגן', 'f', 1, 'welfare', { unverified: true });
P('yashar', 9, 'אושרת גני גונן', 'f', 1, 'law', { unverified: true });
P('yashar', 10, 'שירה שפירא', 'f', 1, 'education', { unverified: true });
P('yashar', 11, 'ענבר הרוש גיטי', 'f', 1, 'welfare', { unverified: true });
P('yashar', 12, 'אלעזר שטרן', 'm', 3, 'defense', { skills: { defense: 75, education: 60 }, look: { hair: 'kippah', hairColor: '#cfcfcf' }, bio: 'אלוף במילואים, לשעבר שר המודיעין' });
P('yashar', 13, 'כמיל אבו רוקן', 'm', 2, 'defense', { skills: { defense: 70, foreign: 55 }, bio: 'לשעבר מתאם פעולות הממשלה בשטחים' });
P('yashar', 14, 'דבורה שריפיאן בכר', 'f', 1, 'education', { unverified: true });
P('yashar', 15, 'אלכס ריף', 'f', 2, 'welfare', { skills: { welfare: 55, interior: 50 }, bio: 'פעילה חברתית' });
P('yashar', 16, 'ענבר יחזקאלי', 'f', 1, 'education', { unverified: true });
P('yashar', 17, 'רועי פולקמן', 'm', 2, 'housing', { skills: { housing: 60, economy: 60 }, bio: 'לשעבר חבר כנסת' });
P('yashar', 18, 'ישראל זרי', 'm', 1, 'management', { unverified: true });
P('yashar', 19, 'טל אוחנה', 'f', 2, 'interior', { skills: { interior: 60 }, bio: 'ראש מועצה מקומית' });
P('yashar', 20, 'אליסף פרץ', 'm', 1, 'defense', { unverified: true });
P('yashar', 21, 'יפה טבאג׳ה', 'f', 1, 'welfare', { unverified: true });
P('yashar', 22, 'ניר חגבי', 'm', 1, 'economy', { unverified: true });
P('yashar', 23, 'רון ברקאי', 'm', 1, 'management', { unverified: true });
P('yashar', 24, 'שי פישר', 'm', 1, 'economy', { unverified: true });
P('yashar', 25, 'ליאן פולק דוד', 'f', 1, 'education', { unverified: true });
P('yashar', 26, 'רועי כהן', 'm', 2, 'economy', { skills: { economy: 65 }, bio: 'ראש ארגון העצמאים' });
P('yashar', 27, 'זיו רוזן', 'm', 1, 'management', { unverified: true });
P('yashar', 28, 'ג׳וסלין בש', 'f', 1, 'welfare', { unverified: true });
P('yashar', 29, 'אלון פוטרמן', 'm', 1, 'economy', { unverified: true });
P('yashar', 30, 'טלי מולנר', 'f', 1, 'education', { unverified: true });

// ---------------- ביחד ----------------
P('together', 1, 'נפתלי בנט', 'm', 5, 'economy', { skills: { economy: 80, defense: 75, education: 65, science: 70 }, look: { hair: 'kippah', hairColor: '#7a7a7a', mouth: 'smile' }, bio: 'לשעבר ראש הממשלה' });
P('together', 2, 'יאיר לפיד', 'm', 5, 'foreign', { mk: true, skills: { foreign: 80, finance: 65, media: 90 }, look: { hair: 'grey', hairColor: '#cfcfcf' }, bio: 'ראש האופוזיציה, לשעבר ראש הממשלה' });
P('together', 3, 'קרן טרנר', 'f', 2, 'transport', { skills: { transport: 85, finance: 75, management: 70 }, look: { hair: 'long', glasses: true }, bio: 'לשעבר מנכ״לית משרדי האוצר והתחבורה' });
P('together', 4, 'מירב בן ארי', 'f', 2, 'law', { mk: true, skills: { law: 55, welfare: 55 } });
P('together', 5, 'לירן אבישר בן-חורין', 'f', 2, 'media', { skills: { media: 75, management: 70 }, bio: 'לשעבר מנכ״לית משרד התקשורת' });
P('together', 6, 'נעם תיבון', 'm', 3, 'defense', { skills: { defense: 80 }, look: { hair: 'grey' }, bio: 'אלוף במילואים' });
P('together', 7, 'מיכל הירש נגרי', 'f', 1, 'management', { skills: { management: 70, interior: 60 } });
P('together', 8, 'איתן גינזבורג', 'm', 2, 'interior', { mk: true, skills: { interior: 65, management: 65 }, bio: 'לשעבר ראש עירייה' });
P('together', 9, 'מירב כהן', 'f', 3, 'welfare', { mk: true, skills: { welfare: 65, education: 55 }, bio: 'לשעבר השרה לשוויון חברתי' });
P('together', 10, 'יונתן שלו', 'm', 2, 'defense', { skills: { defense: 45 }, look: { hair: 'comb', hairColor: '#3b2a1a' } });
P('together', 11, 'ברוריה נעים ארמן', 'f', 1, 'welfare', { unverified: true });
P('together', 12, 'רם בן ברק', 'm', 3, 'defense', { mk: true, skills: { defense: 85, foreign: 70 }, look: { hair: 'bald', glasses: true }, bio: 'לשעבר המשנה לראש המוסד' });
P('together', 13, 'אמיר סטרוגו', 'm', 1, 'economy', { unverified: true });
P('together', 14, 'נאור שירי', 'm', 2, 'economy', { mk: true, skills: { economy: 55 } });
P('together', 15, 'ניסן זאבי', 'm', 1, 'management', { unverified: true });
P('together', 16, 'ולדימיר בליאק', 'm', 2, 'finance', { mk: true, skills: { finance: 60, economy: 55 } });
P('together', 17, 'אורלי אלידן-הראל', 'f', 1, 'education', { unverified: true });
P('together', 18, 'יוראי להב-הרצנו', 'm', 2, 'housing', { mk: true, skills: { housing: 55 } });
P('together', 19, 'שחר ורון', 'm', 1, 'economy', { unverified: true });
P('together', 20, 'יסמין פרידמן', 'f', 2, 'welfare', { mk: true, skills: { welfare: 50 } });
P('together', 21, 'אסתי אילון קובו', 'f', 1, 'education', { unverified: true });
P('together', 22, 'ג׳רמי סלטן', 'm', 1, 'foreign', { unverified: true });
P('together', 23, 'נטע אטיאס', 'f', 1, 'welfare', { unverified: true });
P('together', 24, 'צבי פלוטניצקי', 'm', 1, 'management', { unverified: true });
P('together', 25, 'משה טור-פז', 'm', 2, 'education', { mk: true, skills: { education: 60 }, look: { hair: 'kippah' } });
P('together', 26, 'אולסיה קנטור', 'f', 1, 'welfare', { unverified: true });
P('together', 27, 'סיימון דוידסון', 'm', 2, 'interior', { mk: true, skills: { interior: 50 } });
P('together', 28, 'מתי גיל', 'm', 1, 'management', { unverified: true });
P('together', 29, 'תומר וינר', 'm', 1, 'economy', { unverified: true });
P('together', 30, 'שלי טל מירון', 'f', 2, 'foreign', { mk: true, skills: { foreign: 55 } });
P('together', 0, 'מאיר כהן', 'm', 3, 'welfare', { mk: true, skills: { welfare: 65, interior: 60 }, look: { hair: 'grey' }, bio: 'לשעבר שר הרווחה' });
P('together', 0, 'קארין אלהרר', 'f', 3, 'energy', { mk: true, skills: { energy: 65, law: 60 }, bio: 'לשעבר שרת האנרגיה' });

// ---------------- הדמוקרטים ----------------
P('democrats', 1, 'יאיר גולן', 'm', 4, 'defense', { skills: { defense: 85, welfare: 50 }, look: { hair: 'bald', hairColor: '#9a9a9a' }, bio: 'יו״ר הדמוקרטים, לשעבר סגן הרמטכ״ל' });
P('democrats', 2, 'נעמה לזימי', 'f', 3, 'welfare', { mk: true, skills: { welfare: 70, economy: 50 }, look: { hair: 'long', hairColor: '#2a1a12' } });
P('democrats', 3, 'גלעד קריב', 'm', 3, 'law', { mk: true, skills: { law: 70, interior: 65 }, look: { hair: 'kippah', beard: 'stubble', glasses: true } });
P('democrats', 4, 'אפרת רייטן', 'f', 2, 'law', { mk: true, skills: { law: 60 } });
P('democrats', 5, 'יאיא פינק', 'm', 2, 'welfare', { skills: { welfare: 50 } });
P('democrats', 6, 'גבי לסקי', 'f', 2, 'law', { skills: { law: 80 }, look: { hair: 'curly', hairColor: '#7a7a7a' }, bio: 'עורכת דין, לשעבר חברת כנסת' });
P('democrats', 7, 'עמרי רונן', 'm', 1, 'management', { unverified: true });
P('democrats', 8, 'מיכל רוזין', 'f', 2, 'welfare', { skills: { welfare: 70 }, bio: 'לשעבר חברת כנסת' });
P('democrats', 9, 'משה רדמן', 'm', 3, 'economy', { skills: { economy: 60, media: 65 }, look: { hair: 'long', beard: 'stubble' } });
P('democrats', 10, 'סומיה בשיר', 'f', 1, 'education', { unverified: true });
P('democrats', 11, 'נמרוד שפר', 'm', 2, 'defense', { skills: { defense: 80 }, bio: 'אלוף במילואים' });
P('democrats', 12, 'מורן זר קצנשטיין', 'f', 2, 'media', { skills: { media: 55 } });
P('democrats', 13, 'אבי דבוש', 'm', 2, 'welfare', { skills: { welfare: 60 } });
P('democrats', 14, 'אמילי מואטי', 'f', 2, 'law', { skills: { law: 55 }, bio: 'לשעבר חברת כנסת' });
P('democrats', 15, 'תומר אביטל', 'm', 1, 'media', { skills: { media: 60 } });
P('democrats', 16, 'נאוה רוזיליו', 'f', 1, 'welfare', { unverified: true });
P('democrats', 17, 'רם שפע', 'm', 2, 'education', { skills: { education: 55 }, bio: 'לשעבר חבר כנסת' });
P('democrats', 18, 'עלי סלאלחה', 'm', 1, 'education', { unverified: true });
P('democrats', 19, 'רתם סיון', 'f', 1, 'welfare', { unverified: true });
P('democrats', 20, 'ערן עציון', 'm', 2, 'foreign', { skills: { foreign: 70 } });
P('democrats', 0, 'מרב מיכאלי', 'f', 3, 'transport', { mk: true, skills: { transport: 65, media: 70 }, look: { hair: 'long', hairColor: '#cfa070' }, bio: 'לשעבר שרת התחבורה' });

// ---------------- ש״ס ----------------
P('shas', 1, 'אריה דרעי', 'm', 5, 'interior', { mk: true, skills: { interior: 90, management: 85, welfare: 60 }, look: { hair: 'kippah', hairColor: '#111', beard: 'stubble', glasses: true }, bio: 'יו״ר ש״ס, לשעבר שר הפנים' });
P('shas', 2, 'ינון אזולאי', 'm', 2, 'welfare', { mk: true, skills: { welfare: 55 }, look: { hair: 'kippah', beard: 'full', hairColor: '#111' } });
P('shas', 3, 'מיכאל מלכיאלי', 'm', 3, 'interior', { mk: true, skills: { interior: 65 }, look: { hair: 'kippah', beard: 'full', hairColor: '#111' }, bio: 'לשעבר השר לשירותי דת' });
P('shas', 4, 'יואב בן-צור', 'm', 3, 'welfare', { mk: true, skills: { welfare: 70 }, look: { hair: 'kippah', beard: 'full', hairColor: '#222' }, bio: 'לשעבר שר הרווחה' });
P('shas', 5, 'חיים ביטון', 'm', 2, 'education', { mk: true, skills: { education: 60 }, look: { hair: 'kippah', beard: 'full', glasses: true, hairColor: '#111' } });
P('shas', 6, 'דרור עמוס', 'm', 1, 'interior', { unverified: true, look: { hair: 'kippah', beard: 'full' } });
P('shas', 7, 'משה אבוטבול', 'm', 2, 'interior', { mk: true, skills: { interior: 60 }, look: { hair: 'kippah', beard: 'full', hairColor: '#222' }, bio: 'לשעבר ראש עירייה' });
P('shas', 8, 'אוריאל בוסו', 'm', 3, 'health', { mk: true, skills: { health: 65 }, look: { hair: 'kippah', beard: 'full', hairColor: '#111' }, bio: 'לשעבר שר הבריאות' });
P('shas', 9, 'יוסי טייב', 'm', 2, 'welfare', { mk: true, skills: { welfare: 50 }, look: { hair: 'kippah', beard: 'full' } });
P('shas', 10, 'יונתן מישרקי', 'm', 2, 'interior', { mk: true, look: { hair: 'kippah', beard: 'full' } });
P('shas', 11, 'יוסף אלנתנוב', 'm', 1, 'welfare', { unverified: true, look: { hair: 'kippah', beard: 'full' } });
P('shas', 12, 'ארז מלול', 'm', 2, 'interior', { mk: true, look: { hair: 'kippah', beard: 'full' } });

// ---------------- יהדות התורה ----------------
const hat = { hair: 'hat', beard: 'long', hairColor: '#2a2a2a' } as const;
P('utj', 1, 'יעקב אשר', 'm', 3, 'interior', { mk: true, skills: { interior: 65 }, look: { ...hat, glasses: true }, bio: 'יו״ר רשימת יהדות התורה' });
P('utj', 2, 'יצחק גולדקנופף', 'm', 4, 'housing', { mk: true, skills: { housing: 60 }, look: { ...hat, hairColor: '#9a9a9a' }, bio: 'לשעבר שר הבינוי והשיכון' });
P('utj', 3, 'יצחק פינדרוס', 'm', 2, 'finance', { mk: true, skills: { finance: 55 }, look: { ...hat, glasses: true } });
P('utj', 4, 'מאיר פרוש', 'm', 3, 'interior', { mk: true, skills: { interior: 60 }, look: { ...hat, hairColor: '#d4d4d4' }, bio: 'לשעבר שר' });
P('utj', 5, 'משה רוזנטל', 'm', 1, 'interior', { unverified: true, look: hat });
P('utj', 6, 'אליקים שטארק', 'm', 1, 'welfare', { unverified: true, look: hat });
P('utj', 7, 'יהודה וייספיש', 'm', 1, 'education', { unverified: true, look: hat });
P('utj', 8, 'יעקב טסלר', 'm', 2, 'welfare', { mk: true, look: hat });
P('utj', 9, 'דוד זלץ', 'm', 1, 'interior', { unverified: true, look: hat });
P('utj', 10, 'דוד אוחנה', 'm', 1, 'welfare', { unverified: true, look: hat });
P('utj', 11, 'משה רוט', 'm', 2, 'welfare', { mk: true, look: hat });
P('utj', 0, 'משה גפני', 'm', 4, 'finance', { mk: true, skills: { finance: 70 }, look: { ...hat, hairColor: '#e0e0e0', glasses: true }, bio: 'לשעבר יו״ר ועדת הכספים' });

// ---------------- עוצמה יהודית ----------------
P('otzma', 1, 'איתמר בן גביר', 'm', 5, 'law', { mk: true, role: 'national_security', skills: { law: 60, media: 80 }, look: { hair: 'kippah', hairColor: '#2a1a12', beard: 'stubble' }, bio: 'השר לביטחון לאומי' });
P('otzma', 2, 'טלי גוטליב', 'f', 3, 'law', { mk: true, skills: { law: 70, media: 70 }, look: { hair: 'long', hairColor: '#e0b060' } });
P('otzma', 3, 'יצחק וסרלאוף', 'm', 2, 'interior', { mk: true, role: 'negev_galilee', skills: { interior: 55 }, look: { hair: 'kippah', beard: 'full' }, bio: 'השר לפיתוח הנגב, הגליל והחוסן הלאומי' });
P('otzma', 4, 'עמיחי אליהו', 'm', 2, 'culture', { mk: true, role: 'heritage', skills: { culture: 50 }, look: { hair: 'kippah', beard: 'full' }, bio: 'שר המורשת' });
P('otzma', 5, 'לימור סון הר-מלך', 'f', 2, 'interior', { mk: true, skills: { interior: 55 }, look: { hair: 'scarf', hairColor: '#3b2a5a' } });
P('otzma', 6, 'יצחק קרויזר', 'm', 2, 'interior', { mk: true, look: { hair: 'kippah', beard: 'full' } });
P('otzma', 7, 'חנמאל דורפמן', 'm', 2, 'management', { skills: { management: 50 }, look: { hair: 'kippah', beard: 'full' } });
P('otzma', 8, 'צחי יצחק אליהו', 'm', 1, 'interior', { unverified: true, look: { hair: 'kippah' } });
P('otzma', 9, 'יוסי גולדנברגר', 'm', 1, 'interior', { unverified: true, look: { hair: 'kippah' } });
P('otzma', 10, 'איתיאל ניימן', 'm', 1, 'interior', { unverified: true, look: { hair: 'kippah' } });
P('otzma', 0, 'צביקה פוגל', 'm', 2, 'defense', { mk: true, skills: { defense: 65 }, look: { hair: 'grey', beard: 'stubble' }, bio: 'תת-אלוף במילואים' });

// ---------------- הציונות הדתית-זהות ----------------
P('rzp', 1, 'בצלאל סמוטריץ׳', 'm', 5, 'finance', { role: 'finance', skills: { finance: 75, interior: 60, law: 55 }, look: { hair: 'kippah', beard: 'full', hairColor: '#3a2a1a' }, bio: 'שר האוצר ושר במשרד הביטחון' });
P('rzp', 2, 'משה פייגלין', 'm', 3, 'economy', { skills: { economy: 60, media: 60 }, look: { hair: 'kippah', beard: 'stubble', hairColor: '#cfcfcf' } });
P('rzp', 3, 'אורית סטרוק', 'f', 3, 'interior', { mk: true, role: 'settlement', skills: { interior: 60 }, look: { hair: 'scarf', hairColor: '#4a4a6a' }, bio: 'השרה להתיישבות ולמשימות לאומיות' });
P('rzp', 4, 'שמחה רוטמן', 'm', 3, 'law', { mk: true, skills: { law: 85 }, look: { hair: 'kippah', beard: 'full', hairColor: '#3a2a1a' }, bio: 'יו״ר ועדת החוקה' });
P('rzp', 5, 'צביקה מור', 'm', 2, 'welfare', { look: { hair: 'kippah', beard: 'full' } });
P('rzp', 6, 'איתמר איתם', 'm', 1, 'defense', { unverified: true, look: { hair: 'kippah' } });
P('rzp', 7, 'צבי סוכות', 'm', 2, 'defense', { mk: true, skills: { defense: 50 }, look: { hair: 'kippah', beard: 'stubble' } });
P('rzp', 8, 'יצחק זאגא', 'm', 1, 'economy', { unverified: true, look: { hair: 'kippah' } });
P('rzp', 9, 'רעות בן חיים', 'f', 1, 'education', { unverified: true, look: { hair: 'scarf' } });
P('rzp', 10, 'עומר פציניאש ולדמן', 'm', 1, 'economy', { unverified: true });
P('rzp', 0, 'אופיר סופר', 'm', 2, 'interior', { mk: true, role: 'aliyah', skills: { interior: 55 }, look: { hair: 'kippah', beard: 'stubble' }, bio: 'שר העלייה והקליטה' });

// ---------------- ישראל ביתנו ----------------
P('yb', 1, 'אביגדור ליברמן', 'm', 5, 'finance', { mk: true, skills: { finance: 80, defense: 80, foreign: 70 }, look: { hair: 'bald', beard: 'full', hairColor: '#9a9a9a', brows: 'flat' }, bio: 'יו״ר ישראל ביתנו, לשעבר שר הביטחון והאוצר' });
P('yb', 2, 'רפי בן שטרית', 'm', 2, 'interior', { skills: { interior: 60 }, bio: 'ראש עירייה' });
P('yb', 3, 'טליה לנקרי', 'f', 1, 'welfare', { unverified: true });
P('yb', 4, 'עודד פורר', 'm', 3, 'agriculture', { mk: true, skills: { agriculture: 70 }, look: { hair: 'comb', glasses: true }, bio: 'לשעבר שר החקלאות' });
P('yb', 5, 'יוליה מלינובסקי', 'f', 2, 'welfare', { mk: true, skills: { welfare: 55 } });
P('yb', 6, 'שרון שרעבי', 'm', 1, 'management', { unverified: true });
P('yb', 7, 'חמד עמאר', 'm', 2, 'finance', { mk: true, skills: { finance: 55 }, bio: 'לשעבר שר במשרד האוצר' });
P('yb', 8, 'יבגני סובה', 'm', 2, 'media', { mk: true, skills: { media: 55 } });
P('yb', 9, 'אלוירה קוליחמן', 'f', 1, 'welfare', { unverified: true });
P('yb', 10, 'דן אילוז', 'm', 2, 'foreign', { mk: true, skills: { foreign: 55 } });
P('yb', 11, 'לילי בן עמי', 'f', 1, 'welfare', { unverified: true });

// ---------------- הרשימה המשותפת ----------------
P('joint', 1, 'יוסף ג׳בארין', 'm', 2, 'law', { skills: { law: 75 }, look: { glasses: true, hair: 'comb' }, bio: 'לשעבר חבר כנסת' });
P('joint', 2, 'אחמד טיבי', 'm', 4, 'health', { mk: true, skills: { health: 60, media: 75 }, look: { hair: 'grey', beard: 'stubble' }, bio: 'רופא, חבר כנסת ותיק' });
P('joint', 3, 'פאתן ג׳טאס', 'f', 1, 'education', { unverified: true });
P('joint', 4, 'בכר עואודה', 'm', 1, 'welfare', { unverified: true });
P('joint', 5, 'עופר כסיף', 'm', 3, 'economy', { mk: true, skills: { economy: 50 }, look: { hair: 'grey', beard: 'full' } });
P('joint', 6, 'יוסף עטאונה', 'm', 2, 'welfare', { skills: { welfare: 50 }, bio: 'לשעבר חבר כנסת' });
P('joint', 7, 'מהא כרכבי-סבאח', 'f', 1, 'education', { unverified: true });
P('joint', 8, 'אחמד דראושה', 'm', 1, 'health', { unverified: true });
P('joint', 9, 'נהאיה ושאחי', 'f', 1, 'welfare', { unverified: true });
P('joint', 10, 'חסן נסאסרה', 'm', 1, 'interior', { unverified: true });
P('joint', 0, 'איימן עודה', 'm', 4, 'welfare', { mk: true, skills: { welfare: 60, media: 70 }, look: { hair: 'comb', beard: 'stubble' }, bio: 'חבר כנסת, לשעבר יו״ר חד״ש' });
P('joint', 0, 'עאידה תומא-סלימאן', 'f', 2, 'welfare', { mk: true, skills: { welfare: 60 } });

// ---------------- רע״ם ----------------
P('raam', 1, 'מנסור עבאס', 'm', 4, 'interior', { mk: true, skills: { interior: 70, welfare: 60 }, look: { hair: 'comb', beard: 'full', hairColor: '#2a2a2a' }, bio: 'יו״ר רע״ם' });
P('raam', 2, 'יואב סגלוביץ׳', 'm', 3, 'law', { skills: { law: 80 }, look: { hair: 'bald' }, bio: 'ניצב במילואים, לשעבר סגן השר לביטחון הפנים' });
P('raam', 3, 'וליד טאהא', 'm', 2, 'interior', { mk: true, skills: { interior: 60 } });
P('raam', 4, 'וליד אלהואשלה', 'm', 2, 'welfare', { mk: true });
P('raam', 5, 'אימאן ח׳טיב-יאסין', 'f', 2, 'welfare', { mk: true, look: { hair: 'scarf' } });
P('raam', 6, 'יאסר חוג׳יראת', 'm', 2, 'interior', { mk: true });
P('raam', 7, 'אברהים אל טורי', 'm', 1, 'welfare', { unverified: true });

// ---------------- כחול לבן ----------------
P('bluewhite', 1, 'בני גנץ', 'm', 5, 'defense', { mk: true, skills: { defense: 90, management: 70 }, look: { hair: 'grey', hairColor: '#cfcfcf' }, bio: 'יו״ר כחול לבן, לשעבר שר הביטחון והרמטכ״ל' });
P('bluewhite', 2, 'פנינה תמנו-שטה', 'f', 3, 'interior', { mk: true, skills: { interior: 60, welfare: 55 }, bio: 'לשעבר שרת העלייה והקליטה' });
P('bluewhite', 3, 'עליזה בלוך', 'f', 2, 'interior', { skills: { interior: 60 }, bio: 'לשעבר ראש עירייה' });
P('bluewhite', 4, 'רועי קונקול', 'm', 1, 'management', { unverified: true });
P('bluewhite', 6, 'אלון שוסטר', 'm', 2, 'agriculture', { mk: true, skills: { agriculture: 60 } });

// ---------------- המילואימניקים והמפלגה הכלכלית ----------------
P('reservists', 1, 'יועז הנדל', 'm', 3, 'defense', { skills: { defense: 70, media: 70 }, look: { hair: 'kippah', beard: 'stubble' }, bio: 'לשעבר שר התקשורת' });
P('reservists', 2, 'ירון זליכה', 'm', 3, 'finance', { skills: { finance: 85, economy: 80 }, look: { hair: 'bald', glasses: true }, bio: 'כלכלן, לשעבר החשב הכללי' });
P('reservists', 3, 'עינת וילף', 'f', 2, 'foreign', { skills: { foreign: 70, education: 60 }, bio: 'לשעבר חברת כנסת' });
P('reservists', 4, 'חביב וליבוביץ׳', 'm', 1, 'economy', { unverified: true });
P('reservists', 5, 'יואב אדומי', 'm', 1, 'defense', { unverified: true });
P('reservists', 6, 'אופיר לנגמן', 'm', 1, 'economy', { unverified: true });

// ---------------- עמך ישראל ----------------
P('amcha', 1, 'עופר וינטר', 'm', 3, 'defense', { skills: { defense: 75 }, look: { hair: 'kippah', beard: 'stubble' }, bio: 'תת-אלוף במילואים' });
P('amcha', 2, 'יוסף חדאד', 'm', 3, 'media', { skills: { media: 80, foreign: 60 } });
P('amcha', 3, 'נטלי שם טוב', 'f', 2, 'media', { skills: { media: 75 } });
P('amcha', 4, 'ערן בן ארי', 'm', 1, 'law', { skills: { law: 65 } });
P('amcha', 5, 'פלר חסן-נחום', 'f', 2, 'foreign', { skills: { foreign: 65 }, bio: 'סגנית ראש עיריית ירושלים' });
P('amcha', 6, 'ללי דרעי', 'f', 2, 'welfare', { skills: { welfare: 50 } });

// ---------------- רשימות קטנות ----------------
P('noam', 1, 'אבי מעוז', 'm', 2, 'interior', { mk: true, skills: { interior: 50 }, look: { hair: 'kippah', beard: 'full', hairColor: '#cfcfcf' } });
P('israel_first', 1, 'שרן השכל', 'f', 3, 'foreign', { mk: true, role: 'deputy:foreign', skills: { foreign: 65, media: 60 }, look: { hair: 'long', hairColor: '#e0c080' }, bio: 'סגנית שר החוץ' });

export const PEOPLE: PersonDef[] = people;
export const PERSON_BY_ID = Object.fromEntries(people.map((p) => [p.id, p])) as Record<string, PersonDef>;
