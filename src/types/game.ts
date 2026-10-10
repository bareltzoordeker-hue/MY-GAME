// ============================================================
// GameState — the single source of truth of the game.
// All engine functions take a GameState and return a new one.
// ============================================================

export type Role = 'pm' | 'candidate' | 'minister' | 'mk';
export type Difficulty = 'easy' | 'normal' | 'hard' | 'chaos';

export type GroupId =
  | 'youth' | 'elderly' | 'families' | 'lowIncome' | 'middleClass' | 'highIncome'
  | 'soldiers' | 'reservists' | 'haredim' | 'secular' | 'religious' | 'center'
  | 'periphery' | 'settlers' | 'left' | 'right' | 'selfEmployed' | 'employees'
  | 'publicSector' | 'students' | 'retirees' | 'arabs' | 'liberals' | 'socialists' | 'olim';

export type BudgetCategory =
  | 'defense' | 'education' | 'health' | 'transport' | 'welfare' | 'housing'
  | 'infrastructure' | 'police' | 'agriculture' | 'energy' | 'science' | 'culture' | 'government';

export type ServiceId =
  | 'health' | 'education' | 'transport' | 'housing' | 'security'
  | 'welfare' | 'infrastructure' | 'energy' | 'govServices';

export type Domain =
  | 'economy' | 'finance' | 'defense' | 'education' | 'health' | 'transport' | 'law'
  | 'foreign' | 'infrastructure' | 'management' | 'welfare' | 'energy' | 'agriculture'
  | 'interior' | 'media' | 'housing' | 'science' | 'culture';

export type RegionId =
  | 'north' | 'haifa' | 'sharon' | 'center' | 'jerusalem' | 'shfela' | 'judea_samaria' | 'negev' | 'eilat';

export interface GameDate { year: number; month: number; day?: number } // month 1..12, day 1..31 (turns: 4 months, or 2 weeks during a campaign)

/** -1..1 on each axis: economic (left..right), security (dove..hawk), religion (secular..religious) */
export interface Ideology { economic: number; security: number; religion: number }

// ---------------- Effects ----------------
export interface EconomyShock { growth?: number; unemployment?: number; inflation?: number }

/** A generic bundle of consequences. Every decision / law / crisis / event resolves to Effects. */
export interface Effects {
  budget?: Partial<Record<BudgetCategory, number>>; // delta in annual ₪B
  taxes?: Partial<Taxes>; // delta in percentage points
  groups?: Partial<Record<GroupId, number>>; // satisfaction (mood) delta
  services?: Partial<Record<ServiceId, number>>; // immediate quality delta
  serviceBonus?: Partial<Record<ServiceId, number>>; // long-term quality target bonus
  economy?: EconomyShock; // temporary shock (decays)
  oneOffCost?: number; // ₪B paid now (added to debt)
  revenue?: number; // ₪B/yr extra temporary revenue (enforcement etc.), decays
  playerCapital?: number;
  playerPopularity?: number;
  playerReputation?: number;
  partyMomentum?: Record<string, number>;
  stability?: number;
  loyalty?: Record<string, number>; // politicianId -> delta
  regionInvestment?: Partial<Record<RegionId, number>>;
}

// ---------------- Economy ----------------
export interface Taxes { incomeTax: number; vat: number; corporateTax: number }

export interface Economy {
  gdp: number; // nominal, annual ₪B
  growth: number; // real, annual %
  unemployment: number; // %
  inflation: number; // annual %
  interestRate: number; // central bank %
  effectiveDebtRate: number; // %
  debt: number; // ₪B
  revenue: number; // annual ₪B
  spending: number; // annual ₪B
  deficit: number; // annual ₪B (positive = deficit)
  avgIncome: number; // monthly ₪
  taxes: Taxes;
  creditRating: string;
  shocks: Required<EconomyShock>; // temporary, decaying
  structural: Required<EconomyShock>; // permanent (laws)
  otherRevenue: number; // ₪B fiscal tools (enforcement, bonds premium etc), decays
}

export interface Budget {
  allocations: Record<BudgetCategory, number>; // annual ₪B
  needs: Record<BudgetCategory, number>; // annual ₪B required for "OK" service
  debtInterest: number; // annual ₪B
  projectSpending: number; // annual ₪B
  fiscalYear: number;
  passed: boolean; // annual budget approved by the Knesseton
  deadlineTurn: number; // turn by which the budget must pass
}

