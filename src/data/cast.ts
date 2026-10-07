import { PARTIES } from './parties';
import { PEOPLE } from './people';

// ============================================================
// The cast: the game can be played with the real parties and politicians,
// or with a fictional cast (the satirical names of the first version).
// The fictional cast is a skin over the same data: same structure, same strengths,
// same laws and polls, only the names (and the short descriptions that name real people) change.
// It is applied to the data before a game is created, and restored when the real cast is chosen.
// ============================================================

export type Cast = 'real' | 'fictional';
/** [Hebrew, English, Arabic] */
type L3 = [string, string, string];

interface PartyCast { name: L3; short: L3; letters: L3; desc: L3 }
interface LeaderCast { name: L3; gender?: 'm' | 'f'; quirk: string }

const PARTY_CAST: Record<string, PartyCast> = {
  likud: { name: ['הכיסא', 'The Chair', 'الكرسي'], short: ['הכיסא', 'The Chair', 'الكرسي'], letters: ['כס', 'KS', 'كس'], desc: ['מפלגת השלטון. אידיאולוגיה: להישאר בשלטון. מובילה את הממשלה היוצאת.', 'The ruling party. Ideology: to stay in power. Leads the outgoing government.', 'حزب الحكم. الأيديولوجيا: البقاء في الحكم. يقود الحكومة المنتهية ولايتها.'] },
  yashar: { name: ['יש מחר (כנראה)', 'There Is Tomorrow (Probably)', 'هناك غد (على الأرجح)'], short: ['יש מחר', 'Tomorrow', 'غد'], letters: ['מחר', 'MChR', 'محر'], desc: ['מרכז. מבטיחים שמחר יהיה טוב יותר. כבר 12 שנה.', 'The center. They promise that tomorrow will be better. For 12 years now.', 'الوسط. يعدون بأن الغد سيكون أفضل. منذ 12 سنة.'] },
  together: { name: ['מפלגת האקזיט', 'The Exit Party', 'حزب الإكزيت'], short: ['האקזיט', 'The Exit', 'الإكزيت'], letters: ['אקס', 'AKS', 'أكس'], desc: ['יזמים שרוצים לעשות למדינה Pivot.', 'Entrepreneurs who want to give the country a pivot.', 'رواد أعمال يريدون إجراء "بيفوت" للدولة.'] },
  democrats: { name: ['השמאל המאוחד (בערך)', 'The United Left (Roughly)', 'اليسار الموحد (تقريبًا)'], short: ['השמאל', 'The Left', 'اليسار'], letters: ['שמ', 'SM', 'شم'], desc: ['מאוחדים לגמרי, חוץ מבימי שני וחמישי.', 'Completely united, except on Mondays and Thursdays.', 'موحدون تمامًا، ما عدا أيام الاثنين والخميس.'] },
  shas: { name: ['אחוות הברכה', 'The Blessing Fellowship', 'أخوّة البركة'], short: ['הברכה', 'The Blessing', 'البركة'], letters: ['בר', 'BR', 'بر'], desc: ['מפלגה דתית-מסורתית. כל משרד הוא הזדמנות לברכה.', 'A religious-traditional party. Every ministry is a chance for a blessing.', 'حزب ديني تقليدي. كل وزارة فرصة للبركة.'] },
  utj: { name: ['אגודת הקוגל המאוחדת', 'The United Kugel Association', 'جمعية الكوغل الموحدة'], short: ['הקוגל', 'The Kugel', 'الكوغل'], letters: ['קג', 'KG', 'كغ'], desc: ['כל תקציב הוא סגולה. כל משרד הוא ברכה.', 'Every budget is a charm. Every ministry is a blessing.', 'كل ميزانية سُغولا. كل وزارة بركة.'] },
  otzma: { name: ['הרעם והברק', 'Thunder and Lightning', 'الرعد والبرق'], short: ['הרעם', 'The Thunder', 'الرعد'], letters: ['רב', 'RB', 'رب'], desc: ['מדברת ברמת קול אחת: גבוהה.', 'Speaks at a single volume: high.', 'تتحدث بمستوى صوت واحد: عالٍ.'] },
  rzp: { name: ['הגבעה הלאומית', 'The National Hill', 'التلة القومية'], short: ['הגבעה', 'The Hill', 'التلة'], letters: ['גב', 'GV', 'غب'], desc: ['קמים כל בוקר על גבעה חדשה.', 'They wake up every morning on a new hill.', 'يستيقظون كل صباح على تلة جديدة.'] },
  yb: { name: ['ביתנו הקטן', 'Our Little Home', 'بيتنا الصغير'], short: ['ביתנו', 'Our Home', 'بيتنا'], letters: ['בת', 'BT', 'بت'], desc: ['חילוני, ימני, ובעיקר עצבני.', 'Secular, right-wing, and mostly irritated.', 'علماني ويميني وغاضب في الغالب.'] },
  joint: { name: ['הרשימה המאוחדת (כמעט)', 'The United List (Almost)', 'القائمة الموحدة (تقريبًا)'], short: ['המאוחדת', 'The United List', 'الموحدة'], letters: ['חד', 'CHD', 'حد'], desc: ['רשימה של כמה מפלגות שמסכימות על כמעט הכול.', 'A list of several parties that agree on almost everything.', 'قائمة من عدة أحزاب تتفق على كل شيء تقريبًا.'] },
  raam: { name: ['רשימת הפיוס', 'The Reconciliation List', 'قائمة المصالحة'], short: ['הפיוס', 'Reconciliation', 'المصالحة'], letters: ['פס', 'PS', 'فس'], desc: ['מפלגה שמאמינה בהשפעה מבפנים, גם כשזה לא קל.', 'A party that believes in influence from the inside, even when it is not easy.', 'حزب يؤمن بالتأثير من الداخل، حتى حين لا يكون ذلك سهلًا.'] },
  bluewhite: { name: ['מפלגת הגנרלים בדימוס', 'The Retired Generals Party', 'حزب الجنرالات المتقاعدين'], short: ['הגנרלים', 'The Generals', 'الجنرالات'], letters: ['גד', 'GD', 'جد'], desc: ['מדברים רק בפקודות. גם במסעדה.', 'They speak only in orders. Even in a restaurant.', 'يتحدثون بالأوامر فقط. حتى في المطعم.'] },
  reservists: { name: ['כוח העתודה הכלכלי', 'The Economic Reserve Force', 'قوة الاحتياط الاقتصادية'], short: ['העתודה', 'The Reserve', 'الاحتياط'], letters: ['עת', 'AT', 'عت'], desc: ['משרתי מילואים שמגישים חשבון.', 'Reservists who are presenting the bill.', 'جنود احتياط يقدّمون الحساب.'] },
  amcha: { name: ['מפלגת הגמלאים הזועמים', 'The Angry Pensioners Party', 'حزب المتقاعدين الغاضبين'], short: ['הגמלאים', 'The Pensioners', 'المتقاعدون'], letters: ['גמ', 'GM', 'جم'], desc: ['פנסיה, כבוד, ופקס לכל ישיבה.', 'Pension, dignity, and a fax for every meeting.', 'معاش وكرامة وفاكس لكل جلسة.'] },
  noam: { name: ['השורשים והמסורת', 'Roots and Tradition', 'الجذور والتقاليد'], short: ['השורשים', 'The Roots', 'الجذور'], letters: ['שר', 'SHR', 'شر'], desc: ['שומרים על מה שהיה, כי כך היה.', 'Preserving what was, because that is how it was.', 'يحافظون على ما كان لأنه كان هكذا.'] },
  israel_first: { name: ['המדינה תחילה', 'The State First', 'الدولة أولًا'], short: ['המדינה', 'The State', 'الدولة'], letters: ['מת', 'MT', 'مت'], desc: ['קודם המדינה, אחר כך הכול. אחר כך עוד קצת המדינה.', 'First the state, then everything else. Then a little more state.', 'الدولة أولًا ثم كل شيء. ثم قليلًا من الدولة.'] },
};

