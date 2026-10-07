import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { partyRelation } from '../../engine/relations';
import { isPartyLeader } from '../../engine/roles';
import type { GameState, Party, Politician } from '../../types/game';
import { ActionButton, PolName, ScreenHeader, Section } from '../components/ui';

const relWord = (v: number) => (v >= 50 ? 'קרובים' : v >= 20 ? 'טובים' : v > -20 ? 'פושרים' : v > -50 ? 'מתוחים' : 'עוינים');
const relColor = (v: number) => (v >= 20 ? 'var(--good)' : v <= -20 ? 'var(--bad)' : 'var(--dim)');

/** Parties spread from left to right by their position on the security axis, staggered in three rows so labels never overlap. */
function layout(parties: Party[]) {
  const sorted = [...parties].sort((a, b) => a.ideology.security - b.ideology.security);
  const n = Math.max(1, sorted.length - 1);
  return Object.fromEntries(sorted.map((p, i) => [p.id, { x: 50 + (i / n) * 500, y: 110 + (i % 3) * 150 }])) as Record<string, { x: number; y: number }>;
}

function PartyMap({ s, selected, onSelect }: { s: GameState; selected: string; onSelect: (id: string) => void }) {
  const parties = Object.values(s.parties).filter((p) => p.seats > 0 || p.pollShare >= 2);
  const pos = layout(parties);
  const edges: { a: string; b: string; v: number }[] = [];
  for (let i = 0; i < parties.length; i++) for (let j = i + 1; j < parties.length; j++) {
    const v = partyRelation(s, parties[i].id, parties[j].id);
    const touches = parties[i].id === selected || parties[j].id === selected;
    if (Math.abs(v) >= (touches ? 10 : 35)) edges.push({ a: parties[i].id, b: parties[j].id, v });
  }
  return (
    <svg viewBox="0 0 600 520" className="w-full" style={{ maxHeight: 520 }} role="img" aria-label="מפת היחסים בין המפלגות. רשימה מפורטת מופיעה לצד המפה.">
      {edges.map((e) => {
        const touches = e.a === selected || e.b === selected;
        return <line key={`${e.a}-${e.b}`} x1={pos[e.a].x} y1={pos[e.a].y} x2={pos[e.b].x} y2={pos[e.b].y}
          stroke={e.v > 0 ? '#2e9e5b' : '#d43d51'} strokeWidth={1 + (Math.abs(e.v) / 100) * (touches ? 6 : 3)} strokeOpacity={touches ? 0.85 : 0.25} strokeDasharray={e.v < 0 ? '6 4' : undefined} />;
      })}
      {parties.map((p) => {
        const { x, y } = pos[p.id];
        const rad = 14 + Math.sqrt(Math.max(1, p.seats || p.pollShare * 1.2)) * 4;
        const mine = p.id === s.player.partyId;
        return (
          <g key={p.id} onClick={() => onSelect(p.id)} style={{ cursor: 'pointer' }} role="button" tabIndex={0} aria-label={`${p.name}, ${p.seats} מנדטים`}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(p.id); }}>
            <circle cx={x} cy={y} r={rad} fill={p.color} stroke={p.id === selected ? 'var(--ink)' : mine ? 'var(--gold)' : '#fff'} strokeWidth={p.id === selected || mine ? 4 : 2} />
            <text x={x} y={y + 5} textAnchor="middle" fontSize="14" fontWeight="800" fill="#fff" style={{ pointerEvents: 'none' }}>{p.logo}</text>
            <text x={x} y={y + rad + 16} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--text)" style={{ pointerEvents: 'none' }}>{p.shortName}</text>
          </g>
        );
      })}
    </svg>
  );
}

function PersonRow({ s, p }: { s: GameState; p: Politician }) {
  const own = p.partyId === s.player.partyId;
  const last = p.memory[p.memory.length - 1];
  return (
    <div className="inset">
      <div className="flex items-center justify-between gap-2">
        <PolName p={p} s={s} sub={`${s.parties[p.partyId]?.shortName ?? ''}${last ? ` · זוכר: ${last.text}` : ''}`} />
        <span className="chip shrink-0" style={{ color: p.loyalty >= 55 ? 'var(--good)' : p.loyalty <= 35 ? 'var(--bad)' : undefined }} data-tip="היחס שלו אליך (0–100)">❤️ {p.loyalty.toFixed(0)}</span>
      </div>
      <div className="flex gap-1 flex-wrap mt-2">
        <button className="btn btn-sm btn-blue" onClick={() => useGame.getState().openChat(p.id)}>💬 שיחה</button>
        <ActionButton id="network" params={{ politicianId: p.id }} className="btn btn-sm">☕ פגישה</ActionButton>
        <ActionButton id="joint_event" params={{ politicianId: p.id }} className="btn btn-sm">🤝 אירוע משותף</ActionButton>
        <ActionButton id="mutual_support" params={{ politicianId: p.id }} className="btn btn-sm">🔁 תמיכה הדדית</ActionButton>
        <ActionButton id="public_defense" params={{ politicianId: p.id }} className="btn btn-sm">🛡️ הגנה פומבית</ActionButton>
        {own && <ActionButton id="help_primaries" params={{ politicianId: p.id }} className="btn btn-sm">🗳️ עזרה בפריימריז</ActionButton>}
      </div>
    </div>
  );
}

