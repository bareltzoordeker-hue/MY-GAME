import { useGame } from '../store/gameStore';
import { negotiationSeats } from '../../engine/elections';
import { MAJORITY } from '../../data/world';
import { Caricature } from '../../shared/components/Caricature';

export function CoalitionModal() {
  const s = useGame((x) => x.game);
  const neg = useGame((x) => x.negotiateWith);
  const form = useGame((x) => x.formCoalition);
  const giveUp = useGame((x) => x.returnMandate);
  const ask = useGame((x) => x.ask);
  const hasReaction = useGame((x) => x.reactions.length > 0);
  if (!s || s.elections.phase !== 'negotiation' || !s.elections.negotiation || hasReaction) return null;
  const n = s.elections.negotiation;
  const seats = negotiationSeats(s);
  const last = s.elections.last;
  const offers = Object.values(n.offers).sort((a, b) => s.parties[b.partyId].seats - s.parties[a.partyId].seats);
  return (
    <div className="backdrop">
      <div className="modal modal-wide">
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>🤝 המנדט אצלך {last?.early ? '· אחרי בחירות מוקדמות' : ''}</div>
          <div className="text-xl font-black">הרכבת ממשלה</div>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex-1 bar" style={{ height: 12 }}><i style={{ width: `${(seats / 120) * 100}%`, background: seats >= MAJORITY ? 'var(--good)' : 'var(--gold)' }} /></div>
            <b className="num text-lg">{seats}/{MAJORITY}</b>
          </div>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-3">
          {offers.map((o) => {
            const p = s.parties[o.partyId];
            const leader = s.politicians[p.leaderId];
            return (
              <div key={o.partyId} className="inset" style={{ borderColor: o.status === 'accepted' ? 'var(--good)' : o.status === 'refused' ? 'var(--bad)' : undefined, opacity: o.status === 'refused' ? 0.55 : 1 }}>
                <div className="flex items-center gap-2">
                  {leader && <Caricature spec={leader.caricature} size={40} tie={p.color} />}
                  <div className="flex-1"><b>{p.logo} {p.name}</b><div className="text-xs muted">{p.seats} מנדטים · נכונות {(o.willingness * 100).toFixed(0)}% · סבלנות {o.patience}</div></div>
                  {o.status !== 'pending' && <span className={`chip ${o.status === 'accepted' ? 'chip-good' : 'chip-bad'}`}>{o.status === 'accepted' ? 'בפנים' : 'בחוץ'}</span>}
                </div>
                <div className="text-xs mt-2">דורשים:</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {o.demands.map((d, i) => (
                    <span key={i} className="chip">{d.kind === 'ministry' ? '🏛️' : d.kind === 'budget' ? '💰' : '📜'} {d.label}
                      {o.status === 'pending' && o.demands.length > 1 && <button style={{ background: 'none', border: 0, color: 'var(--bad)', cursor: 'pointer' }} data-tip="הצעה נגדית: בלי הדרישה הזו" onClick={() => neg(o.partyId, 'counter', i)}>✕</button>}
                    </span>
                  ))}
                </div>
                {o.status === 'pending' && (
                  <div className="flex gap-1.5 mt-2">
                    <button className="btn btn-sm btn-good" onClick={() => neg(o.partyId, 'accept')}>✔ להסכים לכל</button>
                    <button className="btn btn-sm btn-danger" onClick={() => neg(o.partyId, 'refuse')}>✖ לוותר עליהם</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="p-4 pt-0 flex justify-between gap-2">
          <button className="btn btn-danger btn-sm" onClick={() => ask({ title: 'להחזיר את המנדט?', text: 'אם אתה ראש ממשלה או מועמד – זה סוף הקריירה.', onYes: giveUp })}>להחזיר את המנדט</button>
          <button className="btn btn-primary" disabled={seats < MAJORITY} onClick={form}>🏛️ להשביע את הממשלה ({seats})</button>
        </div>
      </div>
    </div>
  );
}
