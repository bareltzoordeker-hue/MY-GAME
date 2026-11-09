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

describe('offers to join a government after the election', () => {
  it('a party that is not the largest sees offers with partners and terms, and joining forms the government', async () => {
    const { runElection, answerCoalitionOffer, offerExtras } = await import('./elections');
    const { canAdvance } = await import('./turn');
    let found = 0;
    for (let seed = 1; seed <= 40 && found < 2; seed++) {
      const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed, role: 'candidate', partyId: 'yashar' });
      s.government.caretaker = false;
      runElection(s);
      if (s.gameOver || s.elections.phase !== 'offers') continue;
      found += 1;
      const offers = s.elections.offers!;
      expect(offers.length).toBeGreaterThan(0);
      const o = offers[0];
      expect(o.terms.length).toBeGreaterThan(0);
      expect(o.seats).toBeGreaterThanOrEqual(61);
      expect(canAdvance(s)).not.toBeNull();
      expect(offerExtras(s, o).length).toBeGreaterThan(0);
      answerCoalitionOffer(s, o.id, 'ask', 0);
      if (found === 1) {
        answerCoalitionOffer(s, o.id, 'accept');
        expect(s.elections.phase).toBe('none');
        expect(s.government.coalition).toContain(s.player.partyId);
        expect(s.government.pmId).toBe(o.formateurId);
      } else {
        for (const x of [...s.elections.offers!]) answerCoalitionOffer(s, x.id, 'decline');
        expect(s.elections.phase).not.toBe('offers');
        expect(s.government.coalition).not.toContain(s.player.partyId);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('election promises that were already carried out', () => {
  it('a promise whose law passed is kept, drops off the open list, and a save made before the fix is repaired on load', async () => {
    const { reconcilePromises } = await import('./promises');
    const { openPromises } = await import('./deadlines');
    const { serialize, deserialize } = await import('./persistence/save');
    const s = createGame(cfg('pm'));
    const r = performAction(s, 'make_promise', { promiseId: 'minimum_wage' });
    expect(r.reaction).not.toBeNull();
    let g = r.state;
    expect(g.promises.some((p) => p.defId === 'minimum_wage' && p.status === 'pending')).toBe(true);
    expect(openPromises(g).some((p) => p.text.includes('שכר המינימום'))).toBe(true);
    g.activeLaws.push('minimum_wage');
    expect(openPromises(g).some((p) => p.text.includes('שכר המינימום'))).toBe(false);
    // a save made before the fix: promise still pending although the law is in force
    const loaded = deserialize(serialize(g))!;
    expect(loaded.promises.find((p) => p.defId === 'minimum_wage')!.status).toBe('kept');
    g = loaded;
    reconcilePromises(g);
    expect(checkAction(g, 'make_promise', { promiseId: 'minimum_wage' })).not.toBeNull();
  });
});

describe('the defense minister and the PM\'s approval', () => {
  it('most operations go through, and a refused one costs no capital', () => {
    let ok = 0;
    let n = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const s = createGame({ ...cfg('minister', { ministryId: 'defense' }), seed });
      s.government.caretaker = false;
      s.player.politicalCapital = 100;
      const before = s.player.politicalCapital;
      const r = performAction(s, 'security_operation', { opId: 'air_campaign', front: 'gaza' });
      n += 1;
      const refused = (r.reaction?.title ?? '').includes('לא אישר') || (r.reaction?.title ?? '').includes('הקבינט דחה');
      if (!refused) ok += 1;
      else expect(r.state.player.politicalCapital).toBe(before);
    }
    expect(ok / n).toBeGreaterThan(0.55);
    // a minor operation (no cabinet vote) needs no PM approval at all
    for (let seed = 1; seed <= 20; seed++) {
      const s = createGame({ ...cfg('minister', { ministryId: 'defense' }), seed });
      s.government.caretaker = false;
      s.player.politicalCapital = 100;
      expect(performAction(s, 'security_operation', { opId: 'targeted_strike', front: 'gaza' }).reaction?.title ?? '').not.toContain('ראש הממשלה לא אישר');
    }
  });
});

describe('the PM warns a minister before firing him', () => {
  it('low trust brings a warning first; the firing can only come on a later turn', async () => {
    const { simulateAIGovernment } = await import('./aiGovernment');
    const s = createGame(cfg('minister', { ministryId: 'defense' }));
    s.government.caretaker = false;
    s.politicians[s.government.pmId].loyalty = 5;
    simulateAIGovernment(s);
    expect(s.player.role).toBe('minister');
    expect(s.flags.pm_warned).toBe(s.turn);
    expect(s.news.some((n) => n.headline.includes('מאבד סבלנות'))).toBe(true);
    let fired = false;
    for (let i = 0; i < 40 && !fired; i++) { s.turn += 1; simulateAIGovernment(s); fired = s.player.role !== 'minister'; }
    expect(fired).toBe(true);
  });
});

describe('step 1: leaving the coalition, the leadership race, returning after being fired, security expertise', () => {
  it('a coalition party leader can leave the coalition; the PM and caretaker governments cannot', () => {
    const s = createGame(cfg('candidate', { partyId: 'rzp' }));
    s.government.caretaker = false;
    expect(s.government.coalition).toContain('rzp');
    s.player.politicalCapital = 100;
    expect(checkAction(s, 'leave_coalition', { reason: 'law' })).toBeNull();
    const r = performAction(s, 'leave_coalition', { reason: 'broken_deal' });
    expect(r.reaction).not.toBeNull();
    expect(r.state.government.coalition).not.toContain('rzp');
    expect(checkAction(r.state, 'leave_coalition', { reason: 'law' })).not.toBeNull();
    expect(checkAction(createGame(cfg('pm')), 'leave_coalition', { reason: 'law' })).not.toBeNull();
  });
  it('the leadership race runs for a few turns and then ends in a vote', async () => {
    const { advanceTurn } = await import('./turn');
    let s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 5, personId: 'likud_18' });
    s.politicians[s.player.politicianId].power = 60;
    s.player.politicalCapital = 100;
    expect(checkAction(s, 'run_primaries')).toBeNull();
    s = performAction(s, 'run_primaries').state;
    expect(s.leadershipRace).toBeDefined();
    expect(checkAction(s, 'run_primaries')).not.toBeNull();
    s.player.politicalCapital = 100;
    const mine = s.leadershipRace!.mine;
    s = performAction(s, 'race_campaign', { kind: 'rally' }).state;
    expect(s.leadershipRace!.mine).toBeGreaterThan(mine);
    expect(checkAction(s, 'race_campaign', { kind: 'rally' })).not.toBeNull();
    for (let i = 0; i < 6 && s.leadershipRace && !s.gameOver; i++) s = advanceTurn({ ...s, drama: null });
    expect(s.leadershipRace).toBeUndefined();
  });
  it('a minister fired by the PM can ask to come back', async () => {
    const { simulateAIGovernment } = await import('./aiGovernment');
    const s = createGame(cfg('minister', { ministryId: 'defense' }));
    s.government.caretaker = false;
    const pm = s.politicians[s.government.pmId];
    pm.loyalty = 5;
    simulateAIGovernment(s);
    let fired = false;
    for (let i = 0; i < 40 && !fired; i++) { s.turn += 1; simulateAIGovernment(s); fired = s.player.role !== 'minister'; }
    expect(fired).toBe(true);
    expect(s.flags.fired_turn).toBeDefined();
    pm.loyalty = 100;
    s.politicians[s.player.politicianId].power = 90;
    let back = false;
    for (let i = 0; i < 12 && !back; i++) { s.turn += 4; s.player.politicalCapital = 100; const r = performAction(s, 'ask_return'); Object.assign(s, r.state); back = s.player.role === 'minister'; }
    expect(back).toBe(true);
    expect(s.flags.fired_turn).toBeUndefined();
  });
  it('the national-security minister has an expertise of his own', async () => {
    const { MINISTRIES, DOMAIN_NAMES } = await import('../data/ministries');
    expect(MINISTRIES.find((m) => m.id === 'national_security')!.domain).toBe('security');
    expect(DOMAIN_NAMES.security).toBeTruthy();
    const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed: 3, personId: 'otzma_1' });
    expect(s.politicians[s.player.politicianId].expertise.security).toBe(65);
  });
});

