// ============================================================
// Character Engine — deterministic rules for loyalty, power, memory and
// AI-initiated actions. Text comes from the Narrative engine.
// ============================================================
import { LAW_BY_ID } from '../data/laws';
import { DIFFICULTIES } from '../data/world';
import { chance, pick, rand } from './rng';
import type { BudgetCategory, GameState, InboxItem, Politician } from '../types/game';
import { clamp, deficitPct, lerp, newId, round1 } from '../utils';
import { addNews, logEvent } from './effects';
import { proposeBill } from './parliament';
import { isPartyLeader, isPM } from './roles';
import { fundingRatio } from './services';

export function addInbox(s: GameState, item: Omit<InboxItem, 'id' | 'createdTurn'>): void {
  if (s.inbox.some((i) => i.kind === item.kind && i.fromId === item.fromId)) return;
  s.inbox.push({ ...item, id: newId(s, 'in'), createdTurn: s.turn });
}

export const memoryScore = (p: Politician) => p.memory.reduce((a, m) => a + (m.resolved ? 0 : m.weight), 0);

export function loyaltyBaseline(s: GameState, p: Politician): number {
  const me = s.politicians[s.player.politicianId];
  const same = p.partyId === me.partyId;
  const meInGov = s.government.coalition.includes(me.partyId);
  const pInGov = s.government.coalition.includes(p.partyId);
  let b = same ? 58 : meInGov === pInGov ? 45 : 28;
  const ideo = 1 - (Math.abs(p.ideology.economic - me.ideology.economic) + Math.abs(p.ideology.security - me.ideology.security) + Math.abs(p.ideology.religion - me.ideology.religion)) / 3;
  b += (ideo - 0.6) * 20;
  b += memoryScore(p) * 0.5;
  if (isPM(s) && p.ministryId) {
    const m = s.government.ministries.find((x) => x.id === p.ministryId);
    const svc = m?.services[0];
    if (svc) b += clamp((fundingRatio(s, svc) - 1) * 40, -12, 10);
  }
  b -= (p.personality.ego - 0.5) * 10;
  b += (s.politicians[s.player.politicianId].power - 50) * 0.1;
  return clamp(b, 5, 95);
}

function positionPower(s: GameState, p: Politician): number {
  if (s.government.pmId === p.id) return 90;
  const party = s.parties[p.partyId];
  if (party?.leaderId === p.id) return 45 + party.seats * 1.2;
  if (p.ministryId) return p.ministryId === 'finance' || p.ministryId === 'defense' ? 62 : 52;
  if (p.committee) return 36;
  return 22;
}

