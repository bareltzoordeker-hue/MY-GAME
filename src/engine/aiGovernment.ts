// AI-run government for when the player is not the PM.
import { CATEGORIES, MAJORITY } from '../data/world';
import { PROJECTS } from '../data/projects';
import { LAW_BY_ID } from '../data/laws';
import { chance, pick } from './rng';
import type { BudgetCategory, GameState } from '../types/game';
import { clamp, deficitPct, round1 } from '../utils';
import { addInbox } from './characters';
import { addNews, logEvent, remember } from './effects';
import { proposeBill, voteBudget } from './parliament';
import { startProject } from './projects';
import { isPM } from './roles';
import { callEarlyElections } from './elections';
import { coalitionSeats } from './polls';
import { syncRole } from './career';
import { canHandleCrisis, crisisOwner } from './crises';

/** Called on the January turn: new fiscal year. */
export function newFiscalYear(s: GameState): void {
  s.budget.fiscalYear = s.date.year;
  s.budget.passed = false;
  s.budget.deadlineTurn = s.turn + 1;
  if (isPM(s)) {
    addInbox(s, {
      kind: 'budget_review', title: `תקציב ${s.date.year} ממתין לאישור`, expiresTurn: s.turn + 1,
      text: 'עדכן את חלוקת התקציב והגש לכנסטון. אם התקציב לא יאושר במועד הקבוע בחוק, הכנסטון יתפזר ויתקיימו בחירות.',
      options: [{ id: 'submit', label: 'להגיש עכשיו' }, { id: 'later', label: 'אעבור על התקציב קודם' }],
      defaultOptionId: 'submit', payload: {},
    });
  } else {
    // AI PM rebalances
    const def = deficitPct(s);
    for (const c of CATEGORIES) {
      const r = s.budget.allocations[c.id] / s.budget.needs[c.id];
      if (def > 4 && c.id !== 'defense') s.budget.allocations[c.id] *= 0.98;
      else if (def < 3 && r < 0.97) s.budget.allocations[c.id] *= 1.025;
    }
  }
}

export function processBudgetDeadline(s: GameState): void {
  if (s.budget.passed || s.turn < s.budget.deadlineTurn) return;
  const v = voteBudget(s);
  if (v.passed) {
    s.budget.passed = true;
    addNews(s, `תקציב ${s.budget.fiscalYear} אושר בכנסטון (${v.for}-${v.against})`, 'good', '📒');
    logEvent(s, '📒', `התקציב אושר (${v.for}-${v.against})`, 2, 'good', 'budget');
  } else {
    addNews(s, `התקציב נפל! (${v.for}-${v.against})`, 'bad', '💥');
    s.budget.passed = true; // a continuation budget applies
    callEarlyElections(s, 'התקציב לא אושר');
  }
}

