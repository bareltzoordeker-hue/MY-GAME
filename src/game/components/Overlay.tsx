import { useEffect, useMemo, useState } from 'react';
import { useGame, type ScreenId } from '../store/gameStore';
import { screenAdvice, suggestNextMove, type AdviceTip } from '../../engine/advisorPlus';
import { ADVISOR } from '../../data/world';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';
import { babble, play, voiceFor } from '../audio/sound';
import type { GameState } from '../../types/game';
import { ACTIONS, actionCapital, checkAction, type Params } from '../../engine/decisions';
import { CATEGORY_BY_ID, REGION_BY_ID, TAX_NAMES } from '../../data/world';
import { LAW_BY_ID } from '../../data/laws';
import { PROJECT_BY_ID } from '../../data/projects';
import { NAV } from './Layout';

/** Common labels that don't carry their own data-tip. Every button explains itself. */
const FALLBACK: Record<string, string> = {
  'הבנתי': 'סוגר את החלון וחוזר למשחק',
  'לעבודה': 'סוגר את התדריך. החודשיים הבאים מתחילים עכשיו',
  'ביטול': 'לא עושה כלום. חוזרים אחורה',
  'כן': 'מאשר את הפעולה. אין דרך חזרה',
  'שמור': 'שומר את השינוי',
  'הסר': 'מוחק את המפתח מהדפדפן',
  'דלג': 'מסתיר את המדריך. אפשר להחזיר מההגדרות',
  'הבא': 'לשלב הבא במדריך',
  'הקודם': 'לשלב הקודם במדריך',
  'סיום': 'סוגר את המדריך',
  'עוד': 'פותח עוד מידע',
  'חזרה': 'חוזר למסך הקודם',
  'בצע': 'מבצע את פעולת המשרד: עולה הון פוליטי, ולפעמים צריך אישור תקציבי מראש הממשלה',
  'השקה': 'מתחיל פרויקט: הכסף יוצא לאורך הביצוע, התועלת מגיעה רק בסיום',
  'הפעל': 'מפעיל את הכלי הכלכלי',
  'הגש': 'מגיש את ההצעה לכנסטון',
  '✕': 'סוגר',
  '☰': 'פותח את התפריט',
};

export function TipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; below: boolean } | null>(null);
  useEffect(() => {
    let last = 0;
    const over = (e: PointerEvent) => {
      const el = (e.target as HTMLElement)?.closest?.('[data-tip], button, .side-link') as HTMLElement | null;
      if (!el) { setTip(null); return; }
      let text = el.getAttribute('data-tip') ?? '';
      if (!text && el.tagName === 'BUTTON') {
        const label = (el.textContent ?? '').replace(/[←→⏭🎯\d]/g, '').trim();
        text = FALLBACK[label] ?? Object.entries(FALLBACK).find(([k]) => label.startsWith(k))?.[1] ?? '';
      }
      if (!text) { setTip(null); return; }
      const r = el.getBoundingClientRect();
      const below = r.top < 140;
      setTip({ text, x: Math.min(Math.max(r.left + r.width / 2, 150), window.innerWidth - 150), y: below ? r.bottom + 10 : r.top - 10, below });
      const now = performance.now();
      if (el.tagName === 'BUTTON' && now - last > 70) { play('hover'); last = now; }
    };
    const out = (e: PointerEvent) => { if (!(e.relatedTarget as HTMLElement)?.closest?.('[data-tip], button')) setTip(null); };
    const hide = () => setTip(null);
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerout', out);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('pointerdown', hide);
    return () => { document.removeEventListener('pointerover', over); document.removeEventListener('pointerout', out); window.removeEventListener('scroll', hide, true); window.removeEventListener('pointerdown', hide); };
  }, []);
  if (!tip) return null;
  return (
    <div className="tip-layer" style={{ left: tip.x, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}>{tip.text}</div>
  );
}

const ADVISOR_VOICE = voiceFor('m', 7, 0.4);

