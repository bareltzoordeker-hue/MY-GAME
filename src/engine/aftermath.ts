// ============================================================
// What happens after things happen: a war that is felt over time, laws that have
// consequences after they pass, projects with ceremonies and scandals, and goals per role.
// ============================================================
import type { GameState } from '../types/game';
import type { LawDef } from '../data/laws';
import { FRONTS } from '../data/security';
import { LAW_BY_ID } from '../data/laws';
import { PROJECT_BY_ID } from '../data/projects';
import { GROUP_BY_ID, SERVICES } from '../data/world';
import { atWar } from '../data/warActions';
import { clamp } from '../utils';
import { chance, randInt } from './rng';
import { addInbox } from './characters';
import { addNews, applyEffects, logEvent } from './effects';
import { isPM, isSpeaker } from './roles';

// ---------------- war, felt turn after turn ----------------
export function warTick(s: GameState): void {
  const n = s.flags.warTurns ?? 0;
  const w = s.world;
  if (!atWar(s) || !w) {
    if (n > 0) {
      const c = w?.casualties ?? { soldiers: 0, civilians: 0 };
      const heavy = c.soldiers + c.civilians > 60;
      addNews(s, `המלחמה הסתיימה אחרי ${n} תורות: ${c.soldiers} חללים ו-${c.civilians} אזרחים הרוגים`, heavy ? 'bad' : 'neutral', '🕊️');
      logEvent(s, '🕊️', 'המלחמה הסתיימה', 3, heavy ? 'bad' : 'good', 'security');
      applyEffects(s, { stability: 4, groups: { families: 3, reservists: 4, left: 3, periphery: 2 }, playerPopularity: isPM(s) ? (heavy ? -3 : 3) : 0 });
      if (heavy && isPM(s)) addNews(s, 'דרישה לוועדת חקירה ממלכתית על ניהול המלחמה', 'bad', '🔎');
      s.flags.warTurns = 0;
    }
    return;
  }
  s.flags.warTurns = n + 1;
  const fighting = FRONTS.filter((f) => w.fronts[f.id]?.status === 'fighting');
  // soldiers fall where there is fighting; the country counts every one
  const dead = fighting.reduce((a, f) => a + randInt(s, 0, 2 + Math.round((w.fronts[f.id].threat ?? 0) / 25)), 0);
  if (dead > 0) {
    w.casualties.soldiers += dead;
    const where = fighting.map((f) => f.name).join(', ');
    addNews(s, `${dead} חיילים נפלו בלחימה ב${where}`, 'bad', '🕯️');
    logEvent(s, '🕯️', `${dead} חללים בלחימה`, 3, 'bad', 'security');
    applyEffects(s, { groups: { families: -2, reservists: -2, left: -1 }, stability: -1 });
  }
  if (n === 0) {
    // the first turns: the country closes ranks
    addNews(s, 'התלכדות סביב הדגל: תמיכה רחבה במערכה', 'neutral', '🇮🇱');
    applyEffects(s, { stability: 3, playerPopularity: isPM(s) ? 3 : 1, groups: { right: 3, center: 2 } });
    if (fighting.some((f) => f.id === 'lebanon' || f.id === 'gaza')) {
      addNews(s, 'עשרות אלפי תושבי הגבול פונו מבתיהם למלונות', 'bad', '🏚️');
      applyEffects(s, { groups: { periphery: -4, families: -1 }, services: { housing: -1 } });
    }
  } else {
    // then fatigue: reservists, families and the self-employed carry it
    const fatigue = Math.min(4, n);
    applyEffects(s, { groups: { reservists: -fatigue, families: -1, selfEmployed: -1, employees: -1 }, stability: -1 });
    if (n === 2) addNews(s, 'עייפות מלחמה: משרתי מילואים ומשפחות דורשים אופק', 'bad', '😮‍💨');
    if (n === 4) addNews(s, 'עסקים קטנים בקו העימות: "עוד חודש כזה ואנחנו סוגרים"', 'bad', '🏪');
  }
  // the world loses patience
  for (const ch of Object.keys(w.channels)) w.channels[ch] = clamp(w.channels[ch] - (ch === 'usa' ? 1 : 1.5));
  if (n >= 2 && (n - 2) % 2 === 0 && isPM(s) && !s.inbox.some((i) => i.kind === 'war_pressure')) {
    addInbox(s, {
      kind: 'war_pressure', title: 'לחץ בינלאומי להפסקת אש', expiresTurn: s.turn + 1,
      text: 'ארה״ב ומדינות אירופה דורשות להיכנס למשא ומתן על הפסקת אש. סירוב יעלה במחיר מדיני; הסכמה תרגיז את הימין ואת השותפים הניציים.',
      options: [{ id: 'talks', label: 'להסכים לשיחות על הפסקת אש' }, { id: 'refuse', label: 'לסרב ולהמשיך במערכה' }], defaultOptionId: 'refuse', payload: {},
    });
  }
}

