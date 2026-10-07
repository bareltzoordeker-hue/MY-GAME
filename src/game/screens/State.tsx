import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { COUNTRY_OUTLINE, GAZA_PATH, GROUPS, REGIONS, REGION_Z, SERVICES } from '../../data/world';
import { fundingRatio, serviceDrivers } from '../../engine/services';
import { world } from '../../engine/security';
import { AREA_CITIES, AREA_C_MARKERS, GUSH_DAN, GUSH_DAN_ROADS, WEST_BANK_OUTLINE, type AreaCityDef, type CityDef } from '../../data/mapDetail';
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

type MapView = 'country' | 'gushdan' | 'abc';

export function MapScreen() {
  const s = useGame((x) => x.game)!;
  const setScreen = useGame((x) => x.setScreen);
  const [layer, setLayer] = useState<Layer>('satisfaction');
  const [view, setView] = useState<MapView>('country');
  const [sel, setSel] = useState<RegionId>('center');
  const [cityId, setCityId] = useState('tel_aviv');
  const L = LAYERS.find((l) => l.id === layer)!;
  const color = (v: number) => {
    let t = Math.max(0, Math.min(1, (v - L.min) / (L.max - L.min)));
    if (!L.good) t = 1 - t;
    return `hsl(${Math.round(t * 130)}, 65%, ${38 + t * 8}%)`;
  };
  const r = s.population.regions[sel];
  const rd = REGIONS.find((x) => x.id === sel)!;
  const projects = s.projects.filter((p) => p.region === sel && p.status !== 'cancelled');
  const cityValue = (c: CityDef, l: Layer) => {
    const base = s.population.regions.center[l];
    return l === 'income' || l === 'unemployment' ? base * c.mod[l] : base + c.mod[l];
  };
  const city = GUSH_DAN.find((c) => c.id === cityId)!;
  const w = world(s);
  const pick = (set: () => void) => ({
    role: 'button' as const, tabIndex: 0, style: { cursor: 'pointer' }, onClick: set,
    onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); set(); } },
  });
  // radius grows with the square root of the share, so the painted area follows the percentage
  const rA = (c: AreaCityDef) => 14 * c.size * Math.sqrt(w.areas.A / 18);
  const rB = (c: AreaCityDef) => rA(c) + 13 * Math.sqrt(w.areas.B / 22);
  const centerProjects = s.projects.filter((p) => p.region === 'center' && p.status !== 'cancelled');
  return (
    <div className="space-y-4">
      <ScreenHeader title="מפת ישמעאל" sub={view === 'country' ? 'בחר שכבת מידע ולחץ על אזור.' : view === 'gushdan' ? 'גוש דן מקרוב: ערים, כבישים ורכבת קלה. בחר שכבת מידע ולחץ על עיר.' : 'יהודה ושומרון לפי הסכמי אוסלו: שטחים A, B ו-C.'}
        right={view === 'abc' ? undefined : <Tabs value={layer} onChange={setLayer} items={LAYERS.map((l) => ({ id: l.id, label: l.label }))} />} />
      <Tabs value={view} onChange={setView} items={[{ id: 'country', label: '🗺️ כל המדינה' }, { id: 'gushdan', label: '🏙️ גוש דן – מפה מפורטת' }, { id: 'abc', label: '🧭 שטחי A / B / C' }]} />
      <div className="grid md:grid-cols-[minmax(0,340px)_1fr] gap-4">
        <div className="card flex justify-center">
          {view === 'country' && (
            <svg viewBox="0 0 260 600" style={{ width: '100%', maxWidth: 300, maxHeight: '72vh' }}>
              <defs><clipPath id="country-clip"><path d={COUNTRY_OUTLINE} /></clipPath></defs>
              <rect x="0" y="0" width="260" height="600" rx="10" fill="rgba(91,140,255,.10)" />
              <path d={GAZA_PATH} fill="rgba(120,130,150,.45)" stroke="rgba(120,130,150,.8)" strokeWidth="1" />
              <g clipPath="url(#country-clip)">
                {[...REGIONS].sort((a, b) => REGION_Z.indexOf(a.id as typeof REGION_Z[number]) - REGION_Z.indexOf(b.id as typeof REGION_Z[number])).map((reg) => {
                  const v = s.population.regions[reg.id][layer];
                  return (
                    <path key={reg.id} d={reg.path} fill={color(v)} stroke={sel === reg.id ? '#ffc53d' : '#0a0f1f'} strokeWidth={sel === reg.id ? 2.5 : 1} opacity={sel === reg.id ? 1 : 0.9} style={{ cursor: 'pointer' }} onClick={() => setSel(reg.id)}><title>{`${reg.name}: ${L.fmt(v)}`}</title></path>
                  );
                })}
              </g>
              <path d={COUNTRY_OUTLINE} fill="none" stroke="#0a0f1f" strokeWidth="1.6" style={{ pointerEvents: 'none' }} />
              {REGIONS.map((reg) => (
                <text key={reg.id} x={reg.labelX} y={reg.labelY} textAnchor="middle" fontSize="9.5" fontWeight="800" fill="white" stroke="rgba(0,0,0,.35)" strokeWidth=".5" style={{ pointerEvents: 'none' }}>{L.fmt(s.population.regions[reg.id][layer])}</text>
              ))}
              <text x="14" y="300" fontSize="9" fill="currentColor" opacity=".55" transform="rotate(-90 14 300)" textAnchor="middle">הים התיכון</text>
            </svg>
          )}
          {view === 'gushdan' && (
            <svg viewBox="0 0 320 360" style={{ width: '100%', maxWidth: 340, maxHeight: '72vh' }} role="group" aria-label="מפת גוש דן">
              <rect x="0" y="0" width="320" height="360" rx="10" fill="rgba(120,130,150,.12)" />
              <path d="M0,0 L52,0 Q36,60 46,120 Q56,190 40,250 Q30,310 48,360 L0,360 Z" fill="rgba(91,140,255,.22)" />
              <text x="14" y="190" fontSize="9" fill="currentColor" opacity=".6" transform="rotate(-90 14 190)" textAnchor="middle">הים התיכון</text>
              <path d={GUSH_DAN_ROADS.ayalon} stroke="#9aa4b8" strokeWidth="5" fill="none" opacity=".55" />
              <path d={GUSH_DAN_ROADS.lightRail} stroke="#e5484d" strokeWidth="3" strokeDasharray="6 4" fill="none" opacity=".85" />
              <text x="196" y="340" fontSize="8" fill="currentColor" opacity=".7">כביש איילון</text>
              <text x="58" y="172" fontSize="8" fill="#e5484d">הרכבת הקלה</text>
              {GUSH_DAN.map((c) => {
                const v = cityValue(c, layer);
                return (
                  <g key={c.id} {...pick(() => setCityId(c.id))} aria-label={`${c.name}: ${L.fmt(v)}`}>
                    <circle cx={c.x} cy={c.y} r={c.r} fill={color(v)} stroke={cityId === c.id ? '#ffc53d' : '#0a0f1f'} strokeWidth={cityId === c.id ? 3 : 1.5} opacity={cityId === c.id ? 1 : 0.9}><title>{`${c.name}: ${L.fmt(v)}`}</title></circle>
                    <text x={c.x} y={c.y + 3} textAnchor="middle" fontSize={c.r > 18 ? 10 : 8} fontWeight="800" fill="white" style={{ pointerEvents: 'none' }}>{L.fmt(v)}</text>
                    <text x={c.x} y={c.y + c.r + 10} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor" style={{ pointerEvents: 'none' }}>{c.name}</text>
                  </g>
                );
              })}
            </svg>
          )}
          {view === 'abc' && (
            <svg viewBox="0 0 260 380" style={{ width: '100%', maxWidth: 320, maxHeight: '72vh' }} role="img" aria-label={`שטח A ${w.areas.A}%, שטח B ${w.areas.B}%, שטח C ${w.areas.C}%`}>
              <path d={WEST_BANK_OUTLINE} fill="#5b4bdb" fillOpacity=".38" stroke="#5b4bdb" strokeWidth="2" />
              {AREA_C_MARKERS.map(([x, y], i) => <rect key={i} x={x - 2.5} y={y - 2.5} width="5" height="5" fill="#fff" opacity=".8" />)}
              {AREA_CITIES.map((c) => <circle key={`b${c.id}`} cx={c.x} cy={c.y} r={rB(c)} fill="#d9a400" fillOpacity=".85" />)}
              {AREA_CITIES.map((c) => <circle key={`a${c.id}`} cx={c.x} cy={c.y} r={rA(c)} fill="#2e9e5b" />)}
              {AREA_CITIES.map((c) => <text key={`t${c.id}`} x={c.x} y={c.y + 3} textAnchor="middle" fontSize="8" fontWeight="800" fill="white" style={{ pointerEvents: 'none' }}>{c.name}</text>)}
            </svg>
          )}
        </div>
        {view === 'country' && (
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
            {sel === 'center' && <button type="button" className="btn btn-sm mt-3" data-tip="פותח מפה מפורטת של גוש דן: ערים, כבישים ורכבת קלה" onClick={() => setView('gushdan')}>🏙️ מפה מפורטת של גוש דן</button>}
            {sel === 'judea_samaria' && <button type="button" className="btn btn-sm mt-3" data-tip="מציג את חלוקת השטחים A, B ו-C לפי הסכמי אוסלו" onClick={() => setView('abc')}>🧭 שטחי A / B / C</button>}
            <div className="mt-3">
              <div className="label mb-1">פרויקטים באזור</div>
              {projects.length ? projects.map((p) => <div key={p.id} className="text-sm">{p.icon} {p.name} · {p.status === 'done' ? '✅ הושלם' : `${p.progress.toFixed(0)}%`}</div>) : <div className="text-sm muted">אין. התושבים כבר רגילים.</div>}
            </div>
          </Section>
        )}
        {view === 'gushdan' && (
          <Section title={city.name} icon="🏙️">
            <p className="text-sm muted mb-3">{city.blurb}</p>
            <div className="grid grid-cols-2 gap-2">
              {LAYERS.map((l) => (
                <div key={l.id} className="inset" style={l.id === layer ? { borderColor: 'var(--gold)' } : undefined}>
                  <div className="label">{l.label}</div><div className="font-black num">{l.fmt(cityValue(city, l.id))}</div>
                </div>
              ))}
            </div>
            <p className="text-xs muted mt-3">ערכי העיר מחושבים לפי ערך אזור גוש דן, בתוספת מאפיין מקומי קבוע. המפה סכמטית ולא לפי קנה מידה.</p>
            <div className="mt-3">
              <div className="label mb-1">פרויקטים בגוש דן</div>
              {centerProjects.length
                ? centerProjects.map((p) => <div key={p.id} className="text-sm">{p.icon} {p.name} · {p.status === 'done' ? '✅ הושלם' : `${p.progress.toFixed(0)}%`}</div>)
                : <div className="text-sm muted">אין. התושבים כבר רגילים.</div>}
            </div>
          </Section>
        )}
        {view === 'abc' && (
          <Section title="יהודה ושומרון: שטחי A / B / C" icon="🧭">
            <p className="text-sm muted mb-3">לפי הסכמי אוסלו. שטח A: שליטה אזרחית וביטחונית פלסטינית. שטח B: אזרחית פלסטינית, ביטחונית ישמעאלית. שטח C: שליטה ישמעאלית מלאה, כולל היישובים.</p>
            <div className="flex h-7 rounded-lg overflow-hidden text-xs font-bold text-white" aria-hidden="true">
              <div style={{ width: `${w.areas.A}%`, background: '#2e9e5b' }} className="grid place-items-center">A {w.areas.A}%</div>
              <div style={{ width: `${w.areas.B}%`, background: '#d9a400' }} className="grid place-items-center">B {w.areas.B}%</div>
              <div style={{ width: `${w.areas.C}%`, background: '#5b4bdb' }} className="grid place-items-center">C {w.areas.C}%</div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="inset"><div className="label">שטח A</div><div className="font-black num">{w.areas.A}%</div></div>
              <div className="inset"><div className="label">שטח B</div><div className="font-black num">{w.areas.B}%</div></div>
              <div className="inset"><div className="label">שטח C</div><div className="font-black num">{w.areas.C}%</div></div>
            </div>
            <ul className="text-sm mt-3 space-y-1">
              <li><span className="chip" style={{ background: '#2e9e5b', color: '#fff' }}>A</span> ערים פלסטיניות: ג׳נין, שכם, טול כרם, קלקיליה, רמאללה, יריחו, בית לחם וחברון.</li>
              <li><span className="chip" style={{ background: '#d9a400', color: '#fff' }}>B</span> הכפרים והסביבה של הערים.</li>
              <li><span className="chip" style={{ background: '#5b4bdb', color: '#fff' }}>C</span> שאר השטח, כולל היישובים הישמעאליים (הריבועים הלבנים).</li>
            </ul>
            <p className="text-xs muted mt-3">המפה סכמטית ולא לפי קנה מידה. גודל המעגלים משתנה עם האחוזים כשהממשלה מעבירה שטח.</p>
            <button type="button" className="btn btn-sm mt-3" data-tip="פותח את מסך הביטחון והדיפלומטיה, שם מעבירים שטח בין האזורים" onClick={() => setScreen('security')}>🛡️ לביטחון ולדיפלומטיה</button>
          </Section>
        )}
      </div>
    </div>
  );
}
