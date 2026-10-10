// The Knesseton speaker's office: what the speaker can do in the plenum, with the parties, and with every bill in debate.
import { LAW_BY_ID } from '../../data/laws';
import type { GameState } from '../../types/game';
import { ActionButton, Section } from './ui';

const SPEAKER_ACTIONS: { id: string; label: string; primary?: boolean }[] = [
  { id: 'speaker_mediate', label: '🤝 תיווך בין קואליציה לאופוזיציה' },
  { id: 'speaker_debate', label: '🎙️ דיון מיוחד במליאה' },
  { id: 'speaker_question_time', label: '❓ שעת שאלות לראש הממשלה' },
  { id: 'speaker_discipline', label: '🚪 הרחקת ח״כים מפריעים' },
  { id: 'speaker_inquiry', label: '🔎 ועדת חקירה פרלמנטרית' },
  { id: 'speaker_ethics', label: '⚖️ ועדת האתיקה' },
];
const SPEAKER_RELATIONS: { id: string; label: string; primary?: boolean }[] = [
  { id: 'speaker_leaders_meeting', label: '🍽️ ארוחה עם ראשי הסיעות' },
  { id: 'speaker_committees', label: '🗂️ חלוקת ועדות הכנסטון' },
  { id: 'speaker_briefing', label: '🛡️ תדריך ביטחוני לחברי הכנסטון' },
  { id: 'speaker_visit', label: '🌍 אירוח מנהיג זר' },
  { id: 'speaker_youth', label: '🎓 כנסטון הנוער' },
  { id: 'speaker_open_day', label: '🏛️ יום פתוח' },
  { id: 'speaker_reform', label: '📘 רפורמה בתקנון', primary: true },
];

export function SpeakerPanel({ s }: { s: GameState }) {
  const bills = s.bills.filter((b) => b.status === 'active');
  const dissolved = s.government.caretaker && s.elections.phase === 'none';
  return (
    <div className="space-y-4">
      <Section title="ניהול המליאה" icon="🔨">
        <p className="text-sm muted mb-2">אתה מנהל את המליאה: קובע את סדר היום, שומר על הסדר ומייצג את הכנסטון. כל פעולה משפיעה על המוניטין, על הפופולריות ועל יציבות הממשלה.</p>
        <div className="flex flex-wrap gap-2">{SPEAKER_ACTIONS.map((a) => <ActionButton key={a.id} id={a.id} className="btn btn-sm">{a.label}</ActionButton>)}</div>
      </Section>
      <Section title="קשרים ומוניטין" icon="🤝">
        <div className="flex flex-wrap gap-2">{SPEAKER_RELATIONS.map((a) => <ActionButton key={a.id} id={a.id} className={`btn btn-sm ${a.primary ? 'btn-blue' : ''}`}>{a.label}</ActionButton>)}</div>
      </Section>
      <Section title="הצעות בדיון" icon="📝">
        {dissolved ? <p className="text-sm muted">⏸️ הכנסטון התפזר. אין דיונים עד שתקום ממשלה.</p>
          : bills.length === 0 ? <p className="text-sm muted">אין כרגע הצעות בדיון.</p>
          : <div className="space-y-2">{bills.slice(0, 8).map((b) => (
            <div key={b.id} className="inset">
              <b>{LAW_BY_ID[b.lawId]?.icon} {b.title}</b>
              <div className="flex gap-1.5 flex-wrap mt-2">
                <ActionButton id="speaker_schedule" params={{ billId: b.id }} className="btn btn-sm btn-blue">📅 קידום בסדר היום</ActionButton>
                <ActionButton id="speaker_fast_track" params={{ billId: b.id }} className="btn btn-sm">⏩ קיצור הליכים</ActionButton>
                <ActionButton id="speaker_delay" params={{ billId: b.id }} className="btn btn-sm">⏸️ עיכוב</ActionButton>
              </div>
            </div>))}</div>}
      </Section>
    </div>
  );
}