export function RelationsScreen() {
  const s = useGame((x) => x.game)!;
  const [sel, setSel] = useState(s.player.partyId);
  const party = s.parties[sel] ?? s.parties[s.player.partyId];
  const others = Object.values(s.parties).filter((p) => p.id !== party.id && (p.seats > 0 || p.pollShare >= 2))
    .map((p) => ({ p, v: partyRelation(s, party.id, p.id) })).sort((a, b) => b.v - a.v);
  const people = Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && (p.inKnesset !== false || p.ministryId || s.parties[p.partyId]?.leaderId === p.id));
  const allies = [...people].sort((a, b) => b.loyalty - a.loyalty).slice(0, 6);
  const rivals = [...people].sort((a, b) => a.loyalty - b.loyalty).slice(0, 6);
  const leader = isPartyLeader(s);
  return (
    <div className="space-y-4">
      <ScreenHeader title="מפת יחסים" sub="היחסים בין המפלגות ובינך לבין חברי הכנסטון. יחסים טובים עוזרים בהצבעות, בהרכבת קואליציה ובבריתות." />
      <div className="grid lg:grid-cols-5 gap-4">
        <Section title="המפלגות" icon="🕸️" className="lg:col-span-3">
          <p className="text-xs muted mb-2">לחץ על מפלגה כדי לראות את היחסים שלה. קו ירוק = יחסים טובים, קו אדום מקווקו = יחסים מתוחים. המפלגות מסודרות לפי עמדתן המדינית: שמאל בצד שמאל, ימין בצד ימין.</p>
          <PartyMap s={s} selected={party.id} onSelect={setSel} />
        </Section>
        <Section title={`${party.logo} ${party.name}`} icon="🤝" className="lg:col-span-2">
          <div className="space-y-1.5" role="list" aria-label={`היחסים של ${party.name}`}>
            {others.map(({ p, v }) => (
              <div key={p.id} role="listitem" className="flex items-center gap-2 text-sm">
                <button className="link-btn flex-1 text-right" onClick={() => setSel(p.id)}>{p.logo} {p.shortName}</button>
                <span className="text-xs muted">{relWord(v)}</span>
                <b className="num w-10 text-left" style={{ color: relColor(v) }}>{v > 0 ? '+' : ''}{v.toFixed(0)}</b>
              </div>
            ))}
          </div>
          {leader && party.id !== s.player.partyId && (
            <div className="flex gap-1.5 flex-wrap mt-3">
              <ActionButton id="leaders_meeting" params={{ partyId: party.id }} className="btn btn-sm btn-blue">🏛️ פגישת ראשי מפלגות</ActionButton>
              <ActionButton id="surplus_agreement" params={{ partyId: party.id }} className="btn btn-sm">➗ הסכם עודפים</ActionButton>
              <ActionButton id="propose_merger" params={{ partyId: party.id }} className="btn btn-sm" confirm="להציע ריצה משותפת? אם יסכימו, יו״ר המפלגה שלהם יקבל את המקום השני ברשימה שלך.">🔗 ריצה משותפת</ActionButton>
            </div>
          )}
          {!leader && <p className="text-xs muted mt-3">פעולות בין מפלגות (פגישת ראשי מפלגות, הסכם עודפים, איחוד) שמורות ליו״ר המפלגה.</p>}
        </Section>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="בעלי הברית שלך" icon="💚">
          <div className="space-y-2">{allies.map((p) => <PersonRow key={p.id} s={s} p={p} />)}</div>
        </Section>
        <Section title="היריבים שלך" icon="⚡">
          <div className="space-y-2">{rivals.map((p) => <PersonRow key={p.id} s={s} p={p} />)}</div>
        </Section>
      </div>
    </div>
  );
}
