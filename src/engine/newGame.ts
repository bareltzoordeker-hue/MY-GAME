import { MINISTRIES } from '../data/ministries';
import {
  AMBITIONS, PARTY_QUIRKS, FIRST_F, FIRST_M, HAIR_COLORS, HAREDI_FIRST, HAREDI_LAST, LAST, LEADERS, PARTIES, PARTY_SIZE, QUIRKS, SKINS, SUITS,
} from '../data/parties';
import { CATEGORIES, DIFFICULTIES, GROUPS, REGIONS, SERVICES } from '../data/world';
import { chance, pick, rand, randInt, randRange } from './rng';
import type {
  BudgetCategory, CaricatureSpec, Difficulty, Domain, GameState, GroupId, Party, Politician, PopulationGroup, RegionId, Role, Service, ServiceId,
} from '../types/game';
import { clamp, sum } from '../utils';
import { refreshFiscals } from './economy';
import { computeApproval, groupTargetRaw } from './population';
import { computeShares } from './polls';
import { serviceDrivers, updateMetrics } from './services';
import { pushHistory } from './history';

export interface NewGameConfig {
  playerName: string;
  gender: 'm' | 'f';
  role: Role;
  partyId: string;
  ministryId?: string;
  difficulty: Difficulty;
  seed?: number;
  partyName?: string;
  partyLogo?: string;
  look?: Partial<CaricatureSpec>;
}

const ALL_DOMAINS: Domain[] = ['economy', 'finance', 'defense', 'education', 'health', 'transport', 'law', 'foreign', 'infrastructure', 'management', 'welfare', 'energy', 'agriculture', 'interior', 'media', 'housing', 'science', 'culture'];

export function randomCaricature(s: GameState, gender: 'm' | 'f', partyId: string): CaricatureSpec {
  const haredi = partyId === 'kugel';
  const religious = partyId === 'givaa';
  const hairOpts: CaricatureSpec['hair'][] = gender === 'f' ? ['long', 'bun', 'curly', 'long'] : ['bald', 'comb', 'curly', 'spiky', 'grey', 'comb'];
  return {
    skin: pick(s, SKINS),
    hair: haredi && gender === 'm' ? 'hat' : religious && gender === 'm' && chance(s, 0.7) ? 'kippah' : pick(s, hairOpts),
    hairColor: pick(s, HAIR_COLORS),
    glasses: chance(s, 0.35),
    beard: gender === 'f' ? 'none' : haredi ? 'long' : religious ? pick(s, ['full', 'stubble'] as const) : pick(s, ['none', 'none', 'stubble', 'full'] as const),
    nose: rand(s),
    mouth: pick(s, ['smile', 'smirk', 'open', 'frown'] as const),
    suit: pick(s, SUITS),
    brows: pick(s, ['flat', 'angry', 'worried'] as const),
    ears: rand(s),
  };
}

function genName(s: GameState, gender: 'm' | 'f', partyId: string): string {
  if (partyId === 'kugel' && gender === 'm') return `${pick(s, HAREDI_FIRST)} ${pick(s, HAREDI_LAST)}`;
  return `${pick(s, gender === 'm' ? FIRST_M : FIRST_F)} ${pick(s, LAST)}`;
}