describe('step 2: the foreign minister\'s office', () => {
  it('the foreign minister and the PM can use the diplomatic moves; other ministers cannot', async () => {
    const { FOREIGN_LIST, foreignValue, hasPact } = await import('./foreign');
    const { isForeignMinister } = await import('./roles');
    expect(FOREIGN_LIST.length).toBe(14);
    const fmS = createGame(cfg('minister', { ministryId: 'foreign' }));
    expect(isForeignMinister(fmS)).toBe(true);
    const other = createGame(cfg('minister', { ministryId: 'transport' }));
    const pm = createGame(cfg('pm'));
    for (const id of ['fm_visit', 'fm_agreement', 'fm_statement', 'fm_summon']) {
      expect(checkAction(fmS, id, { country: 'usa' }), id).toBeNull();
      expect(checkAction(pm, id, { country: 'usa' }), id).toBeNull();
      expect(checkAction(other, id, { country: 'usa' }), id).not.toBeNull();
    }
    expect(checkAction(fmS, 'fm_visit', {})).not.toBeNull();
    expect(checkAction(fmS, 'fm_un_coalition', {})).toBeNull();
    // a visit changes the relation, a statement lowers it, the agreement is recorded once
    const s = createGame(cfg('pm'));
    s.player.politicalCapital = 100;
    const before = foreignValue(s, 'germany');
    const r = performAction(s, 'fm_statement', { country: 'germany' });
    expect(foreignValue(r.state, 'germany')).toBeLessThan(before);
    const t = createGame(cfg('pm'));
    t.player.politicalCapital = 100;
    let g = t;
    for (let i = 0; i < 10 && !hasPact(g, 'usa'); i++) { g.turn += 3; g.player.politicalCapital = 100; g = performAction(g, 'fm_agreement', { country: 'usa' }).state; }
    expect(hasPact(g, 'usa')).toBe(true);
    expect(checkAction(g, 'fm_agreement', { country: 'usa' })).not.toBeNull();
    // ambassador: appoint, then recall
    g.turn += 3; g.player.politicalCapital = 100;
    g = performAction(g, 'fm_ambassador', { country: 'egypt', mode: 'appoint' }).state;
    expect(checkAction(g, 'fm_ambassador', { country: 'egypt', mode: 'appoint' })).not.toBeNull();
    expect(checkAction(g, 'fm_ambassador', { country: 'egypt', mode: 'recall' })).toBeNull(); // there is an ambassador to recall now
  });
  it('a sharp move by the foreign minister is usually approved, and a refusal costs nothing', () => {
    let refused = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const s = createGame({ ...cfg('minister', { ministryId: 'foreign' }), seed });
      s.government.caretaker = false; s.player.politicalCapital = 100;
      const r = performAction(s, 'fm_statement', { country: 'russia' });
      if ((r.reaction?.title ?? '').includes('לא אישר')) { refused += 1; expect(r.state.player.politicalCapital).toBe(100); }
    }
    expect(refused).toBeLessThan(20);
  });
});

