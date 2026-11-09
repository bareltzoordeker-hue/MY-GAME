// The original articles of the site (for readers who do not play). One entry per article; each language is written by hand.
// scripts/articles.mjs turns them into pages/articles/**, pages/en/articles/** and pages/ar/articles/**.
// A section is [heading, paragraph, paragraph, ...].
export const ARTICLES = [
  {
    slug: 'coalition',
    he: {
      title: 'איך מרכיבים קואליציה', desc: 'למה אף מפלגה לא מנצחת לבד, איך הנשיא בוחר מי ירכיב ממשלה, ומה קורה במשא ומתן על התיקים.',
      sections: [
        ['למה צריך קואליציה', 'בכנסת 120 חברים, וממשלה צריכה את תמיכתם של 61 לפחות כדי להתקיים. מפלגה אחת כמעט אף פעם לא מגיעה לשם לבד, ולכן מפלגות מתאחדות לקואליציה: הסכם שבו כל מפלגה מקבלת משהו תמורת התמיכה שלה בממשלה.'],
        ['מי מרכיב את הממשלה', 'אחרי הבחירות הנשיא מתייעץ עם נציגי המפלגות ונותן את המנדט להרכבת הממשלה לחבר הכנסת שיש לו את הסיכוי הגבוה ביותר להצליח, לא בהכרח לראש המפלגה הגדולה. למרכיב הממשלה יש 28 ימים, ואפשר להאריך ב-14 ימים. אם הוא נכשל, המנדט עובר לאחר, ובמקרה קיצוני הולכים לבחירות חוזרות.'],
        ['על מה מתמקחים', 'כל מפלגה דורשת תיקי שרים, סגני שרים, יו״ר ועדות, תקציבים למטרות שחשובות לבוחריה, וחוקים מסוימים. לפעמים יש גם רוטציה (שני אנשים מתחלפים בתפקיד) או זכות וטו על נושא רגיש. ההסכם כתוב, ומי שמפר אותו מסתכן בפירוק הממשלה.'],
        ['איך זה במשחק', 'ב״ממשלת ישמעאל״ אתם עוברים את כל השלבים: אפשר לוותר על דרישות, להציע תמריצים, לבחור מי מהמפלגה מקבל כל תיק, וכל התחייבות מקבלת מועד ותזכורת. הפרה עלולה להפיל את הקואליציה.'],
      ],
    },
    en: {
      title: 'How a coalition is built', desc: 'Why no party wins alone, how the president picks who forms a government, and what happens in the haggling over portfolios.',
      sections: [
        ['Why a coalition is needed', 'The Knesset has 120 members, and a government needs the support of at least 61 to survive. A single party almost never gets there alone, so parties join a coalition: an agreement in which each party gets something in return for its support of the government.'],
        ['Who forms the government', 'After the elections the president consults the parties and gives the mandate to form a government to the member of parliament with the best chance of succeeding, not necessarily the head of the largest party. The one forming the government has 28 days, which can be extended by 14. If they fail, the mandate passes to someone else, and in the extreme case there is a new election.'],
        ['What is negotiated', 'Each party demands ministerial portfolios, deputy ministers, committee chairs, budgets for causes that matter to its voters, and certain laws. Sometimes there is also a rotation (two people swap a position) or a veto right on a sensitive issue. The agreement is written down, and whoever breaks it risks bringing the government down.'],
        ['How it works in the game', 'In "Government of Ishmael" you go through every stage: you can drop demands, offer incentives, choose who from the party gets each portfolio, and every commitment gets a due date and a reminder. A breach can bring the coalition down.'],
      ],
    },
    ar: {
      title: 'كيف يُبنى الائتلاف', desc: 'لماذا لا يفوز حزب واحد بمفرده، وكيف يختار الرئيس من يشكّل الحكومة، وما الذي يجري في المساومة على الحقائب.',
      sections: [
        ['لماذا نحتاج إلى ائتلاف', 'يضم الكنيست 120 عضوًا، وتحتاج الحكومة إلى دعم 61 على الأقل لتبقى. نادرًا ما يصل حزب واحد إلى ذلك بمفرده، لذلك تتحد الأحزاب في ائتلاف: اتفاق يحصل فيه كل حزب على شيء مقابل دعمه للحكومة.'],
        ['من يشكّل الحكومة', 'بعد الانتخابات يتشاور الرئيس مع الأحزاب ويمنح تفويض تشكيل الحكومة لعضو الكنيست الأكثر حظًا في النجاح، وليس بالضرورة رئيس أكبر حزب. أمام المكلَّف 28 يومًا يمكن تمديدها 14 يومًا. وإذا فشل ينتقل التفويض إلى غيره، وفي الحالة القصوى تُجرى انتخابات جديدة.'],
        ['على ماذا تجري المساومة', 'يطلب كل حزب حقائب وزارية ونوابًا للوزراء ورئاسة لجان وميزانيات لقضايا تهم ناخبيه وقوانين معينة. وأحيانًا يكون هناك تناوب (شخصان يتبادلان المنصب) أو حق نقض في قضية حساسة. الاتفاق مكتوب، ومن ينقضه يخاطر بإسقاط الحكومة.'],
        ['كيف تعمل في اللعبة', 'في "حكومة إسماعيل" تمر بكل المراحل: يمكنك التنازل عن مطالب وتقديم حوافز واختيار من في الحزب يحصل على كل حقيبة، ولكل التزام موعد وتذكير. وقد يؤدي النقض إلى سقوط الائتلاف.'],
      ],
    },
  },
  {
    slug: 'legislation',
    he: {
      title: 'איך חוק נולד', desc: 'מהצעה פרטית ועד קריאה שלישית: השלבים שכל חוק עובר בכנסת, ולמה רוב החוקים לא מגיעים לסוף.',
      sections: [
        ['הצעה וקריאה טרומית', 'חבר כנסת יכול להגיש הצעת חוק פרטית. כדי שתתקדם היא צריכה לעבור קריאה טרומית במליאה. הצעה של הממשלה מגיעה ישר לוועדה, ולכן קל יותר לקדם אותה.'],
        ['ועדה וקריאה ראשונה', 'הוועדה היא החדר שבו נוצר החוק בפועל: דנים בסעיפים, שומעים מומחים ומתקנים. אחר כך ההצעה חוזרת למליאה לקריאה ראשונה, ושוב לוועדה לניסוח סופי.'],
        ['קריאה שנייה ושלישית', 'בקריאות האחרונות מצביעים על כל סעיף ועל החוק כולו. חוק רגיל עובר ברוב של המצביעים. תיקון של חוק יסוד דורש בדרך כלל רוב של 61 חברי כנסת, ולפעמים יותר.'],
        ['איך זה במשחק', 'בממשלת ישמעאל חוקים אמיתיים עוברים את אותם שלבים לאורך כמה תורות. כל מפלגה מצביעה לפי הערכים שלה, ולחלק מהמפלגות יש קווים אדומים שלא ייחצו גם מתוך הקואליציה. אפשר לדחוף הצעה, לרכך אותה או לוותר עליה.'],
      ],
    },
    en: {
      title: 'How a law is born', desc: 'From a private bill to the third reading: the stages every law goes through in the Knesset, and why most laws never reach the end.',
      sections: [
        ['A proposal and the preliminary reading', 'A member of parliament can submit a private bill. To advance, it has to pass a preliminary reading in the plenum. A government bill goes straight to a committee, which is why it is easier to advance.'],
        ['Committee and the first reading', 'The committee is the room where the law is actually shaped: the clauses are discussed, experts are heard and changes are made. Then the bill returns to the plenum for a first reading, and again to committee for its final wording.'],
        ['The second and third readings', 'In the last readings each clause and the law as a whole are put to a vote. An ordinary law passes with a majority of those voting. Amending a Basic Law usually requires a majority of 61 members, and sometimes more.'],
        ['How it works in the game', 'In Government of Ishmael real laws go through the same stages over several turns. Each party votes according to its values, and some parties have red lines they will not cross even from inside the coalition. You can push a bill, soften it or give it up.'],
      ],
    },
    ar: {
      title: 'كيف يولد القانون', desc: 'من مشروع قانون خاص إلى القراءة الثالثة: المراحل التي يمر بها كل قانون في الكنيست، ولماذا لا تصل معظم القوانين إلى النهاية.',
      sections: [
        ['اقتراح وقراءة تمهيدية', 'يمكن لعضو كنيست تقديم مشروع قانون خاص. ولكي يتقدم عليه أن يجتاز قراءة تمهيدية في الهيئة العامة. أما مشروع الحكومة فيذهب مباشرة إلى اللجنة، ولهذا يسهل تقدمه.'],
        ['اللجنة والقراءة الأولى', 'اللجنة هي الغرفة التي يتشكل فيها القانون فعليًا: تُناقش البنود ويُستمع إلى الخبراء وتُجرى التعديلات. ثم يعود المشروع إلى الهيئة العامة للقراءة الأولى ومرة أخرى إلى اللجنة للصياغة النهائية.'],
        ['القراءتان الثانية والثالثة', 'في القراءات الأخيرة يُصوَّت على كل بند وعلى القانون كله. يُقرّ القانون العادي بأغلبية المصوتين. وتعديل قانون أساس يتطلب عادة أغلبية 61 عضوًا وأحيانًا أكثر.'],
        ['كيف تعمل في اللعبة', 'في حكومة إسماعيل تمر القوانين الحقيقية بالمراحل نفسها على مدى عدة أدوار. يصوّت كل حزب وفق قيمه، ولبعض الأحزاب خطوط حمراء لن تتجاوزها حتى من داخل الائتلاف. يمكنك دفع مشروع أو تخفيفه أو التخلي عنه.'],
      ],
    },
  },
  {
    slug: 'security-cabinet',
    he: {
      title: 'הקבינט הביטחוני ומי מחליט על מבצע', desc: 'איך מתקבלת החלטה על מבצע צבאי: ראש הממשלה, שר הביטחון והקבינט, ומה שוקלים לפני שיוצאים לדרך.',
      sections: [
        ['מי יושב בחדר', 'הקבינט המדיני-ביטחוני הוא ועדה של שרים בראשות ראש הממשלה. בו יושבים בין השאר שר הביטחון, שר החוץ ושר האוצר. הם שומעים את ראש המטה הכללי ואת ראשי גופי המודיעין, ומחליטים על צעדים ביטחוניים משמעותיים.'],
        ['מה שוקלים', 'כל מבצע הוא איזון בין כמה דברים: הסיכוי להצלחה, הפגיעה הצפויה באויב, הסיכון ללוחמים, הפגיעה באזרחים בצד השני, התגובה של האויב והמחיר הבינלאומי. מודיעין מעודכן, מלאי תחמושת וכשירות היחידות משפיעים על כל אחד מהם.'],
        ['שעה ובחירת כוחות', 'תקיפה בלילה מפתיעה יותר ופוגעת בפחות אזרחים, אבל מסוכנת יותר ללוחמים. יחידה אחת מובילה והאחרות מחפות. כוח חי״ר לא יוביל תקיפה אווירית, ומבצע קרקעי רחב צריך הנדסה קרבית.'],
        ['איך זה במשחק', 'בחמ״ל התכנון של המשחק בוחרים מטרה, כוחות, שעה וכללי פתיחה באש, רואים סיכוי ומחיר, מנסים לשכנע שרים בקבינט, ומקבלים אחרי המבצע דוח מפורט עם הצלחות, נפגעים והשלכות ארוכות טווח.'],
      ],
    },
    en: {
      title: 'The security cabinet and who decides on an operation', desc: 'How a decision on a military operation is made: the prime minister, the defense minister and the cabinet, and what is weighed before going ahead.',
      sections: [
        ['Who sits in the room', 'The political-security cabinet is a committee of ministers chaired by the prime minister. It includes, among others, the defense, foreign and finance ministers. They hear the chief of staff and the heads of the intelligence services, and decide on significant security steps.'],
        ['What is weighed', 'Every operation balances several things: the chance of success, the expected damage to the enemy, the risk to the fighters, the harm to civilians on the other side, the enemy response and the international price. Up-to-date intelligence, the stock of munitions and the readiness of the units affect each of them.'],
        ['The hour and the choice of forces', 'A strike at night is more of a surprise and harms fewer civilians, but is more dangerous to the fighters. One unit leads and the others cover. An infantry force will not lead an air strike, and a wide ground operation needs combat engineering.'],
        ['How it works in the game', 'In the game\'s planning room you choose a target, forces, an hour and rules of engagement, see the odds and the price, try to persuade ministers in the cabinet, and after the operation get a detailed report with successes, casualties and long-term consequences.'],
      ],
    },
    ar: {
      title: 'المجلس الوزاري الأمني ومن يقرر العملية', desc: 'كيف يُتخذ قرار عملية عسكرية: رئيس الحكومة ووزير الأمن والمجلس الوزاري، وما الذي يُوزن قبل البدء.',
      sections: [
        ['من يجلس في الغرفة', 'المجلس الوزاري السياسي الأمني هو لجنة من الوزراء يرأسها رئيس الحكومة. يضم بين آخرين وزراء الأمن والخارجية والمالية. يستمعون إلى رئيس الأركان ورؤساء الأجهزة الاستخباراتية ويقررون الخطوات الأمنية المهمة.'],
        ['ما الذي يُوزن', 'كل عملية توازن بين عدة أمور: احتمال النجاح والضرر المتوقع بالعدو والخطر على المقاتلين والمساس بالمدنيين في الطرف الآخر ورد فعل العدو والثمن الدولي. وتؤثر الاستخبارات المحدثة ومخزون الذخيرة وجاهزية الوحدات في كل منها.'],
        ['الساعة واختيار القوات', 'الضربة ليلًا أكثر مفاجأة وتصيب مدنيين أقل لكنها أخطر على المقاتلين. وحدة واحدة تقود والأخرى تغطي. قوة مشاة لن تقود ضربة جوية، والعملية البرية الواسعة تحتاج إلى هندسة قتالية.'],
        ['كيف تعمل في اللعبة', 'في غرفة التخطيط في اللعبة تختار هدفًا وقوات وساعة وقواعد اشتباك، وترى الاحتمال والثمن، وتحاول إقناع الوزراء في المجلس، وبعد العملية تحصل على تقرير مفصل بالنجاحات والخسائر والعواقب طويلة الأمد.'],
      ],
    },
  },
  {
    slug: 'threshold',
    he: {
      title: 'אחוז החסימה ולמה כל קול חשוב', desc: 'איך מתורגמים קולות למנדטים, מה זה אחוז החסימה ולמה מפלגות קטנות נלחמות עליו.',
      sections: [
        ['מקולות למנדטים', 'בבחירות ארציות מצביעים לרשימה של מפלגה ולא לאדם. 120 המנדטים מתחלקים לפי אחוז הקולות שכל רשימה קיבלה. מי שקיבלה כרבע מהקולות הכשרים מקבלת כרבע מהמושבים, פחות או יותר.'],
        ['אחוז החסימה', 'רשימה שלא עוברת אחוז מסוים מהקולות הכשרים אינה נכנסת לכנסת בכלל, והקולות שלה נעלמים. אחוז החסימה בישראל הוא 3.25%, כלומר כארבעה מנדטים. מטרתו למנוע ריבוי מפלגות זעירות ולהקל על יציבות.'],
        ['מה זה עושה למפלגות', 'מפלגות שנמצאות סביב הסף מתאחדות, נאבקות על קולות של בוחרים שמתלבטים ולפעמים מנסות למשוך בוחרים של שותפות. הצבעה למפלגה שלא תעבור נחשבת קול מבוזבז, ולכן סקרים שמראים אותה קרובה לסף משנים את ההתנהגות של הבוחרים.'],
        ['איך זה במשחק', 'בממשלת ישמעאל אם המפלגה שלכם לא עוברת את אחוז החסימה המשחק נגמר. לכן בקמפיין תצטרכו לבחור קהלי יעד, תקציב וסיסמה, ולעקוב אחרי הסקרים עד ליל הבחירות.'],
      ],
    },
    en: {
      title: 'The electoral threshold and why every vote counts', desc: 'How votes become seats, what the electoral threshold is and why small parties fight over it.',
      sections: [
        ['From votes to seats', 'In national elections you vote for a party list and not for a person. The 120 seats are divided according to the percentage of the votes each list received. A list that gets about a quarter of the valid votes gets about a quarter of the seats.'],
        ['The electoral threshold', 'A list that does not pass a certain percentage of the valid votes does not enter the Knesset at all, and its votes disappear. The threshold in Israel is 3.25%, about four seats. Its purpose is to prevent a multitude of tiny parties and to support stability.'],
        ['What it does to parties', 'Parties around the line merge, fight for the votes of undecided voters and sometimes try to draw voters away from partners. A vote for a party that will not pass counts as a wasted vote, so polls that show it close to the line change how voters behave.'],
        ['How it works in the game', 'In Government of Ishmael, if your party does not pass the threshold the game is over. That is why in the campaign you will have to choose target audiences, a budget and a slogan, and follow the polls until election night.'],
      ],
    },
    ar: {
      title: 'نسبة الحسم ولماذا كل صوت مهم', desc: 'كيف تتحول الأصوات إلى مقاعد، وما هي نسبة الحسم ولماذا تتنافس عليها الأحزاب الصغيرة.',
      sections: [
        ['من الأصوات إلى المقاعد', 'في الانتخابات القطرية يُصوَّت لقائمة حزب وليس لشخص. وتُوزَّع المقاعد الـ120 حسب نسبة الأصوات التي حصلت عليها كل قائمة. القائمة التي تنال نحو ربع الأصوات الصحيحة تنال نحو ربع المقاعد.'],
        ['نسبة الحسم', 'القائمة التي لا تتجاوز نسبة معينة من الأصوات الصحيحة لا تدخل الكنيست إطلاقًا وتضيع أصواتها. نسبة الحسم في إسرائيل 3.25%، أي نحو أربعة مقاعد. هدفها منع كثرة الأحزاب الصغيرة جدًا ودعم الاستقرار.'],
        ['ماذا تفعل بالأحزاب', 'الأحزاب القريبة من الحد تندمج وتتنافس على أصوات المترددين وأحيانًا تحاول سحب ناخبين من الشركاء. التصويت لحزب لن يتجاوز الحد يُعدّ صوتًا ضائعًا، ولذلك تغيّر الاستطلاعات التي تُظهره قريبًا من الحد سلوك الناخبين.'],
        ['كيف تعمل في اللعبة', 'في حكومة إسماعيل إذا لم يتجاوز حزبك نسبة الحسم تنتهي اللعبة. لذلك عليك في الحملة اختيار فئات مستهدفة وميزانية وشعار، ومتابعة الاستطلاعات حتى ليلة الانتخابات.'],
      ],
    },
  },
  {
    slug: 'political-capital',
    he: {
      title: 'הון פוליטי: המטבע שאי אפשר לקנות', desc: 'מה זה הון פוליטי, איך צוברים אותו, ולמה הוא נגמר ברגע הכי פחות נוח.',
      sections: [
        ['מה זה הון פוליטי', 'הון פוליטי הוא היכולת של מנהיג לבקש טובות, לגייס תמיכה ולהעביר החלטות קשות. הוא לא נמדד בכסף. הוא נוצר מאמון, מהצלחות ומיחסים טובים עם אנשים שחשובים.'],
        ['איך צוברים ואיך מבזבזים', 'ניצחון בבחירות, חוק שעבר, הבטחה שקוימה ויחסים טובים עם שותפים מגדילים את ההון. החלטות חריפות, הפרת הבטחות ופיטורי שרים שוחקים אותו. מי שמבזבז את כל ההון על החלטה אחת, יגלה שאין לו מה להציע בפעם הבאה.'],
        ['הכלל החשוב', 'הון פוליטי צריך להישמר לרגע שבו הוא באמת נחוץ: משבר, הצבעה שנויה במחלוקת או מבצע גדול. מנהיג שמחלק אותו בכל הזדמנות מגלה שאין לו כוח כשצריך.'],
        ['איך זה במשחק', 'במשחק כל פעולה עולה הון פוליטי, שמתחדש בכל תור. שכנוע שרים לפני החלטה גדולה עולה הון אבל מגדיל את הסיכוי. כדאי לבדוק מה הפעולה עולה לפני שלוחצים, בעזרת הסבר היועץ.'],
      ],
    },
    en: {
      title: 'Political capital: the currency you cannot buy', desc: 'What political capital is, how it is gathered, and why it runs out at the least convenient moment.',
      sections: [
        ['What political capital is', 'Political capital is a leader\'s ability to ask for favors, gather support and pass hard decisions. It is not measured in money. It comes from trust, from successes and from good relations with people who matter.'],
        ['How it is gathered and spent', 'Winning an election, a law that passed, a promise that was kept and good relations with partners grow it. Sharp decisions, broken promises and firing ministers wear it down. Someone who spends all of it on one decision will find they have nothing to offer next time.'],
        ['The important rule', 'Political capital should be saved for the moment it is truly needed: a crisis, a disputed vote or a big operation. A leader who hands it out at every opportunity discovers they have no strength when it counts.'],
        ['How it works in the game', 'In the game every action costs political capital, which renews each turn. Persuading ministers before a big decision costs capital but raises the chance. It is worth checking what an action costs before clicking, with the advisor\'s explanation.'],
      ],
    },
    ar: {
      title: 'الرصيد السياسي: العملة التي لا تُشترى', desc: 'ما هو الرصيد السياسي وكيف يُجمع ولماذا ينفد في أقل اللحظات ملاءمة.',
      sections: [
        ['ما هو الرصيد السياسي', 'الرصيد السياسي هو قدرة القائد على طلب خدمات وحشد الدعم وتمرير قرارات صعبة. لا يُقاس بالمال، بل ينشأ من الثقة ومن النجاحات ومن العلاقات الجيدة مع أشخاص مهمين.'],
        ['كيف يُجمع وكيف يُنفق', 'الفوز في الانتخابات وقانون أُقرّ ووعد نُفّذ وعلاقات جيدة مع الشركاء تزيده. والقرارات الحادة ونقض الوعود وإقالة الوزراء تستنزفه. ومن ينفق كل رصيده على قرار واحد سيجد أنه لا يملك ما يقدمه في المرة القادمة.'],
        ['القاعدة المهمة', 'ينبغي ادخار الرصيد السياسي للحظة التي يكون فيها ضروريًا حقًا: أزمة أو تصويت مثير للخلاف أو عملية كبيرة. القائد الذي يوزعه عند كل فرصة يكتشف أنه لا يملك قوة عندما تلزمه.'],
        ['كيف تعمل في اللعبة', 'في اللعبة يكلف كل إجراء رصيدًا سياسيًا يتجدد في كل دور. إقناع الوزراء قبل قرار كبير يكلف رصيدًا لكنه يزيد الاحتمال. من المفيد معرفة كلفة الإجراء قبل الضغط بمساعدة شرح المستشار.'],
      ],
    },
  },
  {
    slug: 'survival-guide',
    he: {
      title: 'שבעה טיפים לשרוד כראש ממשלה', desc: 'מדריך אסטרטגיה לשחקנים חדשים: איך שומרים על קואליציה יציבה, תקציב מאוזן וציבור שלא יוצא לרחוב.',
      sections: [
        ['קואליציה לפני הכול', 'שמרו על קשר עם כל מפלגות הקואליציה, וקיימו הבטחות במועד. הפרת הסכם קואליציוני היא הדרך המהירה ביותר לאבד את הממשלה.'],
        ['תקציב ומסים', 'גירעון גבוה מגדיל את הריבית והחוב. אל תקצצו בכל המשרדים בבת אחת: שירות שמתדרדר הופך למשבר. עדיף שינוי הדרגתי בכמה תחומים.'],
        ['הקשיבו לציבור', 'מעקב אחרי קבוצות האוכלוסייה מראה מי מרוצה ומי כועס. הפגנות מתחילות בקבוצה שהזנחתם זמן רב.'],
        ['שימו לב לביטחון', 'חזיתות שנראות שקטות עלולות להתלקח. תחזקו יחידות, עדכנו מודיעין ושמרו מלאי. מבצע בלי הכנה עולה בנפגעים ובתדמית.'],
        ['שימו לב למנגנון', 'שרים חזקים רוצים השפעה, ושרים מתוסכלים מאיימים לפרוש. הקשיבו לבקשות שלהם, ואשרו מה שהגיוני.'],
        ['קראו את היועץ', 'היועץ מריץ סימולציה לפני שהוא ממליץ ומסביר מה כל פעולה תעשה. ההחלטה נשארת שלכם, אבל כדאי לדעת מה צפוי.'],
        ['לשחק לאורך זמן', 'בחירות מגיעות כל כמה שנים. החלטות שנראות טובות בחודש הבא עלולות לעלות בבחירות הבאות. תחשבו על הסקר, לא רק על התור.'],
      ],
    },
    en: {
      title: 'Seven tips to survive as prime minister', desc: 'A strategy guide for new players: how to keep a stable coalition, a balanced budget and a public that stays off the streets.',
      sections: [
        ['Coalition above all', 'Stay in touch with every party in the coalition, and keep promises on time. Breaking a coalition agreement is the fastest way to lose the government.'],
        ['Budget and taxes', 'A high deficit raises interest and debt. Do not cut every ministry at once: a service that deteriorates turns into a crisis. A gradual change in a few areas is better.'],
        ['Listen to the public', 'Following the population groups shows who is satisfied and who is angry. Protests begin with a group you neglected for a long time.'],
        ['Mind security', 'Fronts that look quiet can flare up. Maintain units, update intelligence and keep stocks. An operation without preparation costs in casualties and in image.'],
        ['Mind the machinery', 'Strong ministers want influence, and frustrated ministers threaten to quit. Listen to their requests, and approve what makes sense.'],
        ['Read the advisor', 'The advisor runs a simulation before recommending and explains what each action will do. The decision remains yours, but it is worth knowing what to expect.'],
        ['Play for the long run', 'Elections come every few years. Decisions that look good next month may cost in the next election. Think about the polls, not just the turn.'],
      ],
    },
    ar: {
      title: 'سبع نصائح للبقاء كرئيس للحكومة', desc: 'دليل استراتيجي للاعبين الجدد: كيف تحافظ على ائتلاف مستقر وميزانية متوازنة وجمهور لا ينزل إلى الشوارع.',
      sections: [
        ['الائتلاف قبل كل شيء', 'حافظ على التواصل مع كل أحزاب الائتلاف ونفّذ الوعود في موعدها. نقض اتفاق ائتلافي هو أسرع طريق لخسارة الحكومة.'],
        ['الميزانية والضرائب', 'العجز المرتفع يرفع الفائدة والدين. لا تقلص كل الوزارات دفعة واحدة: فخدمة تتدهور تتحول إلى أزمة. الأفضل تغيير تدريجي في عدة مجالات.'],
        ['اسمع الجمهور', 'متابعة فئات السكان تُظهر من هو راضٍ ومن هو غاضب. تبدأ الاحتجاجات من فئة أهملتها طويلًا.'],
        ['انتبه للأمن', 'الجبهات التي تبدو هادئة قد تشتعل. حافظ على الوحدات وحدّث الاستخبارات واحتفظ بالمخزون. عملية بلا إعداد تكلف خسائر وصورة.'],
        ['انتبه للجهاز', 'الوزراء الأقوياء يريدون نفوذًا، والوزراء المحبطون يهددون بالاستقالة. استمع إلى طلباتهم ووافق على ما هو منطقي.'],
        ['اقرأ المستشار', 'يُجري المستشار محاكاة قبل أن يوصي ويشرح ما سيفعله كل إجراء. القرار يبقى لك، لكن من المفيد معرفة المتوقع.'],
        ['العب على المدى الطويل', 'تأتي الانتخابات كل بضع سنوات. قرارات تبدو جيدة الشهر القادم قد تكلف في الانتخابات القادمة. فكّر في الاستطلاعات وليس في الدور فقط.'],
      ],
    },
  },
  {
    slug: 'state-budget',
    he: {
      title: 'תקציב המדינה: מה זה גירעון ולמה הוא חשוב', desc: 'איך נבנה תקציב, מאיפה מגיע הכסף, ומה קורה כשהמדינה מוציאה יותר ממה שהיא גובה.',
      sections: [
        ['הכנסות והוצאות', 'ההכנסות של המדינה באות בעיקר ממסים: מס הכנסה, מע״מ, מסים על חברות ועוד. ההוצאות הן מה שהממשלה מחלקת למשרדים: חינוך, בריאות, ביטחון, רווחה, תחבורה והלאה. כל שקל שמחולק למקום אחד לא מגיע למקום אחר.'],
        ['מה זה גירעון', 'כשההוצאות גבוהות מההכנסות נוצר גירעון, והמדינה לווה כדי לכסות אותו. הכסף שהיא חייבת נקרא חוב. ככל שהחוב גדל, צריך לשלם עליו יותר ריבית, וזה מצמצם את הכסף שנשאר לשירותים.'],
        ['כלים לשינוי', 'הממשלה יכולה להעלות מסים, לקצץ הוצאות, או לעודד צמיחה כדי שההכנסות יגדלו. לכל כלי יש מחיר: מסים גבוהים פוגעים בכיס, קיצוץ פוגע בשירותים, וצמיחה לוקחת זמן. התקציב הוא לא רק מספרים אלא בחירה של מי מקבל.'],
        ['איך זה במשחק', 'במסך התקציב מחלקים כסף בין המשרדים ומשנים מסים. כל שינוי משפיע על הגירעון, על איכות השירותים ועל קבוצות האוכלוסייה. כדי להעביר את התקציב צריך רוב בכנסת, והפסד בהצבעה מקרב בחירות.'],
      ],
    },
    en: {
      title: 'The state budget: what a deficit is and why it matters', desc: 'How a budget is built, where the money comes from, and what happens when the state spends more than it collects.',
      sections: [
        ['Income and spending', 'The state\'s income comes mainly from taxes: income tax, VAT, corporate taxes and more. Spending is what the government hands out to ministries: education, health, security, welfare, transport and so on. Every shekel given to one place does not reach another.'],
        ['What a deficit is', 'When spending is higher than income a deficit is created, and the state borrows to cover it. The money it owes is called debt. As debt grows, more interest has to be paid on it, which cuts the money left for services.'],
        ['Tools for change', 'The government can raise taxes, cut spending, or encourage growth so that income grows. Each tool has a price: high taxes hurt the wallet, cuts hurt services, and growth takes time. A budget is not just numbers but a choice of who receives.'],
        ['How it works in the game', 'On the budget screen you divide money between ministries and change taxes. Every change affects the deficit, the quality of services and the population groups. To pass the budget you need a majority in the Knesset, and losing the vote brings elections closer.'],
      ],
    },
    ar: {
      title: 'ميزانية الدولة: ما هو العجز ولماذا هو مهم', desc: 'كيف تُبنى الميزانية ومن أين يأتي المال وماذا يحدث حين تنفق الدولة أكثر مما تجبي.',
      sections: [
        ['الإيرادات والنفقات', 'تأتي إيرادات الدولة أساسًا من الضرائب: ضريبة الدخل والقيمة المضافة وضرائب الشركات وغيرها. والنفقات هي ما توزعه الحكومة على الوزارات: التعليم والصحة والأمن والرفاه والمواصلات وغيرها. كل شيكل يُعطى لمكان لا يصل إلى مكان آخر.'],
        ['ما هو العجز', 'حين تكون النفقات أعلى من الإيرادات ينشأ عجز، وتقترض الدولة لتغطيته. والمال الذي تدين به يسمى دينًا. وكلما كبر الدين وجب دفع فائدة أكبر عليه، مما يقلص المال المتبقي للخدمات.'],
        ['أدوات التغيير', 'يمكن للحكومة رفع الضرائب أو تقليص النفقات أو تشجيع النمو كي تزداد الإيرادات. لكل أداة ثمن: الضرائب المرتفعة تؤذي الجيب والتقليص يؤذي الخدمات والنمو يحتاج وقتًا. الميزانية ليست أرقامًا فقط بل اختيار من يحصل.'],
        ['كيف تعمل في اللعبة', 'في شاشة الميزانية توزّع المال بين الوزارات وتغيّر الضرائب. كل تغيير يؤثر في العجز وجودة الخدمات وفئات السكان. ولتمرير الميزانية تحتاج إلى أغلبية في الكنيست، والخسارة في التصويت تقرّب الانتخابات.'],
      ],
    },
  },
  {
    slug: 'areas-abc',
    he: {
      title: 'שטחי A, B ו-C: מה הסכמי אוסלו קבעו', desc: 'הסבר קצר על חלוקת יהודה ושומרון לשלושה סוגי שטח, ומי אחראי על מה בכל אחד מהם.',
      sections: [
        ['מאיפה זה בא', 'בהסכם הביניים של אוסלו ב (1995) חולקו שטחי יהודה ושומרון לשלושה סוגים, כדי להעביר סמכויות בהדרגה לרשות הפלסטינית. ההסדר נועד להיות זמני, אך נשאר בתוקף בפועל שנים רבות.'],
        ['שלושת השטחים', 'בשטח A, כ-18% מהשטח, האחריות האזרחית והביטחונית בידי הרשות הפלסטינית. בשטח B, כ-22%, האחריות האזרחית פלסטינית והביטחונית ישראלית. בשטח C, כ-60%, ישראל אחראית על הכול, והוא כולל את ההתנחלויות ואת רוב הקרקע הפתוחה.'],
        ['למה זה שנוי במחלוקת', 'שטח C חשוב לפלסטינים כמרחב להתפתחות, ולישראל מטעמי ביטחון והתיישבות. העברת שטח מ-C ל-B או מ-B ל-A היא מהלך מדיני טעון שפוגע או מחזק קואליציות, ומשפיע על יחסי החוץ.'],
        ['איך זה במשחק', 'במסך הביטחון והמדיניות אפשר להעביר שטח בכיוון המדיני (ל-B או ל-A) או בכיוון ההפוך, ולשנות את היחסים עם הרשות, עם ארה״ב ועם מדינות שכנות. כל מהלך כזה עולה הון פוליטי ומשפיע על הקואליציה.'],
      ],
    },
    en: {
      title: 'Areas A, B and C: what the Oslo Accords set', desc: 'A short explanation of how Judea and Samaria were divided into three kinds of area, and who is responsible for what in each.',
      sections: [
        ['Where it comes from', 'In the Oslo II interim agreement (1995), the areas of Judea and Samaria were divided into three kinds, in order to hand powers over gradually to the Palestinian Authority. The arrangement was meant to be temporary, but has remained in force in practice for many years.'],
        ['The three areas', 'In Area A, about 18% of the land, civil and security responsibility lies with the Palestinian Authority. In Area B, about 22%, civil responsibility is Palestinian and security responsibility is Israeli. In Area C, about 60%, Israel is responsible for everything, and it includes the settlements and most of the open land.'],
        ['Why it is disputed', 'Area C matters to the Palestinians as room to develop, and to Israel for security and settlement reasons. Moving land from C to B or from B to A is a charged diplomatic move that weakens or strengthens coalitions, and affects foreign relations.'],
        ['How it works in the game', 'On the security and diplomacy screen you can move land in the diplomatic direction (to B or to A) or the opposite way, and change relations with the Authority, the US and neighboring countries. Every such move costs political capital and affects the coalition.'],
      ],
    },
    ar: {
      title: 'المناطق A وB وC: ما الذي حدّدته اتفاقات أوسلو', desc: 'شرح موجز لتقسيم يهودا والسامرة إلى ثلاثة أنواع من المناطق، ومن المسؤول عن ماذا في كل منها.',
      sections: [
        ['من أين جاء ذلك', 'في اتفاق أوسلو الثاني المرحلي (1995) قُسّمت مناطق يهودا والسامرة إلى ثلاثة أنواع لنقل الصلاحيات تدريجيًا إلى السلطة الفلسطينية. كان الترتيب مؤقتًا لكنه بقي ساري المفعول عمليًا سنوات طويلة.'],
        ['المناطق الثلاث', 'في المنطقة A، نحو 18% من المساحة، تكون المسؤولية المدنية والأمنية بيد السلطة الفلسطينية. وفي المنطقة B، نحو 22%، المسؤولية المدنية فلسطينية والأمنية إسرائيلية. وفي المنطقة C، نحو 60%، تتولى إسرائيل كل شيء، وتشمل المستوطنات ومعظم الأراضي المفتوحة.'],
        ['لماذا هي موضع خلاف', 'المنطقة C مهمة للفلسطينيين كمساحة للتطور ولإسرائيل لأسباب أمنية واستيطانية. نقل أرض من C إلى B أو من B إلى A خطوة سياسية مشحونة تضعف ائتلافات أو تقويها وتؤثر في العلاقات الخارجية.'],
        ['كيف تعمل في اللعبة', 'في شاشة الأمن والسياسة يمكنك نقل أرض في الاتجاه السياسي (إلى B أو A) أو في الاتجاه المعاكس، وتغيير العلاقات مع السلطة والولايات المتحدة والدول المجاورة. كل خطوة كهذه تكلف رصيدًا سياسيًا وتؤثر في الائتلاف.'],
      ],
    },
  },
];

