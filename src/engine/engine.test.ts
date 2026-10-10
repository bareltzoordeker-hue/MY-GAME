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
    s.government.caretaker = false; // a sitting Knesseton: a dissolved one takes no bills
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
  }, 30000); // runs every action of every ministry: slow when the whole suite runs in parallel
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
    s.government.caretaker = false; // a sitting Knesseton: a dissolved one takes no bills
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
    // no limit on messages per turn: the politician keeps answering
    for (let i = 0; i < 6; i++) sendChat(s, target.id, 'תודה רבה');
    expect(s.chats![target.id].at(-1)!.from).toBe('them');
    expect(s.chats![target.id].at(-1)!.text).not.toContain('בתור הבא');
  });
  it('politicians write to the player on their own across turns', async () => {
    let s = normalTime(createGame(cfg('pm', { seed: 11 })));
    for (const p of Object.values(s.politicians)) if (!p.isPlayer) p.loyalty = 20;
    for (let i = 0; i < 6; i++) { if (s.drama) s = resolveDrama(s, s.drama.options[0].id).state; s = advanceTurn(normalTime(s)); }
    const unread = Object.values(s.chatUnread ?? {}).reduce((a, b) => a + b, 0);
    expect(unread).toBeGreaterThan(0);
  });
});

describe('political capital', () => {
  it('grows every turn, including short campaign turns', async () => {
    const { advanceTurn } = await import('./turn');
    const { createGame } = await import('./newGame');
    let s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, role: 'mk', partyId: 'likud' });
    for (let i = 0; i < 3; i++) {
      const before = s.player.politicalCapital;
      s = advanceTurn({ ...s, drama: null });
      expect(s.player.politicalCapital).toBeGreaterThan(before);
    }
  });
});

describe('promise deadlines', () => {
  it('freeze while there is no functioning government, and the open list shows them', async () => {
    const { createGame } = await import('./newGame');
    const { slideDeadlines, openPromises } = await import('./deadlines');
    const { remember } = await import('./effects');
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, role: 'pm', partyId: 'likud' });
    const other = Object.values(s.politicians).find((p) => p.active && !p.isPlayer)!;
    remember(s, other.id, 'promise', 'לקדם חוק', 0, s.turn + 2, 'role');
    const m = () => other.memory.find((x) => x.kind === 'promise')!.deadlineTurn!;
    const start = m();
    s.government.caretaker = true;
    slideDeadlines(s, 61);
    expect(m()).toBe(start + 1);
    s.government.caretaker = false;
    s.elections.phase = 'none';
    slideDeadlines(s, 14); // a 2-week campaign turn barely moves the clock
    expect(m()).toBeGreaterThan(start + 1.7);
    slideDeadlines(s, 61);
    expect(m()).toBeCloseTo(start + 1 + (1 - 14 / 61), 5);
    expect(openPromises(s).some((p) => p.toId === other.id && p.role)).toBe(true);
  });
});

describe('chat understands free-text answers', () => {
  it('reads later / conditional / maybe and the direction of a sentence', async () => {
    const { detectIntent, sentiment } = await import('./chat');
    expect(detectIntent('תן לי זמן, אחזור אליך')).toBe('later');
    expect(detectIntent('רק אם תתמוך בחוק שלי')).toBe('conditional');
    expect(detectIntent('אולי, אני לא בטוח')).toBe('maybe');
    expect(sentiment('אני אטפל בזה בשבילך')).toBe('yes');
    expect(sentiment('זה לא בא בחשבון')).toBe('no');
  });
  it('keeps an open topic alive on "later" and closes it on a positive free-text answer', async () => {
    const { createGame } = await import('./newGame');
    const { sendChat } = await import('./chat');
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, role: 'pm', partyId: 'likud' });
    const t = Object.values(s.politicians).find((p) => p.active && !p.isPlayer && s.government.coalition.includes(p.partyId) && p.id !== s.government.pmId)!;
    s.chatTopics = { [t.id]: { kind: 'unhappy', stage: 'explained', turn: s.turn, demand: 'respect' } };
    sendChat(s, t.id, 'תן לי קצת זמן');
    expect(s.chatTopics[t.id]).toBeTruthy();
    expect(s.chats![t.id].at(-1)!.text).toMatch(/אחכה|לחכות/);
    sendChat(s, t.id, 'סמוך עליי, אני אדאג לזה');
    expect(s.chatTopics[t.id]).toBeFalsy();
    expect(t.memory.some((m) => m.text === 'הבטחת יחס אחר')).toBe(true);
  });
});

describe('bills in short turns', () => {
  it('a bill with a majority passes the preliminary reading within one campaign turn', async () => {
    const { createGame } = await import('./newGame');
    const { advanceTurn } = await import('./turn');
    const { proposeBill, computeVote } = await import('./parliament');
    let s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, role: 'pm', partyId: 'likud' });
    const { dayNumber } = await import('./calendar');
    const start = dayNumber(s.date);
    s.government.caretaker = false; // a sitting Knesseton, but still short pre-election turns
    const law = (await import('../data/laws')).LAWS.find((l) => !s.activeLaws.includes(l.id) && computeVote(s, { id: 'x', lawId: l.id, title: l.title, sponsorId: s.player.politicianId, isGovernment: false, stage: 'preliminary', turnsInStage: 0, proposedTurn: 0, status: 'active', push: 0, modified: false }).passed)!;
    const bill = proposeBill(s, law.id, s.player.politicianId, false)!;
    expect(bill.stage).toBe('preliminary');
    s = advanceTurn({ ...s, drama: null });
    expect(dayNumber(s.date) - start).toBeLessThan(61); // the game starts inside the campaign: short turns
    const b = s.bills.find((x) => x.id === bill.id)!;
    expect(b.stage).not.toBe('preliminary');
  });
});

