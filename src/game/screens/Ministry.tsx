import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { ACTION_CATS, type ActionCat } from '../../data/ministryActions';
import { PROJECTS } from '../../data/projects';
import { ministryActionSpecs } from '../../engine/decisions';
import { atWar } from '../../data/warActions';
import { isPM, playerMinistry } from '../../engine/roles';
import { fundingRatio } from '../../engine/services';
import type { GameState, Ministry } from '../../types/game';
import { deficitPct, debtPct } from '../../utils';
import { ActionButton, Empty, Explain, Meter, PolName, ScreenHeader, Section } from '../components/ui';

/** Domain-specific KPIs: each ministry looks different. */
function kpis(s: GameState, m: Ministry): { l: string; v: string; good?: boolean }[] {
  const ids = m.origins ?? [m.id];
  const out: { l: string; v: string; good?: boolean }[] = [];
  const t = s.services.transport.metrics, e = s.services.education.metrics, h = s.services.health.metrics;
  if (ids.includes('transport')) out.push({ l: 'זמן נסיעה ממוצע', v: `${t.commute} דק׳`, good: t.commute < 45 }, { l: 'עומס בכבישים', v: `${t.congestion?.toFixed(0)}`, good: t.congestion < 60 }, { l: 'דיוק רכבות', v: `${t.punctuality}%`, good: t.punctuality > 70 }, { l: 'ק״מ מסילה', v: `${t.railKm}` }, { l: 'שביעות רצון מתחבורה', v: s.services.transport.satisfaction.toFixed(0) });
  if (ids.includes('education')) out.push({ l: 'תלמידים בכיתה', v: `${e.classSize}`, good: e.classSize < 30 }, { l: 'מחסור במורים', v: `${e.teacherShortage}`, good: e.teacherShortage < 2000 }, { l: 'ציון במבחן הבינ״ל', v: `${e.score}`, good: e.score > 500 }, { l: 'כיתות חדשות', v: `${e.classrooms}` });
  if (ids.includes('health')) out.push({ l: 'המתנה במיון', v: `${h.erWait} שעות`, good: h.erWait < 5 }, { l: 'מיטות ל-1000', v: `${h.bedsPer1000}`, good: h.bedsPer1000 > 2.2 }, { l: 'מחסור ברופאים', v: `${h.doctorShortage}` });
  if (ids.includes('finance')) out.push({ l: 'גירעון', v: `${deficitPct(s).toFixed(1)}%`, good: deficitPct(s) < 3 }, { l: 'חוב/תוצר', v: `${debtPct(s).toFixed(0)}%`, good: debtPct(s) < 70 }, { l: 'דירוג אשראי', v: s.economy.creditRating }, { l: 'הכנסות', v: `₪${s.economy.revenue.toFixed(0)}B` }, { l: 'מס הכנסה / מע״מ', v: `${s.economy.taxes.incomeTax.toFixed(0)}% / ${s.economy.taxes.vat.toFixed(0)}%` });
  if (ids.includes('defense') || ids.includes('national_security')) out.push({ l: 'כשירות', v: `${s.services.security.metrics.readiness}%`, good: s.services.security.metrics.readiness > 65 }, { l: 'ימי מילואים בשנה', v: `${s.services.security.metrics.reserveDays}` });
  if (ids.includes('housing')) out.push({ l: 'מחיר דירה ממוצע', v: `₪${s.services.housing.metrics.aptPrice}M` }, { l: 'שנות משכורת לדירה', v: `${s.services.housing.metrics.salaryYears}`, good: s.services.housing.metrics.salaryYears < 10 });
  if (ids.includes('welfare')) out.push({ l: 'שיעור עוני', v: `${s.services.welfare.metrics.poverty}%`, good: s.services.welfare.metrics.poverty < 18 });
  if (ids.includes('energy')) out.push({ l: 'סיכון להפסקות', v: `${s.services.energy.metrics.blackoutRisk}%`, good: s.services.energy.metrics.blackoutRisk < 30 }, { l: 'אנרגיה מתחדשת', v: `${s.services.energy.metrics.renewables}%` });
  if (ids.includes('interior')) out.push({ l: 'ימי המתנה לשירות', v: `${s.services.govServices.metrics.bureaucracyDays}`, good: s.services.govServices.metrics.bureaucracyDays < 25 });
  if (ids.includes('economy')) out.push({ l: 'אבטלה', v: `${s.economy.unemployment.toFixed(1)}%`, good: s.economy.unemployment < 5 });
  return out;
}

