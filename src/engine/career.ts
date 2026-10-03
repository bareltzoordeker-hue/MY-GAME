import type { GameOverInfo, GameState, Role } from '../types/game';
import { N } from './ai/narrative';
import { roleLabel } from './newGame';
import { logEvent } from './effects';

export function setRole(s: GameState, role: Role, note?: string): void {
  if (s.player.role === role && !note) return;
  s.player.role = role;
  const label = roleLabel(s);
  s.career.roleHistory.push({ turn: s.turn, role, label });
  if (note) s.career.memorable.push(note);
  logEvent(s, '🎖️', `תפקיד חדש: ${label}`, 3, 'good', 'career');
}

/** Re-derive the player's role from the political facts. */
export function syncRole(s: GameState): void {
  const me = s.politicians[s.player.politicianId];
  const leader = s.parties[s.player.partyId]?.leaderId === me.id;
  const inGov = s.government.coalition.includes(s.player.partyId);
  let role: Role;
  if (s.government.pmId === me.id) role = 'pm';
  else if (me.ministryId && inGov) role = 'minister';
  else if (leader && !inGov) role = 'candidate';
  else role = 'mk';
  if (role !== s.player.role) setRole(s, role);
}

export function updateCareer(s: GameState): void {
  s.career.turnsInRole[s.player.role] += 1;
  const a = s.career.achievements;
  const add = (cond: boolean, text: string) => { if (cond && !a.includes(text)) a.push(text); };
  add(s.career.turnsInRole.pm >= 24, 'קדנציה מלאה כראש ממשלה');
  add(s.career.turnsInRole.minister >= 12, 'שנתיים רצופות בממשלה');
  add(s.economy.growth > 4.5, 'צמיחה של מעל 4.5%');
  add(s.economy.unemployment < 3.5, 'אבטלה של פחות מ-3.5%');
  add(s.economy.deficit < 0, 'עודף תקציבי (!)');
  add(s.government.approval > 62 && s.player.role === 'pm', 'שביעות רצון מעל 62%');
  add(s.career.lawsPassed >= 5, 'מחוקק סדרתי: 5 חוקים');
  add(s.politicians[s.player.politicianId].popularity > 65, 'הפוליטיקאי הפופולרי במדינה');
}

export function setGameOver(s: GameState, reason: GameOverInfo['reason'], title: string, text?: string): void {
  if (s.gameOver) return;
  s.gameOver = { reason, title, text: text ?? N.epitaph(s, reason), turn: s.turn };
}

export function evaluateGameOver(s: GameState): void {
  if (s.gameOver) return;
  if (s.flags.expel) {
    setGameOver(s, 'expelled', 'הודחת מהמפלגה');
    return;
  }
  if (s.player.role === 'pm' && s.government.lowApprovalTurns >= 3) {
    setGameOver(s, 'ousted', 'המחאה הגדולה הפילה אותך');
    return;
  }
  const me = s.politicians[s.player.politicianId];
  if (me.popularity < 3 && s.player.reputation < 10) {
    setGameOver(s, 'ousted', 'נעלמת מהתודעה הציבורית');
  }
}
