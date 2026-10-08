import { careerGoals } from '../../engine/aftermath';
import { useMemo, useState } from 'react';
import { LANGS, getLang, setLang, t } from '../../shared/i18n';
import { adviseCrisis } from '../../engine/advisorPlus';
import { canHandleCrisis, crisisOwner } from '../../engine/crises';
import { playerMinistry } from '../../engine/roles';
import { useGame, debugActions } from '../store/gameStore';
import { PROJECTS } from '../../data/projects';
import { REGION_BY_ID, ADVISOR } from '../../data/world';
import { advisorTips } from '../../engine/advisor';
import { getCapabilities } from '../../engine/roles';
import { playerListRank } from '../../engine/elections';
import { DOMAIN_NAMES } from '../../data/ministries';
import { ROLE_NAMES } from '../../engine/roles';
import { serialize, deserialize, saveGame, storageDiagnostics } from '../../engine/persistence/save';
import type { Domain } from '../../types/game';
import { resetTutorial } from '../components/Tutorial';
import { DecideButton } from '../components/Overlay';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';
import { ActionButton, Empty, Explain, Meter, ScreenHeader, Section, Tabs } from '../components/ui';

export function NewsScreen() {
  const s = useGame((x) => x.game)!;
  const [f, setF] = useState<'all' | 'bad' | 'good' | 'neutral'>('all');
  const items = s.news.filter((n) => f === 'all' || n.tone === f);
  return (
    <div className="space-y-4">
      <ScreenHeader title="חדשות" sub="כותרות מהתקשורת על מה שקרה בתורות האחרונים." right={<Tabs value={f} onChange={setF} items={[{ id: 'all', label: 'הכול' }, { id: 'bad', label: 'רעות' }, { id: 'good', label: 'טובות' }, { id: 'neutral', label: 'כלליות' }]} />} />
      <div className="grid md:grid-cols-2 gap-3">
        {items.map((n) => (
          <div key={n.id} className="card card-tight card-hover flex gap-3">
            <span className="text-2xl">{n.icon}</span>
            <div><div className="font-bold">{n.headline}</div><div className="text-xs muted mt-1">{n.outlet} · תור {n.turn}</div></div>
          </div>
        ))}
        {!items.length && <Empty icon="🗞️" text="אין כותרות." />}
      </div>
    </div>
  );
}

