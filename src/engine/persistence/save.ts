import type { GameState } from '../../types/game';

export const SAVE_KEY = 'hakise.autosave.v1';
/** v2 = real parties, real calendar. Saves from the first version cannot be migrated and are ignored. */
export const SAVE_VERSION = 2;

export interface SaveMeta { name: string; role: string; turn: number; date: string; party: string; savedAt: number }

export interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }

const storage = (): StorageLike | null => {
  try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch { return null; }
};

export function serialize(s: GameState): string {
  return JSON.stringify({ v: SAVE_VERSION, savedAt: Date.now(), state: s });
}

export function deserialize(raw: string): GameState | null {
  try {
    const obj = JSON.parse(raw) as { v?: number; state?: GameState };
    const s = obj.state;
    if ((obj.v ?? 1) < SAVE_VERSION || (s?.version ?? 1) < SAVE_VERSION) return null;
    if (!s || typeof s.turn !== 'number' || !s.player || !s.economy || !s.parties || !s.politicians || !s.government || !s.date) return null;
    if (!s.politicians[s.player.politicianId] || !s.parties[s.player.partyId]) return null;
    // migrate older saves
    s.drama ??= null;
    s.alliances ??= [];
    s.partyRelations ??= {};
    return s;
  } catch {
    return null;
  }
}

/** Returns true on success. A failure never loses the in-memory state. */
export function saveGame(s: GameState, store: StorageLike | null = storage()): boolean {
  if (!store) return false;
  try {
    store.setItem(SAVE_KEY, serialize(s));
    return true;
  } catch {
    return false;
  }
}

export function loadGame(store: StorageLike | null = storage()): GameState | null {
  if (!store) return null;
  let raw: string | null = null;
  try { raw = store.getItem(SAVE_KEY); } catch { return null; } // storage blocked (privacy mode, sandbox)
  return raw ? deserialize(raw) : null;
}

export function deleteSave(store: StorageLike | null = storage()): void {
  try { store?.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

export function saveMeta(store: StorageLike | null = storage()): SaveMeta | null {
  const s = loadGame(store);
  if (!s) return null;
  const me = s.politicians[s.player.politicianId];
  return { name: me?.name ?? s.player.name, role: s.player.role, turn: s.turn, date: `${s.date.month}/${s.date.year}`, party: s.parties[s.player.partyId]?.name ?? '', savedAt: 0 };
}