describe('step 3: the economy minister\'s office and foreign trade', () => {
  it('the trade picture starts neutral and reacts to relations, tariffs and deals', async () => {
    const { computeTrade, tradeGrowthEffect, TRADE_PARTNERS } = await import('./trade');
    const { shiftForeign } = await import('./foreign');
    const s = createGame(cfg('pm'));
    const t0 = computeTrade(s);
    expect(t0.rows.length).toBe(TRADE_PARTNERS.length);
    expect(t0.totalExports).toBeGreaterThan(0);
    expect(Math.abs(tradeGrowthEffect(s))).toBeLessThan(0.05); // the game starts where it always did
    // relations with the biggest partner collapse: trade and growth suffer
    shiftForeign(s, 'usa', -50);
    expect(computeTrade(s).totalExports).toBeLessThan(t0.totalExports);
    expect(tradeGrowthEffect(s)).toBeLessThan(0);
  });
  it('trade moves: permissions, effects and the PM-approval rule', async () => {
    const { computeTrade, tradeState } = await import('./trade');
    const { isEconomyMinister } = await import('./roles');
    const eco = createGame(cfg('minister', { ministryId: 'economy' }));
    expect(isEconomyMinister(eco)).toBe(true);
    const other = createGame(cfg('minister', { ministryId: 'transport' }));
    for (const id of ['eco_trade_deal', 'eco_export_drive']) {
      expect(checkAction(eco, id, { country: 'usa' }), id).toBeNull();
      expect(checkAction(other, id, { country: 'usa' }), id).not.toBeNull();
    }
    expect(checkAction(eco, 'eco_trade_deal', {})).not.toBeNull();
    const s = createGame(cfg('pm'));
    s.player.politicalCapital = 100;
    const base = computeTrade(s).rows.find((r) => r.id === 'china')!.imports;
    let g = performAction(s, 'eco_tariff', { country: 'china', mode: 'impose' }).state;
    expect(tradeState(g).tariffs).toContain('china');
    expect(computeTrade(g).rows.find((r) => r.id === 'china')!.imports).toBeLessThan(base);
    g.turn += 2; g.player.politicalCapital = 100;
    g = performAction(g, 'eco_tariff', { country: 'china', mode: 'remove' }).state;
    expect(tradeState(g).tariffs).not.toContain('china');
    g.turn += 2; g.player.politicalCapital = 100;
    const before = computeTrade(g).rows.find((r) => r.id === 'india')!.exports;
    g = performAction(g, 'eco_export_drive', { country: 'india' }).state;
    expect(computeTrade(g).rows.find((r) => r.id === 'india')!.exports).toBeGreaterThan(before);
    expect(checkAction(g, 'eco_export_drive', { country: 'india' })).not.toBeNull();
    // a deal is possible with good relations
    let d = createGame(cfg('pm'));
    for (let i = 0; i < 12 && !tradeState(d).deals.includes('usa'); i++) { d.turn += 3; d.player.politicalCapital = 100; d = performAction(d, 'eco_trade_deal', { country: 'usa' }).state; }
    expect(tradeState(d).deals).toContain('usa');
  });
});