/** Which parameter an advice focus key ("action:param:sign") carries, per action. */
const FOCUS_PARAM: Record<string, string> = {
  network: 'politicianId', promote_member: 'politicianId', visit_region: 'regionId', propose_law: 'lawId', push_bill: 'billId',
  start_project: 'defId', adjust_budget: 'category', set_tax: 'tax', seek_endorsement: 'partyId', ministry_action: 'actionId',
};

/** Turns an advice tip into an honest button: what it does, what it costs, and why it can't be done right now. */
export function describeTip(s: GameState, tip: AdviceTip): { label: string; hint: string; blocked: string | null } {
  const nav = NAV.find((n) => n.id === tip.screen);
  const toScreen = nav ? `${nav.icon} למסך ${nav.label}` : '📍 למסך המתאים';
  if (!tip.focus) return { label: toScreen, hint: `פותח את מסך ${nav?.label ?? ''}. ההחלטה עצמה – שם`, blocked: null };
  const [id, raw, sign] = tip.focus.split(':');
  if (id === 'appoint') {
    const m = s.government.ministries.find((x) => x.id === raw);
    return { label: `🪑 מינוי שר ל${m?.name ?? 'משרד'}`, hint: 'פותח את מסך הממשלה ומסמן את בחירת השר למשרד הזה', blocked: null };
  }
  if (id === 'alliance') {
    const p = s.parties[raw];
    return { label: `🤝 גוש עם ${p?.shortName ?? 'מפלגה'}`, hint: 'פותח את מסך המפלגה ומסמן את הצעת הברית', blocked: null };
  }
  const def = ACTIONS[id];
  if (!def) return { label: toScreen, hint: `פותח את מסך ${nav?.label ?? ''}`, blocked: null };
  const params: Params = {};
  const key = FOCUS_PARAM[id];
  if (key && raw) params[key] = raw;
  if (id === 'adjust_budget' || id === 'set_tax') params.delta = sign === '-' ? -1 : 1;
  if (id === 'committee_work') params.domain = s.politicians[s.player.politicianId].mainDomain;
  let target = '';
  if (key === 'politicianId') target = s.politicians[raw]?.name ?? '';
  else if (key === 'regionId') target = REGION_BY_ID[raw as keyof typeof REGION_BY_ID]?.name ?? '';
  else if (key === 'lawId') target = LAW_BY_ID[raw]?.title ?? '';
  else if (key === 'billId') target = s.bills.find((b) => b.id === raw)?.title ?? '';
  else if (key === 'defId') target = PROJECT_BY_ID[raw]?.name ?? '';
  else if (key === 'partyId') target = s.parties[raw]?.shortName ?? '';
  let label = `${def.icon} ${def.title}${target ? `: ${target}` : ''}`;
  if (id === 'adjust_budget') label = `💰 ${sign === '-' ? 'קיצוץ' : 'תוספת'} תקציב: ${CATEGORY_BY_ID[raw as keyof typeof CATEGORY_BY_ID]?.name ?? ''}`;
  if (id === 'set_tax') label = `🧾 ${sign === '-' ? 'הורדת' : 'העלאת'} ${TAX_NAMES[raw as keyof typeof TAX_NAMES] ?? 'מס'}`;
  // a ministry action without a specific id lights up the ministry's actions list: check the generic availability only
  const blocked = id === 'ministry_action' && !raw ? null : checkAction(s, id, params);
  const cost = blocked ? 0 : actionCapital(s, id, params);
  const hint = [def.description, cost ? `עולה ${cost} הון פוליטי` : '', `לוקח אותך למסך ${nav?.label ?? ''} ומסמן את הכפתור`].filter(Boolean).join(' · ');
  return { label, hint, blocked };
}

