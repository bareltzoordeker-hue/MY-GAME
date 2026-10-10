// The guided way to talk: pick a move, pick what it is about, send. Plus the quick replies to a price the politician names.
import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { ASK_TOPICS, BUDGET_STEPS, SUBJECT_LABEL, availableMoves, lawChoices, pendingOffer, type Move, type MoveKind, type Subject } from '../../engine/chatMoves';
import { LAW_BY_ID } from '../../data/laws';
import type { GameState, Politician } from '../../types/game';

function LawPicker({ s, t, subject, value, onChange }: { s: GameState; t: Politician; subject: Subject; value: string; onChange: (id: string) => void }) {
  const [q, setQ] = useState('');
  const all = useMemo(() => lawChoices(s, t, subject), [s, t, subject]);
  const shown = useMemo(() => (q.trim() ? all.filter((l) => l.title.includes(q.trim())) : all).slice(0, 80), [all, q]);
  const groups = [...new Set(shown.map((l) => l.group))];
  return (
    <div className="space-y-1">
      <input type="search" className="w-full text-sm" placeholder="חיפוש חוק…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="חיפוש חוק" />
      <select className="w-full text-sm" value={value} onChange={(e) => onChange(e.target.value)} aria-label="בחירת חוק">
        <option value="">בחר חוק…</option>
        {groups.map((g) => <optgroup key={g} label={g}>{shown.filter((l) => l.group === g).map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}</optgroup>)}
      </select>
    </div>
  );
}

/** Quick replies to the price a politician names. */
export function OfferReplies({ s, t }: { s: GameState; t: Politician }) {
  const answer = useGame((x) => x.chatAnswer);
  const [other, setOther] = useState(false);
  const [lawId, setLawId] = useState('');
  const o = pendingOffer(s, t.id);
  if (!o) return null;
  return (
    <div className="rounded-xl p-2 mb-2" style={{ background: 'rgba(120,90,255,.08)', border: '1px solid var(--violet)' }} role="group" aria-label="מה הוא רוצה בתמורה">
      <div className="text-xs font-bold mb-1">💬 מה הוא רוצה בתמורה: בחר תגובה</div>
      <div className="flex flex-wrap gap-1.5">
        {o.options.map((op, i) => <button key={i} className="btn btn-sm btn-good" onClick={() => answer(t.id, { type: 'accept', index: i })}>✔ {op.label}</button>)}
        <button className="btn btn-sm" onClick={() => setOther(!other)}>🔁 הצעה אחרת</button>
        <button className="btn btn-sm" onClick={() => answer(t.id, { type: 'later' })}>⏳ אחשוב על זה</button>
        <button className="btn btn-sm btn-danger" onClick={() => answer(t.id, { type: 'refuse' })}>✖ מסרב</button>
      </div>
      {other && (
        <div className="mt-2 space-y-1">
          <div className="text-xs muted">הצע חוק אחר שתקדם בתמורה:</div>
          <LawPicker s={s} t={t} subject="law" value={lawId} onChange={setLawId} />
          <button className="btn btn-sm btn-blue" disabled={!lawId} onClick={() => { answer(t.id, { type: 'counter', lawId }); setLawId(''); setOther(false); }}>להציע</button>
        </div>
      )}
    </div>
  );
}

