// Generates the landing page's static assets from the game itself:
// the real party leaders' caricatures (same generator the game uses) as self-contained animated SVGs,
// plus the favicon. Run: npm run assets:generate
import { writeFileSync, mkdirSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { createGame } from '../src/engine/newGame.ts';
import { Caricature, ADVISOR_SPEC } from '../src/shared/components/Caricature.tsx';
import type { CaricatureSpec } from '../src/types/game.ts';

const OUT = 'public/images/cast';
mkdirSync(OUT, { recursive: true });

// Bobble-head animation baked into each SVG so it also plays inside <img>.
const STYLE = `<style>
.cari-head{transform-box:view-box;transform-origin:60px 90px;animation:b 3.6s ease-in-out infinite}
.cari-eyes{transform-box:view-box;transform-origin:60px 55px;animation:k 5s infinite}
@keyframes b{0%,100%{transform:rotate(-3deg)}50%{transform:rotate(3deg) translateY(-1.5px)}}
@keyframes k{0%,94%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@media (prefers-reduced-motion:reduce){.cari-head,.cari-eyes{animation:none}}
</style>`;

function svgOf(spec: CaricatureSpec, tie?: string): string {
  const html = renderToStaticMarkup(<Caricature spec={spec} size={240} tie={tie} />);
  const svg = html.match(/<svg[\s\S]*<\/svg>/)![0];
  return svg
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replace(/ role="img" aria-hidden="true"/, '')
    .replace(/(<svg[^>]*>)/, `$1${STYLE}`);
}

const s = createGame({ playerName: 'x', gender: 'm', role: 'mk', partyId: 'kise', difficulty: 'normal', seed: 2027 });
const out: string[] = [];
for (const party of Object.values(s.parties)) {
  const leader = s.politicians[party.leaderId];
  writeFileSync(`${OUT}/${party.id}.svg`, svgOf(leader.caricature, party.color));
  out.push(`${party.id}\t${leader.name}\t${party.name}\t${party.logo}\t${leader.quirk}`);
}
writeFileSync(`${OUT}/advisor.svg`, svgOf(ADVISOR_SPEC));

writeFileSync('public/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8b72ff"/><stop offset="1" stop-color="#b04dff"/></linearGradient></defs>
<rect width="64" height="64" rx="16" fill="url(#g)"/>
<g fill="#ffd56b" stroke="#3b1700" stroke-width="2.5" stroke-linejoin="round">
<rect x="18" y="10" width="28" height="24" rx="5"/>
<rect x="14" y="32" width="36" height="8" rx="3"/>
<path d="M18 40 L16 55 M46 40 L48 55" fill="none" stroke-width="4" stroke-linecap="round"/>
</g></svg>`);
console.log(out.join('\n'));
