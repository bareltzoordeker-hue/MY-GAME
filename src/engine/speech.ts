// ============================================================
// Speeches: the player picks a venue, topic, stance on the three axes and a tone.
// "Write it for me" assembles a full speech from templates (no server).
// Delivering it moves groups by how close the message is to them, makes party
// leaders react by their values, and can trigger a counter-campaign.
// ============================================================
import { GROUP_BY_ID, GROUPS } from '../data/world';
import type { GameState, GroupId, ReactionLine } from '../types/game';
import { clamp } from '../utils';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { startCrisis } from './crises';
import { chance, pick } from './rng';

export type Venue = 'plenum' | 'tv' | 'rally' | 'ceremony' | 'conference' | 'social';
export type Tone = 'statesman' | 'combative' | 'empathetic' | 'optimistic';
export interface SpeechTopic { id: string; name: string; icon: string; axis: 'security' | 'economic' | 'religion'; hot: number; pro: string; con: string }

export const VENUES: Record<Venue, { name: string; icon: string; reach: number }> = {
  plenum: { name: 'נאום במליאת הכנסטון', icon: '🏛️', reach: 0.8 },
  tv: { name: 'ראיון בטלוויזיה', icon: '📺', reach: 1.2 },
  rally: { name: 'כנס תומכים', icon: '📢', reach: 0.9 },
  ceremony: { name: 'טקס ממלכתי', icon: '🕯️', reach: 1 },
  conference: { name: 'כנס כלכלי', icon: '💼', reach: 0.7 },
  social: { name: 'סרטון ברשתות', icon: '📱', reach: 1 },
};
export const TONES: Record<Tone, { name: string; desc: string }> = {
  statesman: { name: 'ממלכתי', desc: 'מאחד, מכבד, פחות מלהיב את הבסיס' },
  combative: { name: 'תקיף', desc: 'מלהיב את הבסיס, מרחיק את המרכז' },
  empathetic: { name: 'אמפתי', desc: 'מדבר לרגש, עובד טוב בזמן משבר' },
  optimistic: { name: 'אופטימי', desc: 'חזון ותקווה, פחות אמין כשהמצב קשה' },
};

/** axis: which ideological axis the stance slider moves on. pro/con: what +1 / -1 means on that topic. */
export const TOPICS: SpeechTopic[] = [
  { id: 'security', name: 'ביטחון והמלחמה', icon: '🛡️', axis: 'security', hot: 1, pro: 'יד קשה והכרעה צבאית', con: 'הסדרים מדיניים והפחתת הלחימה' },
  { id: 'judicial', name: 'הרפורמה המשפטית', icon: '⚖️', axis: 'security', hot: 1.2, pro: 'שינוי מערכת המשפט ומשילות', con: 'הגנה על עצמאות בתי המשפט' },
  { id: 'draft', name: 'גיוס ושוויון בנטל', icon: '🪖', axis: 'religion', hot: 1.2, pro: 'עיגון מעמד לומדי התורה', con: 'גיוס לכולם ושוויון בנטל' },
  { id: 'cost', name: 'יוקר המחיה והדיור', icon: '🏠', axis: 'economic', hot: 1, pro: 'שוק חופשי ותחרות', con: 'התערבות ממשלתית ופיקוח' },
  { id: 'welfare', name: 'רווחה, בריאות וחינוך', icon: '🏥', axis: 'economic', hot: 0.8, pro: 'התייעלות וצמצום המגזר הציבורי', con: 'השקעה ציבורית רחבה' },
  { id: 'palestinians', name: 'הסוגיה הפלסטינית', icon: '🗺️', axis: 'security', hot: 1, pro: 'ריבונות והתיישבות', con: 'היפרדות והסדר מדיני' },
  { id: 'religion_state', name: 'דת ומדינה', icon: '🕍', axis: 'religion', hot: 0.8, pro: 'שמירה על הסטטוס קוו והמסורת', con: 'חופש מדת, תחבורה בשבת, נישואים אזרחיים' },
  { id: 'unity', name: 'אחדות ותקווה', icon: '🤝', axis: 'security', hot: 0.4, pro: 'אחדות סביב הדגל', con: 'אחדות דרך הידברות' },
];
export const TOPIC_BY_ID = Object.fromEntries(TOPICS.map((t) => [t.id, t])) as Record<string, SpeechTopic>;

