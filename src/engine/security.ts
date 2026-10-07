// ============================================================
// Security & diplomacy engine. Fronts drift and flare up, the player plans
// operations that the security cabinet must approve, and a diplomatic track
// (channels, mediated ceasefires, confidence-building, land transfers,
// normalization) runs alongside. Casualties are reported soberly.
// ============================================================
import {
  CHANNEL_BY_ID, CHANNELS, DOVE_GROUPS, FRONT_BY_ID, FRONTS, HAWK_GROUPS, OPERATION_BY_ID, OSLO_AREAS_START, UNIT_BY_ID, UNITS,
  type ChannelId, type FrontId, type OperationDef, type UnitId,
} from '../data/security';
import { DIFFICULTIES } from '../data/world';
import { chance, rand, randInt } from './rng';
import type { GameState, Politician, ReactionLine, WorldState } from '../types/game';
import { clamp } from '../utils';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { partyLeavesCoalition } from './government';
import { isPM, playerMinistry } from './roles';

export const COUNTRIES: { id: string; name: string; icon: string }[] = [
  { id: 'usa', name: 'ארה״ב', icon: '' }, { id: 'eu', name: 'האיחוד האירופי', icon: '' }, { id: 'uk', name: 'בריטניה', icon: '' },
  { id: 'germany', name: 'גרמניה', icon: '' }, { id: 'india', name: 'הודו', icon: '' }, { id: 'russia', name: 'רוסיה', icon: '' },
  { id: 'china', name: 'סין', icon: '' }, { id: 'un', name: 'האו״ם', icon: '' },
];

export function initWorld(): WorldState {
  return {
    fronts: Object.fromEntries(FRONTS.map((f) => [f.id, { threat: f.threat, status: f.id === 'gaza' || f.id === 'lebanon' ? 'ceasefire' : 'tension', incidents: 0 }])) as WorldState['fronts'],
    units: Object.fromEntries(UNITS.map((u) => [u.id, { readiness: u.kind === 'infantry' || u.kind === 'armor' ? 68 : 80 }])) as WorldState['units'],
    channels: { usa: 72, egypt: 45, qatar: 25, jordan: 38, uae: 50, saudi: 28, pa: 18 },
    relations: { usa: 70, eu: 30, uk: 38, germany: 50, india: 62, russia: 30, china: 32, un: 12 },
    areas: { ...OSLO_AREAS_START },
    casualties: { soldiers: 0, civilians: 0 },
    operations: [],
    measures: [],
    normalized: [],
  };
}

export const world = (s: GameState): WorldState => (s.world ??= initWorld());

/** Can the player decide on security matters? (PM, or the defense minister with the PM's approval) */
export function securityRole(s: GameState): 'pm' | 'defense' | 'foreign' | null {
  if (isPM(s)) return 'pm';
  const m = playerMinistry(s);
  const ids = m ? m.origins ?? [m.id] : [];
  if (s.player.role === 'minister' && ids.includes('defense')) return 'defense';
  if (s.player.role === 'minister' && (ids.includes('foreign') || ids.includes('regional'))) return 'foreign';
  return null;
}

/** The security cabinet: PM + key ministers + coalition party leaders. */
export function cabinetMembers(s: GameState): Politician[] {
  const ids = new Set<string>([s.government.pmId]);
  for (const mid of ['defense', 'foreign', 'finance', 'justice', 'national_security', 'intelligence']) {
    const m = s.government.ministries.find((x) => x.id === mid);
    if (m?.ministerId) ids.add(m.ministerId);
  }
  for (const pid of s.government.coalition) if (s.parties[pid]?.leaderId) ids.add(s.parties[pid].leaderId);
  return [...ids].map((id) => s.politicians[id]).filter((p) => p && p.active);
}

/** hawkish = 1 for military escalation, -1 for concessions. Returns the vote and a line per member. */
export function cabinetVote(s: GameState, hawkish: number, weight = 0.5): { yes: number; no: number; passed: boolean; lines: ReactionLine[] } {
  const lines: ReactionLine[] = [];
  let yes = 0;
  let no = 0;
  for (const p of cabinetMembers(s)) {
    if (p.isPlayer) { yes += 1; continue; }
    const stance = p.ideology.security * hawkish * 1.2 + (p.loyalty - 50) / 80 + (rand(s) - 0.5) * 0.5 + (hawkish > 0 ? 0.1 : -0.1) * weight;
    const ok = stance > -0.05;
    if (ok) yes += 1; else no += 1;
    lines.push({ icon: ok ? '👍' : '👎', label: p.name, text: ok ? (hawkish > 0 ? 'תומך. צריך לפעול.' : 'תומך. זה צעד נכון.') : (hawkish > 0 ? 'מתנגד. הסיכון גבוה מדי.' : 'מתנגד. זה פוגע בביטחון.'), tone: ok ? 'good' : 'bad' });
  }
  return { yes, no, passed: yes > no, lines: lines.slice(0, 5) };
}

