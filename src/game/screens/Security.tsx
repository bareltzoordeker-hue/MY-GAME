import { useState } from 'react';
import { useGame } from '../store/gameStore';
import { CHANNELS, FRONTS, OPERATIONS, UNITS, type FrontId } from '../../data/security';
import { CBM, COUNTRIES, canUseInternalSecurity, securityRole, world, type CbmKind } from '../../engine/security';
import { INTERNAL_OPTIONS } from '../../data/internalSecurity';
import type { GameState } from '../../types/game';
import { ActionButton, Empty, Meter, ScreenHeader, Section } from '../components/ui';

const STATUS: Record<string, { t: string; c: string }> = {
  quiet: { t: 'שקט', c: 'chip-good' }, tension: { t: 'מתיחות', c: 'chip-warn' }, fighting: { t: 'לחימה', c: 'chip-bad' }, ceasefire: { t: 'הפסקת אש', c: 'chip' },
};
const threatWord = (v: number) => (v >= 70 ? 'גבוהה מאוד' : v >= 50 ? 'גבוהה' : v >= 30 ? 'בינונית' : 'נמוכה');

function FrontCard({ s, id }: { s: GameState; id: FrontId }) {
  const def = FRONTS.find((f) => f.id === id)!;
  const st = world(s).fronts[id];
  const ops = OPERATIONS.filter((o) => o.fronts.includes(id));
  const [op, setOp] = useState(ops[0]?.id ?? '');
  const [via, setVia] = useState('egypt');
  const sel = ops.find((o) => o.id === op);
  return (
    <div className="inset space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0"><b>{def.icon} {def.name}</b><div className="text-xs muted">{def.enemy}</div></div>
        <span className={`chip ${STATUS[st.status].c}`}>{STATUS[st.status].t}</span>
      </div>
      <div className="text-xs muted">{def.desc}</div>
      <div className="flex items-center gap-2 text-xs"><span className="w-20">רמת איום: {threatWord(st.threat)}</span><div className="flex-1"><Meter value={st.threat} invert /></div><b className="num">{st.threat.toFixed(0)}</b></div>
      <div className="flex gap-1.5 flex-wrap items-center">
        <select aria-label={`סוג מבצע ב${def.name}`} value={op} onChange={(e) => setOp(e.target.value)} className="flex-1 min-w-0">{ops.map((o) => <option key={o.id} value={o.id}>{o.icon} {o.name}</option>)}</select>
        <ActionButton id="security_operation" params={{ opId: op, front: id }} className="btn btn-sm btn-danger"
          confirm={sel && sel.risk >= 0.2 ? `${sel.name}: ${sel.desc} צפויים נפגעים. לאשר?` : undefined}>לתכנן</ActionButton>
      </div>
      {sel && <div className="text-[11px] muted">{sel.desc} · סיכון לכוחות: {sel.risk >= 0.5 ? 'גבוה' : sel.risk >= 0.15 ? 'בינוני' : 'נמוך'} · עלות ₪{sel.cost}B{sel.reservists ? ' · גיוס מילואים' : ''}{sel.needsCabinet ? ' · דורש אישור קבינט' : ''}</div>}
      {(st.status === 'fighting' || st.threat >= 45) && ['gaza', 'lebanon', 'yemen', 'judea_samaria'].includes(id) && (
        <div className="flex gap-1.5 flex-wrap items-center">
          <select aria-label="מתווך להפסקת אש" value={via} onChange={(e) => setVia(e.target.value)} className="flex-1 min-w-0">{['egypt', 'qatar', 'jordan', 'usa'].map((c) => { const ch = CHANNELS.find((x) => x.id === c)!; return <option key={c} value={c}>בתיווך {ch.name}</option>; })}</select>
          <ActionButton id="diplomacy" params={{ kind: 'ceasefire', front: id, channel: via }} className="btn btn-sm btn-good">🕊️ הפסקת אש</ActionButton>
        </div>
      )}
    </div>
  );
}

