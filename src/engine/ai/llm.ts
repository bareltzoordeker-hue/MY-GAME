// Optional Claude-powered narrative. Off unless the player supplies their own API key in Settings.
// The LLM only writes text; the engine validates it and never lets it change numbers.
// The SDK is loaded on demand (dynamic import) so players without a key never download it.
import type AnthropicSDK from '@anthropic-ai/sdk';
import type { AIStatement, CharacterContext } from './contextBuilder';
import { templateProvider } from './provider';

const KEY = 'hakise.llm.key';
const MODEL = 'claude-opus-5-5';

export const getLlmKey = (): string => { try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; } };
export const setLlmKey = (k: string) => { try { if (k) localStorage.setItem(KEY, k); else localStorage.removeItem(KEY); } catch { /* ignore */ } };
export const llmEnabled = () => getLlmKey().length > 0;

const SYSTEM = `אתה כותב משפט אחד, קצר וסאטירי (עד 20 מילים, בעברית), שפוליטיקאי בדיוני במדינה הבדיונית "צבריה" אומר על השחקן.
כל הדמויות והמפלגות בדיוניות. אל תזכיר פוליטיקאים, מפלגות או אירועים אמיתיים. אל תמציא מספרים.
החזר JSON בלבד בצורה: {"tone":"angry|neutral|friendly|sarcastic","text":"..."}`;

/** Returns a validated statement, or the template statement on any failure. */
export async function llmStatement(ctx: CharacterContext): Promise<AIStatement> {
  const fallback = templateProvider.statement(ctx);
  const apiKey = getLlmKey();
  if (!apiKey) return fallback;
  let Anthropic: typeof AnthropicSDK;
  try {
    Anthropic = (await import('@anthropic-ai/sdk')).default;
  } catch {
    return fallback; // offline or chunk failed to load
  }
  try {
    const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      output_config: { effort: 'low' },
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(ctx) }],
    } as AnthropicSDK.MessageCreateParamsNonStreaming);
    if (res.stop_reason === 'refusal') return fallback;
    const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as { tone?: string; text?: string };
    if (typeof json.text !== 'string' || !json.text.trim()) return fallback;
    const tone = (['angry', 'neutral', 'friendly', 'sarcastic'].includes(String(json.tone)) ? json.tone : 'neutral') as AIStatement['tone'];
    return { type: 'political_statement', actorId: ctx.actor.id, targetId: 'player', tone, text: json.text.slice(0, 160) };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) console.warn('Claude: invalid API key');
    else if (e instanceof Anthropic.RateLimitError) console.warn('Claude: rate limited');
    else if (e instanceof Anthropic.APIError) console.warn(`Claude API error ${e.status}`);
    return fallback;
  }
}
