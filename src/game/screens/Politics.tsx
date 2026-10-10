import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, CartesianGrid } from 'recharts';
import { useGame } from '../store/gameStore';
import { LAWS, LAW_BY_ID } from '../../data/laws';
import { NEW_MINISTRY_TEMPLATES, DOMAIN_NAMES } from '../../data/ministries';
import { PROMISES } from '../../data/promises';
import { GROUP_BY_ID } from '../../data/world';
import { coalitionSeats } from '../../engine/polls';
import { ministerCandidates } from '../../engine/government';
import { computeVote, partyStance } from '../../engine/parliament';
import { getCapabilities, isPM, isSpeaker, lawAllowed } from '../../engine/roles';
import { playerListRank } from '../../engine/elections';
import { getProvider } from '../../engine/ai/provider';
import { buildCharacterContext } from '../../engine/ai/contextBuilder';
import type { GameState, Ideology, Politician } from '../../types/game';
import { Caricature } from '../../shared/components/Caricature';
import { AlliancesSection } from './Alliances';
import { DEMAND_ICON } from './Coalition';
import { CampaignPanel } from './Campaign';
import { dayNumber, spanText } from '../../engine/calendar';
import { ActionButton, Empty, Explain, Meter, PartyChip, PolName, ScreenHeader, Section, Tabs } from '../components/ui';

const tooltipStyle = { background: '#fff', border: '0', borderRadius: 12, fontSize: 12, color: '#1d1b3a', boxShadow: '0 10px 24px -10px rgba(60,40,160,.5)' };

