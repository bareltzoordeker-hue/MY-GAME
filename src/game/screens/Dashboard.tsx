import { useMemo } from 'react';
import { useGame } from '../store/gameStore';
import { adviseInbox } from '../../engine/advisorPlus';
import { DecideButton } from '../components/Overlay';
import { canHandleCrisis, crisisOwner } from '../../engine/crises';
import type { GameState } from '../../types/game';
import { debtPct, deficitPct } from '../../utils';
import { advisorTips } from '../../engine/advisor';
import { coalitionSeats } from '../../engine/polls';
import { servicesAverage } from '../../engine/services';
import { isPartyLeader, playerMinistry } from '../../engine/roles';
import { electionCountdown } from '../../engine/calendar';
import { playerListRank } from '../../engine/elections';
import { ADVISOR } from '../../data/world';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';
import { ActionButton, Empty, Meter, PartyChip, Section, Stat } from '../components/ui';

const prev = (s: GameState) => s.history[s.history.length - 2];

export function Dashboard() {
  const s = useGame((x) => x.game)!;
  const p = prev(s);
  const e = s.economy;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat icon="📈" label="צמיחה" value={`${e.growth.toFixed(1)}%`} delta={p ? e.growth - p.growth : undefined} k="growth" tone={e.growth < 1 ? 'bad' : undefined} />
        <Stat icon="👷" label="אבטלה" value={`${e.unemployment.toFixed(1)}%`} delta={p ? e.unemployment - p.unemployment : undefined} goodWhenUp={false} k="unemployment" tone={e.unemployment > 7 ? 'bad' : undefined} />
        <Stat icon="📉" label="גירעון" value={`${deficitPct(s).toFixed(1)}%`} delta={p ? deficitPct(s) - p.deficitPct : undefined} goodWhenUp={false} k="deficit" tone={deficitPct(s) > 5 ? 'bad' : undefined} />
        <Stat icon="🏦" label="חוב / תוצר" value={`${debtPct(s).toFixed(0)}%`} delta={p ? debtPct(s) - p.debtPct : undefined} goodWhenUp={false} k="debt" />
        <Stat icon="😊" label="שביעות רצון" value={`${s.government.approval.toFixed(0)}%`} delta={p ? s.government.approval - p.approval : undefined} k="approval" tone={s.government.approval < 30 ? 'bad' : undefined} />
        <Stat icon="🏥" label="שירותים ציבוריים" value={servicesAverage(s).toFixed(0)} delta={p ? servicesAverage(s) - p.servicesAvg : undefined} k="quality" sub="מתוך 100" />
      </div>

      <Cabinet />

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <Emergency />
        <AdvisorCard />
      </div>

      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4">
        <Inbox />
        <News />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <RoleCard />
        <Politics />
      </div>
    </div>
  );
}

const INBOX_HINTS: Record<string, string> = {
  approve: 'מאשר: הכסף יוצא מהתקציב (גירעון עולה), והוא יזכור את זה לטובה',
  half: 'פשרה: חצי מהסכום. פחות כסף, פחות הכרת תודה',
  refuse: 'מסרב: חוסך כסף, אבל הנאמנות שלו אליך יורדת',
  give: 'נכנע לאיום: הוא נשאר, אבל כולם לומדים שאיומים עובדים',
  fire: 'מפטר אותו עכשיו: נגמר האיום, מתחיל אויב. המפלגה שלו תיעלב',
  accept: 'מסכים: עולה משהו עכשיו, משפר יחסים',
  promise: 'מבטיח: הוא יזכור את ההבטחה. אם לא תקיים בזמן – זו בגידה',
  fight: 'מתמודד בפריימריז: הסיכוי תלוי בכוח, בפופולריות ובנאמנות חברי המפלגה',
  deal: 'סוגר עסקה: 20 הון פוליטי והבטחה למשרד בכיר',
  resign: 'פורש: סוף המשחק',
  comply: 'נשמע להנחיה: המנהיג מרוצה, התקשורת פחות',
  rebel: 'מורד: התקשורת אוהבת אותך, המנהיג זוכר',
  decline: 'מסרב להצעה: אולי תגיע הצעה טובה יותר. אולי לא',
  submit: 'מגיש את התקציב להצבעה בכנסטון. אם ייפול – בחירות',
  later: 'דוחה: תעבור על התקציב קודם. עד סוף אפריל',
};

