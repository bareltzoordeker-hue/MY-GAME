// The advisor's brain: Monte-Carlo previews of options + advice for every screen.
// It never decides — it only recommends.
import { LAWS } from '../data/laws';
import { PROJECTS } from '../data/projects';
import { CATEGORIES, GROUP_BY_ID, REGIONS, SERVICES } from '../data/world';
import type { GameState } from '../types/game';
import { clone, deficitPct, debtPct } from '../utils';
import { advisorTips } from './advisor';
import { allianceChance } from './alliances';
import { resolveCrisis } from './crises';
import { checkAction, performAction } from './decisions';
import { resolveDrama } from './drama';
import { resolveInbox } from './inbox';
import { partyStance } from './parliament';
import { coalitionSeats } from './polls';
import { getCapabilities, isPartyLeader, isPM, lawAllowed, playerMinistry } from './roles';
import { fundingRatio } from './services';
import { monthsUntilElection } from './calendar';
import { needsCampaignStart } from './campaign';

/** How good a state is for the player (career survival first). */
export function scoreState(s: GameState): number {
  const me = s.politicians[s.player.politicianId];
  const share = s.parties[s.player.partyId]?.pollShare ?? 0;
  return s.government.approval * (isPM(s) ? 1 : 0.4) + me.popularity * 0.8 + s.government.stability * (isPM(s) ? 0.35 : 0.1)
    + s.player.reputation * 0.25 + s.player.politicalCapital * 0.12 + share * 1.2 - Math.max(0, deficitPct(s) - 3) * 3 - s.crises.length * 3
    + me.power * 0.3 + (s.gameOver ? -500 : 0);
}

export interface OptionAdvice { id: string; score: number; text: string }
export interface Recommendation { bestId: string; reason: string; byId: Record<string, OptionAdvice> }

function explain(base: GameState, after: GameState[]): string {
  const avg = (f: (s: GameState) => number) => after.reduce((a, s) => a + f(s), 0) / after.length - f(base);
  const parts: string[] = [];
  const pop = avg((s) => s.politicians[s.player.politicianId].popularity);
  const appr = avg((s) => s.government.approval);
  const def = avg((s) => deficitPct(s));
  const cap = avg((s) => s.player.politicalCapital);
  const stab = avg((s) => s.government.stability);
  if (Math.abs(pop) >= 0.5) parts.push(`פופולריות ${pop > 0 ? '+' : ''}${pop.toFixed(0)}`);
  if (Math.abs(appr) >= 0.3) parts.push(`שביעות רצון ${appr > 0 ? '+' : ''}${appr.toFixed(1)}`);
  if (Math.abs(def) >= 0.05) parts.push(`גירעון ${def > 0 ? '+' : ''}${def.toFixed(1)}%`);
  if (Math.abs(stab) >= 1) parts.push(`יציבות ${stab > 0 ? '+' : ''}${stab.toFixed(0)}`);
  if (Math.abs(cap) >= 1) parts.push(`הון ${cap > 0 ? '+' : ''}${cap.toFixed(0)}`);
  return parts.length ? parts.join(' · ') : 'השפעה קטנה';
}

/** Expected value over a few RNG futures — the advisor doesn't know your luck. */
function recommend(s: GameState, ids: string[], run: (draft: GameState, id: string) => GameState): Recommendation | null {
  if (!ids.length) return null;
  const base = scoreState(s);
  const byId: Record<string, OptionAdvice> = {};
  for (const id of ids) {
    const outs: GameState[] = [];
    for (let k = 1; k <= 4; k++) {
      const d = clone(s);
      d.rngState = (s.rngState ^ (k * 2654435761)) | 0;
      try { outs.push(run(d, id)); } catch { /* ignore broken preview */ }
    }
    if (!outs.length) continue;
    const sc = outs.reduce((a, o) => a + scoreState(o), 0) / outs.length - base;
    byId[id] = { id, score: sc, text: explain(s, outs) };
  }
  const best = Object.values(byId).sort((a, b) => b.score - a.score)[0];
  if (!best) return null;
  return { bestId: best.id, reason: best.text, byId };
}