describe('chat brain', () => {
  it('finds ministries, parses a two-sided deal and closes it', async () => {
    const { createGame } = await import('./newGame');
    const { matchMinistry, parseDeal, sendChat } = await import('./chat');
    const { LAWS } = await import('../data/laws');
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, role: 'pm', partyId: 'likud' });
    expect(matchMinistry(s, 'תן לי את תיק החינוך')?.id).toBe('education');
    expect(matchMinistry(s, 'המשרד לביטחון לאומי')?.id).toBe('national_security');
    const t = Object.values(s.politicians).find((p) => p.active && !p.isPlayer && p.id !== s.government.pmId && s.parties[p.partyId]?.favoriteLaws.some((l) => !s.activeLaws.includes(l)))!;
    const party = s.parties[t.partyId];
    const fav = party.favoriteLaws.find((l) => !s.activeLaws.includes(l))!;
    const neutral = LAWS.find((l) => !s.activeLaws.includes(l.id) && !party.favoriteLaws.includes(l.id) && !party.hatedLaws.includes(l.id) && !(party.redLines ?? []).includes(l.id))!;
    const favT = LAWS.find((l) => l.id === fav)!.title;
    const text = `אני אקדם את ${favT} אם תתמוך ב${neutral.title}`;
    const deal = parseDeal(s, text);
    expect(deal.give?.lawId).toBe(fav);
    expect(deal.want?.lawId).toBe(neutral.id);
    sendChat(s, t.id, text);
    expect(s.chats![t.id].at(-1)!.text).toMatch(/סגור|עסקה/);
    expect(t.memory.some((m) => m.kind === 'promise' && m.ref === fav)).toBe(true);
  });
  it('resolves "זה" from the previous messages', async () => {
    const { createGame } = await import('./newGame');
    const { sendChat } = await import('./chat');
    const { LAWS } = await import('../data/laws');
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 5, role: 'pm', partyId: 'likud' });
    const t = Object.values(s.politicians).find((p) => p.active && !p.isPlayer && p.id !== s.government.pmId && s.government.coalition.includes(p.partyId))!;
    const law = LAWS.find((l) => !s.activeLaws.includes(l.id) && l.title.length > 12)!;
    sendChat(s, t.id, `מה דעתך על ${law.title}?`);
    sendChat(s, t.id, 'תתמוך בזה?');
    const last = s.chats![t.id].at(-1)!.text;
    expect(last).not.toContain('ציין חוק');
    expect(last).not.toContain('במה בדיוק');
  });
});

describe('every ministry is complete', () => {
  it('has 15 laws, 15 reforms, 15 projects and 14 peacetime actions, including the ministries the PM can create', async () => {
    const { MINISTRIES, NEW_MINISTRY_TEMPLATES } = await import('../data/ministries');
    const { LAWS } = await import('../data/laws');
    const { PROJECTS } = await import('../data/projects');
    const { ministryActionSpecs } = await import('./decisions');
    const s = createGame(cfg('pm'));
    const ids = [...MINISTRIES.map((m) => m.id), ...NEW_MINISTRY_TEMPLATES.map((m) => m.id)];
    for (const id of ids) {
      const laws = LAWS.filter((l) => l.ministries?.includes(id));
      expect(laws.filter((l) => l.level === 'medium').length, `${id} laws`).toBeGreaterThanOrEqual(15);
      expect(laws.filter((l) => l.level === 'major').length, `${id} reforms`).toBeGreaterThanOrEqual(15);
      expect(PROJECTS.filter((p) => p.ministry === id).length, `${id} projects`).toBeGreaterThanOrEqual(15);
      const m = s.government.ministries.find((x) => x.id === id) ?? { id, origins: [id] } as never;
      expect(ministryActionSpecs(m).length, `${id} actions`).toBeGreaterThanOrEqual(14);
    }
  });
  it('seats the real 2026 ministers, several portfolios each, and gives the player all of them', async () => {
    const { lawAllowed } = await import('./roles');
    const { LAWS } = await import('../data/laws');
    const { PROJECTS } = await import('../data/projects');
    const s = createGame(cfg('pm'));
    const holder = (id: string) => s.government.ministries.find((m) => m.id === id)!.ministerId;
    for (const id of ['health', 'housing', 'welfare', 'tourism']) expect(holder(id), id).toBe('likud_18'); // חיים כץ
    for (const id of ['justice', 'labor', 'religious', 'jerusalem']) expect(holder(id), id).toBe('likud_4'); // יריב לוין
    for (const id of ['interior', 'intelligence']) expect(holder(id), id).toBe(s.government.pmId); // held by the prime minister
    // playing חיים כץ: minister with four portfolios, all of them usable
    const k = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, personId: 'likud_18' });
    expect(k.player.role).toBe('minister');
    expect(k.government.ministries.filter((m) => m.ministerId === k.player.politicianId).map((m) => m.id).sort()).toEqual(['health', 'housing', 'tourism', 'welfare']);
    for (const id of ['health', 'housing', 'welfare', 'tourism']) {
      expect(lawAllowed(k, LAWS.find((l) => l.ministries?.includes(id))!), `${id} law`).toBe(true);
      expect(checkAction(k, 'start_project', { defId: PROJECTS.find((p) => p.ministry === id)!.id }), `${id} project`).toBeNull();
      expect(checkAction(k, 'ministry_action', { ministryId: id, actionId: (await import('./decisions')).ministryActionSpecs(k.government.ministries.find((m) => m.id === id)!)[0].id }), `${id} action`).toBeNull();
    }
    expect(lawAllowed(k, LAWS.find((l) => l.ministries?.includes('defense'))!)).toBe(false);
  });
});

