import { useGame } from '../store/gameStore';
import { ActionButton, Empty, ScreenHeader, Section } from '../components/ui';
import { deadlinesFrozen, openPromises, type OpenPromise } from '../../engine/deadlines';
import { isPM } from '../../engine/roles';
import type { GameState } from '../../types/game';

const SOURCES: { id: OpenPromise['source']; title: string; icon: string; note: string }[] = [
  { id: 'agreement', title: 'ההסכם הקואליציוני', icon: '📜', note: 'חוקים שהתחייבת להעביר מול השותפות. הפרה מורידה יציבות, ולפעמים שותפה פורשת.' },
  { id: 'personal', title: 'הבטחות אישיות', icon: '🤝', note: 'מה שהבטחת לפוליטיקאים בשיחות, בפגישות ובמשא ומתן. הבטחה שלא תקוים הופכת לבגידה שהם זוכרים.' },
  { id: 'public', title: 'הבטחות לציבור', icon: '📣', note: 'הבטחות בחירות. נמדדות לפי המצב בפועל, לא לפי חוק מסוים.' },
];

const STAGE: Record<string, string> = { preliminary: 'קריאה טרומית', committee: 'בוועדה', final: 'לקראת קריאה שלישית' };

function Deadline({ p }: { p: OpenPromise }) {
  if (p.turnsLeft === undefined) return null;
  const tone = p.turnsLeft <= 1 ? 'chip-bad' : p.turnsLeft <= 2 ? 'chip-warn' : '';
  const months = p.turnsLeft * 4;
  return <span className={`chip ${tone}`}>{p.turnsLeft === 0 ? 'המועד הגיע' : `עוד כ-${months} חודשים`}</span>;
}

/** The quickest step towards keeping the promise. */
function QuickAction({ s, p }: { s: GameState; p: OpenPromise }) {
  const goTo = useGame((x) => x.goTo);
  if (p.lawId) {
    const bill = s.bills.find((b) => b.lawId === p.lawId && b.status === 'active');
    if (bill) {
      return (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip">{STAGE[bill.stage] ?? 'בדיון'}</span>
          <ActionButton id="push_bill" params={{ billId: bill.id }} className="btn btn-sm btn-blue">📣 גיוס תמיכה</ActionButton>
        </div>
      );
    }
    return <ActionButton id="propose_law" params={{ lawId: p.lawId }} className="btn btn-sm btn-blue">📝 הגש את החוק</ActionButton>;
  }
  if (p.role && isPM(s)) return <button className="btn btn-sm btn-blue" onClick={() => goTo('government')}>🪑 למינויים</button>;
  if (p.toId) return <button className="btn btn-sm" onClick={() => goTo('chat')}>💬 לשיחה</button>;
  return null;
}

export function PromisesScreen() {
  const s = useGame((x) => x.game)!;
  const list = openPromises(s);
  const frozen = deadlinesFrozen(s);
  return (
    <div className="space-y-4">
      <ScreenHeader title="ההבטחות שלי" sub="כל מה שהבטחת ועוד לא קוים, עם המועד ועם הצעד המהיר לקיום." />
      {frozen && (
        <div className="card card-tight" role="status">
          ⏸️ אין כרגע ממשלה מתפקדת (בחירות, משא ומתן או ממשלת מעבר), ולכן אי אפשר לחוקק. המועדים מוקפאים עד שתקום ממשלה חדשה, ואף אחד לא יכעס על כך שלא קיימת.
        </div>
      )}
      {!list.length && <Empty icon="✅" text="אין הבטחות פתוחות." />}
      {SOURCES.map((src) => {
        const items = list.filter((p) => p.source === src.id);
        if (!items.length) return null;
        return (
          <Section key={src.id} title={`${src.title} (${items.length})`} icon={src.icon}>
            <p className="text-sm muted mb-2">{src.note}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((p) => (
                <div key={p.key} className="inset flex flex-col gap-2">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{p.text}</div>
                      <div className="text-xs muted">הובטח ל: {p.to}</div>
                    </div>
                    {!frozen && <Deadline p={p} />}
                  </div>
                  <QuickAction s={s} p={p} />
                </div>
              ))}
            </div>
          </Section>
        );
      })}
    </div>
  );
}