export function simulateCharacters(s: GameState): void {
  const d = DIFFICULTIES[s.difficulty];
  for (const p of Object.values(s.politicians)) {
    if (!p.active) continue;
    // ---- memory: promises turn into betrayals when deadlines pass ----
    for (const m of p.memory) {
      if (m.kind === 'promise' && !m.resolved && m.ref) {
        const kept = m.ref === 'role' ? !!(p.ministryId || p.committee) : s.activeLaws.includes(m.ref);
        if (kept) {
          m.resolved = true;
          p.memory.push({ turn: s.turn, kind: 'favor', text: `קיימת את ההבטחה: ${m.text}`, weight: 12 });
          p.loyalty = clamp(p.loyalty + 8);
          continue;
        }
      }
      if (m.kind === 'promise' && !m.resolved && m.deadlineTurn !== undefined && m.deadlineTurn <= s.turn) {
        m.resolved = true;
        p.memory.push({ turn: s.turn, kind: 'betrayal', text: `הבטחת: "${m.text}" — ולא קיימת`, weight: -22 });
        p.loyalty = clamp(p.loyalty - 15);
        if (!p.isPlayer) {
          addNews(s, `${p.name}: "הבטיחו לי ${m.text}, וההבטחה לא קוימה."`, 'bad', '🗯️');
          logEvent(s, '🗯️', `${p.name} זוכר שלא קיימת הבטחה`, 2, 'bad', 'memory');
        }
      }
      if (m.kind !== 'promise') m.weight *= 0.94;
    }
    p.memory = p.memory.filter((m) => (m.kind === 'promise' && !m.resolved) || Math.abs(m.weight) >= 1);

    p.power = clamp(lerp(p.power, positionPower(s, p) + p.popularity * 0.2 + Math.min(10, p.experience * 0.4), 0.1));
    p.experience += 1 / 6;
    if (p.isPlayer) continue;
    p.loyalty = clamp(lerp(p.loyalty, loyaltyBaseline(s, p), 0.08 * d.loyaltyDrift));
    const party = s.parties[p.partyId];
    p.popularity = clamp(lerp(p.popularity, 32 + (party?.momentum ?? 0) * 0.5 + (party?.leaderId === p.id ? 12 : 0), 0.05));
    // relationship with the PM drifts with coalition membership
    const pmRel = p.relationships[s.government.pmId] ?? 0;
    p.relationships[s.government.pmId] = clamp(lerp(pmRel, s.government.coalition.includes(p.partyId) ? 20 : -25, 0.05), -100, 100);
  }

  // player popularity
  const me = s.politicians[s.player.politicianId];
  const myParty = s.parties[s.player.partyId];
  const base =
    s.player.role === 'pm' ? s.government.approval
      : s.player.role === 'candidate' ? 30 + myParty.momentum * 0.6 + (100 - s.government.approval) * 0.25
        : s.player.role === 'minister' ? 22 + s.player.reputation * 0.25 + myParty.momentum * 0.3
          : 10 + s.player.reputation * 0.25 + myParty.momentum * 0.2;
  me.popularity = clamp(lerp(me.popularity, base, s.player.role === 'pm' ? 0.2 : 0.07));

  // party cohesion = how much members like their leader (player: loyalty; AI: steady)
  for (const party of Object.values(s.parties)) {
    const members = party.memberIds.map((id) => s.politicians[id]).filter((x) => x && x.active && x.id !== party.leaderId);
    const target = party.leaderId === s.player.politicianId
      ? members.reduce((a, m) => a + m.loyalty, 0) / Math.max(1, members.length)
      : 68 + party.momentum * 0.3;
    party.cohesion = clamp(lerp(party.cohesion, target, 0.15));
    party.power = clamp(party.seats * 1.6 + party.cohesion * 0.2);
  }
}

/** Political capital income, once per turn. `steps` is the turn's length in 2-month steps;
 *  short campaign turns still pay at least half, so every turn brings something. */
export function capitalIncome(s: GameState, steps: number): void {
  const d = DIFFICULTIES[s.difficulty];
  const me = s.politicians[s.player.politicianId];
  const gain = { pm: 6, candidate: 5, minister: 4, mk: 3 }[s.player.role] * d.capitalGain + (me.popularity - 40) * 0.05 + (s.player.reputation - 40) * 0.03;
  // +8 every turn on top, so there is always enough to act on
  s.player.politicalCapital = clamp(s.player.politicalCapital + Math.max(1, gain) * Math.max(0.5, steps) + 8);
}

// ---------------- AI initiatives ----------------
type Initiative = { weight: number; run: () => void };

function grievance(p: Politician): number {
  const neg = p.memory.filter((m) => m.weight < 0 && !m.resolved).reduce((a, m) => a - m.weight, 0);
  return clamp((100 - p.loyalty) / 100 * 0.5 + p.personality.ambition * 0.3 + p.personality.ego * 0.15 + Math.min(0.3, neg / 80), 0, 1.3);
}

function ministryCategory(s: GameState, p: Politician): BudgetCategory | null {
  const m = s.government.ministries.find((x) => x.id === p.ministryId);
  return m?.categories[0] ?? null;
}

