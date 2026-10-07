import { useEffect, useMemo, useRef, useState } from 'react';
import { useGame } from '../store/gameStore';
import { chatContacts, searchPoliticians } from '../../engine/chat';
import type { GameState, Politician } from '../../types/game';
import { Caricature } from '../../shared/components/Caricature';
import { ScreenHeader } from '../components/ui';

const SUGGESTIONS = [
  'תודה על התמיכה, אני מעריך את שיתוף הפעולה.',
  'אני מתנצל על מה שקרה. בוא נתחיל מחדש.',
  'אני מבטיח לקדם את חוק ההסדרים שביקשת.',
  'אני מבקש שתתמוך בחוק השוויון בנטל.',
  'אם לא תתמוך – אפרסם את עמדתך בפומבי.',
  'מה דעתך על הרפורמה המשפטית?',
];

function Row({ s, p, active, onPick }: { s: GameState; p: Politician; active: boolean; onPick: () => void }) {
  const unread = s.chatUnread?.[p.id] ?? 0;
  const last = s.chats?.[p.id]?.at(-1);
  const role = p.id === s.government.pmId ? 'ראש הממשלה' : p.ministryId ? s.government.ministries.find((m) => m.id === p.ministryId)?.name : s.parties[p.partyId]?.leaderId === p.id ? `יו״ר ${s.parties[p.partyId]?.shortName}` : s.parties[p.partyId]?.shortName;
  return (
    <button className={`inset w-full text-right flex items-center gap-2 ${active ? 'card-selected' : ''}`} onClick={onPick} aria-pressed={active}>
      <Caricature spec={p.caricature} size={38} tie={s.parties[p.partyId]?.color} />
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-sm leading-tight">{p.name}</span>
        <span className="block text-xs muted truncate">{role}{last ? ` · ${last.text.slice(0, 30)}` : ''}</span>
      </span>
      {unread > 0 && <span className="chip chip-bad" aria-label={`${unread} הודעות חדשות`}>{unread}</span>}
    </button>
  );
}

export function ChatScreen() {
  const s = useGame((x) => x.game)!;
  const chatWith = useGame((x) => x.chatWith);
  const openChat = useGame((x) => x.openChat);
  const send = useGame((x) => x.sendChat);
  const [q, setQ] = useState('');
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const contacts = useMemo(() => chatContacts(s).sort((a, b) => (s.chatUnread?.[b.id] ?? 0) - (s.chatUnread?.[a.id] ?? 0) || (s.chats?.[b.id]?.length ?? 0) - (s.chats?.[a.id]?.length ?? 0) || a.name.localeCompare(b.name, 'he')), [s]);
  const results = q.trim() ? searchPoliticians(s, q) : contacts;
  const target = chatWith ? s.politicians[chatWith] : null;
  const msgs = (target && s.chats?.[target.id]) || [];
  useEffect(() => { endRef.current?.scrollIntoView?.({ block: 'nearest' }); }, [msgs.length, chatWith]);
  const submit = () => { if (target && text.trim()) { send(target.id, text); setText(''); } };
  const mem = target?.memory.filter((m) => m.kind === 'promise' && !m.resolved).slice(-3) ?? [];
  return (
    <div className="space-y-4">
      <ScreenHeader title="שיחות" sub="כתבו לשרים וליו״רי מפלגות: איומים, הבטחות, בקשות, התנצלויות או חיזוק קשרים. הם מגיבים לפי היחסים, האופי והערכים של המפלגה, והשיחה משנה את המצב. לפעמים הם כותבים אליכם ראשונים." />
      <div className="grid md:grid-cols-5 gap-4">
        <div className="md:col-span-2 space-y-2">
          <label className="block"><span className="label">חיפוש לפי שם</span>
            <input type="text" className="w-full" value={q} onChange={(e) => setQ(e.target.value)} placeholder="הקלידו שם של פוליטיקאי…" aria-label="חיפוש פוליטיקאי לפי שם" />
          </label>
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto" role="list" aria-label="אנשי קשר">
            {results.map((p) => <div role="listitem" key={p.id}><Row s={s} p={p} active={p.id === chatWith} onPick={() => openChat(p.id)} /></div>)}
            {!results.length && <p className="text-sm muted">לא נמצא פוליטיקאי בשם הזה.</p>}
          </div>
        </div>
        <div className="md:col-span-3 card flex flex-col" style={{ minHeight: 420 }}>
          {!target ? <p className="muted text-sm m-auto">בחרו איש קשר מהרשימה, או חפשו לפי שם.</p> : (
            <>
              <div className="flex items-center gap-2 pb-3 border-b" style={{ borderColor: 'var(--line)' }}>
                <Caricature spec={target.caricature} size={44} tie={s.parties[target.partyId]?.color} />
                <div className="flex-1 min-w-0">
                  <div className="font-black leading-tight">{target.name}</div>
                  <div className="text-xs muted">{s.parties[target.partyId]?.name} · נאמנות אליך {target.loyalty.toFixed(0)}</div>
                </div>
              </div>
              {mem.length > 0 && <div className="text-xs mt-2 muted">הבטחות פתוחות: {mem.map((m) => m.text).join(' · ')}</div>}
              <div className="flex-1 overflow-y-auto py-3 space-y-2 max-h-[45vh]" role="log" aria-live="polite" aria-label={`שיחה עם ${target.name}`}>
                {msgs.length === 0 && <p className="text-sm muted">עוד לא דיברתם. כתבו הודעה ראשונה.</p>}
                {msgs.map((m, i) => (
                  <div key={i} className={`flex ${m.from === 'me' ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[85%] rounded-2xl px-3 py-2 text-sm" style={{ background: m.from === 'me' ? 'var(--panel3)' : '#fff', border: '1px solid var(--line2)' }}>
                      <div>{m.text}</div>
                      {m.hint && <div className="text-[11px] mt-1" style={{ color: 'var(--violet-d)' }}>{m.hint}</div>}
                      {m.proactive && <div className="text-[10px] muted mt-0.5">הודעה ביוזמתו</div>}
                    </div>
                  </div>
                ))}
                <div ref={endRef} />
              </div>
              <div className="flex flex-wrap gap-1 pb-2">
                {SUGGESTIONS.map((x) => <button key={x} className="chip" style={{ cursor: 'pointer' }} onClick={() => setText(x)} data-tip="לחצו כדי למלא את ההודעה, ואפשר לערוך אותה">{x.length > 34 ? `${x.slice(0, 34)}…` : x}</button>)}
              </div>
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); submit(); }}>
                <input type="text" className="flex-1" value={text} maxLength={400} onChange={(e) => setText(e.target.value)} placeholder="כתבו הודעה…" aria-label={`הודעה ל${target.name}`} />
                <button className="btn btn-primary" type="submit" disabled={!text.trim()}>שליחה</button>
              </form>
              <p className="text-[11px] muted mt-2">הבטחה לחוק או לתפקיד נרשמת עם מועד ותזכורת. איום עלול לעבוד או לחזור אליכם. אחרי שלוש הודעות באותו תור השיחה נרגעת.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
