import { useEffect, useState } from 'react';
import { useGame, type ScreenId } from '../store/gameStore';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';

const KEY = 'hakise.tutorial.done';
const isDone = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const markDone = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };
const RESET_EVENT = 'hakise:tutorial-reset';
/** Turn the guided tutorial on (fresh) or off for the next game. */
export const setTutorialEnabled = (on: boolean) => { if (on) resetTutorial(); else markDone(); };
export const resetTutorial = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } window.dispatchEvent(new Event(RESET_EVENT)); };

const STEPS: { screen: ScreenId; title: string; text: string }[] = [
  { screen: 'dashboard', title: 'ברוכים הבאים', text: 'זה מדריך צעד אחר צעד על כל המסכים. אפשר לדלג בכל רגע ולהפעיל אותו שוב ממסך "שמירה והגדרות". בשורה העליונה: התאריך, המנדטים בסקר, הקואליציה, שביעות הרצון, הגירעון, ההון הפוליטי (🎯) והזמן עד הבחירות. לחיצה על "?" מסבירה כל מספר.' },
  { screen: 'dashboard', title: 'איך עובר הזמן', text: 'תור רגיל הוא 4 חודשים. ב-4 החודשים שלפני הבחירות כל תור הוא שבועיים של קמפיין. בכל תור מחליטים כמה החלטות שרוצים, ואז לוחצים על כפתור התור הבא בפינה. הכפתור מראה בדיוק כמה זמן יעבור.' },
  { screen: 'dashboard', title: 'הון פוליטי', text: 'כמעט כל פעולה עולה הון פוליטי. הוא מתחדש בכל תור, לפי התפקיד והפופולריות שלך. חלק מהפעולות זמינות שוב רק אחרי כמה תורות – זה כתוב על הכפתור.' },
  { screen: 'dashboard', title: 'לוח הבקרה', text: 'כאן מחכות החלטות עם מועד אחרון, מצבי חירום, חדשות והיועץ. החלטה שלא ענית עליה בזמן מוכרעת אוטומטית בסוף התור. אחרי כל החלטה נפתח חלון שמראה מה השתנה ומי הגיב.' },
  { screen: 'security', title: 'ביטחון ומדיניות', text: 'שש חזיתות עם רמת איום. ראש הממשלה ושר הביטחון מתכננים מבצעים; מבצעים גדולים עוברים הצבעה בקבינט ומתבצעים מיד, עם תוצאות ונפגעים. לצד זה: ערוצי הידברות, הפסקות אש בתיווך, צעדים בוני אמון ושטחי A/B/C.' },
  { screen: 'budget', title: 'תקציב ומסים', text: 'ראש הממשלה מחלק את התקציב וקובע מסים. שינוי משפיע מיד על הגירעון, ועל איכות השירותים בהדרגה, לאורך כמה חודשים. התקציב השנתי חייב לעבור בכנסטון; אם הוא נופל – הולכים לבחירות.' },
  { screen: 'economy', title: 'כלכלה', text: 'צמיחה, אבטלה, אינפלציה וחוב. הגרפים מראים את המגמה לאורך זמן, ולכל מספר יש הסבר מה מניע אותו.' },
  { screen: 'government', title: 'ממשלה וקואליציה', text: 'מינויים, פיטורים ואיחוד משרדים. כאן מופיע גם ההסכם הקואליציוני: כל התחייבות לשותפות, המועד שלה, והאם קוימה. לפני מועד תגיע תזכורת; הפרה מכעיסה את השותפה ועלולה לפרק את הממשלה.' },
  { screen: 'laws', title: 'חקיקה', text: 'חוק פרטי מתחיל בקריאה טרומית; חוק ממשלתי עובר ישר לוועדה. התהליך לוקח כמה תורות (כשנה). כל מפלגה מצביעה לפי הערכים שלה, ויש קווים אדומים שלא ייחצו גם מתוך הקואליציה. חוקי יסוד צריכים 61.' },
  { screen: 'parliament', title: 'הכנסטון', text: '120 מושבים, הצעות החוק שבדיון וצפי ההצבעה לכל מפלגה. אפשר לגייס תמיכה או לרכך הצעה כדי להשיג רוב.' },
  { screen: 'relations', title: 'מפת יחסים', text: 'היחסים בין המפלגות ובינך לבין חברי הכנסטון. פגישות, אירועים משותפים, תמיכה הדדית בחקיקה והגנה פומבית בונים קשרים; מתקפות שוחקות אותם. יחסים טובים עוזרים בהצבעות, בהמלצות לנשיא ובהרכבת קואליציה.' },
  { screen: 'party', title: 'מפלגה וקמפיין', text: 'יו״ר מפלגה מנהל את הקמפיין: אסטרטגיה, קהלי יעד, תקציב, חוגי בית, תשדירים, עימותים, סקרים פנימיים, הסכמי עודפים ואיחודים. אסטרטגיה בנושא שבוער בציבור משתלמת יותר.' },
  { screen: 'ministry', title: 'המשרד', text: 'לשר יש פעולות ייעודיות למשרד שלו, מדדים ותקציב. בקשת כסף נוסף דורשת אישור ראש הממשלה. ראש הממשלה יכול להנחות כל שר.' },
  { screen: 'projects', title: 'פרויקטים', text: 'פרויקטים לאומיים לוקחים חודשים ושנים (מוצג על כל פרויקט). הם משפרים שירות ואזור כשהם מסתיימים, ובמשרדים ביורוקרטיים הם מתעכבים.' },
  { screen: 'crises', title: 'משברים', text: 'משבר שלא מטופל מחריף ופוגע בכל תור. לכל משבר יש כמה דרכי טיפול עם עלות וסיכוי הצלחה.' },
  { screen: 'career', title: 'הקריירה', text: 'עבודת ועדה, ראיונות, בקשת תפקיד, פריימריז ומעבר מפלגה. אפשר לשאת נאום בכל רגע מכפתור "🎤 נאום" שבשורה העליונה – עם טיוטה אוטומטית.' },
  { screen: 'dashboard', title: 'בחירות', text: 'ביום הבחירות מחולקים המנדטים, הנשיא מטיל את הרכבת הממשלה על מי שקיבל הכי הרבה המלצות, ויש 28 יום (ועוד 14) להגיע ל-61. מי שלא מצליח – המנדט עובר הלאה. אפשר להפסיד ולהמשיך כאופוזיציה.' },
  { screen: 'dashboard', title: 'מוכנים', text: 'זהו. המטרה: להישאר בפוליטיקה ולהשפיע. המשחק נשמר אוטומטית בסוף כל תור. בהצלחה.' },
];