export const adviseDrama = (s: GameState) => (s.drama ? recommend(s, s.drama.options.map((o) => o.id), (d, id) => resolveDrama(d, id).state) : null);
export function adviseInbox(s: GameState, itemId: string): Recommendation | null {
  const it = s.inbox.find((i) => i.id === itemId);
  return it ? recommend(s, it.options.map((o) => o.id), (d, id) => resolveInbox(d, itemId, id).state) : null;
}
export function adviseCrisis(s: GameState, crisisId: string): Recommendation | null {
  const c = s.crises.find((x) => x.id === crisisId);
  if (!c) return null;
  return recommend(s, c.actions.filter((a) => a.capital <= s.player.politicalCapital).map((a) => a.id), (d, id) => { resolveCrisis(d, crisisId, id); return d; });
}

/** Advice for whatever screen the player is looking at — every screen, every situation. */
export interface AdviceTip { text: string; screen?: string; focus?: string }

/** Every tip can carry where to act on it: a screen and the exact button (data-focus key). */
export function screenAdvice(s: GameState, screen: string): AdviceTip[] {
  const items: AdviceTip[] = [];
  const out = {
    push: (text: string, to?: string, focus?: string) => { items.push({ text, screen: to, focus }); },
    includes: (text: string) => items.some((i) => i.text === text),
  };
  const me = s.politicians[s.player.politicianId];
  const caps = getCapabilities(s);
  const def = deficitPct(s);
  const worstSvc = Object.values(s.services).sort((a, b) => a.quality - b.quality)[0];
  const angry = Object.values(s.population.groups).sort((a, b) => a.satisfaction - b.satisfaction)[0];
  const happy = Object.values(s.population.groups).sort((a, b) => b.satisfaction - a.satisfaction)[0];
  switch (screen) {
    case 'budget': case 'economy': {
      const under = CATEGORIES.map((c) => ({ c, r: s.budget.allocations[c.id] / s.budget.needs[c.id] })).sort((a, b) => a.r - b.r)[0];
      if (caps.canManageBudget) {
        if (def > 4) out.push(`הגירעון ${def.toFixed(1)}%. אם צריך כסף – אכיפת מס עדיפה על העלאת מע״מ, שפוגעת בעניים ובמשפחות.`, 'economy', 'tax_enforcement');
        else out.push(`יש לך מרווח: גירעון ${def.toFixed(1)}%. ${under.c.name} מקבל רק ${(under.r * 100).toFixed(0)}% מהצורך – שם כל שקל מורגש.`, 'budget', `adjust_budget:${under.c.id}:+`);
        out.push(`הורדת מס הכנסה = מעמד הביניים מחייך, אבל כל 1% עולה בערך ₪${(s.economy.gdp * 0.0052).toFixed(0)}B בשנה.`, 'economy', 'set_tax:incomeTax:-');
      } else if (s.player.role === 'minister') out.push('את התקציב מחלק ראש הממשלה. אתה יכול לבקש תוספת – הסיכוי עולה כשהוא אוהב אותך והגירעון נמוך.', 'budget', 'ministry_request_budget');
      else out.push('את התקציב מחלק ראש הממשלה, ושרים יכולים לבקש תוספת למשרד שלהם. כחבר כנסטון – ההשפעה שלך עוברת דרך ועדות ותקשורת.');
      if (s.economy.inflation > 4) out.push(`אינפלציה ${s.economy.inflation.toFixed(1)}%: גירעון גבוה מדליק אותה. בנק ישמעאל עלול להעלות ריבית, וזה יאט את הצמיחה.`);
      break;
    }
    case 'government': {
      const weak = s.government.ministries.filter((m) => m.ministerId && m.ministerId !== s.player.politicianId).map((m) => ({ m, p: s.politicians[m.ministerId!] }))
        .sort((a, b) => (a.p.expertise[a.m.domain] ?? 20) - (b.p.expertise[b.m.domain] ?? 20))[0];
      const angryMin = Object.values(s.politicians).filter((p) => p.ministryId && !p.isPlayer && p.active).sort((a, b) => a.loyalty - b.loyalty)[0];
      if (isPM(s)) {
        if (weak) out.push(`${weak.p.name} ב${weak.m.name} עם מומחיות ${(weak.p.expertise[weak.m.domain] ?? 20).toFixed(0)} בלבד. מינוי מקצועי ישפר את השירות – אבל המפלגה שלו תיעלב.`, 'government', `appoint:${weak.m.id}`);
        if (angryMin) out.push(`${angryMin.name} (נאמנות ${angryMin.loyalty.toFixed(0)}) לא מרוצה ועלול לפעול נגדך. פגישה אישית יכולה לשפר את היחסים.`, 'government', `network:${angryMin.id}`);
        out.push(s.government.caretaker ? `זו ממשלת מעבר עד הבחירות. אחרי הבחירות צריך להרכיב קואליציה של 61 לפחות.` : `יש לך ${coalitionSeats(s)} מנדטים. מתחת ל-61 הממשלה חשופה להצבעת אי-אמון.`);
      } else out.push(`ראש הממשלה ${s.politicians[s.government.pmId]?.name} מתייחס אליך ב-${s.politicians[s.government.pmId]?.loyalty.toFixed(0)}. מעל 55 – הוא יאשר לך בקשות.`);
      break;
    }
    case 'parliament': case 'laws': {
      const party = s.parties[s.player.partyId];
      const good = LAWS.filter((l) => !s.activeLaws.includes(l.id) && !s.bills.some((b) => b.lawId === l.id && b.status === 'active') && lawAllowed(s, l))
        .map((l) => ({ l, st: partyStance(s, party, { id: 'x', lawId: l.id, title: l.title, sponsorId: s.player.politicianId, isGovernment: isPM(s), stage: 'final', turnsInStage: 0, proposedTurn: 0, status: 'active', push: 0, modified: false }), help: l.groups[angry.id] ?? 0 }))
        .sort((a, b) => b.help + b.st * 5 - (a.help + a.st * 5))[0];
      if (good) out.push(`${GROUP_BY_ID[angry.id].name} הכי כועסים עכשיו. "${good.l.title}" ישמח אותם${good.st > 0.3 ? ' והמפלגה שלך בעד' : ''}.`, 'laws', `propose_law:${good.l.id}`);
      const risky = s.bills.find((b) => b.status === 'active' && b.sponsorId === s.player.politicianId);
      if (risky) out.push(`ההצעה "${risky.title}" בדרך להצבעה. אם הספירה צמודה – "גיוס תמיכה" או "ריכוך" יכולים להציל אותה.`, 'parliament', `push_bill:${risky.id}`);
      out.push('חוק פרטי של ח״כ מהאופוזיציה כמעט תמיד נופל. בריתות הצבעה משנות את זה.');
      break;
    }
    case 'party': {
      if (isPartyLeader(s)) {
        const best = Object.values(s.parties).filter((p) => p.id !== s.player.partyId && p.seats > 0 && !s.alliances.some((a) => a.partyId === p.id))
          .map((p) => ({ p, c: allianceChance(s, p.id, 'bloc') })).sort((a, b) => b.c * b.p.seats - a.c * a.p.seats)[0];
        if (best) out.push(`הגוש הכי משתלם עכשיו: ${best.p.name} (${best.p.seats} מנדטים, ${Math.round(best.c * 100)}% סיכוי). גוש = המלצה עליך לנשיא.`, 'party', `alliance:${best.p.id}`);
        const rebel = s.parties[s.player.partyId].memberIds.map((id) => s.politicians[id]).filter((p) => p && !p.isPlayer && p.active).sort((a, b) => a.loyalty - b.loyalty)[0];
        if (rebel) out.push(`שים עין על ${rebel.name} – נאמנות ${rebel.loyalty.toFixed(0)}, כוח ${rebel.power.toFixed(0)}. קידום במפלגה ישפר את נאמנותו.`, 'party', `promote_member:${rebel.id}`);
        if (needsCampaignStart(s)) out.push('הקמפיין עוד לא נפתח: בחר אסטרטגיה בנושא שבוער בציבור, קהלי יעד ותקציב.', 'party', 'start_campaign');
        else if (monthsUntilElection(s) <= 6) out.push('תקופת בחירות: כנסים ופרסום מעלים תמיכה, אבל עם תשואה פוחתת. התחייבויות להמליץ חשובות להרכבת הממשלה.', 'party', 'campaign_rally');
      } else out.push(`אתה במקום ${s.player.listRank} ברשימה. כדי לטפס: כוח פוליטי. ועדות, ראיונות וגיבוי למנהיג בונים אותו.`, 'career', 'committee_work');
      break;
    }
    case 'ministry': {
      const m = playerMinistry(s);
      if (m) {
        const svc = m.services[0];
        if (svc) out.push(`המימון של המשרד: ${(fundingRatio(s, svc) * 100).toFixed(0)}% מהצורך. מתחת ל-95% – האיכות תרד לאט, ושביתה בדרך.`, isPM(s) ? 'budget' : 'ministry', isPM(s) ? `adjust_budget:${m.categories[0] ?? ''}:+` : 'ministry_request_budget');
        out.push(m.efficiency < 50 ? `יעילות ${m.efficiency.toFixed(0)}: "תוכנית התייעלות" נותנת יותר מכל תוספת תקציב.` : 'המשרד יעיל. עכשיו זה הזמן לרפורמה עם כותרת.', 'ministry', m.efficiency < 50 ? 'ministry_efficiency' : 'ministry_action');
        out.push('הסכם עם ועד העובדים לפני רפורמה מונע שביתות לשנה. זה צעד זול שמונע שיבושים.', 'ministry', 'ministry_union');
      } else out.push('כראש ממשלה אפשר להנחות כל שר. זה עולה עוד 2 הון – ומעצבן את השר.');
      break;
    }
    case 'map': case 'population': case 'state': {
      const r = REGIONS.map((x) => ({ x, st: s.population.regions[x.id] })).sort((a, b) => a.st.satisfaction - b.st.satisfaction)[0];
      out.push(`${r.x.name} הכי ממורמר (${r.st.satisfaction.toFixed(0)}). סיור שם יעשה יותר מעוד נאום במרכז.`, 'career', `visit_region:${r.x.id}`);
      out.push(`${GROUP_BY_ID[angry.id].name} הכי כועסים (${angry.satisfaction.toFixed(0)}), ${GROUP_BY_ID[happy.id].name} הכי מרוצים (${happy.satisfaction.toFixed(0)}). אל תשכח מי הבסיס שלך.`);
      out.push(`השירות הכי חלש: ${SERVICES.find((x) => x.id === worstSvc.id)?.name ?? worstSvc.id} (${worstSvc.quality.toFixed(0)}). שם יבוא המשבר הבא.`, 'state');
      break;
    }
    case 'projects': {
      // only projects the player may launch: PM – all, minister – his ministry's (same rule as the projects screen)
      const myMin = playerMinistry(s);
      const mine = (ministry: string) => s.player.role === 'pm' || (s.player.role === 'minister' && !!myMin && (myMin.origins ?? [myMin.id]).includes(ministry));
      const p = caps.canStartProjects
        ? PROJECTS.find((d) => d.service === worstSvc.id && mine(d.ministry) && !s.projects.some((x) => x.defId === d.id && x.status !== 'cancelled'))
        : undefined;
      if (!caps.canStartProjects) out.push('פרויקטים משיקים ראש הממשלה והשרים. כחבר כנסטון – ביקור באזור מוזנח ודרישה בתקשורת מקדמים פרויקט לאזור שלך.', 'career');
      if (p) out.push(`"${p.name}" ישפר את השירות הכי חלש. ${p.turns * 2} חודשים – ${p.turns * 2 <= monthsUntilElection(s) ? 'יסתיים לפני הבחירות' : 'לא יסתיים לפני הבחירות, אבל יופיע בתוכנית'}.`, 'projects', `start_project:${p.id}`);
      out.push('פרויקטים במשרדים ביורוקרטיים מתעכבים יותר. כדאי לשפר קודם את יעילות המשרד.');
      break;
    }
    case 'polls': case 'news': {
      const last = s.polls[s.polls.length - 1];
      const prev = s.polls[s.polls.length - 4] ?? s.polls[0];
      const d = (last?.seats[s.player.partyId] ?? 0) - (prev?.seats[s.player.partyId] ?? 0);
      out.push(d >= 0 ? `בחצי השנה האחרונה: ${d >= 0 ? '+' : ''}${d} מנדטים. סקרים משתנים; המגמה חשובה יותר ממדידה אחת.` : `ירדת ${-d} מנדטים בחצי שנה. הציבור שוכח מהר – תן לו משהו חדש לזכור.`);
      out.push(`${GROUP_BY_ID[angry.id].name} מכריעים בחירות יותר ממה שנדמה. ${GROUP_BY_ID[angry.id].name} כועסים = מנדטים שזזים.`);
      break;
    }
    case 'career': {
      const r = s.player.role;
      out.push(r === 'mk' ? `צעד הבא: יו״ר ועדה או שר. צריך כוח ~40 ומוניטין ~45. יש לך ${me.power.toFixed(0)} ו-${s.player.reputation.toFixed(0)}.`
        : r === 'minister' ? 'כשר: הישג במשרד + יחסים טובים עם המנהיג = הדרך לראשות המפלגה. פריימריז דורשים כוח 35 לפחות – ועדיף 60.'
          : r === 'candidate' ? 'כמועמד: בריתות-גוש והתחייבויות להמליץ שוות יותר מעוד כנס. מספרים בכנסטון מנצחים בחירות.'
            : 'כראש ממשלה: שמור על רוב של 61 ועל יציבות הקואליציה; בלי אלה הממשלה נופלת.', r === 'candidate' ? 'party' : 'career', r === 'mk' ? 'committee_work' : r === 'minister' ? 'run_primaries' : r === 'candidate' ? 'seek_endorsement' : 'press_conference');
      break;
    }
    default: break;
  }
  // always add the most urgent general tip
  const urgent = advisorTips(s)[0];
  if (urgent && !out.includes(urgent.text)) out.push(urgent.text, urgent.screen);
  return items.slice(0, 4);
}

