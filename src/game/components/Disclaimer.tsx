import { useEffect, useRef, useState } from 'react';

const KEY = 'hakise.disclaimer.v1';
const seen = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return false; } };

/** Opening notice: satire, not meant to offend, politically neutral. Shown until the player ticks "don't show again". */
export function Disclaimer() {
  const [open, setOpen] = useState(() => !seen());
  const [remember, setRemember] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (open) btn.current?.focus(); }, [open]);
  if (!open) return null;
  const close = () => {
    if (remember) { try { localStorage.setItem(KEY, '1'); } catch { /* storage blocked: show again next time */ } }
    setOpen(false);
  };
  return (
    <div className="backdrop" style={{ zIndex: 80 }} onKeyDown={(e) => { if (e.key === 'Escape') close(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="disclaimer-title" style={{ maxWidth: 520 }}>
        <div className="p-6 space-y-3">
          <h2 id="disclaimer-title" className="text-2xl font-black">לפני שמתחילים</h2>
          <p className="leading-relaxed">ממשלת ישמעאל הוא משחק סימולציה פוליטי בסגנון סאטירה ופרודיה. המדינה, המפלגות, הדמויות והאירועים במשחק בדיוניים, וכל דמיון למציאות מקרי.</p>
          <p className="leading-relaxed">המשחק לא נועד לפגוע באף אדם, ציבור או מגזר, ואינו מביע עמדה פוליטית או ממליץ להצביע לאף מפלגה. האפשרויות במשחק הן חלק מהסימולציה ואינן מרמזות על דבר.</p>
          <p className="text-sm muted">המשך המשחק מהווה הסכמה ל<a href="/terms/" style={{ textDecoration: 'underline' }}>תנאי השימוש</a>.</p>
          <label className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            אל תציג שוב
          </label>
          <div className="flex justify-end">
            <button ref={btn} className="btn btn-primary" onClick={close}>הבנתי, אפשר להתחיל</button>
          </div>
        </div>
      </div>
    </div>
  );
}
