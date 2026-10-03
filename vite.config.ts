/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// Multi-page site. Each route is an HTML entry under pages/, which is the Vite root,
// so the folder layout of pages/ is the URL layout of the site:
//   pages/index.html              → /             landing page (static, no JS)
//   pages/game/index.html         → /game/        the game (React app, src/game)
//   pages/how-to-play/index.html  → /how-to-play/
//   pages/{privacy,terms,about,contact}/index.html
const PAGES = ['game', 'how-to-play', 'privacy', 'terms', 'about', 'contact'];
const r = (p: string) => resolve(__dirname, p);
const netlifyCsp = () => readFileSync(r('netlify.toml'), 'utf8').match(/Content-Security-Policy = "([^"]+)"/)?.[1] ?? '';

/** "/game" → "/game/" in dev and preview, like static hosts do. */
function trailingSlash(): Plugin {
  const redirect = (url: string | undefined) => {
    const path = (url ?? '').split('?')[0];
    return PAGES.map((p) => `/${p}`).includes(path) ? `${path}/` : null;
  };
  const mw = (req: { url?: string }, res: { statusCode: number; setHeader: (k: string, v: string) => void; end: () => void }, next: () => void) => {
    const to = redirect(req.url);
    if (!to) return next();
    res.statusCode = 301;
    res.setHeader('Location', to);
    res.end();
  };
  return {
    name: 'trailing-slash',
    configureServer(server) { server.middlewares.use(mw); },
    configurePreviewServer(server) { server.middlewares.use(mw); },
  };
}

/** Social previews need absolute image URLs. Netlify sets URL at build time; SITE_URL overrides it. */
function absoluteOgImage(): Plugin {
  const site = (process.env.SITE_URL || process.env.URL || '').replace(/\/$/, '');
  return {
    name: 'absolute-og-image',
    transformIndexHtml: (html) => (site ? html.replace(/(<meta (?:property="og:image"|name="twitter:image") content=")\//g, `$1${site}/`) : html),
  };
}

export default defineConfig({
  root: r('pages'),
  publicDir: r('public'),
  cacheDir: r('node_modules/.vite'), // default would be pages/node_modules/.vite

  appType: 'mpa',
  // Pages live in pages/, code in src/: HTML references code as "/src/…" in dev and build alike.
  resolve: { alias: [{ find: /^\/src\//, replacement: `${r('src')}/` }] },
  plugins: [react(), tailwindcss(), trailingSlash(), absoluteOgImage()],
  build: {
    outDir: r('dist'),
    emptyOutDir: true,
    // The game chunk is mostly Hebrew content (decisions, events, quips), not library code.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: r('pages/index.html'),
        notFound: r('pages/404.html'),
        ...Object.fromEntries(PAGES.map((p) => [p, r(`pages/${p}/index.html`)])),
      },
    },
  },
  // `npm run preview` serves the same Content-Security-Policy as Netlify (netlify.toml is the source of truth).
  preview: { headers: { 'Content-Security-Policy': netlifyCsp() } },
  test: {
    dir: r('src'),
  },
});