export interface Service {
  id: ServiceId;
  quality: number; // 0..100
  satisfaction: number; // 0..100
  trend: number; // last delta
  bonus: number; // long-term target bonus (projects, reforms)
  metrics: Record<string, number>;
  issues: string[];
}

// ---------------- Population ----------------
export interface PopulationGroup {
  id: GroupId;
  satisfaction: number; // displayed 0..100
  structural: number; // slowly-moving baseline
  mood: number; // decaying offset from decisions
  offset: number; // permanent (laws)
  lastDelta: number;
}

export interface Region {
  id: RegionId;
  populationShare: number;
  unemployment: number;
  income: number;
  satisfaction: number;
  investment: number; // 0..100 index
  infrastructure: number; // 0..100
  services: number; // 0..100
}

export interface Population {
  total: number; // millions
  growthRate: number; // annual %
  ages: { kids: number; young: number; adults: number; seniors: number }; // shares
  groups: Record<GroupId, PopulationGroup>;
  regions: Record<RegionId, Region>;
}

// ---------------- Politics ----------------
export interface CaricatureSpec {
  skin: string;
  hair: 'bald' | 'comb' | 'curly' | 'kippah' | 'hat' | 'beret' | 'long' | 'spiky' | 'bun' | 'grey' | 'scarf' | 'short';
  hairColor: string;
  glasses: boolean;
  beard: 'none' | 'stubble' | 'full' | 'long';
  nose: number; // 0..1 size
  mouth: 'smile' | 'smirk' | 'open' | 'frown';
  suit: string;
  brows: 'flat' | 'angry' | 'worried';
  ears: number; // 0..1
}

export interface Personality {
  ego: number; ambition: number; honesty: number; aggression: number; // 0..1
}

export type MemoryKind = 'promise' | 'betrayal' | 'favor' | 'insult' | 'fired' | 'appointed' | 'ignored' | 'deal' | 'support';

export interface MemoryEntry {
  turn: number;
  kind: MemoryKind;
  text: string;
  weight: number; // signed impact on loyalty; decays
  deadlineTurn?: number; // for promises
  resolved?: boolean;
  ref?: string; // what fulfils a promise: a lawId, or 'role'
}

export interface Politician {
  id: string;
  name: string;
  gender: 'm' | 'f';
  partyId: string;
  ministryId: string | null;
  committee: string | null;
  mainDomain: Domain;
  expertise: Partial<Record<Domain, number>>; // 0..100
  power: number; // 0..100
  loyalty: number; // attitude toward the player 0..100
  popularity: number; // 0..100
  experience: number; // years
  personality: Personality;
  ideology: Ideology;
  memory: MemoryEntry[];
  relationships: Record<string, number>; // politicianId -> -100..100
  caricature: CaricatureSpec;
  quirk: string;
  cooldownUntil: number;
  isPlayer: boolean;
  active: boolean;
  ambitionTarget: string; // flavour: what they want
  /** place on the party list for the next election (0 = not on the list) */
  listRank?: number;
  /** currently a member of the Knesseton */
  inKnesset?: boolean;
  /** short neutral description (current or past roles) */
  bio?: string;
  /** real person from the roster (not generated) */
  real?: boolean;
  /** deputy minister in this ministry */
  deputyOf?: string;
}

/** ministry/deputy/committee = posts; budget = sector money; law = pass it; veto = never advance it;
 *  rotation = the partner leader becomes PM half-way; jobs = appointments; cash = off-budget funds (secret, may be exposed). */
export type DemandKind = 'ministry' | 'budget' | 'law' | 'deputy' | 'committee' | 'rotation' | 'veto' | 'jobs' | 'cash';

export interface Demand {
  kind: DemandKind;
  committee?: string;
  /** offered by the player as a sweetener (not demanded by the party) */
  sweetener?: boolean;
  ministryId?: string;
  category?: BudgetCategory;
  amount?: number;
  lawId?: string;
  label: string;
}