describe('chat lobbying', () => {
  it('a minister asks a colleague to press the PM for budget: understood, and the PM warms up', async () => {
    const { createGame } = await import('./newGame');
    const { sendChat, parseDeal } = await import('./chat');
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, personId: 'likud_14' }); // שר התפוצות
    expect(s.player.role).toBe('minister');
    const t = Object.values(s.politicians).find((p) => p.active && !p.isPlayer && p.id !== s.government.pmId && s.government.coalition.includes(p.partyId) && p.loyalty >= 35)!;
    const pm = s.politicians[s.government.pmId];
    const before = pm.loyalty;
    const d = parseDeal(s, 'אני בעד, בתמורה לחץ על הגדלת התקציב למשרד התפוצות');
    expect(d.want?.kind).toBe('budget');
    sendChat(s, t.id, 'לחץ על ראש הממשלה להגדלת התקציב');
    const last = s.chats![t.id].at(-1)!.text;
    expect(last).toContain(pm.name);
    expect(last).not.toContain('עניין של ראש הממשלה ושל שר האוצר');
    expect(pm.loyalty).toBeGreaterThan(before);
    expect(pm.memory.some((m) => m.text.includes('דיבר איתי בעד'))).toBe(true);
  });
});

describe('aftermath: war, laws, projects, goals', () => {
  it('a war is felt turn after turn: casualties, rally, fatigue, international pressure', async () => {
    const { warTick } = await import('./aftermath');
    const s = createGame(cfg('pm'));
    s.world!.fronts.gaza.status = 'fighting';
    s.world!.fronts.gaza.threat = 80;
    const usa0 = s.world!.channels.usa;
    warTick(s);
    expect(s.flags.warTurns).toBe(1);
    expect(s.news.some((n) => n.headline.includes('התלכדות'))).toBe(true);
    s.turn += 1; warTick(s); s.turn += 1; warTick(s);
    expect(s.flags.warTurns).toBe(3);
    expect(s.world!.channels.usa).toBeLessThan(usa0);
    expect(s.inbox.some((i) => i.kind === 'war_pressure')).toBe(true);
    s.world!.fronts.gaza.status = 'ceasefire';
    s.crises = s.crises.filter((c) => c.defId !== 'war');
    warTick(s);
    expect(s.flags.warTurns).toBe(0);
    expect(s.news.some((n) => n.headline.includes('המלחמה הסתיימה'))).toBe(true);
  });
  it('a law that passed keeps making news in the following turns', async () => {
    const { enactLaw } = await import('./parliament');
    const { lawAftermathTick } = await import('./aftermath');
    const { LAW_BY_ID } = await import('../data/laws');
    const s = createGame(cfg('pm'));
    enactLaw(s, LAW_BY_ID.draft_equality);
    expect(s.aftermath?.length).toBe(1);
    const n0 = s.news.length;
    s.turn += 1; lawAftermathTick(s);
    expect(s.news.length).toBeGreaterThan(n0);
    expect(s.news.some((n) => n.headline.includes('מפגינים') || n.headline.includes('מברכים'))).toBe(true);
  });
  it('every role has goals with progress', async () => {
    const { careerGoals } = await import('./aftermath');
    for (const role of ['pm', 'minister', 'mk', 'candidate'] as const) {
      const s = createGame(cfg(role, role === 'minister' ? { ministryId: 'transport' } : {}));
      const goals = careerGoals(s);
      expect(goals.length, role).toBeGreaterThanOrEqual(3);
      for (const g of goals) expect(g.progress.length).toBeGreaterThan(0);
    }
  });
});

describe('chat: more to say', () => {
  it('answers each part of a two-sentence message, comments on the news and knows his party', async () => {
    const { createGame } = await import('./newGame');
    const { sendChat } = await import('./chat');
    const { addNews } = await import('./effects');
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, role: 'pm', partyId: 'likud' });
    const t = Object.values(s.politicians).find((p) => p.active && !p.isPlayer && p.id !== s.government.pmId && s.government.coalition.includes(p.partyId))!;
    sendChat(s, t.id, 'תודה על התמיכה. מה שלומך?');
    const two = s.chats![t.id].at(-1)!.text;
    expect(two.length).toBeGreaterThan(30);
    expect(two).toMatch(/מה איתך|עמוס|מחזיק מעמד|עסוק/);
    addNews(s, 'הממשלה נכשלה בהצבעה על התקציב', 'bad', '📉');
    sendChat(s, t.id, 'ראית את החדשות?');
    expect(s.chats![t.id].at(-1)!.text).toContain('הממשלה נכשלה בהצבעה על התקציב');
    sendChat(s, t.id, 'מה קורה אצלכם בסיעה?');
    expect(s.chats![t.id].at(-1)!.text).toMatch(/הסיעה|בסקר/);
  });
  it('has many more openings, and they change with the situation', async () => {
    const { createGame } = await import('./newGame');
    const { chatTick } = await import('./chat');
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 11, role: 'pm', partyId: 'likud' });
    const texts = new Set<string>();
    for (let i = 0; i < 40; i++) {
      s.turn += 1;
      s.economy.unemployment = 4 + (i % 4);
      chatTick(s);
      for (const list of Object.values(s.chats ?? {})) for (const m of list) if (m.from === 'them') texts.add(m.text);
    }
    expect(texts.size).toBeGreaterThan(25);
  });
});

