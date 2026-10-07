// Keyboard and screen-reader support for the game's popups and controls (IS 5568 / WCAG 2.0 AA).
// Works on any `.backdrop` dialog, so every modal in the game gets the same behaviour without touching each one.

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const ICON_NAMES: Record<string, string> = { '✕': 'סגירה', '☰': 'תפריט', '?': 'הסבר', '🔊': 'אפקטים קוליים', '🔇': 'אפקטים קוליים (מושתק)', '🎺': 'מוזיקת רקע' };
const CLOSE_TEXT = /^(✕|סגור|סגירה|הבנתי|ביטול|לעבודה|המשך)/;

const topDialog = () => { const all = document.querySelectorAll<HTMLElement>('.backdrop'); return all[all.length - 1] ?? null; };
const focusables = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((e) => e.offsetParent !== null || e === document.activeElement);

/** Buttons that show only an icon, and inputs without a visible label, get a name for screen readers. */
function labelControls(root: ParentNode) {
  root.querySelectorAll<HTMLButtonElement>('button:not([aria-label])').forEach((b) => {
    const text = (b.textContent ?? '').trim();
    if (/[\p{L}\p{N}]{2,}/u.test(text)) return; // has a readable word
    const name = ICON_NAMES[text] ?? b.getAttribute('data-tip') ?? b.getAttribute('title');
    if (name) b.setAttribute('aria-label', name);
  });
  root.querySelectorAll<HTMLElement>('input:not([aria-label]):not([type=hidden]), select:not([aria-label])').forEach((el) => {
    if (el.id && document.querySelector(`label[for="${el.id}"]`)) return;
    if (el.closest('label')) return;
    const prev = el.previousElementSibling;
    const name = el.getAttribute('placeholder') ?? el.getAttribute('data-tip') ?? (prev?.classList.contains('label') ? prev.textContent : null);
    if (name) el.setAttribute('aria-label', name.trim());
  });
}

export function initGameA11y() {
  const opener = new WeakMap<HTMLElement, Element | null>();
  let pending = false;
  const scan = () => {
    pending = false;
    labelControls(document);
    document.querySelectorAll<HTMLElement>('.backdrop:not([data-a11y])').forEach((d) => {
      d.dataset.a11y = '1';
      const box = d.querySelector<HTMLElement>('.modal, [role=dialog]') ?? d;
      if (!box.getAttribute('role')) box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      opener.set(d, document.activeElement);
      if (!d.contains(document.activeElement)) focusables(d)[0]?.focus();
    });
  };
  new MutationObserver((muts) => {
    for (const m of muts) m.removedNodes.forEach((n) => {
      if (n instanceof HTMLElement && n.classList.contains('backdrop')) {
        const back = opener.get(n);
        if (back instanceof HTMLElement && document.contains(back)) back.focus();
      }
    });
    if (!pending) { pending = true; requestAnimationFrame(scan); }
  }).observe(document.body, { childList: true, subtree: true });
  scan();

  document.addEventListener('keydown', (e) => {
    const d = topDialog();
    if (!d) return;
    if (e.key === 'Escape') {
      const close = [...d.querySelectorAll<HTMLButtonElement>('button:not([disabled])')].find((b) => b.getAttribute('aria-label') === 'סגירה' || CLOSE_TEXT.test((b.textContent ?? '').trim()));
      if (close) { e.preventDefault(); close.click(); }
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables(d);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (!d.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}

if (typeof document !== 'undefined') initGameA11y();