function initiativesFor(s: GameState, p: Politician): Initiative[] {
  const out: Initiative[] = [];
  const me = s.politicians[s.player.politicianId];
  const myParty = s.parties[s.player.partyId];
  const sameParty = p.partyId === me.partyId;
  const pInGov = s.government.coalition.includes(p.partyId);
  const party = s.parties[p.partyId];
  const isLeader = party?.leaderId === p.id;
  const pm = isPM(s);
  const exp = s.turn + 2;

  // ---- opposition attacks (any role) ----
  if (!pInGov && isLeader && s.government.approval < 48) {
    out.push({ weight: 1.2, run: () => {
      party.momentum = clamp(party.momentum + 3, -40, 40);
      if (s.government.coalition.includes(me.partyId)) me.popularity = clamp(me.popularity - 1.5);
      addNews(s, `${p.name} תוקף: "${pick(s, ['הממשלה מנותקת מהמצוקות של הציבור', 'יוקר המחיה מכביד, והממשלה לא עושה דבר', 'זו ממשלה של כישלון בניהול המדינה', 'הממשלה מפקירה את הפריפריה', 'הגיע הזמן לבחירות ולשינוי כיוון'])}"`, 'bad', '🎤');
      logEvent(s, '🎤', `האופוזיציה תוקפת: ${p.name}`, 1, 'bad', 'opposition');
    } });
  }
  // ---- private bills ----
  if (party && party.favoriteLaws.length && p.personality.ambition > 0.4) {
    const lawId = party.favoriteLaws.find((l) => !s.activeLaws.includes(l) && !s.bills.some((b) => b.lawId === l && b.status === 'active'));
    if (lawId) out.push({ weight: 0.6, run: () => {
      if (proposeBill(s, lawId, p.id, false)) {
        addNews(s, `${p.name} מגיש הצעת חוק: ${LAW_BY_ID[lawId].title}`, 'neutral', '📝');
        logEvent(s, '📝', `${p.name} הגיש הצעת חוק פרטית`, 1, 'neutral', 'bill');
      }
    } });
  }

  if (pm) {
    if (p.ministryId && pInGov) {
      const cat = ministryCategory(s, p);
      if (cat && s.budget.allocations[cat] / s.budget.needs[cat] < 0.97) {
        const amount = round1(s.budget.needs[cat] * 0.04);
        out.push({ weight: 1.5, run: () => addInbox(s, {
          kind: 'minister_budget', title: `${p.name} דורש תוספת תקציב`, fromId: p.id, expiresTurn: exp,
          text: `"המשרד שלי לא עומד במשימות בתקציב הנוכחי. אני מבקש תוספת של ₪${amount} מיליארד בשנה."`,
          options: [{ id: 'approve', label: `לאשר ₪${amount}B` }, { id: 'half', label: 'לאשר חצי' }, { id: 'refuse', label: 'לסרב' }],
          defaultOptionId: 'refuse', payload: { category: cat, amount },
        }) });
      }
      if (p.loyalty < 35 && p.personality.ambition > 0.4 && cat) {
        const amount = round1(s.budget.needs[cat] * 0.06);
        out.push({ weight: 1.3, run: () => {
          addInbox(s, {
            kind: 'resign_threat', title: `${p.name} מאיים להתפטר`, fromId: p.id, expiresTurn: exp,
            text: `"בלי תוספת של ₪${amount} מיליארד אני לא יכול להמשיך לשאת באחריות. אם הבקשה תידחה, אתפטר."`,
            options: [{ id: 'give', label: 'לאשר את התוספת' }, { id: 'refuse', label: 'לסרב' }, { id: 'fire', label: 'לפטר אותו עכשיו' }],
            defaultOptionId: 'refuse', payload: { category: cat, amount },
          });
          addNews(s, `${p.name} מאיים להתפטר`, 'bad', '🚪');
        } });
      }
    }
    if (isLeader && pInGov && p.partyId !== me.partyId && (p.loyalty < 42 || s.government.stability < 40)) {
      const lawId = party.favoriteLaws.find((l) => !s.activeLaws.includes(l) && !s.bills.some((b) => b.lawId === l && b.status === 'active'));
      out.push({ weight: 1.4, run: () => {
        addInbox(s, {
          kind: 'ultimatum', title: `אולטימטום מ${party.name}`, fromId: p.id, expiresTurn: exp,
          text: lawId ? `"אם ${LAW_BY_ID[lawId].title} לא יקודם כפי שסוכם, נשקול את המשך דרכנו בקואליציה."` : `"אנחנו דורשים ₪2 מיליארד לנושאים שסוכמו בהסכם הקואליציוני. אחרת נשקול את צעדינו."`,
          options: [{ id: 'accept', label: 'להיענות' }, { id: 'refuse', label: 'לסרב' }],
          defaultOptionId: 'refuse', payload: lawId ? { lawId } : { category: 'welfare', amount: 2 },
        });
        addNews(s, `${p.name} מציב אולטימטום לראש הממשלה`, 'bad', '⏰');
      } });
    }
  }

  if (sameParty && isPartyLeader(s) && !p.ministryId && p.personality.ambition > 0.5 && p.loyalty < 55) {
    out.push({ weight: 1, run: () => addInbox(s, {
      kind: 'demand_role', title: `${p.name} רוצה ${s.player.role === 'candidate' ? 'מקום ריאלי' : 'תפקיד'}`, fromId: p.id, expiresTurn: exp,
      text: `"עבדתי קשה למען המפלגה בשנים האחרונות. אני מבקש ${s.player.role === 'candidate' ? 'מקום ריאלי ברשימה' : 'תפקיד בממשלה'}."`,
      options: [{ id: 'promise', label: 'להבטיח (תוך שנתיים)' }, { id: 'refuse', label: 'לסרב בנימוס' }],
      defaultOptionId: 'refuse', payload: {},
    }) });
  }
  if (sameParty && isPartyLeader(s) && p.power > 45 && me.popularity < 32 && p.loyalty < 38 && p.personality.ambition > 0.6 && (s.flags.challenge_cd ?? 0) <= s.turn) {
    out.push({ weight: 2, run: () => {
      s.flags.challenge_cd = s.turn + 8;
      addInbox(s, {
        kind: 'leadership_challenge', title: `${p.name} קורא תיגר על ההנהגה`, fromId: p.id, expiresTurn: s.turn + 1,
        text: `"המפלגה צריכה הנהגה חדשה כדי לנצח בבחירות. אני מודיע על התמודדות על ראשות המפלגה."`,
        options: [{ id: 'fight', label: 'להתמודד' }, { id: 'deal', label: 'להגיע להסדר (20 הון)' }, { id: 'resign', label: 'לפרוש בכבוד' }],
        defaultOptionId: 'fight', payload: {},
      });
      addNews(s, `${p.name} מודיע על התמודדות על ראשות ${myParty.name}`, 'bad', '⚔️');
    } });
  }
  if (sameParty && p.loyalty < 30 && p.personality.honesty < 0.5) {
    out.push({ weight: 0.8, run: () => {
      me.popularity = clamp(me.popularity - 2);
      s.government.stability = clamp(s.government.stability - (pm ? 2 : 0));
      addNews(s, `הדלפה: "${pick(s, ['בישיבות הסגורות יש ביקורת חריפה על ההנהגה', 'חברי הסיעה חלוקים בנושאים המרכזיים', 'יש מחלוקת פנימית על הרכב הרשימה', 'חלק מהבכירים שוקלים לפרוש', 'המפלגה מתקשה להגיע להחלטות'])}"`, 'bad', '🕳️');
      logEvent(s, '🕳️', `מישהו מהמפלגה מדליף (חשוד: ${p.name})`, 2, 'bad', 'leak');
    } });
  }

  // ---- player is minister/MK: the PM and leader make requests ----
  if (!pm && s.government.pmId === p.id && s.government.coalition.includes(me.partyId)) {
    const myMin = s.government.ministries.find((m) => m.ministerId === me.id);
    const cat = myMin?.categories[0];
    if (cat && deficitPct(s) > 3.2) {
      const amount = round1(s.budget.allocations[cat] * 0.03);
      out.push({ weight: 1.5, run: () => addInbox(s, {
        kind: 'pm_request_cut', title: 'ראש הממשלה מבקש קיצוץ', fromId: p.id, expiresTurn: exp,
        text: `"הגירעון גבוה מהיעד. אני מבקש שהמשרד שלך יקצץ ₪${amount} מיליארד."`,
        options: [{ id: 'accept', label: 'להסכים' }, { id: 'refuse', label: 'לסרב' }], defaultOptionId: 'accept', payload: { category: cat, amount },
      }) });
    }
    out.push({ weight: 0.7, run: () => addInbox(s, {
      kind: 'pm_request_support', title: 'ראש הממשלה מבקש גיבוי', fromId: p.id, expiresTurn: exp,
      text: '"אני מבקש שתעלה הערב לאולפן ותציג את עמדת הממשלה. הגיבוי שלך חשוב לי."',
      options: [{ id: 'comply', label: 'לעלות לאולפן' }, { id: 'refuse', label: 'לסרב בנימוס' }], defaultOptionId: 'refuse', payload: {},
    }) });
  }
  if (!isPartyLeader(s) && isLeader && sameParty) {
    const bill = s.bills.find((b) => b.status === 'active' && b.sponsorId !== me.id);
    if (bill) out.push({ weight: 1, run: () => addInbox(s, {
      kind: 'leader_vote', title: `${p.name} דורש משמעת`, fromId: p.id, expiresTurn: exp,
      text: `"הסיעה החליטה להצביע ${partySupports(s, p.partyId, bill.lawId) ? 'בעד' : 'נגד'} ${bill.title}. אני מצפה למשמעת סיעתית."`,
      options: [{ id: 'comply', label: 'להישמע להנחיה' }, { id: 'rebel', label: 'להצביע לפי המצפון' }], defaultOptionId: 'comply', payload: { billId: bill.id },
    }) });
    if (p.loyalty < 12 && me.power < 40 && (s.flags.failed_primaries ?? -99) > s.turn - 12) {
      out.push({ weight: 3, run: () => { s.flags.expel = 1; } });
    }
  }
  if (!isLeader && !sameParty && pInGov === s.government.coalition.includes(me.partyId) && p.loyalty > 50 && (s.player.role === 'mk' || s.player.role === 'minister')) {
    const lawId = party?.favoriteLaws.find((l) => !s.activeLaws.includes(l) && !s.bills.some((b) => b.lawId === l && b.status === 'active'));
    if (lawId) out.push({ weight: 0.6, run: () => addInbox(s, {
      kind: 'cosponsor', title: `${p.name} מציע שיתוף פעולה`, fromId: p.id, expiresTurn: exp,
      text: `"אני מציע שנגיש יחד את ${LAW_BY_ID[lawId].title}. הצעה משותפת תגדיל את הסיכוי שתעבור."`,
      options: [{ id: 'accept', label: 'לחתום' }, { id: 'refuse', label: 'לוותר' }], defaultOptionId: 'refuse', payload: { lawId },
    }) });
  }
  if (s.player.role === 'candidate' && isLeader && !pInGov && p.partyId !== me.partyId && party.pollShare < 5 && party.seats <= 8) {
    out.push({ weight: 0.8, run: () => addInbox(s, {
      kind: 'merger_offer', title: `${party.name} מציעה ריצה משותפת`, fromId: p.id, expiresTurn: exp,
      text: `"ריצה משותפת תבטיח ששני הקולות לא ילכו לאיבוד מתחת לאחוז החסימה. נבקש מקום 2 ברשימה ותיק בכיר."`,
      options: [{ id: 'accept', label: 'לאחד כוחות' }, { id: 'refuse', label: 'לא תודה' }], defaultOptionId: 'refuse', payload: { partyId: party.id },
    }) });
  }
  return out;
}

