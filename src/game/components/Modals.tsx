import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { babble, voiceFor } from '../audio/sound';
import { voiceOf } from './Drama';
import { Burst, fxKind } from './Fx';
import { EXPLAIN } from '../content/explain';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';
import { dateLabel, turnsToText } from '../../utils';
import { ACTIONS } from '../../engine/decisions';
import { LAW_BY_ID } from '../../data/laws';
import { PROJECT_BY_ID } from '../../data/projects';
import { roleLabel } from '../../engine/newGame';
import { ROLE_NAMES } from '../../engine/roles';
import { deficitPct } from '../../utils';
import { servicesAverage } from '../../engine/services';

export function ReactionModal() {
  const r = useGame((x) => x.reactions[0]);
  const dismiss = useGame((x) => x.dismissReaction);
  if (!r) return null;
  const fx = fxKind(r);
  const head = r.status === 'approved' ? { t: 'ההחלטה התקבלה', c: 'var(--good)', i: '✅' }
    : r.status === 'rejected' ? { t: 'לא עבר', c: 'var(--bad)', i: '⛔' }
      : r.status === 'pending' ? { t: 'בתהליך', c: 'var(--blue)', i: '⏳' } : { t: 'עדכון', c: 'var(--gold)', i: 'ℹ️' };
  return (
    <div className="backdrop" onClick={dismiss}>
      <div className="relative w-full" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()} key={r.title + (r.quip ?? '')}>
        <Burst kind={fx} />
        <div className="fx-icon">{{ war: '💥', money: '💰', good: '🎉', bad: '🍅', meh: '🤷' }[fx]}</div>
      <div className={`modal ${fx === 'bad' || fx === 'war' ? 'shake' : ''}`}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: head.c }}>{head.i} {head.t}</div>
          <div className="text-xl font-black mt-1">{r.title}</div>
          {r.subtitle && <div className="text-sm muted mt-0.5">{r.subtitle}</div>}
        </div>
        <div className="p-5 space-y-4">
          {r.stats.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {r.stats.map((x) => (
                <div key={x.label} className="inset flex items-center justify-between gap-2">
                  <span className="text-xs muted">{x.icon} {x.label}</span>
                  <b className={`num ${x.tone === 'good' ? 'good' : x.tone === 'bad' ? 'bad' : ''}`}>{x.value}</b>
                </div>
              ))}
            </div>
          )}
          {r.groups.length > 0 && (
            <div>
              <div className="label mb-1.5">תגובות</div>
              <div className="space-y-1.5">
                {r.groups.map((g) => (
                  <div key={g.label} className="flex items-start gap-2 text-sm">
                    <span className="w-6 text-center">{g.icon}</span>
                    <b className="w-28 shrink-0">{g.label}</b>
                    <span className={g.tone === 'good' ? 'good' : g.tone === 'bad' ? 'bad' : 'muted'}>"{g.text}"</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {r.people.length > 0 && (
            <div className="space-y-1.5">
              {r.people.map((p, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <span className="w-6 text-center">{p.icon}</span>
                  <b className="shrink-0">{p.label}:</b>
                  <span className="muted">"{p.text}"</span>
                </div>
              ))}
            </div>
          )}
          {r.quip && <div className="inset text-sm flex items-start gap-2"><Caricature spec={ADVISOR_SPEC} size={30} /><span>{r.quip}</span></div>}
        </div>
        <div className="p-4 pt-0 flex justify-end"><button className="btn btn-primary" onClick={dismiss} autoFocus>הבנתי</button></div>
      </div>
      </div>
    </div>
  );
}

export function MeetingModal() {
  const m = useGame((x) => x.meeting);
  const s = useGame((x) => x.game);
  const choose = useGame((x) => x.meetingChoice);
  const [speaking, setSpeaking] = useState(-1);
  const key = m ? m.participants.map((p) => p.bubble).join('|') : '';
  // everyone talks, one after the other: blah blah blah
  useEffect(() => {
    if (!m || !s) return;
    let cancelled = false;
    const timers: number[] = [];
    let t = 350;
    m.participants.forEach((p, i) => {
      timers.push(window.setTimeout(() => { if (!cancelled) { setSpeaking(i); babble(p.bubble, voiceOf(s.politicians[p.id])); } }, t));
      t += Math.min(1500, 260 + p.bubble.length * 32);
    });
    timers.push(window.setTimeout(() => { if (!cancelled) { setSpeaking(m.participants.length); babble(m.advisor, voiceFor('m', 7, 0.4)); } }, t));
    timers.push(window.setTimeout(() => { if (!cancelled) setSpeaking(-1); }, t + 1600));
    return () => { cancelled = true; timers.forEach(clearTimeout); };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!m || !s) return null;
  const a = ACTIONS[m.actionId];
  const subject = m.params.lawId ? LAW_BY_ID[String(m.params.lawId)]?.title : m.params.defId ? PROJECT_BY_ID[String(m.params.defId)]?.name : a.title;
  const yes = m.participants.filter((x) => x.stance > -0.1).length + 1;
  const no = m.participants.length + 1 - yes;
  return (
    <div className="backdrop">
      <div className="modal modal-wide">
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>🏛️ ישיבת ממשלה מיוחדת</div>
          <div className="text-xl font-black mt-1">{a.icon} {subject}{m.scale !== 1 && <span className="chip chip-warn mr-2">גרסה מרוככת</span>}</div>
          <div className="text-sm muted">{a.description}</div>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-3 gap-y-5">
            {m.participants.map((p, idx) => {
              const pol = s.politicians[p.id];
              const mood = p.stance > 0.3 ? 'good' : p.stance < -0.1 ? 'bad' : undefined;
              return (
                <div key={p.id} className="flex flex-col items-center text-center rise" style={{ transition: 'transform .25s', transform: speaking === idx ? 'translateY(-8px) scale(1.07)' : speaking >= 0 ? 'scale(.96)' : undefined, opacity: speaking >= 0 && speaking !== idx ? .6 : 1 }}>
                  <div className={`bubble mb-3 w-full ${mood === 'bad' ? 'bubble-bad' : mood === 'good' ? 'bubble-good' : ''}`}>{p.bubble}</div>
                  <Caricature spec={pol.caricature} size={84} tie={s.parties[pol.partyId]?.color} mood={mood} />
                  <div className="font-bold text-sm mt-1">{pol.name}</div>
                  <div className="text-[11px] muted">{p.title}</div>
                </div>
              );
            })}
            <div className="flex flex-col items-center text-center rise" style={{ transition: 'transform .25s', transform: speaking === m.participants.length ? 'translateY(-8px) scale(1.07)' : undefined }}>
              <div className="bubble mb-3 w-full">{m.advisor}</div>
              <Caricature spec={ADVISOR_SPEC} size={84} />
              <div className="font-bold text-sm mt-1">מוטי ספין</div>
              <div className="text-[11px] muted">היועץ</div>
            </div>
          </div>
          <div className="inset mt-5 flex items-center justify-between text-sm">
            <span>תומכים: <b className="good num">{yes}</b> · מתנגדים: <b className="bad num">{no}</b></span>
            <span className="muted">הון פוליטי: 🎯{s.player.politicalCapital.toFixed(0)}</span>
          </div>
        </div>
        <div className="p-4 pt-0 grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button className="btn btn-primary" onClick={() => choose('approve')} data-tip="ההחלטה שלך. המתנגדים ייעלבו.">✅ לאשר</button>
          <button className="btn btn-blue" onClick={() => choose('vote')} data-tip="רוב בישיבה מחליט">🗳️ להביא להצבעה</button>
          <button className="btn" onClick={() => choose('persuade')} disabled={s.player.politicalCapital < 8 || no === 0} data-tip="8 הון פוליטי: ניסיון לשכנע את המתנגדים">🗣️ לשכנע (🎯8)</button>
          <button className="btn" onClick={() => choose('deal')} disabled={no === 0} data-tip="₪0.8B לכל משרד מתנגד – והם בפנים">🤝 להציע עסקה</button>
          <button className="btn" onClick={() => choose('modify')} disabled={m.scale !== 1} data-tip="חצי מההשפעה, יותר תמיכה">✏️ לרכך את ההצעה</button>
          <button className="btn btn-danger" onClick={() => choose('reject')}>✖ לגנוז</button>
        </div>
      </div>
    </div>
  );
}

export function BriefingModal() {
  const s = useGame((x) => x.game);
  const open = useGame((x) => x.briefingOpen);
  const close = useGame((x) => x.closeBriefing);
  if (!s || !open || !s.briefing || s.gameOver) return null;
  const b = s.briefing;
  return (
    <div className="backdrop" onClick={close}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex gap-3 items-center" style={{ borderColor: 'var(--line)' }}>
          <Caricature spec={ADVISOR_SPEC} size={52} />
          <div>
            <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>📋 תדריך · {dateLabel(s.date)}</div>
            <div className="text-xl font-black">{b.turn === 0 ? 'ברוך הבא לכיסא' : 'מה קרה בחודשיים האחרונים'}</div>
          </div>
        </div>
        <div className="p-5 space-y-2">
          {b.lines.map((l, i) => (
            <div key={i} className="flex gap-2 text-sm items-start rise" style={{ animationDelay: `${i * 0.05}s` }}>
              <span>{l.icon}</span>
              <span className={l.tone === 'bad' ? 'bad' : l.tone === 'good' ? 'good' : ''}>{l.text}</span>
            </div>
          ))}
          {b.changes.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-4">
              {b.changes.map((c) => {
                const d = c.after - c.before;
                const good = Math.abs(d) < 0.05 ? null : (d > 0) === c.goodWhenUp;
                return (
                  <div key={c.label} className="inset flex justify-between items-center text-xs">
                    <span className="muted">{c.label}</span>
                    <span className="num font-bold">{c.after.toFixed(c.unit === '%' ? 1 : 0)}{c.unit} <span className={good === null ? 'muted' : good ? 'good' : 'bad'}>{Math.abs(d) < 0.05 ? '•' : d > 0 ? '▲' : '▼'}</span></span>
                  </div>
                );
              })}
            </div>
          )}
          {s.inbox.length > 0 && <div className="inset text-sm mt-2">📥 {s.inbox.length} החלטות מחכות לך בלוח הבקרה.</div>}
        </div>
        <div className="p-4 pt-0 flex justify-end"><button className="btn btn-primary" onClick={close} autoFocus>לעבודה</button></div>
      </div>
    </div>
  );
}

export function ExplainModal() {
  const k = useGame((x) => x.explainKey);
  const close = useGame((x) => x.explain);
  if (!k) return null;
  const e = EXPLAIN[k];
  if (!e) return null;
  return (
    <div className="backdrop" onClick={() => close(null)}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(ev) => ev.stopPropagation()}>
        <div className="p-5">
          <div className="text-xs muted">מה זה אומר?</div>
          <div className="text-xl font-black mb-2">{e.title}</div>
          <p className="text-sm leading-relaxed">{e.text}</p>
          {e.tip && <div className="inset text-sm mt-3">💡 {e.tip}</div>}
          <div className="flex justify-end mt-4"><button className="btn btn-primary btn-sm" onClick={() => close(null)}>תודה, מוטי</button></div>
        </div>
      </div>
    </div>
  );
}

export function ConfirmModal() {
  const c = useGame((x) => x.confirm);
  const ask = useGame((x) => x.ask);
  if (!c) return null;
  return (
    <div className="backdrop" onClick={() => ask(null)}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="text-lg font-black">{c.title}</div>
          <p className="text-sm muted mt-1">{c.text}</p>
          <div className="flex justify-end gap-2 mt-4">
            <button className="btn btn-sm" onClick={() => ask(null)}>ביטול</button>
            <button className="btn btn-sm btn-danger" onClick={() => { c.onYes(); ask(null); }}>כן</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function GameOverScreen() {
  const s = useGame((x) => x.game)!;
  const quit = useGame((x) => x.quitToMenu);
  const wipe = useGame((x) => x.wipeSave);
  const g = s.gameOver!;
  const me = s.politicians[s.player.politicianId];
  const c = s.career;
  const years = turnsToText(s.turn);
  return (
    <div className="min-h-screen p-4 flex justify-center">
      <div className="w-full max-w-3xl space-y-4 rise">
        <div className="card text-center">
          <div className="text-6xl">🪑💥</div>
          <div className="text-xs muted mt-2">GAME OVER · {dateLabel(s.date)}</div>
          <h1 className="text-3xl font-black mt-1">{g.title}</h1>
          <p className="mt-2 text-lg" style={{ color: 'var(--gold)' }}>"{g.text}"</p>
          <div className="flex justify-center mt-4"><Caricature spec={me.caricature} size={110} tie={s.parties[s.player.partyId]?.color} mood="bad" /></div>
          <div className="font-black mt-2">{me.name}</div>
          <div className="text-sm muted">{roleLabel(s)} · {s.parties[s.player.partyId]?.name}</div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Box l="שנים בפוליטיקה" v={years} />
          <Box l="חודשים כראש ממשלה" v={`${c.turnsInRole.pm * 2}`} />
          <Box l="חודשים כשר" v={`${c.turnsInRole.minister * 2}`} />
          <Box l="ממשלות שהקים" v={`${c.governmentsFormed}`} />
          <Box l="חוקים שהעביר" v={`${c.lawsPassed}`} />
          <Box l="כסף שהושקע" v={`₪${c.moneyInvested.toFixed(1)}B`} />
          <Box l="החלטות" v={`${c.decisions}`} />
          <Box l="בחירות (נ/ה)" v={`${c.electionsWon}/${c.electionsLost}`} />
        </div>
        <div className="card grid sm:grid-cols-3 gap-3 text-center">
          <div><div className="label">מצב הכלכלה</div><div className="font-black">{s.economy.growth.toFixed(1)}% צמיחה · {deficitPct(s).toFixed(1)}% גירעון</div></div>
          <div><div className="label">שירותים ציבוריים</div><div className="font-black">{servicesAverage(s).toFixed(0)}/100</div></div>
          <div><div className="label">שביעות רצון הציבור</div><div className="font-black">{s.government.approval.toFixed(0)}%</div></div>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <List t="🏆 הישגים מרכזיים" items={c.achievements} empty="אה... השתתפת?" />
          <List t="💀 כישלונות מרכזיים" items={c.failures} empty="אף אחד לא זוכר כישלונות. גם לא הצלחות." />
        </div>
        <List t="📸 רגעים בלתי נשכחים" items={[...c.memorable].slice(-10)} empty="הקריירה הייתה שקטה מאוד." />
        <List t="🧭 מסלול הקריירה" items={c.roleHistory.map((r) => `${ROLE_NAMES[r.role]} – ${r.label} (תור ${r.turn})`)} empty="" />
        <div className="flex justify-center gap-2 pb-8">
          <button className="btn btn-primary btn-lg" onClick={() => { wipe(); quit(); }}>🎬 קריירה חדשה</button>
        </div>
      </div>
    </div>
  );
}
const Box = ({ l, v }: { l: string; v: string }) => <div className="card card-tight text-center"><div className="label">{l}</div><div className="text-xl font-black num">{v}</div></div>;
const List = ({ t, items, empty }: { t: string; items: string[]; empty: string }) => (
  <div className="card">
    <div className="h-title mb-2">{t}</div>
    {items.length ? <ul className="text-sm space-y-1">{items.map((i, k) => <li key={k}>• {i}</li>)}</ul> : <div className="text-sm muted">{empty}</div>}
  </div>
);
