import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StorageLike } from '../../engine/persistence/save';

// In-memory localStorage: the store saves through the real persistence layer.
function memoryStorage(): StorageLike & { clear(): void } {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: (k) => void m.delete(k), clear: () => m.clear() };
}
const storage = memoryStorage();
vi.stubGlobal('localStorage', storage);

/** A "refresh": throw away the in-memory store module and load it again from storage only. */
async function freshStore() {
  vi.resetModules();
  return (await import('./gameStore')).useGame;
}

const CFG = { playerName: 'בודק', gender: 'm' as const, role: 'pm' as const, partyId: 'kise', difficulty: 'normal' as const, seed: 7 };

describe('game over survives a refresh', () => {
  beforeEach(() => storage.clear());

  it('a mid-turn resignation is saved at once, and continue shows the finished game', async () => {
    let useGame = await freshStore();
    useGame.getState().newGame(CFG);
    const turnBefore = useGame.getState().game!.turn;

    useGame.getState().act('resign'); // ends the career in the middle of a turn
    expect(useGame.getState().game!.gameOver?.reason).toBe('resigned');
    expect(useGame.getState().saveStatus).toBe('saved');

    useGame = await freshStore(); // refresh
    expect(useGame.getState().game).toBeNull();
    expect(useGame.getState().continueGame()).toBe(true);
    const g = useGame.getState().game!;
    expect(g.gameOver?.reason).toBe('resigned'); // not the playable state from before the resignation
    expect(g.turn).toBe(turnBefore);
  });

  it('any game-over state is persisted, whatever produced it', async () => {
    const useGame = await freshStore();
    useGame.getState().newGame(CFG);
    useGame.getState().debugPatch((s) => { s.gameOver = { reason: 'ousted', title: 'הודחת', text: '', turn: s.turn }; });

    const reloaded = await freshStore();
    reloaded.getState().continueGame();
    expect(reloaded.getState().game!.gameOver?.reason).toBe('ousted');
  });

  it('an ongoing game is still saved only at turn end (no extra mid-turn saves)', async () => {
    const useGame = await freshStore();
    useGame.getState().newGame(CFG);
    const saved = storage.getItem('hakise.autosave.v1');
    useGame.getState().debugPatch((s) => { s.player.reputation += 1; }); // a mid-turn change that doesn't end the game
    expect(storage.getItem('hakise.autosave.v1')).toBe(saved);
  });
});