export function ProjectsScreen() {
  const s = useGame((x) => x.game)!;
  const caps = getCapabilities(s);
  const active = s.projects.filter((p) => p.status === 'active');
  const done = s.projects.filter((p) => p.status === 'done');
  const myMin = playerMinistry(s);
  // a minister may hold several portfolios: all of them count
  const held = s.government.ministries.filter((x) => x.ministerId === s.player.politicianId);
  const mine = (d: { ministry: string }) => s.player.role === 'pm' || (s.player.role === 'minister' && held.some((x) => (x.origins ?? [x.id]).includes(d.ministry)));
  const choices = s.player.role === 'pm' ? s.government.ministries : held;
  const [minF, setMinF] = useState<string>(s.player.role === 'minister' && myMin ? myMin.id : '');
  const inMin = (d: { ministry: string }) => !minF || ((s.government.ministries.find((x) => x.id === minF)?.origins ?? [minF]).includes(d.ministry));
  const avail = PROJECTS.filter((d) => !s.projects.some((p) => p.defId === d.id && p.status !== 'cancelled') && mine(d) && inMin(d));
  return (
    <div className="space-y-4">
      <ScreenHeader title="פרויקטים לאומיים" sub={`הוצאה שנתית על פרויקטים: ₪${s.budget.projectSpending.toFixed(1)}B. עיכובים תלויים בביורוקרטיה וביעילות המשרד.`} />
      <Section title="בביצוע" icon="🚧">
        {!active.length ? <Empty icon="🦺" text="אף פרויקט לא בביצוע." /> : <div className="grid md:grid-cols-2 gap-2">{active.map((p) => (
          <div key={p.id} className="inset">
            <div className="flex justify-between"><b>{p.icon} {p.name}</b>{p.delays > 0 && <span className="chip chip-warn">🐌 {p.delays} עיכובים</span>}</div>
            <div className="text-xs muted">{REGION_BY_ID[p.region].name} · ₪{p.totalCost.toFixed(1)}B · נותרו {(p.durationTurns - p.turnsElapsed) * 2} חודשים</div>
            <div className="my-2"><Meter value={p.progress} color="var(--blue)" /></div>
            {mine({ ministry: PROJECTS.find((d) => d.id === p.defId)?.ministry ?? '' }) && <ActionButton id="cancel_project" params={{ projectId: p.id }} className="btn btn-sm btn-danger" confirm="לבטל? האזור יזכור.">🛑 ביטול</ActionButton>}
          </div>
        ))}</div>}
      </Section>
      {!caps.canStartProjects && <div className="card text-sm">🏗️ פרויקטים לאומיים משיקים ראש הממשלה והשרים, כל אחד בתחום המשרד שלו. כחבר כנסטון אתה יכול לדרוש פרויקט לאזור שלך בתקשורת, או לבקר אזור מוזנח (מסך הקריירה).</div>}
      {caps.canStartProjects && <Section title="אפשר להשיק" icon="🏗️" right={choices.length > 1 || s.player.role === 'pm' ? (
        <select aria-label="בחירת משרד לפרויקטים" className="select-ministry text-sm" value={minF} onChange={(e) => setMinF(e.target.value)}>
          {s.player.role === 'pm' && <option value="">כל המשרדים</option>}
          {choices.map((x) => <option key={x.id} value={x.id}>{x.icon} {x.name}</option>)}
        </select>
      ) : undefined}>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">{avail.map((d) => (
          <div key={d.id} className="inset flex flex-col gap-1">
            <b className="text-sm">{d.icon} {d.name}</b>
            <span className="text-xs muted">{REGION_BY_ID[d.region].name} · ₪{d.cost}B · {d.turns * 2} חודשים · איכות +{d.bonus}</span>
            {d.note && <span className="text-xs muted">{d.note}</span>}
            <ActionButton id="start_project" params={{ defId: d.id }} className="btn btn-sm btn-blue mt-1">השקה</ActionButton>
          </div>
        ))}{!avail.length && <div className="text-sm muted">אין פרויקטים פתוחים בתחום שלך.</div>}</div>
      </Section>}
      {done.length > 0 && <Section title="הושלמו" icon="🎀"><ul className="text-sm space-y-1">{done.map((p) => <li key={p.id}>✅ {p.name}</li>)}</ul></Section>}
    </div>
  );
}

export function CrisesScreen() {
  const s = useGame((x) => x.game)!;
  const handle = useGame((x) => x.handleCrisis);
  return (
    <div className="space-y-4">
      <ScreenHeader title="משברים" sub="משברים נולדים ממצב המדינה. שירות מוזנח = שביתה. גירעון = דירוג." />
      {!s.crises.length ? <div className="card"><Empty icon="✅" text="לא קיימים מצבי חירום פעילים." /></div> : s.crises.map((c) => (
        <div key={c.id} className="card pulse-red" style={{ borderColor: 'rgba(255,93,108,.4)' }}>
          <div className="flex justify-between flex-wrap gap-2"><div className="text-xl font-black">{c.icon} {c.title}</div><span className="chip chip-bad">חומרה {c.severity} · עוד {c.remaining * 2} ח׳</span></div>
          <ul className="text-sm mt-2">{c.impactLines.map((l) => <li key={l}>• {l}</li>)}</ul>
          <CrisisActions crisisId={c.id} onPick={(a) => handle(c.id, a)} />
        </div>
      ))}
      <Section title="יומן אירועים" icon="📜"><ul className="text-sm space-y-1">{s.eventLog.slice(-15).reverse().map((e, i) => <li key={i} className={e.tone === 'bad' ? 'bad' : e.tone === 'good' ? 'good' : ''}>{e.icon} {e.text} <span className="muted text-xs">(תור {e.turn})</span></li>)}</ul></Section>
    </div>
  );
}

