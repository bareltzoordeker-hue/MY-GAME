// Interface strings in Hebrew, English and Arabic. Hebrew is the source; missing keys fall back to it.
const he = {
  // navigation
  'nav.dashboard': 'לוח בקרה', 'nav.ministry': 'המשרד שלי', 'nav.state': 'מצב המדינה', 'nav.economy': 'כלכלה', 'nav.budget': 'תקציב',
  'nav.population': 'אוכלוסייה', 'nav.map': 'מפה', 'nav.security': 'ביטחון ומדיניות', 'nav.government': 'ממשלה', 'nav.parliament': 'כנסטון',
  'nav.laws': 'חוקים', 'nav.relations': 'מפת יחסים', 'nav.chat': 'שיחות', 'nav.party': 'מפלגה ובריתות', 'nav.projects': 'פרויקטים', 'nav.crises': 'משברים',
  'nav.polls': 'סקרים', 'nav.news': 'חדשות', 'nav.advisor': 'היועץ', 'nav.career': 'קריירה', 'nav.save': 'שמירה והגדרות',
  // header
  'hdr.date': 'תאריך', 'hdr.coalition': 'קואליציה', 'hdr.approval': 'שביעות רצון', 'hdr.deficit': 'גירעון', 'hdr.capital': 'הון פוליטי',
  'hdr.elections': 'בחירות', 'hdr.saved': 'נשמר', 'hdr.next': 'התור הבא: {span}', 'hdr.speech': 'נאום', 'hdr.menu': 'תפריט', 'hdr.seats': 'מנדטים',
  // main menu
  'menu.kicker': 'סימולציית ניהול פוליטי', 'menu.title': 'ממשלת ישמעאל',
  'menu.lead': 'ספטמבר 2026. הכנסטון התפזר, הרשימות הוגשו, והבחירות ב-27 באוקטובר. בחרו פוליטיקאי אמיתי או צרו דמות משלכם, נהלו קמפיין, הרכיבו קואליציה והובילו את המדינה.',
  'menu.new': 'משחק חדש', 'menu.continue': 'המשך משחק', 'menu.howto': 'איך משחקים?', 'menu.site': 'לאתר המשחק', 'menu.last': 'שמירה אחרונה: {name} · {party} · תור {turn}',
  'menu.contentNote': '',
  // wizard
  'wiz.back': '→ חזרה', 'wiz.path': 'מסלול', 'wiz.list': 'רשימה', 'wiz.politician': 'פוליטיקאי', 'wiz.replace': 'את מי מחליפים', 'wiz.settings': 'הגדרות',
  'wiz.howEnter': 'איך נכנסים לפוליטיקה?', 'wiz.howEnterSub': 'כל המפלגות, הרשימות והאנשים לפי המצב בספטמבר 2026.',
  'wiz.real': 'פוליטיקאי אמיתי', 'wiz.realDesc': 'משחקים בתור אחד מחברי הכנסטון והמועמדים. התפקיד ההתחלתי לפי התפקיד האמיתי: ראש ממשלה, שר, יו״ר מפלגה או חבר כנסטון.',
  'wiz.custom': 'דמות משלך', 'wiz.customDesc': 'יוצרים פוליטיקאי חדש שתופס את המקום של אחד המועמדים ברשימה – כולל המקום ברשימה והתפקיד שלו.',
  'wiz.whichList': 'באיזו רשימה?', 'wiz.whichListSub': 'ממוצע הסקרים האחרונים לפני הבחירות, ומספר המושבים בכנסטון היוצא.',
  'wiz.continue': 'המשך', 'wiz.difficulty': 'רמת קושי', 'wiz.start': 'התחלת המשחק', 'wiz.withTutorial': 'לשחק עם מדריך',
  // disclaimer
  'disc.title': 'לפני שמתחילים',
  'disc.p1': 'ממשלת ישמעאל הוא משחק סימולציה וסאטירה פוליטית. המשחק משתמש בשמות של מפלגות ואנשי ציבור אמיתיים ובאירועים מהמציאות, אבל ההחלטות, הציטוטים, התגובות והתוצאות במשחק הם סימולציה בלבד. הם אינם מייצגים את עמדותיהם, מעשיהם או כוונותיהם של האנשים והמפלגות.',
  'disc.p2': 'הקריקטורות והאפשרויות במשחק הן חלק מהמשחק ואינן מרמזות דבר על אף אדם. השמות "ישמעאל" ו"כנסטון" הם שמות בדיוניים.',
  'disc.p3': 'המשחק לא נועד לפגוע באף אדם, ציבור או מגזר, ואינו מביע עמדה פוליטית או ממליץ להצביע לאף מפלגה.',
  'disc.terms': 'המשך המשחק מהווה הסכמה לתנאי השימוש.', 'disc.dontShow': 'אל תציג שוב', 'disc.ok': 'הבנתי, אפשר להתחיל',
  // settings
  'set.language': 'שפת הממשק', 'set.languageNote': 'תוכן המשחק (פעולות, אירועים וחדשות) כתוב כרגע בעברית, והתרגום שלו בהמשך.',
};
export type Key = keyof typeof he;

