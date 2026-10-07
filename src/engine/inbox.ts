import { LAW_BY_ID } from '../data/laws';
import { rand } from './rng';
import type { ActionResult, BudgetCategory, GameState, InboxItem, Reaction } from '../types/game';
import { clamp, clone } from '../utils';
import { setGameOver, setRole, syncRole } from './career';
import { applyDecision, performAction } from './decisions';
import { addNews, applyEffects, logEvent, remember } from './effects';
import { assignMinister, getMinistry, partyLeavesCoalition } from './government';
import { proposeBill } from './parliament';
import { resolveRotation } from './coalitionDeals';
import { mergeParties } from './relations';

const R = (title: string, status: Reaction['status'], quip?: string, people: Reaction['people'] = []): Reaction => ({ title, status, stats: [], groups: [], people, quip });

/** Resolve a pending decision. Every option changes the state. */
export function resolveInbox(s0: GameState, itemId: string, optionId: string): ActionResult {
  const item0 = s0.inbox.find((i) => i.id === itemId);
  if (!item0) return { state: s0, reaction: null };
  if (item0.kind === 'budget_review' && optionId === 'submit') {
    const s = clone(s0);
    s.inbox = s.inbox.filter((i) => i.id !== itemId);
    return performAction(s, 'submit_budget', {});
  }
  const s = clone(s0);
  const item = s.inbox.find((i) => i.id === itemId)!;
  s.inbox = s.inbox.filter((i) => i.id !== itemId);
  const reaction = handle(s, item, optionId);
  s.career.decisions += 1;
  return { state: s, reaction };
}

