// ============================================================
// Election campaign: the player's party picks a strategy, target groups and a
// budget when the campaign opens; each campaign turn the strategy pays off
// according to how much its issue matters right now.
// ============================================================
import { GROUP_BY_ID } from '../data/world';
import type { CampaignState, GameState, GroupId } from '../types/game';
import { clamp, deficitPct } from '../utils';
import { dayNumber, electionDate, inCampaign } from './calendar';
import { addNews, logEvent } from './effects';
import { isPartyLeader } from './roles';

export interface StrategyDef { id: CampaignState['strategy']; name: string; icon: string; desc: string; slogans: string[]; groups: GroupId[] }

export const STRATEGIES: StrategyDef[] = [
  { id: 'security', name: 'ביטחון', icon: '🛡️', desc: 'הקמפיין סביב ביטחון, הרתעה והחזרת הביטחון האישי. חזק כשיש מתיחות ביטחונית.', slogans: ['ביטחון קודם לכל', 'חזקים מול האיומים', 'שקט לצפון ולדרום'], groups: ['right', 'reservists', 'settlers', 'periphery'] },
  { id: 'economy', name: 'כלכלה ויוקר המחיה', icon: '💰', desc: 'מחירי דיור, מזון ומשכורות. חזק כשהאינפלציה או האבטלה גבוהות.', slogans: ['להוריד את יוקר המחיה', 'כלכלה שעובדת בשבילכם', 'דירה, משכורת, עתיד'], groups: ['middleClass', 'youth', 'families', 'employees'] },
  { id: 'social', name: 'צדק חברתי', icon: '🤝', desc: 'רווחה, בריאות וחינוך ציבוריים. חזק כשהשירותים הציבוריים חלשים.', slogans: ['מדינה ששומרת על כולם', 'חינוך ובריאות לכל אחד', 'להחזיר את הצדק החברתי'], groups: ['lowIncome', 'socialists', 'elderly', 'publicSector'] },
  { id: 'identity', name: 'זהות ודת ומדינה', icon: '🕍', desc: 'אופי המדינה, מסורת או חירות מדת. חזק כשהשאלה הדתית-חילונית בוערת.', slogans: ['לשמור על אופי המדינה', 'מדינה יהודית ודמוקרטית', 'חופש לכל אחד'], groups: ['religious', 'haredim', 'secular', 'liberals'] },
  { id: 'change', name: 'שינוי', icon: '🔄', desc: 'החלפת השלטון וטיהור המערכת. חזק כשהממשלה לא פופולרית.', slogans: ['הגיע הזמן לשינוי', 'מתחילים מחדש', 'ממשלה חדשה, דרך חדשה'], groups: ['center', 'liberals', 'youth', 'secular'] },
  { id: 'stability', name: 'יציבות וניסיון', icon: '🏛️', desc: 'ניסיון, אחריות ויציבות שלטונית. חזק כשהממשלה מתפקדת והציבור מרוצה.', slogans: ['ניסיון שאפשר לסמוך עליו', 'להמשיך לבנות', 'יציבות בזמנים לא יציבים'], groups: ['elderly', 'retirees', 'middleClass', 'right'] },
];
export const STRATEGY_BY_ID = Object.fromEntries(STRATEGIES.map((x) => [x.id, x])) as Record<CampaignState['strategy'], StrategyDef>;

export const BUDGETS: Record<CampaignState['budget'], { name: string; cost: number; boost: number }> = {
  low: { name: 'צנוע', cost: 3, boost: 1 },
  mid: { name: 'בינוני', cost: 8, boost: 3 },
  high: { name: 'גבוה', cost: 15, boost: 5 },
};

/** How much each issue matters right now (0..1.5), from the actual state of the country. */
export function issueSalience(s: GameState): Record<CampaignState['strategy'], number> {
  const inGov = s.government.coalition.includes(s.player.partyId);
  const securityCrisis = s.crises.some((c) => ['war', 'border', 'cyber'].includes(c.defId));
  return {
    security: clamp((60 - s.services.security.quality) / 30 + (securityCrisis ? 0.6 : 0) + 0.75, 0, 1.5), // after two years of war, security stays high on the agenda
    economy: clamp((s.economy.inflation - 2) / 3 + (s.economy.unemployment - 4) / 4 + (s.services.housing.satisfaction < 40 ? 0.4 : 0) + 0.2, 0, 1.5),
    social: clamp((55 - (s.services.health.quality + s.services.education.quality + s.services.welfare.quality) / 3) / 20 + 0.3, 0, 1.5),
    identity: clamp((s.activeLaws.includes('draft_equality') || s.activeLaws.includes('draft_exemption') ? 0.3 : 0.25) + (s.crises.some((c) => c.defId === 'draft_riots') ? 0.5 : 0) + 0.5, 0, 1.5), // the draft question is open
    change: clamp((inGov ? -0.6 : 0.2) + (50 - s.government.approval) / 25 + 0.3, 0, 1.5),
    stability: clamp((inGov ? 0.4 : -0.6) + (s.government.approval - 40) / 25 + (deficitPct(s) < 4 ? 0.2 : 0), 0, 1.5),
  };
}

/** The campaign the player still has to open (party leaders, inside the campaign window). */
export function needsCampaignStart(s: GameState): boolean {
  if (!inCampaign(s) || !isPartyLeader(s) || s.gameOver || s.elections.phase !== 'none') return false;
  return s.campaign?.electionDay !== dayNumber(electionDate(s));
}

export function startCampaign(s: GameState, strategy: CampaignState['strategy'], targets: GroupId[], budget: CampaignState['budget'], slogan: string): void {
  const party = s.parties[s.player.partyId];
  const b = BUDGETS[budget];
  const cost = Math.min(b.cost, Math.max(0, party.funds));
  party.funds -= cost;
  party.slogan = slogan;
  s.campaign = { electionDay: dayNumber(electionDate(s)), strategy, targets: targets.slice(0, 2), budget, slogan, negativeHits: 0 };
  for (const g of s.campaign.targets) party.affinity[g] = (party.affinity[g] ?? 0) + 0.25;
  s.elections.campaignBoost[party.id] = (s.elections.campaignBoost[party.id] ?? 0) + b.boost * (cost / b.cost);
  const st = STRATEGY_BY_ID[strategy];
  addNews(s, `${party.name} פותחת בקמפיין: "${slogan}"`, 'neutral', st.icon);
  logEvent(s, st.icon, `פתחת בקמפיין (${st.name}; יעד: ${s.campaign.targets.map((g) => GROUP_BY_ID[g].name).join(', ')})`, 2, 'neutral', 'campaign');
}

/** Each campaign turn: the chosen strategy pays off according to how salient its issue is. */
export function campaignTick(s: GameState): void {
  const c = s.campaign;
  if (!c || c.electionDay !== dayNumber(electionDate(s)) || !inCampaign(s)) return;
  const sal = issueSalience(s)[c.strategy];
  const add = 0.4 + sal * 0.9 + BUDGETS[c.budget].boost * 0.1;
  s.elections.campaignBoost[s.player.partyId] = (s.elections.campaignBoost[s.player.partyId] ?? 0) + add;
}
