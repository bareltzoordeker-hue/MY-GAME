import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { coalitionConflicts, extraChance, negotiationSeats, offerExtras } from '../../engine/elections';
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
            const conflicts = o.status === 'pending' ? coalitionConflicts(s, o.partyId) : [];
            return (
              <div key={o.partyId} className="inset" style={{ borderColor: o.status === 'accepted' ? 'var(--good)' : o.status === 'refused' ? 'var(--bad)' : undefined, opacity: o.status === 'refused' ? 0.55 : 1 }}>
                <div className="flex items-center gap-2">
                  {leader && <Caricature spec={leader.caricature} size={40} tie={p.color} />}
                  <div className="flex-1 min-w-0"><b>{p.logo} {p.name}</b><div className="text-xs muted">{p.seats} מנדטים · נכונות {(o.willingness * 100).toFixed(0)}% · סבלנות {o.patience}</div></div>
                  {o.status !== 'pending' && <span className={`chip ${o.status === 'accepted' ? 'chip-good' : 'chip-bad'}`}>{o.status === 'accepted' ? 'בפנים' : 'בחוץ'}</span>}
                </div>
                {conflicts.length > 0 && (
                  <div className="mt-2 text-xs rounded-md p-2" style={{ background: 'rgba(200,60,60,.10)', border: '1px solid var(--bad)' }} role="note">
                    <b>⚠️ לא תסכים לשבת עם השותפות שכבר בפנים:</b>
                    <ul className="mt-1 space-y-0.5">{conflicts.map((c, i) => <li key={i}>• {c.reason}</li>)}</ul>
                    <div className="muted mt-1">גם אם תסכים לכל דרישותיה, הסיכוי שתצטרף נמוך. אפשר לוותר על הדרישה שגורמת לחיכוך, או להשאיר אחת מהשותפות בחוץ.</div>
                  </div>
                )}
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

/** After an election in which the player's party is not the largest: choose which government to join, and on what terms. */
export function CoalitionOffersModal() {
  const s = useGame((x) => x.game);
  const choose = useGame((x) => x.chooseOffer);
  const ask = useGame((x) => x.ask);
  const hasReaction = useGame((x) => x.reactions.length > 0);
  const [pick, setPick] = useState<Record<string, string>>({});
  if (!s || s.elections.phase !== 'offers' || !s.elections.offers || hasReaction) return null;
  const myParty = s.parties[s.player.partyId];
  const offers = s.elections.offers;
  return (
    <div className="backdrop">
      <div className="modal modal-wide" role="dialog" aria-label="הצעות להצטרף לממשלה">
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>📨 הבחירות הסתיימו</div>
          <div className="text-xl font-black">הצעות להצטרף לממשלה</div>
          <div className="text-sm muted mt-1">{`${myParty.name} קיבלה ${myParty.seats} מנדטים. בכל הצעה אפשר לראות עם מי תשבו, מה מקבלים ומה מצפים מכם. אפשר לבקש תנאים נוספים (אין הבטחה שיסכימו), להצטרף, או לדחות.`}</div>
        </div>
        <div className="p-5 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {offers.map((o) => {
            const f = s.politicians[o.formateurId];
            const fp = s.parties[f.partyId];
            const extras = offerExtras(s, o);
            const chosen = pick[o.id] ?? '';
            const left = Math.max(0, 3 - o.tries);
            return (
              <div key={o.id} className="inset">
                <div className="flex items-center gap-2">
                  <Caricature spec={f.caricature} size={40} tie={fp.color} />
                  <div className="flex-1 min-w-0"><b>{`${f.name} · ${fp.name}`}</b><div className="text-xs muted">{`ראש הממשלה המיועד · ${fp.seats} מנדטים בפלג שלו`}</div></div>
                </div>
                <div className="text-xs mt-2">{`${o.seats} מנדטים בממשלה (צריך ${MAJORITY}):`}</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  <span className="chip">{`${fp.logo} ${fp.shortName} ${fp.seats}`}</span>
                  <span className="chip chip-good">{`${myParty.logo} ${myParty.shortName} ${myParty.seats} (אתה)`}</span>
                  {o.partnerIds.map((id) => <span key={id} className="chip">{`${s.parties[id].logo} ${s.parties[id].shortName} ${s.parties[id].seats}`}</span>)}
                </div>
                <div className="text-xs mt-2 font-bold">מה אתם מקבלים:</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {o.terms.map((d, i) => <span key={i} className={`chip ${d.sweetener ? 'chip-good' : ''}`} data-tip={`${DEMAND_HINT[d.kind]}${d.sweetener ? ' · סוכם בבקשתך' : ''}`}>{`${DEMAND_ICON[d.kind]} ${d.label}`}</span>)}
                </div>
                <div className="text-xs mt-2 font-bold">מה מצפים ממך:</div>
                <ul className="text-xs mt-1 space-y-0.5">{o.asks.map((a, i) => <li key={i}>{`• ${a}`}</li>)}</ul>
                <div className="flex gap-1.5 mt-2 items-center flex-wrap">
                  <select aria-label={`בקשה נוספת מ${f.name}`} value={chosen} disabled={left === 0} onChange={(e) => setPick({ ...pick, [o.id]: e.target.value })} className="flex-1 min-w-0">
                    <option value="">{left === 0 ? 'לא ניתן לבקש עוד' : `לבקש תנאי נוסף… (נותרו ${left})`}</option>
                    {extras.map((d, i) => <option key={i} value={String(i)}>{`${DEMAND_ICON[d.kind]} ${d.label} · סיכוי ${(extraChance(s, o, d) * 100).toFixed(0)}%`}</option>)}
                  </select>
                  <button className="btn btn-sm btn-blue" disabled={chosen === '' || left === 0} onClick={() => { choose(o.id, 'ask', Number(chosen)); setPick({ ...pick, [o.id]: '' }); }}>לבקש</button>
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  <button className="btn btn-sm btn-good" onClick={() => ask({ title: `להצטרף לממשלה של ${f.name}?`, text: `${o.seats} מנדטים. התנאים שמופיעים בהצעה ייכנסו לתוקף.`, onYes: () => choose(o.id, 'accept') })}>✔ להצטרף לממשלה הזו</button>
                  <button className="btn btn-sm btn-danger" onClick={() => choose(o.id, 'decline')}>✖ לדחות</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="p-4 pt-0 text-xs muted">אם תדחה את כל ההצעות, המפלגה שלך נשארת באופוזיציה, אלא אם הם לא ימצאו רוב בלעדיה: אז הנשיא ימשיך לפנות למועמדים אחרים, ובמקרה הגרוע הבחירות יחזרו.</div>
      </div>
    </div>
  );
}
