// Accessibility menu (♿) for the site and the game: text size, high contrast, stop animations.
// Settings live in localStorage and are applied as classes on <html> (styles in shared/styles/a11y.css).

const KEY = 'hakise.a11y';
type Prefs = { text: 0 | 1 | 2; contrast: boolean; still: boolean };
const DEFAULTS: Prefs = { text: 0, contrast: false, still: false };

const load = (): Prefs => { try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...DEFAULTS }; } };
const store = (p: Prefs) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* storage blocked */ } };

function apply(p: Prefs) {
  const c = document.documentElement.classList;
  c.toggle('a11y-text-1', p.text === 1);
  c.toggle('a11y-text-2', p.text === 2);
  c.toggle('a11y-contrast', p.contrast);
  c.toggle('a11y-still', p.still);
}

export function initA11yMenu() {
  let prefs = load();
  apply(prefs);
  const wrap = document.createElement('div');
  wrap.className = 'a11y-menu';
  wrap.innerHTML = `
    <button type="button" class="a11y-toggle" aria-expanded="false" aria-controls="a11y-panel" aria-label="תפריט נגישות">♿</button>
    <div class="a11y-panel" id="a11y-panel" role="group" aria-label="הגדרות נגישות" hidden>
      <div class="a11y-title">נגישות</div>
      <button type="button" data-a11y="text" aria-pressed="false">גודל טקסט: <span></span></button>
      <button type="button" data-a11y="contrast" aria-pressed="false">ניגודיות גבוהה</button>
      <button type="button" data-a11y="still" aria-pressed="false">עצירת אנימציות</button>
      <button type="button" data-a11y="reset">איפוס</button>
      <a href="/accessibility/">הצהרת נגישות</a>
    </div>`;
  const toggle = wrap.querySelector<HTMLButtonElement>('.a11y-toggle')!;
  const panel = wrap.querySelector<HTMLElement>('.a11y-panel')!;
  const sizes = ['רגיל', 'גדול', 'גדול מאוד'];
  const render = () => {
    apply(prefs);
    panel.querySelector('[data-a11y="text"] span')!.textContent = sizes[prefs.text];
    panel.querySelector('[data-a11y="text"]')!.setAttribute('aria-pressed', String(prefs.text > 0));
    panel.querySelector('[data-a11y="contrast"]')!.setAttribute('aria-pressed', String(prefs.contrast));
    panel.querySelector('[data-a11y="still"]')!.setAttribute('aria-pressed', String(prefs.still));
  };
  const open = (on: boolean) => {
    panel.hidden = !on;
    toggle.setAttribute('aria-expanded', String(on));
    if (on) panel.querySelector<HTMLButtonElement>('button')?.focus();
  };
  toggle.addEventListener('click', () => open(panel.hidden));
  panel.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a11y]');
    if (!b) return;
    const k = b.dataset.a11y;
    if (k === 'text') prefs = { ...prefs, text: ((prefs.text + 1) % 3) as Prefs['text'] };
    else if (k === 'contrast') prefs = { ...prefs, contrast: !prefs.contrast };
    else if (k === 'still') prefs = { ...prefs, still: !prefs.still };
    else if (k === 'reset') prefs = { ...DEFAULTS };
    store(prefs);
    render();
  });
  wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !panel.hidden) { open(false); toggle.focus(); } });
  document.addEventListener('click', (e) => { if (!panel.hidden && !wrap.contains(e.target as Node)) open(false); });
  document.body.appendChild(wrap);
  render();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initA11yMenu);
  else initA11yMenu();
}