function handle(s: GameState, it: InboxItem, opt: string): Reaction | null {
  const from = it.fromId ? s.politicians[it.fromId] : undefined;
  const name = from?.name ?? '';
  const cat = it.payload.category as BudgetCategory | undefined;
  const amount = Number(it.payload.amount ?? 0);
  const me = s.politicians[s.player.politicianId];

  switch (it.kind) {
    case 'minister_budget': {
      if (opt === 'approve' || opt === 'half') {
        const a = opt === 'half' ? amount / 2 : amount;
        applyDecision(s, { budget: { [cat!]: a } });
        remember(s, from!.id, 'favor', 'קיבל תוספת תקציב', opt === 'half' ? 5 : 12);
        s.career.moneyInvested += a;
        return R(`${name} קיבל ₪${a.toFixed(1)}B`, 'approved', undefined, [{ icon: '😊', label: name, text: opt === 'half' ? 'אני מעריך את התוספת, גם אם חלקית.' : 'תודה. התוספת תורגש בשטח.', tone: 'good' }]);
      }
      remember(s, from!.id, 'ignored', 'סירבו לבקשת התקציב', -8);
      return R('הבקשה נדחתה', 'rejected', undefined, [{ icon: '😒', label: name, text: 'אני מאוכזב מההחלטה.', tone: 'bad' }]);
    }
    case 'resign_threat': {
      if (opt === 'give') {
        applyDecision(s, { budget: { [cat!]: amount } });
        remember(s, from!.id, 'favor', 'נכנעו לאיום שלו', 10);
        return R(`${name} נשאר (בינתיים)`, 'approved', 'השר נשאר, אבל שרים אחרים למדו שאיום בהתפטרות משתלם.');
      }
      if (opt === 'fire' || rand(s) < 0.55) {
        const m = s.government.ministries.find((x) => x.ministerId === from!.id);
        if (m) { m.ministerId = s.government.pmId; from!.ministryId = null; }
        remember(s, from!.id, 'fired', opt === 'fire' ? 'פוטר' : 'התפטר בכעס', -25);
        applyEffects(s, { stability: from!.partyId !== s.player.partyId ? -6 : -2 });
        addNews(s, opt === 'fire' ? `${name} פוטר מהממשלה` : `${name} התפטר מהממשלה`, 'bad', '🚪');
        return R(opt === 'fire' ? `${name} פוטר` : `${name} התפטר`, 'info', 'התיק עבר לראש הממשלה עד שימונה מחליף.');
      }
      remember(s, from!.id, 'insult', 'קראו לבלוף שלו', -6);
      return R(`${name} נשאר בתפקיד`, 'approved', 'הוא לא התפטר, אבל היחסים ביניכם נפגעו.');
    }
    case 'ultimatum': {
      const party = s.parties[from!.partyId];
      if (opt === 'accept') {
        if (it.payload.lawId) {
          proposeBill(s, String(it.payload.lawId), s.player.politicianId, true);
          remember(s, from!.id, 'promise', `להעביר את ${LAW_BY_ID[String(it.payload.lawId)].title}`, 0, s.turn + 8, String(it.payload.lawId));
        } else {
          applyDecision(s, { budget: { [cat ?? 'welfare']: amount || 2 } });
        }
        remember(s, from!.id, 'deal', 'נענו לאולטימטום', 10);
        applyEffects(s, { stability: 6 });
        return R(`${party.name} נשארת בקואליציה`, 'approved');
      }
      if (from!.loyalty < 40 || rand(s) < 0.4) {
        partyLeavesCoalition(s, party.id, 'ראש הממשלה זלזל בנו');
        return R(`${party.name} עזבה את הקואליציה!`, 'rejected', 'כדאי לבדוק אם לקואליציה עדיין יש רוב.');
      }
      remember(s, from!.id, 'insult', 'דחו את האולטימטום', -10);
      return R(`${party.name} נשארת בקואליציה, בינתיים`, 'info');
    }
    case 'demand_role': {
      if (opt === 'promise') {
        remember(s, from!.id, 'promise', s.player.role === 'candidate' ? 'מקום ריאלי' : 'משרד בממשלה', 6, s.turn + 6, 'role');
        return R(`הבטחת ל${name}`, 'approved', 'הוא יזכור את ההבטחה, ויצפה שתקיים אותה.');
      }
      remember(s, from!.id, 'ignored', 'סירבו לתת לו תפקיד', -10);
      return R(`${name} מאוכזב`, 'info');
    }
    case 'leadership_challenge': {
      if (opt === 'resign') {
        setGameOver(s, 'resigned', `פרשת מול ${name}`);
        return R('פרשת מההנהגה', 'info');
      }
      if (opt === 'deal') {
        if (s.player.politicalCapital < 20) return R('אין מספיק הון פוליטי לעסקה', 'rejected');
        s.player.politicalCapital -= 20;
        remember(s, from!.id, 'promise', 'משרד בכיר', 15, s.turn + 6, 'role');
        return R(`${name} מקפיא את המרד`, 'approved', 'הבטחת לו משרד בכיר. כדאי לקיים.');
      }
      const party = s.parties[s.player.partyId];
      const members = party.memberIds.map((id) => s.politicians[id]).filter((p) => p && p.active && !p.isPlayer && p.id !== from!.id);
      const avgLoyalty = members.reduce((a, m) => a + m.loyalty, 0) / Math.max(1, members.length);
      const pWin = clamp(0.5 + (me.power + me.popularity * 0.6 + avgLoyalty * 0.4 - (from!.power + from!.popularity * 0.6 + 30)) / 70, 0.1, 0.92);
      if (rand(s) < pWin) {
        from!.power = clamp(from!.power - 15);
        remember(s, from!.id, 'insult', 'הפסיד בפריימריז', -10);
        me.power = clamp(me.power + 6);
        addNews(s, `${me.name} ניצח בפריימריז מול ${name}`, 'good', '👑');
        s.career.memorable.push(`הדף תיגר של ${name}`);
        return R('ניצחת בפריימריז', 'approved', `הסיכוי היה ${Math.round(pWin * 100)}%`);
      }
      party.leaderId = from!.id;
      if (s.government.pmId === me.id) setGameOver(s, 'ousted', `הודחת בפריימריז על ידי ${name}`);
      else { syncRole(s); setGameOver(s, 'ousted', `${name} הדיח אותך מראשות המפלגה`); }
      return R('הפסדת בפריימריז', 'rejected');
    }
    case 'pm_request_cut': {
      if (opt === 'accept') {
        applyDecision(s, { budget: { [cat!]: -amount } });
        remember(s, from!.id, 'support', 'הסכים לקיצוץ', 10);
        return R(`קיצצת ₪${amount.toFixed(1)}B במשרד`, 'approved', 'ראש הממשלה מרוצה. העובדים במשרד מודאגים.');
      }
      remember(s, from!.id, 'insult', 'סירב לקצץ', -10);
      return R('סירבת לקצץ', 'info', 'היחסים עם ראש הממשלה נפגעו.');
    }
    case 'pm_request_support': {
      if (opt === 'comply') {
        remember(s, from!.id, 'support', 'הגן על הממשלה באולפן', 9);
        applyEffects(s, { playerPopularity: s.government.approval > 45 ? 2 : -2, playerReputation: -1 });
        return R('הגנת על הממשלה באולפן', 'approved', s.government.approval > 45 ? 'הראיון עבר היטב.' : 'שאלות קשות על מצב הממשלה הקשו עליך.');
      }
      remember(s, from!.id, 'ignored', 'התחמק מהאולפן', -5);
      return R('התחמקת', 'info');
    }
    case 'leader_vote': {
      const bill = s.bills.find((b) => b.id === it.payload.billId);
      if (opt === 'comply') {
        remember(s, from!.id, 'support', 'הצביע לפי הקו', 6);
        return R('הצבעת לפי הקו', 'approved');
      }
      if (bill) bill.push -= 5;
      remember(s, from!.id, 'betrayal', 'מרד בהצבעה', -12);
      applyEffects(s, { playerPopularity: 3, playerReputation: 2 });
      return R('הצבעת נגד הקו', 'info', 'התקשורת מציגה אותך כעצמאי; המנהיג לא מרוצה.');
    }
    case 'cosponsor': {
      if (opt === 'accept') {
        const bill = proposeBill(s, String(it.payload.lawId), s.player.politicianId, false);
        if (bill) bill.push += 15;
        remember(s, from!.id, 'favor', 'חתם איתו על חוק', 8);
        return R('חתמת על הצעת חוק משותפת', 'approved');
      }
      return R('ויתרת', 'info');
    }
    case 'promotion_offer': {
      if (opt === 'accept') {
        const m = getMinistry(s, String(it.payload.ministryId));
        if (!m || !s.government.coalition.includes(me.partyId)) return R('ההצעה כבר לא רלוונטית', 'info');
        const prev = m.ministerId && m.ministerId !== s.government.pmId ? s.politicians[m.ministerId] : null;
        if (prev) remember(s, prev.id, 'fired', 'הוחלף בך', -15);
        assignMinister(s, m.id, me.id);
        setRole(s, 'minister', `מונה ל${m.name}`);
        addNews(s, `${me.name} מונה ל${m.name}`, 'good', '🎉');
        return R(`מונית ל${m.name}`, 'approved', 'עכשיו יש לך משרד, תקציב ואחריות.');
      }
      if (from) remember(s, from.id, 'insult', 'סירב לתפקיד', -4);
      return R('סירבת להצעה', 'info');
    }
    case 'merger_offer': {
      if (opt === 'accept') {
        const other = s.parties[String(it.payload.partyId)];
        mergeParties(s, other.id);
        return R(`איחוד עם ${other.name}`, 'approved', 'יו״ר המפלגה המצטרפת יקבל את המקום השני ברשימה.');
      }
      return R('דחית את האיחוד', 'info');
    }
    case 'commitment_reminder':
      return R('התזכורת נרשמה', 'info', 'את כל ההתחייבויות והמועדים אפשר לראות במסך הממשלה.');
    case 'rotation_due': {
      const text = resolveRotation(s, String(it.payload.commitmentId), opt === 'honor');
      syncRole(s);
      return R(opt === 'honor' ? 'הרוטציה בוצעה' : 'סירבת לרוטציה', opt === 'honor' ? 'approved' : 'rejected', text);
    }
    case 'coalition_invite': {
      const party = s.parties[me.partyId];
      if (opt === 'refuse') {
        partyLeavesCoalition(s, party.id, 'החלטנו לא להצטרף לממשלה');
        return R(`${party.name} נשארת באופוזיציה`, 'info');
      }
      if (opt === 'demand') {
        const target = ['finance', 'defense', 'foreign'].map((id) => getMinistry(s, id)).find((m) => m && m.ministerId !== s.government.pmId);
        if (target && rand(s) < 0.45) {
          const prev = target.ministerId ? s.politicians[target.ministerId] : null;
          if (prev) { prev.ministryId = null; remember(s, prev.id, 'fired', 'התיק עבר לשותפה', -10); }
          assignMinister(s, target.id, me.id);
          setRole(s, 'minister', `מונה ל${target.name}`);
          return R(`קיבלת את ${target.name}`, 'approved', 'ראש הממשלה המיועד נענה לדרישה.');
        }
        if (rand(s) < 0.5) {
          partyLeavesCoalition(s, party.id, 'הדרישות לא התקבלו');
          return R('המשא ומתן נכשל', 'rejected', 'הממשלה הוקמה בלעדיכם.');
        }
        return R('הדרישה נדחתה, אבל נשארתם בקואליציה', 'info');
      }
      return R(`${party.name} מצטרפת לממשלה`, 'approved');
    }
    case 'budget_review':
      return R('התקציב מחכה לך במסך התקציב', 'info', 'התקציב צריך לעבור עד המועד הקבוע בחוק.');
  }
  return null;
}

/** Expired inbox items resolve with their default option. */
export function expireInbox(s: GameState): void {
  for (const it of [...s.inbox]) {
    if (it.expiresTurn <= s.turn) {
      s.inbox = s.inbox.filter((x) => x !== it);
      if (it.kind === 'budget_review') continue;
      handle(s, it, it.defaultOptionId);
      logEvent(s, '⏰', `לא הגבת: "${it.title}" — הוחלט כברירת מחדל`, 1, 'neutral', 'inbox');
    }
  }
}
