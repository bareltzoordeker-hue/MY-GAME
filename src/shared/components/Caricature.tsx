import type { CSSProperties } from 'react';
import type { CaricatureSpec } from '../../types/game';

/**
 * Procedural bobble-head caricature: big swaying head, blinking eyes, tiny suit.
 * Same props as before, so it can be swapped for real illustrations later.
 */
export function Caricature({ spec, size = 64, tie, mood, still }: { spec: CaricatureSpec; size?: number; tie?: string; mood?: 'good' | 'bad'; still?: boolean }) {
  const s = spec;
  const noseR = 7 + s.nose * 9;
  const earR = 8 + s.ears * 7;
  const mouth = mood === 'bad' ? 'frown' : mood === 'good' ? 'smile' : s.mouth;
  const hairC = s.hairColor;
  const seed = Math.round((s.nose * 7 + s.ears * 13) * 100) % 100;
  const style = { '--d': `${-(seed / 100) * 3.6}s`, '--ry': `${seed % 2 ? 18 : -18}deg`, width: size, height: size } as CSSProperties;
  const bg = mood === 'bad' ? ['#ffe0e5', '#ffb3c0'] : mood === 'good' ? ['#dcfbe9', '#a8ecc7'] : ['#efeaff', '#cfc4ff'];
  const gid = `bg${seed}${mood ?? ''}`;
  return (
    <span className="cari" style={style}>
      <svg width={size} height={size} viewBox="0 0 120 120" role="img" aria-hidden>
        <defs>
          <radialGradient id={gid} cx="50%" cy="30%" r="75%">
            <stop offset="0" stopColor={bg[0]} />
            <stop offset="1" stopColor={bg[1]} />
          </radialGradient>
          <radialGradient id={`sk${seed}`} cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#fff" stopOpacity=".35" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="58" fill={`url(#${gid})`} />
        {/* body */}
        <g>
          <path d="M20 122 Q22 90 60 88 Q98 90 100 122 Z" fill={s.suit} />
          <path d="M48 89 L60 104 L72 89 Z" fill="#f4f4f4" />
          <path d="M56.5 95 L60 117 L63.5 95 L60 92 Z" fill={tie ?? '#c0392b'} />
        </g>
        <g className={still ? '' : 'cari-head'}>
          <circle cx="25" cy="56" r={earR} fill={s.skin} stroke="rgba(0,0,0,.18)" strokeWidth="1.5" />
          <circle cx="95" cy="56" r={earR} fill={s.skin} stroke="rgba(0,0,0,.18)" strokeWidth="1.5" />
          {s.hair === 'long' && <path d="M22 48 Q18 92 34 96 L86 96 Q102 92 98 48 Q92 10 60 10 Q28 10 22 48Z" fill={hairC} />}
          <ellipse cx="60" cy="53" rx="36" ry="40" fill={s.skin} stroke="rgba(0,0,0,.2)" strokeWidth="1.5" />
          <ellipse cx="60" cy="53" rx="36" ry="40" fill={`url(#sk${seed})`} />
          {s.beard === 'stubble' && <path d="M30 63 Q34 92 60 94 Q86 92 90 63 Q80 79 60 81 Q40 79 30 63Z" fill={hairC} opacity=".35" />}
          {s.beard === 'full' && <path d="M27 56 Q29 97 60 99 Q91 97 93 56 Q83 81 60 83 Q37 81 27 56Z" fill={hairC} />}
          {s.beard === 'long' && <path d="M27 56 Q27 114 60 118 Q93 114 93 56 Q83 83 60 85 Q37 83 27 56Z" fill={hairC} />}
          {s.hair === 'comb' && <path d="M24 46 Q28 12 62 12 Q92 14 96 42 Q76 22 38 31 Q28 35 24 46Z" fill={hairC} />}
          {s.hair === 'grey' && <path d="M24 52 Q20 26 33 26 Q29 44 31 54Z M96 52 Q100 26 87 26 Q91 44 89 54Z" fill="#dcdcdc" />}
          {s.hair === 'curly' && <g fill={hairC}>{[28, 40, 52, 64, 76, 88].map((x, i) => <circle key={i} cx={x} cy={22 + (i % 2) * 5} r="12" />)}</g>}
          {s.hair === 'spiky' && <path d="M24 42 L30 13 L41 31 L49 7 L58 27 L66 5 L74 27 L85 10 L89 31 L98 18 L96 44 Q60 27 24 42Z" fill={hairC} />}
          {s.hair === 'bun' && <g fill={hairC}><circle cx="60" cy="8" r="12" /><path d="M24 48 Q26 14 60 14 Q94 14 96 48 Q80 27 60 27 Q40 27 24 48Z" /></g>}
          {s.hair === 'long' && <path d="M24 48 Q26 14 60 14 Q94 14 96 48 Q78 25 60 27 Q42 25 24 48Z" fill={hairC} />}
          {s.hair === 'kippah' && <g><path d="M28 44 Q28 14 60 14 Q92 14 92 44 Q60 31 28 44Z" fill={hairC} /><ellipse cx="62" cy="15" rx="16" ry="6.5" fill="#2b4fa8" /></g>}
          {s.hair === 'hat' && <g fill="#111"><ellipse cx="60" cy="26" rx="48" ry="8.5" /><path d="M30 26 Q30 -2 60 -2 Q90 -2 90 26Z" /><rect x="30" y="18" width="60" height="5" fill="#333" /></g>}
          {s.hair === 'beret' && <g><path d="M22 33 Q32 3 72 7 Q100 11 96 31 Q60 23 22 33Z" fill="#7a1f2f" /><circle cx="85" cy="20" r="4.5" fill="#ffc53d" /></g>}
          {s.brows === 'angry' && <g stroke="#2b1a0e" strokeWidth="4.5" strokeLinecap="round"><line x1="36" y1="38" x2="52" y2="44" /><line x1="84" y1="38" x2="68" y2="44" /></g>}
          {s.brows === 'worried' && <g stroke="#2b1a0e" strokeWidth="4.5" strokeLinecap="round"><line x1="36" y1="43" x2="52" y2="37" /><line x1="84" y1="43" x2="68" y2="37" /></g>}
          {s.brows === 'flat' && <g stroke="#2b1a0e" strokeWidth="4.5" strokeLinecap="round"><line x1="36" y1="40" x2="52" y2="40" /><line x1="68" y1="40" x2="84" y2="40" /></g>}
          <g className={still ? '' : 'cari-eyes'}>
            <ellipse cx="45" cy="52" rx="7.5" ry="8" fill="white" stroke="rgba(0,0,0,.15)" /><ellipse cx="75" cy="52" rx="7.5" ry="8" fill="white" stroke="rgba(0,0,0,.15)" />
            <circle cx="46.5" cy="53.5" r="3.6" fill="#1a1a1a" /><circle cx="73.5" cy="53.5" r="3.6" fill="#1a1a1a" />
            <circle cx="47.6" cy="52.2" r="1.2" fill="#fff" /><circle cx="74.6" cy="52.2" r="1.2" fill="#fff" />
          </g>
          {s.glasses && <g fill="rgba(180,220,255,.18)" stroke="#111" strokeWidth="2.6"><circle cx="45" cy="52" r="11" /><circle cx="75" cy="52" r="11" /><line x1="56" y1="52" x2="64" y2="52" /></g>}
          <ellipse cx="60" cy={65} rx={noseR * 0.78} ry={noseR} fill={s.skin} stroke="rgba(0,0,0,.25)" strokeWidth="1.5" />
          <ellipse cx="57" cy={60} rx={noseR * 0.25} ry={noseR * 0.3} fill="#fff" opacity=".35" />
          {mouth === 'smile' && <path d="M42 79 Q60 96 78 79" stroke="#5a1c1c" strokeWidth="3.5" fill="#8a2a2a" strokeLinecap="round" />}
          {mouth === 'smirk' && <path d="M45 82 Q63 87 78 75" stroke="#5a1c1c" strokeWidth="3.8" fill="none" strokeLinecap="round" />}
          {mouth === 'open' && <ellipse cx="60" cy="82" rx="10" ry="7" fill="#5a1c1c" />}
          {mouth === 'frown' && <path d="M45 86 Q60 75 75 86" stroke="#5a1c1c" strokeWidth="3.8" fill="none" strokeLinecap="round" />}
          <circle cx="33" cy="68" r="6" fill="#ff6b6b" opacity=".28" /><circle cx="87" cy="68" r="6" fill="#ff6b6b" opacity=".28" />
        </g>
      </svg>
      {size >= 56 && <span className="cari-shadow" />}
    </span>
  );
}

export const ADVISOR_SPEC: CaricatureSpec = {
  skin: '#e8b48a', hair: 'spiky', hairColor: '#111827', glasses: true, beard: 'stubble', nose: 0.6, mouth: 'smirk', suit: '#0f172a', brows: 'flat', ears: 0.4,
};