const en: Partial<Record<Key, string>> = {
  'nav.dashboard': 'Dashboard', 'nav.ministry': 'My ministry', 'nav.state': 'State of the country', 'nav.economy': 'Economy', 'nav.budget': 'Budget',
  'nav.population': 'Population', 'nav.map': 'Map', 'nav.security': 'Security & diplomacy', 'nav.government': 'Government', 'nav.parliament': 'Knesseton',
  'nav.laws': 'Laws', 'nav.relations': 'Relations map', 'nav.chat': 'Chats', 'nav.party': 'Party & alliances', 'nav.projects': 'Projects', 'nav.crises': 'Crises',
  'nav.polls': 'Polls', 'nav.news': 'News', 'nav.advisor': 'Advisor', 'nav.career': 'Career', 'nav.save': 'Save & settings',
  'hdr.date': 'Date', 'hdr.coalition': 'Coalition', 'hdr.approval': 'Approval', 'hdr.deficit': 'Deficit', 'hdr.capital': 'Political capital',
  'hdr.elections': 'Elections', 'hdr.saved': 'Saved', 'hdr.next': 'Next turn: {span}', 'hdr.speech': 'Speech', 'hdr.menu': 'Menu', 'hdr.seats': 'seats',
  'menu.kicker': 'A political management simulation', 'menu.title': 'Memshelet Ismael',
  'menu.lead': 'September 2026. The Knesseton has dissolved, the lists are in, and the election is on October 27. Play a real politician or create your own, run a campaign, build a coalition and lead the country.',
  'menu.new': 'New game', 'menu.continue': 'Continue', 'menu.howto': 'How to play', 'menu.site': 'Back to the website', 'menu.last': 'Last save: {name} · {party} · turn {turn}',
  'menu.contentNote': 'The interface is in English; game content is still in Hebrew while the translation is completed.',
  'wiz.back': '← Back', 'wiz.path': 'Path', 'wiz.list': 'List', 'wiz.politician': 'Politician', 'wiz.replace': 'Whom you replace', 'wiz.settings': 'Settings',
  'wiz.howEnter': 'How do you enter politics?', 'wiz.howEnterSub': 'All parties, lists and people as of September 2026.',
  'wiz.real': 'A real politician', 'wiz.realDesc': 'Play as one of the Knesseton members and candidates. You start in their real position: prime minister, minister, party leader or member.',
  'wiz.custom': 'Your own character', 'wiz.customDesc': 'Create a new politician who takes the place of one of the candidates on a list – including the slot and the position.',
  'wiz.whichList': 'Which list?', 'wiz.whichListSub': 'Latest poll average before the election, and seats in the outgoing Knesseton.',
  'wiz.continue': 'Continue', 'wiz.difficulty': 'Difficulty', 'wiz.start': 'Start the game', 'wiz.withTutorial': 'Play with the guided tutorial',
  'disc.title': 'Before you start',
  'disc.p1': 'Memshelet Ismael is a political simulation and satire. It uses the names of real parties and public figures and real-world events, but the decisions, quotes, reactions and outcomes in the game are a simulation only. They do not represent the positions, actions or intentions of those people and parties.',
  'disc.p2': 'The caricatures and options are part of the game and imply nothing about anyone. "Ismael" and "Knesseton" are fictional names.',
  'disc.p3': 'The game is not meant to offend any person, community or sector, takes no political position and does not recommend voting for any party.',
  'disc.terms': 'By continuing you agree to the terms of use.', 'disc.dontShow': "Don't show again", 'disc.ok': 'I understand, start',
  'set.language': 'Interface language', 'set.languageNote': 'Game content (actions, events and news) is currently in Hebrew; its translation will follow.',
};

