// Cookie consent banner for the site and the game (no framework, so the static pages can use it too).
// The choice is stored in the browser and sent to Google through Consent Mode (see public/consent-defaults.js).

const KEY = 'hakise.consent.v1';
type Choice = { ads: 'granted' | 'denied'; at: string };

const read = (): Choice | null => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Choice | null; } catch { return null; } };
const save = (c: Choice) => { try { localStorage.setItem(KEY, JSON.stringify(c)); } catch { /* storage blocked: ask again next visit */ } };

const CSS = `
.consent{position:fixed;inset-inline:12px;bottom:12px;z-index:90;max-width:640px;margin-inline:auto;background:#fff;color:#1d1b3a;border:1px solid rgba(60,50,140,.18);border-radius:16px;box-shadow:0 24px 60px -20px rgba(29,15,90,.55);padding:16px 18px;font:500 15px/1.6 Rubik,system-ui,sans-serif;direction:rtl}
.consent h2{margin:0 0 4px;font-size:16px;font-weight:800}
.consent p{margin:0 0 12px}
.consent a{color:#4b2fd6;text-decoration:underline}
.consent .row{display:flex;flex-wrap:wrap;gap:8px}
.consent button{font:inherit;font-weight:700;border-radius:10px;padding:9px 16px;cursor:pointer;border:2px solid #4b2fd6}
.consent .yes{background:#4b2fd6;color:#fff}
.consent .no{background:#fff;color:#4b2fd6}
.consent button:focus-visible{outline:3px solid #ffc61a;outline-offset:2px}
`;

function apply(c: Choice) {
  const g = (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag;
  g?.('consent', 'update', { ad_storage: c.ads, ad_user_data: c.ads, ad_personalization: c.ads });
}

let el: HTMLElement | null = null;

export function openConsent() {
  if (el) { el.querySelector<HTMLButtonElement>('button')?.focus(); return; }
  if (!document.getElementById('consent-css')) {
    const st = document.createElement('style');
    st.id = 'consent-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  el = document.createElement('section');
  el.className = 'consent';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'הודעת עוגיות');
  el.innerHTML = `
    <h2>עוגיות ופרסומות</h2>
    <p>האתר מציג פרסומות של Google, שמשתמשות בעוגיות. אפשר לאשר פרסומות מותאמות אישית, או להמשיך רק עם עוגיות הכרחיות ופרסומות כלליות. אפשר לשנות את הבחירה בכל רגע. <a href="/privacy/">פרטים במדיניות הפרטיות</a>.</p>
    <div class="row">
      <button type="button" class="yes">מאשר</button>
      <button type="button" class="no">רק הכרחיות</button>
    </div>`;
  const choose = (ads: Choice['ads']) => {
    const c: Choice = { ads, at: new Date().toISOString() };
    save(c);
    apply(c);
    el?.remove();
    el = null;
  };
  el.querySelector('.yes')!.addEventListener('click', () => choose('granted'));
  el.querySelector('.no')!.addEventListener('click', () => choose('denied'));
  document.body.appendChild(el);
}

/** Shows the banner on the first visit and wires every "cookie settings" link ([data-consent-open]). */
export function initConsent() {
  document.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement | null)?.closest?.('[data-consent-open]');
    if (t) { e.preventDefault(); openConsent(); }
  });
  if (!read()) openConsent();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initConsent);
  else initConsent();
}
