import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, BarChart, Bar, Cell } from 'recharts';
import { useGame } from '../store/gameStore';
import { CATEGORIES, TAX_NAMES } from '../../data/world';
import { growthDrivers } from '../../engine/economy';
import { fundingRatio } from '../../engine/services';
import { getCapabilities, isPM, playerMinistry } from '../../engine/roles';
import { debtPct, deficitPct } from '../../utils';
import { MONTHS_HE } from '../../engine/calendar';
import type { BudgetCategory, GameDate } from '../../types/game';
import { ActionButton, Explain, Meter, ScreenHeader, Section, Stat, Tabs } from '../components/ui';

const axisLabel = (d: GameDate | undefined, turn: number) => (d ? `${d.day ? `${d.day}.` : ''}${MONTHS_HE[d.month - 1].slice(0, 3)} ${String(d.year).slice(2)}` : `תור ${turn}`);
const tooltipStyle = { background: '#fff', border: '0', borderRadius: 12, fontSize: 12, color: '#1d1b3a', boxShadow: '0 10px 24px -10px rgba(60,40,160,.5)' };

export function EconomyScreen() {
  const s = useGame((x) => x.game)!;
  const [chart, setChart] = useState<'growth' | 'jobs' | 'fiscal' | 'mood'>('growth');
  const e = s.economy;
  const pm = isPM(s);
  const isFinance = s.player.role === 'minister' && (playerMinistry(s)?.origins ?? [playerMinistry(s)?.id]).includes('finance');
  const data = s.history.map((h) => ({ t: axisLabel(h.date, h.turn), growth: +h.growth.toFixed(2), unemployment: +h.unemployment.toFixed(2), inflation: +h.inflation.toFixed(2), deficit: +h.deficitPct.toFixed(2), debt: +h.debtPct.toFixed(1), approval: +h.approval.toFixed(1), services: +h.servicesAvg.toFixed(1) }));
  const lines: Record<typeof chart, { k: string; n: string; c: string }[]> = {
    growth: [{ k: 'growth', n: 'צמיחה %', c: '#2bd47d' }, { k: 'inflation', n: 'אינפלציה %', c: '#ff9f1c' }],
    jobs: [{ k: 'unemployment', n: 'אבטלה %', c: '#ff5d6c' }],
    fiscal: [{ k: 'deficit', n: 'גירעון %', c: '#ff5d6c' }, { k: 'debt', n: 'חוב/תוצר %', c: '#5b8cff' }],
    mood: [{ k: 'approval', n: 'שביעות רצון', c: '#ffc53d' }, { k: 'services', n: 'שירותים', c: '#2bd47d' }],
  };
  const drivers = growthDrivers(s);
  return (
    <div className="space-y-4">
      <ScreenHeader title="כלכלה" sub="המספרים מגיעים מהסימולציה. ההסברים – מהיועץ." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon="🏭" label="תוצר שנתי" value={`₪${(e.gdp / 1000).toFixed(2)}T`} sub={`הכנסה ממוצעת ₪${Math.round(e.avgIncome).toLocaleString()}`} />
        <Stat icon="📈" label="צמיחה" value={`${e.growth.toFixed(1)}%`} k="growth" />
        <Stat icon="🔥" label="אינפלציה" value={`${e.inflation.toFixed(1)}%`} k="inflation" tone={e.inflation > 4.5 ? 'bad' : undefined} />
        <Stat icon="👷" label="אבטלה" value={`${e.unemployment.toFixed(1)}%`} k="unemployment" />
        <Stat icon="💵" label="הכנסות" value={`₪${e.revenue.toFixed(0)}B`} k="revenue" sub="בשנה" />
        <Stat icon="💸" label="הוצאות" value={`₪${e.spending.toFixed(0)}B`} k="spending" sub={`ריבית: ₪${s.budget.debtInterest.toFixed(0)}B`} />
        <Stat icon="📉" label="גירעון" value={`${deficitPct(s).toFixed(1)}%`} k="deficit" sub={`₪${e.deficit.toFixed(1)}B`} tone={deficitPct(s) > 5 ? 'bad' : undefined} />
        <Stat icon="🏦" label="חוב" value={`${debtPct(s).toFixed(0)}%`} k="debt" sub={`דירוג ${e.creditRating} · ריבית ${e.interestRate.toFixed(2)}%`} />
      </div>

      <Section title="מגמות" icon="📊" right={<Tabs value={chart} onChange={setChart} items={[{ id: 'growth', label: 'צמיחה' }, { id: 'jobs', label: 'תעסוקה' }, { id: 'fiscal', label: 'גירעון וחוב' }, { id: 'mood', label: 'ציבור' }]} />}>
        <div style={{ height: 240 }} dir="ltr">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="#e8edf5" />
              <XAxis dataKey="t" stroke="#4a5872" fontSize={11} />
              <YAxis stroke="#4a5872" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              {lines[chart].map((l) => <Line key={l.k} type="monotone" dataKey={l.k} name={l.n} stroke={l.c} strokeWidth={2.5} dot={false} />)}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="מה מניע את הצמיחה?" icon="⚙️" right={<Explain k="growthDrivers" />}>
          <div className="space-y-1.5">
            {drivers.filter((d) => Math.abs(d.value) >= 0.01).map((d) => (
              <div key={d.label} className="flex items-center gap-2 text-sm">
                <span className="w-32 shrink-0">{d.label}</span>
                <div className="flex-1 h-2 relative rounded-full" style={{ background: '#e8edf5' }}>
                  <div className="absolute top-0 h-2 rounded-full" style={{ [d.value >= 0 ? 'right' : 'left']: '50%', width: `${Math.min(50, Math.abs(d.value) * 12)}%`, background: d.value >= 0 ? 'var(--good)' : 'var(--bad)' }} />
                </div>
                <span className={`num w-12 text-left font-bold ${d.value >= 0 ? 'good' : 'bad'}`}>{d.value > 0 ? '+' : ''}{d.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="מסים" icon="🧾" right={!pm && <span className="chip">רק ראש הממשלה</span>}>
          <div className="space-y-3">
            {(Object.keys(TAX_NAMES) as (keyof typeof TAX_NAMES)[]).map((t) => (
              <div key={t} className="inset flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold">{TAX_NAMES[t]}</div>
                  <div className="text-xs muted">{t === 'vat' ? 'פוגע בעיקר במשפחות ובהכנסה נמוכה' : t === 'incomeTax' ? 'פוגע במעמד הביניים ובשכירים' : 'פוגע בעסקים ובצמיחה'}</div>
                </div>
                <div className="flex items-center gap-2">
                  {pm && <ActionButton id="set_tax" params={{ tax: t, delta: -1 }} className="btn btn-sm">−1</ActionButton>}
                  <span className="text-xl font-black num w-14 text-center">{e.taxes[t].toFixed(1)}%</span>
                  {pm && <ActionButton id="set_tax" params={{ tax: t, delta: 1 }} className="btn btn-sm">+1</ActionButton>}
                </div>
              </div>
            ))}
            <p className="text-xs muted">{pm ? `שינוי של 2% ומעלה דורש ישיבת ממשלה. כל אחוז מס הכנסה ≈ ₪${(e.gdp * 0.0052).toFixed(0)}B בשנה.` : isFinance ? 'כשר האוצר אתה מציע שינויי מס ממסך המשרד, וראש הממשלה מאשר או דוחה.' : 'מסים קובע ראש הממשלה. אתה יכול רק להתלונן עליהם בטלוויזיה.'}</p>
            {isFinance && <button className="btn btn-sm btn-blue" onClick={() => useGame.getState().goTo('ministry', 'ministry_action:propose_income_cut')} data-tip="למסך משרד האוצר, להצעות שינוי מס">💰 להצעות מס במשרד</button>}
          </div>
        </Section>
      </div>

      {pm && (
        <Section title="כלים פיסקליים" icon="🧰">
          <div className="grid sm:grid-cols-3 gap-3">
            <Tool title="חבילת גירוי" desc="₪8B חד-פעמי. צמיחה ↑ אבטלה ↓ אינפלציה ↑ חוב ↑" id="stimulus" icon="🚀" />
            <Tool title="תוכנית צנע" desc="קיצוץ 3% בכל המשרדים חוץ מביטחון" id="austerity" icon="🪓" />
            <Tool title="אכיפת מס" desc="+₪5B זמני להכנסות. עצמאים כועסים" id="tax_enforcement" icon="🔍" />
          </div>
        </Section>
      )}
    </div>
  );
}

function Tool({ title, desc, id, icon }: { title: string; desc: string; id: string; icon: string }) {
  return (
    <div className="inset flex flex-col gap-2">
      <div className="font-bold">{icon} {title}</div>
      <div className="text-xs muted flex-1">{desc}</div>
      <ActionButton id={id} className="btn btn-sm">הפעל</ActionButton>
    </div>
  );
}

export function BudgetScreen() {
  const s = useGame((x) => x.game)!;
  const caps = getCapabilities(s);
  const myMin = playerMinistry(s);
  const total = CATEGORIES.reduce((a, c) => a + s.budget.allocations[c.id], 0);
  const chartData = CATEGORIES.map((c) => ({ name: c.name, v: +s.budget.allocations[c.id].toFixed(1), need: +s.budget.needs[c.id].toFixed(1), r: s.budget.allocations[c.id] / s.budget.needs[c.id] }));
  return (
    <div className="space-y-4">
      <ScreenHeader
        title={`תקציב ${s.budget.fiscalYear}`}
        sub={caps.canManageBudget ? 'כל שינוי עולה כסף או מכאיב למישהו. בדרך כלל שניהם.' : 'צפייה בלבד – רק ראש הממשלה מחלק את התקציב.'}
        right={
          <div className="flex gap-2 items-center">
            <span className={`chip ${s.budget.passed ? 'chip-good' : 'chip-warn'}`}>{s.budget.passed ? '✅ התקציב אושר' : '⏳ ממתין לאישור הכנסטון'}</span>
            {!s.budget.passed && <ActionButton id="submit_budget" className="btn btn-primary btn-sm">📒 הגש לכנסטון</ActionButton>}
            {s.player.role === 'minister' && <ActionButton id="ministry_request_budget" className="btn btn-blue btn-sm">🙏 בקש תוספת למשרד</ActionButton>}
          </div>
        }
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon="💰" label="תקציב המשרדים" value={`₪${total.toFixed(0)}B`} />
        <Stat icon="🏗️" label="פרויקטים" value={`₪${s.budget.projectSpending.toFixed(1)}B`} sub="בשנה" />
        <Stat icon="🏦" label="ריבית על החוב" value={`₪${s.budget.debtInterest.toFixed(1)}B`} />
        <Stat icon="📉" label="גירעון" value={`${deficitPct(s).toFixed(1)}%`} k="deficit" />
      </div>
      <Section title="חלוקה מול צורך" icon="📊" right={<Explain k="funding" />}>
        <div style={{ height: 220 }} dir="ltr">
          <ResponsiveContainer>
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" stroke="#4a5872" fontSize={10} interval={0} angle={-30} textAnchor="end" height={50} />
              <YAxis stroke="#4a5872" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`₪${v}B`, n === 'v' ? 'מוקצה' : 'נדרש']} />
              <Bar dataKey="need" fill="#d6deea" radius={[4, 4, 0, 0]} />
              <Bar dataKey="v" radius={[4, 4, 0, 0]}>
                {chartData.map((d) => <Cell key={d.name} fill={d.r >= 1 ? '#2bd47d' : d.r > 0.92 ? '#ffb020' : '#ff5d6c'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Section>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {CATEGORIES.map((c) => <BudgetRow key={c.id} cat={c.id} highlight={myMin?.categories.includes(c.id)} />)}
      </div>
    </div>
  );
}

function BudgetRow({ cat, highlight }: { cat: BudgetCategory; highlight?: boolean }) {
  const s = useGame((x) => x.game)!;
  const c = CATEGORIES.find((x) => x.id === cat)!;
  const a = s.budget.allocations[cat];
  const n = s.budget.needs[cat];
  const r = a / n;
  const svc = c.services[0];
  const step = Math.max(0.5, Math.round(a * 0.05 * 2) / 2);
  const canEdit = getCapabilities(s).canManageBudget;
  return (
    <div className="card card-tight card-hover" style={highlight ? { borderColor: 'var(--gold)' } : undefined}>
      <div className="flex justify-between items-start">
        <div>
          <div className="font-bold">{c.icon} {c.name}</div>
          <div className="text-xs muted">נדרש: ₪{n.toFixed(1)}B</div>
        </div>
        <div className="text-left">
          <div className="text-xl font-black num">₪{a.toFixed(1)}B</div>
          <div className={`text-xs num font-bold ${r >= 1 ? 'good' : r > 0.92 ? 'warn' : 'bad'}`}>{(r * 100).toFixed(0)}% מהצורך</div>
        </div>
      </div>
      <div className="my-2"><Meter value={r * 100} max={130} /></div>
      {svc && <div className="text-xs muted mb-2">איכות {s.services[svc].quality.toFixed(0)} · מימון השירות {(fundingRatio(s, svc) * 100).toFixed(0)}%</div>}
      {canEdit ? (
        <div className="flex gap-1.5 flex-wrap">
          <ActionButton id="adjust_budget" params={{ category: cat, delta: -step }} className="btn btn-sm btn-danger">−₪{step}B</ActionButton>
          <ActionButton id="adjust_budget" params={{ category: cat, delta: step }} className="btn btn-sm btn-good">+₪{step}B</ActionButton>
          <ActionButton id="adjust_budget" params={{ category: cat, delta: +(a * 0.1).toFixed(1) }} className="btn btn-sm">+10%</ActionButton>
        </div>
      ) : highlight ? (
        <ActionButton id="ministry_request_budget" className="btn btn-sm btn-blue">🙏 בקש תוספת מראש הממשלה</ActionButton>
      ) : <div className="text-[11px] muted">באחריות ראש הממשלה</div>}
    </div>
  );
}