const unitReadiness = (s: GameState, units: UnitId[]) => units.reduce((a, u) => a + world(s).units[u].readiness, 0) / Math.max(1, units.length);

export interface OpOutcome { success: boolean; fallen: number; civilians: number; text: string; headline: string; lines: ReactionLine[] }

/** Runs an approved operation now and returns what happened. */
export function executeOperation(s: GameState, op: OperationDef, frontId: FrontId): OpOutcome {
  const w = world(s);
  const front = w.fronts[frontId];
  const fdef = FRONT_BY_ID[frontId];
  const ready = unitReadiness(s, op.units);
  const intel = w.units.u8200.readiness;
  const pSuccess = clamp(0.42 + ready / 220 + intel / 500 - front.threat / 400 - (DIFFICULTIES[s.difficulty].volatility - 1) * 0.1, 0.12, 0.92);
  const success = rand(s) < pSuccess;
  const cut = success ? op.threatCut : Math.round(op.threatCut / 3);
  front.threat = clamp(front.threat - cut);
  front.status = op.id === 'wide_ground' || op.id === 'air_campaign' || op.id === 'iran_strike' ? 'fighting' : front.status === 'ceasefire' ? 'tension' : front.status;
  for (const u of op.units) w.units[u].readiness = clamp(w.units[u].readiness - (op.turns > 1 ? 22 : 10));
  // casualties: soldiers by risk; civilians from retaliation, reduced by air defense
  const fallen = op.risk > 0 ? Math.max(0, Math.round(rand(s) * op.risk * 20 * (success ? 0.8 : 1.6))) : 0;
  const retaliation = fdef.rocketRange && ['air_campaign', 'wide_ground', 'iran_strike', 'targeted_strike'].includes(op.id) && chance(s, op.id === 'targeted_strike' ? 0.3 : 0.8);
  const civilians = retaliation ? Math.max(0, Math.round(rand(s) * (op.id === 'iran_strike' ? 14 : 6) * (1.4 - w.units.air_defense.readiness / 100))) : 0;
  w.casualties.soldiers += fallen;
  w.casualties.civilians += civilians;
  // international reaction
  const usaCoord = (w.channels.usa ?? 0) >= 60;
  for (const c of ['eu', 'uk', 'un', 'china', 'russia']) w.relations[c] = clamp(w.relations[c] - op.intlCost * (c === 'un' ? 1.2 : 0.8));
  w.relations.usa = clamp(w.relations.usa - (usaCoord ? op.intlCost * 0.2 : op.intlCost * 0.6));
  // home politics and economy
  applyEffects(s, {
    oneOffCost: op.cost, economy: op.reservists ? { growth: -0.4, unemployment: 0.1 } : retaliation ? { growth: -0.1 } : undefined,
    groups: { ...(success ? HAWK_GROUPS : {}), ...(op.reservists ? { reservists: -6, families: -3, selfEmployed: -2 } : {}), ...(fallen > 0 ? { families: -2 } : {}), ...(civilians > 0 ? { periphery: -3 } : {}) },
    stability: success ? 3 : -3, playerPopularity: success ? 3 : -3,
  });
  if (op.id === 'iran_strike' && success) s.flags.iran_strike_done = s.turn;
  const lines: ReactionLine[] = [];
  const opName = `${op.name} – ${fdef.name}`;
  const parts = [success ? `המבצע השיג את מטרותיו. רמת האיום בחזית ירדה ב-${cut}.` : `המבצע השיג תוצאות חלקיות בלבד. רמת האיום ירדה ב-${cut}.`];
  if (fallen > 0) parts.push(`צה״ל הודיע בצער על נפילתם של ${fallen} לוחמים.`);
  if (civilians > 0) parts.push(`בירי לעבר העורף נהרגו ${civilians} אזרחים.`);
  else if (retaliation) parts.push('ירי לעבר העורף יורט ברובו בידי מערך ההגנה האווירית.');
  if (op.intlCost >= 8) parts.push(usaCoord ? 'הממשל האמריקאי גיבה את המבצע; באירופה הביקורת חריפה.' : 'הביקורת הבינלאומית חריפה, גם בוושינגטון.');
  if (fallen > 0) lines.push({ icon: '🕯️', label: 'לזכרם', text: `${fallen} לוחמים נפלו במבצע`, tone: 'bad' });
  const headline = success ? `${opName}: המבצע הושלם` : `${opName}: תוצאות חלקיות`;
  addNews(s, fallen > 0 ? `${headline}; ${fallen} לוחמים נפלו` : headline, success ? 'neutral' : 'bad', op.icon);
  logEvent(s, op.icon, `${opName}: ${success ? 'הצלחה' : 'הצלחה חלקית'}${fallen ? `, ${fallen} חללים` : ''}${civilians ? `, ${civilians} אזרחים נהרגו` : ''}`, 3, success ? 'good' : 'bad', 'security');
  s.career.memorable.push(`${opName} (${success ? 'הצלחה' : 'הצלחה חלקית'})`);
  return { success, fallen, civilians, text: parts.join(' '), headline, lines };
}

