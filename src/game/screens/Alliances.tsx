import { useGame } from '../store/gameStore';
import { COST, allianceChance, allianceDemand, allianceWith } from '../../engine/alliances';
import { isPartyLeader } from '../../engine/roles';
import { Caricature } from '../../shared/components/Caricature';
import { Meter, Section } from '../components/ui';

export function AlliancesSection() {
  const s = useGame((x) => x.game)!;
  const make = useGame((x) => x.makeAlliance);
  const end = useGame((x) => x.endAlliance);
  const ask = useGame((x) => x.ask);
  const leader = isPartyLeader(s);
  const parties = Object.values(s.parties).filter((p) => p.id !== s.player.partyId && p.seats > 0).sort((a, b) => b.seats - a.seats);
  const allied = s.alliances.reduce((a, x) => a + (s.parties[x.partyId]?.seats ?? 0), 0) + s.parties[s.player.partyId].seats;
  return (
    <Section title="בריתות פוליטיות" icon="🤝" right={<span className="chip chip-gold">הגוש שלך: {allied} מנדטים</span>}>
      <p className="text-sm muted mb-3">
        <b>ברית הצבעה</b>: הם תומכים בחוקים שלך בכנסטון. <b>גוש</b>: גם ימליצו עליך לנשיא אחרי הבחירות. לכל ברית יש מחיר, והיא נשענת על היחסים עם המנהיג שלהם. אם הוא יתרחק, הברית תתפרק.
      </p>
      {!leader && <div className="inset text-sm mb-3">רק מנהיג מפלגה יכול לכרות בריתות. בינתיים – אפשר לבנות קשרים (☕) כדי שיהיה עם מי לדבר ביום שתוביל.</div>}
      <div className="grid md:grid-cols-2 gap-2">
        {parties.map((p) => {
          const a = allianceWith(s, p.id);
          const l = s.politicians[p.leaderId];
          const d = allianceDemand(s, p.id);
          return (
            <div key={p.id} className="inset" style={a ? { background: '#fff6dc', borderColor: '#ffc61a' } : undefined}>
              <div className="flex items-center gap-2">
                {l && <Caricature spec={l.caricature} size={38} tie={p.color} />}
                <div className="flex-1 min-w-0">
                  <div className="font-bold truncate">{p.logo} {p.name}</div>
                  <div className="text-xs muted">{p.seats} מנדטים · {l?.name} · יחס אליך {l?.loyalty.toFixed(0)}</div>
                </div>
                {a && <span className="chip chip-gold">{a.kind === 'bloc' ? 'גוש' : 'ברית הצבעה'}</span>}
              </div>
              {a ? (
                <div className="mt-2">
                  <div className="flex justify-between text-xs"><span>חוזק הברית</span><b className="num">{a.strength.toFixed(0)}</b></div>
                  <Meter value={a.strength} />
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-[11px] muted">מחיר: {a.demand}</span>
                    <button className="btn btn-sm btn-danger" onClick={() => ask({ title: 'לפרק את הברית?', text: `${l?.name} ייקח את זה אישית.`, onYes: () => end(p.id) })}>💔 פירוק</button>
                  </div>
                </div>
              ) : leader && (
                <div className="flex flex-wrap gap-1.5 mt-2 items-center">
                  <button className="btn btn-sm" disabled={s.player.politicalCapital < COST.votes} onClick={() => make(p.id, 'votes')} data-tip={`מחיר: ${d.label}`}>🗳️ ברית הצבעה · {Math.round(allianceChance(s, p.id, 'votes') * 100)}% · 🎯{COST.votes}</button>
                  <button data-focus={`alliance:${p.id}`} className="btn btn-sm btn-blue" disabled={s.player.politicalCapital < COST.bloc} onClick={() => make(p.id, 'bloc')} data-tip={`מחיר: ${d.label}`}>🤝 גוש · {Math.round(allianceChance(s, p.id, 'bloc') * 100)}% · 🎯{COST.bloc}</button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
