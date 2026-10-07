import { MINISTRIES } from '../data/ministries';
import { PARTIES, SKINS, SUITS } from '../data/parties';
import { PEOPLE, type PersonDef } from '../data/people';
import { CATEGORIES, DIFFICULTIES, GROUPS, REGIONS, SERVICES } from '../data/world';
import type {
  BudgetCategory, CaricatureSpec, Difficulty, Domain, GameState, GroupId, Politician, PopulationGroup, RegionId, Role, Service, ServiceId,
} from '../types/game';
import { clamp, sum } from '../utils';
import { dayNumber, turnsUntilElection } from './calendar';
import { refreshFiscals } from './economy';
import { computeApproval, groupTargetRaw } from './population';
import { computeShares, seatsFromShares } from './polls';
import { initWorld } from './security';
import { serviceDrivers, updateMetrics } from './services';
import { pushHistory } from './history';

export interface NewGameConfig {
  /** play as this real person (id from data/people) */
  personId?: string;
  /** or play your own character, who takes the list slot of `replaceId` */
  custom?: { name: string; gender: 'm' | 'f'; look?: Partial<CaricatureSpec>; replaceId: string };
  difficulty: Difficulty;
  seed?: number;
  // ---- legacy/quick-start fields (tests, debug): pick a fitting real person ----
  playerName?: string;
  gender?: 'm' | 'f';
  role?: Role;
  partyId?: string;
  ministryId?: string;
  partyName?: string;
  partyLogo?: string;
  look?: Partial<CaricatureSpec>;
}

/** Game starts the day after the lists were submitted; election day is 27.10.2026. */
export const START_DATE = { year: 2026, month: 9, day: 8 };
export const ELECTION_DATE = { year: 2026, month: 10, day: 27 };

/** small deterministic number from a string (stable looks / noise per person) */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Base caricature for a real person: their known features (data/people) over neutral defaults. */
export function personCaricature(p: Pick<PersonDef, 'id' | 'gender' | 'party' | 'look'>): CaricatureSpec {
  const h = hash(p.id);
  const haredi = p.party === 'utj';
  const base: CaricatureSpec = {
    skin: SKINS[Math.floor(h * SKINS.length)],
    hair: p.gender === 'f' ? (['long', 'bun', 'short', 'curly'] as const)[Math.floor(h * 4)] : haredi ? 'hat' : (['comb', 'bald', 'comb', 'grey'] as const)[Math.floor(h * 4)],
    hairColor: ['#1f2937', '#3b2a1a', '#4b3621', '#2a2a2a', '#6b4423'][Math.floor(h * 5)],
    glasses: h > 0.72,
    beard: p.gender === 'f' ? 'none' : haredi ? 'long' : h > 0.8 ? 'stubble' : 'none',
    nose: 0.35 + h * 0.4,
    mouth: 'smile',
    suit: SUITS[Math.floor(h * 3)],
    brows: 'flat',
    ears: 0.3 + h * 0.3,
  };
  return { ...base, ...(p.look ?? {}) };
}

/** Look for a newly created (non-roster) politician, e.g. a recruited candidate. */
export function randomCaricature(s: GameState, gender: 'm' | 'f', partyId: string): CaricatureSpec {
  return personCaricature({ id: `gen_${s.nextId}_${partyId}`, gender, party: partyId });
}

function ambitionFor(p: PersonDef): string {
  if (p.rank === 1) return 'לעמוד בראש הממשלה';
  if (p.role && p.role !== 'speaker' && !p.role.startsWith('deputy')) return 'להמשיך לכהן כשר';
  if (p.fame >= 3) return 'תיק בכיר בממשלה הבאה';
  return p.rank && p.rank <= 20 ? 'ראשות ועדה בכנסטון' : 'מקום ריאלי ברשימה';
}