const LEADER_CAST: Record<string, LeaderCast> = {
  likud: { name: ['בנצי כסאי', 'Benzi Kisai', 'بنتسي كيساي'], quirk: 'מחזיק בכיסא מאז שהכיסא היה שרפרף.' },
  yashar: { name: ['רוני מחרתיים', 'Roni Mahratayim', 'روني محراتايم'], quirk: 'מבטיח שמחר יהיה טוב יותר. מחר הוא אומר את זה שוב.' },
  together: { name: ['נועם אקזיט', 'Noam Exit', 'نوعام إكزيت'], quirk: 'מציע לעשות למדינה Pivot.' },
  democrats: { name: ['שולה אדומי', 'Shula Adumi', 'شولا أدومي'], gender: 'f', quirk: 'מנהלת את השמאל המאוחד: היא, הוועד והחתול.' },
  shas: { name: ['הרב משה בורקסי', 'Rabbi Moshe Burekasi', 'الحاخام موشيه بوريكاسي'], quirk: 'רואה בכל משרד הזדמנות לברכה.' },
  utj: { name: ['הרב משולם קוגלמן', 'Rabbi Meshulam Kugelman', 'الحاخام مشولام كوغلمان'], quirk: 'רואה בכל סעיף תקציבי סגולה לפרנסה.' },
  otzma: { name: ['איתן רעמי', 'Eitan Ra\'ami', 'إيتان رعمي'], quirk: 'לא מכיר כפתור עוצמה בינוני.' },
  rzp: { name: ['אביתר גבעתי', 'Aviatar Givati', 'أفيتار جفعاتي'], quirk: 'מתעורר כל בוקר על גבעה אחרת.' },
  yb: { name: ['אבי ביתני', 'Avi Beiteni', 'أفي بيتني'], quirk: 'חילוני, ימני, ובעיקר עצבני.' },
  joint: { name: ['סאמי אבו־רמזי', 'Sami Abu-Ramzi', 'سامي أبو رمزي'], quirk: 'מנסה לשמור על שולחן אחד לכל הנוכחים.' },
  raam: { name: ['אחמד אבו־סאלם', 'Ahmad Abu-Salam', 'أحمد أبو سلام'], quirk: 'מאמין שמשפיעים מבפנים.' },
  bluewhite: { name: ['אלוף (מיל.) דני דרגות', 'Maj. Gen. (Res.) Danny Dragot', 'اللواء (احتياط) داني درغوت'], quirk: 'מדבר רק בפקודות, גם במסעדה.' },
  reservists: { name: ['יואב עתודי', 'Yoav Atudi', 'يوآف عتودي'], quirk: 'חוזר מהמילואים ישר לישיבת סיעה.' },
  amcha: { name: ['זלמן ותיקי', 'Zalman Vatiki', 'زلمان فاتيكي'], quirk: 'בן 84. שולח פקסים לכל ישיבת ממשלה.' },
  noam: { name: ['אבי שורשי', 'Avi Shorshi', 'أفي شورشي'], quirk: 'זוכר איך היה פעם, ומקפיד שישאר כך.' },
  israel_first: { name: ['שרית ראשונה', 'Sarit Rishona', 'سارة ريشونا'], gender: 'f', quirk: 'מתחילה כל משפט במילה "קודם".' },
};

