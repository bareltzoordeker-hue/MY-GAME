import { useEffect, useRef, useState } from 'react';
import { t } from '../../shared/i18n';

const KEY = 'hakise.disclaimer.v2';
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
          <h2 id="disclaimer-title" className="text-2xl font-black">{t('disc.title')}</h2>
          <p className="leading-relaxed">{t('disc.p1')}</p>
          <p className="leading-relaxed">{t('disc.p2')}</p>
          <p className="leading-relaxed">{t('disc.p3')}</p>
          <p className="text-sm muted"><a href="/terms/" style={{ textDecoration: 'underline' }}>{t('disc.terms')}</a></p>
          <label className="flex items-center gap-2 text-sm" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            {t('disc.dontShow')}
          </label>
          <div className="flex justify-end">
            <button ref={btn} className="btn btn-primary" onClick={close}>{t('disc.ok')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