/** Once per turn: enemies rebuild, ceasefires hold or break, incidents happen, units recover. */
export function worldTick(s: GameState, months: number): void {
  const w = world(s);
  const vol = DIFFICULTIES[s.difficulty].volatility;
  for (const f of FRONTS) {
    const st = w.fronts[f.id];
    const rebuild = (st.status === 'ceasefire' ? 0.8 : 1.6) * months * vol * (f.id === 'iran' && s.flags.iran_strike_done ? 0.5 : 1);
    st.threat = clamp(st.threat + rebuild - (st.status === 'fighting' ? 3 : 0));
    if (st.status === 'fighting' && chance(s, 0.5)) st.status = 'tension';
    if (st.status === 'ceasefire' && (st.ceasefireUntil ?? Infinity) < s.turn) st.status = 'tension';
    // incidents: a rocket barrage, a drone, a terror attack
    const pIncident = clamp((st.threat - 25) / 120, 0, 0.5) * Math.min(1, months / 4) * (st.status === 'ceasefire' ? 0.4 : 1);
    if (chance(s, pIncident)) {
      st.incidents += 1;
      const civ = f.rocketRange ? Math.max(0, Math.round(rand(s) * 3 * (1.3 - w.units.air_defense.readiness / 100))) : Math.max(0, randInt(s, 0, 2));
      w.casualties.civilians += civ;
      const what = f.rocketRange ? (f.id === 'iran' || f.id === 'yemen' ? 'שיגור טילים' : 'ירי רקטות') : 'פיגוע';
      const text = civ > 0 ? `${what} מ${f.name}: ${civ} הרוגים` : `${what} מ${f.name}; ${f.rocketRange ? 'רוב השיגורים יורטו' : 'אין נפגעים'}`;
      addNews(s, text, 'bad', f.icon);
      logEvent(s, f.icon, text, civ > 0 ? 3 : 2, 'bad', 'security');
      applyEffects(s, { groups: { periphery: civ > 0 ? -3 : -1, families: civ > 0 ? -2 : 0, right: -1 }, stability: civ > 0 ? -2 : 0 });
      if (st.status === 'ceasefire' && civ > 0) st.status = 'tension';
    }
  }
  for (const u of UNITS) w.units[u.id].readiness = clamp(w.units[u.id].readiness + 4 * months / 4 + (s.budget.allocations.defense / s.budget.needs.defense - 1) * 10);
  // channels and relations drift back slowly
  for (const c of CHANNELS) w.channels[c.id] = clamp(w.channels[c.id] + (c.id === 'usa' ? 0.4 : -0.6) * months / 4);
}

// ---------------- diplomacy ----------------
export interface DipOutcome { ok: boolean; title: string; text: string; lines?: ReactionLine[] }

export function openChannel(s: GameState, ch: ChannelId, open: boolean): DipOutcome {
  const w = world(s);
  const gain = open ? randInt(s, 8, 14) : randInt(s, 5, 10);
  w.channels[ch] = clamp(w.channels[ch] + gain);
  const def = CHANNEL_BY_ID[ch];
  if (open) {
    const g = ch === 'pa' || ch === 'qatar' ? { right: -3, settlers: -3, left: 2 } : ch === 'usa' ? { center: 1 } : { center: 1, left: 1 };
    applyEffects(s, { groups: g, playerReputation: 2 });
    addNews(s, `שיחות גלויות עם ${def.name}`, 'neutral', def.icon);
  }
  return { ok: true, title: `${open ? 'שיחות גלויות' : 'ערוץ חשאי'} עם ${def.name}`, text: `${def.name}: רמת הקשר עלתה ל-${w.channels[ch].toFixed(0)}. ${open ? 'השיחות פומביות, והן מעוררות תגובות בבית.' : 'השיחות חשאיות ולא ידועות לציבור.'}` };
}