// ---------------- laws have consequences ----------------
export function registerLaw(s: GameState, law: LawDef): void {
  (s.aftermath ??= []).push({ lawId: law.id, turn: s.turn });
}

export function lawAftermathTick(s: GameState): void {
  for (const a of s.aftermath ?? []) {
    const law = LAW_BY_ID[a.lawId];
    if (!law) continue;
    const dt = s.turn - a.turn;
    const stage = a.stage ?? 0;
    if (dt >= 1 && stage < 1) {
      a.stage = 1;
      const entries = Object.entries(law.groups) as [keyof typeof GROUP_BY_ID, number][];
      const worst = entries.sort((x, y) => x[1] - y[1])[0];
      const best = entries.sort((x, y) => y[1] - x[1])[0];
      if (worst && worst[1] <= -8) {
        addNews(s, `${GROUP_BY_ID[worst[0]].name} מפגינים נגד ${law.title}`, 'bad', '📢');
        applyEffects(s, { groups: { [worst[0]]: -2 }, stability: -1 });
      } else if (best && best[1] >= 8) {
        addNews(s, `${GROUP_BY_ID[best[0]].name} מברכים: ${law.title} נכנס לתוקף`, 'good', '🎉');
        applyEffects(s, { playerPopularity: 1 });
      }
    }
    if (dt >= 2 && stage < 2) {
      a.stage = 2;
      if (law.budget) addNews(s, `העלות של ${law.title} מתבררת: ₪${law.budget.amount} מיליארד בשנה`, 'neutral', '🧾');
      else if (law.serviceBonus) {
        const svc = Object.keys(law.serviceBonus)[0];
        addNews(s, `דוח ראשון: ${law.title} משפר את ${SERVICES.find((x) => x.id === svc)?.name ?? 'השירות'}`, 'good', '📈');
      }
    }
    if (dt >= 3 && stage < 3) {
      a.stage = 3;
      const i = law.ideology;
      const polarizing = law.level === 'major' && (Math.abs(i.security) >= 0.6 || Math.abs(i.economic) >= 0.6 || Math.abs(i.religion) >= 0.6);
      if (polarizing && isPM(s) && chance(s, 0.5) && !s.inbox.some((x) => x.kind === 'court_petition')) {
        addInbox(s, {
          kind: 'court_petition', title: `עתירה לבג״ץ נגד ${law.title}`, expiresTurn: s.turn + 1,
          text: 'ארגונים עתרו לבג״ץ. הייעוץ המשפטי מעריך שיש סיכוי שהחוק ייפסל. אפשר להגן עליו בבית המשפט, או לתקן אותו מראש.',
          options: [{ id: 'defend', label: 'להגן על החוק בבג״ץ (5 הון)' }, { id: 'amend', label: 'לתקן את החוק' }], defaultOptionId: 'defend', payload: { lawId: law.id },
        });
      }
    }
  }
  s.aftermath = (s.aftermath ?? []).filter((a) => s.turn - a.turn <= 3);
}

// ---------------- projects: ceremonies and scandals ----------------
export function projectStarted(s: GameState, projectId: string): void {
  const p = s.projects.find((x) => x.id === projectId);
  const def = p && PROJECT_BY_ID[p.defId];
  if (!p || !def) return;
  const ministry = s.government.ministries.find((m) => m.services.includes(p.service));
  if (def.cost >= 10 && (ministry?.bureaucracy ?? 50) > 58 && chance(s, 0.12)) {
    s.flags[`scandal_${p.id}`] = 1;
    addNews(s, `חשד לשחיתות במכרז של ${p.name}`, 'bad', '🕵️');
    logEvent(s, '🕵️', `חשד לשחיתות במכרז: ${p.name}`, 3, 'bad', 'project');
    applyEffects(s, { stability: -2, playerReputation: p.sponsorId === s.player.politicianId ? -2 : 0 });
  }
}

