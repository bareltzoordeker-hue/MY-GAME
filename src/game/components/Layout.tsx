import { useState, type ReactNode } from 'react';
import { useGame, type ScreenId } from '../store/gameStore';
import { deadlinesFrozen, openPromises } from '../../engine/deadlines';
import { securityRole } from '../../engine/security';
import type { GameState } from '../../types/game';
import { dateLabel, deficitPct } from '../../utils';
import { roleLabel } from '../../engine/newGame';
import { canAdvance } from '../../engine/turn';
import { coalitionSeats } from '../../engine/polls';
import { getCapabilities } from '../../engine/roles';
import { daysBetween, electionCountdown, electionDate, monthsUntilElection, nextTurnDate, spanText } from '../../engine/calendar';
import { unreadTotal } from '../../engine/chat';
import { dateL, spanL, t } from '../../shared/i18n';
import type { Key } from '../../shared/i18n/dict';
import { Caricature } from '../../shared/components/Caricature';
import { setMusic, setSfx, soundPrefs } from '../audio/sound';
import { Explain } from './ui';
import { HowToPlayButton } from './HowToPlay';
import { openSpeech } from './SpeechModal';

interface NavItem { id: ScreenId; icon: string; label: string; tip?: string; show?: (s: GameState) => boolean; badge?: (s: GameState) => number }
export // the order the player asked for: overview, money, career, promises, then parliament and the ministry
const NAV: NavItem[] = [
  { id: 'dashboard', icon: '🏠', label: 'לוח בקרה', tip: 'מבט על: מצב המדינה, משברים, החלטות שמחכות לך וחדשות', badge: (s) => s.inbox.length },
  { id: 'state', icon: '🗺️', label: 'מצב המדינה', tip: 'איכות השירותים הציבוריים, מה גורם לה לעלות או לרדת ואילו בעיות פתוחות' },
  { id: 'budget', icon: '💰', label: 'תקציב', tip: 'חלוקת הכסף בין המשרדים. כל שינוי משפיע על השירותים, על הגירעון ועל הציבור' },
  { id: 'career', icon: '🎖️', label: 'קריירה', tip: 'איך להתקדם: ועדות, ראיונות, פריימריז, מעבר מפלגה או התפטרות' },
  { id: 'promises', icon: '📌', label: 'הבטחות', tip: 'כל ההבטחות שעוד לא קוימו: להסכם הקואליציוני, לפוליטיקאים ולציבור, עם המועד ועם כפתור לקיום מהיר', badge: (s) => openPromises(s).filter((p) => p.turnsLeft !== undefined && p.turnsLeft <= 1 && !deadlinesFrozen(s)).length },
  { id: 'parliament', icon: '🏟️', label: 'כנסטון', tip: '120 המושבים, הצעות חוק בדיון וצפי הצבעה' },
  { id: 'ministry', icon: '🏛️', label: 'המשרד שלי', tip: 'ניהול המשרד: תקציב, מדדים ייעודיים ופעולות שרק המשרד הזה יכול לעשות', show: (s) => getCapabilities(s).canManageMinistry || s.player.role === 'pm' },
  { id: 'laws', icon: '📜', label: 'חוקים', tip: 'הגשת חוקים חדשים וביטול חוקים קיימים' },
  { id: 'projects', icon: '🏗️', label: 'פרויקטים', tip: 'פרויקטים לאומיים: כבישים, רכבות, בתי חולים. לוקחים זמן ועולים כסף' },
  { id: 'security', icon: '🛡️', label: 'ביטחון ומדיניות', tip: 'חזיתות, כוחות צה״ל, מבצעים באישור הקבינט, ערוצי הידברות, הפסקות אש, שטחי A/B/C ויחסי חוץ' , show: (s) => securityRole(s) !== null },
  { id: 'government', icon: '🪑', label: 'ממשלה', tip: 'שרים, משרדים וקואליציה: מינויים, פיטורים, איחוד משרדים וכספים קואליציוניים' },
  { id: 'party', icon: '🎌', label: 'מפלגה ובריתות', tip: 'המפלגה שלך, הקמפיין, הבטחות בחירות ובריתות עם מפלגות אחרות' },
  { id: 'relations', icon: '🕸️', label: 'מפת יחסים', tip: 'היחסים בין המפלגות ובינך לבין חברי הכנסטון: פגישות, אירועים משותפים, תמיכה הדדית, הסכמי עודפים ואיחודים' },
  { id: 'chat', icon: '💬', label: 'שיחות', tip: 'כתיבה חופשית לשרים וליו״רי מפלגות: איומים, הבטחות, בקשות וחיזוק קשרים. חיפוש לפי שם', badge: (s) => unreadTotal(s) },
  { id: 'advisor', icon: '🧠', label: 'היועץ', tip: 'כל העצות של היועץ לפי סדר דחיפות' },
  { id: 'crises', icon: '🚨', label: 'משברים', tip: 'משברים פעילים ודרכי הטיפול בהם, ויומן האירועים', badge: (s) => s.crises.length },
  { id: 'polls', icon: '📊', label: 'סקרים', tip: 'מנדטים בסקר, מגמות ומי הכי כועס' },
  { id: 'economy', icon: '📈', label: 'כלכלה', tip: 'צמיחה, אבטלה, אינפלציה, חוב ומסים, כולל מה מניע כל מספר' },
  { id: 'map', icon: '📍', label: 'מפה', tip: 'מפת ישמעאל עם שכבות: אבטלה, הכנסה, השקעות, תשתיות ושביעות רצון לפי אזור' },
  { id: 'population', icon: '👥', label: 'אוכלוסייה', tip: '21 קבוצות אוכלוסייה: מי מרוצה, מי כועס ואיך זה משתנה' },
  { id: 'news', icon: '📰', label: 'חדשות', tip: 'כל הכותרות. רובן לא מחמיאות' },
  { id: 'save', icon: '💾', label: 'שמירה והגדרות', tip: 'שמירה, ייבוא וייצוא, הגדרות פרטיות ונגישות והפעלה מחדש של המדריך' },
];

