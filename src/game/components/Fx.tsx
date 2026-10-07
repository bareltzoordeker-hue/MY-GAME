import type { Reaction } from '../../types/game';

/** The tone of a decision's result (drives the colour of the status bar and the sound). */
export function fxKind(r: Reaction): 'war' | 'money' | 'good' | 'bad' | 'meh' {
  const t = `${r.title} ${r.subtitle ?? ''}`;
  if (/מלחמה|מבצע צבאי|רקט|טיל/.test(t)) return 'war';
  if (/₪|מיליארד|מס|תקציב/.test(t) && r.status !== 'rejected') return 'money';
  return r.status === 'approved' ? 'good' : r.status === 'rejected' ? 'bad' : 'meh';
}

const BAR: Record<ReturnType<typeof fxKind>, string> = {
  war: 'var(--bad)', money: 'var(--gold)', good: 'var(--good)', bad: 'var(--bad)', meh: 'var(--blue)',
};

/** A restrained status bar across the top of the result window. */
export function StatusBar({ kind }: { kind: ReturnType<typeof fxKind> }) {
  return <div className="status-bar" aria-hidden style={{ background: BAR[kind] }} />;
}
