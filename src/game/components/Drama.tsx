import { useEffect, useMemo, useRef } from 'react';
import { useGame } from '../store/gameStore';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';
import { babble, play, startMusic, voiceFor } from '../audio/sound';
import { adviseDrama } from '../../engine/advisorPlus';
import type { Politician } from '../../types/game';

export const voiceOf = (p: Politician) => voiceFor(p.gender, [...p.id].reduce((a, c) => a + c.charCodeAt(0), 0), p.personality.ego);

/** The "hold the front page" popup. Must be answered before the next turn. */
export function DramaModal() {
  const s = useGame((x) => x.game);
  const answer = useGame((x) => x.answerDrama);
  const busy = useGame((x) => x.reactions.length > 0 || x.briefingOpen || !!x.meeting);
  const visible = !!s?.drama && !busy && !s.gameOver;
  const rec = useMemo(() => (visible && s ? adviseDrama(s) : null), [visible, s?.drama?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const p = s?.drama?.fromId ? s.politicians[s.drama.fromId] : undefined;
    if (visible && p) { const t = setTimeout(() => babble(s!.drama!.text, voiceOf(p)), 900); return () => clearTimeout(t); }
  }, [visible, s?.drama?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!s?.drama || !visible) return null;
  const d = s.drama;
  const from = d.fromId ? s.politicians[d.fromId] : undefined;
  const big = d.level !== 'normal';
  const best = rec ? d.options.find((o) => o.id === rec.bestId) : undefined;
  return (
    <div className="backdrop" style={big ? { background: 'rgba(120, 10, 40, .55)' } : undefined}>
      <div className={`modal ${big ? 'shake' : ''}`} style={{ maxWidth: 620 }}>
        {big ? (
          <div className="breaking px-4 py-2 text-xl flex items-center justify-between">
            <span>🚨 מבזק</span><span className="text-sm opacity-90">{d.level === 'extreme' ? 'אירוע חמור' : 'אירוע מתגלגל'}</span>
          </div>
        ) : (
          <div className="px-4 py-1.5 flex items-center justify-between" style={{ background: 'linear-gradient(90deg, #17305a, #1f3f73)', color: '#fff' }}>
            <span>📰 בינתיים, בישמעאל…</span>
            <span className="text-xs opacity-80">נדרשת החלטה</span>
          </div>
        )}
        <div className="p-5 relative">
          {big && <span className="stamp absolute left-5 top-4 text-sm">דחוף</span>}
          <div className="flex gap-4 items-start">
            <div className="text-5xl shrink-0">{d.icon}</div>
            <div>
              <h2 className="text-3xl leading-tight">{d.title}</h2>
              <p className="mt-2 leading-relaxed" style={{ fontSize: '1.05rem' }}>{d.text}</p>
            </div>
          </div>
          {from && (
            <div className="flex items-center gap-2 mt-3 inset">
              <Caricature spec={from.caricature} size={42} tie={s.parties[from.partyId]?.color} mood={big ? 'bad' : undefined} />
              <div className="text-sm"><b>{from.name}</b> · {s.parties[from.partyId]?.shortName} · נאמנות אליך {from.loyalty.toFixed(0)}</div>
            </div>
          )}
          {best && (
            <div className="flex items-start gap-2 mt-4">
              <Caricature spec={ADVISOR_SPEC} size={40} />
              <div className="bubble flex-1 text-sm"><b style={{ color: 'var(--violet)' }}>היועץ ממליץ:</b> "{best.label}". בממוצע: {rec!.reason}.</div>
            </div>
          )}
          <div className="grid gap-3 mt-5">
            {d.options.map((o) => {
              const adv = rec?.byId[o.id];
              return (
                <button key={o.id} className={`btn ${o.id === rec?.bestId ? 'btn-primary' : ''} justify-between text-right`} style={{ whiteSpace: 'normal' }} onClick={() => answer(o.id)}
                  data-tip={[o.hint, adv ? `צפי ממוצע: ${adv.text}` : ''].filter(Boolean).join(' · ') || o.label}>
                  {o.id === rec?.bestId && <span className="rec">🧠 מומלץ</span>}
                  <span>{o.label}</span>{o.hint && <span className="text-xs font-semibold opacity-80">{o.hint}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Plays sounds in reaction to state changes (decisions, crises, breaking news, turns). */
export function SoundManager() {
  const s = useGame((x) => x.game);
  const reactions = useGame((x) => x.reactions);
  const prev = useRef({ reactions: 0, crises: 0, turn: -1, drama: '', over: false });
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      startMusic();
      if ((e.target as HTMLElement)?.closest('button')) play('click');
    };
    window.addEventListener('pointerdown', onClick);
    return () => window.removeEventListener('pointerdown', onClick);
  }, []);
  useEffect(() => {
    const p = prev.current;
    if (reactions.length > p.reactions) {
      const r = reactions[reactions.length - 1];
      if (/₪|מיליארד|תקציב/.test(r.title) && r.status === 'approved') play('cash');
      else play(r.status === 'approved' ? 'good' : r.status === 'rejected' ? 'bad' : 'info');
    }
    p.reactions = reactions.length;
    if (!s) return;
    if (p.turn >= 0 && s.turn > p.turn) play('turn');
    if (s.crises.length > p.crises && p.turn >= 0) setTimeout(() => play('alarm'), 400);
    if (s.drama && s.drama.id !== p.drama) setTimeout(() => play(s.drama!.level === 'normal' ? 'news' : 'breaking'), 600);
    if (s.gameOver && !p.over) play('stamp');
    p.turn = s.turn; p.crises = s.crises.length; p.drama = s.drama?.id ?? ''; p.over = !!s.gameOver;
  }, [s, reactions]);
  return null;
}