function makePolitician(s: GameState, id: string, party: Party, opts: Partial<Politician> & { domain?: Domain }): Politician {
  const gender = opts.gender ?? (chance(s, partyId(party) === 'kugel' ? 0 : 0.35) ? 'f' : 'm');
  const mainDomain = opts.domain ?? pick(s, ALL_DOMAINS);
  const expertise: Partial<Record<Domain, number>> = { [mainDomain]: randInt(s, 50, 92) };
  for (let i = 0; i < 2; i++) expertise[pick(s, ALL_DOMAINS)] ??= randInt(s, 30, 70);
  const noise = () => randRange(s, -0.2, 0.2);
  return {
    id,
    name: opts.name ?? genName(s, gender, party.id),
    gender,
    partyId: party.id,
    ministryId: null,
    committee: null,
    mainDomain,
    expertise,
    power: opts.power ?? randInt(s, 15, 50),
    loyalty: 50,
    popularity: opts.popularity ?? randInt(s, 15, 50),
    experience: randInt(s, 1, 20),
    personality: opts.personality ?? { ego: rand(s), ambition: rand(s), honesty: rand(s), aggression: rand(s) },
    ideology: {
      economic: clamp(party.ideology.economic + noise(), -1, 1),
      security: clamp(party.ideology.security + noise(), -1, 1),
      religion: clamp(party.ideology.religion + noise(), -1, 1),
    },
    memory: [],
    relationships: {},
    caricature: { ...randomCaricature(s, gender, party.id), ...(opts.caricature ?? {}) },
    quirk: opts.quirk ?? (PARTY_QUIRKS[party.id] && chance(s, 0.55) ? pick(s, PARTY_QUIRKS[party.id]) : pick(s, QUIRKS)),
    cooldownUntil: 0,
    isPlayer: false,
    active: true,
    ambitionTarget: opts.ambitionTarget ?? pick(s, AMBITIONS),
  };
}
const partyId = (p: Party) => p.id;

const INITIAL_QUALITY: Record<ServiceId, number> = {
  health: 52, education: 50, transport: 45, housing: 40, security: 64, welfare: 50, infrastructure: 50, energy: 58, govServices: 47,
};