export function MoveComposer({ s, t }: { s: GameState; t: Politician }) {
  const move = useGame((x) => x.chatMove);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<MoveKind | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [lawId, setLawId] = useState('');
  const [ministryId, setMinistryId] = useState('');
  const [amount, setAmount] = useState(1);
  const [viaId, setViaId] = useState('');
  const [topic, setTopic] = useState('polls');
  const [polId, setPolId] = useState('');
  const moves = useMemo(() => availableMoves(s, t), [s, t]);
  const def = moves.find((m) => m.kind === kind);
  const pm = s.politicians[s.government.pmId];
  const fin = s.politicians[s.government.ministries.find((m) => m.id === 'finance')?.ministerId ?? ''];
  const viaOptions = [pm, fin].filter((p): p is Politician => !!p && p.id !== t.id && !p.isPlayer);
  const reset = () => { setKind(null); setSubject(null); setLawId(''); setMinistryId(''); setAmount(1); setViaId(''); setTopic('polls'); setPolId(''); };
  const needsLaw = subject === 'law' || subject === 'vote' || (kind === 'ask' && topic === 'law');
  const needsMinistry = subject === 'budget' || subject === 'role' || (kind === 'ask' && topic === 'ministry');
  const ready = !!kind && !!subject && (!needsLaw || !!lawId) && (!needsMinistry || !!ministryId) && (kind !== 'lobby' || !!(viaId || viaOptions[0])) && (!(kind === 'ask' && topic === 'politician') || !!polId);
  const send = () => {
    if (!kind || !subject) return;
    const m: Move = { kind, subject, lawId: lawId || undefined, ministryId: ministryId || undefined, amount: subject === 'budget' ? amount : undefined, viaId: kind === 'lobby' ? (viaId || viaOptions[0]?.id) : undefined, polId: polId || undefined, topic: kind === 'ask' ? topic : undefined };
    move(t.id, m);
    reset();
    setOpen(false);
  };
  const politicians = useMemo(() => Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && p.id !== t.id && (p.id === s.government.pmId || s.parties[p.partyId]?.leaderId === p.id || s.government.ministries.some((m) => m.ministerId === p.id))).slice(0, 80), [s, t]);

  return (
    <div className="mb-2">
      <button className="btn btn-sm btn-blue" onClick={() => { setOpen(!open); if (open) reset(); }} aria-expanded={open} data-tip="בחירת מהלך מרשימה: בקשה, לחץ, הבטחה, המלצה, איום ועוד. בלי להקליד">🧭 מהלך מובנה {open ? '▲' : '▼'}</button>
      {open && (
        <div className="inset mt-2 space-y-3">
          <div>
            <div className="text-xs font-bold mb-1">1. מה לעשות?</div>
            <div className="flex flex-wrap gap-1.5">
              {moves.map((m) => <button key={m.kind} className={`btn btn-sm ${kind === m.kind ? 'btn-primary' : ''}`} onClick={() => { setKind(m.kind); setSubject(m.subjects.length === 1 ? m.subjects[0] : null); }} data-tip={m.desc}>{m.icon} {m.label}</button>)}
            </div>
            {def && <div className="text-[11px] muted mt-1">{def.desc}</div>}
          </div>
          {def && def.subjects.length > 1 && (
            <div>
              <div className="text-xs font-bold mb-1">2. בנושא מה?</div>
              <div className="flex flex-wrap gap-1.5">{def.subjects.map((sb) => <button key={sb} className={`btn btn-sm ${subject === sb ? 'btn-primary' : ''}`} onClick={() => setSubject(sb)}>{SUBJECT_LABEL[sb]}</button>)}</div>
            </div>
          )}
          {kind && subject && (
            <div className="space-y-2">
              <div className="text-xs font-bold">3. פרטים</div>
              {kind === 'ask' && (
                <select className="w-full text-sm" value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="נושא השאלה">{ASK_TOPICS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>
              )}
              {kind === 'ask' && topic === 'politician' && (
                <select className="w-full text-sm" value={polId} onChange={(e) => setPolId(e.target.value)} aria-label="פוליטיקאי"><option value="">בחר פוליטיקאי…</option>{politicians.map((p) => <option key={p.id} value={p.id}>{p.name} ({s.parties[p.partyId]?.shortName})</option>)}</select>
              )}
              {needsLaw && <LawPicker s={s} t={t} subject={subject === 'vote' ? 'vote' : 'law'} value={lawId} onChange={setLawId} />}
              {needsMinistry && (
                <select className="w-full text-sm select-ministry" value={ministryId} onChange={(e) => setMinistryId(e.target.value)} aria-label="משרד">
                  <option value="">{subject === 'role' ? 'בחר תפקיד (משרד)…' : 'בחר משרד…'}</option>
                  {s.government.ministries.map((m) => <option key={m.id} value={m.id}>{m.icon} {m.name}</option>)}
                </select>
              )}
              {subject === 'budget' && kind !== 'lobby' && kind !== 'promise' && (
                <div className="flex items-center gap-1.5 flex-wrap"><span className="text-xs">סכום לשנה:</span>{BUDGET_STEPS.map((a) => <button key={a} className={`btn btn-sm ${amount === a ? 'btn-primary' : ''}`} onClick={() => setAmount(a)}>₪{a}B</button>)}</div>
              )}
              {kind === 'lobby' && (
                <div>
                  <div className="text-xs mb-1">על מי ללחוץ:</div>
                  <div className="flex gap-1.5 flex-wrap">{viaOptions.map((p) => <button key={p.id} className={`btn btn-sm ${(viaId || viaOptions[0]?.id) === p.id ? 'btn-primary' : ''}`} onClick={() => setViaId(p.id)}>{p.id === pm?.id ? 'ראש הממשלה' : 'שר האוצר'}: {p.name}</button>)}</div>
                </div>
              )}
              {(subject === 'law' || subject === 'vote') && lawId && <div className="text-[11px] muted">{LAW_BY_ID[lawId]?.description}</div>}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <button className="btn btn-sm" onClick={() => { reset(); setOpen(false); }}>ביטול</button>
            <button className="btn btn-primary btn-sm" disabled={!ready} onClick={send}>שליחה</button>
          </div>
        </div>
      )}
    </div>
  );
}
