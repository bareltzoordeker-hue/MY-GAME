import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { BUDGETS, STRATEGIES, STRATEGY_BY_ID, issueSalience, needsCampaignStart } from '../../engine/campaign';
import { daysBetween, dateLabel, dayNumber, electionDate } from '../../engine/calendar';
import { GROUPS, MAJORITY } from '../../data/world';
import type { CampaignState, GameState } from '../../types/game';
import { ActionButton, Section } from '../components/ui';

const salWord = (v: number) => (v >= 1 ? 'בוער עכשיו' : v >= 0.6 ? 'רלוונטי' : 'פחות בסדר היום');
const salColor = (v: number) => (v >= 1 ? 'var(--good)' : v >= 0.6 ? 'var(--gold)' : 'var(--dim)');

/** Opens when the campaign window starts (party leaders). */
export function CampaignStartModal() {
  const s = useGame((x) => x.game);
  const act = useGame((x) => x.act);
  const busy = useGame((x) => x.reactions.length > 0 || x.briefingOpen || !!x.game?.drama);
  const [later, setLater] = useState(-1);
  const [strategy, setStrategy] = useState<CampaignState['strategy'] | ''>('');
  const [t1, setT1] = useState('');
  const [t2, setT2] = useState('');
  const [budget, setBudget] = useState<CampaignState['budget']>('mid');
  const [slogan, setSlogan] = useState('');
  useEffect(() => {
    const reopen = () => setLater(-1);
    window.addEventListener('open-campaign', reopen);
    return () => window.removeEventListener('open-campaign', reopen);
  }, []);
  if (!s || busy || !needsCampaignStart(s) || later === s.turn || s.flags.shot_skip_campaign) return null;
  const sal = issueSalience(s);
  const party = s.parties[s.player.partyId];
  const st = strategy ? STRATEGY_BY_ID[strategy] : null;
  const days = daysBetween(s.date, electionDate(s));
  return (
    <div className="backdrop">
      <div className="modal modal-wide" role="dialog" aria-label="פתיחת הקמפיין">
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>🚩 הבחירות ב-{dateLabel(electionDate(s), true)} · עוד {days} ימים</div>
          <div className="text-xl font-black">פתיחת הקמפיין של {party.name}</div>
          <p className="text-sm muted mt-1">בחר במה הקמפיין יתמקד, למי הוא פונה וכמה כסף להשקיע. אסטרטגיה בנושא שבוער בציבור משתלמת יותר בכל תור של הקמפיין.</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <div className="label mb-2">1. אסטרטגיה</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {STRATEGIES.map((x) => (
                <button key={x.id} className={`inset text-right ${strategy === x.id ? 'card-selected' : ''}`} onClick={() => { setStrategy(x.id); setT1(x.groups[0]); setT2(x.groups[1]); setSlogan(x.slogans[0]); }} aria-pressed={strategy === x.id}>
                  <div className="flex items-center justify-between gap-2"><b>{x.icon} {x.name}</b><span className="text-xs font-bold" style={{ color: salColor(sal[x.id]) }}>{salWord(sal[x.id])}</span></div>
                  <div className="text-xs muted mt-1">{x.desc}</div>
                </button>
              ))}
            </div>
          </div>
          {st && (
            <div className="grid md:grid-cols-3 gap-3">
              <div>
                <div className="label mb-1">2. קהלי יעד</div>
                <select aria-label="קהל יעד ראשון" value={t1} onChange={(e) => setT1(e.target.value)} className="w-full mb-1.5">{GROUPS.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}</select>
                <select aria-label="קהל יעד שני" value={t2} onChange={(e) => setT2(e.target.value)} className="w-full">{GROUPS.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}</select>
              </div>
              <div>
                <div className="label mb-1">3. תקציב (בקופה: ₪{party.funds.toFixed(1)}M)</div>
                {(Object.keys(BUDGETS) as CampaignState['budget'][]).map((b) => (
                  <label key={b} className="flex items-center gap-2 text-sm mb-1">
                    <input type="radio" name="camp-budget" checked={budget === b} onChange={() => setBudget(b)} />
                    {BUDGETS[b].name} – ₪{BUDGETS[b].cost}M {party.funds < BUDGETS[b].cost && <span className="text-xs bad">(אין מספיק – יושקע מה שיש)</span>}
                  </label>
                ))}
              </div>
              <div>
                <div className="label mb-1">4. סיסמה</div>
                <select aria-label="סיסמת הקמפיין" value={slogan} onChange={(e) => setSlogan(e.target.value)} className="w-full mb-1.5">{st.slogans.map((x) => <option key={x}>{x}</option>)}</select>
                <input type="text" aria-label="סיסמה משלך" maxLength={40} value={slogan} onChange={(e) => setSlogan(e.target.value)} className="w-full" />
              </div>
            </div>
          )}
        </div>
        <div className="p-4 pt-0 flex justify-between gap-2 flex-wrap">
          <button className="btn btn-sm" onClick={() => setLater(s.turn)} data-tip="אפשר לפתוח את הקמפיין גם ממסך המפלגה. כל תור בלי קמפיין הוא תור מבוזבז.">אחליט אחר כך</button>
          <button className="btn btn-primary" disabled={!strategy} onClick={() => act('start_campaign', { strategy, t1, t2, budget, slogan })}>🚩 לפתוח בקמפיין</button>
        </div>
      </div>
    </div>
  );
}