export function createGame(cfg: NewGameConfig): GameState {
  const seed = cfg.seed ?? Math.floor(Math.random() * 2 ** 31);
  const diff = DIFFICULTIES[cfg.difficulty];

  const allocations = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.initial])) as Record<BudgetCategory, number>;
  const needs = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.initial * diff.needFactor])) as Record<BudgetCategory, number>;

  const s: GameState = {
    version: 1,
    seed,
    rngState: seed,
    turn: 0,
    date: { year: 2027, month: 3 },
    difficulty: cfg.difficulty,
    player: { name: cfg.playerName, role: cfg.role, politicianId: 'player', partyId: cfg.partyId, politicalCapital: 50, reputation: 45, actionCooldowns: {}, listRank: 1 },
    parties: {},
    politicians: {},
    government: { pmId: '', coalition: [], ministries: [], stability: { easy: 70, normal: 60, hard: 50, chaos: 42 }[cfg.difficulty], approval: 45, formedTurn: 0, lowMajorityTurns: 0, lowApprovalTurns: 0 },
    bills: [],
    activeLaws: [],
    economy: {
      gdp: 2000, growth: 3 + diff.economyBias * 0.5, unemployment: 4.3, inflation: 2.8, interestRate: 4.25, effectiveDebtRate: 2.9,
      debt: diff.startDebt, revenue: 0, spending: 0, deficit: 0, avgIncome: 12800,
      taxes: { incomeTax: 20, vat: 17, corporateTax: 23 }, creditRating: 'AA',
      shocks: { growth: 0, inflation: 0, unemployment: 0 }, structural: { growth: 0, inflation: 0, unemployment: 0 }, otherRevenue: 0,
    },
    budget: { allocations, needs, debtInterest: 0, projectSpending: 0, fiscalYear: 2027, passed: true, deadlineTurn: 0 },
    services: {} as Record<ServiceId, Service>,
    population: {
      total: 10.2, growthRate: 1.9, ages: { kids: 0.32, young: 0.22, adults: 0.34, seniors: 0.12 },
      groups: {} as Record<GroupId, PopulationGroup>,
      regions: Object.fromEntries(REGIONS.map((r) => [r.id, { id: r.id, populationShare: r.share, unemployment: 4, income: 12000, satisfaction: 50, investment: 40, infrastructure: r.infra, services: 50 }])) as GameState['population']['regions'],
    },
    projects: [],
    crises: [],
    polls: [],
    news: [],
    promises: [],
    inbox: [],
    history: [],
    career: {
      startTurn: 0, turnsInRole: { pm: 0, candidate: 0, minister: 0, mk: 0 }, governmentsFormed: 0, lawsPassed: 0, billsProposed: 0,
      moneyInvested: 0, electionsWon: 0, electionsLost: 0, achievements: [], failures: [], memorable: [], roleHistory: [], decisions: 0,
    },
    elections: { scheduledTurn: 18, phase: 'none', negotiation: null, last: null, campaignBoost: {}, count: 0 },
    turnLog: [],
    eventLog: [],
    briefing: null,
    flags: {},
    gameOver: null,
    nextId: 100,
    drama: null,
    alliances: [],
  };

  // ---------------- parties & politicians ----------------
  for (const def of PARTIES) {
    s.parties[def.id] = {
      id: def.id, name: def.name, shortName: def.shortName, logo: def.logo, color: def.color, ideology: { ...def.ideology },
      description: def.description, slogan: def.slogan, seats: def.seats, pollShare: (def.seats / 120) * 100, leaderId: '', memberIds: [],
      power: def.seats * 2, momentum: 0, calibration: 1, affinity: { ...def.affinity }, preferredMinistries: def.preferredMinistries,
      demands: [], favoriteLaws: def.favoriteLaws, hatedLaws: def.hatedLaws, funds: def.seats * 1.5, isPlayerParty: false, cohesion: 70,
    };
    if (def.coalition) s.government.coalition.push(def.id);
  }
  let pid = 0;
  for (const L of LEADERS) {
    const party = s.parties[L.partyId];
    const id = `pol_${++pid}`;
    s.politicians[id] = makePolitician(s, id, party, {
      name: L.name, gender: L.gender, domain: L.domain, quirk: L.quirk, personality: L.personality, ambitionTarget: L.ambition,
      power: clamp(45 + party.seats * 1.4), popularity: randInt(s, 40, 62), caricature: L.caricature as CaricatureSpec,
    });
    s.politicians[id].experience = randInt(s, 10, 30);
    party.leaderId = id;
    party.memberIds.push(id);
    for (let i = 0; i < (PARTY_SIZE[party.id] ?? 3); i++) {
      const mid = `pol_${++pid}`;
      s.politicians[mid] = makePolitician(s, mid, party, {});
      party.memberIds.push(mid);
    }
  }
  s.government.pmId = s.parties.kise.leaderId;

  // ---------------- ministries ----------------
  for (const def of MINISTRIES) {
    s.government.ministries.push({
      id: def.id, name: def.name, icon: def.icon, domain: def.domain, services: [...def.services], categories: [...def.categories],
      ministerId: null, efficiency: randInt(s, 42, 58), bureaucracy: randInt(s, 40, 65), deep: def.deep, satire: def.satire, agreementPartyId: def.initialParty,
    });
  }
  for (const m of s.government.ministries) {
    const party = s.parties[m.agreementPartyId!];
    const cands = party.memberIds.map((id) => s.politicians[id]).filter((p) => !p.ministryId && p.id !== s.government.pmId);
    cands.sort((a, b) => (b.expertise[m.domain] ?? 20) + b.power * 0.3 - ((a.expertise[m.domain] ?? 20) + a.power * 0.3));
    if (cands[0]) {
      cands[0].ministryId = m.id;
      m.ministerId = cands[0].id;
      cands[0].power = clamp(cands[0].power + 15);
    }
  }

  // ---------------- player ----------------
  setupPlayer(s, cfg);

  // ---------------- loyalty baseline ----------------
  const me = s.politicians.player;
  for (const p of Object.values(s.politicians)) {
    if (p.isPlayer) continue;
    const same = p.partyId === me.partyId;
    const coal = s.government.coalition.includes(p.partyId) === s.government.coalition.includes(me.partyId);
    p.loyalty = clamp((same ? 60 : coal ? 47 : 28) + randInt(s, -10, 10) - (p.personality.ego - 0.5) * 10);
    p.relationships[s.government.pmId] = randInt(s, -10, 40) + (s.parties[p.partyId] && s.government.coalition.includes(p.partyId) ? 25 : -20);
  }

  // ---------------- services & groups ----------------
  for (const def of SERVICES) {
    s.services[def.id] = { id: def.id, quality: INITIAL_QUALITY[def.id], satisfaction: INITIAL_QUALITY[def.id] - 3, trend: 0, bonus: 0, metrics: { railKm: 1350, roadKm: 19000, beds: 0, classrooms: 0, renewables: 14, units: 0 }, issues: [] };
  }
  refreshFiscals(s);
  for (const def of SERVICES) {
    const raw = sum(serviceDrivers(s, def.id).map((d) => d.value));
    s.services[def.id].bonus = clamp(INITIAL_QUALITY[def.id] - raw, -30, 30);
    updateMetrics(s, def.id);
  }
  s.services.energy.metrics.renewables = 14;
  for (const g of GROUPS) {
    s.population.groups[g.id] = { id: g.id, satisfaction: g.base, structural: g.base, mood: 0, offset: 0, lastDelta: 0 };
  }
  // calibrate permanent offsets so groups start at their base
  for (const g of GROUPS) s.population.groups[g.id].offset = g.base - groupTargetRaw(s, g.id);
  s.government.approval = computeApproval(s);

  // calibrate parties so first poll ≈ starting seats
  s.government.formedTurn = 0; // calibrate without fatigue; the clock starts now
  const raw = computeShares(s, 0);
  for (const p of Object.values(s.parties)) {
    const target = (p.seats / 120) * 100;
    p.calibration = target / Math.max(0.01, raw[p.id]);
  }
  const shares = computeShares(s, 0);
  const seats = Object.fromEntries(Object.values(s.parties).map((p) => [p.id, p.seats]));
  s.polls.push({ turn: 0, shares, seats, govApproval: s.government.approval, playerApproval: me.popularity });
  for (const p of Object.values(s.parties)) p.pollShare = shares[p.id];

  for (const r of REGIONS) {
    const st = s.population.regions[r.id as RegionId];
    st.unemployment = s.economy.unemployment * r.unempFactor;
    st.income = Math.round(s.economy.avgIncome * r.incomeFactor);
    st.services = 50;
    st.satisfaction = s.government.approval;
  }

  s.career.roleHistory.push({ turn: 0, role: cfg.role, label: roleLabel(s) });
  pushHistory(s);
  s.briefing = {
    turn: 0,
    lines: [
      { icon: '🪑', text: `ברוך הבא ל${'צבריה'}. ${roleLabel(s)} — בהצלחה. תצטרך אותה.`, tone: 'neutral' },
      { icon: '🗳️', text: `הבחירות הבאות בעוד ${s.elections.scheduledTurn * 2} חודשים.`, tone: 'neutral' },
      { icon: '🧠', text: 'היועץ שלך מחכה בצד. הוא לא מחליט — אתה כן.', tone: 'neutral' },
    ],
    changes: [],
  };
  return s;
}

