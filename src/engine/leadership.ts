// The race for the leadership of the player's party: declare, campaign inside the party for a few turns, then the vote.
import type { GameState, Politician } from '../types/game';
import { clamp } from '../utils';
import { addNews, logEvent, remember } from './effects';
import { syncRole } from './career';
import { getMinistry } from './government';
import { rand } from './rng';

export const RACE_TURNS = 3;
export type RaceMove = 'rally' | 'endorse' | 'deal' | 'attack';

export const RACE_MOVES: Record<RaceMove, { label: string; icon: string; capital: number; desc: string }> = {
  rally: { label: 'כנס חברי מפלגה', icon: '📢', capital: 4, desc: 'כנס עם פעילי המפלגה. מעלה את התמיכה בך, יותר אם אתה פופולרי.' },
  endorse: { label: 'לגייס תמיכה של ח״כ', icon: '🤝', capital: 3, desc: 'פנייה לחבר מפלגה בולט. מצליח לפי הכוח שלו והיחסים איתך.' },
  deal: { label: 'עסקה עם תומכים', icon: '📜', capital: 6, desc: 'הבטחת תפקידים אחרי הניצחון. מעלה את התמיכה מהר, אבל פוגעת קצת במוניטין.' },
  attack: { label: 'להתקיף את המנהיג', icon: '🗡️', capital: 3, desc: 'מוריד את התמיכה במנהיג, אבל עלול להיות בומרנג על המוניטין שלך.' },
};

const me = (s: GameState): Politician => s.politicians[s.player.politicianId];

/** Members of the player's party who can back the player or the leader. */
export function raceMembers(s: GameState): Politician[] {
  const party = s.parties[s.player.partyId];
  return party.memberIds.map((id) => s.politicians[id]).filter((p) => p && p.active && !p.isPlayer && p.id !== party.leaderId && p.inKnesset).sort((a, b) => b.power - a.power);
}

/** Starts the race. Returns false when it cannot start. */
export function startRace(s: GameState): boolean {
  const party = s.parties[s.player.partyId];
  const leader = s.politicians[party.leaderId];
  const pl = me(s);
  if (!leader || s.leadershipRace) return false;
  const members = raceMembers(s);
  const support = members.reduce((a, m) => a + m.loyalty, 0) / Math.max(1, members.length);
  s.leadershipRace = {
    incumbentId: leader.id, partyId: party.id, startTurn: s.turn, endTurn: s.turn + RACE_TURNS,
    mine: clamp(20 + pl.power * 0.35 + pl.popularity * 0.25 + (support - 40) * 0.3),
    theirs: clamp(30 + leader.power * 0.35 + leader.popularity * 0.25),
    used: {}, backers: [],
  };
  remember(s, leader.id, 'insult', 'הכריז על התמודדות נגדי', -10);
  addNews(s, `${pl.name} הכריז על התמודדות על ראשות ${party.name} מול ${leader.name}`, 'neutral', '⚔️');
  logEvent(s, '⚔️', `פתחת במירוץ על ראשות ${party.name}`, 3, 'neutral', 'career');
  return true;
}

/** One campaign move inside the race. Returns a short result text, or null when it is not possible. */
export function raceMove(s: GameState, kind: RaceMove, targetId?: string): { text: string; ok: boolean } | null {
  const r = s.leadershipRace;
  if (!r || r.partyId !== s.player.partyId) return null;
  if ((r.used[kind === 'endorse' ? `endorse_${targetId}` : kind] ?? -1) >= s.turn) return null;
  const pl = me(s);
  r.used[kind === 'endorse' ? `endorse_${targetId}` : kind] = s.turn;
  if (kind === 'rally') {
    const gain = 6 + pl.popularity / 25;
    r.mine = clamp(r.mine + gain);
    return { ok: true, text: `הכנס עבר טוב: התמיכה בך עלתה ב-${gain.toFixed(0)}.` };
  }
  if (kind === 'deal') {
    r.mine = clamp(r.mine + 10);
    s.player.reputation = clamp(s.player.reputation - 1);
    return { ok: true, text: 'הבטחת תפקידים לתומכים. התמיכה בך עלתה ב-10, והמוניטין ירד מעט.' };
  }
  if (kind === 'attack') {
    const backfire = rand(s) < 0.3;
    if (backfire) { r.mine = clamp(r.mine - 3); s.player.reputation = clamp(s.player.reputation - 2); return { ok: false, text: 'ההתקפה חזרה אליך כבומרנג: התמיכה בך ירדה והמוניטין נפגע.' }; }
    r.theirs = clamp(r.theirs - 6);
    return { ok: true, text: 'ההתקפה פגעה: התמיכה במנהיג ירדה ב-6.' };
  }
  const t = targetId ? s.politicians[targetId] : undefined;
  if (!t || r.backers.includes(t.id)) return null;
  const p = clamp(0.3 + (t.relationships[pl.id] ?? 0) / 150 + (t.loyalty - 50) / 150 + (pl.power - 40) / 200, 0.1, 0.9);
  if (rand(s) < p) {
    const gain = Math.min(12, 3 + t.power / 8);
    r.mine = clamp(r.mine + gain);
    r.backers.push(t.id);
    remember(s, t.id, 'favor', 'תמך בי במירוץ על ראשות המפלגה', 4);
    return { ok: true, text: `${t.name} הצטרף לתומכים שלך (+${gain.toFixed(0)}).` };
  }
  return { ok: false, text: `${t.name} סירב לתמוך בך כרגע.` };
}