function partySupports(s: GameState, partyId: string, lawId: string): boolean {
  const p = s.parties[partyId];
  return p.favoriteLaws.includes(lawId) || s.government.coalition.includes(partyId);
}

/** Rare, motivated AI actions. Probability + cooldown + relevance + global cap. */
export function generateInitiatives(s: GameState): void {
  const d = DIFFICULTIES[s.difficulty];
  const cap = s.difficulty === 'chaos' ? 3 : s.difficulty === 'hard' ? 2 : 1;
  let fired = 0;
  const pols = Object.values(s.politicians).filter((p) => p.active && !p.isPlayer && p.cooldownUntil <= s.turn);
  // deterministic order, randomised start
  const start = Math.floor(rand(s) * Math.max(1, pols.length));
  for (let i = 0; i < pols.length && fired < cap; i++) {
    const p = pols[(start + i) % pols.length];
    const g = grievance(p);
    const prob = 0.035 * d.aiAggression * (0.4 + g * 1.4) ** 2;
    if (!chance(s, prob)) continue;
    const opts = initiativesFor(s, p);
    if (!opts.length) continue;
    const total = opts.reduce((a, o) => a + o.weight, 0);
    let r = rand(s) * total;
    const choice = opts.find((o) => (r -= o.weight) <= 0) ?? opts[0];
    choice.run();
    p.cooldownUntil = s.turn + 4 + Math.floor(rand(s) * 3);
    fired++;
  }
}