function CrisisActions({ crisisId, onPick }: { crisisId: string; onPick: (actionId: string) => void }) {
  const s = useGame((x) => x.game)!;
  const c = s.crises.find((x) => x.id === crisisId)!;
  const rec = useMemo(() => adviseCrisis(s, crisisId), [s.turn, crisisId, s.player.politicalCapital]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!canHandleCrisis(s, c)) {
    const inGov = s.government.coalition.includes(s.player.partyId);
    return (
      <div className="inset mt-3 text-sm">
        <div>🔒 את המשבר מנהל/ת <b>{crisisOwner(s, c)}</b>. לך נשאר להגיב בתקשורת:</div>
        <div className="flex flex-wrap gap-2 mt-2">
          <ActionButton id="press_conference" className="btn btn-sm">🎙️ {inGov ? 'להרגיע את הציבור' : 'לדרוש פתרון במסיבת עיתונאים'}</ActionButton>
          {!inGov && <ActionButton id="attack_opponent" params={{ politicianId: s.government.pmId }} className="btn btn-sm btn-danger">🥊 לתקוף את ראש הממשלה</ActionButton>}
        </div>
      </div>
    );
  }
  return (
    <>
      <div className="grid sm:grid-cols-3 gap-3 mt-4">
        {c.actions.map((a) => (
          <button key={a.id} className={`btn ${a.id === rec?.bestId ? 'btn-primary' : a.id === 'ignore' ? '' : 'btn-blue'} flex-col items-start text-right`} style={{ whiteSpace: 'normal', position: 'relative' }}
            disabled={a.capital > s.player.politicalCapital} onClick={() => onPick(a.id)}
            data-tip={[a.hint, a.successChance < 1 && a.successChance > 0 ? `סיכוי הצלחה ${Math.round(a.successChance * 100)}%` : '', rec?.byId[a.id] ? `צפי: ${rec.byId[a.id].text}` : ''].filter(Boolean).join(' · ')}>
            {a.id === rec?.bestId && <span className="rec">🧠 מומלץ</span>}
            <span>{a.label}</span><span className="text-[11px] font-normal opacity-80">{a.hint}</span>
          </button>
        ))}
      </div>
      {rec && <div className="text-xs mt-2" style={{ color: 'var(--violet)' }}>🧠 היועץ ממליץ: "{c.actions.find((a) => a.id === rec.bestId)?.label}" – {rec.reason}</div>}
    </>
  );
}