function MinistryActionsPanel({ m, p }: { m: Ministry; p: { ministryId: string } }) {
  const s = useGame((x) => x.game)!;
  const all = ministryActionSpecs(m, s);
  const war = atWar(s);
  const cats = (Object.keys(ACTION_CATS) as ActionCat[]).filter((c) => all.some((a) => (a.cat ?? 'policy') === c));
  const [tab, setTab] = useState<ActionCat | 'all'>(war ? 'war' : 'all');
  const list = tab === 'all' ? all : all.filter((a) => (a.cat ?? 'policy') === tab);
  return (
    <Section title={`פעולות המשרד (${all.length})`} icon="⚡">
      {war && <div className="inset mb-3 text-sm" style={{ borderColor: '#f0b429', background: '#fff8e6' }}>⚔️ <b>שעת חירום.</b> במלחמה נפתחות למשרד פעולות מיוחדות, בלשונית "שעת חירום". כל אחת מחליפה בין ביטחון לחיי היומיום, והן נעלמות כשהמלחמה מסתיימת.</div>}
      <div className="flex flex-wrap gap-1.5 mb-3">
        <button className={`btn btn-sm ${tab === 'all' ? 'btn-blue' : ''}`} onClick={() => setTab('all')} data-tip="כל הפעולות של המשרד">הכול</button>
        {cats.map((c) => (
          <button key={c} className={`btn btn-sm ${tab === c ? (c === 'extreme' ? 'btn-danger' : 'btn-blue') : ''}`} onClick={() => setTab(c)}
            data-tip={c === 'extreme' ? 'צעדים חריגים: השפעה גדולה, תגובות חריפות, ולפעמים בלי אישור ראש הממשלה' : c === 'war' ? 'פעולות שמופיעות רק בזמן מלחמה: מגבילות את החיים האזרחיים כדי להגן על האוכלוסייה' : `פעולות מסוג ${ACTION_CATS[c]}`}>{ACTION_CATS[c]}</button>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-2">
        {list.map((a) => (
          <div key={a.id} className="inset flex flex-col gap-1" style={a.cat === 'extreme' ? { borderColor: '#ffb3c0', background: '#fff5f7' } : a.cat === 'war' ? { borderColor: '#f0b429', background: '#fff8e6' } : undefined}>
            <div className="flex items-start justify-between gap-1">
              <b className="text-sm">{a.icon} {a.title}</b>
              {a.rogue && <span className="chip chip-bad" data-tip="פעולה על דעת עצמך: קורה גם בלי אישור, אבל ראש הממשלה והקואליציה לא יסלחו">⚠️ בלי אישור</span>}
            </div>
            <span className="text-xs muted flex-1">{a.desc}</span>
            {a.outcomes && <span className="text-[10px]" style={{ color: 'var(--violet)' }}>🎲 התוצאה לא ידועה מראש</span>}
            <ActionButton id="ministry_action" params={{ ...p, actionId: a.id }} className={`btn btn-sm ${a.cat === 'extreme' ? 'btn-danger' : 'btn-blue'}`}>{a.cat === 'extreme' ? 'לבצע (צעד חריג)' : 'בצע'}</ActionButton>
          </div>
        ))}
      </div>
    </Section>
  );
}

export function MinistryScreen() {
  const s = useGame((x) => x.game)!;
  const view = useGame((x) => x.ministryView);
  const setView = useGame((x) => x.setMinistryView);
  const pm = isPM(s);
  // a minister may hold several portfolios: he can switch between them, the PM between all
  const held = s.government.ministries.filter((x) => x.ministerId === s.player.politicianId);
  const choices = pm ? s.government.ministries : held;
  const m = (view ? choices.find((x) => x.id === view) : undefined) ?? playerMinistry(s) ?? (pm ? s.government.ministries[0] : undefined);
  if (!m) return <Empty icon="🏛️" text="אין לך משרד. עדיין." />;
  const minister = m.ministerId ? s.politicians[m.ministerId] : null;
  const p = { ministryId: m.id };
  const budget = m.categories.reduce((a, c) => a + s.budget.allocations[c], 0);
  const projects = PROJECTS.filter((d) => (m.origins ?? [m.id]).includes(d.ministry));
  return (
    <div className="space-y-4">
      <ScreenHeader title={`${m.icon} ${m.name}`} sub={pm && m.ministerId !== s.player.politicianId ? 'כראש ממשלה אתה יכול להנחות את השר (עולה עוד 2 הון).' : 'המשרד שלך. התקציב שלך. הבעיות שלך.'}
        right={choices.length > 1 ? <select aria-label="בחירת משרד לצפייה" value={m.id} onChange={(e) => setView(e.target.value)}>{choices.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select> : undefined} />
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-4">
        <Section title="תמונת מצב" icon="📋">
          {minister && <PolName p={minister} s={s} size={44} sub={`מומחיות ${(minister.expertise[m.domain] ?? 20).toFixed(0)} · ${s.parties[minister.partyId]?.shortName}`} />}
          <div className="grid grid-cols-3 gap-2 mt-3 text-center">
            <div className="inset"><div className="label">תקציב</div><b className="num">₪{budget.toFixed(1)}B</b></div>
            <div className="inset"><div className="label flex gap-1 justify-center">יעילות<Explain k="efficiency" /></div><b className="num">{m.efficiency.toFixed(0)}</b></div>
            <div className="inset"><div className="label">ביורוקרטיה</div><b className="num">{m.bureaucracy.toFixed(0)}</b></div>
          </div>
          {m.services.map((id) => (
            <div key={id} className="mt-3">
              <div className="flex justify-between text-xs"><span>איכות השירות</span><b>{s.services[id].quality.toFixed(0)} · מימון {(fundingRatio(s, id) * 100).toFixed(0)}%</b></div>
              <Meter value={s.services[id].quality} />
              <div className="flex flex-wrap gap-1 mt-1">{s.services[id].issues.map((i) => <span key={i} className="chip chip-bad">{i}</span>)}</div>
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2 mt-3">
            {kpis(s, m).map((k) => <div key={k.l} className="inset"><div className="label">{k.l}</div><b className={`num ${k.good === undefined ? '' : k.good ? 'good' : 'bad'}`}>{k.v}</b></div>)}
          </div>
        </Section>
        <div className="space-y-4">
          <MinistryActionsPanel m={m} p={p} />
          <Section title="ניהול שוטף" icon="🗂️">
            <div className="flex flex-wrap gap-2">
              {!pm && <ActionButton id="ministry_request_budget" className="btn btn-sm">🙏 בקשת תקציב מראש הממשלה</ActionButton>}
              <ActionButton id="ministry_efficiency" params={p} className="btn btn-sm">⚙️ התייעלות</ActionButton>
              <ActionButton id="ministry_union" params={p} className="btn btn-sm">🤝 פגישה עם הוועדים</ActionButton>
              <ActionButton id="consult_experts" params={p} className="btn btn-sm">🧑‍🔬 התייעצות מקצועית</ActionButton>
              <ActionButton id="press_conference" className="btn btn-sm">🎙️ מסיבת עיתונאים</ActionButton>
            </div>
          </Section>
          {projects.length > 0 && (
            <Section title="פרויקטים בתחום" icon="🏗️">
              <div className="space-y-2">
                {projects.map((d) => {
                  const run = s.projects.find((x) => x.defId === d.id && x.status === 'active');
                  return (
                    <div key={d.id} className="inset flex items-center justify-between gap-2">
                      <div className="min-w-0"><b className="text-sm">{d.icon} {d.name}</b><div className="text-xs muted">₪{d.cost}B · {d.turns * 2} חודשים</div>{run && <Meter value={run.progress} color="var(--blue)" />}</div>
                      {run ? <span className="chip">{run.progress.toFixed(0)}%</span> : <ActionButton id="start_project" params={{ defId: d.id }} className="btn btn-sm">השקה</ActionButton>}
                    </div>
                  );
                })}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}
