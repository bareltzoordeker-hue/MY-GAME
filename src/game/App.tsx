import { lazy, Suspense, useEffect, useState } from 'react';
import { useGame } from './store/gameStore';
import { Layout } from './components/Layout';
import { MainMenu, NewGame } from './screens/Menu';
import { Dashboard } from './screens/Dashboard';
import { StateScreen, PopulationScreen, MapScreen } from './screens/State';
import { MinistryScreen } from './screens/Ministry';
import { NewsScreen, ProjectsScreen, CrisesScreen, AdvisorScreen, CareerScreen, SaveScreen, DebugPanel } from './screens/Other';
import { BriefingModal, ConfirmModal, ExplainModal, GameOverScreen, MeetingModal, ReactionModal } from './components/Modals';
import { CoalitionModal } from './screens/Coalition';
import { Tutorial } from './components/Tutorial';
import { DramaModal, SoundManager } from './components/Drama';
import { AdvisorFab, FocusManager, TipLayer } from './components/Overlay';

// The chart screens pull in Recharts (~⅓ of the bundle), so they load as a separate chunk,
// prefetched in the background as soon as a game is running.
const loadEconomy = () => import('./screens/Economy');
const loadPolitics = () => import('./screens/Politics');
const EconomyScreen = lazy(() => loadEconomy().then((m) => ({ default: m.EconomyScreen })));
const BudgetScreen = lazy(() => loadEconomy().then((m) => ({ default: m.BudgetScreen })));
const GovernmentScreen = lazy(() => loadPolitics().then((m) => ({ default: m.GovernmentScreen })));
const ParliamentScreen = lazy(() => loadPolitics().then((m) => ({ default: m.ParliamentScreen })));
const LawsScreen = lazy(() => loadPolitics().then((m) => ({ default: m.LawsScreen })));
const PartyScreen = lazy(() => loadPolitics().then((m) => ({ default: m.PartyScreen })));
const PollsScreen = lazy(() => loadPolitics().then((m) => ({ default: m.PollsScreen })));

export default function App() {
  const game = useGame((s) => s.game);
  const screen = useGame((s) => s.screen);
  const [creating, setCreating] = useState(false);
  const running = !!game;
  useEffect(() => { if (running) { loadEconomy(); loadPolitics(); } }, [running]);

  if (!game) {
    return <><SoundManager /><TipLayer />{creating ? <NewGame onBack={() => setCreating(false)} /> : <MainMenu onNew={() => setCreating(true)} />}</>;
  }
  if (game.gameOver) return <><SoundManager /><GameOverScreen /></>;

  const screens = {
    dashboard: <Dashboard />, state: <StateScreen />, economy: <EconomyScreen />, budget: <BudgetScreen />, population: <PopulationScreen />,
    parliament: <ParliamentScreen />, government: <GovernmentScreen />, party: <PartyScreen />, ministry: <MinistryScreen />, news: <NewsScreen />,
    polls: <PollsScreen />, projects: <ProjectsScreen />, laws: <LawsScreen />, crises: <CrisesScreen />, map: <MapScreen />, advisor: <AdvisorScreen />,
    career: <CareerScreen />, save: <SaveScreen />,
  } as const;

  return (
    <>
      <SoundManager />
      <Layout>
        <Suspense fallback={<div className="muted p-6">טוען…</div>}>
          <div key={screen} className="rise">{screens[screen]}</div>
        </Suspense>
      </Layout>
      <CoalitionModal />
      <Tutorial />
      <DramaModal />
      <MeetingModal />
      <BriefingModal />
      <ReactionModal />
      <ExplainModal />
      <ConfirmModal />
      <AdvisorFab />
      <FocusManager />
      <TipLayer />
      {import.meta.env.DEV && <DebugPanel />}
    </>
  );
}
