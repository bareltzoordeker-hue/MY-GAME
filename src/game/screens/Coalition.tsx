import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { negotiationSeats } from '../../engine/elections';
import { sweetenerOptions } from '../../engine/coalitionDeals';
import { MAJORITY } from '../../data/world';
import { Caricature } from '../../shared/components/Caricature';
import type { DemandKind } from '../../types/game';

export const DEMAND_ICON: Record<DemandKind, string> = {
  ministry: '🏛️', deputy: '🪪', committee: '📑', budget: '💰', law: '📜', veto: '🚫', rotation: '🔄', jobs: '💼', cash: '🕶️',
};
const DEMAND_HINT: Record<DemandKind, string> = {
  ministry: 'תיק בממשלה', deputy: 'סגן שר', committee: 'ראשות ועדה בכנסטון', budget: 'תוספת תקציב שנתית לתחום שחשוב להם',
  law: 'התחייבות להעביר חוק בתוך שנתיים – תקבל תזכורת לפני המועד', veto: 'התחייבות לא לקדם חוק – אם תקדם אותו, זו הפרת הסכם',
  rotation: 'יו״ר השותפה יהיה ראש הממשלה אחרי שנתיים', jobs: 'מינויים בחברות ממשלתיות – פוגע ביעילות המשרדים שלהם',
  cash: 'כספים מחוץ לתקציב – עלול להיחשף ולהפוך לפרשה פלילית',
};

export function CoalitionModal() {
  const s = useGame((x) => x.game);
  const neg = useGame((x) => x.negotiateWith);
  const form = useGame((x) => x.formCoalition);
  const giveUp = useGame((x) => x.returnMandate);
  const ask = useGame((x) => x.ask);
  const hasReaction = useGame((x) => x.reactions.length > 0);
  const [pick, setPick] = useState<Record<string, string>>({});
  if (!s || s.elections.phase !== 'negotiation' || !s.elections.negotiation || hasReaction) return null;
  const n = s.elections.negotiation;
  const seats = negotiationSeats(s);
  const last = s.elections.last;
  const offers = Object.values(n.offers).sort((a, b) => s.parties[b.partyId].seats - s.parties[a.partyId].seats);
  return (
    <div className="backdrop">
      <div className="modal modal-wide" role="dialog" aria-label="הרכבת ממשלה">
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>🤝 הנשיא הטיל עליך את הרכבת הממשלה {last?.early ? '· אחרי בחירות מוקדמות' : ''}</div>
          <div className="text-xl font-black">הרכבת ממשלה</div>
          <div className="text-sm muted mt-1">נותרו <b className="num">{n.daysLeft ?? 28}</b> ימים למנדט{n.extended ? ' (אחרי הארכה)' : ' · אפשר לקבל הארכה אחת של 14 יום'}. כל סבב שיחות לוקח 3 ימים, כל הצעה נוספת – יום.</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 bar" style={{ height: 12 }} role="progressbar" aria-valuenow={seats} aria-valuemin={0} aria-valuemax={120} aria-label="מנדטים בקואליציה"><i style={{ width: `${(seats / 120) * 100}%`, background: seats >= MAJORITY ? 'var(--good)' : 'var(--gold)' }} /></div>
            <b className="num text-lg">{seats}/{MAJORITY}</b>
          </div>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-3">
          {offers.map((o) => {
            const p = s.parties[o.partyId];
            const leader = s.politicians[p.leaderId];
            const sweets = o.status === 'pending' ? sweetenerOptions(s, o.partyId) : [];
            const chosen = pick[o.partyId] ?? '';
            return (
              <div key={o.partyId} className="inset" style={{ borderColor: o.status === 'accepted' ? 'var(--good)' : o.status === 'refused' ? 'var(--bad)' : undefined, opacity: o.status === 'refused' ? 0.55 : 1 }}>
                <div className="flex items-center gap-2">
                  {leader && <Caricature spec={leader.caricature} size={40} tie={p.color} />}
                  <div className="flex-1 min-w-0"><b>{p.logo} {p.name}</b><div className="text-xs muted">{p.seats} מנדטים · נכונות {(o.willingness * 100).toFixed(0)}% · סבלנות {o.patience}</div></div>
                  {o.status !== 'pending' && <span className={`chip ${o.status === 'accepted' ? 'chip-good' : 'chip-bad'}`}>{o.status === 'accepted' ? 'בפנים' : 'בחוץ'}</span>}
                </div>
                <div className="text-xs mt-2">דרישות והסכמות:</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {o.demands.map((d, i) => (
                    <span key={i} className={`chip ${d.sweetener ? 'chip-good' : ''}`} data-tip={`${DEMAND_HINT[d.kind]}${d.sweetener ? ' · הצעה שלך' : ''}`}>{DEMAND_ICON[d.kind]} {d.label}
                      {o.status === 'pending' && !d.sweetener && o.demands.length > 1 && <button aria-label={`לוותר על הדרישה: ${d.label}`} style={{ background: 'none', border: 0, color: 'var(--bad)', cursor: 'pointer' }} data-tip="הצעה נגדית: בלי הדרישה הזו (מוריד את הסיכוי שיסכימו)" onClick={() => neg(o.partyId, 'counter', i)}>✕</button>}
                    </span>
                  ))}
                </div>
                {o.status === 'pending' && (
                  <>
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      <button className="btn btn-sm btn-good" onClick={() => neg(o.partyId, 'accept')} data-tip="להסכים לכל הדרישות. 3 ימים">✔ להסכים לכל</button>
                      <button className="btn btn-sm btn-danger" onClick={() => neg(o.partyId, 'refuse')} data-tip="להשאיר את המפלגה מחוץ לממשלה">✖ בלעדיהם</button>
                    </div>
                    {sweets.length > 0 && (
                      <div className="flex gap-1.5 mt-2 items-center flex-wrap">
                        <select aria-label={`הצעה נוספת ל${p.name}`} value={chosen} onChange={(e) => setPick({ ...pick, [o.partyId]: e.target.value })} className="flex-1">
                          <option value="">הצעה נוספת…</option>
                          {sweets.map((d, i) => <option key={i} value={String(i)}>{DEMAND_ICON[d.kind]} {d.label}</option>)}
                        </select>
                        <button className="btn btn-sm btn-blue" disabled={chosen === ''} data-tip={chosen !== '' ? DEMAND_HINT[sweets[Number(chosen)].kind] : 'בחר הצעה'}
                          onClick={() => { neg(o.partyId, 'sweeten', -1, sweets[Number(chosen)]); setPick({ ...pick, [o.partyId]: '' }); }}>להציע</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-4 pt-0 flex justify-between gap-2 flex-wrap">
          <button className="btn btn-danger btn-sm" onClick={() => ask({ title: 'להחזיר את המנדט?', text: 'אם אתה ראש ממשלה או מועמד – זה סוף הקריירה.', onYes: giveUp })}>להחזיר את המנדט</button>
          <button className="btn btn-primary" disabled={seats < MAJORITY} onClick={form}>🏛️ להשביע את הממשלה ({seats})</button>
        </div>
      </div>
    </div>
  );
}
