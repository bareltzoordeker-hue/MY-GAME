// Narrative provider interface. The default is local, seeded templates (no internet).
// TODO(phase 3+): an optional LLM provider (e.g. Claude) can implement `statement`
// asynchronously; its output must pass `validateStatement` before the engine uses it.
import type { CharacterContext, AIStatement } from './contextBuilder';

export interface NarrativeProvider {
  id: string;
  statement(ctx: CharacterContext): AIStatement;
}

const LINES: Record<AIStatement['tone'], string[]> = {
  angry: ['אני לא מוכן לתמוך במהלך הזה.', 'זה עוד לא נגמר.', 'אני זוכר כל מילה.'],
  neutral: ['נבחן את הדברים לגופם.', 'נדבר על זה בוועדה.', 'יש מה לשפר.'],
  friendly: ['אני איתך בזה.', 'מהלך נכון. כמעט כמו שלי.', 'תסמוך עליי.'],
  sarcastic: ['עוד רפורמה? איזו הפתעה.', 'מבריק. פשוט מבריק.', 'אני בטוח שהפעם זה יעבוד.'],
};

export const templateProvider: NarrativeProvider = {
  id: 'templates',
  statement(ctx) {
    const tone: AIStatement['tone'] = ctx.actor.loyalty < 30 ? 'angry' : ctx.actor.loyalty > 70 ? 'friendly' : ctx.actor.ego > 0.7 ? 'sarcastic' : 'neutral';
    const opts = LINES[tone];
    const text = opts[(ctx.situation.turn + ctx.actor.name.length) % opts.length];
    return { type: 'political_statement', actorId: ctx.actor.id, targetId: 'player', tone, text };
  },
};

let active: NarrativeProvider = templateProvider;
export const getProvider = () => active;
export const setProvider = (p: NarrativeProvider) => { active = p; };
