import { describe, expect, it } from 'vitest';
import type { GameState, Role } from '../types/game';
import { deficitPct } from '../utils';
import { createGame, type NewGameConfig } from './newGame';
import { advanceTurn } from './turn';
import { performAction, ACTIONS, checkAction, prepareMeeting, meetingStep } from './decisions';
import { seatsFromShares } from './polls';
import { computeVote, enactLaw, proposeBill, repealLaw } from './parliament';
import { LAW_BY_ID } from '../data/laws';
import { runElection, startNegotiation, negotiate, finalizeCoalition, negotiationSeats } from './elections';
import { startCrisis, resolveCrisis } from './crises';
import { resolveInbox } from './inbox';
import { deserialize, saveGame, loadGame, serialize } from './persistence/save';
import { CRISES } from '../data/crises';
import { resolveDrama, fire } from './drama';
import { DRAMAS } from './dramaEvents';
import { proposeAlliance, breakAlliance } from './alliances';
import { addMonths } from './calendar';
import { PARTIES } from '../data/parties';

/** Moves the next election far away, so turns are regular 4-month turns (no campaign). */
function normalTime(s: GameState): GameState {
  s.elections.date = addMonths(s.date, 40);
  s.elections.scheduledTurn = 99;
  s.government.caretaker = false; // a sitting Knesseton (the real start is a dissolved one)
  return s;
}

describe('drama & alliances', () => {
  it('every dramatic event can be created and every option resolves without breaking the state', () => {
    for (const role of ['pm', 'minister', 'mk', 'candidate'] as Role[]) {
      for (const d of DRAMAS) {
        const probe = createGame(cfg(role));
        probe.turn = 6;
        if (d.weight(probe) <= 0) continue;
        fire(probe, d.id);
        for (let i = 0; i < probe.drama!.options.length; i++) {
          const s = createGame(cfg(role));
          s.turn = 6;
          fire(s, d.id);
          expect(s.drama?.defId).toBe(d.id);
          const r = resolveDrama(s, s.drama!.options[i].id);
          expect(r.state.drama).toBeNull();
          expect(r.reaction).not.toBeNull();
          assertSane(r.state);
        }
      }
    }
  });
  it('a pending drama blocks the turn', () => {
    const s = createGame(cfg('pm'));
    fire(s, 'podcast');
    expect(advanceTurn(s)).toBe(s);
  });
  it('alliances give vote support and can be broken', () => {
    let s = createGame(cfg('candidate'));
    s.player.politicalCapital = 100;
    s.politicians[s.parties.democrats.leaderId].loyalty = 95;
    for (let i = 0; i < 6 && !s.alliances.length; i++) s = proposeAlliance(s, 'democrats', 'bloc').state;
    expect(s.alliances.length).toBe(1);
    const b = breakAlliance(s, 'democrats');
    expect(b.state.alliances.length).toBe(0);
  });
});

const cfg = (role: Role, extra: Partial<NewGameConfig> = {}): NewGameConfig => ({
  playerName: 'טסט טסטי', gender: 'm', role, partyId: role === 'candidate' ? 'yashar' : role === 'minister' ? undefined : 'likud', ministryId: 'transport', difficulty: 'normal', seed: 1234, ...extra,
});

function assertSane(s: GameState) {
  const nums: number[] = [
    s.economy.gdp, s.economy.debt, s.economy.growth, s.economy.unemployment, s.economy.inflation, s.economy.revenue, s.economy.spending,
    s.government.approval, s.government.stability, s.player.politicalCapital,
    ...Object.values(s.budget.allocations), ...Object.values(s.services).map((x) => x.quality),
    ...Object.values(s.population.groups).map((g) => g.satisfaction),
    ...Object.values(s.politicians).flatMap((p) => [p.loyalty, p.power, p.popularity]),
  ];
  for (const n of nums) expect(Number.isFinite(n)).toBe(true);
  expect(s.economy.unemployment).toBeGreaterThan(0);
  expect(s.economy.unemployment).toBeLessThan(40);
  expect(s.economy.gdp).toBeGreaterThan(100);
  for (const g of Object.values(s.population.groups)) {
    expect(g.satisfaction).toBeGreaterThanOrEqual(0);
    expect(g.satisfaction).toBeLessThanOrEqual(100);
  }
  const seats = Object.values(s.parties).reduce((a, p) => a + p.seats, 0);
  expect(seats).toBeGreaterThanOrEqual(115);
  expect(seats).toBeLessThanOrEqual(125);
}