export interface Party {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  color: string;
  ideology: Ideology;
  description: string;
  slogan: string;
  seats: number;
  pollShare: number; // %
  leaderId: string;
  memberIds: string[];
  power: number;
  momentum: number; // -40..40, decays
  calibration: number; // multiplier making initial polls match initial seats
  affinity: Partial<Record<GroupId, number>>;
  preferredMinistries: string[];
  demands: Demand[]; // standing coalition demands
  favoriteLaws: string[];
  hatedLaws: string[];
  funds: number; // ₪M
  isPlayerParty: boolean;
  cohesion: number; // 0..100 internal unity
  letters?: string;
  bloc?: 'gov' | 'opp' | 'arab';
  redLines?: string[];
}

export interface Ministry {
  id: string;
  name: string;
  icon: string;
  domain: Domain;
  services: ServiceId[];
  categories: BudgetCategory[];
  ministerId: string | null;
  efficiency: number; // 0..100
  bureaucracy: number; // 0..100
  deep: boolean; // has a dedicated deep dashboard
  custom?: boolean;
  satire?: boolean;
  agreementPartyId?: string; // coalition agreement says this ministry belongs to party
  origins?: string[]; // original ministry ids (after merges)
}

export interface Government {
  pmId: string;
  coalition: string[]; // party ids
  ministries: Ministry[];
  stability: number; // 0..100
  approval: number; // 0..100
  formedTurn: number;
  /** day number (engine/calendar) when the government was formed */
  formedDay?: number;
  /** transitional government until the next election (no confidence votes / budget deadline) */
  caretaker?: boolean;
  lowMajorityTurns: number;
  lowApprovalTurns: number;
  /** the written coalition agreement: commitments to partners, with due dates */
  agreements?: Commitment[];
}

export type ChatTopicKind = 'unhappy' | 'praise' | 'coop' | 'ask_law' | 'warn_law' | 'campaign' | 'offer';
/** An open thread in a conversation: why the politician wrote, and how far the talk has got */
/** What a politician wants in return for a favour: shown to the player as quick replies. */
export interface PendingOffer {
  action: 'law_support' | 'fund' | 'role' | 'back_budget';
  lawId?: string;
  ministryId?: string;
  amount?: number;
  /** the price he names: pick one, or answer with another law */
  options: { kind: 'law' | 'vote' | 'role'; lawId?: string; label: string }[];
}
export interface ChatTopic {
  kind: ChatTopicKind;
  stage: 'opened' | 'explained';
  turn: number;
  lawId?: string;
  demand?: 'role' | 'budget' | 'law' | 'respect';
  offer?: PendingOffer;
}

export interface ChatMsg {
  from: 'me' | 'them';
  text: string;
  turn: number;
  /** a short note about what the message changed */
  hint?: string;
  /** the politician wrote first */
  proactive?: boolean;
}

export interface WorldState {
  fronts: Record<string, { threat: number; status: 'quiet' | 'tension' | 'fighting' | 'ceasefire'; ceasefireUntil?: number; incidents: number }>;
  units: Record<string, { readiness: number }>;
  channels: Record<string, number>;
  relations: Record<string, number>;
  /** Judea and Samaria under the Oslo Accords, % of the area */
  areas: { A: number; B: number; C: number };
  casualties: { soldiers: number; civilians: number };
  operations: { id: string; opId: string; front: string; turn: number }[];
  measures: string[];
  normalized: string[];
}

export interface CampaignState {
  /** day number of the election this campaign is for */
  electionDay: number;
  strategy: 'security' | 'economy' | 'social' | 'identity' | 'change' | 'stability';
  targets: GroupId[];
  budget: 'low' | 'mid' | 'high';
  slogan: string;
  negativeHits: number;
  internalPoll?: { turn: number; seats: number; low: number; high: number; topIssue: string };
}

export interface Commitment {
  id: string;
  partyId: string;
  kind: DemandKind;
  label: string;
  lawId?: string;
  ministryId?: string;
  /** turn by which it must be kept (laws), or day number (rotation) */
  dueTurn?: number;
  dueDay?: number;
  status: 'pending' | 'kept' | 'broken';
  remindedTurn?: number;
  secret?: boolean;
}

