// Advisor: summarises, warns, explains. Never decides.
import { N } from './ai/narrative';
import { MAJORITY, SERVICES } from '../data/world';
import type { GameState } from '../types/game';
import { debtPct, deficitPct } from '../utils';
import { electionCountdown, monthsUntilElection } from './calendar';
import { coalitionSeats } from './polls';
import { isPartyLeader, isPM } from './roles';
import { fundingRatio } from './services';

export interface AdvisorTip { priority: number; icon: string; text: string; screen?: string }

export function advisorTips(s: GameState): AdvisorTip[] {
  const t: AdvisorTip[] = [];
  const me = s.politicians[s.player.politicianId];
  const def = deficitPct(s);
  const pm = isPM(s);

  for (const c of s.crises) t.push({ priority: 95, icon: '🚨', text: `${c.title} עדיין לא טופל. כל תור בלי טיפול פוגע בשביעות הרצון ובתמיכה בממשלה.`, screen: 'crises' });
  if (s.elections.phase === 'negotiation') t.push({ priority: 100, icon: '🤝', text: `צריך להרכיב ממשלה: ${MAJORITY} מנדטים לפחות. כל שותפה מציבה דרישות לתיקים, לתקציבים ולחוקים.`, screen: 'government' });
  if (pm && !s.budget.passed && !s.government.caretaker) t.push({ priority: 90, icon: '📒', text: `תקציב ${s.budget.fiscalYear} עוד לא אושר. אם הוא לא יעבור בזמן, הכנסטון יתפזר ויתקיימו בחירות.`, screen: 'budget' });
  if (pm && !s.government.caretaker && coalitionSeats(s) < MAJORITY) t.push({ priority: 92, icon: '⚠️', text: `לקואליציה ${coalitionSeats(s)} מנדטים, פחות מרוב. כל הצבעת אי-אמון עלולה להפיל את הממשלה.`, screen: 'government' });
  if (def > 5) t.push({ priority: 80, icon: '📉', text: `הגירעון ${def.toFixed(1)}% מהתוצר. חברות הדירוג עלולות להוריד את דירוג האשראי, וזה ייקר את החוב.`, screen: 'economy' });
  else if (def > 3.5 && pm) t.push({ priority: 55, icon: '📉', text: `הגירעון ${def.toFixed(1)}% מהתוצר, מעל היעד. הוצאות נוספות יחייבו מקור מימון.`, screen: 'economy' });
  if (debtPct(s) > 80) t.push({ priority: 70, icon: '🏦', text: `החוב ${debtPct(s).toFixed(0)}% מהתוצר. תשלומי הריבית גדלים ומצמצמים את התקציב לשירותים.`, screen: 'economy' });
  if (s.economy.inflation > 4.5) t.push({ priority: 65, icon: '📈', text: `האינפלציה ${s.economy.inflation.toFixed(1)}%. יוקר המחיה פוגע במשפחות ובמעמד הביניים ועלול להוביל למחאה.`, screen: 'economy' });
  if (s.economy.unemployment > 6.5) t.push({ priority: 60, icon: '👷', text: `האבטלה ${s.economy.unemployment.toFixed(1)}%. כדאי לשקול גירוי כלכלי או הכשרות מקצועיות.`, screen: 'economy' });

  for (const svc of Object.values(s.services)) {
    const name = SERVICES.find((x) => x.id === svc.id)?.name ?? svc.id;
    if (svc.quality < 40) t.push({ priority: 58, icon: '🏚️', text: `${name} במצב קשה (${svc.quality.toFixed(0)}). השירות מקבל ${(fundingRatio(s, svc.id) * 100).toFixed(0)}% מהצורך התקציבי.`, screen: 'state' });
  }
  const angry = Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && p.loyalty < 25 && (p.ministryId || p.partyId === me.partyId));
  if (angry.length) t.push({ priority: 50, icon: '😠', text: `${angry.slice(0, 2).map((p) => p.name).join(' ו')} מאוד לא מרוצים ממך. פגישה אישית, מינוי או פיטורים – לפני שהם יפעלו נגדך.`, screen: 'government' });
  const promises = Object.values(s.politicians).flatMap((p) => p.memory.filter((m) => m.kind === 'promise' && !m.resolved && m.deadlineTurn !== undefined && m.deadlineTurn - s.turn <= 2).map((m) => ({ p, m })));
  if (promises.length) t.push({ priority: 62, icon: '🤞', text: `תזכורת: הבטחת ל${promises[0].p.name}: "${promises[0].m.text}". המועד מתקרב.`, screen: 'career' });
  const pendingPromises = s.promises.filter((p) => p.status === 'pending' && p.deadlineTurn - s.turn <= 4);
  if (pendingPromises.length) t.push({ priority: 60, icon: '📜', text: `תזכורת: הבטחת לציבור "${pendingPromises[0].text}". אם היא לא תקוים, האמון בך ייפגע.`, screen: 'career' });

  const months = monthsUntilElection(s);
  if (months <= 12 && s.elections.phase === 'none') t.push({ priority: 75, icon: '🗳️', text: `הבחירות בעוד ${electionCountdown(s)}. ${isPartyLeader(s) ? 'זה הזמן לבנות קמפיין, בריתות והבטחות שאפשר לעמוד בהן.' : 'זה הזמן לחזק את מעמדך במפלגה לקראת הרכבת הרשימה.'}`, screen: 'party' });
  if (s.inbox.length) t.push({ priority: 68, icon: '📥', text: `${s.inbox.length} נושאים ממתינים להחלטתך. מה שלא תחליט – יוכרע אוטומטית בסוף התור.`, screen: 'dashboard' });
  if (s.player.role === 'mk' && me.power < 30) t.push({ priority: 40, icon: '📑', text: 'הכוח הפוליטי שלך נמוך. עבודת ועדה, ראיונות ופגישות עם עמיתים יחזקו את מעמדך.', screen: 'career' });
  if (s.player.role === 'mk' && me.power >= 45 && s.player.reputation >= 45) t.push({ priority: 45, icon: '🙋', text: 'יש לך כוח ומוניטין. אפשר לבקש תפקיד מהמנהיג, או לשקול התמודדות על ראשות המפלגה.', screen: 'career' });
  if (s.player.politicalCapital > 85) t.push({ priority: 30, icon: '🎯', text: 'צברת הרבה הון פוליטי. זה זמן טוב לקדם מהלך גדול: חוק, רפורמה או פרויקט.', screen: 'dashboard' });
  if (s.government.approval > 55 && pm) t.push({ priority: 25, icon: '📊', text: 'שביעות הרצון מהממשלה גבוהה. זו הזדמנות לקדם רפורמה שדורשת תמיכה ציבורית.' });
  if (!t.length) t.push({ priority: 10, icon: '✅', text: 'אין כרגע נושא דחוף. אפשר להתקדם לתור הבא או לקדם יוזמה משלך.' });
  return t.sort((a, b) => b.priority - a.priority);
}

export function advisorHeadline(s: GameState): string {
  const tip = advisorTips(s)[0];
  return `${N.advisorTone(s)} ${tip.text}`;
}
