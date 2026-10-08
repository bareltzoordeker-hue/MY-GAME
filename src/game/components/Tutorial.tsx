import { useEffect, useRef, useState } from 'react';
import { useGame, type ScreenId } from '../store/gameStore';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';
import { getLang, type Lang } from '../../shared/i18n';
import { useLang } from '../useLang';
import type { GameState } from '../../types/game';

// ============================================================
// Interactive first-turn tutorial. It dims everything except the one element
// the player has to press, waits until the press has really done something
// (a screen opened, a number explained, an action performed), and only then moves on.
// The first turn is given extra political capital so every step can be done.
// ============================================================

const KEY = 'hakise.tutorial.done';
const isDone = () => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } };
const markDone = () => { try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };
const RESET_EVENT = 'hakise:tutorial-reset';
/** Turn the guided tutorial on (fresh) or off for the next game. */
export const setTutorialEnabled = (on: boolean) => { if (on) resetTutorial(); else markDone(); };
export const resetTutorial = () => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } window.dispatchEvent(new Event(RESET_EVENT)); };

type T = Record<Lang, string>;
interface Ctx {
  screen: ScreenId; game: GameState; explainKey: string | null; reactions: number; chatWith: string | null;
  base: { turn: number; msgs: number };
}
interface Step {
  id: string;
  title: T;
  text: T;
  /** the element to press; none = a reading step with a "continue" button */
  target?: () => Element | null;
  /** the step is finished when this becomes true (after the press) */
  until?: (c: Ctx) => boolean;
  /** make sure the player has this much political capital before the step */
  capital?: number;
  /** the screen the target lives on (the tutorial opens it if the player is elsewhere) */
  screen?: ScreenId;
  /** shown instead when the target is hidden (e.g. the side menu on a phone) */
  fallback?: () => Element | null;
  /** skipped automatically when the target is not on screen (e.g. header numbers on a phone) */
  optional?: boolean;
  /** skipped on a replay in the middle of a game */
  firstTurnOnly?: boolean;
}

// the same control can exist twice (desktop sidebar and phone drawer): point at the one that is on screen
const q = (sel: string) => () => [...document.querySelectorAll(sel)].find((e) => visible(e)) ?? document.querySelector(sel);
const nav = (id: string) => q(`[data-tut="nav-${id}"]`);
const menuButton = q('.menu-btn');
const visible = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
const msgCount = (g: GameState, id: string | null) => (id ? (g.chats?.[id]?.filter((m) => m.from === 'me').length ?? 0) : 0);

