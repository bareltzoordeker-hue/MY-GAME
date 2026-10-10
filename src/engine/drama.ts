import { DIFFICULTIES } from '../data/world';
import { chance, rand } from './rng';
import type { ActionResult, DramaOption, GameState } from '../types/game';
import { clamp, clone, newId } from '../utils';
import { buildReaction, type ActionDef } from './decisions';
import { DRAMAS, DRAMA_BY_ID, type DramaDef } from './dramaEvents';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { isPM } from './roles';

/** When the player has no authority over a national decision, they get a political-response role instead. */
const COMMENTARY: DramaOption[] = [
  { id: 'c_attack', label: 'לתקוף את הטיפול של הממשלה', hint: 'באופוזיציה: מומנטום למפלגה. בקואליציה: פוגע ביחסים עם ראש הממשלה' },
  { id: 'c_back', label: 'לגבות את הממשלה בפומבי', hint: 'בקואליציה: משפר יחסים עם ראש הממשלה. באופוזיציה: מוניטין ממלכתי' },
  { id: 'c_silent', label: 'לא להגיב', hint: 'בלי סיכון, בלי רווח' },
];

function optionsFor(s: GameState, def: DramaDef): DramaOption[] {
  const allowed = def.options.filter((o) => !o.allow || o.allow(s)).map((o) => ({ id: o.id, label: o.label, hint: o.hint }));
  const restricted = def.options.some((o) => o.allow && !o.allow(s));
  return restricted ? [...allowed, ...COMMENTARY] : allowed;
}

/** At most one dramatic event per turn. Extreme ones need tension; normal ones are frequent. */
export function generateDrama(s: GameState): void {
  if (s.drama || s.gameOver || s.elections.phase !== 'none') return;
  const d = DIFFICULTIES[s.difficulty];
  const ready = (id: string) => (s.flags[`drama_cd_${id}`] ?? 0) <= s.turn;

  for (const def of DRAMAS.filter((x) => x.level !== 'normal' && ready(x.id))) {
    const w = def.weight(s);
    if (w > 0 && chance(s, Math.min(0.45, w * 0.5 * d.eventRate))) { fire(s, def.id); return; }
  }
  const rate = { easy: 0.6, normal: 0.8, hard: 0.88, chaos: 0.97 }[s.difficulty];
  if (!chance(s, rate)) return;
  const pool = DRAMAS.filter((x) => x.level === 'normal' && ready(x.id)).map((x) => ({ x, w: x.weight(s) })).filter((p) => p.w > 0);
  const total = pool.reduce((a, p) => a + p.w, 0);
  if (!total) return;
  let r = rand(s) * total;
  const pickd = pool.find((p) => (r -= p.w) <= 0) ?? pool[0];
  fire(s, pickd.x.id);
}

export function fire(s: GameState, defId: string): void {
  const def = DRAMA_BY_ID[defId];
  const m = def.make(s);
  s.drama = {
    id: newId(s, 'dr'), defId, title: m.title, text: m.text, icon: m.icon, level: def.level, fromId: m.fromId, partyId: m.partyId,
    vars: m.vars ?? {}, turn: s.turn, options: optionsFor(s, def),
  };
  s.flags[`drama_cd_${defId}`] = s.turn + (def.level === 'normal' ? 4 : 6);
  if (def.level !== 'normal') addNews(s, `מבזק: ${m.title}`, 'bad', '🚨');
  logEvent(s, m.icon, m.title, def.level === 'normal' ? 2 : 3, def.level === 'normal' ? 'neutral' : 'bad', 'drama');
}

/** The government (AI) takes the national decision; the player's personal standing is not touched by it. */
function governmentDecides(s: GameState, def: DramaDef): string {
  const govOpt = def.options.find((o) => o.allow) ?? def.options[0];
  const me = s.politicians[s.player.politicianId];
  const keep = { pop: me.popularity, power: me.power, rep: s.player.reputation, cap: s.player.politicalCapital };
  const out = govOpt.resolve(s, s.drama!);
  me.popularity = keep.pop; me.power = keep.power; s.player.reputation = keep.rep; s.player.politicalCapital = keep.cap;
  if (out.headline) addNews(s, out.headline, out.tone === 'bad' ? 'bad' : out.tone === 'good' ? 'good' : 'neutral', s.drama!.icon);
  return `${isPM(s) ? 'הוחלט' : 'הממשלה החליטה'}: "${govOpt.label}". ${out.text}`;
}