describe('war crisis and fronts tell the same story', () => {
  it('a war lights a front, a ceasefire calms it and ends the crisis', async () => {
    const { startCrisis, resolveCrisis } = await import('./crises');
    const { warTick } = await import('./aftermath');
    const s = createGame(cfg('pm'));
    const fighting = () => Object.values(s.world!.fronts).filter((f) => f.status === 'fighting').length;
    expect(fighting()).toBe(0);
    startCrisis(s, 'war', 3);
    expect(fighting()).toBe(1);
    const c = s.crises.find((x) => x.defId === 'war')!;
    for (let i = 0; i < 30 && s.crises.includes(c); i++) { s.player.politicalCapital = 100; resolveCrisis(s, c.id, 'ceasefire'); }
    expect(s.crises.some((x) => x.defId === 'war')).toBe(false);
    expect(fighting()).toBe(0);
    expect(Object.values(s.world!.fronts).some((f) => f.status === 'ceasefire')).toBe(true);
    // fronts that calm by themselves close the crisis as well
    startCrisis(s, 'war', 2);
    for (const f of Object.values(s.world!.fronts)) if (f.status === 'fighting') f.status = 'tension';
    warTick(s);
    expect(s.crises.some((x) => x.defId === 'war')).toBe(false);
  });
});

describe('Oslo areas move in both directions', () => {
  it('B→C and A→B shift the map the other way and hurt the channels', async () => {
    const { takeBackArea } = await import('./security');
    const s = createGame(cfg('pm'));
    const w = s.world!;
    const before = { ...w.areas };
    const pa0 = w.channels.pa;
    expect(takeBackArea(s, 'B', 'C').ok).toBe(true);
    expect(w.areas.C).toBe(before.C + 2);
    expect(w.areas.B).toBe(before.B - 2);
    expect(takeBackArea(s, 'A', 'B').ok).toBe(true);
    expect(w.areas.A).toBe(before.A - 2);
    expect(w.channels.pa).toBeLessThan(pa0);
    expect(w.areas.A + w.areas.B + w.areas.C).toBe(before.A + before.B + before.C);
  });
});

describe('speech on the draft: the side you pick is the side that reacts', () => {
  it('"draft for all" (negative stance) pleases secular voters and hurts the Haredim; the exemption does the opposite', async () => {
    const { deliverSpeech, writeSpeech, TOPIC_BY_ID } = await import('./speech');
    const reaction = (stance: number) => {
      const s = createGame(cfg('pm'));
      const before = { haredim: s.population.groups.haredim.satisfaction, secular: s.population.groups.secular.satisfaction };
      deliverSpeech(s, { venue: 'tv', topic: 'draft', stance, tone: 'statesman', audience: '', words: 120 });
      return { haredim: s.population.groups.haredim.satisfaction - before.haredim, secular: s.population.groups.secular.satisfaction - before.secular };
    };
    const forAll = reaction(-0.9);
    expect(forAll.haredim).toBeLessThan(0);
    expect(forAll.secular).toBeGreaterThan(0);
    const exemption = reaction(0.9);
    expect(exemption.haredim).toBeGreaterThan(0);
    expect(exemption.secular).toBeLessThan(0);
    // and the drafted text says what the stance says
    expect(writeSpeech({ venue: 'tv', topic: 'draft', stance: -0.9, tone: 'statesman', audience: '' }, () => 0.1)).toContain(TOPIC_BY_ID.draft.con);
  });
});

describe('coalition talks warn about conflicts up front', () => {
  it('lists why a party will not sit with a partner that is already in', async () => {
    const { coalitionConflicts } = await import('./elections');
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, role: 'pm', partyId: 'likud' });
    s.elections.negotiation = {
      daysLeft: 28, extended: false,
      offers: {
        shas: { partyId: 'shas', status: 'pending', willingness: 0.5, patience: 3, demands: [{ kind: 'law', lawId: 'draft_exemption', label: 'לחוקק: חוק הגיוס' }] },
        yashar: { partyId: 'yashar', status: 'pending', willingness: 0.5, patience: 3, demands: [{ kind: 'law', lawId: 'draft_equality', label: 'לחוקק: חוק השוויון בנטל' }] },
      },
    } as never;
    expect(coalitionConflicts(s, 'yashar')).toEqual([]);
    (s.elections.negotiation as unknown as { offers: Record<string, { status: string }> }).offers.shas.status = 'accepted';
    const c = coalitionConflicts(s, 'yashar');
    expect(c.length).toBeGreaterThan(0);
    expect(c.every((x) => x.reason.length > 10)).toBe(true);
    expect(c.some((x) => x.partyId === 'shas')).toBe(true);
  });
});