/** Where each group sits on each axis (-1..1). Positive = right / liberal-market / religious. */
export const GROUP_POS: Partial<Record<GroupId, { security?: number; economic?: number; religion?: number }>> = {
  right: { security: 0.9 }, left: { security: -0.9 }, settlers: { security: 1, religion: 0.6 }, reservists: { security: 0.3, religion: -0.6 },
  haredim: { religion: 1, security: 0.3 }, religious: { religion: 0.8, security: 0.6 }, secular: { religion: -0.9 }, liberals: { economic: 0.7, religion: -0.6, security: -0.5 },
  socialists: { economic: -0.9 }, highIncome: { economic: 0.8 }, lowIncome: { economic: -0.7 }, selfEmployed: { economic: 0.6 }, publicSector: { economic: -0.7 },
  arabs: { security: -0.9, economic: -0.4 }, center: { security: 0, economic: 0.1, religion: -0.3 }, middleClass: { economic: 0.1, religion: -0.3 },
  youth: { religion: -0.4, economic: -0.2 }, elderly: { security: 0.3, economic: -0.3 }, periphery: { security: 0.5, economic: -0.4, religion: 0.3 },
  olim: { religion: -0.7, security: 0.4 }, students: { religion: -0.5, economic: -0.3 }, families: { economic: -0.3 }, employees: { economic: -0.3 },
};

const OPEN: Record<Venue, string[]> = {
  plenum: ['אדוני היושב ראש, חברי הכנסטון,', 'כבוד היושב ראש, חברות וחברי הכנסטון,'],
  tv: ['תודה שהזמנתם אותי.', 'אני רוצה לדבר הערב בגלוי עם אזרחי ישמעאל.'],
  rally: ['חברות וחברים יקרים, תודה שבאתם!', 'ערב טוב לכולם, איזה כיף לראות את כולכם כאן.'],
  ceremony: ['משפחות יקרות, אורחים נכבדים,', 'אנחנו מתכנסים היום ברגע של זיכרון ושל אחריות.'],
  conference: ['אנשי עסקים, כלכלנים, אורחים יקרים,', 'תודה למארגני הכנס.'],
  social: ['שלום לכולם.', 'רציתי לדבר איתכם ישירות.'],
};
const CLOSE: Record<Tone, string[]> = {
  statesman: ['נעשה זאת יחד, כעם אחד, באחריות.', 'זו המחויבות שלי לכל אזרחי ישמעאל.'],
  combative: ['ולא נוותר. לא עכשיו ולא בעתיד.', 'מי שחושב שנירתע – טועה.'],
  empathetic: ['אני שומע אתכם, ואני כאן בשבילכם.', 'אני יודע כמה קשה עכשיו, ואני לא אעזוב אתכם לבד.'],
  optimistic: ['הימים הטובים עוד לפנינו.', 'אני מאמין בעתיד של המדינה הזו, ובכם.'],
};

