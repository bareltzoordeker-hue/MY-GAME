# ARCHITECTURE — ממשלת ישמעאל

```
UI (React, src/game)  ──►  store (zustand)  ──►  engine (pure TS, src/engine)  ──►  GameState
        ▲                                                │
        └──────────── Reaction / Briefing ◄──────────────┘
                                          persistence (localStorage)
```

## מבנה התיקיות

```
pages/                     שורש Vite. מבנה התיקיות = מבנה הכתובות באתר
├── index.html             /             דף נחיתה (HTML+CSS סטטי, בלי JS)
├── game/index.html        /game/        המשחק (טוען את src/game/main.tsx)
├── how-to-play/           /how-to-play/
└── privacy/ terms/ about/ contact/
public/                    קבצים סטטיים שמוגשים כמו שהם
├── favicon.svg, og-image.png
└── images/cast/ (קריקטורות SVG), images/screens/ (צילומי מסך WebP)
src/
├── game/                  אפליקציית המשחק (React)
│   ├── main.tsx, App.tsx
│   ├── screens/           מסך לכל לשונית בתפריט
│   ├── components/        Layout, Modals, Overlay, Drama, Fx, Tutorial, HowToPlay, ui.tsx
│   ├── store/             Zustand: GameState, תורי modals, מסך פעיל. קורא רק ל-engine
│   ├── audio/             סאונד, מוזיקה ו"בלה-בלה" (WebAudio, בלי קבצים)
│   ├── content/           טקסטי הסבר ל-UI ("?" ליד מספרים)
│   └── styles/game.css    Tailwind + עיצוב המשחק
├── engine/                לוגיקת המשחק: פונקציות טהורות, בלי React
│   ├── turn.ts            advanceTurn() מריץ את כל המערכות בסדר קבוע (תור = חודשיים)
│   ├── decisions.ts       כל פעולה של השחקן: ActionDef → effects → Reaction
│   ├── economy, services, population, polls, parliament, government, elections, …
│   ├── rng.ts             mulberry32 עם seed שנשמר ב-state (rngState)
│   ├── ai/                שכבת הנרטיב: כותרות, תגובות, ייעוץ, Claude (אופציונלי). לא משנה state
│   ├── persistence/       שמירה/טעינה + ולידציה
│   └── engine.test.ts     בדיקות Vitest
├── data/                  נתוני העולם הבדיוני: מפלגות, משרדים, חוקים, פרויקטים, משברים
├── types/game.ts          כל ה-Types. GameState הוא מקור האמת היחיד
├── utils/                 עזרים כלליים: clamp, פורמט מספרים, תאריכים
├── shared/                משותף למשחק ולאתר
│   ├── components/Caricature.tsx   מחולל הקריקטורות (גם ל-public/images/cast)
│   └── styles/tokens.css           צבעים ופונט משותפים
└── landing/styles/site.css         עיצוב דף הנחיתה ודפי המידע
scripts/                   כלי פיתוח (לא נכנסים ל-build)
├── gen-assets.tsx         npm run assets:generate  – קריקטורות ו-favicon מתוך קוד המשחק
└── optimize-images.mjs    npm run assets:optimize  – PNG → WebP
docs/                      תיעוד
```

## כללי תלות
- `engine/`, `data/`, `types/`, `utils/` לא מייבאים React ולא שום דבר מ-`game/`.
- `game/` מחזיק את ה-state ב-`store/` ומשתמש במנוע לחישובים ולתצוגה. UI לא מחזיק לוגיקה עסקית.
- `shared/` לא תלוי ב-`game/` או ב-`landing/`.
- דפי `pages/` מפנים לקוד עם נתיב יחסי (`../../src/...`), וקבצים מ-`public/` עם נתיב מוחלט (`/images/...`).

## תפקידים
אותו מנוע לכל המסלולים. `getCapabilities(state)` (`engine/roles.ts`) מחזיר הרשאות לפי תפקיד, וגם אם השחקן מנהיג מפלגה.

## Debug
במצב פיתוח (`import.meta.env.DEV`) יש פאנל Debug (כפתור 🐞) להצגת state ופעולות עזר.
