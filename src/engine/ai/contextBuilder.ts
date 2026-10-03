// Context Builder — the AI never sees the whole GameState.
// It receives a small, relevant slice and returns structured output.
import type { GameState, Politician } from '../../types/game';
import { deficitPct } from '../../utils';

export interface CharacterContext {
  actor: { id: string; name: string; party: string; role: string; loyalty: number; ambition: number; ego: number; quirk: string };
  memories: string[];
  situation: { approval: number; deficitPct: number; crises: string[]; turn: number };
  topic: string;
}

export function buildCharacterContext(s: GameState, p: Politician, topic: string): CharacterContext {
  const m = s.government.ministries.find((x) => x.ministerId === p.id);
  return {
    actor: {
      id: p.id, name: p.name, party: s.parties[p.partyId]?.name ?? '', role: m ? m.name : 'ח״כ',
      loyalty: Math.round(p.loyalty), ambition: p.personality.ambition, ego: p.personality.ego, quirk: p.quirk,
    },
    memories: p.memory.slice(-4).map((x) => x.text),
    situation: { approval: Math.round(s.government.approval), deficitPct: +deficitPct(s).toFixed(1), crises: s.crises.map((c) => c.title), turn: s.turn },
    topic,
  };
}

/** Structured action an AI may return. The engine validates and decides the effect. */
export interface AIStatement {
  type: 'political_statement';
  actorId: string;
  targetId: string;
  tone: 'angry' | 'neutral' | 'friendly' | 'sarcastic';
  text: string;
}

export function validateStatement(s: GameState, raw: unknown): AIStatement | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.type !== 'political_statement' || typeof r.text !== 'string' || typeof r.actorId !== 'string') return null;
  if (!s.politicians[r.actorId]) return null;
  const tone = ['angry', 'neutral', 'friendly', 'sarcastic'].includes(String(r.tone)) ? (r.tone as AIStatement['tone']) : 'neutral';
  return { type: 'political_statement', actorId: r.actorId, targetId: String(r.targetId ?? 'player'), tone, text: r.text.slice(0, 140) };
}
