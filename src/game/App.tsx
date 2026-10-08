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
import { useLang } from './useLang';
import { SpeechModal } from './components/SpeechModal';
import { CampaignStartModal, ElectionNightModal } from './screens/Campaign';
import { Tutorial } from './components/Tutorial';
import { DramaModal, SoundManager } from './components/Drama';
import { AdvisorFab, FocusManager, TipLayer } from './components/Overlay';
import { Disclaimer } from './components/Disclaimer';

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
const ChatScreen = lazy(() => import('./screens/Chat').then((m) => ({ default: m.ChatScreen })));
const SecurityScreen = lazy(() => import('./screens/Security').then((m) => ({ default: m.SecurityScreen })));
const PromisesScreen = lazy(() => import('./screens/Promises').then((m) => ({ default: m.PromisesScreen })));
const RelationsScreen = lazy(() => import('./screens/Relations').then((m) => ({ default: m.RelationsScreen })));

export default function App() {
  useLang(); // re-render everything when the interface language changes
  const game = useGame((s) => s.game);
  const screen = useGame((s) => s.screen);
  const [creating, setCreating] = useState(false);
  const running = !!game;
  useEffect(() => { if (running) { loadEconomy(); loadPolitics(); } }, [running]);

  if (!game) {
    return <><SoundManager /><TipLayer /><Disclaimer />{creating ? <NewGame onBack={() => setCreating(false)} /> : <MainMenu onNew={() => setCreating(true)} />}</>;
  }
  if (game.gameOver) return <><SoundManager /><GameOverScreen /></>;

  const screens = {
    dashboard: <Dashboard />, state: <StateScreen />, economy: <EconomyScreen />, budget: <BudgetScreen />, population: <PopulationScreen />,
    parliament: <ParliamentScreen />, government: <GovernmentScreen />, party: <PartyScreen />, ministry: <MinistryScreen />, news: <NewsScreen />,
    polls: <PollsScreen />, projects: <ProjectsScreen />, laws: <LawsScreen />, crises: <CrisesScreen />, map: <MapScreen />, advisor: <AdvisorScreen />,
    career: <CareerScreen />, save: <SaveScreen />, relations: <RelationsScreen />, security: <SecurityScreen />, chat: <ChatScreen />, promises: <PromisesScreen />,
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
      <CampaignStartModal />
      <ElectionNightModal />
      <ReactionModal />
      <ExplainModal />
      <SpeechModal />
      <ConfirmModal />
      <AdvisorFab />
      <FocusManager />
      <TipLayer />
      {import.meta.env.DEV && <DebugPanel />}
    </>
  );
}