const FIRST_M: L3[] = [['אבי', 'Avi', 'أفي'], ['אורי', 'Uri', 'أوري'], ['אלון', 'Alon', 'ألون'], ['אמנון', 'Amnon', 'أمنون'], ['בועז', 'Boaz', 'بوعز'], ['גדעון', 'Gideon', 'جدعون'], ['דורון', 'Doron', 'دورون'], ['הילל', 'Hillel', 'هيلل'], ['זאב', 'Zeev', 'زئيف'], ['חנן', 'Hanan', 'حنان'], ['טל', 'Tal', 'طال'], ['יגאל', 'Yigal', 'يغال'], ['כרמי', 'Carmi', 'كارمي'], ['לירן', 'Liran', 'ليران'], ['מאיר', 'Meir', 'مئير'], ['נחום', 'Nahum', 'ناحوم'], ['סיני', 'Sinai', 'سيناء'], ['עמוס', 'Amos', 'عاموس'], ['פנחס', 'Pinhas', 'بنحاس'], ['צביקה', 'Tzvika', 'تسفيكا'], ['קובי', 'Kobi', 'كوبي'], ['רפי', 'Rafi', 'رافي'], ['שמעון', 'Shimon', 'شمعون'], ['תמיר', 'Tamir', 'تامير']];
const FIRST_F: L3[] = [['אילנה', 'Ilana', 'إيلانا'], ['בתיה', 'Batya', 'بتيا'], ['גלית', 'Galit', 'غاليت'], ['דליה', 'Dalia', 'داليا'], ['הדס', 'Hadas', 'هداس'], ['ורד', 'Vered', 'فيريد'], ['זהבה', 'Zehava', 'زهافا'], ['חגית', 'Hagit', 'حاغيت'], ['טליה', 'Talia', 'تاليا'], ['יעל', 'Yael', 'يعيل'], ['כרמית', 'Carmit', 'كارميت'], ['לילך', 'Lilach', 'ليلاخ'], ['מירב', 'Merav', 'ميراف'], ['נורית', 'Nurit', 'نوريت'], ['סיגל', 'Sigal', 'سيغال'], ['עדנה', 'Edna', 'إدنا'], ['פנינה', 'Pnina', 'بنينا'], ['צפירה', 'Tzfira', 'تسفيرا'], ['קרן', 'Keren', 'كيرين'], ['רונית', 'Ronit', 'رونيت'], ['שירלי', 'Shirley', 'شيرلي'], ['תמר', 'Tamar', 'تمار'], ['אורנה', 'Orna', 'أورنا'], ['רבקה', 'Rivka', 'ريفكا']];
const SURNAMES: L3[] = [['שרפרפי', 'Sharfrafi', 'شرفرفي'], ['ספסלי', 'Sapsali', 'سبسلي'], ['כורסאי', 'Kursai', 'كورساي'], ['מושבי', 'Moshavi', 'موشافي'], ['קוגלי', 'Kugeli', 'كوغلي'], ['חמינסקי', 'Haminski', 'حمينسكي'], ['צ׳ולנטי', 'Cholenti', 'تشولنتي'], ['לוקשני', 'Lokshani', 'لوكشاني'], ['גפילטי', 'Gefilti', 'غفيلتي'], ['סולתי', 'Soleti', 'سولتي'], ['גבעוני', 'Givoni', 'جيفوني'], ['סלעוני', 'Salooni', 'سلعوني'], ['מצוקי', 'Metzuki', 'متسوكي'], ['פלוגתי', 'Plugati', 'بلوغاتي'], ['גדודי', 'Gdudi', 'غدودي'], ['חובלי', 'Hovli', 'حوبلي'], ['אתמולי', 'Etmoli', 'إتمولي'], ['שבועי', 'Shvui', 'شفوعي'], ['דחופי', 'Dachufi', 'دحوفي'], ['פיבוטי', 'Pivoti', 'بيفوتي'], ['אקזיטי', 'Exiti', 'إكزيتي'], ['דאטאי', 'Dataai', 'داتاي'], ['פקסי', 'Faksi', 'فاكسي'], ['גמלאי', 'Gimlai', 'جملائي'], ['פנסיוני', 'Pensioni', 'بنسيوني'], ['תקציבי', 'Taktsivi', 'تقتسيفي'], ['מענקי', 'Maanaki', 'معنكي'], ['ועדתי', 'Vaadati', 'وعداتي'], ['סעיפי', 'Seifi', 'سعيفي'], ['חוקי', 'Hoki', 'حوكي'], ['הצבעי', 'Hatzbai', 'هتسبعي'], ['מליאי', 'Mliai', 'مليائي'], ['סקרי', 'Sikri', 'سكري'], ['מנדטי', 'Mandati', 'مندتي'], ['עודפי', 'Odfi', 'عودفي'], ['קמפיני', 'Kampeini', 'كمبيني'], ['שלטי', 'Shilti', 'شلطي'], ['כרוזי', 'Kruzi', 'كروزي'], ['ראיוני', 'Raayoni', 'رعيوني'], ['כותרתי', 'Koteti', 'كوتيتي'], ['רשתי', 'Reshti', 'رشتي'], ['עיתוני', 'Itoni', 'عيتوني'], ['סמלי', 'Samli', 'سملي'], ['הרי', 'Hari', 'هاري'], ['מסדרוני', 'Misdroni', 'مسدروني'], ['פרוטקציוני', 'Protektsioni', 'بروتكسيوني'], ['מכרזי', 'Michrazi', 'مخرازي'], ['ליגלוגי', 'Ligloogi', 'ليغلوغي'], ['תיקוני', 'Tikuni', 'تيكوني']];
const ARAB_FIRST_M: L3[] = [['סאמי', 'Sami', 'سامي'], ['ג׳מאל', 'Jamal', 'جمال'], ['חאלד', 'Khaled', 'خالد'], ['אחמד', 'Ahmad', 'أحمد'], ['מוראד', 'Murad', 'مراد'], ['עאמר', 'Amer', 'عامر'], ['נאדר', 'Nader', 'نادر'], ['כרים', 'Karim', 'كريم']];
const ARAB_FIRST_F: L3[] = [['לינא', 'Lina', 'لينا'], ['סמירה', 'Samira', 'سميرة'], ['האלה', 'Hala', 'هالة'], ['נאדיה', 'Nadia', 'ناديا'], ['ריהאם', 'Riham', 'ريهام']];
const ARAB_SURNAMES: L3[] = [['אל־נור', 'Al-Nour', 'النور'], ['אל־סאלם', 'Al-Salam', 'السلام'], ['אל־אמין', 'Al-Amin', 'الأمين'], ['אל־חכים', 'Al-Hakim', 'الحكيم'], ['אל־צאדק', 'Al-Sadiq', 'الصادق'], ['אל־פארס', 'Al-Fares', 'الفارس'], ['אל־ג׳מיל', 'Al-Jamil', 'الجميل'], ['אל־רשיד', 'Al-Rashid', 'الرشيد']];