export function mediatedCeasefire(s: GameState, front: FrontId, via: ChannelId): DipOutcome {
  const w = world(s);
  const st = w.fronts[front];
  const p = clamp(0.2 + w.channels[via] / 160 + (st.status === 'fighting' ? 0.1 : 0) - st.threat / 300, 0.08, 0.85);
  const def = CHANNEL_BY_ID[via];
  if (rand(s) < p) {
    st.status = 'ceasefire';
    st.ceasefireUntil = s.turn + 3;
    st.threat = clamp(st.threat - 8);
    applyEffects(s, { groups: { ...DOVE_GROUPS, settlers: -2, families: 3 }, stability: 2 });
    w.relations.usa = clamp(w.relations.usa + 4);
    w.relations.eu = clamp(w.relations.eu + 5);
    addNews(s, `בתיווך ${def.name}: הפסקת אש ב${FRONT_BY_ID[front].name}`, 'good', '🕊️');
    logEvent(s, '🕊️', `הפסקת אש ב${FRONT_BY_ID[front].name} בתיווך ${def.name}`, 3, 'good', 'security');
    return { ok: true, title: `הפסקת אש ב${FRONT_BY_ID[front].name}`, text: `בתיווך ${def.name} הושגה הפסקת אש לשנה. הימין מבקר; משפחות בעורף מברכות.` };
  }
  w.channels[via] = clamp(w.channels[via] - 4);
  return { ok: false, title: 'התיווך לא הצליח', text: `${def.name} לא הצליחה לגשר על הפערים. אפשר לחזק את הערוץ ולנסות שוב (הסיכוי היה ${Math.round(p * 100)}%).` };
}

const RIGHT_PARTNERS = ['otzma', 'rzp', 'noam'];
function rightPartnersReact(s: GameState, severity: number, what: string): ReactionLine[] {
  const lines: ReactionLine[] = [];
  for (const pid of s.government.coalition.filter((id) => RIGHT_PARTNERS.includes(id))) {
    const l = s.politicians[s.parties[pid].leaderId];
    if (!l) continue;
    remember(s, l.id, 'betrayal', what, -8 * severity);
    if (chance(s, 0.18 * severity)) {
      partyLeavesCoalition(s, pid, `הממשלה ${what}`);
      lines.push({ icon: '🚪', label: s.parties[pid].name, text: 'פורשים מהממשלה.', tone: 'bad' });
    } else lines.push({ icon: '⚠️', label: l.name, text: 'זה קו אדום. נשקול את המשך דרכנו בממשלה.', tone: 'bad' });
  }
  return lines;
}

export type CbmKind = 'permits' | 'economy' | 'taxes' | 'checkpoints';
export const CBM: Record<CbmKind, { name: string; desc: string }> = {
  permits: { name: 'היתרי עבודה לפלסטינים', desc: 'עוד עובדים פלסטינים בבנייה ובחקלאות: מקל על המחסור בעובדים ומפחית מתיחות.' },
  economy: { name: 'פרויקטים כלכליים בשטחי A ו-B', desc: 'אזורי תעשייה ותשתיות בשיתוף מדינות המפרץ.' },
  taxes: { name: 'העברת כספי המסים לרשות', desc: 'שחרור כספים שהוקפאו. מחזק את הרשות מול חמאס.' },
  checkpoints: { name: 'הקלות במחסומים', desc: 'פחות מחסומים ותנועה חופשית יותר בין הערים.' },
};

export function confidenceMeasure(s: GameState, kind: CbmKind): DipOutcome {
  const w = world(s);
  if (!w.measures.includes(kind)) w.measures.push(kind);
  w.channels.pa = clamp(w.channels.pa + 10);
  w.channels.jordan = clamp(w.channels.jordan + 4);
  w.channels.saudi = clamp(w.channels.saudi + 3);
  w.relations.eu = clamp(w.relations.eu + 3);
  w.fronts.judea_samaria.threat = clamp(w.fronts.judea_samaria.threat - 6);
  applyEffects(s, {
    groups: { ...DOVE_GROUPS, ...(kind === 'permits' ? { selfEmployed: 2 } : {}) },
    economy: kind === 'permits' || kind === 'economy' ? { growth: 0.05 } : undefined,
    revenue: kind === 'taxes' ? -0.3 : 0,
  });
  const lines = rightPartnersReact(s, 1, `נקטה צעד בונה אמון: ${CBM[kind].name}`);
  addNews(s, `הממשלה אישרה: ${CBM[kind].name}`, 'neutral', '🤝');
  return { ok: true, title: CBM[kind].name, text: 'המתיחות ביהודה ושומרון ירדה. הרשות הפלסטינית וירדן מברכות; בימין מוחים.', lines };
}