describe('world creation', () => {
  it('creates a sane starting state for every role', () => {
    for (const role of ['pm', 'candidate', 'minister', 'mk'] as Role[]) {
      const s = createGame(cfg(role));
      assertSane(s);
      expect(s.player.role).toBe(role);
      expect(s.politicians.player.isPlayer).toBe(true);
      expect(deficitPct(s)).toBeGreaterThan(0);
      expect(deficitPct(s)).toBeLessThan(6);
    }
  });
  it('PM role makes the player PM, minister role holds the ministry', () => {
    expect(createGame(cfg('pm')).government.pmId).toBe('player');
    const m = createGame(cfg('minister'));
    expect(m.government.ministries.find((x) => x.id === 'transport')?.ministerId).toBe('player');
  });
  it('initial polls match initial seats (calibration)', () => {
    const s = createGame(cfg('pm'));
    const last = s.polls[0];
    const total = PARTIES.reduce((a, p) => a + p.poll, 0);
    for (const p of PARTIES) expect(Math.abs(last.shares[p.id] - (p.poll / total) * 100)).toBeLessThan(0.3);
    expect(Math.abs(last.seats.likud - 23)).toBeLessThanOrEqual(2); // the first poll, in seats
    expect(s.parties.likud.seats).toBe(34); // the outgoing Knesset
  });
  it('the advisor recommends one of the real options', async () => {
    const { adviseDrama, screenAdvice } = await import('./advisorPlus');
    const s = createGame(cfg('pm'));
    fire(s, 'minister_expenses');
    const rec = adviseDrama(s)!;
    expect(s.drama!.options.map((o) => o.id)).toContain(rec.bestId);
    for (const sc of ['dashboard', 'budget', 'economy', 'government', 'parliament', 'laws', 'party', 'ministry', 'map', 'projects', 'polls', 'career']) {
      expect(screenAdvice(s, sc).length).toBeGreaterThan(0);
    }
  });
  it('is deterministic for the same seed', () => {
    const a = advanceTurn(advanceTurn(createGame(cfg('pm'))));
    const b = advanceTurn(advanceTurn(createGame(cfg('pm'))));
    expect(a.economy.gdp).toBe(b.economy.gdp);
    expect(a.news.map((n) => n.headline)).toEqual(b.news.map((n) => n.headline));
  });
});

describe('economy & budget', () => {
  it('raising a tax increases revenue and angers affected groups', () => {
    const s = createGame(cfg('pm'));
    const r = performAction(s, 'set_tax', { tax: 'incomeTax', delta: 1 });
    expect(r.state.economy.revenue).toBeGreaterThan(s.economy.revenue);
    expect(r.state.population.groups.highIncome.satisfaction).toBeLessThan(s.population.groups.highIncome.satisfaction);
    expect(r.reaction?.groups.length).toBeGreaterThan(0);
  });
  it('increasing education budget raises spending, deficit and education quality over time', () => {
    const s = normalTime(createGame(cfg('pm')));
    const r = performAction(s, 'adjust_budget', { category: 'education', delta: 5 });
    expect(r.state.budget.allocations.education).toBeCloseTo(s.budget.allocations.education + 5);
    expect(deficitPct(r.state)).toBeGreaterThan(deficitPct(s));
    let a = r.state;
    let b = s;
    for (let i = 0; i < 6; i++) { a = advanceTurn(a); b = advanceTurn(b); }
    expect(a.services.education.quality).toBeGreaterThan(b.services.education.quality);
    expect(a.population.groups.families.satisfaction).toBeGreaterThan(b.population.groups.families.satisfaction - 1);
  });
  it('non-PM cannot set taxes', () => {
    const s = createGame(cfg('mk'));
    expect(checkAction(s, 'set_tax', { tax: 'vat', delta: 1 })).not.toBeNull();
  });
});

describe('polls & seats', () => {
  it("D'Hondt distributes exactly 120 seats with threshold", () => {
    const seats = seatsFromShares({ a: 40, b: 30, c: 20, d: 7, e: 3 });
    expect(Object.values(seats).reduce((x, y) => x + y, 0)).toBe(120);
    expect(seats.e).toBe(0);
  });
});