/** Called every turn: the incumbent campaigns too, and on the last turn the party votes. */
export function resolveLeadershipRace(s: GameState): void {
  const r = s.leadershipRace;
  if (!r) return;
  const party = s.parties[r.partyId];
  const leader = s.politicians[r.incumbentId];
  const pl = me(s);
  // the race ends by itself if something changed: the player moved, became the leader, or the incumbent is gone
  if (!party || !leader || party.id !== s.player.partyId || party.leaderId !== r.incumbentId) { s.leadershipRace = undefined; return; }
  if (s.turn < r.endTurn) { r.theirs = clamp(r.theirs + 2 + rand(s) * 3); return; }
  const pWin = clamp(0.5 + (r.mine - r.theirs) / 40, 0.05, 0.95);
  s.leadershipRace = undefined;
  if (rand(s) < pWin) {
    party.leaderId = pl.id;
    remember(s, leader.id, 'betrayal', 'הדיח אותי מראשות המפלגה', -40);
    pl.power = clamp(pl.power + 15);
    s.player.listRank = 1;
    s.career.memorable.push(`ניצח בפריימריז ב${party.name}`);
    addNews(s, `${pl.name} ניצח את ${leader.name} בבחירות לראשות ${party.name}`, 'good', '👑');
    if (s.government.pmId === leader.id) {
      s.government.pmId = pl.id;
      if (pl.ministryId) { const m = getMinistry(s, pl.ministryId); if (m) m.ministerId = pl.id; }
      for (const m of s.government.ministries) if (m.ministerId === leader.id) m.ministerId = pl.id;
      s.career.governmentsFormed += 1;
    }
    syncRole(s);
    logEvent(s, '👑', `ניצחת בבחירות לראשות ${party.name} (${Math.round(pWin * 100)}% סיכוי)`, 3, 'good', 'career');
    return;
  }
  remember(s, leader.id, 'betrayal', 'ניסה להדיח אותי', -35);
  pl.power = clamp(pl.power - 15);
  s.flags.failed_primaries = s.turn;
  addNews(s, `${pl.name} הפסיד בבחירות לראשות ${party.name}`, 'bad', '🗳️');
  s.career.failures.push(`הפסיד בפריימריז ב${party.name}`);
  logEvent(s, '🗳️', `הפסדת בבחירות לראשות ${party.name} (סיכוי ניצחון ${Math.round(pWin * 100)}%)`, 3, 'bad', 'career');
}

/** Why a campaign move cannot be made right now, or null. */
export function raceMoveBlocked(s: GameState, kind: RaceMove, targetId?: string): string | null {
  const r = s.leadershipRace;
  if (!r) return 'אין מירוץ פעיל';
  const key = kind === 'endorse' ? `endorse_${targetId}` : kind;
  if (kind === 'endorse' && (!targetId || !s.politicians[targetId])) return 'בחר חבר מפלגה';
  if (kind === 'endorse' && r.backers.includes(targetId!)) return 'הוא כבר תומך בך';
  if ((r.used[key] ?? -1) >= s.turn) return 'כבר עשית את זה בתור הזה';
  return null;
}
