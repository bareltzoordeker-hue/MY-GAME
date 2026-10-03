import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { GROUPS, REGIONS, SERVICES } from '../../data/world';
import { fundingRatio, serviceDrivers } from '../../engine/services';
import type { RegionId } from '../../types/game';
import { Explain, Meter, ScreenHeader, Section, Stat, Tabs } from '../components/ui';

export function StateScreen() {
  const s = useGame((x) => x.game)!;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <ScreenHeader title="מצב המדינה" sub="שירותים ציבוריים: איכות, שביעות רצון ובעיות. לחץ על שירות לפירוט." />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {SERVICES.map((d) => {
          const v = s.services[d.id];
          return (
            <div key={d.id} className="card card-hover" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === d.id ? null : d.id)}>
              <div className="flex justify-between"><b>{d.icon} {d.name}</b><span className={`num font-black ${v.trend > 0.05 ? 'good' : v.trend < -0.05 ? 'bad' : 'muted'}`}>{v.quality.toFixed(0)} {v.trend > 0.05 ? '▲' : v.trend < -0.05 ? '▼' : ''}</span></div>
              <div className="my-2"><Meter value={v.quality} /></div>
              <div className="text-xs muted">שביעות רצון {v.satisfaction.toFixed(0)} · מימון {(fundingRatio(s, d.id) * 100).toFixed(0)}%</div>
              {v.issues.length > 0 && <div className="flex flex-wrap gap-1 mt-2">{v.issues.map((i) => <span key={i} className="chip chip-bad">{i}</span>)}</div>}
              {open === d.id && (
                <div className="inset mt-3 text-xs space-y-1">
                  <div className="flex justify-between"><b>מה קובע את היעד?</b><Explain k="quality" /></div>
                  {serviceDrivers(s, d.id).map((x) => <div key={x.label} className="flex justify-between"><span>{x.label}</span><b className={`num ${x.value >= 0 ? 'good' : 'bad'}`}>{x.value.toFixed(1)}</b></div>)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PopulationScreen() {
  const s = useGame((x) => x.game)!;
  const p = s.population;
  const groups = [...GROUPS].sort((a, b) => s.population.groups[a.id].satisfaction - s.population.groups[b.id].satisfaction);
  return (
    <div className="space-y-4">
      <ScreenHeader title="אוכלוסייה" sub="מי מרוצה, מי כועס, ולמה." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon="👥" label="אוכלוסייה" value={`${p.total.toFixed(2)}M`} sub={`גידול ${p.growthRate.toFixed(1)}%`} />
        <Stat icon="🧒" label="ילדים" value={`${(p.ages.kids * 100).toFixed(0)}%`} />
        <Stat icon="🧑" label="18–34" value={`${(p.ages.young * 100).toFixed(0)}%`} />
        <Stat icon="🧓" label="65+" value={`${(p.ages.seniors * 100).toFixed(0)}%`} />
      </div>
      <Section title="קבוצות אוכלוסייה" icon="📊">
        <div className="grid md:grid-cols-2 gap-x-6 gap-y-2">
          {groups.map((g) => {
            const st = s.population.groups[g.id];
            return (
              <div key={g.id} className="flex items-center gap-2 text-sm">
                <span className="w-36 truncate">{g.emoji} {g.name}</span>
                <div className="flex-1"><Meter value={st.satisfaction} /></div>
                <b className="num w-8 text-left">{st.satisfaction.toFixed(0)}</b>
                <span className={`num w-10 text-left text-xs ${st.lastDelta > 0.1 ? 'good' : st.lastDelta < -0.1 ? 'bad' : 'muted'}`}>{st.lastDelta > 0 ? '+' : ''}{st.lastDelta.toFixed(1)}</span>
              </div>
            );
          })}
        </div>
      </Section>
    </div>
  );
}

type Layer = 'unemployment' | 'income' | 'satisfaction' | 'investment' | 'infrastructure' | 'services';
const LAYERS: { id: Layer; label: string; fmt: (v: number) => string; good: boolean; min: number; max: number }[] = [
  { id: 'satisfaction', label: 'שביעות רצון', fmt: (v) => v.toFixed(0), good: true, min: 20, max: 70 },
  { id: 'unemployment', label: 'אבטלה', fmt: (v) => `${v.toFixed(1)}%`, good: false, min: 2, max: 9 },
  { id: 'income', label: 'הכנסה', fmt: (v) => `₪${Math.round(v).toLocaleString()}`, good: true, min: 9000, max: 18000 },
  { id: 'investment', label: 'השקעות', fmt: (v) => v.toFixed(0), good: true, min: 30, max: 70 },
  { id: 'infrastructure', label: 'תשתיות', fmt: (v) => v.toFixed(0), good: true, min: 30, max: 80 },
  { id: 'services', label: 'שירותים', fmt: (v) => v.toFixed(0), good: true, min: 30, max: 70 },
];

export function MapScreen() {
  const s = useGame((x) => x.game)!;
  const [layer, setLayer] = useState<Layer>('satisfaction');
  const [sel, setSel] = useState<RegionId>('center');
  const L = LAYERS.find((l) => l.id === layer)!;
  const color = (v: number) => {
    let t = Math.max(0, Math.min(1, (v - L.min) / (L.max - L.min)));
    if (!L.good) t = 1 - t;
    return `hsl(${Math.round(t * 130)}, 65%, ${38 + t * 8}%)`;
  };
  const r = s.population.regions[sel];
  const rd = REGIONS.find((x) => x.id === sel)!;
  const projects = s.projects.filter((p) => p.region === sel && p.status !== 'cancelled');
  return (
    <div className="space-y-4">
      <ScreenHeader title="מפת צבריה" sub="בחר שכבת מידע ולחץ על אזור." right={<Tabs value={layer} onChange={setLayer} items={LAYERS.map((l) => ({ id: l.id, label: l.label }))} />} />
      <div className="grid md:grid-cols-[minmax(0,340px)_1fr] gap-4">
        <div className="card flex justify-center">
          <svg viewBox="40 0 220 600" style={{ width: '100%', maxWidth: 300, maxHeight: '70vh' }}>
            <rect x="0" y="0" width="80" height="600" fill="rgba(91,140,255,.08)" />
            {REGIONS.map((reg) => {
              const v = s.population.regions[reg.id][layer];
              return (
                <g key={reg.id} onClick={() => setSel(reg.id)} style={{ cursor: 'pointer' }}>
                  <path d={reg.path} fill={color(v)} stroke={sel === reg.id ? '#ffc53d' : '#0a0f1f'} strokeWidth={sel === reg.id ? 3 : 1.5} opacity={sel === reg.id ? 1 : 0.88}><title>{`${reg.name}: ${L.fmt(v)}`}</title></path>
                  <text x={reg.labelX} y={reg.labelY} textAnchor="middle" fontSize="10" fontWeight="700" fill="white" style={{ pointerEvents: 'none' }}>{L.fmt(v)}</text>
                </g>
              );
            })}
          </svg>
        </div>
        <Section title={rd.name} icon="📍">
          <p className="text-sm muted mb-3">{rd.blurb}</p>
          <div className="grid grid-cols-2 gap-2">
            {LAYERS.map((l) => (
              <div key={l.id} className="inset" style={l.id === layer ? { borderColor: 'var(--gold)' } : undefined}>
                <div className="label">{l.label}</div><div className="font-black num">{l.fmt(r[l.id])}</div>
              </div>
            ))}
            <div className="inset"><div className="label">חלק מהאוכלוסייה</div><div className="font-black num">{(r.populationShare * 100).toFixed(0)}%</div></div>
          </div>
          <div className="mt-3">
            <div className="label mb-1">פרויקטים באזור</div>
            {projects.length ? projects.map((p) => <div key={p.id} className="text-sm">{p.icon} {p.name} · {p.status === 'done' ? '✅ הושלם' : `${p.progress.toFixed(0)}%`}</div>) : <div className="text-sm muted">אין. התושבים כבר רגילים.</div>}
          </div>
        </Section>
      </div>
    </div>
  );
}