/** Results of the election that just took place. */
export function ElectionNightModal() {
  const s = useGame((x) => x.game);
  const [seen, setSeen] = useState(-1);
  const last = s?.elections.last;
  if (!s || !last || last.turn !== s.turn || seen === last.turn || s.gameOver) return null;
  const rows = Object.entries(last.seats).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const blocs: Record<string, number> = {};
  for (const [id, v] of rows) { const b = s.parties[id]?.bloc ?? 'other'; blocs[b] = (blocs[b] ?? 0) + v; }
  const BLOC_NAME: Record<string, string> = { gov: 'גוש הימין והחרדים', opp: 'גוש המרכז-שמאל', arab: 'המפלגות הערביות', other: 'אחרות' };
  const formateur = s.politicians[last.formateurId];
  const mine = last.seats[s.player.partyId] ?? 0;
  return (
    <div className="backdrop">
      <div className="modal" role="dialog" aria-label="תוצאות הבחירות" style={{ maxWidth: 640 }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>🗳️ ליל הבחירות · {dateLabel(s.date, true)}{last.early ? ' · בחירות מוקדמות' : ''}</div>
          <div className="text-xl font-black">{s.parties[s.player.partyId].name}: {mine} מנדטים</div>
          <div className="text-sm muted">הנשיא הטיל את הרכבת הממשלה על {formateur?.name ?? '—'}</div>
        </div>
        <div className="p-5 space-y-2">
          {rows.map(([id, v]) => {
            const p = s.parties[id];
            return (
              <div key={id} className="flex items-center gap-2 text-sm">
                <span className="w-28 truncate">{p.logo} {p.shortName}</span>
                <div className="flex-1 bar" style={{ height: 10 }}><i style={{ width: `${(v / 40) * 100}%`, background: p.color }} /></div>
                <b className="num w-8 text-left" style={{ color: id === s.player.partyId ? 'var(--violet-d, var(--blue))' : undefined }}>{v}</b>
              </div>
            );
          })}
          <div className="grid grid-cols-3 gap-2 pt-3">
            {Object.entries(blocs).map(([b, v]) => (
              <div key={b} className="inset text-center"><div className="label">{BLOC_NAME[b] ?? b}</div><div className="font-black text-lg num" style={{ color: v >= MAJORITY ? 'var(--good)' : undefined }}>{v}</div></div>
            ))}
          </div>
        </div>
        <div className="p-4 pt-0 flex justify-end"><button className="btn btn-primary" onClick={() => setSeen(last.turn)} autoFocus>המשך</button></div>
      </div>
    </div>
  );
}

/** The campaign desk on the party screen. */
export function CampaignPanel({ s }: { s: GameState }) {
  const c = s.campaign && s.campaign.electionDay === dayNumber(electionDate(s)) ? s.campaign : null;
  const [target, setTarget] = useState('');
  const sal = issueSalience(s);
  const rivals = Object.values(s.parties).filter((p) => p.id !== s.player.partyId && (p.seats > 0 || p.pollShare > 2));
  return (
    <Section title="מטה הקמפיין" icon="🚩">
      <div className="space-y-3">
        {!c ? (
          <div className="text-sm">
            <p className="muted mb-2">הקמפיין עוד לא נפתח. הוא נפתח 4 חודשים לפני הבחירות: בוחרים אסטרטגיה, קהלי יעד, תקציב וסיסמה.</p>
            <button className="btn btn-sm btn-blue" data-focus="start_campaign" disabled={!needsCampaignStart(s)} onClick={() => window.dispatchEvent(new Event('open-campaign'))} data-tip={needsCampaignStart(s) ? 'בחירת אסטרטגיה, קהלי יעד, תקציב וסיסמה' : 'הקמפיין נפתח 4 חודשים לפני הבחירות, ורק ליו״ר מפלגה'}>🚩 פתיחת הקמפיין</button>
          </div>
        ) : (
          <div className="inset">
            <div className="flex items-center justify-between gap-2"><b>{STRATEGY_BY_ID[c.strategy].icon} {STRATEGY_BY_ID[c.strategy].name}: "{c.slogan}"</b><span className="text-xs font-bold" style={{ color: salColor(sal[c.strategy]) }}>{salWord(sal[c.strategy])}</span></div>
            <div className="text-xs muted mt-1">קהלי יעד: {c.targets.map((g) => GROUPS.find((x) => x.id === g)?.name).join(', ')} · תקציב {BUDGETS[c.budget].name} · בוסט קמפיין {(s.elections.campaignBoost[s.player.partyId] ?? 0).toFixed(1)}</div>
            {c.internalPoll && <div className="text-xs mt-1">📋 סקר פנימי (תור {c.internalPoll.turn}): {c.internalPoll.low}–{c.internalPoll.high} מנדטים · נושא בוער: {STRATEGY_BY_ID[c.internalPoll.topIssue as CampaignState['strategy']]?.name}</div>}
          </div>
        )}
        <div className="flex gap-1.5 flex-wrap">
          <ActionButton id="field_campaign" className="btn btn-sm">🚪 חוגי בית</ActionButton>
          <ActionButton id="campaign_rally" className="btn btn-sm">📢 כנס</ActionButton>
          <ActionButton id="campaign_ads" className="btn btn-sm">🖼️ פרסום</ActionButton>
          <ActionButton id="debate" className="btn btn-sm">🎤 עימות</ActionButton>
          <ActionButton id="public_endorsement" className="btn btn-sm">🎖️ תמיכה של אישיות</ActionButton>
          <ActionButton id="internal_poll" className="btn btn-sm">📋 סקר פנימי</ActionButton>
          <ActionButton id="gotv" className="btn btn-sm">🗳️ יום הבחירות</ActionButton>
        </div>
        <div className="flex gap-1.5 items-center flex-wrap">
          <select aria-label="מפלגה יריבה לקמפיין שלילי" value={target} onChange={(e) => setTarget(e.target.value)} className="flex-1"><option value="">קמפיין שלילי נגד…</option>{rivals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <ActionButton id="negative_ad" params={{ partyId: target }} className="btn btn-sm btn-danger">📉 לשגר</ActionButton>
        </div>
      </div>
    </Section>
  );
}