function makePolitician(p: PersonDef): Politician {
  const party = PARTIES.find((x) => x.id === p.party)!;
  const h = hash(p.id);
  const noise = (k: number) => (hash(p.id + k) - 0.5) * 0.3;
  const skills: Partial<Record<Domain, number>> = { ...(p.skills ?? { [p.domain]: 40 + p.fame * 8 }) };
  skills[p.domain] ??= 40 + p.fame * 8;
  const rankBonus = p.rank ? Math.max(0, 16 - p.rank * 0.6) : 4;
  return {
    id: p.id,
    name: p.name,
    gender: p.gender,
    partyId: p.party,
    ministryId: null,
    committee: null,
    mainDomain: p.domain,
    expertise: skills,
    power: clamp(8 + p.fame * 14 + rankBonus),
    loyalty: 50,
    popularity: clamp(6 + p.fame * 14 + h * 6),
    experience: p.mk ? 6 + Math.round(h * 14) : 2 + Math.round(h * 6),
    personality: { ego: clamp(0.35 + p.fame * 0.1 + noise(1), 0, 1), ambition: clamp(0.45 + p.fame * 0.08 + noise(2), 0, 1), honesty: clamp(0.55 + noise(3), 0, 1), aggression: clamp(0.45 + noise(4), 0, 1) },
    ideology: {
      economic: clamp(party.ideology.economic + noise(5) * 0.6, -1, 1),
      security: clamp(party.ideology.security + noise(6) * 0.6, -1, 1),
      religion: clamp(party.ideology.religion + noise(7) * 0.6, -1, 1),
    },
    memory: [],
    relationships: {},
    caricature: personCaricature(p),
    quirk: p.bio ?? '',
    bio: p.bio,
    cooldownUntil: 0,
    isPlayer: false,
    active: true,
    ambitionTarget: ambitionFor(p),
    listRank: p.rank,
    inKnesset: !!p.mk,
    real: true,
  };
}

const INITIAL_QUALITY: Record<ServiceId, number> = {
  health: 50, education: 49, transport: 44, housing: 38, security: 52, welfare: 49, infrastructure: 48, energy: 58, govServices: 50,
};

/** Which real person a quick-start config maps to (legacy role/party fields). */
export function defaultPersonFor(role: Role, partyId?: string, ministryId?: string): PersonDef {
  const inParty = PEOPLE.filter((p) => !partyId || p.party === partyId);
  if (role === 'pm') return PEOPLE.find((p) => p.role === 'pm')!;
  if (role === 'minister') return PEOPLE.find((p) => p.role === ministryId) ?? PEOPLE.find((p) => p.role && MINISTRIES.some((m) => m.id === p.role) && (!partyId || p.party === partyId)) ?? PEOPLE.find((p) => p.role === 'transport')!;
  if (role === 'candidate') return inParty.find((p) => p.rank === 1 && p.role !== 'pm') ?? PEOPLE.find((p) => p.party === 'yashar' && p.rank === 1)!;
  return inParty.filter((p) => p.mk && p.rank > 1 && !p.role).sort((a, b) => b.rank - a.rank)[0] ?? inParty.find((p) => p.rank > 3) ?? PEOPLE.find((p) => p.party === 'likud' && p.rank === 20)!;
}

/** Role in the game from a person's real position. */
export function roleOf(s: GameState, politicianId: string): Role {
  const p = s.politicians[politicianId];
  if (s.government.pmId === politicianId) return 'pm';
  if (p.ministryId) return 'minister';
  if (s.parties[p.partyId]?.leaderId === politicianId) return 'candidate';
  return 'mk';
}

const POLL_TOTAL = PARTIES.reduce((a, p) => a + p.poll, 0);