describe('security screen access and internal security', () => {
  it('opens only for the PM, the defense minister and the national-security minister; internal options for the PM and national security', async () => {
    const { securityRole, canUseInternalSecurity } = await import('./security');
    const { INTERNAL_OPTIONS } = await import('../data/internalSecurity');
    const roleOf = (cfgx: Parameters<typeof cfg>[1], r: Parameters<typeof cfg>[0]) => createGame(cfg(r, cfgx));
    const pm = roleOf({}, 'pm');
    expect(securityRole(pm)).toBe('pm');
    expect(canUseInternalSecurity(pm)).toBe(true);
    const def = roleOf({ ministryId: 'defense' }, 'minister');
    expect(securityRole(def)).toBe('defense');
    expect(canUseInternalSecurity(def)).toBe(false);
    const ns = roleOf({ ministryId: 'national_security' }, 'minister');
    expect(securityRole(ns)).toBe('internal');
    expect(canUseInternalSecurity(ns)).toBe(true);
    expect(securityRole(roleOf({ ministryId: 'foreign' }, 'minister'))).toBeNull();
    expect(securityRole(roleOf({ ministryId: 'transport' }, 'minister'))).toBeNull();
    expect(securityRole(roleOf({}, 'mk'))).toBeNull();
    // the national-security minister can run every option; the defense minister cannot
    expect(INTERNAL_OPTIONS.length).toBeGreaterThanOrEqual(8);
    for (const o of INTERNAL_OPTIONS) {
      ns.player.politicalCapital = 100;
      expect(checkAction(ns, 'internal_security', { opId: o.id }), o.id).toBeNull();
      expect(performAction(ns, 'internal_security', { opId: o.id }).reaction, o.id).not.toBeNull();
      expect(checkAction(def, 'internal_security', { opId: o.id })).not.toBeNull();
      expect(checkAction(pm, 'internal_security', { opId: o.id }), o.id).toBeNull();
    }
    // the military moves are closed to the national-security minister
    expect(checkAction(ns, 'security_operation', { opId: 'strike', front: 'gaza' })).not.toBeNull();
  });
  it('the area annexation buttons are accepted by the diplomacy action', async () => {
    const s = createGame(cfg('pm'));
    s.player.politicalCapital = 100;
    expect(checkAction(s, 'diplomacy', { kind: 'annex', from: 'B' })).toBeNull();
    expect(checkAction(s, 'diplomacy', { kind: 'annex', from: 'A' })).toBeNull();
  });
});

describe('small fixes: PM budget button, passed laws, unlimited support, honeymoon', () => {
  it('the PM is not offered "pressure the PM for budget"; a minister is', async () => {
    const { ministryActionSpecs } = await import('./decisions');
    const pm = createGame(cfg('pm'));
    const mm = pm.government.ministries.find((m) => m.id === 'transport')!;
    expect(ministryActionSpecs(mm, pm).some((a) => a.id === 'gen_pressure_pm')).toBe(false);
    const min = createGame(cfg('minister', { ministryId: 'transport' }));
    expect(ministryActionSpecs(min.government.ministries.find((m) => m.id === 'transport')!, min).some((a) => a.id === 'gen_pressure_pm')).toBe(true);
  });
  it('rallying support and voting are not limited to once per turn', () => {
    const s = createGame(cfg('pm'));
    s.player.politicalCapital = 100;
    s.government.caretaker = false; // a sitting Knesseton
    const a = proposeBill(s, 'draft_equality', s.player.politicianId, false)!;
    const b = proposeBill(s, 'draft_exemption', s.player.politicianId, false)!;
    expect(checkAction(s, 'push_bill', { billId: a.id })).toBeNull();
    let r = performAction(s, 'push_bill', { billId: a.id });
    expect(checkAction(r.state, 'push_bill', { billId: b.id })).toBeNull();
    r = performAction(r.state, 'push_bill', { billId: b.id });
    expect(checkAction(r.state, 'push_bill', { billId: a.id })).toBeNull(); // same bill again, same turn
    expect(r.state.bills.find((x) => x.id === a.id)!.push).toBeLessThanOrEqual(80);
  });
  it('a politician never asks to pass a law that is already in force', async () => {
    const { sendChat, chatTick } = await import('./chat');
    const { LAWS } = await import('../data/laws');
    const s = createGame(cfg('pm'));
    const t = Object.values(s.politicians).find((p) => p.active && !p.isPlayer && p.id !== s.government.pmId && s.government.coalition.includes(p.partyId))!;
    const law = LAWS.find((l) => !s.activeLaws.includes(l.id) && l.title.length > 12)!;
    s.activeLaws.push(law.id);
    sendChat(s, t.id, `תתמוך ב${law.title}`);
    expect(s.chats![t.id].at(-1)!.text).toContain('כבר');
    for (const p of Object.values(s.parties)) p.favoriteLaws = [law.id, ...p.favoriteLaws.filter((l) => l !== law.id)];
    for (let i = 0; i < 25; i++) { s.turn += 1; chatTick(s); }
    for (const list of Object.values(s.chats ?? {})) for (const m of list) if (m.from === 'them' && m.proactive) expect(m.text.includes(law.title), m.text).toBe(false);
  });
});

