// Narrative provider interface. The default is local, seeded templates (no internet).
import type { CharacterContext, AIStatement } from './contextBuilder';

export interface NarrativeProvider {
  id: string;
  statement(ctx: CharacterContext): AIStatement;
}

const LINES: Record<AIStatement['tone'], string[]> = {
  angry: ['אני לא מוכן לתמוך במדיניות הזו.', 'יש בינינו חילוקי דעות עמוקים.', 'אני לא שוכח את מה שקרה.'],
  neutral: ['נבחן את הדברים לגופם.', 'נדבר על זה בוועדה.', 'יש מה לשפר.'],
  friendly: ['אני תומך בדרך שלך.', 'אפשר לסמוך עליי.', 'נעבוד יחד על זה.'],
  sarcastic: ['אני מסופק אם זה יעבוד.', 'יש לי ספקות רציניים לגבי הכיוון.', 'נראה בתוצאות.'],
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