export function Tutorial() {
  const game = useGame((s) => s.game);
  const briefing = useGame((s) => s.briefingOpen);
  const busy = useGame((s) => s.reactions.length > 0 || !!s.meeting);
  const setScreen = useGame((s) => s.setScreen);
  const [step, setStep] = useState(0);
  const [, rerender] = useState(0);
  useEffect(() => {
    const onReset = () => { setStep(0); rerender((n) => n + 1); };
    window.addEventListener(RESET_EVENT, onReset);
    return () => window.removeEventListener(RESET_EVENT, onReset);
  }, []);
  if (!game || isDone() || briefing || busy || game.gameOver) return null;
  // skip the ministry step for players who have no ministry
  const steps = STEPS.filter((x) => x.screen !== 'ministry' || game.player.role === 'pm' || game.player.role === 'minister');
  const st = steps[Math.min(step, steps.length - 1)];
  // isDone() is the source of truth, so resetTutorial() brings the tour back from step 1.
  const close = () => { markDone(); setStep(0); rerender((n) => n + 1); };
  const go = (i: number) => { setStep(i); setScreen(steps[i].screen); };
  return (
    <div role="dialog" aria-label="מדריך המשחק" className="fixed z-40 bottom-4 right-4 left-4 sm:left-auto sm:w-96 card rise" style={{ borderColor: 'var(--gold)', boxShadow: '0 24px 50px -16px rgba(60,40,160,.6)' }}>
      <div className="flex gap-3 items-start">
        <Caricature spec={ADVISOR_SPEC} size={52} />
        <div className="flex-1">
          <div className="text-[11px] muted">מדריך · {step + 1}/{steps.length}</div>
          <div className="font-black">{st.title}</div>
          <p className="text-sm mt-1 leading-relaxed">{st.text}</p>
        </div>
      </div>
      <div className="flex justify-between items-center mt-3">
        <button className="btn btn-sm btn-ghost" onClick={close}>דלג</button>
        <div className="flex gap-2">
          {step > 0 && <button className="btn btn-sm" onClick={() => go(step - 1)}>→ הקודם</button>}
          {step < steps.length - 1 ? <button className="btn btn-sm btn-primary" onClick={() => go(step + 1)}>הבא ←</button> : <button className="btn btn-sm btn-primary" onClick={close}>סיום</button>}
        </div>
      </div>
    </div>
  );
}
