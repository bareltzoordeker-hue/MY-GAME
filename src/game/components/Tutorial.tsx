import { useEffect, useState } from 'react';
import { useGame, type ScreenId } from '../store/gameStore';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';

const KEY = 'hakise.tutorial.done';
const isDone = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const markDone = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };
const RESET_EVENT = 'hakise:tutorial-reset';
export const resetTutorial = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } window.dispatchEvent(new Event(RESET_EVENT)); };

const STEPS: { screen: ScreenId; title: string; text: string }[] = [
  { screen: 'dashboard', title: 'ברוך הבא לכיסא', text: 'כל תור הוא חודשיים. אין "נקודות פעולה": כל החלטה עולה כסף, הון פוליטי (🎯) או זמן. למעלה רואים תאריך, מנדטים, שביעות רצון, גירעון והון פוליטי. לחיצה על "?" מסבירה כל מספר.' },
  { screen: 'dashboard', title: 'לוח הבקרה', text: 'כאן: מצבי חירום, הייעוץ שלי, החלטות שממתינות לך וחדשות. אם לא תענה על החלטה עד שהזמן נגמר — מישהו יחליט בשבילך (ולא תאהב את זה).' },
  { screen: 'budget', title: 'תקציב ומסים', text: 'כל שינוי כאן משפיע באמת: על הגירעון, על איכות השירותים לאורך זמן ועל קבוצות האוכלוסייה. אחרי כל החלטה יופיע חלון עם התגובות.' },
  { screen: 'government', title: 'ממשלה וקואליציה', text: 'השרים זוכרים מה עשית להם. קיצצת? פיטרת? הם יחזרו עם איומים, הדלפות ואולטימטומים. בלי 61 מנדטים — אין ממשלה.' },
  { screen: 'laws', title: 'חקיקה', text: 'חוק עובר טרומית, ועדה וקריאה שלישית, לאורך כמה תורות. רפורמות גדולות דורשות ישיבת ממשלה, ושם תצטרך לשכנע, להציע עסקה או לרכך.' },
  { screen: 'career', title: 'הקריירה שלך', text: 'אפשר לבנות מוניטין, לבקש תפקיד, לקרוא תיגר על המנהיג ואפילו לעבור מפלגה. הניצחון היחיד: להישאר בפוליטיקה.' },
  { screen: 'dashboard', title: 'יאללה', text: 'כשתהיה מוכן — "המשך לחודשיים הבאים" בפינה. הכלכלה תזוז, הציבור יגיב, והפוליטיקאים יזממו. בהצלחה. תצטרך אותה.' },
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
  const st = STEPS[step];
  // isDone() is the source of truth, so resetTutorial() brings the tour back from step 1.
  const close = () => { markDone(); setStep(0); rerender((n) => n + 1); };
  const go = (i: number) => { setStep(i); setScreen(STEPS[i].screen); };
  return (
    <div className="fixed z-40 bottom-4 right-4 left-4 sm:left-auto sm:w-96 card rise" style={{ borderColor: 'var(--gold)', boxShadow: '0 24px 50px -16px rgba(60,40,160,.6)' }}>
      <div className="flex gap-3 items-start">
        <Caricature spec={ADVISOR_SPEC} size={52} />
        <div className="flex-1">
          <div className="text-[11px] muted">מדריך · {step + 1}/{STEPS.length}</div>
          <div className="font-black">{st.title}</div>
          <p className="text-sm mt-1 leading-relaxed">{st.text}</p>
        </div>
      </div>
      <div className="flex justify-between items-center mt-3">
        <button className="btn btn-sm btn-ghost" onClick={close}>דלג</button>
        <div className="flex gap-2">
          {step > 0 && <button className="btn btn-sm" onClick={() => go(step - 1)}>→ הקודם</button>}
          {step < STEPS.length - 1 ? <button className="btn btn-sm btn-primary" onClick={() => go(step + 1)}>הבא ←</button> : <button className="btn btn-sm btn-primary" onClick={close}>סיום</button>}
        </div>
      </div>
    </div>
  );
}
