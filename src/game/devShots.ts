// DEV ONLY: "?shot=<screen>&person=<id>" opens a ready game on a screen, for the marketing screenshots.
// Imported dynamically under import.meta.env.DEV, so it never ships in the production build.
import { useGame, type ScreenId } from './store/gameStore';
import { advanceTurn } from '../engine/turn';
import { resolveDrama } from '../engine/drama';
import { resolveInbox } from '../engine/inbox';
import { performAction } from '../engine/decisions';

export function runShotMode(): void {
  const q = new URLSearchParams(location.search);
  const shot = q.get('shot');
  if (!shot) return;
  try {
    localStorage.setItem('hakise.disclaimer.v2', '1');
    localStorage.setItem('hakise.tutorial.done', '1');
    localStorage.setItem('hakise.consent.v1', JSON.stringify({ ads: 'denied', at: new Date().toISOString() }));
  } catch { /* ignore */ }
  const st = useGame.getState();
  st.newGame({ personId: q.get('person') ?? 'likud_1', difficulty: 'normal', seed: Number(q.get('seed') ?? 7) });
  let g = useGame.getState().game!;
  if (q.get('campaign') !== '0') g = performAction(g, 'start_campaign', { strategy: 'security', t1: 'reservists', t2: 'right', budget: 'mid', slogan: 'ביטחון קודם לכל' }).state;
  const turns = Number(q.get('turns') ?? 0);
  for (let i = 0; i < turns && g.elections.phase === 'none'; i++) {
    for (const it of [...g.inbox]) g = resolveInbox(g, it.id, it.defaultOptionId).state;
    if (g.drama) g = resolveDrama(g, g.drama.options[0].id).state;
    g = advanceTurn(g);
  }
  if (q.get('nonight') && g.elections.last) g = { ...g, elections: { ...g.elections, last: { ...g.elections.last, turn: -1 } } };
  useGame.setState({ game: g, screen: shot as ScreenId, briefingOpen: false, reactions: [] });
  document.querySelector('.consent')?.remove();
  const st2 = document.createElement('style');
  st2.textContent = '.advisor-fab .bubble{display:none!important}';
  document.head.appendChild(st2);
}

/** DEV ONLY: window.__axe() runs axe-core on the current page. */
(window as unknown as { __axe: () => Promise<unknown> }).__axe = async () => {
  const axe = (await import('axe-core')).default;
  const r = await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa'] });
  return r.violations.map((v) => ({ id: v.id, impact: v.impact, n: v.nodes.length, sample: v.nodes[0]?.target?.join(' ') }));
};
(window as unknown as { __goto: (s: string, p?: string) => void }).__goto = (screen, person) => {
  useGame.getState().openChat?.(null);
  if (person) useGame.getState().openChat(person);
  useGame.setState({ screen: screen as ScreenId });
};
/** DEV ONLY: window.__ids() lists politician ids of the running game. */
(window as unknown as { __ids: () => string[] }).__ids = () => Object.keys(useGame.getState().game?.politicians ?? {});