interface Plan { name: L3; gender?: 'm' | 'f'; quirk?: string }

/**
 * Deterministic fictional name for every person in the data (the same person always gets the same name).
 * For the k-th person of a kind: first name k mod F, surname (7k + k div F) mod S. Two different people can only
 * share both when 169 j is a multiple of S, which never happens for the pool sizes used here, so names are unique.
 */
function planNames(): Map<string, Plan> {
  const out = new Map<string, Plan>();
  const count = { m: 0, f: 0, am: 0, af: 0 };
  const pick = (firsts: L3[], lasts: L3[], k: number): L3 => {
    const fi = firsts[k % firsts.length];
    const la = lasts[(7 * k + Math.floor(k / firsts.length)) % lasts.length];
    return [`${fi[0]} ${la[0]}`, `${fi[1]} ${la[1]}`, `${fi[2]} ${la[2]}`];
  };
  for (const p of PEOPLE) {
    const lead = p.rank === 1 ? LEADER_CAST[p.party] : undefined;
    if (lead) { out.set(p.id, { name: lead.name, gender: lead.gender, quirk: lead.quirk }); continue; }
    const arab = p.party === 'joint' || p.party === 'raam';
    const key = arab ? (p.gender === 'f' ? 'af' : 'am') : p.gender === 'f' ? 'f' : 'm';
    const firsts = arab ? (p.gender === 'f' ? ARAB_FIRST_F : ARAB_FIRST_M) : p.gender === 'f' ? FIRST_F : FIRST_M;
    out.set(p.id, { name: pick(firsts, arab ? ARAB_SURNAMES : SURNAMES, count[key]++) });
  }
  return out;
}