function setupPlayer(s: GameState, cfg: NewGameConfig): void {
  const party = s.parties[cfg.partyId];
  party.isPlayerParty = true;
  if (cfg.partyName) {
    party.name = cfg.partyName;
    party.shortName = cfg.partyName.length > 14 ? cfg.partyName.slice(0, 14) : cfg.partyName;
  }
  if (cfg.partyLogo) party.logo = cfg.partyLogo;

  const base: Record<Role, { power: number; pop: number; cap: number; rep: number; elections: number }> = {
    pm: { power: 85, pop: 46, cap: 60, rep: 50, elections: 18 },
    candidate: { power: 65, pop: 44, cap: 50, rep: 45, elections: 12 },
    minister: { power: 50, pop: 34, cap: 40, rep: 48, elections: 15 },
    mk: { power: 20, pop: 15, cap: 25, rep: 30, elections: 15 },
  };
  const b = base[cfg.role];
  const me = makePolitician(s, 'player', party, {
    name: cfg.playerName, gender: cfg.gender, domain: 'management', quirk: 'הדמות שלך. ההיסטוריה עוד לא החליטה מה היא.',
    personality: { ego: 0.5, ambition: 1, honesty: 0.6, aggression: 0.5 }, power: b.power, popularity: b.pop,
  });
  me.isPlayer = true;
  me.loyalty = 100;
  me.experience = cfg.role === 'mk' ? 0 : 6;
  me.expertise = { management: 55, media: 50 };
  if (cfg.look) me.caricature = { ...me.caricature, ...cfg.look };
  s.politicians.player = me;
  s.player.politicalCapital = b.cap;
  s.player.reputation = b.rep;
  s.elections.scheduledTurn = b.elections;

  const replaceLeader = () => {
    const old = s.politicians[party.leaderId];
    if (old) {
      old.active = false;
      old.quirk = 'מונה לשגריר באיי פיג׳י אחרי שאיבד את ראשות המפלגה.';
      if (old.ministryId) {
        const m = s.government.ministries.find((x) => x.id === old.ministryId);
        if (m) m.ministerId = null;
        old.ministryId = null;
      }
      party.memberIds = party.memberIds.filter((id) => id !== old.id);
    }
    party.leaderId = 'player';
    party.memberIds.unshift('player');
    s.player.listRank = 1;
  };

  if (cfg.role === 'pm') {
    replaceLeader();
    s.government.pmId = 'player';
    // the old kise leader, if not the replaced one, stays as an ambitious rival
    for (const m of s.government.ministries) if (!m.ministerId) fillMinistry(s, m.id);
  } else if (cfg.role === 'candidate') {
    replaceLeader();
  } else if (cfg.role === 'minister') {
    party.memberIds.push('player');
    const mid = cfg.ministryId ?? 'transport';
    const m = s.government.ministries.find((x) => x.id === mid)!;
    if (m.ministerId) {
      const old = s.politicians[m.ministerId];
      old.ministryId = null;
      old.memory.push({ turn: 0, kind: 'fired', text: `פינה את ${m.name} בשבילך`, weight: -12 });
      old.loyalty = clamp(old.loyalty - 10);
    }
    m.ministerId = 'player';
    m.agreementPartyId = party.id;
    me.ministryId = m.id;
    me.expertise[m.domain] = 55;
    s.player.listRank = Math.min(5, Math.max(2, Math.round(party.seats * 0.25)));
  } else {
    party.memberIds.push('player');
    s.player.listRank = Math.max(2, Math.round(party.seats * 0.6));
  }
  s.player.partyId = party.id;
}