/** The button that turns advice into action: says exactly what it does, jumps to the screen and lights up the button. */
export function DecideButton({ tip, small = true }: { tip: AdviceTip; small?: boolean }) {
  const goTo = useGame((x) => x.goTo);
  const s = useGame((x) => x.game);
  if (!tip.screen || !s) return null;
  const d = describeTip(s, tip);
  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <button className={`btn ${small ? 'btn-sm' : ''} ${d.blocked ? '' : 'btn-primary'}`} data-tip={d.blocked ? `⛔ ${d.blocked}` : d.hint}
        onClick={() => goTo(tip.screen as ScreenId, tip.focus)}>{d.label}</button>
      {d.blocked && <span className="text-[11px] muted">⛔ {d.blocked}</span>}
    </span>
  );
}

/** Finds the target button after navigation, scrolls to it and makes it glow. */
export function FocusManager() {
  const screen = useGame((x) => x.screen);
  const focus = useGame((x) => x.focusKey);
  const clear = useGame((x) => x.clearFocus);
  useEffect(() => {
    if (!focus) return;
    let tries = 0;
    const find = () => {
      const all = [...document.querySelectorAll<HTMLElement>(`[data-focus="${CSS.escape(focus)}"], [data-focus^="${CSS.escape(focus)}:"]`)];
      const el = all.find((e) => !(e as HTMLButtonElement).disabled) ?? all[0];
      if (!el) { if (tries++ < 10) { window.setTimeout(find, 150); } else clear(); return; }
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('focus-pulse');
      play('info');
      window.setTimeout(() => el.classList.remove('focus-pulse'), 4500);
      clear();
    };
    const t = window.setTimeout(find, 250);
    return () => window.clearTimeout(t);
  }, [focus, screen, clear]);
  return null;
}

/** Floating advisor: always on, always has an opinion about the screen you're on. */
export function AdvisorFab() {
  const s = useGame((x) => x.game);
  const screen = useGame((x) => x.screen);
  const blocking = useGame((x) => x.reactions.length > 0 || !!x.meeting || x.briefingOpen || !!x.game?.drama);
  // on phones the advisor starts collapsed so he doesn't hide the game; tap him to open
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth >= 768);
  const [i, setI] = useState(0);
  const [extra, setExtra] = useState<AdviceTip | null>(null);
  const tips = useMemo(() => (s ? screenAdvice(s, screen) : []), [s, screen]);
  useEffect(() => { setI(0); setExtra(null); }, [screen, s?.turn]);
  if (!s || blocking || s.gameOver) return null;
  const tip: AdviceTip = extra ?? tips[i % Math.max(1, tips.length)] ?? { text: 'שקט. חשוד.' };
  const say = (t: string) => babble(t, ADVISOR_VOICE);
  // no point sending you to the screen you're already on unless there's a specific button to light up
  const actionable = tip.screen && (tip.screen !== screen || tip.focus);
  return (
    <div className="advisor-fab">
      <button aria-label="היועץ" data-tip={open ? 'להסתיר את היועץ' : `${ADVISOR.name}: לחץ לעצה על המסך הזה`} onClick={() => { setOpen(!open); if (!open) say(tip.text); }} style={{ background: 'none', border: 0, cursor: 'pointer' }}>
        <Caricature spec={ADVISOR_SPEC} size={74} mood={open ? 'good' : undefined} />
      </button>
      {open && (
        <div className="bubble" key={tip.text}>
          <div className="text-xs font-bold" style={{ color: 'var(--violet)' }}>{ADVISOR.name} · {ADVISOR.title}</div>
          <div className="mt-0.5">{tip.text}</div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {actionable && <DecideButton tip={tip} />}
            {tips.length > 1 && <button className="btn btn-sm" data-tip="עצה נוספת על המסך הזה" onClick={() => { setExtra(null); const n = (i + 1) % tips.length; setI(n); say(tips[n].text); }}>עוד עצה</button>}
            <button className="btn btn-sm btn-blue" data-tip="היועץ מריץ סימולציה על כמה פעולות זמינות וממליץ על המשתלמת ביותר" onClick={() => { const t = suggestNextMove(s); setExtra(t); say(t.text); }}>מה כדאי לי לעשות?</button>
          </div>
        </div>
      )}
    </div>
  );
}