function Sidebar({ onPick }: { onPick?: () => void }) {
  const s = useGame((x) => x.game)!;
  const screen = useGame((x) => x.screen);
  const setScreen = useGame((x) => x.setScreen);
  return (
    <nav className="grid grid-cols-2 gap-1 lg:flex lg:flex-col lg:gap-0.5 nav-grid">
      {NAV.filter((n) => !n.show || n.show(s)).map((n) => {
        const b = n.badge?.(s) ?? 0;
        return (
          <button key={n.id} data-tut={`nav-${n.id}`} data-tip={n.tip} className={`side-link ${screen === n.id ? 'side-link-active' : ''}`} onClick={() => { setScreen(n.id); onPick?.(); }}>
            <span className="text-base w-5 text-center">{n.icon}</span>
            <span className="flex-1">{t(`nav.${n.id}` as Key)}</span>
            {b > 0 && <span className="chip chip-bad num" style={{ padding: '0 7px' }}>{b}</span>}
          </button>
        );
      })}
      <HowToPlayButton inGame className="side-link mt-2" label="📖 איך משחקים?" onClosed={onPick} />
    </nav>
  );
}

function HeaderStat({ label, value, k, tone }: { label: string; value: ReactNode; k?: string; tone?: string }) {
  return (
    <div className="hidden sm:flex flex-col leading-tight px-3 border-l" style={{ borderColor: 'var(--line)' }}>
      <span className="text-[10px] muted flex items-center gap-1">{label}{k && <Explain k={k} />}</span>
      <span className={`font-black num text-sm ${tone ?? ''}`}>{value}</span>
    </div>
  );
}