export function createGame(cfg: NewGameConfig): GameState {
  const seed = cfg.seed ?? Math.floor(Math.random() * 2 ** 31);
  const diff = DIFFICULTIES[cfg.difficulty];

  const allocations = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.initial])) as Record<BudgetCategory, number>;
  const needs = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.initial * diff.needFactor])) as Record<BudgetCategory, number>;

  const s: GameState = {
    version: 2,
    seed,
    rngState: seed,
    turn: 0,
    date: { ...START_DATE },
    startDate: { ...START_DATE },
    difficulty: cfg.difficulty,
    player: { name: '', role: 'mk', politicianId: 'player', partyId: '', politicalCapital: 50, reputation: 45, actionCooldowns: {}, listRank: 1 },
    parties: {},
    politicians: {},
    government: { pmId: '', coalition: [], ministries: [], stability: { easy: 60, normal: 50, hard: 42, chaos: 35 }[cfg.difficulty], approval: 42, formedTurn: 0, formedDay: dayNumber({ year: 2022, month: 12, day: 29 }), caretaker: true, lowMajorityTurns: 0, lowApprovalTurns: 0 },
    bills: [],
    activeLaws: [],
    economy: {
      gdp: 2150, growth: 2.6 + diff.economyBias * 0.5, unemployment: 3.1, inflation: 3, interestRate: 4.25, effectiveDebtRate: 3.1,
      debt: diff.startDebt, revenue: 0, spending: 0, deficit: 0, avgIncome: 13900,
      taxes: { incomeTax: 21, vat: 18, corporateTax: 23 }, creditRating: 'A',
      shocks: { growth: 0, inflation: 0, unemployment: 0 }, structural: { growth: 0, inflation: 0, unemployment: 0 }, otherRevenue: 0,
    },
    budget: { allocations, needs, debtInterest: (diff.startDebt * 3.1) / 100, projectSpending: 0, fiscalYear: 2026, passed: true, deadlineTurn: 0 },
    services: {} as Record<ServiceId, Service>,
    population: {
      total: 10.1, growthRate: 1.8, ages: { kids: 0.32, young: 0.22, adults: 0.34, seniors: 0.12 },
      groups: {} as Record<GroupId, PopulationGroup>,
      regions: Object.fromEntries(REGIONS.map((r) => [r.id, { id: r.id, populationShare: r.share, unemployment: 3, income: 12000, satisfaction: 50, investment: 40, infrastructure: r.infra, services: 50 }])) as GameState['population']['regions'],
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
    elections: { date: { ...ELECTION_DATE }, scheduledTurn: 0, phase: 'none', negotiation: null, last: null, campaignBoost: {}, count: 0 },
    turnLog: [],
    eventLog: [],
    briefing: null,
    flags: {},
    gameOver: null,
    nextId: 1000,
    drama: null,
    alliances: [],
    world: initWorld(),
  };

  // ---------------- parties ----------------
  for (const def of PARTIES) {
    s.parties[def.id] = {
      id: def.id, name: def.name, shortName: def.shortName, logo: def.letters, color: def.color, ideology: { ...def.ideology },
      description: def.description, slogan: '', seats: def.seats, pollShare: (def.poll / 120) * 100, leaderId: '', memberIds: [],
      power: def.seats * 2 + def.poll, momentum: 0, calibration: 1, affinity: { ...def.affinity }, preferredMinistries: def.preferredMinistries,
      demands: [], favoriteLaws: def.favoriteLaws, hatedLaws: def.hatedLaws, funds: 4 + def.poll * 1.2, isPlayerParty: false, cohesion: 70,
      letters: def.letters, bloc: def.bloc, redLines: def.redLines,
    };
    if (def.coalition) s.government.coalition.push(def.id);
  }

  // ---------------- people (real roster) ----------------
  for (const p of PEOPLE) {
    s.politicians[p.id] = makePolitician(p);
    s.parties[p.party].memberIds.push(p.id);
  }
  for (const party of Object.values(s.parties)) {
    party.memberIds.sort((a, b) => (s.politicians[a].listRank || 999) - (s.politicians[b].listRank || 999));
    party.leaderId = party.memberIds.find((id) => s.politicians[id].listRank === 1) ?? party.memberIds[0];
  }
  s.government.pmId = PEOPLE.find((p) => p.role === 'pm')!.id;

  // ---------------- ministries (real ministers) ----------------
  for (const def of MINISTRIES) {
    const holder = PEOPLE.find((p) => p.role === def.id);
    s.government.ministries.push({
      id: def.id, name: def.name, icon: def.icon, domain: def.domain, services: [...def.services], categories: [...def.categories],
      ministerId: holder?.id ?? null, efficiency: 46 + Math.round(hash(def.id) * 12), bureaucracy: 42 + Math.round(hash(def.id + 'b') * 22), deep: def.deep,
      agreementPartyId: holder?.party ?? def.initialParty,
    });
    if (holder) {
      s.politicians[holder.id].ministryId = def.id;
      s.politicians[holder.id].power = clamp(s.politicians[holder.id].power + 10);
    }
  }

  // ---------------- player ----------------
  setupPlayer(s, cfg);

  // ---------------- loyalty & relationships baseline ----------------
  const me = s.politicians.player;
  for (const p of Object.values(s.politicians)) {
    if (p.isPlayer) continue;
    const same = p.partyId === me.partyId;
    const sameBloc = s.parties[p.partyId]?.bloc === s.parties[me.partyId]?.bloc;
    p.loyalty = clamp((same ? 58 : sameBloc ? 45 : 30) + (hash(p.id + 'l') - 0.5) * 20 - (p.personality.ego - 0.5) * 10);
    p.relationships[s.government.pmId] = Math.round((hash(p.id + 'pm') - 0.5) * 40) + (s.government.coalition.includes(p.partyId) ? 25 : -20);
  }

  // ---------------- services & groups ----------------
  for (const def of SERVICES) {
    s.services[def.id] = { id: def.id, quality: INITIAL_QUALITY[def.id], satisfaction: INITIAL_QUALITY[def.id] - 3, trend: 0, bonus: 0, metrics: { railKm: 1450, roadKm: 20000, beds: 0, classrooms: 0, renewables: 15, units: 0 }, issues: [] };
  }
  refreshFiscals(s);
  for (const def of SERVICES) {
    const raw = sum(serviceDrivers(s, def.id).map((d) => d.value));
    s.services[def.id].bonus = clamp(INITIAL_QUALITY[def.id] - raw, -30, 30);
    updateMetrics(s, def.id);
  }
  s.services.energy.metrics.renewables = 15;
  for (const g of GROUPS) {
    s.population.groups[g.id] = { id: g.id, satisfaction: g.base, structural: g.base, mood: 0, offset: 0, lastDelta: 0 };
  }
  for (const g of GROUPS) s.population.groups[g.id].offset = g.base - groupTargetRaw(s, g.id);
  s.government.approval = computeApproval(s);

  // calibrate parties so the first poll matches the real poll average (research/01)
  // shares are normalised together, so calibrate iteratively until every party sits on its poll average
  for (let pass = 0; pass < 8; pass++) {
    const raw = computeShares(s, 0);
    for (const def of PARTIES) {
      const target = (def.poll / POLL_TOTAL) * 100;
      s.parties[def.id].calibration *= target / Math.max(0.01, raw[def.id]);
    }
  }
  const shares = computeShares(s, 0);
  const seats = seatsFromShares(shares); // the first poll, in seats (the outgoing Knesseton stays in party.seats)
  s.polls.push({ turn: 0, shares, seats, govApproval: s.government.approval, playerApproval: me.popularity });
  for (const p of Object.values(s.parties)) p.pollShare = shares[p.id];

  for (const r of REGIONS) {
    const st = s.population.regions[r.id as RegionId];
    st.unemployment = s.economy.unemployment * r.unempFactor;
    st.income = Math.round(s.economy.avgIncome * r.incomeFactor);
    st.services = 50;
    st.satisfaction = s.government.approval;
  }

  s.elections.scheduledTurn = turnsUntilElection(s);
  s.career.roleHistory.push({ turn: 0, role: s.player.role, label: roleLabel(s) });
  pushHistory(s);
  s.briefing = {
    turn: 0,
    lines: [
      { icon: '🗓️', text: 'ספטמבר 2026. הכנסטון התפזר והרשימות הוגשו. הבחירות לכנסטון ה-26 ייערכו ב-27 באוקטובר.', tone: 'neutral' },
      { icon: '🏛️', text: `${roleLabel(s)}. עד הבחירות כל תור הוא שבועיים של קמפיין.`, tone: 'neutral' },
      { icon: '🧠', text: 'היועץ זמין בכל רגע. ההחלטות שלך.', tone: 'neutral' },
    ],
    changes: [],
  };
  return s;
}

