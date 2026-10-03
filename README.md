# ממשלת ישמעל

סימולטור פוליטי סאטירי שרץ בדפדפן. אתר סטטי: דף נחיתה, דפי מידע, והמשחק עצמו ב-`/game/`.

## הרצה

```bash
npm install
npm run dev        # http://localhost:5180
npm run build      # בדיקת טיפוסים + build ל-dist/
npm run preview    # הגשת dist/ מקומית
npm test           # בדיקות המנוע (Vitest)
```

נדרש Node 22.12 ומעלה.

`dist/` הוא אתר סטטי מוכן להעלאה לכל אחסון סטטי. ל-Netlify הכל מוגדר ב-`netlify.toml`: פקודת build, תיקיית פרסום, Node 22, cache לקבצים, כותרות אבטחה (CSP) ודף 404. מספיק לחבר את ה-repo ל-Netlify. (גרירת `dist/` ל-Netlify Drop עובדת, אבל בלי ההגדרות מ-`netlify.toml`: בלי כותרות האבטחה, ותמונת השיתוף נשארת בכתובת יחסית.)

## מבנה

| תיקייה | מה יש בה |
|---|---|
| `pages/` | קובצי ה-HTML של כל הכתובות באתר (שורש Vite) |
| `public/` | favicon, תמונת שיתוף, קריקטורות וצילומי מסך |
| `src/game/` | אפליקציית המשחק ב-React: מסכים, רכיבים, store, סאונד, עיצוב |
| `src/engine/` | לוגיקת המשחק: סימולציה טהורה בלי React, כולל בדיקות |
| `src/data/` | נתוני העולם הבדיוני |
| `src/types/` | הטיפוסים, כולל `GameState` |
| `src/utils/` | עזרים כלליים |
| `src/shared/` | משותף למשחק ולאתר: מחולל הקריקטורות וצבעי העיצוב |
| `src/landing/` | עיצוב דף הנחיתה ודפי המידע |
| `scripts/` | יצירת קריקטורות ו-favicon, אופטימיזציית תמונות |
| `docs/` | ארכיטקטורה, סטטוס ומפת דרכים |

פירוט מלא: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## לפני העלאה
- להוסיף כתובת ליצירת קשר ב-`pages/contact/index.html`.
- תמונת השיתוף (`og:image`) מקבלת כתובת מלאה אוטומטית ב-build מהמשתנה `URL` של Netlify. באחסון אחר: `SITE_URL=https://example.com npm run build`.
