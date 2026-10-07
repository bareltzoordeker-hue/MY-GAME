import { PROMISE_BY_ID } from '../data/promises';
import type { GameState, Reaction } from '../types/game';
import { clamp, newId } from '../utils';
import { addNews, applyEffects, logEvent } from './effects';
import { GROUP_BY_ID, TERM_TURNS } from '../data/world';

export function makePromise(s: GameState, defId: string): Reaction {
  const def = PROMISE_BY_ID[defId];
  if (!def || s.promises.some((p) => p.defId === defId && p.status === 'pending')) {
    return { title: 'כבר הבטחת את זה', status: 'info', stats: [], groups: [], people: [] };
  }
  s.promises.push({
    id: newId(s, 'pr'), defId, text: def.text, madeTurn: s.turn, deadlineTurn: s.elections.scheduledTurn + Math.round(TERM_TURNS / 2),
    status: 'pending', baseline: def.measure(s), groups: def.groups,
  });
  const groups = Object.fromEntries(def.groups.map((g) => [g, 3]));
  // each extra promise is worth less: voters discount a politician who promises everything
  const made = s.promises.filter((p) => p.status === 'pending').length;
  applyEffects(s, { partyMomentum: { [s.player.partyId]: def.momentum / made }, groups });
  addNews(s, `${s.politicians[s.player.politicianId].name} מבטיח: "${def.text}"`, 'neutral', def.icon);
  return {
    title: 'ההבטחה נרשמה', subtitle: def.text, status: 'approved',
    stats: [{ icon: '📈', label: 'מומנטום בסקרים', value: `+${def.momentum}`, tone: 'good' }, { icon: '📅', label: 'מועד לקיום', value: 'שנתיים אחרי הבחירות', tone: 'neutral' }],
    groups: def.groups.map((g) => ({ icon: GROUP_BY_ID[g].emoji, label: GROUP_BY_ID[g].name, text: 'מקשיבים, ויזכרו אם ההבטחה לא תקוים.', tone: 'good' as const })),
    people: [], quip: 'אם תהיה בשלטון ולא תקיים את ההבטחה עד המועד, תשלם על כך בתמיכה הציבורית.',
  };
}

export function checkPromises(s: GameState): void {
  const me = s.politicians[s.player.politicianId];
  for (const p of s.promises) {
    if (p.status !== 'pending') continue;
    const def = PROMISE_BY_ID[p.defId];
    const now = def.measure(s);
    // a promise counts only once the election it was made for has passed (deadline = that election + half a term)
    if (s.turn >= p.deadlineTurn - Math.round(TERM_TURNS / 2) && def.kept(now, p.baseline) && s.turn > p.madeTurn) {
      p.status = 'kept';
      me.popularity = clamp(me.popularity + 4);
      applyEffects(s, { groups: Object.fromEntries(p.groups.map((g) => [g, 4])) });
      addNews(s, `הבטחה קוימה: ${p.text}`, 'good', '✅');
      logEvent(s, '✅', `קיימת הבטחת בחירות: ${p.text}`, 2, 'good', 'promise');
      s.career.achievements.push(`קיים הבטחה: ${p.text}`);
      continue;
    }
    if (s.turn >= p.deadlineTurn) {
      const inPower = s.government.coalition.includes(s.player.partyId);
      if (!inPower) { p.status = 'void'; continue; }
      p.status = 'broken';
      me.popularity = clamp(me.popularity - 7);
      applyEffects(s, { groups: Object.fromEntries(p.groups.map((g) => [g, -6])), partyMomentum: { [s.player.partyId]: -5 } });
      addNews(s, `הבטחת בחירות לא קוימה: ${p.text}`, 'bad', '📜');
      logEvent(s, '📜', `הבטחה הופרה: ${p.text}`, 3, 'bad', 'promise');
      s.career.failures.push(`הפר הבטחה: ${p.text}`);
    }
  }
}