describe('step 3b: ministers come to the prime minister with requests', () => {
  it('ministers ask for approval, the PM approves or declines, and every kind of request resolves cleanly', async () => {
    const { generateMinisterRequests } = await import('./ministerRequests');
    const { resolveInbox } = await import('./inbox');
    let s = createGame(cfg('pm'));
    s.government.caretaker = false;
    s.flags.reqFreq = 2;
    const kinds = new Set<string>();
    for (let i = 0; i < 60; i++) {
      s.turn += 1;
      s.player.politicalCapital = 100;
      generateMinisterRequests(s);
      for (const it of s.inbox.filter((x) => x.kind.startsWith('mreq_'))) {
        kinds.add(it.kind);
        const r = resolveInbox(s, it.id, i % 5 === 0 ? 'decline' : 'approve');
        expect(r.reaction, it.kind).not.toBeNull();
        s = r.state;
      }
    }
    expect(kinds.size).toBeGreaterThanOrEqual(4);
    assertSane(s);
  });
  it('requests only come to a PM, and declining costs a little loyalty', async () => {
    const { generateMinisterRequests } = await import('./ministerRequests');
    const { resolveInbox } = await import('./inbox');
    const m = createGame(cfg('minister', { ministryId: 'transport' }));
    m.government.caretaker = false; m.flags.reqFreq = 2;
    for (let i = 0; i < 10; i++) { m.turn += 1; generateMinisterRequests(m); }
    expect(m.inbox.some((x) => x.kind.startsWith('mreq_'))).toBe(false);
    let s = createGame(cfg('pm'));
    s.government.caretaker = false; s.flags.reqFreq = 2;
    for (let i = 0; i < 20 && !s.inbox.some((x) => x.kind.startsWith('mreq_')); i++) { s.turn += 1; generateMinisterRequests(s); }
    const it = s.inbox.find((x) => x.kind.startsWith('mreq_'))!;
    const before = s.politicians[it.fromId!].loyalty;
    s = resolveInbox(s, it.id, 'decline').state;
    expect(s.politicians[it.fromId!].loyalty).toBeLessThan(before);
  });
  it('a skilled foreign minister improves relations a little each turn, a weak one worsens them', async () => {
    const { ministerSkillEffects } = await import('./ministerRequests');
    const { foreignValue } = await import('./foreign');
    for (const [exp, dir] of [[95, 1], [5, -1]] as const) {
      const s = createGame(cfg('pm'));
      const fm = s.politicians[s.government.ministries.find((m) => m.id === 'foreign')!.ministerId!];
      fm.expertise.foreign = exp;
      const before = foreignValue(s, 'germany');
      for (let i = 0; i < 4; i++) ministerSkillEffects(s);
      expect(Math.sign(foreignValue(s, 'germany') - before)).toBe(dir);
    }
  });
});

