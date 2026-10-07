// ============================================================
// Narrative Engine — turns structured game facts into short, serious text
// (reactions, statements, headlines, career summaries). It never changes numbers.
// Statements attributed to real politicians stay generic and policy-level.
// ============================================================
import { GROUP_BY_ID } from '../../data/world';
import { pick } from '../rng';
import type { GameState, GroupId, Politician } from '../../types/game';

type Bucket = 'veryBad' | 'bad' | 'meh' | 'good' | 'veryGood';
const bucket = (d: number): Bucket => (d <= -4 ? 'veryBad' : d <= -1 ? 'bad' : d < 1 ? 'meh' : d < 4 ? 'good' : 'veryGood');

const GENERIC: Record<Bucket, string[]> = {
  veryBad: ['התנגדות חריפה. ארגונים מדברים על מחאה.', 'פגיעה קשה – זה ייזכר בקלפי.', 'תחושה שהממשלה פועלת נגדם.'],
  bad: ['מתנגדים להחלטה.', 'חוששים מהשלכות שליליות.', 'אכזבה מהכיוון.'],
  meh: ['ההחלטה לא משפיעה עליהם ישירות.', 'אין תגובה מיוחדת.', 'ממתינים לראות את היישום.'],
  good: ['מקבלים את ההחלטה בברכה.', 'צעד בכיוון הנכון.', 'תמיכה זהירה.'],
  veryGood: ['תמיכה רחבה בהחלטה.', 'רואים בזה הישג חשוב.', 'מברכים ומצפים ליישום מהיר.'],
};

