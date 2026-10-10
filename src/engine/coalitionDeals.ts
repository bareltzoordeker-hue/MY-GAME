// ============================================================
// Coalition deals: what partners demand, what the player can offer,
// the written coalition agreement and how its commitments are tracked
// (reminders before a deadline, consequences when a promise is broken).
// ============================================================
import { LAW_BY_ID } from '../data/laws';
import { CATEGORY_BY_ID } from '../data/world';
import { chance } from './rng';
import type { Commitment, Demand, GameState, Party } from '../types/game';
import { clamp, newId } from '../utils';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { assignMinister, getMinistry, partyLeavesCoalition } from './government';
import { dayNumber } from './calendar';
import { startCrisis } from './crises';
import { BUDGET_PREF } from './elections';

/** Knesseton committees a partner may ask to chair, by the domain it cares about. */
const COMMITTEE_BY_DOMAIN: Record<string, string> = {
  finance: 'ועדת הכספים', economy: 'ועדת הכלכלה', defense: 'ועדת החוץ והביטחון', foreign: 'ועדת החוץ והביטחון', law: 'ועדת החוקה, חוק ומשפט',
  education: 'ועדת החינוך', health: 'ועדת הבריאות', welfare: 'ועדת העבודה והרווחה', interior: 'ועדת הפנים', housing: 'ועדת הפנים',
  transport: 'ועדת הכלכלה', energy: 'ועדת הכלכלה', agriculture: 'ועדת הכלכלה', culture: 'ועדת החינוך', media: 'ועדת הכלכלה',
};
const KEY_MINISTRIES = ['finance', 'defense', 'foreign'];

/** How much each kind of sweetener moves a party's willingness to join. */
export const SWEETENER_VALUE: Record<string, number> = { ministry: 0.15, deputy: 0.06, committee: 0.08, budget: 0.07, jobs: 0.05, rotation: 0.3, cash: 0.18 };

function committeeFor(s: GameState, party: Party): string {
  const m = party.preferredMinistries.map((id) => getMinistry(s, id)).find(Boolean);
  return COMMITTEE_BY_DOMAIN[m?.domain ?? ''] ?? 'ועדת הכלכלה';
}

/** What a party asks for, based on its size, interests and values. */
export function demandsFor(s: GameState, party: Party, formateurSeats: number): Demand[] {
  const out: Demand[] = [];
  const mins = party.preferredMinistries.map((id) => getMinistry(s, id)).filter((m) => !!m && (!KEY_MINISTRIES.includes(m.id) || party.seats >= 8));
  if (mins[0]) out.push({ kind: 'ministry', ministryId: mins[0]!.id, label: mins[0]!.name });
  if (party.seats >= 9 && mins[1]) out.push({ kind: 'ministry', ministryId: mins[1]!.id, label: mins[1]!.name });
  if (party.seats >= 5 && mins[0]) out.push({ kind: 'deputy', ministryId: (mins[2] ?? mins[0])!.id, label: `סגן שר ב${(mins[2] ?? mins[0])!.name}` });
  if (party.seats >= 6) { const c = committeeFor(s, party); out.push({ kind: 'committee', committee: c, label: `ראשות ${c}` }); }
  const cat = BUDGET_PREF[party.id] ?? 'welfare';
  const amount = clamp(Math.round(party.seats / 4 + 1), 1, 5);
  out.push({ kind: 'budget', category: cat, amount, label: `+₪${amount}B ל${CATEGORY_BY_ID[cat].name}` });
  const law = party.favoriteLaws.find((l) => !s.activeLaws.includes(l) && LAW_BY_ID[l]);
  if (law) out.push({ kind: 'law', lawId: law, label: `לחוקק: ${LAW_BY_ID[law].title}` });
  const veto = [...(party.redLines ?? []), ...party.hatedLaws].find((l) => LAW_BY_ID[l] && !s.activeLaws.includes(l));
  if (veto) out.push({ kind: 'veto', lawId: veto, label: `לא לקדם: ${LAW_BY_ID[veto].title}` });
  // a partner almost as big as the formateur asks to share the premiership
  if (party.seats >= formateurSeats * 0.7 && party.seats >= 10) out.push({ kind: 'rotation', label: 'רוטציה בראשות הממשלה אחרי שנתיים' });
  return out;
}