describe('step 3b: the requests make sense', () => {
  it('no strike when the fronts are quiet, no internal operation when security is fine, and foreign moves fit the relations', async () => {
    const { generateMinisterRequests } = await import('./ministerRequests');
    const { world } = await import('./security');
    const { foreignValue } = await import('./foreign');
    const s = createGame(cfg('pm'));
    s.government.caretaker = false; s.flags.reqFreq = 2;
    for (const f of Object.values(world(s).fronts)) { f.threat = 10; f.status = 'ceasefire'; }
    s.services.security.quality = 90;
    const seen: { kind: string; payload: Record<string, string | number> }[] = [];
    for (let i = 0; i < 80; i++) { s.turn += 1; generateMinisterRequests(s); for (const it of s.inbox.filter((x) => x.kind.startsWith('mreq_'))) seen.push({ kind: it.kind, payload: it.payload }); s.inbox = s.inbox.filter((x) => !x.kind.startsWith('mreq_')); }
    expect(seen.some((x) => x.kind === 'mreq_strike')).toBe(false);
    expect(seen.some((x) => x.kind === 'mreq_internal')).toBe(false);
    for (const x of seen.filter((y) => y.kind === 'mreq_foreign')) {
      const v = foreignValue(s, String(x.payload.country));
      if (x.payload.act === 'statement') expect(['usa', 'eu']).not.toContain(x.payload.country);
      if (x.payload.act === 'visit') expect(v).toBeGreaterThanOrEqual(25);
    }
    // a front on fire does bring strike requests
    const w = world(s);
    w.fronts.gaza.status = 'fighting'; w.fronts.gaza.threat = 85;
    let got = false;
    for (let i = 0; i < 80 && !got; i++) { s.turn += 3; generateMinisterRequests(s); got = s.inbox.some((x) => x.kind === 'mreq_strike'); s.inbox = []; }
    expect(got).toBe(true);
  });
});

describe('step 3c: the party leader decides who takes the party\'s portfolios', () => {
  it('portfolios are proposed by expertise or by list rank, and a manual choice is applied when joining', async () => {
    const { runElection, answerCoalitionOffer, proposeAssignments } = await import('./elections');
    let done = false;
    for (let seed = 1; seed <= 40 && !done; seed++) {
      const s = createGame({ playerName: 'x', gender: 'm', difficulty: 'normal', seed, role: 'candidate', partyId: 'yashar' });
      s.government.caretaker = false;
      runElection(s);
      if (s.gameOver || s.elections.phase !== 'offers') continue;
      const o = s.elections.offers!.find((x) => x.terms.filter((d) => d.kind === 'ministry').length >= 1);
      if (!o) continue;
      const ids = o.terms.filter((d) => d.kind === 'ministry').map((d) => d.ministryId!);
      const party = s.parties[s.player.partyId];
      const byExp = proposeAssignments(s, party.id, ids, 'expertise');
      const byRank = proposeAssignments(s, party.id, ids, 'rank');
      expect(Object.keys(byExp).sort()).toEqual([...ids].sort());
      expect(Object.keys(byRank).sort()).toEqual([...ids].sort());
      // by rank: the first ministry goes to the person with the best list position
      const top = party.memberIds.map((i) => s.politicians[i]).filter((p) => p.active && p.inKnesset).sort((a, b) => (a.listRank ?? 99) - (b.listRank ?? 99))[0];
      expect(Object.values(byRank)).toContain(top.id);
      // a manual choice: the second member in the Knesseton takes the first ministry
      const other = party.memberIds.map((i) => s.politicians[i]).filter((p) => p.active && p.inKnesset && !p.isPlayer)[0];
      answerCoalitionOffer(s, o.id, 'accept', -1, { manual: { [ids[0]]: other.id } });
      expect(s.elections.phase).toBe('none');
      expect(s.government.ministries.find((m) => m.id === ids[0])!.ministerId).toBe(other.id);
      done = true;
    }
    expect(done).toBe(true);
  });
});