function commentary(s: GameState, id: string): { text: string; tone: 'good' | 'bad' | 'neutral' } {
  const inGov = s.government.coalition.includes(s.player.partyId);
  const pm = s.government.pmId;
  if (id === 'c_attack') {
    if (inGov) {
      remember(s, pm, 'insult', 'תקף את הממשלה מבפנים', -10);
      applyEffects(s, { playerPopularity: 2, playerReputation: 1 });
      return { text: 'ביקרת את הממשלה שאתה חבר בה. התקשורת סיקרה, וראש הממשלה לא מרוצה.', tone: 'neutral' };
    }
    applyEffects(s, { playerPopularity: 3, partyMomentum: { [s.player.partyId]: 2 } });
    return { text: 'ביקורת חריפה על הממשלה במסיבת עיתונאים. האופוזיציה מתחזקת.', tone: 'good' };
  }
  if (id === 'c_back') {
    if (inGov) {
      remember(s, pm, 'support', 'גיבה את הממשלה ברגע קשה', 8);
      applyEffects(s, { playerReputation: 1 });
      return { text: 'גיבית את הממשלה ברגע קשה. ראש הממשלה מעריך את זה.', tone: 'good' };
    }
    applyEffects(s, { playerReputation: 3, partyMomentum: { [s.player.partyId]: -1 } });
    return { text: 'גיבית את הממשלה מתוך אחריות ממלכתית. חלק מהבוחרים שלך לא מבינים את הצעד.', tone: 'neutral' };
  }
  return { text: 'בחרת לא להגיב. אין רווח ואין נזק.', tone: 'neutral' };
}

export function resolveDrama(s0: GameState, optionId: string): ActionResult {
  const ev = s0.drama;
  if (!ev) return { state: s0, reaction: null };
  const def = DRAMA_BY_ID[ev.defId];
  const isCommentary = optionId.startsWith('c_');
  const opt = def?.options.find((o) => o.id === optionId);
  const label = isCommentary ? COMMENTARY.find((c) => c.id === optionId)?.label : opt?.label;
  if (!def || !label || !ev.options.some((o) => o.id === optionId)) return { state: s0, reaction: null };
  if (opt?.allow && !opt.allow(s0)) return { state: s0, reaction: null };
  const s = clone(s0);
  let out: { text: string; tone: 'good' | 'bad' | 'neutral'; headline?: string };
  if (isCommentary) {
    const gov = governmentDecides(s, def);
    const c = commentary(s, optionId);
    out = { text: `${gov} ${c.text}`, tone: c.tone };
  } else {
    out = opt!.resolve(s, s.drama!);
  }
  s.drama = null;
  s.career.decisions += 1;
  s.player.politicalCapital = clamp(s.player.politicalCapital);
  if (out.headline) addNews(s, out.headline, out.tone === 'bad' ? 'bad' : out.tone === 'good' ? 'good' : 'neutral', ev.icon);
  logEvent(s, ev.icon, `${ev.title} → ${label}`, ev.level === 'normal' ? 1 : 2, out.tone === 'good' ? 'good' : out.tone === 'bad' ? 'bad' : 'neutral', 'drama');
  if (ev.level !== 'normal') s.career.memorable.push(`${ev.title}: ${label}`);
  const pseudo = { id: 'drama', title: ev.title, icon: ev.icon, category: 'media', level: 'simple', description: '', unavailable: () => null, run: () => undefined } as ActionDef;
  const reaction = buildReaction(s0, s, { title: label, subtitle: ev.title, status: out.tone === 'good' ? 'approved' : out.tone === 'bad' ? 'rejected' : 'info', quip: out.text }, pseudo, 0);
  return { state: s, reaction };
}
