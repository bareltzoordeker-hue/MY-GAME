import { useState } from 'react';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';
import { resetTutorial } from './Tutorial';
import { useGame } from '../store/gameStore';

const SECTIONS: { icon: string; title: string; items: string[] }[] = [
  { icon: '🎯', title: 'המטרה', items: [
    'סימולציה של הפוליטיקה בישמעאל, עם המפלגות והאנשים כפי שהם בספטמבר 2026. המטרה: להישאר בפוליטיקה, להשפיע ולהגשים את המדיניות שלך.',
    'המשחק נגמר אם המפלגה לא עוברת את אחוז החסימה, אם לא נבחרת לכנסטון, אם הודחת, אם הוצאת מהמפלגה או אם פרשת. הפסד בבחירות לא מסיים את המשחק – אפשר להמשיך באופוזיציה.',
  ] },
  { icon: '🧭', title: 'במי משחקים', items: [
    'בכל אחד מחברי הכנסטון והמועמדים האמיתיים, או בדמות משלך שתופסת מקום ברשימה.',
    'התפקיד ההתחלתי לפי התפקיד האמיתי: ראש ממשלה, שר, יו״ר מפלגה או חבר כנסטון. לכל תפקיד יש סמכויות אחרות.',
  ] },
  { icon: '⏭', title: 'איך עובר הזמן', items: [
    'תור רגיל הוא חודשיים. ב-4 החודשים שלפני הבחירות כל תור הוא שבועיים של קמפיין.',
    'בכל תור מחליטים כמה החלטות שרוצים. כל החלטה עולה הון פוליטי (🎯), כסף או יחסים.',
    'בסוף התור הכלכלה זזה, הסקרים מתעדכנים, האויבים מתחזקים והפוליטיקאים זוכרים מה עשית. מופיע סיכום מפורט של התור.',
  ] },
  { icon: '🤝', title: 'קואליציה ומשא ומתן', items: [
    'אחרי הבחירות הנשיא מטיל את הרכבת הממשלה על מי שקיבל הכי הרבה המלצות. יש 28 יום, ועוד הארכה של 14.',
    'כל מפלגה דורשת תיקים, סגני שרים, ועדות, תקציבים, חוקים, וטו ולפעמים רוטציה. אפשר לוותר על דרישות או להציע תוספות.',
    'ההסכם נכתב, וכל התחייבות מקבלת מועד ותזכורת. הפרה עלולה לפרק את הממשלה.',
  ] },
  { icon: '📜', title: 'חקיקה וערכים', items: [
    'חוקים אמיתיים עוברים טרומית, ועדה וקריאה שלישית לאורך כמה תורות. חוקי יסוד צריכים 61.',
    'כל מפלגה מצביעה לפי הערכים שלה. לחלק מהמפלגות יש קווים אדומים שלא ייחצו גם מתוך הקואליציה.',
  ] },
  { icon: '🛡️', title: 'ביטחון ומדיניות', items: [
    'שש חזיתות, יחידות צה״ל בשמותיהן האמיתיים ומבצעים שמאשר הקבינט. לכל מבצע יש מחיר: נפגעים, כלכלה ויחסי חוץ.',
    'לצד המסלול הצבאי יש מסלול מדיני: ערוצי הידברות, מתווכים, הפסקות אש, צעדים בוני אמון, שטחי A/B/C ונורמליזציה.',
  ] },
  { icon: '🚩', title: 'קמפיין ונאומים', items: [
    'יו״ר מפלגה פותח קמפיין: אסטרטגיה, קהלי יעד, תקציב וסיסמה, ואחר כך חוגי בית, תשדירים, עימותים, סקרים פנימיים והסכמי עודפים.',
    'כפתור "🎤 נאום" זמין תמיד: בוחרים במה, נושא, עמדה וטון, וכותבים או מבקשים טיוטה. כל מפלגה מגיבה לפי הערכים שלה.',
  ] },
  { icon: '🧠', title: 'היועץ', items: [
    'היועץ בכפתור הצף נותן המלצה בכל מצב, ומסביר בדיוק מה כל כפתור יעשה לפני שלוחצים.',
    'הוא מריץ סימולציה לפני שהוא ממליץ, אבל ההחלטה שלך.',
  ] },
  { icon: '💡', title: 'טיפים', items: [
    'מעבר עם העכבר על כפתור מסביר מה הוא עושה. "?" ליד מספר מסביר מאיפה הוא בא.',
    'המשחק נשמר אוטומטית בסוף כל תור, בדפדפן שלך בלבד.',
  ] },
];

/** In-game "how to play" guide. Pure UI – reads nothing from the game state. */
export function HowToPlay({ onClose, inGame }: { onClose: () => void; inGame?: boolean }) {
  return (
    <div className="backdrop" onClick={onClose}>
      <div className="modal modal-wide" role="dialog" aria-modal="true" aria-label="איך משחקים" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex gap-3 items-center" style={{ borderColor: 'var(--line)' }}>
          <Caricature spec={ADVISOR_SPEC} size={52} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] muted">המדריך</div>
            <h2 className="text-2xl font-black">איך משחקים?</h2>
          </div>
          <button className="btn btn-sm btn-ghost" onClick={onClose} aria-label="סגירה">✕</button>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-3">
          {SECTIONS.map((sec) => (
            <div key={sec.title} className="inset">
              <div className="font-black mb-1">{sec.icon} {sec.title}</div>
              <ul className="text-sm leading-relaxed space-y-1" style={{ listStyle: 'disc', paddingInlineStart: 18 }}>
                {sec.items.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="p-5 pt-0 flex flex-wrap gap-2 justify-end">
          {inGame && <button className="btn" data-tip="הסיור המודרך על המסכים יופיע שוב" onClick={() => { resetTutorial(); useGame.getState().setScreen('dashboard'); onClose(); }}>🔁 הצג את הסיור המודרך</button>}
          <button className="btn btn-primary" onClick={onClose}>הבנתי</button>
        </div>
      </div>
    </div>
  );
}

/** A button that opens the guide; keeps its own open state. */
export function HowToPlayButton({ className, inGame, label = '📖 איך משחקים?', onClosed }: { className?: string; inGame?: boolean; label?: string; onClosed?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className={className ?? 'btn'} data-tip="מדריך: המטרה, התפקידים, איך עובר הזמן, קואליציה, חקיקה, ביטחון וקמפיין" onClick={() => setOpen(true)}>{label}</button>
      {open && <HowToPlay inGame={inGame} onClose={() => { setOpen(false); onClosed?.(); }} />}
    </>
  );
}
