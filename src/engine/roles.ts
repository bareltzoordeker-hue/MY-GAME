import type { GameState, Role } from '../types/game';

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
export const turnsToElection = (s: GameState) => s.elections.scheduledTurn - s.turn;
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
  housing: ['housing'], welfare: ['welfare'], interior: ['management', 'housing'], police: ['law'], justice: ['law'], energy: ['energy'],
  infrastructure: ['infrastructure', 'housing'], agriculture: ['agriculture'], science: ['economy', 'management'], culture: ['culture'],
  foreign: ['foreign', 'defense'], strategic: ['management'],
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
