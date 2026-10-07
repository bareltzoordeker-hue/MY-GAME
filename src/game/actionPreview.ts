// Effect preview for action buttons: a dry run on a copy of the game, with a different random seed so
// that the real outcome of a gamble is never revealed. Computed only when the player hovers a button.
import { ACTIONS, ministryActionSpecs, performAction, type Params } from '../engine/decisions';
import { getMinistry } from '../engine/government';
import { playerMinistry } from '../engine/roles';
import type { GameState } from '../types/game';

export function actionPreview(game: GameState, id: string, p: Params): string {
  const def = ACTIONS[id];
  if (!def) return '';
  let what = def.description;
  let gamble = false;
  if (id === 'ministry_action') {
    const m = p.ministryId ? getMinistry(game, String(p.ministryId)) : playerMinistry(game);
    const spec = m && ministryActionSpecs(m).find((x) => x.id === p.actionId);
    if (spec) { what = spec.desc; gamble = !!spec.outcomes?.length; }
  }
  const lines: string[] = [];
  try {
    const dry = performAction({ ...game, rngState: (game.rngState + 7919) >>> 0 }, id, p);
    const r = dry.reaction;
    if (r && r.status !== 'rejected') {
      for (const s of r.stats.filter((x) => !x.label.includes('הון פוליטי')).slice(0, 4)) lines.push(`${s.label} ${s.value}`);
      const g = r.groups.filter((x) => x.tone !== 'neutral').slice(0, 3).map((x) => `${x.label} ${x.text.match(/\(([+-][\d.]+)\)/)?.[1] ?? ''}`.trim());
      if (g.length) lines.push(`קבוצות: ${g.join(', ')}`);
    }
  } catch { /* a preview must never break the screen */ }
  const eff = lines.length ? `השפעה משוערת: ${lines.join(' · ')}` : 'ההשפעה תתברר לאחר הביצוע';
  return `${what} · ${eff}${gamble ? ' · התוצאה תלויה בהגרלה' : ''}`;
}
