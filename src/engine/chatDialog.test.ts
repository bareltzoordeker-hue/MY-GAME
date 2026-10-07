import { describe, expect, it } from 'vitest';
import { createGame } from './newGame';
import { PARTIES } from '../data/parties';
import { chatTick, detectIntent, sendChat } from './chat';
import type { GameState } from '../types/game';

const game = (seed = 4): GameState => createGame({ playerName: 'בודק', gender: 'm', difficulty: 'normal', seed, role: 'mk', partyId: PARTIES.find((p) => p.coalition)!.id });
const other = (s: GameState) => Object.values(s.politicians).find((p) => p.active && !p.isPlayer && s.parties[p.partyId]?.leaderId === p.id && p.partyId !== s.player.partyId)!;
const last = (s: GameState, id: string) => s.chats![id].at(-1)!.text;

describe('chat understands short answers in context', () => {
  it('reads the new intents', () => {
    expect(detectIntent('בוא נדבר')).toBe('meet');
    expect(detectIntent('בסדר')).toBe('agree');
    expect(detectIntent('מה רצית?')).toBe('askwhat');
    expect(detectIntent('שלום')).toBe('greet');
    expect(detectIntent('לא, אין לי זמן')).toBe('decline');
  });

  it('"בוא נדבר" after "כדאי שנדבר" opens the real complaint instead of "I am not sure what you ask"', () => {
    const s = game();
    const t = other(s);
    t.loyalty = 20;
    s.chatTopics = { [t.id]: { kind: 'unhappy', stage: 'opened', turn: s.turn } };
    sendChat(s, t.id, 'בוא נדבר');
    const reply = last(s, t.id);
    expect(reply).not.toContain('לא בטוח מה אתה מבקש');
    expect(reply).toContain('מה אתה מציע');
    expect(s.chatTopics[t.id].stage).toBe('explained');
    // and the follow-up agreement settles it
    sendChat(s, t.id, 'בסדר, אטפל בזה');
    expect(s.chatTopics?.[t.id]).toBeUndefined();
  });

  it('a cooperation idea is explained and then agreed', () => {
    const s = game();
    const t = other(s);
    t.loyalty = 55;
    s.chatTopics = { [t.id]: { kind: 'coop', stage: 'opened', turn: s.turn } };
    sendChat(s, t.id, 'כן, בוא נדבר');
    expect(s.chatTopics[t.id].stage).toBe('explained');
    expect(last(s, t.id)).toContain('מה דעתך');
    sendChat(s, t.id, 'מסכים');
    expect(s.chatTopics?.[t.id]).toBeUndefined();
    expect(t.memory.some((m) => m.kind === 'promise')).toBe(true);
  });

  it('unprompted talk gets a useful answer, never the old vague line', () => {
    const s = game();
    const t = other(s);
    t.loyalty = 25;
    for (const text of ['שלום', 'בוא נדבר', 'מה רצית?', 'בסדר']) {
      s.flags[`chat_n_${t.id}`] = 0;
      sendChat(s, t.id, text);
      expect(last(s, t.id)).not.toContain('לא בטוח מה אתה מבקש');
    }
  });

  it('different politicians open with different messages, and never repeat themselves', () => {
    const s = game();
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      s.turn += 1;
      chatTick(s);
    }
    for (const msgs of Object.values(s.chats ?? {})) {
      const texts = msgs.filter((m) => m.from === 'them').map((m) => m.text);
      expect(new Set(texts).size).toBe(texts.length);
      texts.forEach((t) => seen.add(t));
    }
    expect(seen.size).toBeGreaterThan(4);
  });
});
