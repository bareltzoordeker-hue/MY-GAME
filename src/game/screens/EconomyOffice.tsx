// The economy minister's office: GDP and the economy at a glance, foreign trade by country, and the trade moves.
import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { growthDrivers } from '../../engine/economy';
import { isEconomyMinister } from '../../engine/roles';
import { SECTORS, computeTrade, tradeState } from '../../engine/trade';
import { ActionButton, Empty, Explain, Meter, ScreenHeader, Section } from '../components/ui';

const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 0 });
const fix = (n: number, d = 1) => n.toFixed(d);

export function EconomyOfficeScreen() {
  const s = useGame((x) => x.game)!;
  const [country, setCountry] = useState('usa');
  const [sector, setSector] = useState('tech');
  if (s.player.role !== 'pm' && !isEconomyMinister(s)) return <Empty icon="📈" text="מסך שר הכלכלה פתוח לשר הכלכלה ולראש הממשלה." />;
  const e = s.economy;
  const t = computeTrade(s);
  const ts = tradeState(s);
  const sel = t.rows.find((r) => r.id === country);
  const biggest = [...t.rows].sort((a, b) => b.exports - a.exports)[0];
  const risky = t.rows.filter((r) => r.exports / t.totalExports > 0.1 && r.rel < 30);
  const drivers = growthDrivers(s);
  const params = { country };
  return (
    <div className="space-y-4">
      <ScreenHeader title="לשכת שר הכלכלה" sub="המשק, הסחר עם העולם והפעולות שמשפיעות עליהם. מהלכים שעולים כסף דורשים את אישור ראש הממשלה." />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ['תמ״ג', `₪${fmt(e.gdp)}B`, `צמיחה ${fix(e.growth)}%`, 'gdp'],
          ['אבטלה', `${fix(e.unemployment)}%`, `אינפלציה ${fix(e.inflation)}%`, 'unemployment'],
          ['ייצוא', `₪${fmt(t.totalExports)}B`, `${fix(t.exportsPctGdp)}% מהתמ״ג`, 'exports'],
          ['ייבוא', `₪${fmt(t.totalImports)}B`, `${fix(t.importsPctGdp)}% מהתמ״ג`, 'imports'],
        ].map(([l, v, sub, k]) => (
          <div key={l} className="card card-tight"><div className="label flex items-center gap-1">{l}<Explain k={k} /></div><div className="text-2xl font-black num">{v}</div><div className="text-[11px] muted">{sub}</div></div>
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-3">
        <div className="card card-tight"><div className="label flex items-center gap-1">מאזן סחר<Explain k="tradeBalance" /></div><div className={`text-2xl font-black num ${t.balance < 0 ? 'bad' : 'good'}`}>{`${t.balance >= 0 ? '+' : ''}₪${fmt(t.balance)}B`}</div><div className="text-[11px] muted">{t.balance >= 0 ? 'עודף: הייצוא גדול מהייבוא' : 'גירעון: הייבוא גדול מהייצוא'}</div></div>
        <div className="card card-tight"><div className="label">השותפה הגדולה ביותר</div><div className="text-xl font-black">{biggest.name}</div><div className="text-[11px] muted">{`₪${fmt(biggest.exports)}B ייצוא, ${fix((biggest.exports / t.totalExports) * 100, 0)}% מכלל הייצוא`}</div></div>
      </div>
      {risky.length > 0 && <div className="card text-sm" role="note">{`⚠️ תלות מסוכנת: ${risky.map((r) => r.name).join(', ')}. הן שותפות גדולות ליצוא, והיחסים איתן נמוכים.`}</div>}
      <Section title="סחר לפי מדינה" icon="🌐">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-xs muted"><th className="text-right p-1">מדינה</th><th className="p-1"><span className="inline-flex items-center gap-1">יחסים<Explain k="relation" /></span></th><th className="p-1"><span className="inline-flex items-center gap-1">ייצוא<Explain k="exports" /></span></th><th className="p-1"><span className="inline-flex items-center gap-1">ייבוא<Explain k="imports" /></span></th><th className="p-1"><span className="inline-flex items-center gap-1">מאזן<Explain k="tradeBalance" /></span></th><th className="p-1"></th></tr></thead>
            <tbody>
              {t.rows.map((r) => (
                <tr key={r.id} onClick={() => setCountry(r.id)} className="cursor-pointer" style={r.id === country ? { background: 'rgba(212,168,60,.15)' } : undefined}>
                  <td className="p-1 font-bold"><button type="button" aria-pressed={r.id === country} onClick={() => setCountry(r.id)} className="text-right">{r.name}</button></td>
                  <td className="p-1 w-28"><div className="flex items-center gap-1"><div className="flex-1"><Meter value={r.rel} /></div><span className="num text-xs">{fix(r.rel, 0)}</span></div></td>
                  <td className="p-1 num text-center">{fix(r.exports)}</td>
                  <td className="p-1 num text-center">{fix(r.imports)}</td>
                  <td className={`p-1 num text-center ${r.exports - r.imports < 0 ? 'bad' : 'good'}`}>{fix(r.exports - r.imports)}</td>
                  <td className="p-1 text-xs">{r.deal && <span className="chip chip-good" data-tip="הסכם סחר">📦</span>}{r.pact && <span className="chip" data-tip="הסכם שיתוף פעולה">🤝</span>}{r.tariff && <span className="chip chip-warn" data-tip="מכסים">🚧</span>}{r.boost && <span className="chip chip-good" data-tip="מבצע ייצוא פעיל">🚢</span>}</td>
                </tr>
              ))}
              <tr className="text-xs muted"><td className="p-1">שאר העולם</td><td className="p-1"></td><td className="p-1 num text-center">{fix(t.restExports)}</td><td className="p-1 num text-center">{fix(t.restImports)}</td><td className="p-1 num text-center">{fix(t.restExports - t.restImports)}</td><td></td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-[11px] muted mt-2">הנתונים הם הערכה לצורכי המשחק (במיליארדי ₪ לשנה), לא נתונים רשמיים. לחץ על שורה כדי לבחור מדינה לפעולה.</p>
      </Section>
      <Section title="פעולות סחר" icon="📦">
        <p className="text-sm muted mb-2">{`המדינה שנבחרה: ${sel?.name}.`}</p>
        <div className="flex flex-wrap gap-2">
          <ActionButton id="eco_trade_deal" params={params} className="btn btn-sm btn-good">📦 הסכם סחר</ActionButton>
          <ActionButton id="eco_export_drive" params={params} className="btn btn-sm btn-blue">🚢 מבצע ייצוא</ActionButton>
          <Explain k="tariff" /><ActionButton id="eco_tariff" params={{ ...params, mode: 'impose' }} className="btn btn-sm btn-danger" confirm="להטיל מכסים? זה מוריד ייבוא אבל פוגע בייצוא וביחסים.">🚧 הטלת מכסים</ActionButton>
          {ts.tariffs.includes(country) && <ActionButton id="eco_tariff" params={{ ...params, mode: 'remove' }} className="btn btn-sm">✅ ביטול מכסים</ActionButton>}
        </div>
        <div className="flex flex-wrap gap-2 mt-3 items-center">
          <select aria-label="ענף לסיוע" value={sector} onChange={(e2) => setSector(e2.target.value)}>{Object.entries(SECTORS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
          <ActionButton id="eco_industry_aid" params={{ sector }} className="btn btn-sm">🏭 סיוע לענף</ActionButton>
        </div>
      </Section>
      <Section title="מה מניע את הצמיחה" icon="📈" right={<Explain k="growthDrivers" />}>
        <div className="space-y-1">
          {drivers.map((d) => (
            <div key={d.label} className="flex items-center gap-2 text-sm"><span className="w-40 shrink-0">{d.label}</span><span className={`num font-bold w-14 ${d.value < 0 ? 'bad' : d.value > 0 ? 'good' : ''}`}>{`${d.value >= 0 ? '+' : ''}${fix(d.value, 2)}`}</span></div>
          ))}
        </div>
      </Section>
    </div>
  );
}