export function SecurityScreen() {
  const s = useGame((x) => x.game)!;
  const w = world(s);
  const role = securityRole(s);
  const [cbm, setCbm] = useState<CbmKind>('permits');
  // only the people who run security open this screen: the PM, the defense minister and the national-security minister
  if (!role) return <Empty icon="🔒" text="מסך הביטחון פתוח לראש הממשלה, לשר הביטחון ולשר לביטחון לאומי." />;
  const military = role === 'pm' || role === 'defense';
  return (
    <div className="space-y-4">
      <ScreenHeader title="ביטחון ומדיניות" sub={military ? 'המסלול הצבאי, המסלול המדיני וביטחון הפנים. מבצעים גדולים ומהלכים מדיניים משמעותיים דורשים אישור הקבינט.' : 'ביטחון הפנים: משטרה, שב״כ ושב״ס. החזיתות מוצגות לעיון בלבד.'} />
      <Section title="חזיתות" icon="🧭">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{FRONTS.map((f) => <FrontCard key={f.id} s={s} id={f.id} />)}</div>
      </Section>
      {canUseInternalSecurity(s) && (
        <Section title="ביטחון פנים" icon="🚓">
          <p className="text-sm muted mb-2">פעולות המשטרה, השב״כ והשב״ס בתוך המדינה. הצלחתן תלויה במימון המשטרה וביעילות המשרד לביטחון לאומי. פתוח לראש הממשלה ולשר לביטחון לאומי.</p>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-2">
            {INTERNAL_OPTIONS.map((o) => (
              <div key={o.id} className="inset flex flex-col gap-1">
                <b className="text-sm">{o.icon} {o.title}</b>
                <span className="text-xs muted">{o.desc}</span>
                <span className="text-[11px] muted">הון: {o.capital}{o.cost ? ` · עלות שנתית: ₪${o.cost}B` : ''}</span>
                <ActionButton id="internal_security" params={{ opId: o.id }} className="btn btn-sm btn-blue mt-1">לבצע</ActionButton>
              </div>
            ))}
          </div>
        </Section>
      )}
      {military && <div className="grid lg:grid-cols-2 gap-4">
        <Section title="הכוחות" icon="🪖">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {UNITS.map((u) => (
              <div key={u.id} className="inset">
                <div className="flex items-center justify-between gap-1"><b className="text-sm">{u.icon} {u.name}</b><ActionButton id="unit_training" params={{ unitId: u.id }} className="btn btn-sm">אימון</ActionButton></div>
                <div className="text-[11px] muted">{u.desc}</div>
                <div className="flex items-center gap-2 text-xs mt-1"><span>כשירות</span><div className="flex-1"><Meter value={w.units[u.id].readiness} /></div><b className="num">{w.units[u.id].readiness.toFixed(0)}</b></div>
              </div>
            ))}
          </div>
        </Section>
        <div className="space-y-4">
          <Section title="המסלול המדיני" icon="🕊️">
            <div className="space-y-2">
              {CHANNELS.map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="w-32 shrink-0" data-tip={c.role}>{c.icon ? `${c.icon} ` : ''}{c.name}</span>
                  <div className="flex-1 min-w-[80px]"><Meter value={w.channels[c.id]} /></div>
                  <ActionButton id="diplomacy" params={{ kind: 'channel_secret', channel: c.id }} className="btn btn-sm">ערוץ חשאי</ActionButton>
                  <ActionButton id="diplomacy" params={{ kind: 'channel_open', channel: c.id }} className="btn btn-sm">שיחות גלויות</ActionButton>
                </div>
              ))}
            </div>
            <div className="label mt-4 mb-1">צעדים בוני אמון</div>
            <div className="flex gap-1.5 flex-wrap items-center">
              <select aria-label="צעד בונה אמון" value={cbm} onChange={(e) => setCbm(e.target.value as CbmKind)} className="flex-1 min-w-0">{(Object.keys(CBM) as CbmKind[]).map((k) => <option key={k} value={k}>{CBM[k].name}</option>)}</select>
              <ActionButton id="diplomacy" params={{ kind: 'cbm', cbm }} className="btn btn-sm btn-blue">לאשר</ActionButton>
            </div>
            <div className="text-[11px] muted mt-1">{CBM[cbm].desc} השותפות מהימין עלולות למחות או לפרוש.</div>
            <div className="label mt-4 mb-1">נורמליזציה</div>
            <div className="flex gap-1.5 flex-wrap items-center">
              {w.normalized.includes('saudi') ? <span className="chip chip-good">🕊️ הסכם עם סעודיה נחתם</span>
                : <ActionButton id="diplomacy" params={{ kind: 'normalize' }} className="btn btn-sm btn-good">🕊️ מהלך לנורמליזציה עם סעודיה</ActionButton>}
              <span className="text-[11px] muted">הסיכוי עולה עם הקשר לסעודיה, לרשות ולארה״ב, ועם צעד מדיני מול הפלסטינים.</span>
            </div>
          </Section>
          <Section title="יהודה ושומרון: שטחי A / B / C" icon="🗺️">
            <p className="text-xs muted mb-2">לפי הסכמי אוסלו. שטח A: שליטה אזרחית וביטחונית פלסטינית. שטח B: אזרחית פלסטינית, ביטחונית ישמעאלית. שטח C: שליטה ישמעאלית מלאה, כולל היישובים.</p>
            <div className="flex h-7 rounded-lg overflow-hidden text-xs font-bold text-white" role="img" aria-label={`שטח A ${w.areas.A}%, שטח B ${w.areas.B}%, שטח C ${w.areas.C}%`}>
              <div style={{ width: `${w.areas.A}%`, background: '#2e9e5b' }} className="grid place-items-center">A {w.areas.A}%</div>
              <div style={{ width: `${w.areas.B}%`, background: '#d9a400' }} className="grid place-items-center">B {w.areas.B}%</div>
              <div style={{ width: `${w.areas.C}%`, background: '#5b4bdb' }} className="grid place-items-center">C {w.areas.C}%</div>
            </div>
            <div className="text-xs muted mt-2">הכיוון המדיני (שטח עובר לפלסטינים):</div>
            <div className="flex gap-1.5 flex-wrap mt-1">
              <ActionButton id="diplomacy" params={{ kind: 'transfer', from: 'C' }} className="btn btn-sm" confirm="להעביר 2% משטח C לשטח B? מועצת יש״ע והימין יתנגדו בחריפות, ושותפות עלולות לפרוש.">העברת 2% מ-C ל-B</ActionButton>
              <ActionButton id="diplomacy" params={{ kind: 'transfer', from: 'B' }} className="btn btn-sm" confirm="להעביר 2% משטח B לשטח A? צעד משמעותי עם השלכות פוליטיות כבדות.">העברת 2% מ-B ל-A</ActionButton>
            </div>
            <div className="text-xs muted mt-2">הכיוון ההפוך (שליטה ישמעאלית מורחבת):</div>
            <div className="flex gap-1.5 flex-wrap mt-1">
              <ActionButton id="diplomacy" params={{ kind: 'annex', from: 'B' }} className="btn btn-sm" confirm="להעביר 2% משטח B לשטח C? צעד של ריבונות בפועל. הרשות והעולם יגנו, הימין יברך.">⬅️ B → C: ריבונות בפועל</ActionButton>
              <ActionButton id="diplomacy" params={{ kind: 'annex', from: 'A' }} className="btn btn-sm btn-danger" confirm="להחזיר 2% משטח A לשטח B? צעד חריף: הרשות הפלסטינית תגיב וסיכון האלימות יעלה.">⬅️ A → B: חזרה לשליטה</ActionButton>
            </div>
          </Section>
        </div>
      </div>}
      <div className="grid md:grid-cols-2 gap-4">
        <Section title="יחסי חוץ" icon="🌍">
          <div className="space-y-1.5">{COUNTRIES.map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-sm"><span className="w-32">{c.name}</span><div className="flex-1"><Meter value={w.relations[c.id] ?? 0} /></div><b className="num w-8 text-left">{(w.relations[c.id] ?? 0).toFixed(0)}</b></div>
          ))}</div>
        </Section>
        <Section title="לזכרם" icon="🕯️">
          <p className="text-sm">מאז תחילת המשחק:</p>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="inset text-center"><div className="label">חיילים שנפלו</div><div className="font-black text-2xl num">{w.casualties.soldiers}</div></div>
            <div className="inset text-center"><div className="label">אזרחים שנהרגו</div><div className="font-black text-2xl num">{w.casualties.civilians}</div></div>
          </div>
          <p className="text-xs muted mt-2">כל החלטה ביטחונית נמדדת גם בחיי אדם.</p>
        </Section>
      </div>
    </div>
  );
}