export const UI = {
  he: { dir: 'rtl', lang: 'he', prefix: '', brand: 'ממשלת ישמעאל', home: '/', game: '/game/', skip: 'דלג לתוכן הראשי', navLabel: 'ניווט ראשי', nav: ['מה זה', 'איך משחקים', 'מאמרים', 'אודות'], play: 'לשחק', indexTitle: 'מאמרים', indexSub: 'על קואליציות, חקיקה, ביטחון ותקציב: ההסברים שמאחורי המשחק.', read: 'לקריאה', back: 'כל המאמרים', cta: 'רוצים לנסות בעצמכם?', ctaBtn: 'להתחיל לשחק', suffix: 'ממשלת ישמעאל', footerLabel: 'קישורי תחתית', footer: ['שחק', 'איך משחקים', 'אודות', 'פרטיות', 'תנאי שימוש', 'צור קשר'] },
  en: { dir: 'ltr', lang: 'en', prefix: '/en', brand: 'Government of Ishmael', home: '/en/', game: '/game/?lang=en', skip: 'Skip to main content', navLabel: 'Main navigation', nav: ['What it is', 'How to play', 'Articles', 'About'], play: 'Play', indexTitle: 'Articles', indexSub: 'On coalitions, legislation, security and the budget: the explanations behind the game.', read: 'Read', back: 'All articles', cta: 'Want to try it yourself?', ctaBtn: 'Start playing', suffix: 'Government of Ishmael', footerLabel: 'Footer links', footer: ['Play', 'How to play', 'About', 'Privacy', 'Terms of use', 'Contact'] },
  ar: { dir: 'rtl', lang: 'ar', prefix: '/ar', brand: 'حكومة إسماعيل', home: '/ar/', game: '/game/?lang=ar', skip: 'تخطَّ إلى المحتوى الرئيسي', navLabel: 'التنقل الرئيسي', nav: ['ما هي', 'كيف تلعب', 'مقالات', 'حول'], play: 'العب', indexTitle: 'مقالات', indexSub: 'عن الائتلافات والتشريع والأمن والميزانية: الشروحات التي تقف وراء اللعبة.', read: 'اقرأ', back: 'كل المقالات', cta: 'هل تريد التجربة بنفسك؟', ctaBtn: 'ابدأ اللعب', suffix: 'حكومة إسماعيل', footerLabel: 'روابط التذييل', footer: ['العب', 'كيف تلعب', 'حول', 'الخصوصية', 'شروط الاستخدام', 'اتصل بنا'] },
};