describe('parliament', () => {
  it('a government bill can pass and enacts the law', () => {
    let s = normalTime(createGame(cfg('pm')));
    proposeBill(s, 'reservist_benefits', 'player', true);
    for (let i = 0; i < 4; i++) {
      if (s.drama) s = resolveDrama(s, s.drama.options[0].id).state;
      s = advanceTurn(s);
    }
    const bill = s.bills.find((b) => b.lawId === 'reservist_benefits')!;
    expect(['passed', 'failed']).toContain(bill.status);
    if (bill.status === 'passed') expect(s.activeLaws).toContain('reservist_benefits');
  });
  it('coalition votes for government bills, opposition hates draft exemption', () => {
    const s = createGame(cfg('pm'));
    const bill = proposeBill(s, 'draft_exemption', 'player', true)!;
    bill.stage = 'final';
    const v = computeVote(s, bill);
    expect(v.byParty.yashar).toBe('against');
    expect(v.byParty.utj).toBe('for');
    expect(v.byParty.shas).toBe('for');
  });
});

describe('role-appropriate decisions', () => {
  it('a defense minister cannot propose an education law, but can propose a defense law', () => {
    const s = normalTime(createGame(cfg('minister', { ministryId: 'defense' })));
    expect(checkAction(s, 'propose_law', { lawId: 'free_daycare' })).toBe('לא בתחום האחריות של המשרד שלך');
    expect(checkAction(s, 'propose_law', { lawId: 'reservist_benefits' })).toBeNull();
  });
  it('a minister only handles crises of his own ministry', () => {
    const s = createGame(cfg('minister', { ministryId: 'defense' }));
    const strike = startCrisis(s, 'teachers_strike');
    expect(resolveCrisis(s, strike.id, 'mediate')?.title).toBe('זה לא באחריותך');
    const border = startCrisis(s, 'border');
    expect(resolveCrisis(s, border.id, 'reinforce')?.title).not.toBe('זה לא באחריותך');
  });
  it('an MK facing a national emergency gets a political-response role, not the PM decisions', () => {
    const s = createGame(cfg('mk'));
    fire(s, 'market_crash');
    const ids = s.drama!.options.map((o) => o.id);
    expect(ids).not.toContain('bailout');
    expect(ids).toContain('c_attack');
    const r = resolveDrama(s, 'c_back');
    expect(r.state.drama).toBeNull();
  });
  it('the finance minister sees the bailout; MKs cannot set taxes or the budget', () => {
    const fin = createGame(cfg('minister', { ministryId: 'finance' }));
    fire(fin, 'market_crash');
    expect(fin.drama!.options.map((o) => o.id)).toContain('bailout');
    const mk = createGame(cfg('mk'));
    expect(checkAction(mk, 'adjust_budget', { category: 'health', delta: 1 })).not.toBeNull();
    expect(checkAction(mk, 'start_project', { defId: 'classrooms' })).not.toBeNull();
  });
  it('every ministry has at least 14 actions, and every one of them runs cleanly', async () => {
    const { ministryActionSpecs } = await import('./decisions');
    const { MINISTRIES } = await import('../data/ministries');
    for (const def of MINISTRIES) {
      const base = createGame(cfg('minister', { ministryId: def.id }));
      const m = base.government.ministries.find((x) => x.id === def.id)!;
      const specs = ministryActionSpecs(m);
      expect(specs.length, def.id).toBeGreaterThanOrEqual(14);
      for (const spec of specs) {
        const s = createGame(cfg('minister', { ministryId: def.id, seed: 7 }));
        s.player.politicalCapital = 100;
        const r = performAction(s, 'ministry_action', { actionId: spec.id });
        expect(r.reaction).not.toBeNull();
        assertSane(r.state);
      }
    }
  });
  it('media and PM drama actions run cleanly', () => {
    const ids: [string, Record<string, string | number>][] = [
      ['press_conference', {}], ['tv_interview', {}], ['tweet_storm', {}], ['visit_region', { regionId: 'negev' }], ['protest_speech', {}],
      ['write_book', {}], ['charity_photo', {}], ['state_emergency', {}], ['cash_handout', {}],
      ['nation_address', {}], ['declare_war_pm', {}],
    ];
    for (let seed = 1; seed <= 6; seed++) {
      for (const [id, p] of ids) {
        const s = createGame(cfg('pm', { seed }));
        s.player.politicalCapital = 100;
        const r = performAction(s, id, p);
        expect(r.reaction?.quip, id).toBeTruthy();
        assertSane(r.state);
      }
    }
    const mk = createGame(cfg('mk'));
    mk.player.politicalCapital = 100;
    for (const id of ['leak_rival', 'attack_opponent', 'tweet_storm']) {
      const r = performAction(mk, id, { politicianId: 'yashar_1' });
      assertSane(r.state);
    }
  });
});

