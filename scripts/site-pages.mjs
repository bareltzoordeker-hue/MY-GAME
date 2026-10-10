// Static site pages in English and Arabic.
//   node scripts/site-pages.mjs extract   → writes docs/tr/site.he.tsv (one Hebrew unit per line, for translating)
//   node scripts/site-pages.mjs build     → reads docs/tr/site.tsv (he \t en \t ar) and writes pages/en/** and pages/ar/**
// The Hebrew pages stay the single source; a "unit" is the inner HTML of a text block (inline markup kept as is),
// or an attribute value (title, alt, aria-label, description, og:*).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Window } from 'happy-dom';

const PAGES = ['index.html', '404.html', 'how-to-play/index.html', 'privacy/index.html', 'terms/index.html', 'about/index.html', 'contact/index.html', 'accessibility/index.html'];
const HEB = /[֐-׿]/;
const INLINE = new Set(['A', 'STRONG', 'EM', 'B', 'I', 'SPAN', 'SMALL', 'BR', 'CODE', 'KBD', 'ABBR', 'MARK', 'U', 'IMG']);
const SKIP = new Set(['SCRIPT', 'STYLE']);
const ATTRS = ['alt', 'aria-label', 'title', 'placeholder'];
const META = [['meta[name="description"]', 'content'], ['meta[property="og:title"]', 'content'], ['meta[property="og:description"]', 'content'], ['meta[property="og:site_name"]', 'content']];
const root = join(import.meta.dirname, '..');
const norm = (s) => s.replace(/\s+/g, ' ').trim();

function parse(file) {
  const win = new Window();
  win.document.write(readFileSync(join(root, 'pages', file), 'utf8'));
  return win;
}

/** Every unit in a page: [element-or-null, kind, key]. */
function units(doc) {
  const out = [];
  const walk = (el) => {
    if (SKIP.has(el.tagName)) return;
    for (const a of ATTRS) { const v = el.getAttribute?.(a); if (v && HEB.test(v)) out.push({ el, attr: a, key: norm(v) }); }
    const kids = [...el.children];
    const textual = [...el.childNodes].some((n) => n.nodeType === 3 && HEB.test(n.textContent));
    const inlineOnly = kids.every((k) => INLINE.has(k.tagName));
    if (textual && inlineOnly) {
      out.push({ el, attr: null, key: norm(el.innerHTML) });
      for (const k of kids) for (const a of ATTRS) { const v = k.getAttribute?.(a); if (v && HEB.test(v)) out.push({ el: k, attr: a, key: norm(v) }); }
      return;
    }
    if (textual) console.warn('mixed text and blocks in', el.tagName, norm(el.textContent).slice(0, 50));
    for (const k of kids) walk(k);
  };
  walk(doc.body);
  for (const [sel, attr] of META) { const e = doc.querySelector(sel); const v = e?.getAttribute(attr); if (v && HEB.test(v)) out.push({ el: e, attr, key: norm(v) }); }
  const t = doc.querySelector('title');
  if (t && HEB.test(t.textContent)) out.push({ el: t, attr: null, key: norm(t.innerHTML) });
  return out;
}

const cmd = process.argv[2];
if (cmd === 'extract') {
  const seen = new Set();
  for (const f of PAGES) for (const u of units(parse(f).document)) seen.add(u.key);
  writeFileSync(join(root, 'docs/tr/site.he.tsv'), [...seen].join('\n') + '\n', 'utf8');
  console.log(seen.size, 'units');
} else if (cmd === 'build') {
  const dict = { en: new Map(), ar: new Map() };
  for (const line of readFileSync(join(root, 'docs/tr/site.tsv'), 'utf8').split('\n')) {
    const [he, en, ar] = line.split('\t');
    if (he && en) dict.en.set(norm(he), en);
    if (he && ar) dict.ar.set(norm(he), ar);
  }
  const NAME = { en: 'English', ar: 'العربية', he: 'עברית' };
  let missing = 0;
  for (const lang of ['en', 'ar']) {
    for (const f of PAGES) {
      if (f === '404.html') continue;
      const win = parse(f);
      const doc = win.document;
      doc.documentElement.setAttribute('lang', lang);
      doc.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
      for (const u of units(doc)) {
        const tr = dict[lang].get(u.key);
        if (!tr) { missing++; console.warn(`MISSING ${lang} ${f}: ${u.key.slice(0, 70)}`); continue; }
        if (u.attr) u.el.setAttribute(u.attr, tr); else u.el.innerHTML = tr;
      }
      // internal links stay inside the language; the game gets ?lang=
      for (const a of doc.querySelectorAll('a[href]')) {
        const h = a.getAttribute('href');
        if (h.startsWith('/game/')) a.setAttribute('href', h.includes('?') ? h : `/game/?lang=${lang}`);
        else if (/^\/(how-to-play|about|privacy|terms|contact|accessibility)?\/?(#.*)?$/.test(h) && !h.startsWith('/game')) a.setAttribute('href', `/${lang}${h === '/' ? '/' : h}`);
      }
      const loc = doc.querySelector('meta[property="og:locale"]'); if (loc) loc.setAttribute('content', lang === 'en' ? 'en_US' : 'ar_AR');
      const rel = f === 'index.html' ? '' : f.replace(/index\.html$/, '');
      // language switcher: Hebrew + the other language, replacing the old game-only links
      const pick = doc.querySelector('.lang-pick');
      const links = [['he', `/${rel}`], ...['en', 'ar'].filter((l) => l !== lang).map((l) => [l, `/${l}/${rel}`])];
      if (pick) pick.innerHTML = links.map(([l, h]) => `<a href="${h}" lang="${l}" hreflang="${l}">${NAME[l]}</a>`).join(' · ');
      const outFile = join(root, 'pages', lang, f);
      mkdirSync(dirname(outFile), { recursive: true });
      writeFileSync(outFile, '<!doctype html>\n' + doc.documentElement.outerHTML + '\n', 'utf8');
    }
  }
  console.log(missing ? `${missing} units still missing` : 'all units translated');
}