type PartyField = 'name' | 'shortName' | 'letters' | 'description';
let current: Cast = 'real';
const origParties = new Map<string, Record<PartyField, string>>();
const origPeople = new Map<string, { name: string; bio?: string; gender: 'm' | 'f'; look?: unknown }>();
let plans: Map<string, Plan> | null = null;

export const CAST_EVENT = 'hakise:cast';
export const getCast = (): Cast => current;

function snapshot(): void {
  if (origPeople.size) return;
  for (const p of PARTIES) origParties.set(p.id, { name: p.name, shortName: p.shortName, letters: p.letters, description: p.description });
  for (const p of PEOPLE) origPeople.set(p.id, { name: p.name, bio: p.bio, gender: p.gender, look: p.look ? { ...p.look } : undefined });
}

/** Switches the data between the real and the fictional cast. Call before creating or continuing a game. */
export function setCast(c: Cast): void {
  snapshot();
  plans ??= planNames();
  for (const p of PARTIES) {
    const o = origParties.get(p.id)!;
    const fc = c === 'fictional' ? PARTY_CAST[p.id] : undefined;
    p.name = fc?.name[0] ?? o.name;
    p.shortName = fc?.short[0] ?? o.shortName;
    p.letters = fc?.letters[0] ?? o.letters;
    p.description = fc?.desc[0] ?? o.description;
  }
  for (const p of PEOPLE) {
    const o = origPeople.get(p.id)!;
    const pl = c === 'fictional' ? plans.get(p.id) : undefined;
    p.name = pl?.name[0] ?? o.name;
    // a real biography names real facts: in the fictional cast only the leaders keep a (fictional) one
    p.bio = c === 'fictional' ? pl?.quirk : o.bio;
    p.gender = pl?.gender ?? o.gender;
    p.look = o.look ? { ...(o.look as object) } : undefined;
    if (pl?.gender && pl.gender !== o.gender && p.look) delete (p.look as { beard?: unknown }).beard;
  }
  const changed = current !== c;
  current = c;
  try { localStorage.setItem('hakise.cast', c); } catch { /* ignore */ }
  if (changed && typeof window !== 'undefined') window.dispatchEvent(new Event(CAST_EVENT));
}

export function savedCast(): Cast {
  try { return localStorage.getItem('hakise.cast') === 'fictional' ? 'fictional' : 'real'; } catch { return 'real'; }
}

/** English and Arabic for every fictional name, merged into the translation dictionaries while the fictional cast is on. */
export function castDictionary(): { en: Record<string, string>; ar: Record<string, string> } {
  plans ??= planNames();
  const en: Record<string, string> = {};
  const ar: Record<string, string> = {};
  const add = (t: L3) => { en[t[0]] = t[1]; ar[t[0]] = t[2]; };
  for (const pc of Object.values(PARTY_CAST)) { add(pc.name); add(pc.short); add(pc.letters); add(pc.desc); }
  for (const pl of plans.values()) { add(pl.name); }
  for (const lc of Object.values(LEADER_CAST)) add(lc.name);
  return { en, ar };
}

/** Real names that must never show in a fictional game (used by the leak test). */
export function realNames(): string[] {
  snapshot();
  return [...origPeople.values()].map((o) => o.name);
}