/** Transfer 2% of Judea and Samaria from Area C to B, or from B to A (Oslo terms). */
export function transferArea(s: GameState, from: 'C' | 'B'): DipOutcome {
  const w = world(s);
  const to = from === 'C' ? 'B' : 'A';
  if (w.areas[from] < 2) return { ok: false, title: 'אין מה להעביר', text: `לא נשאר שטח ${from} להעברה.` };
  w.areas[from] -= 2;
  w.areas[to] += 2;
  w.channels.pa = clamp(w.channels.pa + 15);
  w.channels.saudi = clamp(w.channels.saudi + 8);
  w.channels.jordan = clamp(w.channels.jordan + 6);
  w.relations.usa = clamp(w.relations.usa + 4);
  w.relations.eu = clamp(w.relations.eu + 8);
  w.fronts.judea_samaria.threat = clamp(w.fronts.judea_samaria.threat - 5);
  applyEffects(s, { groups: { settlers: -12, right: -7, religious: -3, left: 5, liberals: 3, arabs: 4, center: 1 }, stability: -6, playerReputation: 2 });
  const lines = rightPartnersReact(s, 2.5, `העבירה שטח ${from} לשטח ${to}`);
  addNews(s, `הממשלה אישרה העברת 2% משטח ${from} לשטח ${to} ביהודה ושומרון`, 'bad', '🗺️');
  logEvent(s, '🗺️', `העברת שטח ${from}→${to}`, 3, 'neutral', 'security');
  s.career.memorable.push(`העביר שטח ${from} ל-${to} ביהודה ושומרון`);
  return { ok: true, title: `העברת שטח ${from} → ${to}`, text: `שטח A: ${w.areas.A}% · B: ${w.areas.B}% · C: ${w.areas.C}%. מועצת יש״ע והימין מוחים בחריפות; בעולם ובמפרץ מברכים.`, lines };
}

export function normalization(s: GameState, ch: 'saudi'): DipOutcome {
  const w = world(s);
  if (w.normalized.includes(ch)) return { ok: false, title: 'כבר נחתם', text: 'ההסכם כבר נחתם.' };
  const pa = w.channels.pa;
  const p = clamp(-0.2 + w.channels[ch] / 120 + pa / 250 + (w.areas.C < OSLO_AREAS_START.C ? 0.15 : 0) + (w.relations.usa - 50) / 200, 0.03, 0.8);
  if (rand(s) < p) {
    w.normalized.push(ch);
    applyEffects(s, { economy: { growth: 0.5 }, groups: { center: 5, highIncome: 4, liberals: 3, right: 1, settlers: -2 }, playerPopularity: 8, playerReputation: 8, stability: 4 });
    for (const c of ['usa', 'eu', 'uk', 'india']) w.relations[c] = clamp(w.relations[c] + 8);
    addNews(s, `היסטוריה: נחתם הסכם נורמליזציה עם ${CHANNEL_BY_ID[ch].name}`, 'good', '🕊️');
    logEvent(s, '🕊️', `הסכם נורמליזציה עם ${CHANNEL_BY_ID[ch].name}`, 3, 'good', 'security');
    s.career.achievements.push(`הסכם נורמליזציה עם ${CHANNEL_BY_ID[ch].name}`);
    return { ok: true, title: `הסכם נורמליזציה עם ${CHANNEL_BY_ID[ch].name}`, text: 'פריצת דרך מדינית. צפויים השקעות, טיסות ישירות ושיתוף פעולה ביטחוני.' };
  }
  w.channels[ch] = clamp(w.channels[ch] - 5);
  return { ok: false, title: 'השיחות על נורמליזציה נתקעו', text: `הצד השני דורש צעדים משמעותיים יותר מול הפלסטינים (הסיכוי היה ${Math.round(p * 100)}%).` };
}

export function unitTraining(s: GameState, unit: UnitId): DipOutcome {
  const w = world(s);
  w.units[unit].readiness = clamp(w.units[unit].readiness + 15);
  return { ok: true, title: `אימון: ${UNIT_BY_ID[unit].name}`, text: `הכשירות עלתה ל-${w.units[unit].readiness.toFixed(0)}.` };
}

export const operationById = (id: string) => OPERATION_BY_ID[id];