export function PolCard({ p, s, extra }: { p: Politician; s: GameState; extra?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const focus = useGame((x) => x.focusKey);
  useEffect(() => { if (focus && focus.endsWith(p.id)) setOpen(true); }, [focus, p.id]);
  const say = getProvider().statement(buildCharacterContext(s, p, 'general'));
  return (
    <div className="inset">
      <div className="flex items-center justify-between gap-2" style={{ cursor: 'pointer' }} onClick={() => setOpen(!open)}>
        <PolName p={p} s={s} sub={`${s.parties[p.partyId]?.shortName} · ${DOMAIN_NAMES[p.mainDomain]} ${p.expertise[p.mainDomain] ?? ''}`} />
        <div className="flex gap-1 shrink-0">
          <span className="chip" data-tip="נאמנות אליך">❤️ {p.loyalty.toFixed(0)}</span>
          <span className="chip" data-tip="כוח פוליטי">💪 {p.power.toFixed(0)}</span>
        </div>
      </div>
      {open && (
        <div className="mt-2 text-xs space-y-1">
          <div className="muted">{p.quirk}</div>
          <div>רוצה: <b>{p.ambitionTarget}</b> · פופולריות {p.popularity.toFixed(0)}</div>
          <div className="bubble">{say.text}</div>
          {p.memory.length > 0 && <div><b>זוכר:</b> {p.memory.slice(-3).map((m) => m.text).join(' · ')}</div>}
          <div className="flex gap-1 flex-wrap pt-1">
            {!p.isPlayer && <button className="btn btn-sm btn-blue" data-tip="פותח מסך שיחה עם הפוליטיקאי. שיחה לא עולה הון, אבל מה שנאמר בה משנה יחסים ונשמר בזיכרון" onClick={() => useGame.getState().openChat(p.id)}>💬 שיחה</button>}
            {!p.isPlayer && <ActionButton id="network" params={{ politicianId: p.id }} className="btn btn-sm">☕ פגישה אישית</ActionButton>}
            {!p.isPlayer && <ActionButton id="attack_opponent" params={{ politicianId: p.id }} className="btn btn-sm">🥊 לתקוף</ActionButton>}
            {!p.isPlayer && <ActionButton id="leak_rival" params={{ politicianId: p.id }} className="btn btn-sm">🗂️ להדליף עליו</ActionButton>}
            {extra}
          </div>
        </div>
      )}
    </div>
  );
}

/** The written coalition agreement and how each commitment stands. */
function AgreementSection({ s }: { s: GameState }) {
  const list = (s.government.agreements ?? []).filter((c) => !c.secret || c.status === 'broken');
  if (!list.length) return null;
  const due = (c: (typeof list)[number]) => c.dueTurn !== undefined ? (c.dueTurn - s.turn > 0 ? `עוד ${Math.ceil(c.dueTurn - s.turn)} תורות` : 'המועד הגיע') : c.dueDay !== undefined ? `בעוד ${spanText(Math.max(0, c.dueDay - dayNumber(s.date)))}` : '';
  return (
    <Section title="ההסכם הקואליציוני" icon="📜">
      <p className="text-sm muted mb-2">כל מה שהתחייבת אליו מול השותפות. התחייבות שלא תקוים בזמן נחשבת הפרה: השותפה כועסת, היציבות יורדת, ולפעמים היא פורשת.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {list.map((c) => (
          <div key={c.id} className="inset flex items-start gap-2">
            <span className="text-lg" aria-hidden>{DEMAND_ICON[c.kind]}</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold">{c.label}</div>
              <div className="text-xs muted">{s.parties[c.partyId]?.name}{c.status === 'pending' && due(c) ? ` · ${due(c)}` : ''}</div>
            </div>
            <span className={`chip ${c.status === 'kept' ? 'chip-good' : c.status === 'broken' ? 'chip-bad' : 'chip-warn'}`}>{c.status === 'kept' ? 'קוים' : c.status === 'broken' ? 'הופר' : 'פתוח'}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function GovernmentScreen() {
  const s = useGame((x) => x.game)!;
  const pm = isPM(s);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const cands = ministerCandidates(s);
  return (
    <div className="space-y-4">
      <ScreenHeader title="הממשלה" sub={`ראש הממשלה: ${s.politicians[s.government.pmId]?.name} · ${coalitionSeats(s)} מנדטים · יציבות ${s.government.stability.toFixed(0)}`} />
      <Section title="הקואליציה" icon="🤝" right={<Explain k="stability" />}>
        <div className="flex flex-wrap gap-2">{s.government.coalition.map((id) => <PartyChip key={id} party={s.parties[id]} seats={s.parties[id].seats} />)}</div>
        {pm && <div className="flex flex-wrap gap-2 mt-3">{s.government.coalition.filter((id) => id !== s.player.partyId).map((id) => <ActionButton key={id} id="coalition_gift" params={{ partyId: id }} className="btn btn-sm">🎁 כספים ל{s.parties[id].shortName}</ActionButton>)}
          <ActionButton id="early_elections" className="btn btn-sm btn-danger" confirm="לפזר את הכנסטון? הבחירות יתקיימו בתוך כ-90 יום.">🗳️ הקדמת בחירות</ActionButton></div>}
      </Section>
      <AgreementSection s={s} />
      <Section title="שרים ומשרדים" icon="🏛️">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {s.government.ministries.map((m) => {
            const min = m.ministerId ? s.politicians[m.ministerId] : null;
            return (
              <div key={m.id} className="inset">
                <div className="flex justify-between items-center gap-2">
                  <b className="text-sm">{m.icon} {m.name}</b>
                  <span className="chip" data-tip="יעילות">⚙️ {m.efficiency.toFixed(0)}</span>
                </div>
                {min ? <div className="mt-2"><PolName p={min} s={s} size={32} sub={`${s.parties[min.partyId]?.shortName} · מומחיות ${(min.expertise[m.domain] ?? 20).toFixed(0)} · נאמנות ${min.loyalty.toFixed(0)}`} /></div> : <div className="text-xs muted mt-2">פנוי</div>}
                {pm && (
                  <div className="flex gap-1 flex-wrap mt-2">
                    <select aria-label={`מינוי שר ל${m.name}`} data-focus={`appoint:${m.id}`} data-tip="מינוי שר חדש למשרד: המספרים מראים מומחיות בתחום וכוח פוליטי" className="text-xs" style={{ padding: '4px 6px' }} value="" onChange={(e) => e.target.value && useGame.getState().act('appoint_minister', { ministryId: m.id, politicianId: e.target.value })}>
                      <option value="">מנה שר…</option>
                      {cands.filter((c) => c.id !== m.ministerId).sort((x, y) => (y.expertise[m.domain] ?? 20) - (x.expertise[m.domain] ?? 20)).map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({s.parties[c.partyId].shortName}){(() => { const held = s.government.ministries.filter((x) => x.ministerId === c.id).map((x) => x.name); return held.length ? ` · כבר מכהן: ${held.join(', ')}` : ' · בלי תיק'; })()} · מומחיות {(c.expertise[m.domain] ?? 20).toFixed(0)} · כוח {c.power.toFixed(0)}</option>
                      ))}
                    </select>
                    {min && min.id !== s.player.politicianId && <ActionButton id="network" params={{ politicianId: min.id }} className="btn btn-sm">☕</ActionButton>}
                    {min && min.id !== s.player.politicianId && <ActionButton id="fire_minister" params={{ ministryId: m.id }} className="btn btn-sm btn-danger" confirm={`לפטר את ${min.name}? הוא יזכור.`}>🔥</ActionButton>}
                    {!m.services.length && !m.categories.length && m.id !== 'finance' && <ActionButton id="remove_ministry" params={{ ministryId: m.id }} className="btn btn-sm">🗑️</ActionButton>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Section>
      {pm && (
        <Section title="צעדים לאומיים" icon="🏛️" right={<span className="chip chip-bad">רק לראש הממשלה</span>}>
          <p className="text-sm muted mb-3">צעדים שרק ראש הממשלה יכול לנקוט. לכל אחד יש השלכות רחבות על הציבור, על הכלכלה ועל הקואליציה.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {[['nation_address', '🎥 נאום לאומה'], ['state_emergency', '🚨 מצב מיוחד בעורף'], ['cash_handout', '💵 מענק חד-פעמי לכל משק בית'], ['postpone_elections', '⏸️ הצעה לדחיית הבחירות'], ['declare_war_pm', '💥 מבצע צבאי רחב']].map(([id, label]) => (
              <ActionButton key={id} id={id} className={`btn btn-sm ${['declare_war_pm', 'postpone_elections', 'state_emergency'].includes(id) ? 'btn-danger' : ''}`}
                confirm={['declare_war_pm', 'postpone_elections'].includes(id) ? 'לאשר? לצעד הזה השלכות רחבות ולא הפיכות.' : undefined}>{label}</ActionButton>
            ))}
          </div>
        </Section>
      )}
      {pm && (
        <Section title="מבנה הממשלה" icon="🧩">
          <div className="flex flex-wrap gap-2 items-center">
            <select aria-label="משרד ראשון לאיחוד" value={a} onChange={(e) => setA(e.target.value)}><option value="">משרד א׳</option>{s.government.ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <span>+</span>
            <select aria-label="משרד שני לאיחוד" value={b} onChange={(e) => setB(e.target.value)}><option value="">משרד ב׳</option>{s.government.ministries.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select>
            <ActionButton id="merge_ministries" params={{ a, b }} className="btn btn-sm btn-blue">🧩 איחוד</ActionButton>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {NEW_MINISTRY_TEMPLATES.map((t) => <ActionButton key={t.id} id="create_ministry" params={{ templateId: t.id }} className="btn btn-sm">{t.icon} {t.name}</ActionButton>)}
          </div>
        </Section>
      )}
    </div>
  );
}

function Hemicycle({ s }: { s: GameState }) {
  const parties = Object.values(s.parties).filter((p) => p.seats > 0).sort((x, y) => (s.government.coalition.includes(y.id) ? 1 : 0) - (s.government.coalition.includes(x.id) ? 1 : 0) || x.ideology.economic - y.ideology.economic);
  const colors: string[] = parties.flatMap((p) => Array(p.seats).fill(p.color));
  const dots: { x: number; y: number }[] = [];
  const rows = [30, 26, 22, 20, 12, 10];
  rows.forEach((n, ri) => {
    const r = 150 - ri * 18;
    for (let i = 0; i < n; i++) { const t = Math.PI - (i / (n - 1)) * Math.PI; dots.push({ x: 170 + r * Math.cos(t), y: 165 - r * Math.sin(t) }); }
  });
  dots.sort((p, q) => Math.atan2(165 - q.y, q.x - 170) - Math.atan2(165 - p.y, p.x - 170));
  return (
    <svg viewBox="0 0 340 175" style={{ width: '100%', maxWidth: 480 }}>
      {dots.slice(0, 120).map((d, i) => <circle key={i} cx={d.x} cy={d.y} r="5.5" fill={colors[i] ?? '#333'} />)}
      <text x="170" y="160" textAnchor="middle" fill="#1d1b3a" fontSize="20" fontWeight="900">{coalitionSeats(s)}</text>
      <text x="170" y="174" textAnchor="middle" fill="#5a5348" fontSize="9">קואליציה</text>
    </svg>
  );
}

export function ParliamentScreen() {
  const s = useGame((x) => x.game)!;
  const active = s.bills.filter((b) => b.status === 'active');
  const done = s.bills.filter((b) => b.status !== 'active').slice(-8).reverse();
  const stage = { preliminary: 'קריאה טרומית', committee: 'ועדה', final: 'קריאה שלישית' };
  const dissolved = s.government.caretaker && s.elections.phase === 'none';
  return (
    <div className="space-y-4">
      <ScreenHeader title="הכנסטון" sub="120 מושבים. כדי להעביר חוק או להקים ממשלה צריך רוב." />
      <Section title="המליאה" icon="🏟️" right={<Explain k="seats" />}>
        <div className="flex justify-center"><Hemicycle s={s} /></div>
        <div className="flex flex-wrap gap-1.5 justify-center mt-2">{Object.values(s.parties).filter((p) => p.seats).map((p) => <PartyChip key={p.id} party={p} seats={p.seats} />)}</div>
      </Section>
      {isSpeaker(s) && (
        <Section title="יו״ר הכנסטון" icon="🔨">
          <p className="text-sm muted mb-2">אתה מנהל את המליאה: קובע את סדר היום, שומר על הסדר ומייצג את הכנסטון. כל פעולה משפיעה על המוניטין, על הפופולריות ועל יציבות הממשלה.</p>
          <div className="flex flex-wrap gap-2">
            <ActionButton id="speaker_mediate" className="btn btn-sm">🤝 תיווך בין קואליציה לאופוזיציה</ActionButton>
            <ActionButton id="speaker_debate" className="btn btn-sm">🎙️ דיון מיוחד במליאה</ActionButton>
            <ActionButton id="speaker_discipline" className="btn btn-sm">🚪 הרחקת ח״כים מפריעים</ActionButton>
            <ActionButton id="speaker_visit" className="btn btn-sm">🌍 אירוח מנהיג זר</ActionButton>
            <ActionButton id="speaker_ethics" className="btn btn-sm">⚖️ ועדת האתיקה</ActionButton>
            <ActionButton id="speaker_open_day" className="btn btn-sm">🏛️ יום פתוח</ActionButton>
            <ActionButton id="speaker_reform" className="btn btn-sm btn-blue">📘 רפורמה בתקנון</ActionButton>
          </div>
        </Section>
      )}
      {dissolved && <div className="card card-tight" role="status">⏸️ הכנסטון התפזר לקראת הבחירות. הצעות חוק שכבר הוגשו ממתינות, וההצבעות עליהן יתקיימו רק אחרי שתקום ממשלה חדשה.</div>}
      <Section title="הצעות חוק בדיון" icon="📝">
        {!active.length ? <Empty icon="🦗" text="אין הצעות בדיון. הגש חוק ממסך החוקים." /> : (
          <div className="space-y-2">
            {active.map((b) => {
              const v = computeVote(s, { ...b, stage: 'final' });
              const sp = s.politicians[b.sponsorId];
              return (
                <div key={b.id} className="inset">
                  <div className="flex justify-between gap-2 flex-wrap">
                    <b>{LAW_BY_ID[b.lawId].icon} {b.title}{b.modified && <span className="chip chip-warn mr-1">מרוכך</span>}</b>
                    <span className="chip">{stage[b.stage]} · {b.isGovernment ? 'ממשלתית' : `פרטית (${sp?.name})`}</span>
                  </div>
                  <div className="text-xs mt-1">צפי הצבעה: <b className="good">{v.for}</b> בעד · <b className="bad">{v.against}</b> נגד · {v.abstain} נמנעים</div>
                  {dissolved ? <div className="text-xs muted mt-2">⏸️ ממתין לכנסטון החדש</div> : <div className="flex gap-1.5 flex-wrap mt-2">
                    <ActionButton id="push_bill" params={{ billId: b.id }} className="btn btn-sm">📣 גיוס תמיכה</ActionButton>
                    <ActionButton id="soften_bill" params={{ billId: b.id }} className="btn btn-sm">🧈 ריכוך</ActionButton>
                    {isSpeaker(s) && <><ActionButton id="speaker_schedule" params={{ billId: b.id }} className="btn btn-sm btn-blue">📅 קידום בסדר היום</ActionButton><ActionButton id="speaker_delay" params={{ billId: b.id }} className="btn btn-sm">⏸️ עיכוב</ActionButton></>}
                    {!isPM(s) && <><ActionButton id="vote_bill" params={{ billId: b.id, vote: 'for' }} className="btn btn-sm btn-good">בעד</ActionButton><ActionButton id="vote_bill" params={{ billId: b.id, vote: 'against' }} className="btn btn-sm btn-danger">נגד</ActionButton></>}
                  </div>}
                </div>
              );
            })}
          </div>
        )}
      </Section>
      {done.length > 0 && <Section title="הצבעות אחרונות" icon="🗳️"><ul className="text-sm space-y-1">{done.map((b) => <li key={b.id}>{b.status === 'passed' ? '✅' : '❌'} {b.title} {b.lastVote && <span className="muted num">({b.lastVote.for}-{b.lastVote.against})</span>}</li>)}</ul></Section>}
    </div>
  );
}

export function LawsScreen() {
  const s = useGame((x) => x.game)!;
  const [tab, setTab] = useState<'catalog' | 'active'>('catalog');
  const mine = s.parties[s.player.partyId];
  const myMin = s.government.ministries.find((m) => m.ministerId === s.player.politicianId);
  const [minF, setMinF] = useState<string>(s.player.role === 'minister' && myMin ? myMin.id : '');
  const [q, setQ] = useState('');
  const [kind, setKind] = useState<'' | 'medium' | 'major'>('');
  const [limit, setLimit] = useState(60);
  const minOrigins = (id: string) => s.government.ministries.find((m) => m.id === id)?.origins ?? [id];
  const shown = (tab === 'active' ? LAWS.filter((l) => s.activeLaws.includes(l.id)) : LAWS.filter((l) => !s.activeLaws.includes(l.id) && lawAllowed(s, l)))
    .filter((l) => !minF || (l.ministries ? l.ministries.some((id) => minOrigins(minF).includes(id)) : false))
    .filter((l) => !kind || l.level === kind)
    .filter((l) => !q.trim() || l.title.includes(q.trim()) || l.description.includes(q.trim()));
  // the advisor can point at any law: put that one first, even past the filters and the page limit
  const focusKey = useGame((x) => x.focusKey);
  const focusLaw = focusKey?.startsWith('propose_law:') ? LAW_BY_ID[focusKey.split(':')[1]] : undefined;
  if (tab === 'catalog' && focusLaw && !s.activeLaws.includes(focusLaw.id)) { const i = shown.indexOf(focusLaw); if (i !== 0) { if (i > 0) shown.splice(i, 1); shown.unshift(focusLaw); } }
  return (
    <div className="space-y-4">
      <ScreenHeader title="חוקים ורפורמות" sub={s.player.role === 'pm' ? 'חוק עובר טרומית → ועדה → קריאה שלישית. גדולים דורשים ישיבת ממשלה.' : s.player.role === 'minister' ? 'כשר אתה מגיש רק חוקים בתחום המשרד שלך. ראש הממשלה מחליט אם זו הצעה ממשלתית.' : 'כחבר כנסטון אתה מגיש הצעות חוק פרטיות. בלי תמיכת הקואליציה הן נופלות בטרומית.'} right={<Tabs value={tab} onChange={setTab} items={[{ id: 'catalog', label: 'הצעות אפשריות' }, { id: 'active', label: `בתוקף (${s.activeLaws.length})` }]} />} />
      <div className="flex flex-wrap gap-2 items-center">
        <select aria-label="סינון לפי משרד" value={minF} onChange={(e) => { setMinF(e.target.value); setLimit(60); }} className="select-ministry text-sm">
          <option value="">כל המשרדים</option>
          {s.government.ministries.map((m) => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
        </select>
        <select aria-label="סוג" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} className="text-sm">
          <option value="">חוקים ורפורמות</option>
          <option value="medium">חוקים</option>
          <option value="major">רפורמות</option>
        </select>
        <input type="search" aria-label="חיפוש חוק" placeholder="חיפוש…" value={q} onChange={(e) => { setQ(e.target.value); setLimit(60); }} className="flex-1" style={{ minWidth: 140 }} />
        <span className="text-xs muted">{`${shown.length} תוצאות`}</span>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {shown.slice(0, limit).map((l) => {
          const st = partyStance(s, mine, { id: 'x', lawId: l.id, title: l.title, sponsorId: s.player.politicianId, isGovernment: isPM(s), stage: 'final', turnsInStage: 0, proposedTurn: 0, status: 'active', push: 0, modified: false });
          const groups = Object.entries(l.groups).sort((a, b) => Math.abs(b[1]!) - Math.abs(a[1]!)).slice(0, 4);
          return (
            <div key={l.id} className="card card-tight card-hover flex flex-col">
              <div className="flex justify-between"><b>{l.icon} {l.title}</b>{l.level === 'major' && <span className="chip chip-gold">רפורמה</span>}</div>
              <p className="text-xs muted mt-1">{l.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">{groups.map(([g, v]) => <span key={g} className={`chip ${v! > 0 ? 'chip-good' : 'chip-bad'}`}>{GROUP_BY_ID[g as keyof typeof GROUP_BY_ID].emoji} {v! > 0 ? '+' : ''}{v}</span>)}</div>
              {l.budget && <div className="text-xs mt-1 warn">עלות: ₪{l.budget.amount}B בשנה</div>}
              <div className="flex-1" />
              {tab === 'active' && <div className="flex justify-end mt-2"><ActionButton id="repeal_law" params={{ lawId: l.id }} className="btn btn-sm btn-danger" confirm={`לבטל את ${l.title}? מי שאהב אותו יזכור.`}>🧨 ביטול החוק</ActionButton></div>}
              {tab === 'catalog' && (
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[11px] muted">המפלגה שלך: {st > 0.3 ? '👍 תומכת' : st < -0.15 ? '👎 מתנגדת' : '🤷 מתלבטת'}</span>
                  <ActionButton id="propose_law" params={{ lawId: l.id }} className="btn btn-sm btn-blue">📝 הגש</ActionButton>
                </div>
              )}
            </div>
          );
        })}
      </div>
      {shown.length > limit && <div className="flex justify-center"><button className="btn" onClick={() => setLimit(limit + 60)}>הצג עוד</button></div>}
    </div>
  );
}

const AXES: { k: keyof Ideology; title: string; neg: string; pos: string }[] = [
  { k: 'economic', title: 'כלכלה', neg: 'שמאלני', pos: 'ימני' },
  { k: 'security', title: 'ביטחון', neg: 'הסדר מדיני', pos: 'הרתעה וכוח' },
  { k: 'religion', title: 'דת ומדינה', neg: 'חילוני', pos: 'דתי' },
];

export function PartyScreen() {
  const s = useGame((x) => x.game)!;
  const party = s.parties[s.player.partyId];
  const caps = getCapabilities(s);
  const [name, setName] = useState(party.name);
  const [logo, setLogo] = useState(party.logo);
  const [who, setWho] = useState('');
  const members = party.memberIds.map((id) => s.politicians[id]).filter((p) => p?.active).sort((a, b) => b.power - a.power);
  return (
    <div className="space-y-4">
      <ScreenHeader title={`${party.logo} ${party.name}`} sub={`${party.slogan ? `"${party.slogan}" · ` : ''}${party.seats} מנדטים בכנסטון · יו״ר: ${s.politicians[party.leaderId]?.name}`} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="card card-tight"><div className="label">סקר</div><div className="text-2xl font-black num">{s.polls[s.polls.length - 1].seats[party.id]}</div></div>
        <div className="card card-tight"><div className="label flex gap-1">לכידות <Explain k="cohesion" /></div><div className="text-2xl font-black num">{party.cohesion.toFixed(0)}</div></div>
        <div className="card card-tight"><div className="label">קופה</div><div className="text-2xl font-black num">₪{party.funds.toFixed(1)}M</div></div>
        <div className="card card-tight"><div className="label">המקום שלך</div><div className="text-2xl font-black num">{playerListRank(s)}</div></div>
      </div>
      {caps.canManageParty && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Section title="מיתוג וקו" icon="🎨">
            <div className="flex gap-2 flex-wrap">
              <input type="text" aria-label="שם המפלגה" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} className="flex-1" />
              <input type="text" aria-label="סמל המפלגה (אימוג׳י)" value={logo} onChange={(e) => setLogo(e.target.value)} maxLength={4} style={{ width: 60 }} />
              <ActionButton id="rename_party" params={{ name, logo }} className="btn btn-sm">שמור</ActionButton>
            </div>
            <div className="space-y-2 mt-3">
              {AXES.map((a) => {
                const v = party.ideology[a.k];
                return (
                  <div key={a.k}>
                    <div className="text-xs font-bold mb-1">{a.title}: <span className="muted">{v > 0.15 ? `נוטה ל${a.pos.split(':')[0]}` : v < -0.15 ? `נוטה ל${a.neg.split(':')[0]}` : 'באמצע'}</span></div>
                    {/* the row is LTR so "left" is really on the left: left button moves the party left, right button moves it right */}
                    <div dir="ltr" className="flex items-center gap-2 text-xs">
                      <ActionButton id="party_line" params={{ axis: a.k, dir: -1 }} className="btn btn-sm"><span dir="ltr">◀ {a.neg.split(':')[0]}</span></ActionButton>
                      <div className="flex-1 relative h-2 rounded-full" style={{ background: '#e8edf5' }}><div className="absolute w-3 h-3 -top-0.5 rounded-full" style={{ background: party.color, left: `calc(${((v + 1) / 2) * 100}% - 6px)` }} /></div>
                      <ActionButton id="party_line" params={{ axis: a.k, dir: 1 }} className="btn btn-sm"><span dir="ltr">{a.pos.split(':')[0]} ▶</span></ActionButton>
                    </div>
                    <div dir="ltr" className="flex justify-between text-[10px] muted mt-0.5"><span dir="rtl">שמאל</span><span dir="rtl">ימין</span></div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2 flex-wrap mt-3">
              <ActionButton id="recruit_star" className="btn btn-sm">🌟 גיוס כוכב</ActionButton>
              <ActionButton id="fundraise" className="btn btn-sm">💵 תרומות</ActionButton>
            </div>
          </Section>
          <Section title="המלצות והבטחות" icon="✍️">
            <div className="flex gap-2 flex-wrap">
              <ActionButton id="no_confidence" className="btn btn-sm btn-danger">⚔️ אי-אמון</ActionButton>
            </div>
            <div className="label mt-3 mb-1">התחייבויות להמליץ עליך אחרי הבחירות</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.values(s.parties).filter((p) => p.id !== party.id && p.seats > 0).map((p) => (s.flags[`endorse_${p.id}`] ?? -1) >= s.turn
                ? <span key={p.id} className="chip chip-good">✍️ {p.shortName}</span>
                : <ActionButton key={p.id} id="seek_endorsement" params={{ partyId: p.id }} className="btn btn-sm">✍️ {p.shortName}</ActionButton>)}
            </div>
            <div className="text-xs muted mt-2">בוסט קמפיין: {(s.elections.campaignBoost[party.id] ?? 0).toFixed(0)}</div>
            <div className="label mt-3 mb-1">הבטחות בחירות</div>
            <div className="flex flex-wrap gap-1.5">
              {PROMISES.map((p) => <ActionButton key={p.id} id="make_promise" params={{ promiseId: p.id }} className="btn btn-sm">{p.icon} {p.text}</ActionButton>)}
            </div>
            {s.promises.length > 0 && <ul className="text-xs mt-3 space-y-1">{s.promises.map((p) => <li key={p.id}>{p.status === 'kept' ? '✅' : p.status === 'broken' ? '🤥' : p.status === 'void' ? '➖' : '⏳'} {p.text}</li>)}</ul>}
          </Section>
        </div>
      )}
      {caps.canManageParty && <CampaignPanel s={s} />}
      <AlliancesSection />
      <Section title="חברי המפלגה" icon="👥">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {members.map((p) => (
            <PolCard key={p.id} p={p} s={s} extra={caps.canManageParty && !p.isPlayer && <>
              <ActionButton id="promote_member" params={{ politicianId: p.id }} className="btn btn-sm">⬆️</ActionButton>
              <ActionButton id="demote_member" params={{ politicianId: p.id }} className="btn btn-sm">⬇️</ActionButton>
              <ActionButton id="expel_member" params={{ politicianId: p.id }} className="btn btn-sm btn-danger" confirm={`להוציא את ${p.name}?`}>🚫</ActionButton>
            </>} />
          ))}
        </div>
      </Section>
      <Section title="פוליטיקאים אחרים" icon="🎭">
        <input type="search" aria-label="חיפוש פוליטיקאי לפי שם" placeholder="חיפוש לפי שם…" value={who} onChange={(e) => setWho(e.target.value)} className="w-full mb-2" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.values(s.politicians)
            .filter((p) => p.active && !p.isPlayer && p.partyId !== party.id)
            .filter((p) => who.trim() ? p.name.includes(who.trim()) : s.parties[p.partyId]?.leaderId === p.id || s.government.ministries.some((m) => m.ministerId === p.id))
            .sort((a, b) => b.power - a.power)
            .slice(0, 40)
            .map((p) => <PolCard key={p.id} p={p} s={s} />)}
        </div>
      </Section>
    </div>
  );
}

export function PollsScreen() {
  const s = useGame((x) => x.game)!;
  const last = s.polls[s.polls.length - 1];
  const parties = Object.values(s.parties).filter((p) => last.shares[p.id] > 0.5).sort((a, b) => last.seats[b.id] - last.seats[a.id]);
  const data = parties.map((p) => ({ name: p.shortName, seats: last.seats[p.id], color: p.color }));
  const trend = s.polls.map((p) => ({ t: p.turn, gov: +p.govApproval.toFixed(1), me: +p.playerApproval.toFixed(1), mine: p.seats[s.player.partyId] }));
  const coal = s.government.coalition.reduce((a, id) => a + (last.seats[id] ?? 0), 0);
  return (
    <div className="space-y-4">
      <ScreenHeader title="סקרים" sub={`קואליציה בסקר: ${coal} · אחוז חסימה 3.25%`} />
      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="מנדטים בסקר" icon="📊">
          <div style={{ height: 260 }} dir="ltr">
            <ResponsiveContainer><BarChart data={data} layout="vertical" margin={{ left: 10 }}>
              <XAxis type="number" stroke="#4a5872" fontSize={11} /><YAxis type="category" dataKey="name" stroke="#4a5872" fontSize={11} width={80} />
              <Tooltip contentStyle={tooltipStyle} /><Bar dataKey="seats" radius={[0, 6, 6, 0]}>{data.map((d) => <Cell key={d.name} fill={d.color} />)}</Bar>
            </BarChart></ResponsiveContainer>
          </div>
        </Section>
        <Section title="מגמות" icon="📈">
          <div style={{ height: 260 }} dir="ltr">
            <ResponsiveContainer><LineChart data={trend}>
              <CartesianGrid stroke="#e8edf5" /><XAxis dataKey="t" stroke="#4a5872" fontSize={11} /><YAxis stroke="#4a5872" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line dataKey="gov" name="שביעות רצון מהממשלה" stroke="#ffc53d" dot={false} strokeWidth={2} />
              <Line dataKey="me" name="הפופולריות שלך" stroke="#5b8cff" dot={false} strokeWidth={2} />
              <Line dataKey="mine" name="מנדטים למפלגה שלך" stroke="#2bd47d" dot={false} strokeWidth={2} />
            </LineChart></ResponsiveContainer>
          </div>
        </Section>
      </div>
      <Section title="פילוח: מי הכי כועס ומי הכי מרוצה" icon="🔍">
        <div className="grid md:grid-cols-2 gap-3">
          {[...Object.values(s.population.groups)].sort((a, b) => a.satisfaction - b.satisfaction).filter((_, i, arr) => i < 4 || i >= arr.length - 4).map((g) => (
            <div key={g.id} className="flex items-center gap-2 text-sm"><span className="w-36">{GROUP_BY_ID[g.id].emoji} {GROUP_BY_ID[g.id].name}</span><div className="flex-1"><Meter value={g.satisfaction} /></div><b className="num">{g.satisfaction.toFixed(0)}</b></div>
          ))}
        </div>
      </Section>
    </div>
  );
}

export { Caricature };