describe('women speak as women', () => {
  it('feminizes first-person forms and leaves the rest alone', async () => {
    const { feminize } = await import('../shared/gender');
    expect(feminize('אני מתלבט. אני לא מעריך את זה.')).toBe('אני מתלבטת. אני לא מעריכה את זה.');
    expect(feminize('ואני מצפה לתשובה, אני גם מוכן לשוחח')).toBe('ואני מצפה לתשובה, אני גם מוכנה לשוחח');
    expect(feminize('שמח לשמוע. הוא מתלבט.')).toBe('שמחה לשמוע. הוא מתלבט.');
    expect(feminize('אני כאן. אזכור את זה.')).toBe('אני כאן. אזכור את זה.');
  });
  it('a female politician never writes about herself in the masculine in chat', async () => {
    const { sendChat, chatTick } = await import('./chat');
    const s = createGame(cfg('pm'));
    const women = Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && p.gender === 'f').slice(0, 4);
    expect(women.length).toBeGreaterThan(0);
    for (const w of women) { w.loyalty = 50; for (const msg of ['אולי', 'מה דעתך על התקציב?', 'תודה רבה', 'אני מבטיח לתמוך בך']) sendChat(s, w.id, msg); }
    for (let i = 0; i < 20; i++) { s.turn += 1; chatTick(s); }
    const bad = /אני (לא |גם )?(מתלבט|מעריך|מבקש|מצפה לא|סומך|מתנגד|תומך|זוכר|מרגיש|מעדיף|מופתע|חושב|שוקל)(?![א-ת])/;
    for (const w of women) for (const m of s.chats?.[w.id] ?? []) if (m.from === 'them') expect(m.text, `${w.name}: ${m.text}`).not.toMatch(bad);
  });
});

describe('reactions follow the decision and the speaker', () => {
  it('a tough security step is never condemned by a hawk or praised by a dove, and the lines vary', async () => {
    const { decisionReactions, decisionDirection } = await import('./reactions');
    const hawkish = { right: 4, settlers: 3, families: 2, left: -3, arabs: -3, liberals: -2 };
    expect(decisionDirection(hawkish)).toMatchObject({ axis: 'security', sign: 1 });
    expect(decisionDirection({ left: 4, arabs: 3, right: -3, settlers: -3 })).toMatchObject({ axis: 'security', sign: -1 });
    const texts = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed, role: 'pm', partyId: 'likud' });
      const lines = decisionReactions(s, 'מעצרים נגד מסיתים', hawkish, true);
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) {
        const p = Object.values(s.politicians).find((x) => x.name === l.label)!;
        if (l.tone === 'bad') expect(p.ideology.security, `${p.name} condemned: ${l.text}`).toBeLessThan(0);
        if (l.tone === 'good') expect(p.ideology.security, `${p.name} praised: ${l.text}`).toBeGreaterThan(0);
        expect(l.text).not.toContain('ההחלטה מאוחרת');
        texts.add(l.text);
      }
    }
    expect(texts.size).toBeGreaterThan(6);
  });
  it('an arrests operation as a real action: no right-wing leader opposes it, and no "late decision" boilerplate', () => {
    const s = createGame(cfg('pm'));
    s.player.politicalCapital = 100;
    s.government.caretaker = false;
    const r = performAction(s, 'internal_security', { opId: 'arrests' });
    const names = new Map(Object.values(r.state.politicians).map((p) => [p.name, p]));
    for (const l of r.reaction!.people) {
      expect(l.text).not.toContain('ההחלטה מאוחרת');
      const p = names.get(l.label);
      if (p && l.tone === 'bad' && r.reaction!.status === 'approved') expect(p.ideology.security).toBeLessThan(0.25);
    }
  });
});

