// Synthesised sound (Web Audio) — no audio files needed.
// Effects + a cheeky "political march" loop. Both can be muted; the choice is remembered.

type Sfx = 'hover' | 'click' | 'good' | 'bad' | 'info' | 'turn' | 'alarm' | 'breaking' | 'cash' | 'gavel' | 'news' | 'stamp';

const KEY = 'hakise.sound';
interface Prefs { sfx: boolean; music: boolean }
const load = (): Prefs => { try { return { sfx: true, music: true, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { sfx: true, music: true }; } };
let prefs = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { /* ignore */ } };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
// Browsers refuse (and log a warning) if an AudioContext is created before the first user gesture,
// e.g. by a hover sound on the main menu. Stay silent until the player clicks or presses a key.
let activated = false;
if (typeof window !== 'undefined') {
  const on = () => { activated = true; };
  window.addEventListener('pointerdown', on, { capture: true, once: true });
  window.addEventListener('keydown', on, { capture: true, once: true });
}
function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    if (!activated) return null;
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.12, slideTo?: number) {
  const c = ac();
  if (!c || !master) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g).connect(master);
  o.start(c.currentTime + start);
  o.stop(c.currentTime + start + dur + 0.02);
}

function noise(start: number, dur: number, vol = 0.2, hp = 800) {
  const c = ac();
  if (!c || !master) return;
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = hp;
  const g = c.createGain();
  g.gain.value = vol;
  src.connect(f).connect(g).connect(master);
  src.start(c.currentTime + start);
}

export function play(s: Sfx): void {
  if (!prefs.sfx) return;
  switch (s) {
    case 'hover': tone(1500, 0, 0.025, 'sine', 0.025); break;
    case 'click': tone(700, 0, 0.05, 'square', 0.05, 1100); break;
    case 'good': [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.14, 'square', 0.07)); break;
    case 'bad': tone(330, 0, 0.18, 'sawtooth', 0.08); tone(220, 0.16, 0.35, 'sawtooth', 0.08, 140); break; // sad trombone-ish
    case 'info': tone(660, 0, 0.08, 'triangle', 0.08); tone(880, 0.08, 0.1, 'triangle', 0.08); break;
    case 'turn': noise(0, 0.35, 0.12, 1500); tone(200, 0, 0.35, 'triangle', 0.06, 600); break; // page flip + whoosh
    case 'alarm': for (let i = 0; i < 3; i++) { tone(880, i * 0.36, 0.18, 'square', 0.07); tone(660, i * 0.36 + 0.18, 0.18, 'square', 0.07); } break;
    case 'breaking': [0, 0.14, 0.28].forEach((t) => tone(1046, t, 0.1, 'square', 0.09)); tone(523, 0.45, 0.5, 'sawtooth', 0.08, 392); noise(0.45, 0.3, 0.06); break;
    case 'cash': tone(1318, 0, 0.06, 'square', 0.06); tone(1760, 0.06, 0.2, 'square', 0.06); noise(0, 0.08, 0.05, 4000); break;
    case 'gavel': noise(0, 0.07, 0.35, 200); tone(120, 0, 0.12, 'sine', 0.2, 60); noise(0.18, 0.07, 0.35, 200); tone(120, 0.18, 0.12, 'sine', 0.2, 60); break;
    case 'news': [784, 988, 1175, 988].forEach((f, i) => tone(f, i * 0.09, 0.09, 'triangle', 0.07)); break;
    case 'stamp': noise(0, 0.12, 0.4, 150); tone(90, 0, 0.15, 'sine', 0.25, 50); break;
  }
}


// ---------- "blah blah" voices (gibberish speech, Animal-Crossing style) ----------
export interface Voice { pitch: number; wave: OscillatorType; speed: number }
export function voiceFor(gender: 'm' | 'f', seed: number, ego = 0.5): Voice {
  const base = gender === 'f' ? 1.45 : 0.95;
  return { pitch: base + ((seed % 17) / 17 - 0.5) * 0.35, wave: ego > 0.7 ? 'sawtooth' : seed % 2 ? 'square' : 'triangle', speed: 0.85 + (seed % 5) * 0.06 };
}
/** Plays gibberish for a line of text. Returns its duration in ms. */
export function babble(text: string, v: Voice): number {
  if (!prefs.sfx) return Math.min(1600, text.length * 35);
  const c = ac();
  if (!c) return 0;
  const syll = Math.max(3, Math.min(16, Math.round(text.length / 4)));
  const step = 0.085 / v.speed;
  for (let i = 0; i < syll; i++) {
    const vowel = [1, 1.12, 0.9, 1.25, 1.05][(text.charCodeAt(i * 3 % text.length) ?? 0) % 5];
    const f = 210 * v.pitch * vowel * (i === syll - 1 ? 0.85 : 1);
    tone(f, i * step, step * 0.8, v.wave, 0.045, f * (Math.random() > 0.5 ? 1.15 : 0.9));
  }
  return Math.round(syll * step * 1000) + 120;
}

// ---------- background music: cheeky "cabinet march" ----------
// C – Am – F – G progression, oom-pah bass, arpeggio, light drums.
let musicTimer: number | null = null;
let step = 0;
const CHORDS = [[262, 330, 392], [220, 262, 330], [175, 220, 262], [196, 247, 294]];
const LEAD = [523, 0, 587, 659, 0, 587, 523, 494, 440, 0, 494, 523, 587, 0, 523, 0, 392, 0, 440, 494, 0, 523, 587, 659, 698, 0, 659, 587, 523, 0, 494, 0];
function kick(t = 0) { const c = ac(); if (!c || !master) return; const o = c.createOscillator(); const g = c.createGain(); o.frequency.setValueAtTime(140, c.currentTime + t); o.frequency.exponentialRampToValueAtTime(45, c.currentTime + t + 0.12); g.gain.setValueAtTime(0.18, c.currentTime + t); g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + t + 0.15); o.connect(g).connect(master); o.start(c.currentTime + t); o.stop(c.currentTime + t + 0.16); }
function musicTick() {
  if (!prefs.music) return;
  const bar = Math.floor(step / 8) % CHORDS.length;
  const chord = CHORDS[bar];
  const beat = step % 8;
  if (beat % 4 === 0) { tone(chord[0] / 2, 0, 0.22, 'triangle', 0.07); kick(); }
  if (beat % 4 === 2) { chord.forEach((f) => tone(f, 0, 0.12, 'square', 0.012)); noise(0, 0.05, 0.035, 6000); }
  if (beat % 2 === 1) noise(0, 0.03, 0.02, 9000);
  const lead = LEAD[step % LEAD.length];
  if (lead) tone(lead, 0.01, 0.16, 'square', 0.018);
  step++;
}
export function startMusic() {
  if (musicTimer !== null || !prefs.music) return;
  if (!ac()) return;
  musicTimer = window.setInterval(musicTick, 150);
}
export function stopMusic() {
  if (musicTimer !== null) window.clearInterval(musicTimer);
  musicTimer = null;
}

export const soundPrefs = () => ({ ...prefs });
export function setSfx(on: boolean) { prefs = { ...prefs, sfx: on }; save(); if (on) play('info'); }
export function setMusic(on: boolean) { prefs = { ...prefs, music: on }; save(); if (on) startMusic(); else stopMusic(); }