/** What the player may add to win a party over. Each has a price. */
export function sweetenerOptions(s: GameState, partyId: string): Demand[] {
  const party = s.parties[partyId];
  const n = s.elections.negotiation;
  if (!party || !n) return [];
  const taken = new Set(Object.values(n.offers).flatMap((o) => o.demands.filter((d) => d.kind === 'ministry').map((d) => d.ministryId)));
  const free = s.government.ministries.filter((m) => !taken.has(m.id) && !KEY_MINISTRIES.includes(m.id));
  const extra = free.find((m) => party.preferredMinistries.includes(m.id)) ?? free[0];
  const mine = n.offers[partyId]?.demands ?? [];
  const has = (k: string) => mine.some((d) => d.kind === k && d.sweetener);
  const cat = BUDGET_PREF[party.id] ?? 'welfare';
  const out: Demand[] = [];
  if (extra) out.push({ kind: 'ministry', ministryId: extra.id, label: `תיק נוסף: ${extra.name}`, sweetener: true });
  if (!has('deputy')) out.push({ kind: 'deputy', ministryId: extra?.id ?? party.preferredMinistries[0], label: `סגן שר נוסף${extra ? ` ב${extra.name}` : ''}`, sweetener: true });
  if (!has('committee')) { const c = committeeFor(s, party); out.push({ kind: 'committee', committee: c, label: `ראשות ${c}`, sweetener: true }); }
  out.push({ kind: 'budget', category: cat, amount: 1, label: `+₪1B נוסף ל${CATEGORY_BY_ID[cat].name}`, sweetener: true });
  if (!has('jobs')) out.push({ kind: 'jobs', label: 'מינויים בחברות ממשלתיות ובדירקטוריונים', sweetener: true });
  if (!has('rotation') && party.seats >= 8 && !mine.some((d) => d.kind === 'rotation')) out.push({ kind: 'rotation', label: 'רוטציה בראשות הממשלה אחרי שנתיים', sweetener: true });
  if (!has('cash')) out.push({ kind: 'cash', amount: 0.3, label: 'כספים ייעודיים מחוץ לתקציב (חשאי, עלול להיחשף)', sweetener: true });
  return out;
}

/** Turns the accepted offers into the written coalition agreement (after the government is installed). */
export function writeAgreement(s: GameState, accepted: { partyId: string; demands: Demand[] }[]): void {
  const g = s.government;
  g.agreements = [];
  for (const o of accepted) {
    const party = s.parties[o.partyId];
    const leaderId = party.leaderId;
    const members = party.memberIds.map((id) => s.politicians[id]).filter((p) => p && p.active && !p.isPlayer && !p.ministryId && p.inKnesset !== false);
    for (const d of o.demands) {
      const c: Commitment = { id: newId(s, 'cm'), partyId: o.partyId, kind: d.kind, label: d.label, lawId: d.lawId, ministryId: d.ministryId, status: 'kept' };
      switch (d.kind) {
        case 'budget':
          if (d.category && d.amount) s.budget.allocations[d.category] += d.amount;
          break;
        case 'deputy': {
          const who = members.shift();
          if (who) { who.deputyOf = d.ministryId; who.power = clamp(who.power + 5); }
          break;
        }
        case 'committee': {
          const who = members.shift();
          if (who) { who.committee = d.committee ?? null; who.power = clamp(who.power + 6); }
          break;
        }
        case 'jobs':
          for (const m of g.ministries) if (m.agreementPartyId === o.partyId) m.efficiency = clamp(m.efficiency - 4);
          applyEffects(s, { playerReputation: -1 });
          break;
        case 'law':
          c.status = 'pending';
          c.dueTurn = s.turn + 12; // two years of two-month turns
          break;
        case 'veto':
          c.status = 'pending';
          break;
        case 'rotation':
          c.status = 'pending';
          c.dueDay = dayNumber(s.date) + 730;
          break;
        case 'cash':
          c.status = 'pending';
          c.secret = true;
          s.economy.debt += d.amount ?? 0.3;
          break;
      }
      g.agreements.push(c);
    }
    remember(s, leaderId, 'deal', 'הסכם קואליציוני', 10);
  }
}

const leader = (s: GameState, partyId: string) => s.politicians[s.parties[partyId]?.leaderId ?? ''];

function breach(s: GameState, c: Commitment, why: string): void {
  c.status = 'broken';
  // the first year of a government is a honeymoon: a missed promise is remembered, but partners don't walk out over it
  const honeymoon = s.turn - (s.government.formedTurn ?? 0) < 6;
  const l = leader(s, c.partyId);
  if (l) remember(s, l.id, 'betrayal', why, -22);
  applyEffects(s, { stability: honeymoon ? -3 : -6 });
  addNews(s, `${s.parties[c.partyId].name}: "ההסכם הקואליציוני הופר – ${c.label}"`, 'bad', '📜');
  logEvent(s, '📜', `הפרת התחייבות ל${s.parties[c.partyId].name}: ${c.label}`, 3, 'bad', 'coalition');
  if (!honeymoon && s.government.coalition.includes(c.partyId) && chance(s, 0.25)) partyLeavesCoalition(s, c.partyId, `הפרת ההסכם הקואליציוני: ${c.label}`);
}

function remind(s: GameState, c: Commitment, text: string): void {
  if (c.remindedTurn === s.turn) return;
  c.remindedTurn = s.turn;
  s.inbox.push({
    id: newId(s, 'in'), kind: 'commitment_reminder', title: `תזכורת: התחייבות ל${s.parties[c.partyId].name}`, text,
    fromId: s.parties[c.partyId].leaderId, createdTurn: s.turn, expiresTurn: s.turn + 1,
    options: [{ id: 'ok', label: 'הבנתי' }], defaultOptionId: 'ok', payload: { commitmentId: c.id },
  });
}