/** Assembles a full speech. rnd: a [0,1) source (UI uses Math.random; the text never affects the simulation). */
export function writeSpeechLines(p: { venue: Venue; topic: string; stance: number; tone: Tone; audience: GroupId | '' }, rnd: () => number = Math.random): string[] {
  const t = TOPIC_BY_ID[p.topic] ?? TOPICS[0];
  const one = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const side = p.stance > 0.25 ? t.pro : p.stance < -0.25 ? t.con : `איזון בין ${t.pro} לבין ${t.con}`;
  const strength = Math.abs(p.stance) > 0.7 ? 'בלי היסוס' : Math.abs(p.stance) > 0.25 ? 'בנחישות' : 'בזהירות ובאחריות';
  const aud = p.audience ? GROUP_BY_ID[p.audience]?.name : '';
  const lines = [
    one(OPEN[p.venue]),
    `אני רוצה לדבר היום על ${t.name}.`,
    one([`הציבור יודע ש${t.name} הוא אחד הנושאים החשובים ביותר עבור המדינה.`, `במשך שנים דיברו על ${t.name}, ומעט מדי נעשה.`, `אין נושא שמעסיק את הבתים בישמעאל יותר מ${t.name}.`]),
    `הדרך שלי ברורה: ${side}.`,
    `אני מתכוון לפעול ${strength}, ${one(['עם תוכנית מסודרת ולוחות זמנים', 'עם צוות מקצועי', 'בשיתוף כל מי שמוכן לעבוד יחד'])}.`,
    aud ? `ל${aud} אני רוצה לומר: ${one(['אתם לא לבד', 'שמעתי אתכם', 'הקול שלכם חשוב לי'])}.` : '',
    p.tone === 'combative' ? one(['מי שמתנגד לדרך הזו יצטרך להסביר לציבור למה.', 'לא נקבל עוד תירוצים.']) : p.tone === 'empathetic' ? one(['אני מכיר את הקשיים, ופגשתי אנשים שנאבקים בהם כל יום.', 'מאחורי כל מספר יש משפחה.']) : p.tone === 'optimistic' ? one(['יש לנו את הכלים, את האנשים ואת הרוח.', 'אני רואה הזדמנות גדולה.']) : one(['זה הזמן לאחריות ולא לפלגנות.', 'נפעל לטובת כלל הציבור.']),
    one(CLOSE[p.tone]),
  ];
  return lines.filter(Boolean);
}

export function writeSpeech(p: { venue: Venue; topic: string; stance: number; tone: Tone; audience: GroupId | '' }, rnd: () => number = Math.random): string {
  return writeSpeechLines(p, rnd).join(' ');
}

export interface SpeechParams { venue: Venue; topic: string; stance: number; tone: Tone; audience: GroupId | ''; words: number }

