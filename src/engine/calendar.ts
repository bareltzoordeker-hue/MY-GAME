// ============================================================
// Calendar: real dates instead of fixed-length turns.
// - normal turn = 4 months
// - the last 4 months before an election ("campaign") = 8 turns of 2 weeks
// - elections happen on a date (27.10.2026, then every 4 years or early)
// The continuous simulation (economy, services, population…) still runs in
// 2-month steps; see stepsForTurn().
// ============================================================
import { CAMPAIGN_TURN_DAYS, TURN_MONTHS } from '../data/world';
import type { GameDate, GameState } from '../types/game';

export const CAMPAIGN_TURNS = 8;
export const CAMPAIGN_DAYS = CAMPAIGN_TURNS * CAMPAIGN_TURN_DAYS; // 112 days ≈ 4 months
const DAY = 86_400_000;

export const MONTHS_HE = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export const dayNumber = (d: GameDate) => Math.round(Date.UTC(d.year, d.month - 1, d.day ?? 1) / DAY);
export function fromDayNumber(n: number): GameDate {
  const t = new Date(n * DAY);
  return { year: t.getUTCFullYear(), month: t.getUTCMonth() + 1, day: t.getUTCDate() };
}
export const addDays = (d: GameDate, days: number) => fromDayNumber(dayNumber(d) + days);
export function addMonths(d: GameDate, months: number): GameDate {
  const m = d.month - 1 + months;
  return { year: d.year + Math.floor(m / 12), month: (m % 12) + 1, day: d.day ?? 1 };
}
export const daysBetween = (a: GameDate, b: GameDate) => dayNumber(b) - dayNumber(a);

export const electionDate = (s: GameState): GameDate => s.elections.date ?? addMonths(s.date, 48);
export const campaignStart = (s: GameState): GameDate => addDays(electionDate(s), -CAMPAIGN_DAYS);

/** Inside the final 4 months before the election (2-week turns). */
export function inCampaign(s: GameState): boolean {
  if (s.elections.phase !== 'none') return false;
  return dayNumber(s.date) >= dayNumber(campaignStart(s)) && dayNumber(s.date) < dayNumber(electionDate(s));
}

/** The date the next turn lands on. Never jumps over the campaign start or the election day. */
export function nextTurnDate(s: GameState): GameDate {
  const now = dayNumber(s.date);
  const elect = dayNumber(electionDate(s));
  const camp = dayNumber(campaignStart(s));
  if (inCampaign(s)) return fromDayNumber(Math.min(now + CAMPAIGN_TURN_DAYS, elect));
  const normal = dayNumber(addMonths(s.date, TURN_MONTHS));
  if (camp > now && normal >= camp) return fromDayNumber(camp);
  return fromDayNumber(Math.min(normal, elect));
}

/** How many continuous 2-month simulation steps a turn of this length is worth (fractional in a campaign). */
export const stepsForDays = (days: number) => days / 61;

/** Turns left until election day (exact, walks the calendar). */
export function turnsUntilElection(s: GameState): number {
  const probe = { ...s, date: { ...s.date }, elections: { ...s.elections } } as GameState;
  const elect = dayNumber(electionDate(s));
  let n = 0;
  while (dayNumber(probe.date) < elect && n < 60) {
    probe.date = nextTurnDate(probe);
    n += 1;
  }
  return n;
}

export const monthsUntilElection = (s: GameState) => Math.max(0, Math.round(daysBetween(s.date, electionDate(s)) / 30.4));

/** "8 בספטמבר 2026" in a campaign, "ספטמבר 2026" otherwise. */
export function dateLabel(d: GameDate, withDay = false): string {
  return withDay && d.day ? `${d.day} ב${MONTHS_HE[d.month - 1]} ${d.year}` : `${MONTHS_HE[d.month - 1]} ${d.year}`;
}

/** Human length of a span of days ("שבועיים", "4 חודשים", "שנה ו-4 חודשים"). */
export function spanText(days: number): string {
  if (days < 25) return days <= 15 ? 'שבועיים' : `${Math.round(days / 7)} שבועות`;
  const months = Math.round(days / 30.4);
  if (months < 12) return months === 1 ? 'חודש' : `${months} חודשים`;
  const y = Math.floor(months / 12);
  const r = months % 12;
  return r ? `${y === 1 ? 'שנה' : `${y} שנים`} ו-${r === 1 ? 'חודש' : `${r} חודשים`}` : y === 1 ? 'שנה' : `${y} שנים`;
}

/** Short time-to-election label: "3 שבועות", "5 חודשים", "שנה ו-2 חודשים", or "היום". */
export function electionCountdown(s: GameState): string {
  const d = daysBetween(s.date, electionDate(s));
  return d <= 0 ? 'היום' : spanText(d);
}
