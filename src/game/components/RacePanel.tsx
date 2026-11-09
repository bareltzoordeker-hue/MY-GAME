// The race for the leadership of the player's party: both sides' support, and the campaign moves.
import { useState } from 'react';
import { RACE_MOVES, raceMembers, type RaceMove } from '../../engine/leadership';
import type { GameState } from '../../types/game';
import { ActionButton, Meter, Section } from './ui';

export function RacePanel({ s }: { s: GameState }) {
  const r = s.leadershipRace;
  const [who, setWho] = useState('');
  if (!r || r.partyId !== s.player.partyId) return null;
  const leader = s.politicians[r.incumbentId];
  const members = raceMembers(s).filter((m) => !r.backers.includes(m.id)).slice(0, 25);
  const left = Math.max(0, r.endTurn - s.turn);
  const moves = Object.keys(RACE_MOVES) as RaceMove[];
  return (
    <Section title="המירוץ על ראשות המפלגה" icon="⚔️">
      <p className="text-sm muted mb-2">{`ההכרעה בעוד ${left} תורות. ההצבעה נקבעת לפי התמיכה בכל צד בין חברי המפלגה.`}</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="inset"><div className="label">אתה</div><div className="flex items-center gap-2"><div className="flex-1"><Meter value={r.mine} /></div><b className="num">{r.mine.toFixed(0)}</b></div></div>
        <div className="inset"><div className="label">{leader?.name}</div><div className="flex items-center gap-2"><div className="flex-1"><Meter value={r.theirs} /></div><b className="num">{r.theirs.toFixed(0)}</b></div></div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        {moves.filter((m) => m !== 'endorse').map((m) => <ActionButton key={m} id="race_campaign" params={{ kind: m }} className="btn btn-sm">{`${RACE_MOVES[m].icon} ${RACE_MOVES[m].label}`}</ActionButton>)}
      </div>
      <div className="flex flex-wrap gap-2 mt-3 items-center">
        <select aria-label="חבר מפלגה לגיוס" value={who} onChange={(e) => setWho(e.target.value)} className="flex-1 min-w-0">
          <option value="">לגייס תמיכה של…</option>
          {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <ActionButton id="race_campaign" params={{ kind: 'endorse', targetId: who }} className="btn btn-sm btn-blue">{`${RACE_MOVES.endorse.icon} ${RACE_MOVES.endorse.label}`}</ActionButton>
      </div>
      {r.backers.length > 0 && <div className="text-xs muted mt-2">{`תומכים: ${r.backers.map((id) => s.politicians[id]?.name).join(', ')}`}</div>}
    </Section>
  );
}