/** Group-specific, factual reactions (by how much the decision helped or hurt them). */
const VOICE: Partial<Record<GroupId, Partial<Record<Bucket, string[]>>>> = {
  youth: { veryBad: ['צעירים מדברים על הגירה ועל יוקר מחיה בלתי אפשרי.'], bad: ['הצעירים חוששים שהנטל שוב עובר אליהם.'], good: ['הצעירים רואים בזה הקלה מסוימת.'], veryGood: ['ארגוני הצעירים מברכים: "סוף סוף מתייחסים אלינו".'] },
  elderly: { veryBad: ['ארגוני הגמלאים והקשישים מזהירים מפגיעה בשכבה החלשה.'], good: ['בקרב המבוגרים מרוצים מהתשומת לב.'] },
  families: { veryBad: ['משפחות מדברות על עומס הוצאות שאי אפשר לעמוד בו.'], bad: ['עוד הוצאה על משפחות שכבר מתקשות.'], good: ['ההחלטה מקלה על משפחות עם ילדים.'], veryGood: ['ארגוני ההורים מברכים על הצעד.'] },
  lowIncome: { veryBad: ['ארגוני הסיוע מזהירים מהעמקת העוני.'], bad: ['השכבות החלשות שוב נפגעות.'], veryGood: ['ארגוני הרווחה מדברים על שינוי ממשי בחיי משפחות.'] },
  middleClass: { veryBad: ['מעמד הביניים מרגיש שהוא נושא בנטל לבדו.'], bad: ['ההחלטה מכבידה על מעמד הביניים.'], good: ['מעמד הביניים מקבל הקלה מסוימת.'] },
  highIncome: { veryBad: ['במגזר העסקי מזהירים מבריחת השקעות.'], bad: ['ארגוני המעסיקים מבקרים את ההחלטה.'], good: ['השוק מגיב בחיוב.'] },
  soldiers: { veryBad: ['בקרב חיילים בשירות סדיר יש תחושת זלזול.'], veryGood: ['החיילים מרגישים שרואים אותם.'] },
  reservists: { veryBad: ['ארגוני המילואים: "אחרי מאות ימי שירות – זו התשובה?"'], bad: ['משרתי המילואים מרגישים שוב שהנטל לא שוויוני.'], good: ['ארגוני המילואים מברכים על ההכרה.'], veryGood: ['משרתי המילואים: "צעד משמעותי לשוויון בנטל".'] },
  haredim: { veryBad: ['הנהגת הציבור החרדי מגדירה את ההחלטה כפגיעה בעולם התורה. קריאות למחאה.'], bad: ['בציבור החרדי מבקרים את ההחלטה.'], good: ['בציבור החרדי מקבלים את ההחלטה בברכה.'], veryGood: ['הנהגת הציבור החרדי מברכת ומודה.'] },
  secular: { veryBad: ['בקרב חילונים יש תחושה של כפייה דתית.'], bad: ['החילונים מרגישים שמממנים את כולם חוץ מהם.'], veryGood: ['ארגונים חילוניים מברכים על הצעד.'] },
  religious: { veryBad: ['בציבור הדתי רואים בזה פגיעה בערכי המסורת.'], veryGood: ['בציבור הדתי מברכים על ההחלטה.'] },
  arabs: { veryBad: ['ראשי הרשויות הערביות מזהירים מהעמקת האפליה.'], bad: ['בחברה הערבית מבקרים את ההחלטה.'], good: ['ראשי הרשויות הערביות מברכים בזהירות.'], veryGood: ['בחברה הערבית רואים בזה צעד משמעותי לשוויון.'] },
  olim: { veryBad: ['ארגוני העולים מזהירים מפגיעה בקליטה.'], veryGood: ['העולים מברכים על הצעד.'] },
  center: { veryBad: ['תושבי המרכז קורסים תחת יוקר המחיה.'], good: ['במרכז מברכים, ומחכים לפתרון לתחבורה ולדיור.'] },
  periphery: { veryBad: ['ראשי הרשויות בפריפריה: "שוב הכסף הולך למרכז".'], bad: ['בפריפריה מרגישים שוב נשכחים.'], veryGood: ['ראשי הרשויות בפריפריה מברכים על ההשקעה.'] },
  settlers: { veryBad: ['מועצת יש״ע מגדירה את ההחלטה כפגיעה חמורה בהתיישבות.'], veryGood: ['ראשי ההתיישבות מברכים על ההחלטה.'] },
  left: { veryBad: ['ארגוני השמאל מודיעים על הפגנות.'], bad: ['בשמאל מבקרים את הכיוון.'], veryGood: ['בשמאל מברכים ומבקשים להמשיך.'] },
  right: { veryBad: ['בימין מדברים על "בגידה בבוחרים".'], bad: ['בימין לא מרוצים מהכיוון.'], veryGood: ['בימין מברכים: "זה מה שהבטחנו".'] },
  liberals: { veryBad: ['ארגוני זכויות האדם והחירויות מזהירים מפגיעה בחירות הפרט.'], veryGood: ['הליברלים מברכים על חיזוק החירויות.'] },
  socialists: { veryBad: ['ארגוני העובדים מזהירים מפגיעה במדינת הרווחה.'], veryGood: ['ארגוני העובדים והרווחה מברכים על הצעד.'] },
  selfEmployed: { veryBad: ['ארגוני העצמאים מזהירים מסגירת עסקים.'], veryGood: ['העצמאים מברכים על ההקלה.'] },
  employees: { veryBad: ['ההסתדרות מאיימת בצעדים ארגוניים.'], good: ['השכירים מרגישים הקלה מסוימת.'] },
  publicSector: { veryBad: ['ועדי עובדי המדינה מכריזים על סכסוך עבודה.'], veryGood: ['ועדי העובדים מברכים.'] },
  students: { veryBad: ['התאחדות הסטודנטים מודיעה על מחאה.'], veryGood: ['התאחדות הסטודנטים מברכת.'] },
  retirees: { veryBad: ['ארגוני הגמלאים מזהירים מפגיעה בקצבאות.'], veryGood: ['ארגוני הגמלאים מברכים.'] },
};