export const STEPS: Step[] = [
  {
    id: 'welcome',
    title: { he: 'ברוכים הבאים', en: 'Welcome', ar: 'مرحبًا بك' },
    text: {
      he: 'זה מדריך אינטראקטיבי לתור הראשון. לא רק נסביר: תלחץ בעצמך על מה שיסומן, ותראה מה כל דבר עושה ומה ההשפעה שלו. כדי שתוכל לנסות הכול, הוספנו לך הון פוליטי לתור הזה.',
      en: 'This is an interactive guide for the first turn. We will not just explain: you press what is highlighted and see what each thing does and what effect it has. So that you can try everything, you were given extra political capital for this turn.',
      ar: 'هذا دليل تفاعلي للدور الأول. لن نكتفي بالشرح: ستضغط بنفسك على ما يتم تمييزه وسترى ماذا يفعل كل شيء وما تأثيره. لكي تجرّب كل شيء، حصلت على رصيد سياسي إضافي لهذا الدور.',
    },
  },
  {
    id: 'capital-open',
    target: q('[data-tut="explain-capital"]'),
    optional: true,
    until: (c) => c.explainKey === 'capital',
    title: { he: 'הון פוליטי', en: 'Political capital', ar: 'الرصيد السياسي' },
    text: {
      he: 'בפס העליון מופיעים המספרים החשובים. ליד כל אחד יש סימן שאלה שמסביר אותו. לחץ על סימן השאלה שליד "הון פוליטי".',
      en: 'The top bar shows the key numbers. Next to each one there is a question mark that explains it. Press the question mark next to "Political capital".',
      ar: 'يعرض الشريط العلوي الأرقام المهمة. بجانب كل رقم علامة استفهام تشرحه. اضغط على علامة الاستفهام بجانب "الرصيد السياسي".',
    },
  },
  {
    id: 'capital-close',
    target: q('[data-tut="modal-ok"]'),
    until: (c) => c.explainKey === null,
    title: { he: 'המטבע של הפוליטיקה', en: 'The currency of politics', ar: 'عملة السياسة' },
    text: {
      he: 'הון פוליטי הוא מה שמשלמים בו על כמעט כל פעולה. הוא מתחדש בכל תור לפי התפקיד והפופולריות שלך. לחץ "הבנתי".',
      en: 'Political capital is what you pay with for almost every action. It renews every turn according to your role and popularity. Press "Got it".',
      ar: 'الرصيد السياسي هو ما تدفعه مقابل كل إجراء تقريبًا. يتجدد في كل دور بحسب دورك وشعبيتك. اضغط "فهمت".',
    },
  },
  {
    id: 'nav-career',
    target: nav('career'), fallback: menuButton,
    until: (c) => c.screen === 'career',
    title: { he: 'התפריט', en: 'The menu', ar: 'القائمة' },
    text: {
      he: 'כל המסכים נמצאים בתפריט. נתחיל במסך הקריירה, שם מבצעים פעולות אישיות. לחץ על "קריירה".',
      en: 'All the screens are in the menu. We start with the career screen, where you take personal actions. Press "Career".',
      ar: 'جميع الشاشات في القائمة. نبدأ بشاشة المسيرة المهنية حيث تنفّذ إجراءات شخصية. اضغط على "المسيرة المهنية".',
    },
  },
  {
    id: 'interview',
    screen: 'career',
    capital: 12,
    target: q('[data-tip-action*="\\"id\\":\\"tv_interview\\""]'),
    until: (c) => c.reactions > 0,
    title: { he: 'פעולה ראשונה: ראיון', en: 'First action: an interview', ar: 'أول إجراء: مقابلة' },
    text: {
      he: 'בכל כפתור פעולה אפשר לעצור עם העכבר (בנייד: ללחוץ לחיצה ארוכה) ולראות מה הוא עושה, כמה הוא עולה ומה ההשפעה המשוערת. עכשיו תבצע אותו: לחץ על "ראיון".',
      en: 'On any action button you can hover (on a phone: long-press) to see what it does, what it costs and its estimated effect. Now do it: press "Interview".',
      ar: 'على أي زر إجراء يمكنك تمرير المؤشر (في الهاتف: ضغطة مطوّلة) لترى ماذا يفعل وكم يكلّف وما تأثيره المقدّر. الآن نفّذه: اضغط على "مقابلة".',
    },
  },
  {
    id: 'reaction',
    target: q('[data-tut="modal-ok"]'),
    until: (c) => c.reactions === 0,
    title: { he: 'ההשפעה', en: 'The effect', ar: 'التأثير' },
    text: {
      he: 'זה סיכום מה שקרה: איך השתנו הפופולריות והמוניטין שלך ומי הגיב. שים לב שההון הפוליטי למעלה ירד. לחץ "הבנתי".',
      en: 'This summarizes what happened: how your popularity and reputation changed and who reacted. Notice that the political capital at the top went down. Press "Got it".',
      ar: 'هذا ملخص ما حدث: كيف تغيّرت شعبيتك وسمعتك ومن ردّ. لاحظ أن الرصيد السياسي في الأعلى انخفض. اضغط "فهمت".',
    },
  },
  {
    id: 'nav-economy',
    target: nav('economy'), fallback: menuButton,
    until: (c) => c.screen === 'economy',
    title: { he: 'כלכלה', en: 'Economy', ar: 'الاقتصاد' },
    text: {
      he: 'לכל החלטה יש מחיר כלכלי. נבדוק מה מניע את המספרים. לחץ על "כלכלה".',
      en: 'Every decision has an economic price. Let us see what drives the numbers. Press "Economy".',
      ar: 'لكل قرار ثمن اقتصادي. لنرَ ما الذي يحرّك الأرقام. اضغط على "الاقتصاد".',
    },
  },
  {
    id: 'explain-number',
    screen: 'economy',
    target: () => [...document.querySelectorAll('[data-tut^="explain-"]')].find((e) => !e.closest('header')) ?? null,
    until: (c) => c.explainKey !== null,
    title: { he: 'מה מניע מספר?', en: 'What drives a number?', ar: 'ما الذي يحرّك الرقم؟' },
    text: {
      he: 'ליד כל מספר חשוב יש סימן שאלה שמסביר מאיפה הוא בא ומה משפיע עליו. לחץ על סימן השאלה המסומן.',
      en: 'Next to every important number there is a question mark that explains where it comes from and what affects it. Press the highlighted question mark.',
      ar: 'بجانب كل رقم مهم علامة استفهام تشرح من أين يأتي وما الذي يؤثر عليه. اضغط على علامة الاستفهام المميّزة.',
    },
  },
  {
    id: 'explain-close',
    target: q('[data-tut="modal-ok"]'),
    until: (c) => c.explainKey === null,
    title: { he: 'כך קוראים את המשחק', en: 'This is how you read the game', ar: 'هكذا تقرأ اللعبة' },
    text: {
      he: 'כל מספר במשחק נובע ממשהו: תקציב, החלטות, משברים או מצב הציבור. זה המפתח להבין מה לעשות. לחץ "הבנתי".',
      en: 'Every number in the game comes from something: the budget, decisions, crises or the public mood. That is the key to knowing what to do. Press "Got it".',
      ar: 'كل رقم في اللعبة ينبع من شيء ما: الميزانية أو القرارات أو الأزمات أو مزاج الجمهور. هذا مفتاح معرفة ما يجب فعله. اضغط "فهمت".',
    },
  },
  {
    id: 'nav-parliament',
    target: nav('parliament'), fallback: menuButton,
    until: (c) => c.screen === 'parliament',
    title: { he: 'הכנסטון', en: 'The Knesseton', ar: 'الكنيستون' },
    text: {
      he: 'חוקים עוברים בהצבעות, וצריך 61 מתוך 120. לחץ על "כנסטון".',
      en: 'Laws pass by votes, and you need 61 out of 120. Press "Knesseton".',
      ar: 'تمرّ القوانين بالتصويت، ويلزم 61 من أصل 120. اضغط على "الكنيستون".',
    },
  },
  {
    id: 'parliament-read',
    title: { he: 'מי תומך ומי מתנגד', en: 'Who supports and who opposes', ar: 'من يؤيد ومن يعارض' },
    text: {
      he: 'כאן רואים את 120 המושבים, הצעות חוק שבדיון וצפי הצבעה לכל מפלגה. כל מפלגה מצביעה לפי הערכים שלה, ולחלקן יש קווים אדומים. אפשר לגייס תמיכה או לרכך הצעה כדי להשיג רוב.',
      en: 'Here you see the 120 seats, the bills under debate and the vote forecast for each party. Each party votes according to its values, and some have red lines. You can rally support or soften a bill to reach a majority.',
      ar: 'هنا ترى المقاعد الـ120 واقتراحات القوانين قيد النقاش وتوقع التصويت لكل حزب. كل حزب يصوّت بحسب قيمه، ولبعضها خطوط حمراء. يمكن حشد الدعم أو تليين اقتراح لتحقيق أغلبية.',
    },
  },
  {
    id: 'nav-chat',
    target: nav('chat'), fallback: menuButton,
    until: (c) => c.screen === 'chat',
    title: { he: 'שיחות', en: 'Chats', ar: 'المحادثات' },
    text: {
      he: 'פוליטיקה נעשית גם בשיחות: איומים, הבטחות, בקשות ומילה טובה. לחץ על "שיחות".',
      en: 'Politics is also done in conversations: threats, promises, requests and a kind word. Press "Chats".',
      ar: 'السياسة تُمارس أيضًا في المحادثات: تهديدات ووعود وطلبات وكلمة طيبة. اضغط على "المحادثات".',
    },
  },
  {
    id: 'chat-contact',
    screen: 'chat',
    target: q('[data-tut="chat-contact"]'),
    until: (c) => c.chatWith !== null,
    title: { he: 'בחר פוליטיקאי', en: 'Pick a politician', ar: 'اختر سياسيًا' },
    text: {
      he: 'אפשר לכתוב לכל שר ויו״ר מפלגה, ולחפש כל פוליטיקאי לפי שם. לחץ על האיש המסומן.',
      en: 'You can write to any minister and party leader, and search for any politician by name. Press the highlighted person.',
      ar: 'يمكنك الكتابة إلى أي وزير ورئيس حزب، والبحث عن أي سياسي بالاسم. اضغط على الشخص المميّز.',
    },
  },
  {
    id: 'chat-chip',
    target: q('[data-tut="chat-input"]'),
    until: () => ((document.querySelector('[data-tut="chat-input"]') as HTMLInputElement | null)?.value.length ?? 0) > 0,
    title: { he: 'כתוב הודעה', en: 'Write a message', ar: 'اكتب رسالة' },
    text: {
      he: 'כתוב חופשי מה שרוצים, כמו בשיחה רגילה: בקשה, הבטחה, שאלה או איום.',
      en: 'Write anything you like, as in a normal conversation: a request, a promise, a question or a threat.',
      ar: 'اكتب ما تشاء كما في محادثة عادية: طلب أو وعد أو سؤال أو تهديد.',
    },
  },
  {
    id: 'chat-send',
    target: q('[data-tut="chat-send"]'),
    until: (c) => msgCount(c.game, c.chatWith) > c.base.msgs,
    title: { he: 'שלח', en: 'Send', ar: 'أرسل' },
    text: {
      he: 'עכשיו שלח את ההודעה.',
      en: 'Now send the message.',
      ar: 'الآن أرسل الرسالة.',
    },
  },
  {
    id: 'chat-read',
    title: { he: 'התשובה והזיכרון', en: 'The answer and the memory', ar: 'الرد والذاكرة' },
    text: {
      he: 'הפוליטיקאי ענה לפי היחסים שלכם, האופי שלו והערכים של המפלגה. השורה הסגולה מתחת להודעה אומרת מה השתנה. הוא גם זוכר: הבטחה נרשמת עם מועד, ואיום עלול לחזור אליך.',
      en: 'The politician answered according to your relationship, their character and their party\'s values. The purple line under the message says what changed. They also remember: a promise is recorded with a deadline, and a threat may come back at you.',
      ar: 'ردّ السياسي بحسب علاقتكما وطبعه وقيم حزبه. السطر البنفسجي تحت الرسالة يوضح ما تغيّر. وهو يتذكر أيضًا: الوعد يُسجَّل بموعد، والتهديد قد يرتد عليك.',
    },
  },
  {
    id: 'speech-open',
    target: q('[data-tut="speech"]'),
    until: () => !!document.querySelector('[data-tut="speech-write"]'),
    title: { he: 'נאום', en: 'A speech', ar: 'خطاب' },
    text: {
      he: 'בכל רגע אפשר לשאת נאום: בטלוויזיה, במליאה, בכנס או ברשתות. הנאום משפיע על הפופולריות ועל תגובות המפלגות. לחץ על "נאום" בפס העליון.',
      en: 'At any moment you can give a speech: on television, in the plenum, at a rally or on social media. It affects popularity and the parties\' reactions. Press "Speech" in the top bar.',
      ar: 'في أي لحظة يمكنك إلقاء خطاب: في التلفزيون أو في الهيئة العامة أو في مؤتمر أو في الشبكات الاجتماعية. يؤثر على الشعبية وعلى ردود فعل الأحزاب. اضغط على "خطاب" في الشريط العلوي.',
    },
  },
  {
    id: 'speech-write',
    target: q('[data-tut="speech-write"]'),
    until: () => ((document.querySelector('[data-tut="speech-text"]') as HTMLTextAreaElement | null)?.value.length ?? 0) > 0,
    title: { he: 'כתוב לי', en: 'Write it for me', ar: 'اكتب لي' },
    text: {
      he: 'בוחרים במה, נושא, עמדה וטון. אפשר לכתוב לבד, או לבקש טיוטה אוטומטית. לחץ על "כתוב לי".',
      en: 'You choose the stage, subject, position and tone. You can write it yourself, or ask for an automatic draft. Press "Write for me".',
      ar: 'تختار المنصة والموضوع والموقف والنبرة. يمكنك الكتابة بنفسك أو طلب مسودة تلقائية. اضغط على "اكتب لي".',
    },
  },
  {
    id: 'speech-close',
    target: q('[data-tut="speech-cancel"]'),
    until: () => !document.querySelector('[data-tut="speech-write"]'),
    title: { he: 'נאום אמיתי עולה הון', en: 'A real speech costs capital', ar: 'الخطاب الفعلي يكلّف رصيدًا' },
    text: {
      he: 'כדי לשאת את הנאום באמת, לוחצים "לשאת את הנאום" וזה עולה הון פוליטי. כרגע רק התרגלנו: לחץ "ביטול" כדי לסגור.',
      en: 'To really give the speech you press "Give the speech", which costs political capital. For now we only practiced: press "Cancel" to close.',
      ar: 'لإلقاء الخطاب فعليًا تضغط "إلقاء الخطاب" وهذا يكلّف رصيدًا سياسيًا. الآن تدرّبنا فقط: اضغط "إلغاء" للإغلاق.',
    },
  },
  {
    id: 'next-turn',
    firstTurnOnly: true,
    target: q('[data-tut="next-turn"]'),
    until: (c) => c.game.turn > c.base.turn,
    title: { he: 'סוף התור', en: 'End of the turn', ar: 'نهاية الدور' },
    text: {
      he: 'כשסיימת להחליט, מקדמים את הזמן. הכלכלה זזה, הסקרים מתעדכנים והפוליטיקאים מגיבים למה שעשית. לחץ על כפתור התור הבא וקרא את הסיכום.',
      en: 'When you have decided, you move time forward. The economy moves, the polls update and the politicians react to what you did. Press the next-turn button and read the summary.',
      ar: 'عندما تنتهي من القرارات، تُقدِّم الوقت. يتحرك الاقتصاد وتتحدث الاستطلاعات ويتفاعل السياسيون مع ما فعلته. اضغط على زر الدور التالي واقرأ الملخص.',
    },
  },
  {
    id: 'done',
    title: { he: 'מוכן', en: 'Ready', ar: 'جاهز' },
    text: {
      he: 'זהו. עכשיו אתה יודע להפעיל את המשחק: לבדוק מספרים, לבצע פעולות, לדבר עם פוליטיקאים ולקדם את הזמן. המטרה: להישאר בפוליטיקה ולהשפיע. המשחק נשמר אוטומטית בסוף כל תור. בהצלחה!',
      en: 'That is it. You now know how to run the game: check numbers, take actions, talk to politicians and move time forward. The goal: to stay in politics and have influence. The game saves automatically at the end of each turn. Good luck!',
      ar: 'هذا كل شيء. صرت تعرف كيف تشغّل اللعبة: تفحص الأرقام وتنفّذ الإجراءات وتتحدث مع السياسيين وتقدّم الوقت. الهدف: البقاء في السياسة والتأثير. تُحفظ اللعبة تلقائيًا في نهاية كل دور. بالتوفيق!',
    },
  },
];