export type BillStage = 'preliminary' | 'committee' | 'final';
export interface VoteResult {
  for: number; against: number; abstain: number; passed: boolean;
  byParty: Record<string, 'for' | 'against' | 'split' | 'abstain'>;
}
export interface Bill {
  id: string;
  lawId: string;
  title: string;
  sponsorId: string;
  isGovernment: boolean;
  stage: BillStage;
  turnsInStage: number;
  proposedTurn: number;
  status: 'active' | 'passed' | 'failed' | 'withdrawn';
  lastVote?: VoteResult;
  push: number; // extra support bought with political capital
  modified: boolean; // softened version (half effects, more support)
}

// ---------------- Projects / crises ----------------
export interface Project {
  id: string;
  defId: string;
  name: string;
  icon: string;
  region: RegionId;
  service: ServiceId;
  totalCost: number; // ₪B
  spent: number;
  progress: number; // 0..100
  durationTurns: number;
  turnsElapsed: number;
  status: 'active' | 'done' | 'cancelled';
  delays: number;
  startedTurn: number;
  sponsorId: string;
}

export interface CrisisAction {
  id: string;
  label: string;
  hint: string;
  cost: number; // ₪B
  capital: number;
  successChance: number; // 0..1
  effects: Effects;
}

export interface Crisis {
  id: string;
  defId: string;
  title: string;
  icon: string;
  category: string;
  severity: 1 | 2 | 3;
  startTurn: number;
  remaining: number;
  affectedServices: ServiceId[];
  affectedGroups: GroupId[];
  perTurn: Effects;
  impactLines: string[];
  actions: CrisisAction[];
  ministryId?: string;
}

// ---------------- Media / polls ----------------
export interface PollSnapshot {
  turn: number;
  shares: Record<string, number>;
  seats: Record<string, number>;
  govApproval: number;
  playerApproval: number;
}

export type NewsTone = 'neutral' | 'good' | 'bad' | 'satire';
export interface NewsItem {
  id: string;
  turn: number;
  headline: string;
  outlet: string;
  tone: NewsTone;
  icon: string;
}

export interface ElectionPromise {
  id: string;
  defId: string;
  text: string;
  madeTurn: number;
  deadlineTurn: number;
  status: 'pending' | 'kept' | 'broken' | 'void';
  baseline: number;
  groups: GroupId[];
}

export interface InboxOption { id: string; label: string; hint?: string }
export interface InboxItem {
  id: string;
  kind: string;
  title: string;
  text: string;
  fromId?: string;
  createdTurn: number;
  expiresTurn: number;
  options: InboxOption[];
  defaultOptionId: string;
  payload: Record<string, string | number>;
}

export interface TurnEvent {
  turn: number;
  icon: string;
  text: string;
  importance: 1 | 2 | 3;
  tone: NewsTone;
  kind: string;
}

// ---------------- Player / career ----------------
export interface Player {
  name: string;
  role: Role;
  politicianId: string;
  partyId: string;
  politicalCapital: number; // 0..100 — the "currency" of political action
  reputation: number; // 0..100 — seriousness / expertise image
  actionCooldowns: Record<string, number>; // actionId -> turn available
  listRank: number;
  /** the real person the player plays (roster id), if any */
  personId?: string;
}

export interface CareerStats {
  startTurn: number;
  turnsInRole: Record<Role, number>;
  governmentsFormed: number;
  lawsPassed: number;
  billsProposed: number;
  moneyInvested: number; // ₪B
  electionsWon: number;
  electionsLost: number;
  achievements: string[];
  failures: string[];
  memorable: string[];
  roleHistory: { turn: number; role: Role; label: string }[];
  decisions: number;
}

export interface HistoryPoint {
  turn: number;
  gdp: number;
  growth: number;
  unemployment: number;
  inflation: number;
  deficitPct: number;
  debtPct: number;
  approval: number;
  playerApproval: number;
  servicesAvg: number;
  date?: GameDate;
}

export interface PartyOffer {
  partyId: string;
  demands: Demand[];
  patience: number;
  status: 'pending' | 'accepted' | 'refused';
  willingness: number; // 0..1
}


export interface Negotiation {
  formateurId: string;
  offers: Record<string, PartyOffer>;
  attempt: number;
  /** days left on the mandate (28 + one 14-day extension by the President) */
  daysLeft?: number;
  extended?: boolean;
}