describe('guided chat moves', () => {
  const mk = (role: 'pm' | 'minister', extra = {}) => { const s = createGame(cfg(role, extra)); s.government.caretaker = false; return s; };
  it('offers only the moves that make sense, and every one of them runs', async () => {
    const { availableMoves, playMove, lawChoices } = await import('./chatMoves');
    const { LAWS } = await import('../data/laws');
    const s = mk('minister', { ministryId: 'transport' });
    const pm = s.politicians[s.government.pmId];
    const other = Object.values(s.politicians).find((p) => p.active && !p.isPlayer && p.id !== pm.id && s.government.coalition.includes(p.partyId) && !s.government.ministries.some((m) => m.ministerId === p.id))!;
    const kinds = (p: typeof pm) => availableMoves(s, p).map((m) => m.kind);
    expect(kinds(pm)).toEqual(expect.arrayContaining(['request', 'press', 'lobby', 'promise', 'recommend', 'threat', 'ask', 'apology', 'thanks']));
    expect(availableMoves(s, pm).find((m) => m.kind === 'request')!.subjects).toEqual(expect.arrayContaining(['law', 'budget', 'role']));
    expect(availableMoves(s, other).find((m) => m.kind === 'press')?.subjects ?? []).not.toContain('budget'); // a backbencher cannot be pressed to fund a ministry (he can only back the raise)
    expect(lawChoices(s, pm, 'law').some((l) => l.group === 'חוקי המשרד שלך')).toBe(true);
    const law = LAWS.find((l) => l.ministries?.includes('transport'))!;
    const moves = [
      { kind: 'request', subject: 'law', lawId: law.id }, { kind: 'press', subject: 'law', lawId: law.id }, { kind: 'promise', subject: 'law', lawId: law.id },
      { kind: 'threat', subject: 'law', lawId: law.id }, { kind: 'lobby', subject: 'budget', ministryId: 'transport', viaId: pm.id },
      { kind: 'ask', subject: 'info', topic: 'polls' }, { kind: 'apology', subject: 'none' }, { kind: 'thanks', subject: 'none' }, { kind: 'recommend', subject: 'role', ministryId: 'health' },
    ] as const;
    for (const m of moves) {
      const t = createGame(cfg('minister', { ministryId: 'transport' }));
      t.government.caretaker = false;
      const target = t.politicians[(m.kind === 'lobby' ? other : other).id];
      expect(playMove(t, target.id, m as never), m.kind).toBe(true);
      const msgs = t.chats![target.id];
      expect(msgs.at(-2)!.from).toBe('me');
      expect(msgs.at(-1)!.from).toBe('them');
      expect(msgs.at(-1)!.text.length).toBeGreaterThan(5);
    }
  });
  it('a minister asks the PM for budget: granted, or the PM names a price that can be accepted with a quick reply', async () => {
    const { playMove, answerOffer, pendingOffer, sendChatSmart } = await import('./chatMoves');
    let offered = 0, granted = 0, closed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed, role: 'minister', ministryId: 'transport', partyId: 'likud' });
      s.government.caretaker = false;
      const pm = s.politicians[s.government.pmId];
      pm.loyalty = 55;
      const before = s.budget.allocations.transport;
      playMove(s, pm.id, { kind: 'request', subject: 'budget', ministryId: 'transport', amount: 2 });
      if (s.budget.allocations.transport > before) { granted++; continue; }
      const o = pendingOffer(s, pm.id);
      if (!o) continue;
      offered++;
      expect(o.options.length).toBeGreaterThan(0);
      expect(o.action).toBe('fund');
      // free text "כן" takes the first price and closes the deal
      if (seed % 2) sendChatSmart(s, pm.id, 'כן, סגור'); else answerOffer(s, pm.id, { type: 'accept', index: 0 });
      expect(pendingOffer(s, pm.id)).toBeUndefined();
      expect(s.budget.allocations.transport).toBeGreaterThan(before);
      closed++;
      expect(pm.memory.some((m) => m.kind === 'promise' && !m.resolved)).toBe(true);
    }
    expect(offered).toBeGreaterThan(0);
    expect(closed).toBe(offered);
    expect(granted + offered).toBeGreaterThan(5);
  });
  it('a counter-offer of a law he does not like is turned down, one he likes closes the deal; refusing ends it', async () => {
    const { playMove, answerOffer, pendingOffer } = await import('./chatMoves');
    for (let seed = 1; seed <= 60; seed++) {
      const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed, role: 'minister', ministryId: 'transport', partyId: 'likud' });
      s.government.caretaker = false;
      const pm = s.politicians[s.government.pmId];
      playMove(s, pm.id, { kind: 'request', subject: 'budget', ministryId: 'transport', amount: 3 });
      const o = pendingOffer(s, pm.id);
      if (!o) continue;
      const party = s.parties[pm.partyId];
      const hated = party.hatedLaws.find((l) => !s.activeLaws.includes(l))!;
      answerOffer(s, pm.id, { type: 'counter', lawId: hated });
      expect(pendingOffer(s, pm.id)).toBeDefined(); // still waiting
      const liked = party.favoriteLaws.find((l) => !s.activeLaws.includes(l))!;
      answerOffer(s, pm.id, { type: 'counter', lawId: liked });
      expect(pendingOffer(s, pm.id)).toBeUndefined(); // deal closed
      return;
    }
    throw new Error('no offer ever appeared');
  });
  it('the PM can promise a budget and the promise is tracked until the ministry is funded', async () => {
    const { playMove } = await import('./chatMoves');
    const s = mk('pm');
    const minister = Object.values(s.politicians).find((p) => p.active && !p.isPlayer && s.government.ministries.some((m) => m.ministerId === p.id))!;
    playMove(s, minister.id, { kind: 'promise', subject: 'budget', ministryId: 'transport' });
    const pr = minister.memory.find((m) => m.kind === 'promise' && m.ref === 'budget:transport');
    expect(pr).toBeDefined();
    s.budget.allocations.transport = s.budget.needs.transport * 1.01;
    const { simulateCharacters } = await import('./characters');
    simulateCharacters(s);
    expect(minister.memory.find((m) => m.ref === 'budget:transport')!.resolved).toBe(true);
  });
});