export const UI: Record<string, T> = {
  skip: { he: 'דלג על המדריך', en: 'Skip the tutorial', ar: 'تخطَّ الدليل' },
  next: { he: 'המשך', en: 'Continue', ar: 'متابعة' },
  start: { he: 'בוא נתחיל', en: 'Let us start', ar: 'لنبدأ' },
  finish: { he: 'סיום', en: 'Finish', ar: 'إنهاء' },
  task: { he: 'לחץ על האלמנט המסומן כדי להמשיך.', en: 'Press the highlighted element to continue.', ar: 'اضغط على العنصر المميّز للمتابعة.' },
  stuck: { he: 'לא מצליח? דלג על השלב', en: 'Stuck? Skip this step', ar: 'لا تنجح؟ تخطَّ هذه الخطوة' },
  label: { he: 'מדריך המשחק', en: 'Game tutorial', ar: 'دليل اللعبة' },
  step: { he: 'שלב', en: 'Step', ar: 'الخطوة' },
};

interface Rect { x: number; y: number; w: number; h: number }
const PAD = 6;

/** Four dark panels around the target: clicks on them are swallowed, the hole lets the player press the target. */
function Blocker({ rect }: { rect: Rect | null }) {
  const common = { position: 'fixed' as const, background: 'rgba(12,16,34,.62)', zIndex: 9990 };
  if (!rect) return <div style={{ ...common, inset: 0 }} aria-hidden />;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const x = Math.max(0, rect.x - PAD);
  const y = Math.max(0, rect.y - PAD);
  const r = Math.min(vw, rect.x + rect.w + PAD);
  const b = Math.min(vh, rect.y + rect.h + PAD);
  return (
    <>
      <div style={{ ...common, left: 0, top: 0, width: vw, height: y }} aria-hidden />
      <div style={{ ...common, left: 0, top: b, width: vw, height: Math.max(0, vh - b) }} aria-hidden />
      <div style={{ ...common, left: 0, top: y, width: x, height: b - y }} aria-hidden />
      <div style={{ ...common, left: r, top: y, width: Math.max(0, vw - r), height: b - y }} aria-hidden />
      <div style={{ position: 'fixed', left: x, top: y, width: r - x, height: b - y, border: '3px solid var(--gold, #f0b429)', borderRadius: 10, boxShadow: '0 0 0 4px rgba(240,180,41,.35)', pointerEvents: 'none', zIndex: 9991 }} aria-hidden />
    </>
  );
}