export interface ElectionResult {
  turn: number;
  shares: Record<string, number>;
  seats: Record<string, number>;
  formateurId: string;
  early: boolean;
}

export interface Elections {
  /** election day (the calendar drives elections; scheduledTurn is kept in sync for the UI) */
  date?: GameDate;
  scheduledTurn: number;
  phase: 'none' | 'negotiation';
  negotiation: Negotiation | null;
  last: ElectionResult | null;
  campaignBoost: Record<string, number>; // partyId -> campaign effect accumulated before election
  count: number;
  /** surplus-vote agreement partner for the coming election */
  surplusWith?: string;
}

export interface GameOverInfo {
  reason: 'ousted' | 'resigned' | 'coalition_failed' | 'lost_election' | 'not_elected' | 'expelled';
  title: string;
  text: string;
  turn: number;
}

export interface Briefing {
  turn: number;
  lines: { icon: string; text: string; tone: NewsTone }[];
  changes: { label: string; before: number; after: number; unit: string; goodWhenUp: boolean }[];
}

export interface DramaOption { id: string; label: string; hint?: string }
export interface DramaEvent {
  id: string;
  defId: string;
  title: string;
  text: string;
  icon: string;
  level: 'normal' | 'breaking' | 'extreme';
  options: DramaOption[];
  fromId?: string;
  partyId?: string;
  turn: number;
  vars: Record<string, string | number>;
}

export interface Alliance {
  partyId: string;
  kind: 'votes' | 'bloc'; // votes = coordination in the Knesseton; bloc = also recommend you after elections
  strength: number; // 0..100
  since: number;
  demand: string;
}

export interface GameState {
  /** which cast the game is played with: the real parties and politicians, or the fictional one */
  cast?: 'real' | 'fictional';
  /** date the career started (for career length) */
  startDate?: GameDate;
  drama: DramaEvent | null; // pending dramatic event — must be resolved before advancing
  alliances: Alliance[];
  /** chat history per politician, and unread counts */
  chats?: Record<string, ChatMsg[]>;
  chatUnread?: Record<string, number>;
  /** what each conversation is currently about (set when the politician writes first) */
  chatTopics?: Record<string, ChatTopic>;
  /** security fronts, forces and the diplomatic track */
  world?: WorldState;
  /** the player party's election campaign (set when the campaign opens) */
  campaign?: CampaignState;
  /** party-to-party relations, key "a|b" (sorted), -100..100 */
  partyRelations?: Record<string, number>;
  version: number;
  seed: number;
  rngState: number;
  turn: number;
  date: GameDate;
  difficulty: Difficulty;
  player: Player;
  parties: Record<string, Party>;
  politicians: Record<string, Politician>;
  government: Government;
  bills: Bill[];
  activeLaws: string[];
  economy: Economy;
  budget: Budget;
  services: Record<ServiceId, Service>;
  population: Population;
  projects: Project[];
  crises: Crisis[];
  polls: PollSnapshot[];
  news: NewsItem[];
  promises: ElectionPromise[];
  inbox: InboxItem[];
  history: HistoryPoint[];
  career: CareerStats;
  elections: Elections;
  turnLog: TurnEvent[]; // events of the current turn (cleared each turn)
  eventLog: TurnEvent[]; // long-term notable events
  briefing: Briefing | null;
  flags: Record<string, number>; // generic cooldowns / counters
  /** laws that passed recently: their consequences unfold over the next turns */
  aftermath?: { lawId: string; turn: number; stage?: number }[];
  gameOver: GameOverInfo | null;
  nextId: number;
}

// ---------------- Reactions (returned to UI, not stored) ----------------
export interface ReactionLine { icon: string; label: string; text: string; tone: 'good' | 'bad' | 'neutral' }
export interface Reaction {
  title: string;
  subtitle?: string;
  status: 'approved' | 'rejected' | 'info' | 'pending';
  stats: { icon: string; label: string; value: string; tone: 'good' | 'bad' | 'neutral' }[];
  groups: ReactionLine[];
  people: ReactionLine[];
  quip?: string;
}

export interface ActionResult { state: GameState; reaction: Reaction | null }
