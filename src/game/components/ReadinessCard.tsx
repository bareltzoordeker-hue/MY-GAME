// Stocks and fresh intelligence: what the army has in the warehouse, and how current the intelligence on each front is.
import { FRONTS } from '../../data/security';
import { intelFreshOf, stockOf } from '../../engine/security';
import type { GameState } from '../../types/game';
import { ActionButton, Meter, Section } from './ui';

export function ReadinessCard({ s }: { s: GameState }) {
  const stk = stockOf(s);
  return (
    <Section title="מלאים ומודיעין" icon="📦">
      <div className="grid sm:grid-cols-2 gap-3 text-sm mb-3">
        <div data-tip="תחמושת מדויקת למבצעים. מתמלאת עם התקציב הביטחוני ומתרוקנת בתקיפות. מלאי נמוך מפחית את סיכויי ההצלחה.">
          <div className="flex justify-between"><span>🎯 תחמושת מדויקת</span><b className="num">{Math.round(stk.precision)}</b></div>
          <Meter value={stk.precision} />
        </div>
        <div data-tip="יירוטים של מערך ההגנה האווירית. מתרוקנים בירי לעבר העורף. מלאי נמוך מגדיל את הנזק לאזרחים.">
          <div className="flex justify-between"><span>🛰️ יירוטים</span><b className="num">{Math.round(stk.interceptors)}</b></div>
          <Meter value={stk.interceptors} />
        </div>
      </div>
      <div className="text-sm font-bold mb-1">רעננות המודיעין לפי חזית</div>
      <div className="space-y-1.5">
        {FRONTS.map((f) => (
          <div key={f.id} className="flex items-center gap-2 text-sm">
            <span className="w-28 shrink-0">{`${f.icon} ${f.name}`}</span>
            <div className="flex-1"><Meter value={intelFreshOf(s, f.id)} /></div>
            <b className="num w-8 text-end">{Math.round(intelFreshOf(s, f.id))}</b>
            <ActionButton id="refresh_intel" params={{ front: f.id }} className="btn btn-sm">📡 לרענן</ActionButton>
          </div>
        ))}
      </div>
    </Section>
  );
}