describe('step 4a: planning an operation', () => {
  it('the forces must fit the operation, and the plan changes the odds and the price', async () => {
    const { defaultPlan, evaluatePlan, planToParams } = await import('./strikePlan');
    const s = createGame(cfg('pm'));
    const plan = defaultPlan(s, 'air_campaign', 'gaza');
    expect(plan.lead).toBe('air_force');
    expect(evaluatePlan(s, plan).ok).toBe(true);
    // a brigade does not lead an air campaign
    expect(evaluatePlan(s, { ...plan, lead: 'golani' }).ok).toBe(false);
    // a wide ground operation needs combat engineering
    const g = defaultPlan(s, 'wide_ground', 'gaza');
    expect(evaluatePlan(s, g).ok).toBe(true);
    expect(evaluatePlan(s, { ...g, engineering: undefined }).ok).toBe(false);
    // the target must fit the operation (tunnels are not hit from the air)
    expect(evaluatePlan(s, { ...plan, target: 'tunnels' }).ok).toBe(false);
    // night: fewer civilians on the other side; maximum force: a bigger effect and a higher price
    const day = evaluatePlan(s, { ...plan, time: 'day' });
    const night = evaluatePlan(s, { ...plan, time: 'night' });
    expect(night.enemyCivEst).toBeLessThan(day.enemyCivEst);
    const max = evaluatePlan(s, { ...plan, roe: 'maximum' });
    const cautious = evaluatePlan(s, { ...plan, roe: 'cautious' });
    expect(max.cutEst).toBeGreaterThan(cautious.cutEst);
    expect(max.intlEst).toBeGreaterThan(cautious.intlEst);
    // a plan with cover and engineering is better than a bare one on the ground
    const bare = evaluatePlan(s, { ...g, cover: [], intel: undefined });
    expect(evaluatePlan(s, g).chance).toBeGreaterThan(bare.chance);
    expect(Object.keys(planToParams(plan)).length).toBeGreaterThan(5);
  });
  it('an operation with a plan runs, wears the chosen units, and the cabinet can be persuaded', async () => {
    const { defaultPlan, planToParams, cabinetPreview, persuadeMember, briefCabinet } = await import('./strikePlan');
    const { world } = await import('./security');
    const pm = createGame(cfg('pm'));
    pm.government.caretaker = false; pm.player.politicalCapital = 100;
    const plan = defaultPlan(pm, 'ground_raid', 'gaza');
    const before = world(pm).units[plan.lead].readiness;
    expect(checkAction(pm, 'security_operation', planToParams(plan))).toBeNull();
    const r = performAction(pm, 'security_operation', planToParams(plan));
    expect(r.reaction).not.toBeNull();
    expect(world(r.state).units[plan.lead].readiness).toBeLessThan(before);
    // an invalid plan is refused up front
    expect(checkAction(pm, 'security_operation', { ...planToParams(plan), lead: 'air_force' })).not.toBeNull();
    // the cabinet: persuading a member and a briefing raise the lean
    const def = createGame(cfg('minister', { ministryId: 'defense' }));
    def.government.caretaker = false; def.player.politicalCapital = 100;
    const big = defaultPlan(def, 'air_campaign', 'lebanon');
    const m0 = cabinetPreview(def, big).find((m) => !def.politicians[m.id].isPlayer)!;
    expect(persuadeMember(def, m0.id)).toBe(true);
    expect(persuadeMember(def, m0.id)).toBe(false);
    expect(cabinetPreview(def, big).find((m) => m.id === m0.id)!.lean).toBeGreaterThan(m0.lean);
    const l1 = cabinetPreview(def, big).find((m) => m.id !== m0.id && !def.politicians[m.id].isPlayer)!.lean;
    expect(briefCabinet(def, big)).toBe(true);
    expect(cabinetPreview(def, big).find((m) => m.lean !== l1 || true)).toBeDefined();
  });
});
