// ============================================================
// Interface languages: Hebrew (default), English, Arabic.
// The interface (menus, navigation, headers, buttons) is translated;
// game content is written in Hebrew first and translated over time.
// ============================================================
import { DICT, type Key } from './dict';

export type Lang = 'he' | 'en' | 'ar';
export const LANGS: { id: Lang; name: string; dir: 'rtl' | 'ltr' }[] = [
  { id: 'he', name: 'עברית', dir: 'rtl' },
  { id: 'en', name: 'English', dir: 'ltr' },
  { id: 'ar', name: 'العربية', dir: 'rtl' },
];
const KEY = 'hakise.lang';
export const LANG_EVENT = 'hakise:lang';

let current: Lang = (() => {
  try { const v = localStorage.getItem(KEY); return v === 'en' || v === 'ar' ? v : 'he'; } catch { return 'he'; }
})();

export const getLang = (): Lang => current;

/** Applies lang/dir to <html>. Call once at start and after every change. */
export function applyLang(): void {
  if (typeof document === 'undefined') return;
  const def = LANGS.find((l) => l.id === current)!;
  document.documentElement.lang = current;
  document.documentElement.dir = def.dir;
}

export function setLang(l: Lang): void {
  current = l;
  try { localStorage.setItem(KEY, l); } catch { /* storage blocked: the choice lasts for this visit */ }
  applyLang();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LANG_EVENT));
}

/** Translate a key; {name} placeholders are filled from vars. Falls back to Hebrew. */
export function t(key: Key, vars?: Record<string, string | number>): string {
  let s = DICT[current][key] ?? DICT.he[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
  return s;
}

/** "2 weeks" / "4 months" / "a year and 2 months" in the current language ('' for Hebrew: callers keep their Hebrew text). */
export function spanL(days: number): string {
  if (current === 'he') return '';
  const en = current === 'en';
  if (days < 60) {
    const w = Math.max(1, Math.round(days / 7));
    return en ? (w === 1 ? '1 week' : `${w} weeks`) : (w === 1 ? 'أسبوع' : w === 2 ? 'أسبوعان' : `${w} أسابيع`);
  }
  const months = Math.round(days / 30.4);
  if (months < 12) return en ? `${months} months` : `${months} أشهر`;
  const y = Math.floor(months / 12);
  const r = months % 12;
  if (en) return r ? `${y} year${y > 1 ? 's' : ''} ${r} mo.` : `${y} year${y > 1 ? 's' : ''}`;
  return r ? `${y === 1 ? 'سنة' : `${y} سنوات`} و${r} أشهر` : y === 1 ? 'سنة' : `${y} سنوات`;
}

const MONTHS: Record<Lang, string[]> = {
  he: [],
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ar: ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'],
};

/** A game date in the interface language ('' for Hebrew: callers keep their Hebrew label). */
export function dateL(d: { year: number; month: number; day?: number }): string {
  if (current === 'he') return '';
  return `${d.day ? `${d.day} ` : ''}${MONTHS[current][d.month - 1]} ${d.year}`;
}

applyLang();
