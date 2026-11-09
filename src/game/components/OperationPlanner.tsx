// The operations room: plan an operation (target, leading and covering forces, hour, rules of engagement), see the odds and the price,
// take it to the security cabinet and carry it out.
import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { OP_PLAN, ROE, ROLE_HINT, ROLE_LABEL, TIMES, type PlanRole, type RoeId, type TimeId } from '../../data/strikePlan';
import { FRONT_BY_ID, OPERATION_BY_ID, UNIT_BY_ID, type FrontId, type UnitId } from '../../data/security';
import { allowedUnits, cabinetPreview, defaultPlan, evaluatePlan, isBriefed, planToParams, targetsFor, type StrikePlan } from '../../engine/strikePlan';
import { world } from '../../engine/security';
import { isPM } from '../../engine/roles';
import type { GameState } from '../../types/game';
import { Meter } from './ui';

const STANCE_CHIP: Record<string, string> = { support: 'chip-good', undecided: 'chip-warn', oppose: 'chip-bad' };
const STANCE_LABEL: Record<string, string> = { support: 'תומך', undecided: 'מתלבט', oppose: 'מתנגד' };

export function OperationPlanner({ s, opId, front, initial, onClose }: { s: GameState; opId: string; front: FrontId; initial?: StrikePlan; onClose: () => void }) {
  const act = useGame((x) => x.act);
  const brief = useGame((x) => x.cabinetBrief);
  const persuade = useGame((x) => x.cabinetPersuade);
  const savePlan = useGame((x) => x.saveStrikePlan);
  const [savedKey, setSavedKey] = useState('');
  const op = OPERATION_BY_ID[opId];
  const fdef = FRONT_BY_ID[front];
  const spec = OP_PLAN[opId];
  const [plan, setPlan] = useState<StrikePlan>(() => initial ?? defaultPlan(s, opId, front));
  const planKey = JSON.stringify(planToParams(plan));
  const saved = savedKey === planKey;
  const ev = evaluatePlan(s, plan);
  const members = ev.ok ? cabinetPreview(s, plan) : [];
  const pm = isPM(s);
  const ready = (u: UnitId) => world(s).units[u]?.readiness ?? 70;
  const unitLabel = (u: UnitId) => `${UNIT_BY_ID[u].icon} ${UNIT_BY_ID[u].name} · כשירות ${ready(u).toFixed(0)}`;
  const targets = targetsFor(front, opId);
  const yes = members.filter((m) => m.stance === 'support').length;
  const roleSelect = (role: PlanRole, key: 'lead' | 'intel' | 'engineering' | 'support') => {
    const list = allowedUnits(opId, role);
    if (!list.length) return null;
    const required = spec.required.includes(role);
    return (
      <label key={role} className="block text-sm" data-tip={ROLE_HINT[role]}>
        <span className="font-bold">{ROLE_LABEL[role]}{required ? ' *' : ''}</span>
        <select className="w-full mt-1" value={(plan[key] as string | undefined) ?? ''} onChange={(e) => setPlan({ ...plan, [key]: (e.target.value || undefined) as UnitId | undefined })} aria-label={ROLE_LABEL[role]}>
          {!required && <option value="">ללא</option>}
          {list.map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
        </select>
      </label>
    );
  };
  const coverList = allowedUnits(opId, 'cover').filter((u) => u !== plan.lead);
  const setCover = (i: number, v: string) => { const c = [...plan.cover]; if (v) c[i] = v as UnitId; else c.splice(i, 1); setPlan({ ...plan, cover: c.filter(Boolean) }); };
  return (
    <div className="backdrop">
      <div className="modal modal-wide" role="dialog" aria-label="חמ״ל תכנון מבצע" style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>{`🎖️ חמ״ל תכנון מבצע · ${fdef.name}`}</div>
          <div className="text-xl font-black">{`${op.icon} ${op.name}`}</div>
          <div className="text-sm muted mt-1">{op.desc}</div>
        </div>
        <div className="p-5 grid lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-bold mb-1">1. מטרה</div>
              <div className="flex flex-wrap gap-1.5">
                {targets.map((t) => <button key={t.id} type="button" aria-pressed={plan.target === t.id} className={`btn btn-sm ${plan.target === t.id ? 'btn-primary' : ''}`} data-tip={`ערך ${t.value.toFixed(1)} · סיכון לאזרחים ${Math.round(t.collateral * 100)}% · איכות מודיעין ${t.intel}`} onClick={() => setPlan({ ...plan, target: t.id })}>{`${t.icon} ${t.name}`}</button>)}
              </div>
            </div>
            <div>
              <div className="text-sm font-bold mb-1">2. כוחות</div>
              <div className="grid sm:grid-cols-2 gap-2">
                {roleSelect('lead', 'lead')}
                {[0, 1].map((i) => (
                  <label key={i} className="block text-sm" data-tip={ROLE_HINT.cover}>
                    <span className="font-bold">{`${ROLE_LABEL.cover} ${i + 1}`}</span>
                    <select className="w-full mt-1" value={plan.cover[i] ?? ''} onChange={(e) => setCover(i, e.target.value)} aria-label={`${ROLE_LABEL.cover} ${i + 1}`}>
                      <option value="">ללא</option>
                      {coverList.filter((u) => u === plan.cover[i] || !plan.cover.includes(u)).map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
                    </select>
                  </label>
                ))}
                {roleSelect('intel', 'intel')}
                {roleSelect('engineering', 'engineering')}
                {roleSelect('support', 'support')}
              </div>
              <div className="text-[11px] muted mt-1">רק יחידות שמתאימות לסוג המבצע מוצעות. * חובה.</div>
            </div>
            <div>
              <div className="text-sm font-bold mb-1">3. שעה</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TIMES) as TimeId[]).map((t) => <button key={t} type="button" aria-pressed={plan.time === t} className={`btn btn-sm ${plan.time === t ? 'btn-primary' : ''}`} data-tip={TIMES[t].hint} onClick={() => setPlan({ ...plan, time: t })}>{`${TIMES[t].icon} ${TIMES[t].label}`}</button>)}
              </div>
              <div className="text-[11px] muted mt-1">{TIMES[plan.time].hint}</div>
            </div>
            <div>
              <div className="text-sm font-bold mb-1">4. כללי פתיחה באש</div>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(ROE) as RoeId[]).map((r) => <button key={r} type="button" aria-pressed={plan.roe === r} className={`btn btn-sm ${plan.roe === r ? 'btn-primary' : ''}`} data-tip={ROE[r].hint} onClick={() => setPlan({ ...plan, roe: r })}>{ROE[r].label}</button>)}
              </div>
              <div className="text-[11px] muted mt-1">{ROE[plan.roe].hint}</div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="inset">
              <div className="text-sm font-bold mb-2">הערכת התוכנית</div>
              {ev.issues.length > 0 && <ul className="text-sm bad space-y-0.5 mb-2" role="alert">{ev.issues.map((i, k) => <li key={k}>{`⛔ ${i}`}</li>)}</ul>}
              {ev.ok && (
                <>
                  <div className="flex items-center gap-2 text-sm"><span className="w-28">סיכוי להצלחה</span><div className="flex-1"><Meter value={ev.chance * 100} /></div><b className="num">{`${Math.round(ev.chance * 100)}%`}</b></div>
                  <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                    <div>{`🕯️ נפגעים צפויים בצה״ל: עד ${ev.fallenEst}`}</div>
                    <div>{`🏠 נפגעים בעורף מירי בתגובה: עד ${ev.homeCivEst}`}</div>
                    <div>{`⚠️ אזרחים בצד השני (הערכה): ${ev.enemyCivEst}`}</div>
                    <div>{`📉 הפחתת איום צפויה: ${ev.cutEst}`}</div>
                    <div>{`🌍 מחיר בינלאומי: ${ev.intlEst.toFixed(1)}`}</div>
                    <div>{`💰 עלות: ₪${op.cost}B`}</div>
                  </div>
                  {ev.warnings.length > 0 && <ul className="text-xs warn mt-2 space-y-0.5">{ev.warnings.map((w, k) => <li key={k}>{`⚠️ ${w}`}</li>)}</ul>}
                </>
              )}
            </div>
            {op.needsCabinet && ev.ok && (
              <div className="inset">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="text-sm font-bold">ישיבת קבינט ביטחוני</div>
                  <span className="chip">{`${yes} מתוך ${members.length} תומכים`}</span>
                </div>
                <div className="text-[11px] muted mb-2">{pm ? 'אתה ראש הממשלה: ההחלטה שלך, והקבינט מייעץ.' : 'צריך רוב בקבינט, ואישור של ראש הממשלה.'}</div>
                <div className="space-y-1.5">
                  {members.map((m) => (
                    <div key={m.id} className="text-sm flex items-start gap-2">
                      <span className={`chip ${STANCE_CHIP[m.stance]}`}>{STANCE_LABEL[m.stance]}</span>
                      <div className="flex-1 min-w-0"><b>{m.name}</b> <span className="text-xs muted">{m.title}</span><div className="text-xs">{m.text}</div></div>
                      {!s.politicians[m.id].isPlayer && <button className="btn btn-sm" disabled={m.persuaded} onClick={() => persuade(m.id)} data-tip="שיחה אישית עם חבר הקבינט (3 הון)">{m.persuaded ? '✔ שוכנע' : '🗣️ לשכנע'}</button>}
                    </div>
                  ))}
                </div>
                <div className="mt-2"><button className="btn btn-sm btn-blue" disabled={isBriefed(s, plan)} onClick={() => brief(plan)} data-tip="תדריך מודיעין לכל הקבינט (2 הון)">{isBriefed(s, plan) ? '✔ התקיים תדריך' : '📋 תדריך מודיעין לקבינט'}</button></div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 pt-0 flex justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            <button className="btn btn-sm" onClick={onClose}>ביטול</button>
            <button className="btn btn-sm btn-blue" disabled={!ev.ok || saved} data-tip="שומר את התוכנית ברשימה בלי לבצע אותה, כדי לבצע אותה בהמשך" onClick={() => { if (savePlan(plan)) setSavedKey(planKey); }}>{saved ? '✔ התוכנית נשמרה' : '💾 לשמור תוכנית'}</button>
          </div>
          <button className="btn btn-danger" disabled={!ev.ok} onClick={() => { act('security_operation', planToParams(plan)); onClose(); }}>{pm ? '🎖️ להורות על ביצוע' : '🎖️ להגיש לאישור ולבצע'}</button>
        </div>
      </div>
    </div>
  );
}
