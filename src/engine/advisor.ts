// Advisor: summarises, warns, explains. Never decides.
import { N } from './ai/narrative';
import { MAJORITY } from '../data/world';
import type { GameState } from '../types/game';
import { debtPct, deficitPct } from '../utils';
import { coalitionSeats } from './polls';
import { isPartyLeader, isPM, turnsToElection } from './roles';
import { fundingRatio } from './services';

export interface AdvisorTip { priority: number; icon: string; text: string; screen?: string }

export function advisorTips(s: GameState): AdvisorTip[] {
  const t: AdvisorTip[] = [];
  const me = s.politicians[s.player.politicianId];
  const def = deficitPct(s);
  const pm = isPM(s);

  for (const c of s.crises) t.push({ priority: 95, icon: '🚨', text: `${c.title} עדיין בוער. כל תור שעובר – הציבור זוכר, והתקשורת סופרת.`, screen: 'crises' });
  if (s.elections.phase === 'negotiation') t.push({ priority: 100, icon: '🤝', text: 'צריך להרכיב ממשלה. כולם רוצים את האוצר, אף אחד לא רוצה את הרווחה. 61 או הביתה.', screen: 'government' });
  if (pm && !s.budget.passed) t.push({ priority: 90, icon: '📒', text: `תקציב ${s.budget.fiscalYear} עוד לא אושר. כל שותף ייזכר עכשיו שהוא צריך עוד מיליארד. ואם ייפול – בחירות.`, screen: 'budget' });
  if (pm && coalitionSeats(s) < MAJORITY) t.push({ priority: 92, icon: '⚠️', text: `נשארו לך ${coalitionSeats(s)} מנדטים. עוד שני תורות כאלה ואתה מתחיל לארוז את הלשכה.`, screen: 'government' });
  if (def > 5) t.push({ priority: 80, icon: '📉', text: `גירעון ${def.toFixed(1)}%. מודי׳ס-שמודי׳ס כבר מחממים את המקלדת.`, screen: 'economy' });
  else if (def > 3.5 && pm) t.push({ priority: 55, icon: '📉', text: `גירעון ${def.toFixed(1)}%. עוד מתנה אחת לשותפים וזה נגמר בהורדת דירוג.`, screen: 'economy' });
  if (debtPct(s) > 80) t.push({ priority: 70, icon: '🏦', text: `החוב ${debtPct(s).toFixed(0)}% מהתוצר. הנכדים שלנו כבר חייבים כסף, והם עוד לא נולדו.`, screen: 'economy' });
  if (s.economy.inflation > 4.5) t.push({ priority: 65, icon: '🔥', text: `אינפלציה ${s.economy.inflation.toFixed(1)}%. הקוטג׳ מתחיל להיראות כמו השקעה. המחאה בדרך.`, screen: 'economy' });
  if (s.economy.unemployment > 6.5) t.push({ priority: 60, icon: '👷', text: `אבטלה ${s.economy.unemployment.toFixed(1)}%. הרבה אנשים עם הרבה זמן פנוי להפגין.`, screen: 'economy' });

  for (const svc of Object.values(s.services)) {
    if (svc.quality < 40) t.push({ priority: 58, icon: '🏚️', text: `${svc.id === 'govServices' ? 'שירותי הממשל' : svc.id} קורס (${svc.quality.toFixed(0)}). מקבל ${(fundingRatio(s, svc.id) * 100).toFixed(0)}% מהצורך. מישהו ישים לב רק כשזה יתפוצץ – כלומר בקרוב.`, screen: 'state' });
  }
  const angry = Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && p.loyalty < 25 && (p.ministryId || p.partyId === me.partyId));
  if (angry.length) t.push({ priority: 50, icon: '😠', text: `${angry.slice(0, 2).map((p) => p.name).join(' ו')} כבר מחדדים סכינים. קפה, מינוי או פיטורים – לפני שהם יבחרו בשבילך.`, screen: 'government' });
  const promises = Object.values(s.politicians).flatMap((p) => p.memory.filter((m) => m.kind === 'promise' && !m.resolved && m.deadlineTurn !== undefined && m.deadlineTurn - s.turn <= 2).map((m) => ({ p, m })));
  if (promises.length) t.push({ priority: 62, icon: '🤞', text: `הבטחת ל${promises[0].p.name}: "${promises[0].m.text}". הוא סופר ימים. בטוש אדום.`, screen: 'career' });
  const pendingPromises = s.promises.filter((p) => p.status === 'pending' && p.deadlineTurn - s.turn <= 4);
  if (pendingPromises.length) t.push({ priority: 60, icon: '📜', text: `הבטחת "${pendingPromises[0].text}". הבוחרים, לצערנו, זוכרים.`, screen: 'career' });

  const tte = turnsToElection(s);
  if (tte <= 6 && tte > 0) t.push({ priority: 75, icon: '🗳️', text: `בחירות בעוד ${tte * 2} חודשים. ${isPartyLeader(s) ? 'עכשיו מבטיחים הכול לכולם. ההתנצלויות – אחרי.' : 'זה הזמן לחנף למנהיג ולהשיג מקום ריאלי.'}`, screen: 'party' });
  if (s.inbox.length) t.push({ priority: 68, icon: '📥', text: `${s.inbox.length} החלטות מחכות לך. מי שלא עונה – מחליטים בשבילו, ובדרך כלל נגדו.`, screen: 'dashboard' });
  if (s.player.role === 'mk' && me.power < 30) t.push({ priority: 40, icon: '📑', text: 'אתה כל כך אלמוני שהשומר בכניסה מבקש תעודה. ועדות וראיונות – או שתישאר רהיט.', screen: 'career' });
  if (s.player.role === 'mk' && me.power >= 45 && s.player.reputation >= 45) t.push({ priority: 45, icon: '🙋', text: 'יש לך כוח. בקש תפקיד יפה – או תקע סכין בגב המנהיג. שתיהן אופציות לגיטימיות כאן.', screen: 'career' });
  if (s.player.politicalCapital > 85) t.push({ priority: 30, icon: '🎯', text: 'אתה יושב על הר של הון פוליטי. הון פוליטי זה כמו חלב: מחמיץ אם לא משתמשים.', screen: 'dashboard' });
  if (s.government.approval > 55 && pm) t.push({ priority: 25, icon: '😎', text: 'הציבור מרוצה. חשוד. זה הזמן לרפורמה כואבת – לפני שהם יתעוררו.' });
  if (!t.length) t.push({ priority: 10, icon: '☕', text: 'שקט מחשיד. בפוליטיקה, שקט זה רק הפסקת פרסומות בין שתי שערוריות.' });
  return t.sort((a, b) => b.priority - a.priority);
}

export function advisorHeadline(s: GameState): string {
  const tip = advisorTips(s)[0];
  return `${N.advisorTone(s)} ${tip.text}`;
}
