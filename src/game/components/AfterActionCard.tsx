// The report on the last planned operation: the phases, who was hurt, what was hit and what it will cost later.
import { UNIT_BY_ID, type UnitId } from '../../data/security';
import type { AfterAction } from '../../types/game';
import { Section } from './ui';

export function AfterActionCard({ r }: { r: AfterAction }) {
  return (
    <Section title="דוח אחרי פעולה" icon="📋">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <b>{`${r.opIcon} ${r.title}`}</b>
        <span className={`chip ${r.success ? 'chip-good' : 'chip-warn'}`}>{r.success ? 'הושלם' : 'תוצאות חלקיות'}</span>
      </div>
      <ol className="space-y-1 text-sm mb-3">
        {r.phases.map((p, i) => <li key={i} className={p.ok ? '' : 'bad'}>{`${p.icon} ${p.text}`}</li>)}
      </ol>
      <div className="grid sm:grid-cols-2 gap-2 text-sm">
        <div className="inset">{`🎯 ${r.targetName}: נפגע ${r.targetHitPct}%`}</div>
        <div className="inset">{`📉 הפחתת האיום בחזית: ${r.threatCut}`}</div>
        <div className="inset">{`⚠️ אזרחים בצד השני (הערכה): ${r.enemyCivilians}`}</div>
        <div className="inset">{`🏠 אזרחים שנהרגו בעורף: ${r.homeCivilians}`}</div>
      </div>
      {r.unitCasualties.length > 0 && (
        <div className="mt-3 text-sm">
          <div className="font-bold mb-1">🕯️ נפגעים לפי יחידה</div>
          <ul className="space-y-0.5">{r.unitCasualties.map((u) => <li key={u.unit}>{`${UNIT_BY_ID[u.unit as UnitId].name}: ${u.fallen}`}</li>)}</ul>
        </div>
      )}
      {r.intelFailure && <div className="mt-3 text-sm bad">{'🔎 כשל מודיעיני: חלק מהפגיעה לא היה מדויק.'}</div>}
      <div className="mt-3 text-sm">
        <div className="font-bold mb-1">⏳ השלכות ארוכות טווח</div>
        <ul className="space-y-0.5 muted">{r.longTerm.map((l, i) => <li key={i}>{l}</li>)}</ul>
      </div>
    </Section>
  );
}