const ar: Partial<Record<Key, string>> = {
  'nav.dashboard': 'لوحة القيادة', 'nav.ministry': 'وزارتي', 'nav.state': 'وضع الدولة', 'nav.economy': 'الاقتصاد', 'nav.budget': 'الميزانية',
  'nav.population': 'السكان', 'nav.map': 'الخريطة', 'nav.security': 'الأمن والسياسة', 'nav.government': 'الحكومة', 'nav.parliament': 'الكنيستون',
  'nav.laws': 'القوانين', 'nav.relations': 'خريطة العلاقات', 'nav.chat': 'المحادثات', 'nav.party': 'الحزب والتحالفات', 'nav.projects': 'المشاريع', 'nav.crises': 'الأزمات',
  'nav.polls': 'الاستطلاعات', 'nav.news': 'الأخبار', 'nav.advisor': 'المستشار', 'nav.career': 'المسيرة', 'nav.save': 'الحفظ والإعدادات',
  'hdr.date': 'التاريخ', 'hdr.coalition': 'الائتلاف', 'hdr.approval': 'الرضا', 'hdr.deficit': 'العجز', 'hdr.capital': 'الرصيد السياسي',
  'hdr.elections': 'الانتخابات', 'hdr.saved': 'محفوظ', 'hdr.next': 'الدور التالي: {span}', 'hdr.speech': 'خطاب', 'hdr.menu': 'القائمة', 'hdr.seats': 'مقاعد',
  'menu.kicker': 'محاكاة إدارة سياسية', 'menu.title': 'حكومة إسماعيل',
  'menu.lead': 'أيلول 2026. حُلّ الكنيستون، وقُدّمت القوائم، والانتخابات في 27 تشرين الأول. اختر سياسيًا حقيقيًا أو أنشئ شخصية خاصة بك، أدر حملة انتخابية، شكّل ائتلافًا وقُد الدولة.',
  'menu.new': 'لعبة جديدة', 'menu.continue': 'متابعة اللعب', 'menu.howto': 'كيف نلعب؟', 'menu.site': 'إلى موقع اللعبة', 'menu.last': 'آخر حفظ: {name} · {party} · الدور {turn}',
  'menu.contentNote': 'الواجهة باللغة العربية؛ محتوى اللعبة لا يزال بالعبرية إلى حين استكمال الترجمة.',
  'wiz.back': '→ رجوع', 'wiz.path': 'المسار', 'wiz.list': 'القائمة', 'wiz.politician': 'السياسي', 'wiz.replace': 'من تستبدل', 'wiz.settings': 'الإعدادات',
  'wiz.howEnter': 'كيف تدخل إلى السياسة؟', 'wiz.howEnterSub': 'جميع الأحزاب والقوائم والأشخاص كما في أيلول 2026.',
  'wiz.real': 'سياسي حقيقي', 'wiz.realDesc': 'العب بدور أحد أعضاء الكنيستون أو المرشحين. تبدأ بمنصبه الحقيقي: رئيس حكومة، وزير، رئيس حزب أو عضو.',
  'wiz.custom': 'شخصية خاصة بك', 'wiz.customDesc': 'أنشئ سياسيًا جديدًا يحلّ محل أحد المرشحين في قائمة – بما في ذلك موقعه في القائمة ومنصبه.',
  'wiz.whichList': 'أي قائمة؟', 'wiz.whichListSub': 'متوسط الاستطلاعات الأخيرة قبل الانتخابات، وعدد المقاعد في الكنيستون المنتهية ولايته.',
  'wiz.continue': 'متابعة', 'wiz.difficulty': 'مستوى الصعوبة', 'wiz.start': 'ابدأ اللعبة', 'wiz.withTutorial': 'اللعب مع دليل إرشادي',
  'disc.title': 'قبل أن نبدأ',
  'disc.p1': 'حكومة إسماعيل هي لعبة محاكاة وسخرية سياسية. تستخدم اللعبة أسماء أحزاب وشخصيات عامة حقيقية وأحداثًا من الواقع، لكن القرارات والاقتباسات وردود الفعل والنتائج في اللعبة هي محاكاة فقط، ولا تمثّل مواقف هؤلاء الأشخاص والأحزاب أو أفعالهم أو نواياهم.',
  'disc.p2': 'الرسوم الكاريكاتورية والخيارات جزء من اللعبة ولا تلمّح إلى أي شيء بشأن أي شخص. الاسمان "إسماعيل" و"الكنيستون" اسمان خياليان.',
  'disc.p3': 'لا تهدف اللعبة إلى الإساءة لأي شخص أو جمهور أو فئة، ولا تعبّر عن موقف سياسي ولا توصي بالتصويت لأي حزب.',
  'disc.terms': 'متابعة اللعب تعني الموافقة على شروط الاستخدام.', 'disc.dontShow': 'لا تعرض مرة أخرى', 'disc.ok': 'فهمت، لنبدأ',
  'set.language': 'لغة الواجهة', 'set.languageNote': 'محتوى اللعبة (الأفعال والأحداث والأخبار) حاليًا بالعبرية، وترجمته لاحقًا.',
};

export const DICT: Record<'he' | 'en' | 'ar', Partial<Record<Key, string>>> = { he, en, ar };
