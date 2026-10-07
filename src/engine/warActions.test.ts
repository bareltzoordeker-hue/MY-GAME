import { describe, expect, it } from 'vitest';
import { createGame } from './newGame';
import { PARTIES } from '../data/parties';
import { WAR_ACTIONS, atWar } from '../data/warActions';
import { MINISTRIES } from '../data/ministries';
import { checkAction, ministryActionSpecs, performAction } from './decisions';
import { startCrisis } from './crises';
import type { GameState } from '../types/game';

const pm = (): GameState => createGame({ playerName: 'בודק', gender: 'm', difficulty: 'normal', seed: 9, role: 'pm', partyId: PARTIES.find((p) => p.coalition)!.id });

describe('wartime ministry actions', () => {
  it('every ministry has at least one, and every id is unique', () => {
    const ids = Object.values(WAR_ACTIONS).flat().map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MINISTRIES) expect(WAR_ACTIONS[m.id]?.length ?? 0, m.id).toBeGreaterThan(0);
  });

  it('are hidden and refused in peace', () => {
    const s = pm();
    expect(atWar(s)).toBe(false);
    const m = s.government.ministries.find((x) => x.id === 'transport')!;
    expect(ministryActionSpecs(m, s).some((a) => a.cat === 'war')).toBe(false);
    expect(checkAction(s, 'ministry_action', { ministryId: 'transport', actionId: 'war_cut_transit' })).toContain('בשעת מלחמה');
  });

  it('appear and work for every ministry once a war is on', () => {
    const s = pm();
    startCrisis(s, 'war');
    expect(atWar(s)).toBe(true);
    for (const m of s.government.ministries) {
      const own = (m.origins ?? [m.id]).flatMap((id) => WAR_ACTIONS[id] ?? []);
      const listed = ministryActionSpecs(m, s).filter((a) => a.cat === 'war');
      expect(listed.length, m.id).toBe(own.length);
      for (const a of own) {
        const t = structuredClone(s);
        t.player.politicalCapital = 99;
        const why = checkAction(t, 'ministry_action', { ministryId: m.id, actionId: a.id });
        expect(why, `${m.id}/${a.id}`).toBeNull();
        const r = performAction(t, 'ministry_action', { ministryId: m.id, actionId: a.id });
        expect(r.reaction, `${m.id}/${a.id}`).not.toBeNull();
      }
    }
  });
});