/** Every turn: keep, remind, or break the coalition agreement's commitments. Only for a government the player formed. */
export function processCommitments(s: GameState): void {
  const list = s.government.agreements;
  if (!list?.length || s.government.pmId !== s.player.politicianId && !list.some((c) => c.kind === 'rotation')) return;
  for (const c of list) {
    if (c.status !== 'pending') continue;
    const inGov = s.government.coalition.includes(c.partyId);
    if (!inGov && c.kind !== 'cash') continue;
    switch (c.kind) {
      case 'law': {
        if (c.lawId && s.activeLaws.includes(c.lawId)) {
          c.status = 'kept';
          const l = leader(s, c.partyId);
          if (l) remember(s, l.id, 'favor', `קיים את ההתחייבות: ${c.label}`, 12);
          applyEffects(s, { stability: 4 });
          logEvent(s, '✅', `קיימת התחייבות קואליציונית: ${c.label}`, 2, 'good', 'coalition');
        } else if (c.dueTurn !== undefined && s.turn >= c.dueTurn) {
          breach(s, c, `לא קיים: ${c.label}`);
        } else if (c.dueTurn !== undefined && c.dueTurn - s.turn <= 2) {
          remind(s, c, `לפי ההסכם הקואליציוני, "${c.label.replace('לחוקק: ', '')}" צריך לעבור עד התור הבא. אם לא – ${s.parties[c.partyId].name} תראה בזה הפרה.`);
        }
        break;
      }
      case 'veto': {
        const advanced = c.lawId && (s.activeLaws.includes(c.lawId) || s.bills.some((b) => b.lawId === c.lawId && b.status === 'active' && (b.isGovernment || b.sponsorId === s.player.politicianId)));
        if (advanced) breach(s, c, `קידם חוק שהתחייב לא לקדם: ${c.label}`);
        break;
      }
      case 'rotation': {
        if (c.dueDay !== undefined && dayNumber(s.date) >= c.dueDay) {
          if (!s.inbox.some((i) => i.kind === 'rotation_due')) {
            const l = leader(s, c.partyId);
            s.inbox.push({
              id: newId(s, 'in'), kind: 'rotation_due', title: 'הגיע מועד הרוטציה', fromId: l?.id, createdTurn: s.turn, expiresTurn: s.turn + 1,
              text: `לפי ההסכם, ${l?.name ?? 'יו״ר השותפה'} אמור להיכנס עכשיו לתפקיד ראש הממשלה. אם תכבד את ההסכם, תמשיך בממשלה כשר החוץ. אם לא – השותפה תפרוש.`,
              options: [{ id: 'honor', label: 'לכבד את הרוטציה' }, { id: 'refuse', label: 'לסרב' }], defaultOptionId: 'honor', payload: { commitmentId: c.id },
            });
          }
        } else if (c.dueDay !== undefined && c.dueDay - dayNumber(s.date) <= 130) {
          remind(s, c, `בעוד כ-4 חודשים מגיע מועד הרוטציה עם ${s.parties[c.partyId].name}.`);
        }
        break;
      }
      case 'cash': {
        if (chance(s, 0.06)) {
          c.status = 'broken';
          startCrisis(s, 'scandal', 2);
          applyEffects(s, { playerReputation: -10, playerPopularity: -6, stability: -5 });
          addNews(s, `חשד: כספים קואליציוניים הועברו ל${s.parties[c.partyId].name} מחוץ לתקציב`, 'bad', '🔎');
          logEvent(s, '🔎', 'נחשפה העברת כספים חשאית לשותפה קואליציונית', 3, 'bad', 'coalition');
          s.career.failures.push('נחשפה העברת כספים חשאית לשותפה קואליציונית');
        }
        break;
      }
    }
  }
}

/** The player decides on the rotation when it falls due. */
export function resolveRotation(s: GameState, commitmentId: string, honor: boolean): string {
  const c = s.government.agreements?.find((x) => x.id === commitmentId);
  if (!c || c.status !== 'pending') return 'ההסכם כבר לא בתוקף.';
  const l = leader(s, c.partyId);
  if (!honor || !l) {
    breach(s, c, 'סירב לכבד את הרוטציה');
    return 'סירבת לכבד את הרוטציה. השותפה רואה בזה הפרה חמורה של ההסכם.';
  }
  c.status = 'kept';
  const me = s.politicians[s.player.politicianId];
  s.government.pmId = l.id;
  if (l.ministryId) { const m = getMinistry(s, l.ministryId); if (m) m.ministerId = null; l.ministryId = null; }
  const foreign = getMinistry(s, 'foreign');
  if (foreign) assignMinister(s, 'foreign', me.id);
  applyEffects(s, { stability: 6, playerReputation: 6 });
  addNews(s, `רוטציה: ${l.name} נכנס לתפקיד ראש הממשלה; ${me.name} – שר החוץ`, 'neutral', '🔄');
  logEvent(s, '🔄', `כיבדת את הרוטציה. ${l.name} ראש הממשלה`, 3, 'neutral', 'coalition');
  s.career.memorable.push('כיבד הסכם רוטציה');
  return `${l.name} נכנס לתפקיד ראש הממשלה. אתה ממשיך בממשלה כשר החוץ.`;
}