export function Header({ onMenu }: { onMenu: () => void }) {
  const s = useGame((x) => x.game)!;
  const endTurn = useGame((x) => x.endTurn);
  const saveStatus = useGame((x) => x.saveStatus);
  const me = s.politicians[s.player.politicianId];
  const party = s.parties[s.player.partyId];
  const blocked = canAdvance(s);
  const seats = s.polls[s.polls.length - 1]?.seats[party.id] ?? party.seats;
  const def = deficitPct(s);
  const tte = monthsUntilElection(s);
  const next = nextTurnDate(s);
  const span = spanL(daysBetween(s.date, next)) || spanText(daysBetween(s.date, next));
  return (
    <header className="sticky top-0 z-30 border-b-4 masthead" style={{ borderColor: 'var(--ink)' }}>
      <div className="flex items-center gap-2 px-3 md:px-5 h-16">
        <button className="btn btn-sm lg:hidden menu-btn" onClick={onMenu} aria-label={t('hdr.menu')} data-tip="פתיחת התפריט: כל המסכים של המשחק">☰</button>
        <span className="logo hidden xl:inline-block ml-2">ממשלת ישמעאל</span>
        <div className="flex items-center gap-2 min-w-0">
          <Caricature spec={me.caricature} size={40} tie={party.color} />
          <div className="min-w-0 leading-tight">
            <div className="font-black text-sm truncate">{me.name}</div>
            <div className="text-[11px] truncate" style={{ color: 'var(--gold)' }}>{roleLabel(s)}</div>
          </div>
        </div>
        {/* Stats scroll inside their own strip on mid-size screens instead of widening the page. */}
        <div className="flex items-center mr-2 min-w-0 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          <HeaderStat label={t('hdr.date')} value={dateL(s.date) || dateLabel(s.date, true)} />
          <HeaderStat label={`${party.logo} ${party.shortName}`} value={`${seats} ${t('hdr.seats')}`} k="seats" />
          {s.player.role === 'pm' && <HeaderStat label={t('hdr.coalition')} value={coalitionSeats(s)} tone={coalitionSeats(s) < 61 ? 'bad' : ''} />}
          <HeaderStat label={t('hdr.approval')} value={`${s.government.approval.toFixed(0)}%`} k="approval" tone={s.government.approval < 35 ? 'bad' : ''} />
          <HeaderStat label={t('hdr.deficit')} value={`${def.toFixed(1)}%`} k="deficit" tone={def > 4.5 ? 'bad' : ''} />
          <HeaderStat label={t('hdr.capital')} value={`🎯 ${s.player.politicalCapital.toFixed(0)}`} k="capital" />
          <HeaderStat label={t('hdr.elections')} value={spanL(daysBetween(s.date, electionDate(s))) || electionCountdown(s)} tone={tte <= 4 ? 'warn' : ''} />
        </div>
        <div className="flex-1" />
        <span className={`${saveStatus === 'failed' ? 'inline bad font-bold cursor-pointer' : 'hidden md:inline muted'} text-[11px]`} role={saveStatus === 'failed' ? 'button' : undefined} onClick={saveStatus === 'failed' ? () => useGame.getState().goTo('save') : undefined} data-tip={saveStatus === 'failed' ? 'השמירה נכשלה: הדפדפן חוסם אחסון (גלישה פרטית?). לחץ לפרטים ולייצוא' : 'שמירה אוטומטית בסוף כל תור'}>
          {saveStatus === 'saved' ? `💾 ${t('hdr.saved')}` : saveStatus === 'failed' ? '⚠️ לא נשמר' : ''}
        </span>
        <button className="btn btn-sm" data-tut="speech" onClick={openSpeech} data-tip="כתיבת נאום ונשיאתו: בטלוויזיה, במליאה, בכנס או ברשתות" aria-label={t('hdr.speech')}>🎤<span className="hidden lg:inline"> {t('hdr.speech')}</span></button>
        <SoundToggles />
        <button className="btn btn-primary" data-tut="next-turn" onClick={endTurn} disabled={!!blocked} data-tip={blocked ?? `הזמן מתקדם ב${span} (עד ${dateLabel(next, true)}): הכלכלה, הציבור והפוליטיקאים מגיבים`}>
          <span className="hidden xl:inline">{t('hdr.next', { span })}</span><span className="xl:hidden">{span} ⏭</span> <span className="hidden xl:inline">⏭</span>
        </button>
      </div>
      <div className="ticker" aria-hidden><div>{[0, 1].map((k) => <span key={k}>{s.news.slice(0, 8).map((n) => `${n.icon} ${n.headline}`).join('   ✦   ')}</span>)}</div></div>
    </header>
  );
}

function SoundToggles() {
  const [p, setP] = useState(soundPrefs());
  return (
    <div className="flex gap-1">
      <button className="btn btn-sm" data-tip="אפקטים קוליים וקולות של פוליטיקאים: הפעלה או השתקה" aria-label="אפקטים קוליים" onClick={() => { setSfx(!p.sfx); setP(soundPrefs()); }}>{p.sfx ? '🔊' : '🔇'}</button>
      <button className="btn btn-sm" data-tip="מוזיקת רקע שקטה: הפעלה או השתקה" aria-label="מוזיקת רקע" onClick={() => { setMusic(!p.music); setP(soundPrefs()); }} style={p.music ? { background: 'var(--yellow)' } : undefined}>🎵</button>
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen">
      <a className="skip-link" href="#main">דלג לתוכן הראשי</a>
      <Header onMenu={() => setOpen(true)} />
      <div className="flex">
        <aside className="hidden lg:block w-56 shrink-0 p-3 sticky top-[5.6rem] self-start h-[calc(100vh-5.6rem)] overflow-y-auto border-l" style={{ borderColor: 'var(--line)' }}>
          <Sidebar />
        </aside>
        <main id="main" tabIndex={-1} className="flex-1 min-w-0 p-3 md:p-5 pb-24">{children}</main>
      </div>
      {open && (
        <div className="backdrop lg:hidden" style={{ alignItems: 'stretch', justifyContent: 'flex-start', padding: 0 }} onClick={() => setOpen(false)}>
          <div className="w-64 h-full p-3 overflow-y-auto" style={{ background: 'var(--panel)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2"><b>🪑 ממשלת ישמעאל</b><button className="btn btn-sm btn-ghost" onClick={() => setOpen(false)}>✕</button></div>
            <Sidebar onPick={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