export function projectCeremony(s: GameState, projectId: string): void {
  const p = s.projects.find((x) => x.id === projectId);
  if (!p) return;
  const sponsor = s.politicians[p.sponsorId];
  if (sponsor && !sponsor.isPlayer) addNews(s, `${sponsor.name} גזר את הסרט ב${p.name}`, 'good', '✂️');
  if (p.sponsorId === s.player.politicianId) applyEffects(s, { playerPopularity: 2 });
}

export function projectDelayed(s: GameState, projectId: string): void {
  const p = s.projects.find((x) => x.id === projectId);
  if (!p || p.delays !== 3) return;
  addNews(s, `ועדת הכספים דורשת הסברים על העיכובים ב${p.name}`, 'bad', '🏛️');
  if (p.sponsorId === s.player.politicianId) applyEffects(s, { playerReputation: -1 });
}

// ---------------- goals per role ----------------
export interface Goal { text: string; done: boolean; progress: string }

export function careerGoals(s: GameState): Goal[] {
  const me = s.politicians[s.player.politicianId];
  const poll = s.polls[s.polls.length - 1];
  const held = s.government.ministries.filter((m) => m.ministerId === me.id);
  const myProjects = s.projects.filter((p) => p.sponsorId === me.id && p.status === 'done').length;
  const g = (text: string, value: number, target: number, unit = ''): Goal => ({ text, done: value >= target, progress: `${Math.round(value)}${unit} / ${target}${unit}` });
  if (s.player.role === 'pm') {
    return [
      g('שביעות רצון מהממשלה 55% ומעלה', s.government.approval, 55, '%'),
      g('חמישה חוקים שהעברת', s.career.lawsPassed, 5),
      { text: 'גירעון מתחת ל-3%', done: s.economy.deficit < 3, progress: `${s.economy.deficit.toFixed(1)}% / 3%` },
      g('קדנציה מלאה (48 חודשים)', s.career.turnsInRole.pm, 48),
    ];
  }
  if (isSpeaker(s)) {
    return [
      g('מוניטין 70 ומעלה', s.player.reputation, 70),
      g('רפורמה בתקנון הכנסטון', s.flags.speakerReform ?? 0, 1),
      g('שלושה תיווכים בין קואליציה לאופוזיציה', s.flags.speakerMediations ?? 0, 3),
      g('פופולריות 50 ומעלה', me.popularity, 50),
    ];
  }
  if (s.player.role === 'minister') {
    const funded = held.length ? Math.min(...held.map((m) => (m.categories[0] ? (100 * s.budget.allocations[m.categories[0]]) / Math.max(0.1, s.budget.needs[m.categories[0]]) : 100))) : 0;
    return [
      g('שלושה חוקים שהעברת', s.career.lawsPassed, 3),
      g('שני פרויקטים שחנכת', myProjects, 2),
      g('יעילות המשרד 60 ומעלה', held.length ? Math.max(...held.map((m) => m.efficiency)) : 0, 60),
      g('המשרד ממומן ב-100% מהצורך', funded, 100, '%'),
    ];
  }
  if (s.player.role === 'candidate') {
    return [
      g('המפלגה בסקר: 15 מנדטים ומעלה', poll?.seats[s.player.partyId] ?? 0, 15),
      g('פופולריות 55 ומעלה', me.popularity, 55),
      { text: 'להקים ממשלה', done: s.government.pmId === me.id, progress: s.government.pmId === me.id ? 'הושג' : 'עדיין לא' },
    ];
  }
  const wasMk = s.career.roleHistory.some((r) => r.role === 'mk');
  const rose = wasMk && s.career.roleHistory.some((r) => r.role === 'minister' || r.role === 'pm');
  return [
    g('חוק פרטי שהעברת', s.career.lawsPassed, 1),
    g('כוח פוליטי 50 ומעלה', me.power, 50),
    g('פופולריות 40 ומעלה', me.popularity, 40),
    { text: 'תפקיד בממשלה', done: rose, progress: rose ? 'הושג' : me.committee ? 'חבר ועדה' : 'עדיין לא' },
  ];
}
