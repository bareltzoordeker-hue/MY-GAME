import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { PARTIES } from '../../data/parties';
import { PEOPLE, type PersonDef } from '../../data/people';
import { MINISTRIES } from '../../data/ministries';
import { DIFFICULTIES } from '../../data/world';
import type { CaricatureSpec, Difficulty } from '../../types/game';
import { saveMeta } from '../../engine/persistence/save';
import { personCaricature } from '../../engine/newGame';
import { Caricature } from '../../shared/components/Caricature';
import { HowToPlayButton } from '../components/HowToPlay';
import { setTutorialEnabled } from '../components/Tutorial';

const ROLE_TEXT = (p: PersonDef) => {
  if (p.role === 'pm') return 'ראש הממשלה';
  if (p.role === 'speaker') return 'יו״ר הכנסטון';
  if (p.role?.startsWith('deputy:')) return 'סגן/ית שר';
  const m = MINISTRIES.find((x) => x.id === p.role);
  if (m) return m.name.startsWith('המשרד') ? `שר/ה ${m.name.slice(6)}` : `שר/ה ${m.name.replace(/^משרד /, '')}`;
  if (p.rank === 1) return 'יו״ר הרשימה';
  return p.mk ? 'חבר/ת כנסטון' : 'מועמד/ת';
};

/** What the player will start as, from the person's real position. */
const START_AS = (p: PersonDef) => (p.role === 'pm' ? 'ראש ממשלה' : p.role && MINISTRIES.some((m) => m.id === p.role) ? 'שר בממשלה' : p.rank === 1 ? 'מתמודד לראשות הממשלה' : 'חבר כנסטון / מועמד');

const LOOKS: { id: string; name: string; spec: Partial<CaricatureSpec> }[] = [
  { id: 'a', name: 'קלאסי', spec: { hair: 'comb', glasses: false, beard: 'none', hairColor: '#3b2a1a' } },
  { id: 'b', name: 'משקפיים', spec: { hair: 'comb', glasses: true, beard: 'stubble', hairColor: '#1f1f1f' } },
  { id: 'c', name: 'כיפה', spec: { hair: 'kippah', glasses: false, beard: 'full', hairColor: '#2a2a2a' } },
  { id: 'd', name: 'קרחת', spec: { hair: 'bald', glasses: false, beard: 'none', hairColor: '#444' } },
  { id: 'e', name: 'שיער ארוך', spec: { hair: 'long', glasses: false, beard: 'none', hairColor: '#4b3621' } },
  { id: 'f', name: 'שיער אסוף', spec: { hair: 'bun', glasses: true, beard: 'none', hairColor: '#1f1f1f' } },
  { id: 'g', name: 'כיסוי ראש', spec: { hair: 'scarf', glasses: false, beard: 'none', hairColor: '#3b2a5a' } },
];

export function MainMenu({ onNew }: { onNew: () => void }) {
  const cont = useGame((s) => s.continueGame);
  const meta = useMemo(() => saveMeta(), []);
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        <div className="card p-6 md:p-10 text-center rise">
          <div className="text-xs font-bold tracking-widest muted">סימולטור פוליטי</div>
          <h1 className="text-5xl md:text-6xl font-black mt-2" style={{ letterSpacing: '-0.02em' }}>ממשלת ישמעאל</h1>
          <p className="muted mt-4 leading-relaxed max-w-xl mx-auto">
            ספטמבר 2026. הכנסטון התפזר, 38 רשימות מתמודדות, והבחירות ב-27 באוקטובר.
            בחרו פוליטיקאי ממשי או צרו דמות משלכם, נהלו קמפיין, הרכיבו קואליציה והובילו את המדינה.
          </p>
          <div className="flex flex-wrap gap-3 mt-7 justify-center">
            <button className="btn btn-primary btn-lg" onClick={onNew}>משחק חדש</button>
            {meta && <button className="btn btn-lg" onClick={() => cont()}>המשך משחק</button>}
            <HowToPlayButton className="btn btn-lg" />
          </div>
          {meta && <p className="text-xs muted mt-3">שמירה אחרונה: {meta.name} · {meta.party} · תור {meta.turn}</p>}
          <p className="text-sm mt-5"><a href="/" className="muted" style={{ textDecoration: 'underline' }}>לאתר המשחק</a></p>
        </div>
      </div>
    </div>
  );
}

