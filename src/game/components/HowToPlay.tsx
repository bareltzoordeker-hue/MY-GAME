import { useState } from 'react';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';
import { resetTutorial } from './Tutorial';
import { useGame } from '../store/gameStore';

const SECTIONS: { icon: string; title: string; items: string[] }[] = [
  { icon: '🎯', title: 'המטרה', items: [
    'אין ניצחון. יש הישרדות. כל עוד אתה בפוליטיקה – אתה מנצח.',
    'המשחק נגמר אם מדיחים אותך, אם הקואליציה מתפרקת ואין ממשלה, אם הפסדת בבחירות, אם לא נבחרת או אם המפלגה זרקה אותך.',
    'בסוף מקבלים סיכום קריירה וכיתוב מצבה. נסו שיהיה מחמיא.',
  ] },
  { icon: '🧭', title: 'ארבעה מסלולים', items: [
    '🪑 ראש ממשלה – כל המדינה עליך: תקציב, קואליציה, משברים.',
    '📢 מועמד – אופוזיציה, קמפיין והבטחות. בחירות בעוד שנתיים.',
    '🏛️ שר – משרד אחד, החלטות רק בתחום שלו, ובוס שאפשר לאכזב.',
    '🙋 חבר כנסטון – מקום 14 ברשימה. ועדות, ראיונות, פריימריז ותככים.',
  ] },
  { icon: '⏭', title: 'איך עובר הזמן', items: [
    'כל תור הוא חודשיים. מקבלים כמה החלטות שרוצים, ואז לוחצים "המשך לחודשיים הבאים".',
    'אין נקודות פעולה: כל החלטה עולה כסף, הון פוליטי (🎯) או אהדה של מישהו.',
    'בסוף התור הכלכלה זזה, הסקרים מתעדכנים והפוליטיקאים זוכרים מה עשית להם.',
  ] },
  { icon: '📥', title: 'החלטות ותגובות', items: [
    'בלוח הבקרה מחכות החלטות עם תאריך יעד. לא ענית בזמן? מישהו יחליט במקומך.',
    'אחרי כל פעולה קופץ חלון תגובות: מי שמח, מי זועם ומה כתבו בעיתון.',
    'אירועים דרמטיים קופצים באמצע. חלקם נגמרים בשביתה כללית, חלקם בכותרת מביכה.',
  ] },
  { icon: '🧠', title: 'היועץ', items: [
    'מוטי ספין יושב בכפתור הצף בפינה ונותן עצה בכל מצב, לא רק במשברים.',
    '"✅ קבל החלטה" לוקח אותך ישר למסך הנכון ומדליק את הכפתור שצריך ללחוץ עליו.',
    'הוא מריץ סימולציה לפני שהוא ממליץ. זה לא אומר שהוא צודק.',
  ] },
  { icon: '🗂️', title: 'איפה מה', items: [
    'תקציב ומסים – כל שקל משפיע על הגירעון, על השירותים ועל 21 קבוצות האוכלוסייה.',
    'ממשלה, כנסטון וחוקים – מינויים, פיטורים, הצעות חוק וביטול חוקים.',
    'מפלגה ובריתות – קמפיין, הבטחות בחירות ובריתות עם מפלגות אחרות.',
    'קריירה – לבקש תפקיד, לקרוא תיגר על המנהיג או לעבור מפלגה.',
  ] },
  { icon: '💡', title: 'טיפים', items: [
    'מצביעים על כפתור – רואים מה הוא עושה. לוחצים על "?" ליד מספר – מבינים מאיפה הוא בא.',
    'בלי 61 מנדטים אין ממשלה. תשמור על השותפים, גם אם הם בלתי נסבלים.',
    'המשחק נשמר אוטומטית בסוף כל תור, בדפדפן שלך.',
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
            <div className="text-[11px] muted">המדריך של מוטי ספין</div>
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
          <button className="btn btn-primary" onClick={onClose}>הבנתי, יאללה</button>
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
      <button className={className ?? 'btn'} data-tip="מדריך קצר: המטרה, המסלולים, איך עובר הזמן ומה כל מסך עושה" onClick={() => setOpen(true)}>{label}</button>
      {open && <HowToPlay inGame={inGame} onClose={() => { setOpen(false); onClosed?.(); }} />}
    </>
  );
}