/** Policy-level responses by party, consistent with each party's public positions. */
export const PARTY_LINES: Record<string, { yes: string[]; maybe: string[]; no: string[] }> = {
  likud: { yes: ['נתמוך. זה תואם את המדיניות שלנו.'], maybe: ['נבחן את הנושא בסיעה.'], no: ['זה לא תואם את המדיניות שלנו.'] },
  yashar: { yes: ['נתמוך במהלך ממלכתי ואחראי.'], maybe: ['נדרוש פרטים ובחינה מקצועית.'], no: ['המהלך לא אחראי ולא ממלכתי.'] },
  together: { yes: ['זה נכון למדינה, ונתמוך.'], maybe: ['נבחן אם זה באמת משרת את הציבור.'], no: ['זה עוד מהלך פוליטי על חשבון הציבור.'] },
  democrats: { yes: ['נתמוך בכל צעד שמקדם שוויון וצדק חברתי.'], maybe: ['צריך לבדוק את ההשפעה על השכבות החלשות.'], no: ['זה פוגע בדמוקרטיה ובשכבות החלשות.'] },
  shas: { yes: ['נתמוך, בעזרת השם.'], maybe: ['נתייעץ עם מועצת חכמי התורה.'], no: ['זה פוגע במסורת ובשכבות החלשות.'] },
  utj: { yes: ['נתמוך, בהתאם להכרעת גדולי התורה.'], maybe: ['הנושא יובא להכרעת המועצת.'], no: ['זו פגיעה בעולם התורה ולא נתמוך.'] },
  otzma: { yes: ['נתמוך במהלך שמחזק את הביטחון והמשילות.'], maybe: ['נבחן אם זה מספיק חזק.'], no: ['זה צעד חלש ומסוכן.'] },
  rzp: { yes: ['נתמוך. זה מחזק את ההתיישבות ואת הזהות היהודית.'], maybe: ['נבחן את ההשלכות על ההתיישבות.'], no: ['זה מסכן את ארץ ישראל ולא נתמוך.'] },
  yb: { yes: ['נתמוך במהלך הגיוני ושוויוני.'], maybe: ['נבחן אם זה שוב מימון למגזר אחד.'], no: ['זה עוד תקציב מגזרי ולא נתמוך.'] },
  joint: { yes: ['נתמוך בכל צעד שמקדם שוויון.'], maybe: ['נבחן את ההשפעה על החברה הערבית.'], no: ['זה מעמיק את האפליה ולא נתמוך.'] },
  raam: { yes: ['נתמוך. זה עונה על צורכי החברה הערבית.'], maybe: ['נבחן מה זה נותן לציבור שלנו.'], no: ['זה פוגע בציבור שלנו.'] },
  bluewhite: { yes: ['נתמוך במהלך אחראי.'], maybe: ['נבחן לגופו של עניין.'], no: ['זה לא אחראי.'] },
  reservists: { yes: ['נתמוך בכל מה שמחזק את המילואימניקים ואת השוויון בנטל.'], maybe: ['נבחן את המשמעות למשרתי המילואים.'], no: ['זה פוגע במי שנושא בנטל.'] },
  amcha: { yes: ['נתמוך במהלך שמחזק את הביטחון.'], maybe: ['נבחן את ההשלכות הביטחוניות.'], no: ['זה צעד מסוכן.'] },
  noam: { yes: ['נתמוך במהלך ששומר על אופי המדינה.'], maybe: ['נבחן את ההשלכות על הזהות היהודית.'], no: ['זה פוגע בזהות היהודית.'] },
  israel_first: { yes: ['נתמוך.'], maybe: ['נבחן את הנושא.'], no: ['לא נתמוך.'] },
};