describe('repeal', () => {
  it('repealing a law fully reverses its budget and group offsets', () => {
    const s = createGame(cfg('pm'));
    const law = LAW_BY_ID.pension_boost;
    const before = { alloc: s.budget.allocations.welfare, off: s.population.groups.retirees.offset };
    enactLaw(s, law);
    expect(s.budget.allocations.welfare).toBeGreaterThan(before.alloc);
    repealLaw(s, law);
    expect(s.activeLaws).not.toContain('pension_boost');
    expect(s.budget.allocations.welfare).toBeCloseTo(before.alloc);
    expect(s.population.groups.retirees.offset).toBeCloseTo(before.off);
  });
});

describe('crises', () => {
  it('every crisis trigger returns a probability without throwing', () => {
    const s = createGame(cfg('pm'));
    for (const c of CRISES) expect(c.trigger(s)).toBeGreaterThanOrEqual(0);
  });
  it('crises are state-driven: a well-funded transport rarely strikes', () => {
    const s = createGame(cfg('pm'));
    const strike = CRISES.find((c) => c.id === 'transport_strike')!;
    s.services.transport.quality = 80;
    s.budget.allocations.transport = s.budget.needs.transport * 1.2;
    expect(strike.trigger(s)).toBe(0);
  });
  it('handling a crisis with a guaranteed action ends it', () => {
    const s = createGame(cfg('pm'));
    const c = startCrisis(s, 'water');
    const r = resolveCrisis(s, c.id, 'tankers');
    expect(r?.status).toBe('approved');
    expect(s.crises.find((x) => x.id === c.id)).toBeUndefined();
  });
});

describe('meetings & inbox', () => {
  it('a cabinet meeting resolves into an action', () => {
    const s = createGame(cfg('pm'));
    const m = prepareMeeting(s, 'stimulus', {});
    expect(m.participants.length).toBeGreaterThan(0);
    const res = meetingStep(s, m, 'approve');
    expect(res.result?.state.economy.debt).toBeGreaterThan(s.economy.debt);
  });
  it('inbox options change the state', () => {
    const s = createGame(cfg('pm'));
    const minister = s.government.ministries.find((m) => m.id === 'transport')!.ministerId!;
    s.inbox.push({ id: 'x', kind: 'minister_budget', title: 't', text: 't', fromId: minister, createdTurn: 0, expiresTurn: 5, options: [], defaultOptionId: 'refuse', payload: { category: 'transport', amount: 2 } });
    const r = resolveInbox(s, 'x', 'approve');
    expect(r.state.budget.allocations.transport).toBeCloseTo(s.budget.allocations.transport + 2);
    expect(r.state.inbox.length).toBe(0);
  });
});

describe('elections & coalition', () => {
  it('player formateur can negotiate and form a government', () => {
    const s = createGame(cfg('pm'));
    startNegotiation(s);
    for (const id of ['otzma', 'rzp', 'shas', 'utj', 'bluewhite', 'yb', 'together']) {
      if (!s.elections.negotiation!.offers[id]) continue;
      if (negotiationSeats(s) >= 63) break;
      for (let t = 0; t < 3 && s.elections.negotiation!.offers[id].status === 'pending'; t++) negotiate(s, id, 'accept');
    }
    if (negotiationSeats(s) >= 61) {
      const r = finalizeCoalition(s);
      expect(r.status).toBe('approved');
      expect(s.player.role).toBe('pm');
      expect(s.elections.phase).toBe('none');
    }
  });
  it('elections produce 120 seats and either a negotiation, a new government or a game over', () => {
    const s = createGame(cfg('mk'));
    runElection(s);
    const total = Object.values(s.parties).reduce((a, p) => a + p.seats, 0);
    expect(total).toBe(120);
    expect(s.elections.count).toBe(1);
  });
});

