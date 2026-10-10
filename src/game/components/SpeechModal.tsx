import { useEffect, useState } from 'react';
import { useGame } from '../store/gameStore';
import { TONES, TOPICS, TOPIC_BY_ID, VENUES, writeSpeechLines, type Tone, type Venue } from '../../engine/speech';
import { translate } from '../../shared/i18n/contentTranslator';
import { checkAction } from '../../engine/decisions';
import { GROUPS } from '../../data/world';
import type { GroupId } from '../../types/game';

export const openSpeech = () => window.dispatchEvent(new Event('open-speech'));

/** Speech editor: venue, topic, stance, tone, audience – write it yourself or let the generator draft it. */
export function SpeechModal() {
  const s = useGame((x) => x.game);
  const act = useGame((x) => x.act);
  const [open, setOpen] = useState(false);
  const [venue, setVenue] = useState<Venue>('tv');
  const [topic, setTopic] = useState(TOPICS[0].id);
  const [stance, setStance] = useState(0);
  const [tone, setTone] = useState<Tone>('statesman');
  const [audience, setAudience] = useState<GroupId | ''>('');
  const [text, setText] = useState('');
  useEffect(() => {
    const o = () => setOpen(true);
    window.addEventListener('open-speech', o);
    return () => window.removeEventListener('open-speech', o);
  }, []);
  if (!s || !open) return null;
  const t = TOPIC_BY_ID[topic];
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const params = { venue, topic, stance: stance / 100, tone, audience, words };
  const blocked = checkAction(s, 'give_speech', params);
  const close = () => setOpen(false);
  return (
    <div className="backdrop" onClick={close}>
      <div className="modal modal-wide" role="dialog" aria-label="כתיבת נאום" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--line)' }}>
          <div className="text-xs font-bold" style={{ color: 'var(--gold)' }}>🎤 נאום</div>
          <div className="text-xl font-black">מה תגיד לציבור?</div>
          <p className="text-sm muted mt-1">הבמה, הנושא, העמדה והטון קובעים מי יאהב את הדברים ומי יתנגד. אפשר לכתוב לבד או לבקש טיוטה.</p>
        </div>
        <div className="p-5 grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="block text-sm"><span className="label">במה</span>
              <select className="w-full" value={venue} onChange={(e) => setVenue(e.target.value as Venue)}>{(Object.keys(VENUES) as Venue[]).map((v) => <option key={v} value={v}>{VENUES[v].icon} {VENUES[v].name}</option>)}</select>
            </label>
            <label className="block text-sm"><span className="label">נושא</span>
              <select className="w-full" value={topic} onChange={(e) => setTopic(e.target.value)}>{TOPICS.map((x) => <option key={x.id} value={x.id}>{x.icon} {x.name}</option>)}</select>
            </label>
            <div className="text-sm">
              <span className="label">העמדה שלך</span>
              {/* the slider box is LTR on purpose: in a right-to-left page the browser flips the track, so the labels would sit on the wrong ends */}
              <div dir="ltr">
                <input type="range" min={-100} max={100} step={5} value={stance} onChange={(e) => setStance(Number(e.target.value))} className="w-full" aria-label={`עמדה: מ"${t.con}" (שמאל) ועד "${t.pro}" (ימין)`} />
                <div className="flex justify-between text-[11px] muted gap-2">
                  <span dir="rtl" className="text-left">◀ {t.con}</span>
                  <span dir="rtl" className="text-right">{t.pro} ▶</span>
                </div>
              </div>
            </div>
            <label className="block text-sm"><span className="label">טון</span>
              <select className="w-full" value={tone} onChange={(e) => setTone(e.target.value as Tone)}>{(Object.keys(TONES) as Tone[]).map((x) => <option key={x} value={x}>{TONES[x].name} – {TONES[x].desc}</option>)}</select>
            </label>
            <label className="block text-sm"><span className="label">קהל יעד (לא חובה)</span>
              <select className="w-full" value={audience} onChange={(e) => setAudience(e.target.value as GroupId | '')}><option value="">כלל הציבור</option>{GROUPS.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}</select>
            </label>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="label">הנאום ({words} מילים)</span>
              <button className="btn btn-sm btn-blue" data-tut="speech-write" onClick={() => setText(writeSpeechLines({ venue, topic, stance: stance / 100, tone, audience }).map((l) => translate(l) ?? l).join(' '))} data-tip="טיוטה אוטומטית לפי הבמה, הנושא, העמדה והטון. אפשר לערוך אותה.">✍️ כתוב לי</button>
            </div>
            <textarea data-tut="speech-text" aria-label="טקסט הנאום" value={text} onChange={(e) => setText(e.target.value)} rows={12} className="w-full flex-1" style={{ background: 'var(--bg2, #fff)', border: '1px solid var(--line2, #ddd)', borderRadius: 10, padding: 10, resize: 'vertical' }} placeholder="כתוב כאן את הנאום, או לחץ על 'כתוב לי'." />
            <div className="text-[11px] muted">נאום קצר מ-25 מילים לא משאיר רושם; נאום ארוך מ-450 מילים מאבד את הקהל.</div>
          </div>
        </div>
        <div className="p-4 pt-0 flex justify-between gap-2 flex-wrap items-center">
          <button className="btn btn-sm" data-tut="speech-cancel" onClick={close}>ביטול</button>
          {blocked && <span className="text-xs bad">⛔ {blocked}</span>}
          <button className="btn btn-primary" disabled={!!blocked || !text.trim()} onClick={() => { act('give_speech', params); close(); setText(''); }}>🎤 לשאת את הנאום</button>
        </div>
      </div>
    </div>
  );
}
