import type { CSSProperties } from 'react';
import type { Reaction } from '../../types/game';

/** Picks the visual mood of a decision's result. */
export function fxKind(r: Reaction): 'war' | 'money' | 'good' | 'bad' | 'meh' {
  const t = `${r.title} ${r.subtitle ?? ''}`;
  if (/מלחמה|רקט|💣|🚀|💥|טיל/.test(t)) return 'war';
  if (/₪|מיליארד|מס|תקציב|💸|💰/.test(t) && r.status !== 'rejected') return 'money';
  return r.status === 'approved' ? 'good' : r.status === 'rejected' ? 'bad' : 'meh';
}

const EMOJI = {
  war: ['💥', '🔥', '💣', '🚀', '💥', '🪖'],
  money: ['💸', '💰', '🪙', '💵', '🤑'],
  good: ['🎉', '✨', '👏', '⭐', '🥳', '💚'],
  bad: ['🍅', '💔', '😱', '⚡', '🙈', '🥚'],
  meh: ['🤷', '💬', '🗞️', '☕'],
};

/** Emoji burst that flies out of the result window. */
export function Burst({ kind }: { kind: ReturnType<typeof fxKind> }) {
  const set = EMOJI[kind];
  const n = kind === 'meh' ? 8 : 16;
  return (
    <div className="burst" aria-hidden>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + (i % 3) * 0.3;
        const d = 120 + ((i * 37) % 90);
        const style = { '--dx': `${Math.cos(a) * d}px`, '--dy': `${Math.sin(a) * d - 40}px`, '--r': `${(i * 47) % 360}deg`, animationDelay: `${(i % 5) * 0.04}s`, fontSize: `${18 + (i % 4) * 6}px` } as CSSProperties;
        return <span key={i} style={style}>{set[i % set.length]}</span>;
      })}
    </div>
  );
}

/** Advertising slots. Few and clearly marked. Until real ads are wired in, they show satirical "house ads". */
export const AD_CONFIG = {
  enabled: true,
  // To use a real ad network, render its tag inside <AdSlot> for the matching slot id.
  slots: ['sidebar', 'dashboard', 'news'] as const,
};
const HOUSE_ADS = [
  { icon: '🧀', title: 'קוטג׳ "הכיסא"', text: 'עכשיו ב-30% הנחה למצביעי הקואליציה*', small: '*האופוזיציה משלמת כפול' },
  { icon: '🛋️', title: 'כיסאות "דבק פוליטי"', text: 'הכיסא שאי אפשר לקום ממנו. 15 שנות אחריות.', small: 'בשימוש ראשי ממשלה מובילים' },
  { icon: '🎙️', title: 'קורס "לא לענות על שאלות"', text: '4 מפגשים. כולל סדנת "הוצא מהקשרו".', small: 'בהנחיית דובר לשעבר' },
  { icon: '🏝️', title: 'משלחות לימודיות בע״מ', text: 'לומדים מכל העולם. בעיקר מחופי העולם.', small: 'מימון ממשלתי זמין' },
  { icon: '🧯', title: 'ביטוח נגד ועדות חקירה', text: 'כי אף פעם לא יודעים מתי ייפתח פרוטוקול.', small: 'לא כולל ציוצים מ-3 בלילה' },
];
export function AdSlot({ slot, seed = 0 }: { slot: (typeof AD_CONFIG.slots)[number]; seed?: number }) {
  if (!AD_CONFIG.enabled) return null;
  const ad = HOUSE_ADS[(seed + slot.length) % HOUSE_ADS.length];
  return (
    <aside className={`ad-slot ad-${slot}`} data-ad-slot={slot} data-tip="מקום לפרסומת. כרגע: פרסומת סאטירית של המשחק">
      <span className="ad-label">פרסומת</span>
      <div className="flex items-center gap-3">
        <span className="text-3xl">{ad.icon}</span>
        <div className="min-w-0">
          <div className="font-extrabold text-sm">{ad.title}</div>
          <div className="text-xs">{ad.text}</div>
          <div className="text-[10px] muted">{ad.small}</div>
        </div>
      </div>
    </aside>
  );
}
