// Builds the article pages in Hebrew, English and Arabic from scripts/articles.data.mjs.
//   node scripts/articles.mjs
// The header, footer and head scaffold are copied from each language's "about" page, so the articles always look like the rest of the site.
// Run scripts/site-pages.mjs build first when the Hebrew pages change.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ARTICLES, UI } from './articles.data.mjs';

const root = join(import.meta.dirname, '..');
const SITE = 'https://memsheletismael.netlify.app';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const read = (p) => readFileSync(join(root, 'pages', p), 'utf8');
const write = (p, html) => { mkdirSync(join(root, 'pages', p, '..'), { recursive: true }); writeFileSync(join(root, 'pages', p), html, 'utf8'); };

function scaffold(lang) {
  const about = read(lang.prefix ? `${lang.prefix.slice(1)}/about/index.html` : 'about/index.html');
  const header = about.match(/<header class="site-header">[\s\S]*?<\/header>/)[0];
  const footer = about.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0];
  const skip = about.match(/<a[^>]*class="skip-link"[^>]*>[^<]*<\/a>/)[0];
  const consent = about.match(/<script[^>]*consent-defaults[^>]*><\/script>/)[0];
  const ads = about.match(/<script[^>]*pagead2[^>]*><\/script>/)[0];
  const tail = about.match(/<script[^>]*shared\/site\.ts[^>]*><\/script>/)[0];
  return { header, footer, skip, consent, ads, tail };
}

function page(lang, sc, { path, title, desc, hero, body }) {
  const alt = (l) => `${SITE}${UI[l].prefix}${path}`;
  return `<!doctype html>
<html lang="${lang.lang}" dir="${lang.dir}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)} – ${esc(lang.suffix)}</title>
    <meta name="description" content="${esc(desc)}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(desc)}" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <link rel="stylesheet" href="/src/landing/styles/site.css" />
    ${sc.consent}
    ${sc.ads}
    <link rel="alternate" hreflang="he" href="${alt('he')}" />
    <link rel="alternate" hreflang="en" href="${alt('en')}" />
    <link rel="alternate" hreflang="ar" href="${alt('ar')}" />
    <link rel="alternate" hreflang="x-default" href="${alt('he')}" />
  </head>
  <body>
    ${sc.skip}
    ${sc.header}
    <main id="main">
      <section class="page-hero"><div class="wrap">${hero}</div></section>
      <div class="wrap">${body}</div>
    </main>
    ${sc.footer}
    ${sc.tail}
  </body>
</html>
`;
}

const urls = [];
for (const code of ['he', 'en', 'ar']) {
  const lang = UI[code];
  const sc = scaffold(lang);
  const dir = `${lang.prefix.replace('/', '')}${lang.prefix ? '/' : ''}articles`;
  // the index
  const cards = ARTICLES.map((a) => `<li class="card"><h2><a href="${lang.prefix}/articles/${a.slug}/">${esc(a[code].title)}</a></h2><p>${esc(a[code].desc)}</p><p><a href="${lang.prefix}/articles/${a.slug}/">${esc(lang.read)} →</a></p></li>`).join('\n          ');
  write(`${dir}/index.html`, page(lang, sc, {
    path: '/articles/', title: lang.indexTitle, desc: lang.indexSub,
    hero: `<h1>${esc(lang.indexTitle)}</h1><p>${esc(lang.indexSub)}</p>`,
    body: `<article class="prose"><ul style="list-style:none;padding:0;display:grid;gap:14px">\n          ${cards}\n        </ul></article>`,
  }));
  urls.push(`${lang.prefix}/articles/`);
  for (const a of ARTICLES) {
    const t = a[code];
    const sections = t.sections.map(([h, ...ps]) => `<h2>${esc(h)}</h2>\n        ${ps.map((p) => `<p>${esc(p)}</p>`).join('\n        ')}`).join('\n        ');
    write(`${dir}/${a.slug}/index.html`, page(lang, sc, {
      path: `/articles/${a.slug}/`, title: t.title, desc: t.desc,
      hero: `<h1>${esc(t.title)}</h1><p>${esc(t.desc)}</p>`,
      body: `<article class="prose">\n        ${sections}\n        <p style="margin-top: 28px"><strong>${esc(lang.cta)}</strong></p>\n        <p><a class="btn btn-play" href="${lang.game}">${esc(lang.ctaBtn)}</a> <a href="${lang.prefix}/articles/">${esc(lang.back)}</a></p>\n      </article>`,
    }));
    urls.push(`${lang.prefix}/articles/${a.slug}/`);
  }
}

// the sitemap
const sm = readFileSync(join(root, 'public/sitemap.xml'), 'utf8');
const fresh = urls.filter((u) => !sm.includes(`<loc>${SITE}${u}</loc>`));
if (fresh.length) writeFileSync(join(root, 'public/sitemap.xml'), sm.replace('</urlset>', fresh.map((u) => `  <url><loc>${SITE}${u}</loc><lastmod>2026-11-10</lastmod><priority>0.6</priority></url>\n`).join('') + '</urlset>'), 'utf8');
console.log(`articles: ${urls.length} pages, ${fresh.length} added to the sitemap`);