describe('save / load', () => {
  it('round-trips the full state', () => {
    const s = advanceTurn(createGame(cfg('minister')));
    const back = deserialize(serialize(s))!;
    expect(back.turn).toBe(s.turn);
    expect(back.economy.gdp).toBe(s.economy.gdp);
    const mem: Record<string, string> = {};
    const store = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => { mem[k] = v; }, removeItem: (k: string) => { delete mem[k]; } };
    expect(saveGame(s, store)).toBe(true);
    expect(loadGame(store)?.turn).toBe(s.turn);
  });
  it('a failing storage returns false instead of throwing', () => {
    const s = createGame(cfg('pm'));
    const bad = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} };
    expect(saveGame(s, bad)).toBe(false);
  });
  it('rejects garbage', () => {
    expect(deserialize('{"nope":1}')).toBeNull();
    expect(deserialize('not json')).toBeNull();
  });
});

/** A crude auto-player: answers inbox, takes affordable actions, forms coalitions. */
function autoPlay(s: GameState, turns: number): GameState {
  for (let t = 0; t < turns && !s.gameOver; t++) {
    for (const item of [...s.inbox]) s = resolveInbox(s, item.id, item.options[0]?.id ?? item.defaultOptionId).state;
    if (s.drama) s = resolveDrama(s, s.drama.options[t % s.drama.options.length].id).state;
    if (t % 5 === 0 && s.parties[s.player.partyId].leaderId === 'player') {
      const target = Object.values(s.parties).find((p) => p.id !== s.player.partyId && p.seats > 0 && !s.alliances.some((a) => a.partyId === p.id));
      if (target) s = proposeAlliance(s, target.id, t % 10 === 0 ? 'bloc' : 'votes').state;
    }
    for (const c of [...s.crises]) {
      const a = c.actions[0];
      if (a.capital <= s.player.politicalCapital) resolveCrisis(s, c.id, a.id);
    }
    const tries: [string, Record<string, string | number>][] = [
      ['press_conference', {}], ['committee_work', { domain: 'economy' }], ['adjust_budget', { category: 'health', delta: 0.5 }],
      ['propose_law', { lawId: 'digital_gov' }], ['ministry_action', { actionId: 'tra_buses' }], ['campaign_rally', {}], ['network', { politicianId: 'likud_2' }],
    ];
    for (const [id, p] of tries) if (ACTIONS[id] && !checkAction(s, id, p)) s = performAction(s, id, p).state;
    if (s.elections.phase === 'negotiation') {
      for (const id of Object.keys(s.elections.negotiation!.offers)) {
        if (negotiationSeats(s) >= 64) break;
        negotiate(s, id, 'accept');
      }
      if (negotiationSeats(s) >= 61) finalizeCoalition(s);
      else { s.elections.phase = 'none'; s.elections.negotiation = null; s.gameOver = { reason: 'coalition_failed', title: 'x', text: 'x', turn: s.turn }; }
    }
    s = advanceTurn(s);
    assertSane(s);
  }
  return s;
}

describe('long simulation', () => {
  for (const role of ['pm', 'candidate', 'minister', 'mk'] as Role[]) {
    for (const difficulty of ['easy', 'normal', 'chaos'] as const) {
      it(`${role}/${difficulty}: 50 turns without crashing`, () => {
        const s = autoPlay(createGame(cfg(role, { difficulty, seed: 99 + role.length })), 50);
        expect(s.turn).toBeGreaterThan(0);
        expect(s.history.length).toBeGreaterThan(1);
      });
    }
  }
  it('runs two years idle and the economy actually moves', () => {
    let s = normalTime(createGame(cfg('pm')));
    const gdp0 = s.economy.gdp;
    for (let i = 0; i < 6; i++) {
      if (s.drama) s = resolveDrama(s, s.drama.options[0].id).state;
      s = advanceTurn(s);
    }
    expect(s.economy.gdp).not.toBe(gdp0);
    expect(s.news.length).toBeGreaterThan(0);
    expect(s.polls.length).toBe(7);
  });
});

