// Plans saved without being carried out: open one to edit it, or carry it out now.
import { useGame } from '../store/gameStore';
import { OPERATION_BY_ID, UNIT_BY_ID } from '../../data/security';
import { MAX_SAVED_PLANS, evaluatePlan, listSavedPlans, planToParams, type StrikePlan } from '../../engine/strikePlan';
import type { GameState } from '../../types/game';
import { Section } from './ui';

export function SavedPlans({ s, onEdit }: { s: GameState; onEdit: (p: StrikePlan) => void }) {
  const act = useGame((x) => x.act);
  const remove = useGame((x) => x.deleteStrikePlan);
  const list = listSavedPlans(s);
  return (
    <Section title="תוכניות שמורות" icon="💾">
      {list.length === 0 ? <div className="text-sm muted">אין תוכניות שמורות. בחמ״ל התכנון אפשר לשמור תוכנית בלי לבצע אותה, ולבצע אותה כשהמצב יתאים.</div> : (
        <div className="space-y-2">
          {list.map((x) => {
            const ev = evaluatePlan(s, x.plan);
            const op = OPERATION_BY_ID[x.plan.opId];
            return (
              <div key={x.id} className="inset flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="font-bold text-sm">{`${op.icon} ${x.name}`}</div>
                  <div className="text-xs muted">{ev.ok ? `${UNIT_BY_ID[x.plan.lead].name} · סיכוי להצלחה עכשיו ${Math.round(ev.chance * 100)}%` : `⛔ ${ev.issues[0]}`}</div>
                </div>
                <button className="btn btn-sm" onClick={() => onEdit(x.plan)}>✏️ לפתוח ולערוך</button>
                <button className="btn btn-sm btn-danger" disabled={!ev.ok} onClick={() => act('security_operation', planToParams(x.plan))}>🎖️ לבצע עכשיו</button>
                <button className="btn btn-sm" aria-label="מחיקה" data-tip="מחיקת התוכנית השמורה" onClick={() => remove(x.id)}>🗑️</button>
              </div>
            );
          })}
          <div className="text-[11px] muted">{`אפשר לשמור עד ${MAX_SAVED_PLANS} תוכניות.`}</div>
        </div>
      )}
    </Section>
  );
}
