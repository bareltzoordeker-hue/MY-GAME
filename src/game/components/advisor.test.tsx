// @vitest-environment happy-dom
import { act, type ComponentType } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { useGame, type ScreenId } from '../store/gameStore';
import { createGame } from '../../engine/newGame';
import { screenAdvice, suggestNextMove, type AdviceTip } from '../../engine/advisorPlus';
import { PARTIES } from '../../data/parties';
import type { Role } from '../../types/game';
import { Dashboard } from '../screens/Dashboard';
import { EconomyScreen, BudgetScreen } from '../screens/Economy';
import { StateScreen, PopulationScreen, MapScreen } from '../screens/State';
import { GovernmentScreen, ParliamentScreen, LawsScreen, PartyScreen, PollsScreen } from '../screens/Politics';
import { MinistryScreen } from '../screens/Ministry';
import { NewsScreen, ProjectsScreen, CrisesScreen, CareerScreen } from '../screens/Other';
import { describeTip } from './Overlay';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const SCREENS: Partial<Record<ScreenId, ComponentType>> = {
  dashboard: Dashboard, economy: EconomyScreen, budget: BudgetScreen, state: StateScreen, population: PopulationScreen, map: MapScreen,
  government: GovernmentScreen, parliament: ParliamentScreen, laws: LawsScreen, party: PartyScreen, polls: PollsScreen,
  ministry: MinistryScreen, news: NewsScreen, projects: ProjectsScreen, crises: CrisesScreen, career: CareerScreen,
};

/** Renders a screen the way the advisor opens it (with its focus key set, so collapsed cards open) and returns every data-focus key on it. */
function focusKeysOn(screen: ScreenId, focus: string): string[] {
  const Screen = SCREENS[screen];
  if (!Screen) return [];
  act(() => useGame.setState({ screen, focusKey: focus }));
  const el = document.createElement('div');
  const root = createRoot(el);
  act(() => { root.render(<Screen />); });
  const keys = [...el.querySelectorAll('[data-focus]')].map((n) => n.getAttribute('data-focus')!);
  act(() => root.unmount());
  return keys;
}

const ROLES: { role: Role; partyId: string; ministryId?: string }[] = [
  { role: 'pm', partyId: PARTIES.find((p) => p.coalition)!.id },
  { role: 'minister', partyId: PARTIES.find((p) => p.coalition)!.id, ministryId: 'transport' },
  { role: 'mk', partyId: PARTIES.find((p) => p.coalition)!.id },
  { role: 'candidate', partyId: PARTIES.find((p) => !p.coalition)!.id },
];

describe('advisor buttons', () => {
  for (const cfg of ROLES) for (const seed of [3, 11]) {
    it(`every advice target exists on its screen (${cfg.role}, seed ${seed})`, () => {
      const s = createGame({ playerName: 'בודק', gender: 'm', difficulty: 'normal', seed, ...cfg });
      act(() => useGame.setState({ game: s, screen: 'dashboard', ministryView: null }));
      const tips: AdviceTip[] = [];
      for (const scr of Object.keys(SCREENS)) tips.push(...screenAdvice(s, scr));
      tips.push(suggestNextMove(s));
      const problems: string[] = [];
      for (const t of tips) {
        if (!t.screen) continue;
        if (!SCREENS[t.screen as ScreenId] && t.screen !== 'advisor') problems.push(`unknown screen "${t.screen}" for: ${t.text}`);
        const d = describeTip(s, t);
        expect(d.label.length, `empty label for: ${t.text}`).toBeGreaterThan(2);
        expect(d.label, `generic label for: ${t.text}`).not.toContain('קבל החלטה');
        if (!t.focus) continue;
        const keys = focusKeysOn(t.screen as ScreenId, t.focus);
        if (!keys.some((k) => k === t.focus || k.startsWith(`${t.focus}:`))) problems.push(`"${t.focus}" not on ${t.screen} – ${t.text}`);
      }
      expect(problems).toEqual([]);
    });
  }
});