export function NewGame({ onBack }: { onBack: () => void }) {
  const newGame = useGame((s) => s.newGame);
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<'real' | 'custom'>('real');
  const [partyId, setPartyId] = useState('likud');
  const [personId, setPersonId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const [look, setLook] = useState(LOOKS[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [guide, setGuide] = useState(true);

  const party = PARTIES.find((p) => p.id === partyId)!;
  const roster = PEOPLE.filter((p) => p.party === partyId).sort((a, b) => (a.rank || 999) - (b.rank || 999));
  const realistic = Math.max(1, Math.round(party.poll));
  const chosen = PEOPLE.find((p) => p.id === personId);

  const start = () => {
    if (!chosen) return;
    setTutorialEnabled(guide);
    if (mode === 'real') newGame({ personId: chosen.id, difficulty });
    else newGame({ custom: { name: name.trim() || (gender === 'f' ? 'דנה כהן' : 'דני כהן'), gender, look: look.spec, replaceId: chosen.id }, difficulty });
  };
  const steps = ['מסלול', 'רשימה', mode === 'real' ? 'פוליטיקאי' : 'את מי מחליפים', 'הגדרות'];

  return (
    <div className="min-h-screen p-4 flex justify-center">
      <div className="w-full max-w-5xl">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <button className="btn btn-ghost btn-sm" onClick={step ? () => setStep(step - 1) : onBack}>→ חזרה</button>
          <ol className="flex flex-wrap gap-1 text-xs" aria-label="שלבי יצירת משחק">
            {steps.map((t, i) => <li key={t} className={`chip ${i === step ? 'chip-gold' : ''}`} aria-current={i === step ? 'step' : undefined}>{i + 1}. {t}</li>)}
          </ol>
        </div>

        {step === 0 && (
          <div className="rise">
            <h1 className="screen-title mb-1">איך נכנסים לפוליטיקה?</h1>
            <p className="h-sub mb-4">כל המפלגות, הרשימות והאנשים לפי המצב בספטמבר 2026.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button className={`card card-hover text-right ${mode === 'real' ? 'card-selected' : ''}`} onClick={() => { setMode('real'); setStep(1); }}>
                <div className="text-xl font-black">פוליטיקאי אמיתי</div>
                <p className="muted text-sm mt-1">משחקים בתור אחד מחברי הכנסטון והמועמדים. התפקיד ההתחלתי לפי התפקיד האמיתי: ראש ממשלה, שר, יו״ר מפלגה או חבר כנסטון.</p>
              </button>
              <button className={`card card-hover text-right ${mode === 'custom' ? 'card-selected' : ''}`} onClick={() => { setMode('custom'); setStep(1); }}>
                <div className="text-xl font-black">דמות משלך</div>
                <p className="muted text-sm mt-1">יוצרים פוליטיקאי חדש שתופס את המקום של אחד המועמדים ברשימה – כולל המקום ברשימה והתפקיד שלו.</p>
              </button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="rise">
            <h1 className="screen-title mb-1">באיזו רשימה?</h1>
            <p className="h-sub mb-4">ממוצע הסקרים האחרונים לפני הבחירות, ומספר המושבים בכנסטון היוצא.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {PARTIES.map((p) => (
                <button key={p.id} onClick={() => { setPartyId(p.id); setPersonId(null); setStep(2); }} className={`card card-hover text-right ${partyId === p.id ? 'card-selected' : ''}`} style={{ borderInlineStart: `6px solid ${p.color}` }}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-black">{p.name}</span>
                    <span className="chip" aria-label={`אותיות: ${p.letters}`}>{p.letters}</span>
                  </div>
                  <p className="text-xs muted mt-1">{p.description}</p>
                  <div className="flex flex-wrap gap-2 mt-2 text-xs">
                    <span className="chip">סקרים: {p.poll < 3.5 ? 'סביב אחוז החסימה' : `${Math.round(p.poll)} מנדטים`}</span>
                    <span className="chip">כנסטון יוצא: {p.seats}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="rise">
            <h1 className="screen-title mb-1">{mode === 'real' ? `בחרו פוליטיקאי – ${party.name}` : `את מי הדמות שלך מחליפה? – ${party.name}`}</h1>
            <p className="h-sub mb-4">הרשימה לפי הסדר האמיתי. לפי הסקרים, המקומות הריאליים הם 1–{realistic}.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {roster.map((p) => (
                <button key={p.id} onClick={() => setPersonId(p.id)} className={`inset text-right flex items-center gap-3 ${personId === p.id ? 'card-selected' : ''}`} aria-pressed={personId === p.id}>
                  <Caricature spec={personCaricature(p)} size={46} tie={party.color} still />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <b className="text-sm truncate">{p.name}</b>
                      {p.mk && <span className="chip" style={{ padding: '0 6px', fontSize: '.65rem' }}>ח״כ</span>}
                    </span>
                    <span className="block text-xs muted truncate">{p.rank ? `מקום ${p.rank}` : 'לא ברשימה'} · {ROLE_TEXT(p)}</span>
                    {p.rank > realistic && <span className="block text-[11px]" style={{ color: 'var(--warn)' }}>מקום לא ריאלי לפי הסקרים</span>}
                  </span>
                </button>
              ))}
            </div>
            <div className="flex justify-between items-center mt-4 gap-3 flex-wrap">
              <span className="text-sm muted">{chosen ? `${chosen.name} · ${chosen.bio ?? ROLE_TEXT(chosen)} · מתחילים בתור: ${START_AS(chosen)}` : 'בחרו מהרשימה'}</span>
              <button className="btn btn-primary" disabled={!chosen} onClick={() => setStep(3)}>המשך</button>
            </div>
          </div>
        )}

        {step === 3 && chosen && (
          <div className="rise grid grid-cols-1 md:grid-cols-[1fr_280px] gap-4">
            <div className="card space-y-4">
              {mode === 'custom' && (
                <>
                  <div>
                    <label className="label mb-1 block" htmlFor="ng-name">השם של הדמות</label>
                    <input id="ng-name" type="text" className="w-full" maxLength={24} placeholder={gender === 'f' ? 'דנה כהן' : 'דני כהן'} value={name} onChange={(e) => setName(e.target.value)} />
                  </div>
                  <div className="flex gap-2" role="group" aria-label="מגדר">
                    <button className={`btn btn-sm ${gender === 'm' ? 'btn-blue' : ''}`} aria-pressed={gender === 'm'} onClick={() => setGender('m')}>פוליטיקאי</button>
                    <button className={`btn btn-sm ${gender === 'f' ? 'btn-blue' : ''}`} aria-pressed={gender === 'f'} onClick={() => setGender('f')}>פוליטיקאית</button>
                  </div>
                  <div>
                    <div className="label mb-2">מראה</div>
                    <div className="flex flex-wrap gap-2">
                      {LOOKS.map((l) => (
                        <button key={l.id} onClick={() => setLook(l)} className={`inset text-center ${look.id === l.id ? 'card-selected' : ''}`} aria-pressed={look.id === l.id}>
                          <Caricature spec={personCaricature({ id: 'x' + l.id, gender, party: partyId, look: l.spec })} size={52} still />
                          <div className="text-[11px] mt-1">{l.name}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div>
                <div className="label mb-2">רמת קושי</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.values(DIFFICULTIES).map((d) => (
                    <button key={d.id} className={`inset text-right ${difficulty === d.id ? 'card-selected' : ''}`} aria-pressed={difficulty === d.id} onClick={() => setDifficulty(d.id)}>
                      <div className="font-bold">{d.icon} {d.name}</div>
                      <div className="text-[11px] muted">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" checked={guide} onChange={(e) => setGuide(e.target.checked)} style={{ marginTop: 3 }} />
                <span><b>לשחק עם מדריך</b> – הסבר שלב אחרי שלב על כל מסך ועל כל פעולה. אפשר להפעיל שוב בכל משחק ממסך ההגדרות.</span>
              </label>
            </div>
            <div className="card flex flex-col items-center text-center gap-3">
              <Caricature spec={mode === 'custom' ? personCaricature({ id: 'x' + look.id, gender, party: partyId, look: look.spec }) : personCaricature(chosen)} size={120} tie={party.color} />
              <div className="font-black text-lg">{mode === 'custom' ? (name || (gender === 'f' ? 'דנה כהן' : 'דני כהן')) : chosen.name}</div>
              <div className="chip chip-gold">{START_AS(chosen)}</div>
              <div className="text-sm muted">{party.name} · {chosen.rank ? `מקום ${chosen.rank} ברשימה` : 'לא ברשימה'}</div>
              {mode === 'custom' && <div className="text-xs muted">תופס/ת את המקום של {chosen.name}</div>}
              <button className="btn btn-primary btn-lg w-full mt-auto" onClick={start}>התחלת המשחק</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
