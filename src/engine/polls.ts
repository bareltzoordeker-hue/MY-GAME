import { GROUPS, SEATS, THRESHOLD, groupWeight } from '../data/world';
import { dayNumber } from './calendar';
import { gauss } from './rng';
import type { GameState, Party } from '../types/game';
import { clamp } from '../utils';

/** Raw (uncalibrated) support score for a party. */
export function rawScore(s: GameState, party: Party): number {
  const inGov = s.government.coalition.includes(party.id);
  let score = 0;
  for (const g of GROUPS) {
    const aff = (party.affinity[g.id] ?? 0) + 0.15;
    const sat = s.population.groups[g.id].satisfaction;
    const f = inGov ? 0.55 + (0.9 * sat) / 100 : 1.45 - (0.9 * sat) / 100;
    score += groupWeight(g.id) * aff * f;
  }
  const leader = s.politicians[party.leaderId];
  const leaderFactor = leader ? 0.8 + (0.4 * leader.popularity) / 100 : 0.9;
  const cohesion = 0.85 + party.cohesion / 670;
  const campaign = 1 + (s.elections.campaignBoost[party.id] ?? 0) / 100;
  // government fatigue: voters tire of whoever is in power (up to -12%)
  const years = Math.max(0, s.government.formedDay !== undefined ? (dayNumber(s.date) - s.government.formedDay) / 365 : (s.turn - s.government.formedTurn) / 3);
  const fatigue = inGov ? 1 - Math.min(0.12, 0.025 * years) : 1;
  return score * Math.exp(party.momentum / 50) * leaderFactor * cohesion * campaign * fatigue;
}

export function computeShares(s: GameState, noise = 0): Record<string, number> {
  const parties = Object.values(s.parties);
  const raw: Record<string, number> = {};
  let total = 0;
  for (const p of parties) {
    const v = Math.max(0.0001, rawScore(s, p) * p.calibration * (1 + (noise ? gauss(s) * noise : 0)));
    raw[p.id] = v;
    total += v;
  }
  const shares: Record<string, number> = {};
  for (const p of parties) shares[p.id] = (raw[p.id] / total) * 100;
  return shares;
}

/** D'Hondt with electoral threshold. */
export function seatsFromShares(shares: Record<string, number>): Record<string, number> {
  const passing = Object.entries(shares).filter(([, v]) => v >= THRESHOLD);
  const seats: Record<string, number> = Object.fromEntries(Object.keys(shares).map((k) => [k, 0]));
  if (passing.length === 0) return seats;
  for (let i = 0; i < SEATS; i++) {
    let best = passing[0][0];
    let bestQ = -1;
    for (const [id, v] of passing) {
      const q = v / (seats[id] + 1);
      if (q > bestQ) { bestQ = q; best = id; }
    }
    seats[best] += 1;
  }
  return seats;
}

export function playerApproval(s: GameState): number {
  return s.politicians[s.player.politicianId]?.popularity ?? 0;
}

export function simulatePolls(s: GameState): void {
  const vol = { easy: 0.02, normal: 0.03, hard: 0.04, chaos: 0.07 }[s.difficulty];
  const shares = computeShares(s, vol);
  const seats = seatsFromShares(shares);
  for (const p of Object.values(s.parties)) {
    p.pollShare = shares[p.id];
    p.momentum = clamp(p.momentum * 0.85, -40, 40);
  }
  s.polls.push({ turn: s.turn, shares, seats, govApproval: s.government.approval, playerApproval: playerApproval(s) });
  if (s.polls.length > 60) s.polls.shift();
}

export function latestSeats(s: GameState): Record<string, number> {
  return s.polls[s.polls.length - 1]?.seats ?? Object.fromEntries(Object.values(s.parties).map((p) => [p.id, p.seats]));
}

export function coalitionSeats(s: GameState): number {
  return s.government.coalition.reduce((a, id) => a + (s.parties[id]?.seats ?? 0), 0);
}
