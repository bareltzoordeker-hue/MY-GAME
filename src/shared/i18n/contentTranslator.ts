// ============================================================
// Runtime translator for game content (Hebrew -> English / Arabic).
// The game text lives in many places in the code, so instead of touching every
// component we translate the rendered DOM: exact strings from a dictionary,
// plus patterns for sentences with embedded values. Loaded only for en / ar.
// ============================================================
import { LANG_EVENT, getLang, type Lang } from './index';
import { PATTERNS as BASE_PATTERNS, type Pattern } from './patterns';
import { EXTRA_PATTERNS } from './patterns.extra';

// most specific (longest fixed text) first, so a general "{0} seats" never shadows a full sentence
const PATTERNS: Pattern[] = [...BASE_PATTERNS, ...EXTRA_PATTERNS].sort(
  (a, b) => b[0].replace(/\{#?\d\}/g, '').length - a[0].replace(/\{#?\d\}/g, '').length,
);

const HEB = /[֐-׿]/;
const ATTRS = ['data-tip', 'aria-label', 'placeholder', 'title', 'alt'] as const;

type Dict = Record<string, string>;
const dicts: Partial<Record<Lang, Dict>> = {};

interface Compiled { re: RegExp; idx: number; num: boolean[] }
let compiled: Compiled[] | null = null;

function compile(): Compiled[] {
  return PATTERNS.map((p, idx) => {
    const num: boolean[] = [];
    const src = p[0]
      .replace(/[.*+?^$()|[\]\\]/g, '\\$&')
      .replace(/\{(#?)(\d)\}/g, (_m, hash: string, n: string) => {
        num[Number(n)] = hash === '#';
        return hash ? '([\\d.,+\\-–%]+)' : '(.*?)';
      });
    return { re: new RegExp(`^${src}$`), idx, num };
  });
}

function fromPattern(text: string, lang: Lang): string | null {
  compiled ??= compile();
  for (const c of compiled) {
    const m = c.re.exec(text);
    if (!m) continue;
    const p: Pattern = PATTERNS[c.idx];
    const fixed = p[3];
    let ok = true;
    const out = (lang === 'en' ? p[1] : p[2]).replace(/\{#?(\d)\}/g, (_x, n: string) => {
      const raw = m[Number(n) + 1] ?? '';
      const f = fixed?.[Number(n)]?.[raw];
      if (f) return lang === 'en' ? f[0] : f[1];
      if (!HEB.test(raw)) return raw;
      const tr = translate(raw, lang);
      // a value we cannot fully translate means this pattern is the wrong one (it was too general)
      if (tr === null || HEB.test(tr)) { ok = false; return raw; }
      return tr;
    });
    if (ok) return out;
  }
  return null;
}

const WORD = /[֐-׿״׳]+/g;
const PREFIX: Record<string, [string, string]> = { 'ל': ['to ', 'إلى '], 'ב': ['in ', 'في '], 'מ': ['from ', 'من '], 'ו': ['and ', 'و'] };

/** Fallback for sentences built from known pieces (names, titles, labels): swaps each known phrase in place. */
function inline(text: string, d: Dict, lang: Lang): string | null {
  const words = [...text.matchAll(WORD)].map((m) => ({ w: m[0], s: m.index!, e: m.index! + m[0].length }));
  if (!words.length) return null;
  let out = '';
  let pos = 0;
  let hits = 0;
  for (let i = 0; i < words.length;) {
    let done = false;
    for (let n = Math.min(6, words.length - i); n >= 1 && !done; n--) {
      const span = text.slice(words[i].s, words[i + n - 1].e);
      if (span.indexOf('  ') >= 0 || (n > 1 && /[^֐-׿״׳ ]/.test(span))) continue;
      let hit = d[span];
      let pre = '';
      if (hit === undefined && span.length > 4) {
        const p = PREFIX[span[0]];
        const rest = d[span.slice(1)];
        if (p && rest !== undefined) { hit = rest; pre = lang === 'en' ? p[0] : p[1]; }
      }
      if (hit === undefined || (n === 1 && span.length < 3 && pre === '')) continue;
      out += text.slice(pos, words[i].s) + pre + hit;
      pos = words[i + n - 1].e;
      i += n;
      hits++;
      done = true;
    }
    if (!done) i++;
  }
  if (!hits) return null;
  // only accept when the sentence ends up mostly translated: half-Hebrew half-English reads worse than the original
  const result = out + text.slice(pos);
  const before = (text.match(WORD) ?? []).length;
  const after = (result.match(WORD) ?? []).length;
  return after <= before * 0.35 ? result : null;
}

const LEAD = /^[^\p{L}\p{N}"'₪]+/u;
const COARSE = /( · | ✦ | → |\n)/;
const SENTENCE = /((?<=[.!?]) )/;

function whole(norm: string, d: Dict, lang: Lang): string | null {
  const hit = d[norm];
  if (hit !== undefined) return hit;
  const p = fromPattern(norm, lang);
  if (p !== null) return p;
  const sym = LEAD.exec(norm)?.[0] ?? '';
  if (!sym) return null;
  const core = norm.slice(sym.length);
  const r = d[core] ?? fromPattern(core, lang);
  return r === null || r === undefined ? null : sym + r;
}

/** "label: value" – accepted only when both halves translate completely. */
function byColon(norm: string, d: Dict, lang: Lang): string | null {
  const i = norm.indexOf(': ');
  if (i < 2) return null;
  const a = whole(norm.slice(0, i), d, lang) ?? (HEB.test(norm.slice(0, i)) ? null : norm.slice(0, i));
  const b = whole(norm.slice(i + 2), d, lang) ?? bySegments(norm.slice(i + 2), d, lang) ?? (HEB.test(norm.slice(i + 2)) ? null : norm.slice(i + 2));
  if (a === null || b === null || HEB.test(a + b)) return null;
  return `${a}: ${b}`;
}

/** Splits on `sep`, translating each Hebrew piece with `fn`; null when no piece changed. */
function pieces(norm: string, sep: RegExp, fn: (p: string) => string | null): string | null {
  const parts = norm.split(sep);
  if (parts.length < 3) return null;
  let any = false;
  const out = parts.map((p, i) => {
    if (i % 2 === 1 || !HEB.test(p)) return p;
    const r = fn(p.trim());
    if (r === null) return p;
    any = true;
    return r;
  });
  return any ? out.join('') : null;
}

/** Translates a longer text piece by piece: "a · b" lists first, then sentence by sentence. */
function bySegments(norm: string, d: Dict, lang: Lang): string | null {
  const sentences = (seg: string) => pieces(seg, SENTENCE, (s) => whole(s, d, lang) ?? inline(s, d, lang));
  return pieces(norm, COARSE, (seg) => whole(seg, d, lang) ?? inline(seg, d, lang) ?? sentences(seg)) ?? sentences(norm);
}

/** Translates one Hebrew string; returns null when there is nothing to translate. */
export function translate(text: string, lang: Lang = getLang()): string | null {
  if (lang === 'he' || !HEB.test(text)) return null;
  const d = dicts[lang];
  if (!d) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;
  const lead = text.slice(0, text.length - text.trimStart().length);
  const tail = text.slice(text.trimEnd().length);
  const norm = trimmed.replace(/\s+/g, ' ');
  const run = (s: string): string | null => d[s] ?? fromPattern(s, lang) ?? bySegments(s, d, lang) ?? byColon(s, d, lang) ?? inline(s, d, lang);
  let out = run(norm);
  if (out === null) {
    // leading bullets, arrows, emoji or ": " – translate what follows and keep the symbols
    const sym = LEAD.exec(norm)?.[0] ?? '';
    const core = norm.slice(sym.length);
    const r = sym && HEB.test(core) ? run(core) : null;
    if (r !== null) out = sym + r;
  }
  return out === null ? null : lead + out + tail;
}

// ---- DOM pass --------------------------------------------------------------
const origText = new WeakMap<Text, string>();
const appliedText = new WeakMap<Text, string>();
const origAttr = new WeakMap<Element, Map<string, string>>();
const appliedAttr = new WeakMap<Element, Map<string, string>>();
let observer: MutationObserver | null = null;

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT']);

function doText(n: Text, lang: Lang): void {
  const cur = n.nodeValue ?? '';
  if (appliedText.get(n) === cur) return;
  const out = translate(cur, lang);
  if (out === null || out === cur) return;
  origText.set(n, cur);
  appliedText.set(n, out);
  n.nodeValue = out;
}

function doAttrs(el: Element, lang: Lang): void {
  for (const a of ATTRS) {
    const cur = el.getAttribute(a);
    if (cur === null || appliedAttr.get(el)?.get(a) === cur) continue;
    const out = translate(cur, lang);
    if (out === null || out === cur) continue;
    if (!origAttr.has(el)) origAttr.set(el, new Map());
    if (!appliedAttr.has(el)) appliedAttr.set(el, new Map());
    origAttr.get(el)!.set(a, cur);
    appliedAttr.get(el)!.set(a, out);
    el.setAttribute(a, out);
  }
}

function walk(root: Node, lang: Lang): void {
  if (root.nodeType === Node.TEXT_NODE) {
    if (!SKIP.has((root.parentElement?.tagName) ?? '')) doText(root as Text, lang);
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (SKIP.has(el.tagName)) return;
  doAttrs(el, lang);
  for (let c = el.firstChild; c; c = c.nextSibling) walk(c, lang);
}

function restore(root: Node): void {
  if (root.nodeType === Node.TEXT_NODE) {
    const t = root as Text;
    const o = origText.get(t);
    if (o !== undefined && appliedText.get(t) === t.nodeValue) t.nodeValue = o;
    return;
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  const oa = origAttr.get(el);
  if (oa) for (const [a, v] of oa) if (appliedAttr.get(el)?.get(a) === el.getAttribute(a)) el.setAttribute(a, v);
  for (let c = el.firstChild; c; c = c.nextSibling) restore(c);
}

function startObserver(): void {
  if (observer || typeof MutationObserver === 'undefined') return;
  observer = new MutationObserver((muts) => {
    const lang = getLang();
    if (lang === 'he') return;
    for (const m of muts) {
      if (m.type === 'characterData') walk(m.target, lang);
      else if (m.type === 'attributes') doAttrs(m.target as Element, lang);
      else m.addedNodes.forEach((n) => walk(n, lang));
    }
  });
  observer.observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...ATTRS],
  });
}

export async function load(lang: Lang): Promise<void> {
  if (lang === 'he' || dicts[lang]) return;
  dicts[lang] = (await (lang === 'en' ? import('./content.en') : import('./content.ar'))).default;
}

async function apply(): Promise<void> {
  const lang = getLang();
  if (lang === 'he') {
    restore(document.body);
    return;
  }
  await load(lang);
  if (getLang() !== lang) return;
  walk(document.body, lang);
  startObserver();
}

/** Call once at startup: translates game content whenever the interface language is not Hebrew. */
export function initContentTranslation(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener(LANG_EVENT, () => { void apply(); });
  if (getLang() !== 'he') void apply();
}