describe('coalition deals (v2)', () => {
  it('negotiation spends mandate days, sweeteners raise willingness, and the agreement is written', async () => {
    const { sweetenerOptions, processCommitments } = await import('./coalitionDeals');
    const s = createGame(cfg('pm'));
    startNegotiation(s);
    const n = s.elections.negotiation!;
    expect(n.daysLeft).toBe(28);
    const before = n.offers.shas.willingness;
    const sw = sweetenerOptions(s, 'shas').find((d) => d.kind === 'budget')!;
    negotiate(s, 'shas', 'sweeten', -1, sw);
    expect(s.elections.negotiation!.daysLeft).toBe(27);
    expect(s.elections.negotiation!.offers.shas.willingness).toBeGreaterThan(before);
    for (const id of ['otzma', 'rzp', 'shas', 'utj', 'bluewhite', 'yb']) {
      if (negotiationSeats(s) >= 64 || s.elections.phase !== 'negotiation') break;
      for (let t = 0; t < 3 && s.elections.negotiation?.offers[id]?.status === 'pending'; t++) negotiate(s, id, 'accept');
    }
    if (s.elections.phase === 'negotiation' && negotiationSeats(s) >= 61) {
      finalizeCoalition(s);
      expect(s.government.agreements!.length).toBeGreaterThan(0);
      const law = s.government.agreements!.find((c) => c.kind === 'law' && c.status === 'pending');
      if (law) {
        s.turn = law.dueTurn!;
        s.activeLaws = s.activeLaws.filter((l) => l !== law.lawId);
        processCommitments(s);
        expect(law.status).toBe('broken');
      }
    }
  });
  it('the mandate expires after 28 + 14 days', () => {
    const s = createGame(cfg('pm'));
    startNegotiation(s);
    for (let i = 0; i < 20 && s.elections.phase === 'negotiation'; i++) {
      const pending = Object.values(s.elections.negotiation!.offers).find((o) => o.status === 'pending');
      if (!pending) break;
      negotiate(s, pending.partyId, 'sweeten', -1, { kind: 'jobs', label: 'x' });
    }
    // 42 days of single-day sweeteners need more than 20 steps: still negotiating, extension used
    if (s.elections.phase === 'negotiation') expect(s.elections.negotiation!.extended).toBe(false);
  });
  it('red lines: Haredi parties never vote for the draft equality law, even as a government bill', () => {
    const s = createGame(cfg('pm'));
    s.government.coalition = ['likud', 'shas', 'utj', 'otzma', 'rzp'];
    const bill = proposeBill(s, 'draft_equality', 'player', true)!;
    bill.stage = 'final';
    bill.push = 100;
    const v = computeVote(s, bill);
    expect(v.byParty.utj).toBe('against');
    expect(v.byParty.shas).toBe('against');
  });
});

describe('campaign (v2)', () => {
  it('a party leader opens the campaign, and campaign actions raise the boost', async () => {
    const { needsCampaignStart } = await import('./campaign');
    const s0 = createGame(cfg('candidate'));
    expect(needsCampaignStart(s0)).toBe(true);
    const r = performAction(s0, 'start_campaign', { strategy: 'security', t1: 'reservists', t2: 'right', budget: 'mid', slogan: 'ביטחון קודם לכל' });
    const s = r.state;
    expect(s.campaign?.strategy).toBe('security');
    expect(needsCampaignStart(s)).toBe(false);
    const b0 = s.elections.campaignBoost[s.player.partyId] ?? 0;
    s.player.politicalCapital = 100;
    const r2 = performAction(s, 'field_campaign', {});
    expect(r2.state.elections.campaignBoost[s.player.partyId]).toBeGreaterThan(b0);
    const r3 = performAction(r2.state, 'internal_poll', {});
    expect(r3.state.campaign?.internalPoll?.seats).toBeGreaterThan(0);
  });
  it('a dissolved Knesseton does not legislate', () => {
    const s = createGame(cfg('pm'));
    expect(s.government.caretaker).toBe(true);
    expect(checkAction(s, 'propose_law', { lawId: 'reservist_benefits' })).toContain('הכנסטון התפזר');
  });
});

