import { useMemo, useState } from 'react';
import { useGame } from '../store/gameStore';
import { PARTIES, LEADERS } from '../../data/parties';
import { MINISTRIES } from '../../data/ministries';
import { DIFFICULTIES, COUNTRY, PARLIAMENT } from '../../data/world';
import type { CaricatureSpec, Difficulty, Role } from '../../types/game';
import { saveMeta } from '../../engine/persistence/save';
import { Caricature, ADVISOR_SPEC } from '../../shared/components/Caricature';
import { HowToPlayButton } from '../components/HowToPlay';

const ROLES: { id: Role; icon: string; title: string; desc: string; tag: string }[] = [
  { id: 'pm', icon: '🪑', title: 'ראש ממשלה', desc: 'מתחיל על הכיסא. מדינה, קואליציה, תקציב ומשברים. רק לא ליפול.', tag: 'שליטה מלאה' },
  { id: 'candidate', icon: '📢', title: 'מועמד לראשות הממשלה', desc: 'מנהיג מפלגת אופוזיציה. קמפיין, הבטחות ובחירות בעוד שנתיים.', tag: 'מרוץ לשלטון' },
  { id: 'minister', icon: '🏛️', title: 'שר בממשלה', desc: 'משרד משלך, תקציב, רפורמות ובוס אחד שאפשר לאכזב.', tag: 'ניהול משרד' },
  { id: 'mk', icon: '🙋', title: 'חבר כנסטון', desc: 'אלמוני במקום 14. ועדות, קשרים ופריימריז – עד הכיסא.', tag: 'מסלול קריירה' },
];

const LOOKS: { id: string; name: string; spec: Partial<CaricatureSpec> }[] = [
  { id: 'a', name: 'הטכנוקרט', spec: { hair: 'comb', glasses: true, beard: 'none', mouth: 'smile', skin: '#f2c9a0', hairColor: '#4b3621', suit: '#1e3a8a', brows: 'flat' } },
  { id: 'b', name: 'הלוחם', spec: { hair: 'bald', glasses: false, beard: 'stubble', mouth: 'smirk', skin: '#d49a6a', hairColor: '#1f2937', suit: '#14532d', brows: 'angry' } },
  { id: 'c', name: 'הכריזמטית', spec: { hair: 'long', glasses: false, beard: 'none', mouth: 'smile', skin: '#f5d6b8', hairColor: '#a16207', suit: '#7f1d1d', brows: 'flat' } },
  { id: 'd', name: 'הוותיק', spec: { hair: 'grey', glasses: true, beard: 'full', mouth: 'open', skin: '#e8b48a', hairColor: '#9ca3af', suit: '#334155', brows: 'worried' } },
  { id: 'e', name: 'הצעירה', spec: { hair: 'bun', glasses: true, beard: 'none', mouth: 'smirk', skin: '#e0ac69', hairColor: '#111827', suit: '#44403c', brows: 'flat' } },
];
const baseLook: CaricatureSpec = { skin: '#f2c9a0', hair: 'comb', hairColor: '#333', glasses: false, beard: 'none', nose: 0.6, mouth: 'smile', suit: '#1e293b', brows: 'flat', ears: 0.5 };