function setupPlayer(s: GameState, cfg: NewGameConfig): void {
  // whom does the player play (or replace)?
  const legacyRole = cfg.role ?? 'mk';
  const target = cfg.custom
    ? PEOPLE.find((p) => p.id === cfg.custom!.replaceId)
    : cfg.personId
      ? PEOPLE.find((p) => p.id === cfg.personId)
      : defaultPersonFor(legacyRole, cfg.partyId, cfg.ministryId);
  const slot = target ?? PEOPLE.find((p) => p.role === 'pm')!;
  const old = s.politicians[slot.id];

  // the player takes over this record under the id 'player'
  const me: Politician = { ...old, id: 'player', isPlayer: true, loyalty: 100, relationships: {} };
  if (cfg.custom || cfg.playerName) {
    me.name = cfg.custom?.name ?? cfg.playerName ?? old.name;
    me.gender = cfg.custom?.gender ?? cfg.gender ?? old.gender;
    me.real = !!cfg.personId && !cfg.custom;
    if (cfg.custom) { me.bio = undefined; me.quirk = ''; me.experience = 2; }
    if (cfg.custom?.look ?? cfg.look) me.caricature = { ...me.caricature, ...(cfg.custom?.look ?? cfg.look) };
  }
  delete s.politicians[old.id];
  s.politicians.player = me;
  const swap = (id: string) => (id === old.id ? 'player' : id);
  for (const party of Object.values(s.parties)) {
    party.memberIds = party.memberIds.map(swap);
    party.leaderId = swap(party.leaderId);
  }
  s.government.pmId = swap(s.government.pmId);
  for (const m of s.government.ministries) if (m.ministerId) m.ministerId = swap(m.ministerId);

  const party = s.parties[me.partyId];
  party.isPlayerParty = true;
  if (cfg.partyName) { party.name = cfg.partyName; party.shortName = cfg.partyName.slice(0, 14); }

  const role = roleOf(s, 'player');
  const base: Record<Role, { cap: number; rep: number }> = {
    pm: { cap: 60, rep: 52 }, candidate: { cap: 52, rep: 48 }, minister: { cap: 45, rep: 48 }, mk: { cap: 30, rep: 34 },
  };
  s.player.name = me.name;
  s.player.role = role;
  s.player.partyId = me.partyId;
  s.player.politicalCapital = base[role].cap;
  s.player.reputation = clamp(base[role].rep + (me.real ? 6 : 0));
  s.player.listRank = me.listRank || 99;
}

export function roleLabel(s: GameState): string {
  const me = s.politicians[s.player.politicianId];
  const f = me?.gender === 'f';
  switch (s.player.role) {
    case 'pm': return f ? 'ראשת הממשלה' : 'ראש הממשלה';
    case 'candidate': return f ? `יו״ר ${s.parties[s.player.partyId]?.name}` : `יו״ר ${s.parties[s.player.partyId]?.name}`;
    case 'minister': {
      const m = s.government.ministries.find((x) => x.id === me?.ministryId);
      if (!m) return f ? 'שרה' : 'שר';
      // "משרד הביטחון" → "שר הביטחון"; "המשרד לביטחון לאומי" → "השר לביטחון לאומי"
      if (m.name.startsWith('המשרד ')) return `${f ? 'השרה' : 'השר'} ${m.name.slice('המשרד '.length)}`;
      return `${f ? 'שרת' : 'שר'} ${m.name.replace(/^משרד /, '')}`;
    }
    default: return me?.inKnesset ? (f ? 'חברת הכנסטון' : 'חבר הכנסטון') : (f ? 'מועמדת לכנסטון' : 'מועמד לכנסטון');
  }
}