export function Tutorial() {
  const lang = useLang();
  const hasGame = useGame((s) => !!s.game);
  const gameOver = useGame((s) => !!s.game?.gameOver);
  const drama = useGame((s) => !!s.game?.drama);
  const briefing = useGame((s) => s.briefingOpen);
  const meeting = useGame((s) => !!s.meeting);
  const [step, setStep] = useState(0);
  const [, force] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [stuck, setStuck] = useState(false);
  const base = useRef({ turn: 0, msgs: 0 });
  const started = useRef(false);
  const missSince = useRef<number | null>(null);

  // a game that is already past its first turn only gets the tutorial when the player asks for it again
  const manual = useRef(false);
  const session = useRef(false); // true once the tutorial has started, so it survives the turn it ends with
  useEffect(() => {
    const onReset = () => { manual.current = true; started.current = false; setStep(0); force((n) => n + 1); };
    window.addEventListener(RESET_EVENT, onReset);
    return () => window.removeEventListener(RESET_EVENT, onReset);
  }, []);

  const firstTurn = useGame.getState().game?.turn === 0;
  const active = hasGame && !isDone() && (firstTurn || manual.current || session.current) && !gameOver && !drama && !briefing && !meeting;
  const steps = STEPS.filter((x) => !x.firstTurnOnly || firstTurn);
  const st = steps[Math.min(step, steps.length - 1)];

  // extra capital for the first turn, so every action in the tutorial can be done
  const ensureCapital = (n: number) => {
    const g = useGame.getState().game;
    if (g && g.player.politicalCapital < n) useGame.setState({ game: { ...g, player: { ...g.player, politicalCapital: n } } });
  };

  useEffect(() => {
    if (!active) return;
    if (!started.current) {
      started.current = true;
      session.current = true;
      const g = useGame.getState().game!;
      base.current = { turn: g.turn, msgs: 0 };
      if (g.turn === 0) ensureCapital(30);
    }
  }, [active]);

  // when a step begins: open its screen, top up capital, remember starting numbers
  useEffect(() => {
    if (!active) return;
    const g = useGame.getState().game!;
    base.current = { turn: g.turn, msgs: msgCount(g, useGame.getState().chatWith) };
    setStuck(false);
    if (st.capital && g.turn === 0) ensureCapital(st.capital);
    if (st.screen && useGame.getState().screen !== st.screen) useGame.getState().setScreen(st.screen);
    const t = window.setTimeout(() => setStuck(true), 12000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, st.id]);

  // follow the target, and move on when the step's condition holds
  useEffect(() => {
    if (!active) return;
    const tick = () => {
      const s = useGame.getState();
      if (!s.game) return;
      const ctx: Ctx = { screen: s.screen, game: s.game, explainKey: s.explainKey, reactions: s.reactions.length, chatWith: s.chatWith, base: base.current };
      if (st.until && st.until(ctx)) {
        if (step < steps.length - 1) setStep(step + 1); else { markDone(); force((n) => n + 1); }
        return;
      }
      let el = st.target?.() ?? null;
      if (el && !visible(el)) el = null;
      if (!el && st.fallback) { const fb = st.fallback(); if (fb && visible(fb)) el = fb; }
      if (!el && st.optional && st.target) {
        missSince.current ??= Date.now();
        if (Date.now() - missSince.current > 700) { missSince.current = null; if (step < steps.length - 1) setStep(step + 1); return; }
      } else missSince.current = null;
      if (import.meta.env.DEV) (window as unknown as { __tut?: unknown }).__tut = { id: st.id, step, el: !!el, node: el };
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.top < 70 || r.bottom > window.innerHeight - 10) el.scrollIntoView({ block: 'center' });
        setRect((old) => (old && Math.abs(old.x - r.left) < 1 && Math.abs(old.y - r.top) < 1 && Math.abs(old.w - r.width) < 1 && Math.abs(old.h - r.height) < 1 ? old : { x: r.left, y: r.top, w: r.width, h: r.height }));
      } else setRect(null);
    };
    tick();
    // react to anything that can change the answer: store updates, DOM changes, typing, clicking, scrolling
    const unsub = useGame.subscribe(tick);
    const mo = new MutationObserver(tick);
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
    const evs: [EventTarget, string][] = [[window, 'resize'], [window, 'scroll'], [document, 'input'], [document, 'click']];
    evs.forEach(([t, e]) => t.addEventListener(e, tick, true));
    const id = window.setInterval(tick, 400);
    // modals animate open, so keep following the target on every frame
    let raf = 0;
    const loop = () => { tick(); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); window.clearInterval(id); unsub(); mo.disconnect(); evs.forEach(([t, e]) => t.removeEventListener(e, tick, true)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, step, st.id]);

  if (!active) return null;
  const L = (m: T) => m[lang] ?? m.he;
  const reading = !st.until;
  const last = step >= steps.length - 1;
  const close = () => { markDone(); setRect(null); force((n) => n + 1); };
  const advance = () => { if (last) close(); else setStep(step + 1); };
  // the card goes to the other half of the screen so it never covers the target
  const cardOnTop = !!rect && rect.y > window.innerHeight * 0.5;
  const isRtl = getLang() !== 'en';

  return (
    <>
      <Blocker rect={reading ? null : rect} />
      <div role="dialog" aria-label={L(UI.label)} dir={isRtl ? 'rtl' : 'ltr'} className="card rise"
        style={{ position: 'fixed', zIndex: 9999, left: 12, right: 12, margin: '0 auto', maxWidth: 440, [cardOnTop ? 'top' : 'bottom']: 12, borderColor: 'var(--gold)', boxShadow: '0 24px 50px -16px rgba(0,0,0,.55)' }}>
        <div className="flex gap-3 items-start">
          <Caricature spec={ADVISOR_SPEC} size={52} />
          <div className="flex-1">
            <div className="text-[11px] muted">{L(UI.step)} {Math.min(step + 1, steps.length)}/{steps.length}</div>
            <div className="font-black">{L(st.title)}</div>
            <p className="text-sm mt-1 leading-relaxed">{L(st.text)}</p>
            {!reading && <p className="text-xs mt-2" style={{ color: 'var(--violet-d, #5b4bdb)' }}>👆 {L(UI.task)}</p>}
          </div>
        </div>
        <div className="flex justify-between items-center mt-3 gap-2 flex-wrap">
          <button className="btn btn-sm btn-ghost" onClick={close}>{L(UI.skip)}</button>
          <div className="flex gap-2">
            {!reading && stuck && <button className="btn btn-sm" onClick={advance}>{L(UI.stuck)}</button>}
            {reading && <button className="btn btn-sm btn-primary" onClick={advance}>{last ? L(UI.finish) : step === 0 ? L(UI.start) : L(UI.next)}</button>}
          </div>
        </div>
      </div>
    </>
  );
}