export function MainMenu({ onNew }: { onNew: () => void }) {
  const cont = useGame((s) => s.continueGame);
  const meta = useMemo(() => saveMeta(), []);
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-4xl grid md:grid-cols-2 gap-6 items-center">
        <div className="rise">
          <div className="text-7xl float">🪑</div>
          <h1 className="text-5xl md:text-6xl font-black mt-3" style={{ letterSpacing: '-0.03em' }}>ממשלת ישמעל</h1>
          <p className="text-lg mt-2" style={{ color: 'var(--gold)' }}>סימולטור פוליטי סאטירי</p>
          <p className="muted mt-4 leading-relaxed">
            ברוכים הבאים ל{COUNTRY}: מדינה בדיונית לגמרי, עם {PARLIAMENT} של 120 חברים, תשע מפלגות, תקציב של חצי טריליון ואף אחד שמקשיב.
            נסו לשרוד. הניצחון היחיד הוא להישאר.
          </p>
          <div className="flex flex-wrap gap-3 mt-6">
            <button className="btn btn-primary btn-lg" onClick={onNew}>🎬 משחק חדש</button>
            {meta && <button className="btn btn-lg" onClick={() => cont()}>▶️ המשך משחק</button>}
            <HowToPlayButton className="btn btn-lg" />
          </div>
          {meta && <p className="text-xs muted mt-3">שמירה אחרונה: {meta.name} · {meta.party} · תור {meta.turn}</p>}
          <p className="text-sm mt-4"><a href="/" className="muted" style={{ textDecoration: 'underline' }}>→ לאתר המשחק</a></p>
        </div>
        <div className="card rise hidden md:block" style={{ animationDelay: '.1s' }}>
          <div className="label mb-3">הקאסט (כל דמיון למציאות – מקרי ומטריד)</div>
          <div className="grid grid-cols-3 gap-3">
            {LEADERS.slice(0, 9).map((l) => {
              const p = PARTIES.find((x) => x.id === l.partyId)!;
              return (
                <div key={l.name} className="text-center">
                  <div className="flex justify-center"><Caricature spec={{ ...baseLook, ...(l.caricature as Partial<CaricatureSpec>), suit: '#1e293b', skin: '#e8b48a', hairColor: l.caricature.hairColor ?? '#2a2a2a' }} size={64} tie={p.color} /></div>
                  <div className="text-xs font-bold mt-1 truncate">{l.name}</div>
                  <div className="text-[10px] muted truncate">{p.logo} {p.shortName}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function NewGame({ onBack }: { onBack: () => void }) {
  const newGame = useGame((s) => s.newGame);
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<Role>('pm');
  const [partyId, setPartyId] = useState('kise');
  const [ministryId, setMinistryId] = useState('transport');
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'m' | 'f'>('m');
  const [look, setLook] = useState(LOOKS[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [partyName, setPartyName] = useState('');

  const parties = PARTIES.filter((p) => (role === 'pm' || role === 'minister' ? p.coalition : role === 'candidate' ? !p.coalition : true));
  const leaderRole = role === 'pm' || role === 'candidate';
  const pickRole = (r: Role) => {
    setRole(r);
    const list = PARTIES.filter((p) => (r === 'pm' || r === 'minister' ? p.coalition : r === 'candidate' ? !p.coalition : true));
    if (!list.some((p) => p.id === partyId)) setPartyId(list[0].id);
    setStep(1);
  };
  const start = () => newGame({
    playerName: name.trim() || (gender === 'f' ? 'דנה פוליטיקאית' : 'דני פוליטיקאי'), gender, role, partyId,
    ministryId: role === 'minister' ? ministryId : undefined, difficulty, look: look.spec, partyName: leaderRole && partyName.trim() ? partyName.trim() : undefined,
  });

  return (
    <div className="min-h-screen p-4 flex justify-center">
      <div className="w-full max-w-4xl">
        <div className="flex items-center justify-between mb-4">
          <button className="btn btn-ghost btn-sm" onClick={step ? () => setStep(step - 1) : onBack}>→ חזרה</button>
          <div className="flex gap-1">{[0, 1, 2].map((i) => <span key={i} className="w-8 h-1.5 rounded-full" style={{ background: i <= step ? 'var(--gold)' : 'var(--panel3)' }} />)}</div>
        </div>

        {step === 0 && (
          <div className="rise">
            <h1 className="screen-title mb-1">איך נכנסים לפוליטיקה?</h1>
            <p className="h-sub mb-4">אותו עולם, ארבע נקודות פתיחה. אפשר להתקדם מכל אחת.</p>
            <div className="grid sm:grid-cols-2 gap-3">
              {ROLES.map((r) => (
                <button key={r.id} onClick={() => pickRole(r.id)} className="card card-hover text-right" style={{ cursor: 'pointer', borderColor: role === r.id ? 'var(--gold)' : undefined }}>
                  <div className="flex items-start justify-between"><span className="text-4xl">{r.icon}</span><span className="chip chip-gold">{r.tag}</span></div>
                  <div className="text-xl font-black mt-2">{r.title}</div>
                  <p className="muted text-sm mt-1">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="rise">
            <h1 className="screen-title mb-1">{role === 'candidate' ? 'איזו מפלגת אופוזיציה תוביל?' : role === 'pm' ? 'איזו מפלגה בשלטון?' : 'לאיזו מפלגה אתה שייך?'}</h1>
            <p className="h-sub mb-4">{leaderRole ? 'אתה תחליף את המנהיג הנוכחי. הוא יקבל שגרירות באיי פיג׳י.' : 'המנהיג יישאר. בינתיים.'}</p>
            <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
              {parties.map((p) => (
                <button key={p.id} onClick={() => setPartyId(p.id)} className="card card-hover text-right" style={{ cursor: 'pointer', borderColor: partyId === p.id ? p.color : undefined, boxShadow: partyId === p.id ? `0 0 0 2px ${p.color}55` : undefined }}>
                  <div className="flex items-center justify-between"><span className="text-3xl">{p.logo}</span><span className="chip num">{p.seats} מנדטים</span></div>
                  <div className="font-black mt-1">{p.name}</div>
                  <p className="text-xs muted mt-1">{p.description}</p>
                  <p className="text-xs mt-2" style={{ color: p.color }}>"{p.slogan}"</p>
                </button>
              ))}
            </div>
            {role === 'minister' && (
              <div className="card mt-4">
                <div className="h-title mb-2">🏛️ איזה משרד?</div>
                <div className="flex flex-wrap gap-2">
                  {MINISTRIES.filter((m) => !m.satire || true).map((m) => (
                    <button key={m.id} className={`btn btn-sm ${ministryId === m.id ? 'btn-primary' : ''}`} onClick={() => setMinistryId(m.id)}>
                      {m.icon} {m.name.replace('משרד ה', '').replace('המשרד ל', '')}{m.deep && <span className="chip" style={{ padding: '0 5px' }}>מורחב</span>}
                    </button>
                  ))}
                </div>
                <p className="text-xs muted mt-2">{MINISTRIES.find((m) => m.id === ministryId)?.quip}</p>
              </div>
            )}
            <div className="flex justify-end mt-4"><button className="btn btn-primary" onClick={() => setStep(2)}>המשך ←</button></div>
          </div>
        )}

        {step === 2 && (
          <div className="rise grid md:grid-cols-[1fr_280px] gap-4">
            <div className="card space-y-4">
              <div>
                <div className="label mb-1">השם שלך</div>
                <input type="text" className="w-full" maxLength={24} placeholder={gender === 'f' ? 'דנה פוליטיקאית' : 'דני פוליטיקאי'} value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button className={`btn btn-sm ${gender === 'm' ? 'btn-blue' : ''}`} onClick={() => setGender('m')}>פוליטיקאי</button>
                <button className={`btn btn-sm ${gender === 'f' ? 'btn-blue' : ''}`} onClick={() => setGender('f')}>פוליטיקאית</button>
              </div>
              <div>
                <div className="label mb-2">הקריקטורה שלך</div>
                <div className="flex flex-wrap gap-2">
                  {LOOKS.map((l) => (
                    <button key={l.id} onClick={() => setLook(l)} className="inset text-center" style={{ cursor: 'pointer', borderColor: look.id === l.id ? 'var(--gold)' : undefined }}>
                      <Caricature spec={{ ...baseLook, ...l.spec }} size={56} />
                      <div className="text-[11px] mt-1">{l.name}</div>
                    </button>
                  ))}
                </div>
              </div>
              {leaderRole && (
                <div>
                  <div className="label mb-1">שם חדש למפלגה (לא חובה)</div>
                  <input type="text" className="w-full" maxLength={30} placeholder={PARTIES.find((p) => p.id === partyId)?.name} value={partyName} onChange={(e) => setPartyName(e.target.value)} />
                </div>
              )}
              <div>
                <div className="label mb-2">רמת קושי</div>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.values(DIFFICULTIES)).map((d) => (
                    <button key={d.id} className="inset text-right" style={{ cursor: 'pointer', borderColor: difficulty === d.id ? 'var(--gold)' : undefined }} onClick={() => setDifficulty(d.id)}>
                      <div className="font-bold">{d.icon} {d.name}</div>
                      <div className="text-[11px] muted">{d.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="card flex flex-col items-center text-center gap-3">
              <Caricature spec={{ ...baseLook, ...look.spec }} size={130} tie={PARTIES.find((p) => p.id === partyId)?.color} />
              <div className="font-black text-lg">{name || (gender === 'f' ? 'דנה פוליטיקאית' : 'דני פוליטיקאי')}</div>
              <div className="chip chip-gold">{ROLES.find((r) => r.id === role)?.title}</div>
              <div className="text-sm muted">{partyName || PARTIES.find((p) => p.id === partyId)?.name}</div>
              <div className="inset text-xs text-right w-full flex gap-2 items-start">
                <Caricature spec={ADVISOR_SPEC} size={34} />
                <span>"היי, אני מוטי ספין, היועץ שלך. אני לא מחליט כלום, אבל אני תמיד צודק."</span>
              </div>
              <button className="btn btn-primary btn-lg w-full mt-auto" onClick={start}>🪑 לשבת על הכיסא</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