function Cabinet() {
  const s = useGame((x) => x.game)!;
  const setScreen = useGame((x) => x.setScreen);
  const people = s.government.ministries.filter((m) => m.ministerId && s.politicians[m.ministerId]).map((m) => ({ m, p: s.politicians[m.ministerId!] }));
  const seen = new Set<string>();
  const uniq = people.filter(({ p }) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
  const pm = s.politicians[s.government.pmId];
  return (
    <Section title="שולחן הממשלה" icon="🪑" right={<button className="btn btn-sm btn-ghost" onClick={() => setScreen('government')} data-tip="ניהול שרים, מינויים ופיטורים">לממשלה ←</button>}>
      <div className="cabinet">
        {pm && (
          <button onClick={() => setScreen('government')} data-tip={`${pm.name} – ראש הממשלה · ${pm.quirk}`}>
            <Caricature spec={pm.caricature} size={78} tie={s.parties[pm.partyId]?.color} mood="good" />
            <span className="text-xs font-bold text-center leading-tight">{pm.name}{pm.isPlayer && ' (אתה)'}</span>
            <span className="chip chip-gold" style={{ fontSize: '.65rem' }}>רה״מ</span>
          </button>
        )}
        {uniq.filter(({ p }) => p.id !== s.government.pmId).map(({ m, p }) => {
          const mood = p.isPlayer ? 'good' : p.loyalty < 35 ? 'bad' : p.loyalty > 65 ? 'good' : undefined;
          return (
            <button key={p.id} onClick={() => setScreen('government')} data-tip={`${p.name} · ${m.name} · ${s.parties[p.partyId]?.shortName} · נאמנות ${p.loyalty.toFixed(0)} · ${p.quirk}`}>
              <Caricature spec={p.caricature} size={62} tie={s.parties[p.partyId]?.color} mood={mood} />
              <span className="text-[11px] font-bold text-center leading-tight">{p.name}{p.isPlayer && ' (אתה)'}</span>
              <span className="text-[10px] muted">{m.icon}</span>
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function Emergency() {
  const s = useGame((x) => x.game)!;
  const setScreen = useGame((x) => x.setScreen);
  const c = [...s.crises].sort((a, b) => b.severity - a.severity)[0];
  return (
    <Section title="מצבי חירום" icon="🚨" right={s.crises.length > 1 ? <button className="btn btn-sm" onClick={() => setScreen('crises')}>עוד {s.crises.length - 1}</button> : undefined}>
      {!c ? (
        <div className="inset flex items-center gap-3"><span className="text-2xl">✅</span><span className="muted">לא קיימים מצבי חירום פעילים.</span></div>
      ) : (
        <div className="inset pulse-red" style={{ borderColor: 'rgba(255,93,108,.45)', background: 'rgba(255,93,108,.06)' }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="font-black text-lg">{c.icon} {c.title}</div>
              <div className="text-xs muted">{c.category} · חומרה {'🔴'.repeat(c.severity)} · עוד {c.remaining * 2} חודשים אם לא תטפל</div>
            </div>
          </div>
          <ul className="text-sm mt-2 space-y-0.5">
            {c.impactLines.map((l) => <li key={l}>• {l}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2 mt-3">
            <button className="btn btn-danger btn-sm" onClick={() => setScreen('crises')} data-tip={canHandleCrisis(s, c) ? 'למסך המשברים: בחירת דרך טיפול' : `באחריות ${crisisOwner(s, c)}. אתה יכול להגיב בתקשורת`}>{canHandleCrisis(s, c) ? 'טפל במשבר' : 'פרטים ותגובה'}</button>
          </div>
        </div>
      )}
    </Section>
  );
}

function AdvisorCard() {
  const s = useGame((x) => x.game)!;
  const setScreen = useGame((x) => x.setScreen);
  const tips = advisorTips(s).slice(0, 3);
  const title = s.player.role === 'pm' ? 'היועץ לראש הממשלה' : 'היועץ האישי שלך';
  return (
    <Section title={title} icon="🧠" right={<button className="btn btn-sm btn-ghost" onClick={() => setScreen('advisor')}>עוד ←</button>}>
      <div className="flex gap-3 items-start">
        <div className="text-center shrink-0">
          <Caricature spec={ADVISOR_SPEC} size={68} />
          <div className="text-[11px] font-bold mt-1">{ADVISOR.name}</div>
        </div>
        <div className="flex-1 space-y-2">
          <div className="bubble">{tips[0].icon} {tips[0].text}</div>
          {tips[0].screen && <div><DecideButton tip={{ text: tips[0].text, screen: tips[0].screen }} /></div>}
          {tips.slice(1).map((t) => (
            <button key={t.text} className="text-xs muted text-right block hover:underline" style={{ background: 'none', border: 0, cursor: t.screen ? 'pointer' : 'default' }} onClick={() => t.screen && setScreen(t.screen as never)}>
              {t.icon} {t.text}
            </button>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Inbox() {
  const s = useGame((x) => x.game)!;
  return (
    <Section title="החלטות ממתינות" icon="📥" right={s.inbox.length ? <span className="chip chip-warn">{s.inbox.length}</span> : undefined}>
      {!s.inbox.length ? <Empty icon="📭" text="אין החלטות שממתינות לך." /> : (
        <div className="space-y-2">
          {s.inbox.map((it) => {
            const from = it.fromId ? s.politicians[it.fromId] : undefined;
            return (
              <div key={it.id} className="inset rise">
                <div className="flex gap-3 items-start">
                  {from && <Caricature spec={from.caricature} size={44} tie={s.parties[from.partyId]?.color} mood={it.kind.includes('threat') || it.kind === 'ultimatum' ? 'bad' : undefined} />}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm">{it.title}</div>
                    <div className="text-sm muted mt-0.5">{it.text}</div>
                    <InboxOptions itemId={it.id} />

                    <div className="text-[10px] muted mt-1">{it.expiresTurn - s.turn <= 0 ? 'יוחלט אוטומטית בסוף התור' : `נשארו ${it.expiresTurn - s.turn === 1 ? 'תור אחד' : `${it.expiresTurn - s.turn} תורות`} להחליט`}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
}

function InboxOptions({ itemId }: { itemId: string }) {
  const s = useGame((x) => x.game)!;
  const answer = useGame((x) => x.answerInbox);
  const it = s.inbox.find((i) => i.id === itemId)!;
  const rec = useMemo(() => adviseInbox(s, itemId), [s.turn, itemId, s.inbox.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div className="flex flex-wrap gap-2 mt-3">
        {it.options.map((o) => (
          <button key={o.id} className={`btn btn-sm ${o.id === rec?.bestId ? 'btn-blue' : ''}`} style={{ position: 'relative' }} onClick={() => answer(it.id, o.id)}
            data-tip={[o.hint ?? INBOX_HINTS[o.id], rec?.byId[o.id] ? `צפי: ${rec.byId[o.id].text}` : ''].filter(Boolean).join(' · ') || o.label}>
            {o.id === rec?.bestId && <span className="rec">🧠</span>}{o.label}
          </button>
        ))}
      </div>
      {rec && <div className="text-[11px] mt-1.5" style={{ color: 'var(--violet)' }}>🧠 היועץ ממליץ: "{it.options.find((o) => o.id === rec.bestId)?.label}" – {rec.reason}</div>}
    </>
  );
}

function News() {
  const s = useGame((x) => x.game)!;
  const setScreen = useGame((x) => x.setScreen);
  const items = s.news.slice(0, 6);
  return (
    <Section title="חדשות" icon="📰" right={<button className="btn btn-sm btn-ghost" onClick={() => setScreen('news')}>כל החדשות ←</button>}>
      {!items.length ? <Empty icon="🗞️" text="אין כותרות חדשות." /> : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="flex gap-2 items-start text-sm">
              <span>{n.icon}</span>
              <div className="min-w-0">
                <div className={`font-semibold ${n.tone === 'bad' ? '' : ''}`}>{n.headline}</div>
                <div className="text-[11px] muted">{n.outlet}{n.turn === s.turn ? ' · עכשיו' : ''}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Politics() {
  const s = useGame((x) => x.game)!;
  const setScreen = useGame((x) => x.setScreen);
  const seats = s.polls[s.polls.length - 1].seats;
  const pm = s.politicians[s.government.pmId];
  const parties = Object.values(s.parties).filter((p) => p.seats > 0 || seats[p.id] > 0).sort((a, b) => b.seats - a.seats);
  return (
    <Section title="פוליטיקה" icon="🏟️" right={<button className="btn btn-sm btn-ghost" onClick={() => setScreen('polls')}>סקרים ←</button>}>
      <div className="grid grid-cols-3 gap-2 mb-3 text-center">
        <div className="inset"><div className="label">קואליציה</div><div className={`font-black text-xl num ${coalitionSeats(s) < 61 ? 'bad' : ''}`}>{coalitionSeats(s)}</div></div>
        <div className="inset"><div className="label">יציבות</div><div className="font-black text-xl num">{s.government.stability.toFixed(0)}</div></div>
        <div className="inset"><div className="label">בחירות בעוד</div><div className="font-black text-xl num">{electionCountdown(s)}</div></div>
      </div>
      <div className="text-xs muted mb-2">ראש הממשלה: <b>{pm?.name}</b></div>
      <div className="space-y-1.5">
        {parties.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <span className="w-28 truncate">{p.logo} {p.shortName}</span>
            <div className="flex-1"><Meter value={p.seats} max={40} color={p.color} /></div>
            <span className="num w-7 text-left font-bold">{p.seats}</span>
            <span className={`num w-10 text-left text-xs ${seats[p.id] > p.seats ? 'good' : seats[p.id] < p.seats ? 'bad' : 'muted'}`}>({seats[p.id]})</span>
            {s.government.coalition.includes(p.id) && <span className="text-[10px]" data-tip="בקואליציה">🪑</span>}
          </div>
        ))}
      </div>
      <div className="text-[10px] muted mt-2">מספר בסוגריים = הסקר האחרון</div>
    </Section>
  );
}

function RoleCard() {
  const s = useGame((x) => x.game)!;
  const setScreen = useGame((x) => x.setScreen);
  const me = s.politicians[s.player.politicianId];
  const party = s.parties[s.player.partyId];
  const m = playerMinistry(s);

  if (s.player.role === 'minister' && m) {
    return (
      <Section title={m.name} icon={m.icon} right={<button className="btn btn-sm btn-blue" onClick={() => setScreen('ministry')}>למשרד ←</button>}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="inset"><div className="label">תקציב</div><div className="font-black num">₪{m.categories.reduce((a, c) => a + s.budget.allocations[c], 0).toFixed(1)}B</div></div>
          <div className="inset"><div className="label">יעילות</div><div className="font-black num">{m.efficiency.toFixed(0)}</div></div>
          <div className="inset"><div className="label">ראש הממשלה</div><div className="font-black num">{s.politicians[s.government.pmId].loyalty.toFixed(0)}</div><div className="text-[10px] muted">יחס אליך</div></div>
        </div>
        {m.services.map((id) => (
          <div key={id} className="mt-3">
            <div className="flex justify-between text-xs"><span>איכות השירות</span><b className="num">{s.services[id].quality.toFixed(0)}</b></div>
            <Meter value={s.services[id].quality} />
          </div>
        ))}
      </Section>
    );
  }
  if (s.player.role === 'mk') {
    const leader = s.politicians[party.leaderId];
    return (
      <Section title="הקריירה שלך" icon="🎖️" right={<button className="btn btn-sm btn-blue" onClick={() => setScreen('career')}>לקריירה ←</button>}>
        <div className="space-y-2 text-sm">
          <Row label="כוח פוליטי" v={me.power} />
          <Row label="מוניטין" v={s.player.reputation} />
          <Row label="פופולריות" v={me.popularity} />
          <Row label={`יחס המנהיג (${leader?.name})`} v={leader?.loyalty ?? 0} />
        </div>
        <div className="flex flex-wrap gap-2 mt-3 items-center">
          <span className="chip">מקום ברשימה: {playerListRank(s)}</span>
          {me.committee && <span className="chip chip-gold">יו״ר {me.committee}</span>}
          <ActionButton id="committee_work" params={{ domain: me.mainDomain }} className="btn btn-sm">📑 עבודת ועדה</ActionButton>
          <ActionButton id="ask_position" className="btn btn-sm">🙋 לבקש תפקיד</ActionButton>
        </div>
      </Section>
    );
  }
  if (s.player.role === 'candidate') {
    const seats = s.polls[s.polls.length - 1].seats;
    return (
      <Section title="המרוץ לבחירות" icon="🗳️" right={<button className="btn btn-sm btn-blue" onClick={() => setScreen('party')}>לקמפיין ←</button>}>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="inset"><div className="label">בחירות בעוד</div><div className="font-black text-xl num">{electionCountdown(s)}</div></div>
          <div className="inset"><div className="label">בסקר</div><div className="font-black text-xl num">{seats[party.id]}</div></div>
          <div className="inset"><div className="label">קופת המפלגה</div><div className="font-black text-xl num">₪{party.funds.toFixed(1)}M</div></div>
        </div>
        <p className="text-xs muted mt-3">צריך להיות הגוש שיקבל את המנדט. מפלגות ממליצות לפי אידיאולוגיה – ולפי כמה המנהיגים שלהן מחבבים אותך.</p>
        <div className="flex flex-wrap gap-2 mt-2">
          <ActionButton id="campaign_rally" className="btn btn-sm">📢 כנס</ActionButton>
          <ActionButton id="campaign_ads" className="btn btn-sm">🖼️ קמפיין</ActionButton>
          <ActionButton id="fundraise" className="btn btn-sm">💵 תרומות</ActionButton>
          <ActionButton id="no_confidence" className="btn btn-sm btn-danger">⚔️ אי-אמון</ActionButton>
        </div>
      </Section>
    );
  }
  // PM
  return (
    <Section title="פעולות מהירות" icon="⚡">
      <div className="grid grid-cols-2 gap-2">
        <button className="btn" onClick={() => setScreen('budget')}>💰 תקציב ומסים</button>
        <button className="btn" onClick={() => setScreen('government')}>🪑 מינויים וממשלה</button>
        <button className="btn" onClick={() => setScreen('laws')}>📜 חקיקה</button>
        <button className="btn" onClick={() => setScreen('projects')}>🏗️ פרויקטים לאומיים</button>
        <ActionButton id="press_conference" icon="🎙️">מסיבת עיתונאים</ActionButton>
        <button className="btn" onClick={() => setScreen('party')}>🎌 {isPartyLeader(s) ? 'המפלגה' : 'מפלגה'}</button>
      </div>
      {!s.budget.passed && <div className="inset mt-3 text-sm flex items-center justify-between gap-2"><span>📒 תקציב {s.budget.fiscalYear} ממתין לאישור</span><ActionButton id="submit_budget" className="btn btn-sm btn-primary">הגש</ActionButton></div>}
      <div className="mt-3"><PartyChip party={party} seats={party.seats} /></div>
    </Section>
  );
}

function Row({ label, v }: { label: string; v: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs"><span>{label}</span><b className="num">{v.toFixed(0)}</b></div>
      <Meter value={v} />
    </div>
  );
}
