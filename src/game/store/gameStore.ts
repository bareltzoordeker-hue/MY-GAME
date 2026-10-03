import { create } from 'zustand';
import type { GameState, Reaction } from '../../types/game';
import { clone } from '../../utils';
import { createGame, type NewGameConfig } from '../../engine/newGame';
import { advanceTurn, canAdvance } from '../../engine/turn';
import {
  actionNeedsMeeting, meetingStep, performAction, prepareMeeting, type Meeting, type MeetingChoice, type Params,
} from '../../engine/decisions';
import { resolveInbox } from '../../engine/inbox';
import { resolveCrisis, startCrisis } from '../../engine/crises';
import { abandonMandate, finalizeCoalition, negotiate } from '../../engine/elections';
import { deleteSave, loadGame, saveGame } from '../../engine/persistence/save';
import { CRISES } from '../../data/crises';
import { resolveDrama } from '../../engine/drama';
import { breakAlliance, proposeAlliance } from '../../engine/alliances';

export type ScreenId =
  | 'dashboard' | 'state' | 'economy' | 'budget' | 'population' | 'parliament' | 'government' | 'party' | 'ministry'
  | 'news' | 'polls' | 'projects' | 'laws' | 'crises' | 'map' | 'advisor' | 'career' | 'save';

interface Store {
  game: GameState | null;
  screen: ScreenId;
  reactions: Reaction[];
  meeting: Meeting | null;
  briefingOpen: boolean;
  saveStatus: 'idle' | 'saved' | 'failed';
  explainKey: string | null;
  confirm: { title: string; text: string; onYes: () => void } | null;
  debugOpen: boolean;
  ministryView: string | null;
  focusKey: string | null;
  goTo: (screen: ScreenId, focus?: string) => void;
  clearFocus: () => void;

  newGame: (cfg: NewGameConfig) => void;
  continueGame: () => boolean;
  quitToMenu: () => void;
  wipeSave: () => void;
  setScreen: (s: ScreenId) => void;
  setMinistryView: (id: string | null) => void;
  act: (id: string, params?: Params) => void;
  meetingChoice: (c: MeetingChoice) => void;
  answerInbox: (itemId: string, optionId: string) => void;
  answerDrama: (optionId: string) => void;
  makeAlliance: (partyId: string, kind: 'votes' | 'bloc') => void;
  endAlliance: (partyId: string) => void;
  handleCrisis: (crisisId: string, actionId: string) => void;
  negotiateWith: (partyId: string, action: 'accept' | 'counter' | 'refuse', drop?: number) => void;
  formCoalition: () => void;
  returnMandate: () => void;
  endTurn: () => void;
  dismissReaction: () => void;
  closeBriefing: () => void;
  explain: (k: string | null) => void;
  ask: (c: Store['confirm']) => void;
  toggleDebug: () => void;
  debugPatch: (fn: (s: GameState) => void) => void;
}

const persist = (g: GameState): 'saved' | 'failed' => (saveGame(g) ? 'saved' : 'failed');

