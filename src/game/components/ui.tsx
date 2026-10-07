import type { ReactNode } from 'react';
import { useGame } from '../store/gameStore';
import { ACTIONS, actionCapital, checkAction, type Params } from '../../engine/decisions';
import type { GameState, Party, Politician } from '../../types/game';
import { Caricature } from '../../shared/components/Caricature';

export function Explain({ k, className = '' }: { k: string; className?: string }) {
  const explain = useGame((s) => s.explain);
  return (
    <button
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${className}`}
      style={{ background: '#e8edf5', color: 'var(--muted)', border: 0, cursor: 'help' }}
      onClick={(e) => { e.stopPropagation(); explain(k); }}
      aria-label="מה זה אומר?"
      data-tip="מה זה אומר?"
    >?</button>
  );
}

export function Stat({ icon, label, value, delta, goodWhenUp = true, k, sub, tone }: {
  icon?: string; label: string; value: ReactNode; delta?: number; goodWhenUp?: boolean; k?: string; sub?: ReactNode; tone?: 'good' | 'bad' | 'warn';
}) {
  const dTone = delta === undefined || Math.abs(delta) < 0.05 ? 'muted' : (delta > 0) === goodWhenUp ? 'good' : 'bad';
  return (
    <div className="card card-tight card-hover rise">
      <div className="flex items-center justify-between gap-2">
        <span className="label flex items-center gap-1">{icon && <span>{icon}</span>}{label}</span>
        {k && <Explain k={k} />}
      </div>
      <div className={`text-2xl font-black num mt-1 ${tone ?? ''}`}>{value}</div>
      <div className="flex items-center gap-2 text-xs mt-0.5 min-h-4">
        {delta !== undefined && Math.abs(delta) >= 0.05 && <span className={`${dTone} num font-bold`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}</span>}
        {sub && <span className="muted">{sub}</span>}
      </div>
    </div>
  );
}

/** invert: high values are bad (threat, risk). */
export function Meter({ value, max = 100, color, h = 7, invert = false }: { value: number; max?: number; color?: string; h?: number; invert?: boolean }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const good = invert ? 100 - pct : pct;
  const c = color ?? (good > 60 ? 'var(--good)' : good > 38 ? 'var(--warn)' : 'var(--bad)');
  return <div className="bar" style={{ height: h }}><i style={{ width: `${pct}%`, background: c }} /></div>;
}

export function PartyChip({ party, seats }: { party: Party; seats?: number }) {
  return (
    <span className="chip" style={{ borderColor: `${party.color}66`, color: 'var(--text)', background: `${party.color}22` }}>
      <span>{party.logo}</span>{party.shortName}{seats !== undefined && <b className="num">· {seats}</b>}
    </span>
  );
}

export function PolName({ p, s, size = 36, sub }: { p: Politician; s: GameState; size?: number; sub?: ReactNode }) {
  const party = s.parties[p.partyId];
  return (
    <div className="flex items-center gap-2 min-w-0">
      <Caricature spec={p.caricature} size={size} tie={party?.color} />
      <div className="min-w-0">
        <div className="font-bold text-sm leading-tight">{p.name}{p.isPlayer && <span className="chip chip-gold mr-1">אתה</span>}</div>
        <div className="text-xs muted truncate">{sub ?? party?.name}</div>
      </div>
    </div>
  );
}

/** A button wired to the Decision Engine: shows cost, disabled reason. Never decorative. */
export function ActionButton({ id, params = {}, children, className = 'btn', icon, confirm }: {
  id: string; params?: Params; children: ReactNode; className?: string; icon?: string; confirm?: string;
}) {
  const game = useGame((s) => s.game)!;
  const act = useGame((s) => s.act);
  const ask = useGame((s) => s.ask);
  const reason = checkAction(game, id, params);
  const cost = actionCapital(game, id, params);
  const def = ACTIONS[id];
  const desc = def?.description ?? '';
  const tip = reason ? `⛔ ${reason}` : [desc, cost ? `עולה ${cost} הון פוליטי` : '', def?.level === 'major' ? 'החלטה גדולה: עשויה לדרוש ישיבת ממשלה' : ''].filter(Boolean).join(' · ');
  const keyParam = ['category', 'lawId', 'defId', 'partyId', 'regionId', 'actionId', 'tax', 'politicianId', 'billId', 'promiseId', 'templateId', 'ministryId', 'domain'].map((k) => params[k]).find((v) => v !== undefined);
  // direction matters: the advisor must light up +budget, not -budget
  const sign = params.delta !== undefined ? (Number(params.delta) >= 0 ? ':+' : ':-') : '';
  const focusKey = (keyParam !== undefined ? `${id}:${keyParam}` : id) + sign;
  const run = () => (confirm ? ask({ title: 'בטוח?', text: confirm, onYes: () => act(id, params) }) : act(id, params));
  return (
    <button className={className} disabled={!!reason} onClick={run} data-focus={focusKey} data-tip={tip || undefined} data-tip-action={reason ? undefined : JSON.stringify({ id, p: params })}>
      {icon && <span>{icon}</span>}
      {children}
      {cost > 0 && !reason && <span className="chip" style={{ padding: '1px 6px', fontSize: '.65rem' }}>🎯{cost}</span>}
    </button>
  );
}

export function Section({ title, icon, right, children, className = '' }: { title: ReactNode; icon?: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="h-title">{icon && <span>{icon}</span>}{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return <div className="text-center py-6 muted text-sm"><div className="text-3xl mb-1 opacity-70">{icon}</div>{text}</div>;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((i) => (
        <button key={i.id} role="tab" aria-selected={value === i.id} data-tip={typeof i.label === 'string' ? `מעבר לתצוגה "${i.label}". לא משנה דבר במשחק, רק מה שמוצג על המסך` : undefined} className={`tab ${value === i.id ? 'tab-active' : ''}`} onClick={() => onChange(i.id)}>{i.label}</button>
      ))}
    </div>
  );
}

export function ScreenHeader({ title, sub, right }: { title: string; sub?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
      <div>
        <h1 className="screen-title">{title}</h1>
        {sub && <p className="h-sub mt-1">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

export const toneOf = (v: number, good = 55, bad = 40) => (v >= good ? 'good' : v < bad ? 'bad' : 'warn');
export const pct = (v: number, d = 1) => `${v.toFixed(d)}%`;
export const bil = (v: number) => `₪${v.toLocaleString('he-IL', { maximumFractionDigits: 1 })}B`;