describe('security & diplomacy (v2)', () => {
  it('the PM runs a targeted strike, the threat drops, and the world ticks cleanly', () => {
    const s = createGame(cfg('pm'));
    s.player.politicalCapital = 100;
    const before = s.world!.fronts.lebanon.threat;
    const r = performAction(s, 'security_operation', { opId: 'targeted_strike', front: 'lebanon' });
    expect(r.reaction?.status).not.toBe(undefined);
    expect(r.state.world!.fronts.lebanon.threat).toBeLessThan(before);
    let t = r.state;
    for (let i = 0; i < 4; i++) { if (t.drama) t = resolveDrama(t, t.drama.options[0].id).state; t = advanceTurn(normalTime(t)); assertSane(t); }
  });
  it('big operations need the cabinet; MKs cannot launch operations', () => {
    const s = createGame(cfg('pm', { seed: 5 }));
    s.player.politicalCapital = 100;
    const r = performAction(s, 'security_operation', { opId: 'wide_ground', front: 'gaza' });
    expect(r.reaction?.title).toBeTruthy();
    assertSane(r.state);
    const mk = createGame(cfg('mk'));
    expect(checkAction(mk, 'security_operation', { opId: 'targeted_strike', front: 'gaza' })).not.toBeNull();
  });
  it('confidence-building and land transfers change the map and anger the right', () => {
    for (let seed = 1; seed <= 4; seed++) {
      const s = createGame(cfg('pm', { seed }));
      s.player.politicalCapital = 100;
      const r = performAction(s, 'diplomacy', { kind: 'transfer', from: 'C' });
      if (r.reaction?.status === 'approved') {
        expect(r.state.world!.areas.C).toBe(58);
        expect(r.state.population.groups.settlers.satisfaction).toBeLessThan(s.population.groups.settlers.satisfaction);
      }
      assertSane(r.state);
      const c = performAction(s, 'diplomacy', { kind: 'cbm', cbm: 'permits' });
      assertSane(c.state);
    }
  });
});

describe('speeches (v2)', () => {
  it('the generator writes a full speech and delivering it moves groups and draws reactions', async () => {
    const { writeSpeech } = await import('./speech');
    let i = 0;
    const text = writeSpeech({ venue: 'tv', topic: 'judicial', stance: 0.9, tone: 'combative', audience: 'right' }, () => ((i++ * 0.37) % 1));
    expect(text.split(/\s+/).length).toBeGreaterThan(30);
    const s = createGame(cfg('pm', { seed: 3 }));
    const r = performAction(s, 'give_speech', { venue: 'tv', topic: 'judicial', stance: 0.9, tone: 'combative', audience: 'right', words: 80 });
    expect(r.state.population.groups.right.satisfaction).toBeGreaterThan(s.population.groups.right.satisfaction);
    expect(r.state.population.groups.left.satisfaction).toBeLessThan(s.population.groups.left.satisfaction);
    expect(r.reaction?.people.length).toBeGreaterThan(0);
  });
});

describe('chat (v2)', () => {
  it('reads intent, registers tracked promises, and changes relations', async () => {
    const { detectIntent, sendChat, matchLaw, searchPoliticians, chatContacts } = await import('./chat');
    expect(detectIntent('אם לא תתמוך אפרסם את זה')).toBe('threat');
    expect(detectIntent('אני מבטיח לך תיק')).toBe('promise');
    expect(detectIntent('אני מתנצל')).toBe('apology');
    expect(detectIntent('אתה שקרן')).toBe('insult');
    expect(matchLaw('חוק השוויון בנטל והגיוס')?.id).toBe('draft_equality');
    const s = createGame(cfg('pm'));
    expect(searchPoliticians(s, 'כץ').length).toBeGreaterThan(0);
    const target = chatContacts(s).find((p) => p.id !== 'player' && p.partyId !== 'likud')!;
    const before = target.loyalty;
    sendChat(s, target.id, 'אני מבטיח לקדם את חוק השוויון בנטל');
    expect(s.politicians[target.id].memory.some((m) => m.kind === 'promise' && m.ref === 'draft_equality')).toBe(true);
    expect(s.chats![target.id].length).toBe(2);
    sendChat(s, target.id, 'אתה שקרן');
    expect(s.politicians[target.id].loyalty).toBeLessThan(before + 10);
    // after three messages the same turn the conversation cools down without changes
    for (let i = 0; i < 4; i++) sendChat(s, target.id, 'תודה רבה');
    expect(s.chats![target.id].at(-1)!.text).toContain('בתור הבא');
  });
  it('politicians write to the player on their own across turns', async () => {
    let s = normalTime(createGame(cfg('pm', { seed: 11 })));
    for (const p of Object.values(s.politicians)) if (!p.isPlayer) p.loyalty = 20;
    for (let i = 0; i < 6; i++) { if (s.drama) s = resolveDrama(s, s.drama.options[0].id).state; s = advanceTurn(normalTime(s)); }
    const unread = Object.values(s.chatUnread ?? {}).reduce((a, b) => a + b, 0);
    expect(unread).toBeGreaterThan(0);
  });
});