export const useGame = create<Store>((set, get) => ({
  game: null,
  screen: 'dashboard',
  reactions: [],
  meeting: null,
  briefingOpen: false,
  saveStatus: 'idle',
  explainKey: null,
  confirm: null,
  debugOpen: false,
  ministryView: null,
  focusKey: null,
  goTo: (screen, focus) => { set({ screen, focusKey: focus ?? null }); window.scrollTo?.({ top: 0 }); },
  clearFocus: () => set({ focusKey: null }),

  newGame: (cfg) => {
    const g = createGame(cfg);
    set({ game: g, screen: 'dashboard', reactions: [], meeting: null, briefingOpen: true, saveStatus: persist(g), ministryView: null });
  },
  continueGame: () => {
    const g = loadGame();
    if (!g) return false;
    set({ game: g, screen: 'dashboard', reactions: [], meeting: null, briefingOpen: false, saveStatus: 'saved' });
    return true;
  },
  quitToMenu: () => set({ game: null, reactions: [], meeting: null, briefingOpen: false }),
  wipeSave: () => { deleteSave(); set({ saveStatus: 'idle' }); },
  setScreen: (screen) => { set({ screen }); window.scrollTo?.({ top: 0 }); },
  setMinistryView: (ministryView) => set({ ministryView }),

  act: (id, params = {}) => {
    const g = get().game;
    if (!g) return;
    if (actionNeedsMeeting(g, id, params)) {
      set({ meeting: prepareMeeting(g, id, params) });
      return;
    }
    const r = performAction(g, id, params);
    set((st) => ({ game: r.state, reactions: r.reaction ? [...st.reactions, r.reaction] : st.reactions }));
  },
  meetingChoice: (c) => {
    const { game, meeting } = get();
    if (!game || !meeting) return;
    const r = meetingStep(game, meeting, c);
    set((st) => ({
      game: r.result?.state ?? r.state,
      meeting: r.meeting,
      reactions: r.result?.reaction ? [...st.reactions, r.result.reaction] : st.reactions,
    }));
  },
  answerInbox: (itemId, optionId) => {
    const g = get().game;
    if (!g) return;
    const r = resolveInbox(g, itemId, optionId);
    set((st) => ({ game: r.state, reactions: r.reaction ? [...st.reactions, r.reaction] : st.reactions }));
  },
  answerDrama: (optionId) => {
    const g = get().game;
    if (!g) return;
    const r = resolveDrama(g, optionId);
    set((st) => ({ game: r.state, reactions: r.reaction ? [...st.reactions, r.reaction] : st.reactions }));
  },
  makeAlliance: (partyId, kind) => {
    const g = get().game;
    if (!g) return;
    const r = proposeAlliance(g, partyId, kind);
    set((st) => ({ game: r.state, reactions: [...st.reactions, r.reaction] }));
  },
  endAlliance: (partyId) => {
    const g = get().game;
    if (!g) return;
    const r = breakAlliance(g, partyId);
    set((st) => ({ game: r.state, reactions: [...st.reactions, r.reaction] }));
  },
  handleCrisis: (crisisId, actionId) => {
    const g = get().game;
    if (!g) return;
    const s = clone(g);
    const reaction = resolveCrisis(s, crisisId, actionId);
    set((st) => ({ game: s, reactions: reaction ? [...st.reactions, reaction] : st.reactions }));
  },
  negotiateWith: (partyId, action, drop = -1) => {
    const g = get().game;
    if (!g) return;
    const s = clone(g);
    const reaction = negotiate(s, partyId, action, drop);
    set((st) => ({ game: s, reactions: [...st.reactions, reaction] }));
  },
  formCoalition: () => {
    const g = get().game;
    if (!g) return;
    const s = clone(g);
    const reaction = finalizeCoalition(s);
    set((st) => ({ game: s, reactions: [...st.reactions, reaction], saveStatus: s.elections.phase === 'none' ? persist(s) : st.saveStatus }));
  },
  returnMandate: () => {
    const g = get().game;
    if (!g) return;
    const s = clone(g);
    abandonMandate(s);
    set({ game: s, saveStatus: persist(s) });
  },
  endTurn: () => {
    const g = get().game;
    if (!g || canAdvance(g)) return;
    const next = advanceTurn(g);
    // simulate → validate (inside advanceTurn) → save → show briefing. On failure the state stays in memory.
    set({ game: next, briefingOpen: true, saveStatus: persist(next), meeting: null });
  },
  dismissReaction: () => set((st) => ({ reactions: st.reactions.slice(1) })),
  closeBriefing: () => set({ briefingOpen: false }),
  explain: (explainKey) => set({ explainKey }),
  ask: (confirm) => set({ confirm }),
  toggleDebug: () => set((st) => ({ debugOpen: !st.debugOpen })),
  debugPatch: (fn) => {
    const g = get().game;
    if (!g) return;
    const s = clone(g);
    fn(s);
    set({ game: s });
  },
}));

export const debugActions = {
  triggerCrisis: (s: GameState) => { const d = CRISES[Math.floor(Math.random() * CRISES.length)]; startCrisis(s, d.id); },
};