/** Delivers a speech: moves groups, party leaders react by their values, sometimes a counter-campaign starts. */
export function deliverSpeech(s: GameState, p: SpeechParams): { title: string; text: string; lines: ReactionLine[] } {
  const t = TOPIC_BY_ID[p.topic] ?? TOPICS[0];
  const v = VENUES[p.venue];
  const stance = clamp(p.stance, -1, 1);
  const lengthFactor = p.words < 25 ? 0.6 : p.words > 450 ? 0.7 : 1;
  const crisis = s.crises.length > 0 || Object.values(s.world?.fronts ?? {}).some((f) => f.status === 'fighting');
  const toneK = { statesman: 0.8, combative: 1.25, empathetic: crisis ? 1.2 : 0.9, optimistic: crisis ? 0.7 : 1.05 }[p.tone];
  const groups: Partial<Record<GroupId, number>> = {};
  for (const g of GROUPS) {
    const pos = GROUP_POS[g.id]?.[t.axis];
    if (pos === undefined) continue;
    // agreement: same sign as the stance → positive; scaled by how hot the topic is and how far the venue reaches
    let d = pos * stance * 4 * t.hot * v.reach * toneK * lengthFactor;
    if (p.tone === 'combative' && d < 0) d *= 1.4;
    if (p.tone === 'statesman') d = d > 0 ? d * 0.8 : d * 0.6;
    if (p.audience === g.id) d += 2;
    if (Math.abs(d) >= 0.3) groups[g.id] = Math.round(d * 10) / 10;
  }
  const centerHit = p.tone === 'combative' ? -1.5 : p.tone === 'statesman' ? 1 : 0;
  groups.center = (groups.center ?? 0) + centerHit;
  const fit = Object.values(groups).reduce((a, x) => a + (x ?? 0), 0);
  applyEffects(s, {
    groups, playerPopularity: clamp(fit / 6, -4, 5) + (p.tone === 'statesman' ? 1 : 0), playerReputation: p.tone === 'statesman' ? 2 : p.tone === 'combative' ? -1 : 0,
    partyMomentum: { [s.player.partyId]: clamp(fit / 10, -2, 3) },
  });
  // party leaders react by their own position on the axis
  const lines: ReactionLine[] = [];
  const me = s.politicians[s.player.politicianId];
  const leaders = Object.values(s.parties).filter((x) => x.seats > 0 && x.id !== s.player.partyId).map((x) => s.politicians[x.leaderId]).filter(Boolean);
  const ranked = leaders.map((l) => ({ l, agree: l.ideology[t.axis] * stance })).sort((a, b) => Math.abs(b.agree) - Math.abs(a.agree)).slice(0, 4);
  for (const { l, agree } of ranked) {
    if (agree > 0.15) {
      remember(s, l.id, 'support', `נאום על ${t.name}`, 4);
      lines.push({ icon: '👍', label: l.name, text: pick(s, [`${me.name} צודק בעניין הזה.`, 'אמירה נכונה וחשובה.', 'אנחנו מסכימים עם הדברים.']), tone: 'good' });
    } else if (agree < -0.15) {
      remember(s, l.id, 'insult', `נאום על ${t.name}`, -4);
      lines.push({ icon: '👎', label: l.name, text: pick(s, ['הדברים מסוכנים ומפלגים.', 'זו דרך שתזיק למדינה.', 'נפעל נגד המדיניות הזו.']), tone: 'bad' });
    }
  }
  // a strong stance on a hot topic triggers a counter-campaign from the other side
  let counter = '';
  if (Math.abs(stance) > 0.6 && t.hot >= 1 && chance(s, 0.45 * v.reach)) {
    const otherSide = stance > 0 ? (t.axis === 'religion' ? 'secular' : 'left') : (t.axis === 'religion' ? 'haredim' : 'right');
    applyEffects(s, { groups: { [otherSide]: -3 }, partyMomentum: { [s.player.partyId]: -1 } });
    counter = `${GROUP_BY_ID[otherSide as GroupId].name} יצאו בקמפיין נגד הדברים.`;
    if (t.id === 'judicial' && stance > 0 && chance(s, 0.4) && !s.crises.some((c) => c.defId === 'cost_protest')) { startCrisis(s, 'cost_protest', 2); counter += ' נקראה הפגנה גדולה.'; }
    addNews(s, `סערה בעקבות דברי ${me.name} על ${t.name}`, 'bad', t.icon);
  } else {
    addNews(s, `${me.name}: ${v.name.replace('נאום ', '')} על ${t.name}`, 'neutral', v.icon);
  }
  logEvent(s, '🎤', `נאום: ${t.name} (${TONES[p.tone].name})`, 2, fit >= 0 ? 'good' : 'bad', 'speech');
  const best = Object.entries(groups).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))[0];
  const worst = Object.entries(groups).sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))[0];
  const text = [
    best && (best[1] ?? 0) > 0 ? `הדברים התקבלו היטב בקרב ${GROUP_BY_ID[best[0] as GroupId].name}.` : '',
    worst && (worst[1] ?? 0) < 0 ? `${GROUP_BY_ID[worst[0] as GroupId].name} הגיבו בביקורת.` : '',
    p.words < 25 ? 'הנאום היה קצר מדי כדי להשאיר רושם.' : p.words > 450 ? 'הנאום היה ארוך מדי, וחלק מהקהל איבד עניין.' : '',
    counter,
  ].filter(Boolean).join(' ');
  return { title: `${v.icon} ${v.name}: ${t.name}`, text: text || 'הנאום עבר בלי הדים מיוחדים.', lines };
}
