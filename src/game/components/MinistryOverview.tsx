// Every ministry in the budget and state screens, also the ones with no budget line or service of their own.
import { useGame } from '../store/gameStore';
import { CATEGORIES } from '../../data/world';
import { Meter, Section } from './ui';
import type { GameState } from '../../types/game';

type Ministry = GameState['government']['ministries'][number];

const catName = (id: string) => CATEGORIES.find((c) => c.id === id)?.name ?? id;

function funding(s: GameState, m: Ministry): { alloc: number; need: number; pct: number } | null {
  if (!m.categories.length) return null;
  const alloc = m.categories.reduce((a, c) => a + s.budget.allocations[c], 0);
  const need = m.categories.reduce((a, c) => a + s.budget.needs[c], 0);
  return { alloc, need, pct: (100 * alloc) / Math.max(0.1, need) };
}

function GoToMinistry({ id }: { id: string }) {
  const goTo = useGame((x) => x.goTo);
  const setView = useGame((x) => x.setMinistryView);
  const s = useGame((x) => x.game)!;
  const canOpen = s.player.role === 'pm' || s.government.ministries.some((m) => m.id === id && m.ministerId === s.player.politicianId);
  if (!canOpen) return null;
  return <button className="btn btn-sm" onClick={() => { setView(id); goTo('ministry'); }} data-tip="פתיחת מסך המשרד">פתח</button>;
}

/** Budget screen: one row per ministry with its minister, its budget lines and how well they are funded. */
export function MinistryBudgetTable({ s }: { s: GameState }) {
  return (
    <Section title="התקציב לפי משרד" icon="🏛️">
      <p className="text-xs muted mb-2">כל המשרדים בממשלה. למשרד בלי סעיף משלו (חוץ, משפטים, תקשורת ועוד) אין חלוקה נפרדת: הוא ממומן מהתקציב הכללי של הממשלה.</p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-xs muted text-right"><th className="p-1">משרד</th><th className="p-1">שר</th><th className="p-1">סעיף</th><th className="p-1">תקציב</th><th className="p-1">מהצורך</th><th /></tr></thead>
          <tbody>
            {s.government.ministries.map((m) => {
              const f = funding(s, m);
              const minister = m.ministerId ? s.politicians[m.ministerId] : null;
              return (
                <tr key={m.id} className="border-t" style={{ borderColor: 'var(--line)' }}>
                  <td className="p-1 font-bold">{m.icon} {m.name}</td>
                  <td className="p-1 text-xs">{minister ? `${minister.name} (${s.parties[minister.partyId]?.shortName ?? ''})` : 'ראש הממשלה'}</td>
                  <td className="p-1 text-xs muted">{m.categories.length ? m.categories.map(catName).join(', ') : 'תקציב כללי'}</td>
                  <td className="p-1 num">{f ? `₪${f.alloc.toFixed(1)}B` : '—'}</td>
                  <td className="p-1">{f ? <span className={`chip ${f.pct >= 100 ? 'chip-good' : f.pct >= 92 ? 'chip-warn' : 'chip-bad'} num`}>{f.pct.toFixed(0)}%</span> : <span className="muted text-xs">—</span>}</td>
                  <td className="p-1"><GoToMinistry id={m.id} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/** State screen: one card per ministry with how it is run, its services and what is happening in it. */
export function MinistryStateGrid({ s }: { s: GameState }) {
  return (
    <Section title="מצב כל משרד" icon="🏛️">
      <p className="text-xs muted mb-2">יעילות, ביורוקרטיה, שירותים ובעיות פתוחות בכל אחד ממשרדי הממשלה.</p>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
        {s.government.ministries.map((m) => {
          const minister = m.ministerId ? s.politicians[m.ministerId] : null;
          const crises = s.crises.filter((c) => c.ministryId && (m.origins ?? [m.id]).includes(c.ministryId));
          const projects = s.projects.filter((p) => p.status === 'active' && s.government.ministries.find((x) => x.services.includes(p.service))?.id === m.id).length;
          const f = funding(s, m);
          return (
            <div key={m.id} className="inset">
              <div className="flex justify-between items-start gap-2">
                <b className="text-sm">{m.icon} {m.name}</b>
                {f && <span className={`chip ${f.pct >= 100 ? 'chip-good' : f.pct >= 92 ? 'chip-warn' : 'chip-bad'} num`} data-tip="תקציב מהצורך">{f.pct.toFixed(0)}%</span>}
              </div>
              <div className="text-xs muted">{minister ? `${minister.name} · ${s.parties[minister.partyId]?.shortName ?? ''}` : 'ראש הממשלה'}</div>
              <div className="grid grid-cols-2 gap-2 mt-2 text-[11px]">
                <div>יעילות <b className="num">{m.efficiency.toFixed(0)}</b><Meter value={m.efficiency} /></div>
                <div>ביורוקרטיה <b className="num">{m.bureaucracy.toFixed(0)}</b><Meter value={m.bureaucracy} invert /></div>
              </div>
              {m.services.map((id) => (
                <div key={id} className="mt-2 text-[11px]">איכות השירות <b className="num">{s.services[id].quality.toFixed(0)}</b><Meter value={s.services[id].quality} />
                  {s.services[id].issues.length > 0 && <div className="flex flex-wrap gap-1 mt-1">{s.services[id].issues.slice(0, 2).map((i) => <span key={i} className="chip chip-bad">{i}</span>)}</div>}
                </div>
              ))}
              {(crises.length > 0 || projects > 0) && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {crises.map((c) => <span key={c.id} className="chip chip-bad">{c.icon} {c.title}</span>)}
                  {projects > 0 && <span className="chip">🏗️ {projects} פרויקטים</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Section>
  );
}