export const N = {
  groupReaction(s: GameState, id: GroupId, delta: number): string {
    const b = bucket(delta);
    const own = VOICE[id]?.[b] ?? [];
    return pick(s, own.length ? own : GENERIC[b]);
  },

  groupName: (id: GroupId) => `${GROUP_BY_ID[id].emoji} ${GROUP_BY_ID[id].name}`,

  ministerComment(s: GameState, p: Politician, stance: number, cost: number): string {
    const pl = PARTY_LINES[p.partyId];
    if (pl && (s.rngState & 3) === 0) return pick(s, stance > 0.4 ? pl.yes : stance > -0.1 ? pl.maybe : pl.no);
    const c = cost > 0.05 ? `₪${cost.toFixed(1)} מיליארד` : 'עלות נמוכה';
    if (stance > 0.4) return pick(s, [`המהלך יעלה ${c}, אבל יש לו הצדקה מקצועית.`, `אני תומך. ${c} זו השקעה סבירה.`]);
    if (stance > -0.1) return pick(s, [`העלות ${c}. אני לא בטוח שזה סדר העדיפויות הנכון.`, 'אפשר לתמוך, בתנאי שלא יפגע בתקציב המשרד.']);
    return pick(s, [`זה יעלה ${c} ויפגע בתחום שלי. אני מתנגד.`, 'אני מתנגד למהלך הזה.', 'לא אתמוך בזה בהרכב הנוכחי.']);
  },

  meetingBubble(s: GameState, p: Politician, stance: number, domain: string): string {
    const pl = PARTY_LINES[p.partyId];
    if (pl && (s.rngState & 1)) return pick(s, stance > 0.4 ? pl.yes : stance > -0.1 ? pl.maybe : pl.no);
    const byDomain: Record<string, string[]> = {
      finance: ['אין לזה מקור תקציבי.', 'זה ירחיב את הגירעון.'],
      defense: ['קיצוץ בביטחון בזמן הזה הוא סיכון.', 'צה״ל צריך את המשאבים האלה.'],
      transport: ['ומה עם תשתיות התחבורה?'],
      education: ['צריך לחשוב על מערכת החינוך.'],
      health: ['מערכת הבריאות כבר בעומס.'],
    };
    if (stance < -0.1 && byDomain[domain]) return pick(s, byDomain[domain]);
    if (stance > 0.4) return pick(s, ['אני תומך.', 'הצעה ראויה.', 'נתמוך.']);
    if (stance > -0.1) return pick(s, ['צריך לבחון את הפרטים.', 'אני מתלבט.', 'אפשר לדון בזה בוועדה.']);
    return pick(s, ['אני מתנגד.', 'לא אתמוך בזה.', 'זה לא מקובל עלינו.']);
  },

  /** A short political-analysis line (replaces the old one-liners). */
  quip(s: GameState): string {
    return pick(s, [
      'פרשנים: הסקרים יציבים, אבל שיעור המתלבטים עדיין גבוה.',
      'כלכלנים מזהירים מהשפעת יוקר המחיה על מעמד הביניים.',
      'ארגוני המילואים ממשיכים לדרוש שוויון בנטל.',
      'מבקר המדינה צפוי לפרסם דוח על מוכנות העורף.',
    ]);
  },

  advisorTone(s: GameState): string {
    const opts = ['שורה תחתונה:', 'ההערכה שלי:', 'כדאי לשים לב:', 'בקצרה:'];
    return opts[s.turn % opts.length];
  },

  /** Reactions to a decision: the main rival and a few public voices. */
  chorus(s: GameState, good: boolean): { icon: string; label: string; text: string; tone: 'good' | 'bad' | 'neutral' }[] {
    const me = s.politicians[s.player.politicianId];
    const inGov = s.government.coalition.includes(s.player.partyId);
    const oppLeader = Object.values(s.parties).filter((p) => !s.government.coalition.includes(p.id) && p.seats > 0 && p.id !== s.player.partyId).sort((a, b) => b.seats - a.seats)[0];
    const rivalId = inGov ? oppLeader?.leaderId : s.government.pmId;
    const rival = rivalId ? s.politicians[rivalId] : undefined;
    const out: { icon: string; label: string; text: string; tone: 'good' | 'bad' | 'neutral' }[] = [];
    if (rival && rival.id !== me.id) {
      out.push({
        icon: '🗣️', label: rival.name, tone: good ? 'neutral' : 'bad',
        text: pick(s, good
          ? ['ההחלטה מאוחרת, אבל נבחן אותה לגופה.', 'השאלה היא אם זה ייושם בפועל.', 'נדרוש לראות מקור תקציבי.']
          : ['ההחלטה מוכיחה שאין כאן תוכנית.', 'הציבור ישלם את המחיר.', 'נפעל נגד המהלך בכנסטון.']),
      });
    }
    const voices = [
      { icon: '📺', label: 'פרשן פוליטי', good: ['מהלך שעשוי לחזק את מעמדו בסקרים.', 'החלטה שקולה, מבחנה ביישום.'], bad: ['ההחלטה עלולה לעלות לו בתמיכה.', 'מהלך שנוי במחלוקת, שישפיע על הקמפיין.'] },
      { icon: '📈', label: 'כלכלן', good: ['ההשפעה הכלכלית חיובית בטווח הארוך.', 'צעד אחראי מבחינה פיסקלית.'], bad: ['יש לכך מחיר תקציבי שלא קיבל מענה.', 'ההחלטה מגדילה את אי-הוודאות הכלכלית.'] },
      { icon: '🧑‍🤝‍🧑', label: 'קול מהציבור', good: ['סוף סוף החלטה שמרגישים בשטח.', 'מקווים שזה יגיע גם אלינו.'], bad: ['מרגישים שאף אחד לא מקשיב לנו.', 'שוב החלטות בלי לשאול את הציבור.'] },
    ];
    const v = pick(s, voices);
    out.push({ icon: v.icon, label: v.label, text: pick(s, good ? v.good : v.bad), tone: 'neutral' });
    return out;
  },

  /** A short factual note on a decision (used when the action brings no text of its own). */
  actionJoke(s: GameState, category: string, status: string): string {
    if (status === 'rejected') return pick(s, ['המהלך לא אושר. אפשר לנסות שוב בתנאים אחרים.', 'ההחלטה נכשלה. התקשורת כבר מסקרת.']);
    const pools: Record<string, string[]> = {
      economy: ['ההשפעה על המדדים הכלכליים תורגש בתורות הבאים.'],
      government: ['שותפי הקואליציה יגיבו לכך בישיבת הממשלה הבאה.'],
      parliament: ['ההחלטה תשפיע על מאזן הכוחות בכנסטון.'],
      ministry: ['היישום במשרד ייקח זמן.'],
      media: ['התגובה בתקשורת תשפיע על הסקרים.'],
      career: ['המהלך משפיע על מעמדך במפלגה.'],
      party: ['חברי המפלגה יזכרו את זה בפריימריז.'],
      campaign: ['ההשפעה תיבדק בסקרים הקרובים.'],
      projects: ['הפרויקט יתקדם בהתאם לתקציב וליעילות המשרד.'],
    };
    return pick(s, pools[category] ?? pools.media);
  },

  /** No longer used for satire; kept for API compatibility. */
  satireHeadlines(_s: GameState): string[] {
    return [];
  },

  /** A serious one-line summary of how a career ended. */
  epitaph(s: GameState, reason: string): string {
    const lines: Record<string, string[]> = {
      lost_election: ['הבוחרים הכריעו. הקריירה הפוליטית הגיעה לסיומה.'],
      ousted: ['הודחת מהתפקיד. הפוליטיקה לא סלחה.'],
      resigned: ['בחרת לפרוש מהחיים הפוליטיים.'],
      coalition_failed: ['לא הצלחת להרכיב ממשלה, והמנדט עבר הלאה.'],
      not_elected: ['לא נבחרת לכנסטון הבא.'],
      expelled: ['המפלגה החליטה להוציא אותך משורותיה.'],
    };
    return pick(s, lines[reason] ?? ['הקריירה הפוליטית הגיעה לסיומה.']);
  },
};
