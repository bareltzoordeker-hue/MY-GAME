import type { GameState, Role } from '../types/game';
import { turnsUntilElection } from './calendar';

export interface RoleCapabilities {
  canManageGovernment: boolean;
  canManageMinistry: boolean;
  canProposeLaw: boolean;
  canCallGovernmentMeeting: boolean;
  canManageParty: boolean;
  canRunForPartyLeadership: boolean;
  canManageBudget: boolean;
  canSetTaxes: boolean;
  canCampaign: boolean;
  canMakePromises: boolean;
  canStartProjects: boolean;
}

export const isPartyLeader = (s: GameState) => s.parties[s.player.partyId]?.leaderId === s.player.politicianId;
export const isPM = (s: GameState) => s.government.pmId === s.player.politicianId;
export const inCoalition = (s: GameState) => s.government.coalition.includes(s.player.partyId);
/** Turns left until election day (calendar-based: 4-month turns, 2-week turns in the campaign). */
export const turnsToElection = (s: GameState) => turnsUntilElection(s);
export const playerMinistry = (s: GameState) =>
  s.government.ministries.find((m) => m.ministerId === s.player.politicianId && m.id === s.politicians[s.player.politicianId]?.ministryId) ??
  s.government.ministries.find((m) => m.ministerId === s.player.politicianId);

export function getCapabilities(s: GameState): RoleCapabilities {
  const role: Role = s.player.role;
  const leader = isPartyLeader(s);
  const pm = role === 'pm';
  return {
    canManageGovernment: pm,
    canManageMinistry: role === 'minister' && !!playerMinistry(s),
    canProposeLaw: true,
    canCallGovernmentMeeting: pm,
    canManageParty: leader,
    canRunForPartyLeadership: !leader,
    canManageBudget: pm,
    canSetTaxes: pm,
    canCampaign: leader,
    canMakePromises: leader && turnsToElection(s) <= 6,
    canStartProjects: pm || role === 'minister',
  };
}

/** Law domains each ministry is responsible for (a minister proposes laws only in their own field). */
const MINISTRY_LAW_DOMAINS: Record<string, string[]> = {
  finance: ['economy'], economy: ['economy'], defense: ['defense'], education: ['education'], health: ['health'], transport: ['transport'],
  housing: ['housing'], welfare: ['welfare'], interior: ['management', 'housing'], national_security: ['law'], justice: ['law'],
  energy: ['energy', 'infrastructure'], agriculture: ['agriculture'], science: ['economy', 'management'], culture: ['culture'],
  foreign: ['foreign', 'defense'], intelligence: ['defense'], regional: ['foreign'], diaspora: ['foreign'], communications: ['media', 'management'],
  labor: ['welfare', 'economy'], tourism: ['economy'], environment: ['energy'], religious: ['management'], jerusalem: ['housing', 'management'],
  heritage: ['culture'], negev_galilee: ['infrastructure', 'housing'], aliyah: ['welfare'], settlement: ['housing', 'foreign'],
  social_equality: ['welfare'], strategic: ['foreign'], periphery: ['infrastructure'], cyber: ['defense', 'management'],
  public_diplomacy: ['foreign', 'media'], national_resilience: ['welfare', 'infrastructure'],
};
export function ministryLawDomains(s: GameState): string[] | null {
  if (s.player.role !== 'minister') return null; // PM: everything; MKs: private bills on anything
  const m = playerMinistry(s);
  if (!m) return [];
  return [...new Set((m.origins ?? [m.id]).flatMap((id) => MINISTRY_LAW_DOMAINS[id] ?? [m.domain]))];
}

export const ROLE_NAMES: Record<Role, string> = {
  pm: 'ראש ממשלה', candidate: 'מועמד לראשות הממשלה', minister: 'שר', mk: 'חבר כנסטון',
};