/** Ranks quick actions available right now (for the advisor's "what should I do?" button). */
export function suggestNextMove(s: GameState): AdviceTip {
  const me = s.politicians[s.player.politicianId];
  const candidates: [string, Record<string, string | number>, string, string][] = [
    ['press_conference', {}, 'מסיבת עיתונאים: פופולריות זולה', 'career'],
    ['committee_work', { domain: me.mainDomain }, 'עבודת ועדה: מוניטין ומומחיות', 'career'],
    ['tv_interview', {}, 'ראיון באולפן: הימור על פופולריות', 'career'],
    ['ministry_union', {}, 'הסכם עם ועד העובדים: מונע שביתה', 'ministry'],
    ['ministry_efficiency', {}, 'תוכנית התייעלות: שירות טוב יותר בלי תקציב', 'ministry'],
    ['tax_enforcement', {}, 'אכיפת מס: כסף בלי להעלות מסים', 'economy'],
    ['campaign_rally', {}, 'כנס בחירות: עולה בסקרים', 'party'],
    ['support_leader', {}, 'גיבוי פומבי למנהיג: נאמנות שלו אליך', 'career'],
  ];
  let best: [string, string, string] | null = null;
  let bestScore = -Infinity;
  const base = scoreState(s);
  for (const [id, p, label, screen] of candidates) {
    if (checkAction(s, id, p)) continue;
    const sc = scoreState(performAction(s, id, p).state) - base;
    if (sc > bestScore) { bestScore = sc; best = [id, label, screen]; }
  }
  return best ? { text: `אם אין לך רעיון – ${best[1]}.`, screen: best[2], focus: best[0] } : { text: 'ההון הפוליטי שלך נמוך. הוא מתחדש בכל תור, כך שאפשר להתקדם לתור הבא.' };
}

export const debtWarning = (s: GameState) => (debtPct(s) > 80 ? 'החוב מעל 80% – כל הלוואה חדשה יקרה יותר.' : '');