export function simulateAIGovernment(s: GameState): void {
  if (isPM(s)) return;
  const pm = s.politicians[s.government.pmId];
  if (!pm) return;
  const me = s.politicians[s.player.politicianId];
  const myPartyInGov = s.government.coalition.includes(me.partyId);

  // government bills
  if (chance(s, 0.14)) {
    const lawIds = s.government.coalition.flatMap((pid) => s.parties[pid].favoriteLaws)
      .filter((l) => !s.activeLaws.includes(l) && !s.bills.some((b) => b.lawId === l && b.status === 'active'))
      .filter((l) => !s.government.coalition.some((pid) => s.parties[pid].hatedLaws.includes(l)));
    if (lawIds.length) {
      const lawId = pick(s, lawIds);
      if (proposeBill(s, lawId, pm.id, true)) addNews(s, `הממשלה מקדמת את ${LAW_BY_ID[lawId].title}`, 'neutral', '🏛️');
    }
  }
  // projects
  if (chance(s, 0.1) && deficitPct(s) < 4 && s.projects.filter((p) => p.status === 'active').length < 4) {
    const avail = PROJECTS.filter((p) => !s.projects.some((x) => x.defId === p.id && x.status !== 'cancelled') && p.cost < 12);
    if (avail.length) startProject(s, pick(s, avail).id, pm.id);
  }
  // crises outside the player's responsibility are handled (eventually) by the responsible minister / PM
  for (const c of [...s.crises]) {
    if (canHandleCrisis(s, c) || c.startTurn === s.turn || !chance(s, 0.35)) continue;
    const a = c.actions.find((x) => x.id !== 'ignore' && x.cost > 0) ?? c.actions[0];
    s.economy.debt += a.cost;
    s.crises = s.crises.filter((x) => x !== c);
    addNews(s, `${crisisOwner(s, c)}: "${a.label}" – ${c.title} הסתיים`, 'neutral', c.icon);
    logEvent(s, c.icon, `הממשלה טיפלה ב${c.title} (${a.label})`, 2, 'neutral', 'crisis');
  }
  // losing the majority → early elections
  if (coalitionSeats(s) < MAJORITY && s.government.lowMajorityTurns >= 2) callEarlyElections(s, 'הקואליציה איבדה את הרוב');

  // ---- the player's career inside an AI government ----
  const pmTrust = pm.loyalty; // pm's attitude toward the player
  if (s.player.role === 'minister' && pmTrust < 18 && chance(s, 0.25)) {
    const min = s.government.ministries.find((m) => m.ministerId === me.id);
    if (min) {
      min.ministerId = null;
      me.ministryId = null;
      s.career.failures.push(`פוטר מ${min.name}`);
      addNews(s, `${pm.name} פיטר את ${me.name} מ${min.name}`, 'bad', '🔥');
      logEvent(s, '🔥', `ראש הממשלה פיטר אותך מ${min.name}`, 3, 'bad', 'career');
      remember(s, pm.id, 'fired', 'פיטר אותך', 0);
      syncRole(s);
    }
  }
  if (s.player.role === 'mk' && myPartyInGov && me.power >= 40 && s.player.reputation >= 45 && (s.flags.offer_cd ?? 0) <= s.turn) {
    const leader = s.politicians[s.parties[me.partyId].leaderId];
    const trust = (leader?.loyalty ?? 50) * 0.6 + pmTrust * 0.4;
    if (trust > 52 && chance(s, 0.3)) {
      const mins = s.government.ministries.filter((m) => m.agreementPartyId === me.partyId || m.satire);
      const weakest = mins.sort((a, b) => {
        const pa = a.ministerId ? s.politicians[a.ministerId]?.power ?? 0 : 0;
        const pb = b.ministerId ? s.politicians[b.ministerId]?.power ?? 0 : 0;
        return pa - pb;
      })[0];
      if (weakest) {
        s.flags.offer_cd = s.turn + 6;
        addInbox(s, {
          kind: 'promotion_offer', title: `הצעה: ${weakest.name}`, fromId: pm.id, expiresTurn: s.turn + 2,
          text: `"${me.name}, אני רוצה אותך בממשלה. ${weakest.name} – שלך, אם אתה רוצה."`,
          options: [{ id: 'accept', label: 'לקבל' }, { id: 'decline', label: 'לסרב' }], defaultOptionId: 'decline',
          payload: { ministryId: weakest.id },
        });
      }
    }
  }
  // committee chair for promising MKs
  if (s.player.role === 'mk' && !me.committee && me.power >= 30 && s.player.reputation >= 40 && chance(s, 0.15)) {
    me.committee = pick(s, ['ועדת הכספים', 'ועדת החינוך', 'ועדת הכלכלה', 'ועדת החוץ והביטחון', 'ועדת הפנים']);
    me.power = clamp(me.power + 8);
    addNews(s, `${me.name} מונה ליו״ר ${me.committee}`, 'good', '🪧');
    logEvent(s, '🪧', `מונית ליו״ר ${me.committee}`, 3, 'good', 'career');
    s.career.memorable.push(`מונה ליו״ר ${me.committee}`);
  }
}

/** The AI PM decides on a request from the player (minister). */
/** `funding`: the asking ministry's budget as a share of its need. The better it is funded, the easier the yes; at 100%+ the deficit is no excuse. */
export function aiPmDecides(s: GameState, amount: number, funding = 1): { approved: boolean; chance: number } {
  const pm = s.politicians[s.government.pmId];
  const me = s.politicians[s.player.politicianId];
  const deficitPenalty = funding >= 1 ? 0 : Math.max(0, deficitPct(s) - 3) * 0.12 * (1 - funding);
  const fundingBonus = clamp((funding - 0.85) * 1.5, -0.3, 0.45);
  const p = clamp(0.35 + (pm.loyalty - 50) / 100 + (me.power - 50) / 200 - deficitPenalty - amount * 0.03 + fundingBonus, 0.05, 0.95);
  return { approved: chance(s, p), chance: p };
}

export function requestBudgetAmount(s: GameState, cat: BudgetCategory): number {
  return round1(s.budget.needs[cat] * 0.05);
}
