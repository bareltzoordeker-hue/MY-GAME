import type { GameState } from '../types/game';
import { debtPct, deficitPct } from '../utils';
import { playerApproval } from './polls';
import { servicesAverage } from './services';

export function pushHistory(s: GameState): void {
  const e = s.economy;
  s.history.push({
    turn: s.turn, date: { ...s.date }, gdp: e.gdp, growth: e.growth, unemployment: e.unemployment, inflation: e.inflation,
    deficitPct: deficitPct(s), debtPct: debtPct(s), approval: s.government.approval,
    playerApproval: playerApproval(s), servicesAvg: servicesAverage(s),
  });
  if (s.history.length > 120) s.history.shift();
}