function fillMinistry(s: GameState, ministryId: string): void {
  const m = s.government.ministries.find((x) => x.id === ministryId)!;
  const party = s.parties[m.agreementPartyId ?? s.politicians[s.government.pmId].partyId];
  const cand = party.memberIds.map((id) => s.politicians[id]).filter((p) => p.active && !p.ministryId && !p.isPlayer);
  cand.sort((a, b) => (b.expertise[m.domain] ?? 20) - (a.expertise[m.domain] ?? 20));
  if (cand[0]) {
    cand[0].ministryId = m.id;
    m.ministerId = cand[0].id;
  }
}

export function roleLabel(s: GameState): string {
  const me = s.politicians[s.player.politicianId];
  const f = me?.gender === 'f';
  switch (s.player.role) {
    case 'pm': return f ? 'ראשת הממשלה' : 'ראש הממשלה';
    case 'candidate': return f ? 'מועמדת לראשות הממשלה' : 'מועמד לראשות הממשלה';
    case 'minister': {
      const m = s.government.ministries.find((x) => x.id === me?.ministryId);
      return m ? `${f ? 'השרה' : 'השר'} ב${m.name}` : f ? 'שרה' : 'שר';
    }
    default: return f ? 'חברת כנסטון' : 'חבר כנסטון';
  }
}