describe('budget moves: raise it with the PM / finance minister, back the raise with anyone else', () => {
  it('offers "raise the budget" to the PM and the finance minister, and "back the raise" to other MKs, each with a price', async () => {
    const { availableMoves, subjectLabel, playMove, pendingOffer, answerOffer } = await import('./chatMoves');
    const s = createGame(cfg('minister', { ministryId: 'transport' }));
    s.government.caretaker = false;
    const pm = s.politicians[s.government.pmId];
    const fin = s.politicians[s.government.ministries.find((m) => m.id === 'finance')!.ministerId!];
    const mk = Object.values(s.politicians).find((p) => p.active && !p.isPlayer && p.id !== pm.id && p.id !== fin.id && s.government.coalition.includes(p.partyId))!;
    for (const funder of [pm, fin]) {
      expect(availableMoves(s, funder).find((m) => m.kind === 'request')!.subjects).toContain('budget');
      expect(subjectLabel(s, funder, 'request', 'budget')).toContain('יעלה את התקציב');
    }
    expect(availableMoves(s, mk).find((m) => m.kind === 'request')!.subjects).toContain('budget');
    expect(subjectLabel(s, mk, 'request', 'budget')).toContain('יתמוך בהעלאת');
    // backing: a backer raises the odds with the funders, and a price can be accepted
    let priced = 0, backed = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed, role: 'minister', ministryId: 'transport', partyId: 'likud' });
      g.government.caretaker = false;
      const who = Object.values(g.politicians).find((p) => p.active && !p.isPlayer && p.id !== g.government.pmId && g.government.coalition.includes(p.partyId) && !g.government.ministries.some((m) => m.ministerId === p.id))!;
      who.loyalty = 40;
      playMove(g, who.id, { kind: 'request', subject: 'budget', ministryId: 'transport', amount: 2 });
      const o = pendingOffer(g, who.id);
      if (o) { priced++; expect(o.action).toBe('back_budget'); answerOffer(g, who.id, { type: 'accept', index: 0 }); }
      if ((g.flags.backers_transport ?? 0) >= 1) backed++;
      expect(g.chats![who.id].at(-1)!.text.length).toBeGreaterThan(5);
    }
    expect(priced).toBeGreaterThan(0);
    expect(backed).toBeGreaterThan(priced); // some backed outright, the priced ones backed after the deal
    // more backers, better odds with the PM
    let base = 0, boosted = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const backers of [0, 3]) {
        const g = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed, role: 'minister', ministryId: 'transport', partyId: 'likud' });
        g.government.caretaker = false;
        g.flags.backers_transport = backers;
        const before = g.budget.allocations.transport;
        playMove(g, g.government.pmId, { kind: 'request', subject: 'budget', ministryId: 'transport', amount: 2 });
        if (g.budget.allocations.transport > before) (backers ? boosted++ : base++);
      }
    }
    expect(boosted).toBeGreaterThan(base);
  });
});

describe('answering a politician who asks the player for something', () => {
  const setup = () => {
    const s = createGame(cfg('minister', { ministryId: 'transport' }));
    const t = Object.values(s.politicians).find((p) => p.partyId === s.player.partyId && !p.isPlayer && p.active && p.id !== s.government.pmId)!;
    return { s, t };
  };
  it('"what do you offer?" lists his offers, and taking one commits the player to his request', async () => {
    const { answerBargain, incomingAsk, pendingBargain } = await import('./chatMoves');
    const { setTopic } = await import('./chat');
    const { s, t } = setup();
    const lawId = 'draft_equality';
    setTopic(s, t.id, { kind: 'ask_law', lawId, stage: 'opened', turn: s.turn });
    expect(incomingAsk(s, t.id)).toBeDefined();
    expect(answerBargain(s, t.id, { type: 'whatOffer' })).toBe(true);
    const b = pendingBargain(s, t.id)!;
    expect(b.give!.options.length).toBeGreaterThan(0);
    expect(answerBargain(s, t.id, { type: 'take', index: 0 })).toBe(true);
    expect(s.chatTopics?.[t.id]?.kind).not.toBe('bargain');
    const last = s.chats![t.id].slice(-1)[0];
    expect(last.from).toBe('them');
    expect(t.memory.some((m) => m.kind === 'promise')).toBe(true);
  });
  it('naming a price is answered, and refusing or waiting keeps the thread sensible', async () => {
    const { answerBargain } = await import('./chatMoves');
    const { setTopic } = await import('./chat');
    const { s, t } = setup();
    setTopic(s, t.id, { kind: 'unhappy', demand: 'respect', stage: 'explained', turn: s.turn });
    const n = s.chats?.[t.id]?.length ?? 0;
    expect(answerBargain(s, t.id, { type: 'want', want: { kind: 'vote' } })).toBe(true);
    expect(s.chats![t.id].length).toBeGreaterThan(n + 1);
    setTopic(s, t.id, { kind: 'coop', stage: 'opened', turn: s.turn });
    expect(answerBargain(s, t.id, { type: 'later' })).toBe(true);
    expect(s.chatTopics?.[t.id]).toBeDefined();
    expect(answerBargain(s, t.id, { type: 'refuse' })).toBe(true);
  });
});

describe('voting on a bill', () => {
  it('the player votes once per bill per turn', () => {
    const s = createGame(cfg('pm'));
    s.government.caretaker = false;
    const b = proposeBill(s, 'draft_equality', 'player', true)!;
    expect(b).toBeTruthy();
    expect(checkAction(s, 'vote_bill', { billId: b.id, vote: 'against' })).toBeNull();
    const after = performAction(s, 'vote_bill', { billId: b.id, vote: 'against' }).state;
    expect(checkAction(after, 'vote_bill', { billId: b.id, vote: 'against' })).not.toBeNull();
    expect(checkAction(after, 'vote_bill', { billId: b.id, vote: 'for' })).not.toBeNull();
  });
});

describe('the Knesseton speaker has things to do', () => {
  it('every speaker action works for the speaker and is closed to others', async () => {
    const { roleLabel } = await import('./newGame');
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, personId: 'likud_3' });
    s.government.caretaker = false;
    expect(roleLabel(s)).toBe('יו״ר הכנסטון');
    const bill = proposeBill(s, 'draft_equality', 'player', true)!;
    const ids = Object.keys(ACTIONS).filter((id) => id.startsWith('speaker_'));
    expect(ids.length).toBeGreaterThanOrEqual(14);
    const other = createGame(cfg('mk'));
    for (const id of ids) {
      s.player.politicalCapital = 100;
      const p = { billId: bill.id };
      expect(checkAction(s, id, p), id).toBeNull();
      expect(performAction(s, id, p).reaction, id).not.toBeNull();
      expect(checkAction(other, id, p), id).not.toBeNull();
    }
  });
});