export function AdvisorScreen() {
  const s = useGame((x) => x.game)!;
  const tips = advisorTips(s);
  return (
    <div className="space-y-4">
      <div className="card flex gap-4 items-center">
        <Caricature spec={ADVISOR_SPEC} size={110} />
        <div><div className="screen-title">{ADVISOR.name}</div><div className="muted">{ADVISOR.title}. מסכם, מזהיר, ממליץ. לא מחליט – אתה מחליט.</div></div>
      </div>
      <div className="space-y-2">
        {tips.map((t, i) => (
          <div key={i} className="card card-tight flex items-center gap-3">
            <span className="text-2xl">{t.icon}</span><span className="flex-1">{t.text}</span>
            {t.screen && <DecideButton tip={{ text: t.text, screen: t.screen }} />}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CareerScreen() {
  const s = useGame((x) => x.game)!;
  const me = s.politicians[s.player.politicianId];
  const [domain, setDomain] = useState<Domain>('economy');
  const [target, setTarget] = useState('');
  const c = s.career;
  const ladder = ['ח״כ', 'יו״ר ועדה', 'שר', 'מנהיג מפלגה', 'ראש ממשלה'];
  const step = s.player.role === 'pm' ? 4 : s.parties[s.player.partyId].leaderId === me.id ? 3 : s.player.role === 'minister' ? 2 : me.committee ? 1 : 0;
  return (
    <div className="space-y-4">
      <ScreenHeader title="הקריירה שלך" sub={`${ROLE_NAMES[s.player.role]} · מקום ${playerListRank(s)} ברשימה`} />
      <div className="card"><div className="flex items-center gap-1">{ladder.map((l, i) => <div key={l} className="flex-1 text-center"><div className="h-2 rounded-full" style={{ background: i <= step ? 'var(--gold)' : 'var(--panel3)' }} /><div className={`text-xs mt-1 ${i === step ? 'font-black' : 'muted'}`}>{l}</div></div>)}</div></div>
      <div className="grid md:grid-cols-4 gap-3">
        {[['כוח פוליטי', me.power, 'power'], ['פופולריות', me.popularity, 'popularity'], ['מוניטין', s.player.reputation, 'reputation'], ['הון פוליטי', s.player.politicalCapital, 'capital']].map(([l, v, k]) => (
          <div key={l as string} className="card card-tight"><div className="label flex justify-between">{l}<Explain k={k as string} /></div><div className="text-2xl font-black num">{(v as number).toFixed(0)}</div><Meter value={v as number} /></div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="לבנות שם" icon="📈">
          <div className="flex flex-wrap gap-2 items-center">
            <select aria-label="תחום לעבודת ועדה" value={domain} onChange={(e) => setDomain(e.target.value as Domain)}>{Object.entries(DOMAIN_NAMES).map(([k, v]) => <option key={k} value={k}>{v} ({(me.expertise[k as Domain] ?? 20).toFixed(0)})</option>)}</select>
            <ActionButton id="committee_work" params={{ domain }} className="btn btn-sm">📑 עבודת ועדה</ActionButton>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <ActionButton id="tv_interview" className="btn btn-sm">📺 ראיון</ActionButton>
            <ActionButton id="tweet_storm" className="btn btn-sm">🐦 ציוץ</ActionButton>
            <ActionButton id="protest_speech" className="btn btn-sm">📢 נאום בהפגנה</ActionButton>
            <ActionButton id="charity_photo" className="btn btn-sm">🍲 התנדבות מצולמת</ActionButton>
            <ActionButton id="write_book" className="btn btn-sm">📕 ספר זיכרונות</ActionButton>
            <ActionButton id="reality_show" className="btn btn-sm btn-danger">🏝️ ריאליטי</ActionButton>
            <ActionButton id="press_conference" className="btn btn-sm">🎙️ מסיבת עיתונאים</ActionButton>
            {Object.keys(REGION_BY_ID).slice(0, 9).map((r) => <ActionButton key={r} id="visit_region" params={{ regionId: r }} className="btn btn-sm">🚐 {REGION_BY_ID[r as keyof typeof REGION_BY_ID].name}</ActionButton>)}
          </div>
        </Section>
        <Section title="להתקדם" icon="🪜">
          <div className="flex flex-wrap gap-2">
            <ActionButton id="support_leader" className="btn btn-sm">🙌 גיבוי למנהיג</ActionButton>
            <ActionButton id="ask_position" className="btn btn-sm">🙋 לבקש תפקיד</ActionButton>
            <ActionButton id="run_primaries" className="btn btn-sm btn-danger" confirm="פריימריז נגד המנהיג. הפסד יעלה ביוקר.">⚔️ קריאת תיגר</ActionButton>
          </div>
          <div className="flex flex-wrap gap-2 mt-3 items-center">
            <select aria-label="מפלגה לעבור אליה" value={target} onChange={(e) => setTarget(e.target.value)}><option value="">מעבר למפלגה…</option>{Object.values(s.parties).filter((p) => p.id !== s.player.partyId && p.seats > 0).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
            <ActionButton id="switch_party" params={{ partyId: target }} className="btn btn-sm" confirm="לעבור מפלגה? 'קפצן' זה לא מחמאה.">🦘 מעבר</ActionButton>
          </div>
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'var(--line)' }}><ActionButton id="resign" className="btn btn-sm btn-danger" confirm="להתפטר? זה סוף המשחק.">🚪 התפטרות</ActionButton></div>
        </Section>
      </div>
      <Section title="המטרות שלך בתפקיד" icon="🎯">
        <ul className="text-sm space-y-1">{careerGoals(s).map((g) => <li key={g.text} className={g.done ? 'good' : ''}>{g.done ? '✅' : '⬜'} {g.text} <span className="muted num">({g.progress})</span></li>)}</ul>
      </Section>
      <Section title="מסלול ורגעים" icon="📸">
        <ul className="text-sm space-y-1">{c.roleHistory.map((r, i) => <li key={i}>🎖️ {r.label} (תור {r.turn})</li>)}{c.memorable.slice(-8).map((m, i) => <li key={'m' + i}>📸 {m}</li>)}{c.achievements.map((a) => <li key={a}>🏆 {a}</li>)}</ul>
      </Section>
    </div>
  );
}

export function SaveScreen() {
  const s = useGame((x) => x.game)!;
  const quit = useGame((x) => x.quitToMenu);
  const status = useGame((x) => x.saveStatus);
  const [msg, setMsg] = useState('');
  const exportSave = () => {
    const blob = new Blob([serialize(s)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `hakise-turn${s.turn}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const importSave = (f: File) => f.text().then((t) => {
    const g = deserialize(t);
    if (!g) { setMsg('קובץ לא תקין'); return; }
    if (!saveGame(g)) { setMsg('לא הצלחנו לשמור את הקובץ בדפדפן'); return; }
    useGame.getState().continueGame();
  }, () => setMsg('לא הצלחנו לקרוא את הקובץ'));
  return (
    <div className="space-y-4">
      <ScreenHeader title="שמירה והגדרות" sub="המשחק נשמר אוטומטית בסוף כל תור (בדפדפן)." />
      <div className="card space-y-3">
        <div>סטטוס: <b>{status === 'saved' ? '💾 נשמר' : status === 'failed' ? '⚠️ השמירה נכשלה – המשחק בזיכרון, ננסה שוב בתור הבא' : '—'}</b></div>
        <div className="text-sm muted">Seed: {s.seed} · רמת קושי: {s.difficulty} · תור {s.turn}</div>
        {(() => { const d = storageDiagnostics(s); return (
          <div className="text-xs muted inset">
            <div>אחסון בדפדפן: <b className={d.available ? 'good' : 'bad'}>{d.available ? 'זמין' : 'חסום'}</b> · שמירה אחרונה בדפדפן: <b>{d.savedTurn === null ? 'אין' : `תור ${d.savedTurn}`}</b> · גודל: {d.sizeKB}KB · כתובת: {d.origin}</div>
            {d.error && <div className="bad mt-1">שגיאה: {d.error}</div>}
            {!d.available && <div className="mt-1">הדפדפן לא מאפשר לשמור (גלישה פרטית, או הגדרת פרטיות שחוסמת אחסון). צא מגלישה פרטית, או השתמש ב"ייצוא שמירה" כדי לשמור קובץ.</div>}
          </div>
        ); })()}
        <div className="flex flex-wrap gap-2">
          <button className="btn" data-tip="מוריד את המשחק השמור כקובץ למחשב שלך, לגיבוי או למעבר למחשב אחר. לא משנה דבר במשחק" onClick={exportSave}>⬇️ ייצוא שמירה</button>
          <label className="btn">⬆️ ייבוא שמירה<input type="file" accept=".json" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) importSave(f); }} /></label>
          <button className="btn btn-danger" data-tip="חוזר לתפריט הראשי. המשחק נשמר אוטומטית בסוף כל תור, ולכן מה שנעשה אחרי השמירה האחרונה לא יישמר" onClick={quit}>🏠 לתפריט הראשי</button>
        </div>
        {msg && <div className="bad text-sm">{msg}</div>}
      </div>
      <div className="card space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm flex-1">🌐 {t('set.language')}</span>
          {LANGS.map((l) => <button key={l.id} lang={l.id} data-tip={l.id === 'he' ? 'ממשק ותוכן בעברית' : l.id === 'en' ? 'Interface and content in English' : 'الواجهة والمحتوى بالعربية'} className={`btn btn-sm ${getLang() === l.id ? 'btn-blue' : ''}`} aria-pressed={getLang() === l.id} onClick={() => setLang(l.id)}>{l.name}</button>)}
        </div>
        <p className="text-xs muted">{t('set.languageNote')}</p>
      </div>
      <div className="card flex items-center justify-between gap-2">
        <span className="text-sm">🎓 מדריך המשחק</span>
        <button className="btn btn-sm" data-tip="מפעיל מחדש את הסיור המודרך בין המסכים. לא משפיע על מצב המשחק" onClick={() => { resetTutorial(); useGame.getState().setScreen('dashboard'); }}>הצג שוב</button>
      </div>
      <div className="card flex flex-wrap items-center gap-2">
        <span className="text-sm flex-1">🔒 פרטיות ונגישות</span>
        <button className="btn btn-sm" data-consent-open data-tip="פותח את הודעת העוגיות כדי לשנות את הבחירה">🍪 הגדרות עוגיות</button>
        <a className="btn btn-sm" href="/accessibility/" data-tip="הצהרת הנגישות של האתר">♿ הצהרת נגישות</a>
        <a className="btn btn-sm" href="/privacy/" data-tip="מדיניות הפרטיות">מדיניות פרטיות</a>
      </div>
    </div>
  );
}

export function DebugPanel() {
  const open = useGame((x) => x.debugOpen);
  const toggle = useGame((x) => x.toggleDebug);
  const patch = useGame((x) => x.debugPatch);
  const s = useGame((x) => x.game);
  const end = useGame((x) => x.endTurn);
  if (!s) return null;
  return (
    <>
      <button className="btn btn-sm fixed bottom-3 right-3 z-40" onClick={toggle} data-tip="Debug (dev only)">🐞</button>
      {open && (
        <div className="fixed bottom-14 right-3 z-40 card w-80 max-h-[70vh] overflow-y-auto text-xs space-y-2" dir="ltr">
          <b>Debug · turn {s.turn} · seed {s.seed} · rng {s.rngState}</b>
          <div className="flex flex-wrap gap-1">
            <button className="btn btn-sm" onClick={end}>Advance</button>
            <button className="btn btn-sm" onClick={() => patch((g) => { g.player.politicalCapital = 100; })}>+Capital</button>
            <button className="btn btn-sm" onClick={() => patch((g) => { g.economy.otherRevenue += 20; })}>+Money</button>
            <button className="btn btn-sm" onClick={() => patch((g) => { g.parties[g.player.partyId].momentum += 15; })}>+Polls</button>
            <button className="btn btn-sm" onClick={() => patch((g) => debugActions.triggerCrisis(g))}>Crisis</button>
            <button className="btn btn-sm" onClick={() => patch((g) => { g.politicians[g.player.politicianId].power += 20; })}>+Power</button>
            <button className="btn btn-sm" onClick={() => patch((g) => { g.elections.scheduledTurn = g.turn + 1; })}>Election next</button>
          </div>
          <div>growth {s.economy.growth.toFixed(2)} unemp {s.economy.unemployment.toFixed(2)} infl {s.economy.inflation.toFixed(2)} stab {s.government.stability.toFixed(0)}</div>
          <div>{Object.values(s.politicians).filter((p) => p.active && !p.isPlayer).slice(0, 25).map((p) => `${p.name}: L${p.loyalty.toFixed(0)} P${p.power.toFixed(0)}`).join(' | ')}</div>
          <details><summary>GameState JSON</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ ...s, politicians: '…', news: '…' }, null, 1).slice(0, 5000)}</pre></details>
        </div>
      )}
    </>
  );
}
