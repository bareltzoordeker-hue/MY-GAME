// The foreign minister's office: relations with 14 countries and blocs, and the diplomatic moves.
import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { FOREIGN_LIST, foreignValue, hasAmbassador, hasPact, isContested } from '../../engine/foreign';
import { world } from '../../engine/security';
import { isForeignMinister } from '../../engine/roles';
import { ActionButton, Empty, Explain, Meter, ScreenHeader, Section } from '../components/ui';

export function ForeignOfficeScreen() {
  const s = useGame((x) => x.game)!;
  const w = world(s);
  const [country, setCountry] = useState('usa');
  const prev = w.relPrev ?? {};
  const params = { country };
  if (s.player.role !== 'pm' && !isForeignMinister(s)) return <Empty icon="🌍" text="מסך שר החוץ פתוח לשר החוץ ולראש הממשלה." />;
  const mood = (v: number) => (v >= 60 ? 'good' : v >= 35 ? '' : v >= 20 ? 'warn' : 'bad');
  return (
    <div className="space-y-4">
      <ScreenHeader title="לשכת שר החוץ" sub="יחסי החוץ של ישמעאל והפעולות הדיפלומטיות. מהלכים חריפים דורשים את אישור ראש הממשלה." />
      <Section title="יחסי חוץ" icon="🌍" right={<Explain k="relation" />}>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-2">
          {FOREIGN_LIST.map((c) => {
            const v = foreignValue(s, c.id);
            const d = c.id in prev ? v - prev[c.id] : 0;
            return (
              <button key={c.id} type="button" onClick={() => setCountry(c.id)} aria-pressed={country === c.id} className="inset text-right" style={country === c.id ? { outline: '2px solid var(--gold)' } : undefined}>
                <div className="flex items-center justify-between gap-2">
                  <b className="text-sm">{c.name}</b>
                  <span className="text-xs">
                    {hasPact(s, c.id) && <span className="chip chip-good" data-tip="נחתם הסכם שיתוף פעולה">🤝</span>}
                    {hasAmbassador(s, c.id) && <span className="chip" data-tip="יש שגריר">🏛️</span>}
                    {isContested(c.id) && <span className="chip chip-warn" data-tip="יחסים שנויים במחלוקת בבית">⚠️</span>}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1"><div className="flex-1"><Meter value={v} /></div><b className={`num ${mood(v)}`}>{v.toFixed(0)}</b></div>
                <div className="text-[11px] muted mt-0.5">{Math.abs(d) < 0.5 ? 'יציב' : d > 0 ? `↑ +${d.toFixed(0)} מאז התור הקודם` : `↓ ${d.toFixed(0)} מאז התור הקודם`}</div>
              </button>
            );
          })}
        </div>
      </Section>
      <Section title="פעולות דיפלומטיות" icon="🕊️">
        <p className="text-sm muted mb-2">{`המדינה שנבחרה: ${FOREIGN_LIST.find((c) => c.id === country)?.name}. לחץ על כרטיס מדינה למעלה כדי לבחור אחרת.`}</p>
        <div className="flex flex-wrap gap-2">
          <ActionButton id="fm_visit" params={params} className="btn btn-sm btn-blue">✈️ ביקור רשמי</ActionButton>
          <ActionButton id="fm_agreement" params={params} className="btn btn-sm btn-good">🤝 הסכם שיתוף פעולה</ActionButton>
          <ActionButton id="fm_statement" params={params} className="btn btn-sm btn-danger">📢 הצהרה חריפה</ActionButton>
          <ActionButton id="fm_summon" params={params} className="btn btn-sm">☎️ שיחת נזיפה עם השגריר</ActionButton>
          <ActionButton id="fm_ambassador" params={{ ...params, mode: 'appoint' }} className="btn btn-sm">🏛️ מינוי שגריר</ActionButton>
          <ActionButton id="fm_ambassador" params={{ ...params, mode: 'recall' }} className="btn btn-sm btn-danger" confirm="להחזיר את השגריר? זה צעד חריף שפוגע קשות ביחסים.">↩️ החזרת שגריר</ActionButton>
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <ActionButton id="fm_un_coalition" className="btn btn-sm">🌐 קואליציה באו״ם</ActionButton>
        </div>
      </Section>
    </div>
  );
}
