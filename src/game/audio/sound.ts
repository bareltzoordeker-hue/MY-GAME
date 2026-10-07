// Synthesised sound (Web Audio) — no audio files needed.
// Restrained interface sounds + a calm ambient score. Both can be muted; the choice is remembered.

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
    case 'hover': tone(1400, 0, 0.02, 'sine', 0.015); break;
    case 'click': tone(880, 0, 0.05, 'sine', 0.04); break;
    case 'good': [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.35, 'sine', 0.05)); break;
    case 'bad': tone(392, 0, 0.4, 'sine', 0.05); tone(311, 0.12, 0.55, 'sine', 0.05); break;
    case 'info': tone(660, 0, 0.18, 'sine', 0.045); tone(880, 0.1, 0.22, 'sine', 0.035); break;
    case 'turn': noise(0, 0.25, 0.04, 2500); tone(220, 0, 0.5, 'sine', 0.04, 330); break;
    case 'alarm': for (let i = 0; i < 2; i++) tone(740, i * 0.45, 0.35, 'sine', 0.06, 620); break;
    case 'breaking': [0, 0.18].forEach((t) => tone(880, t, 0.14, 'sine', 0.06)); tone(440, 0.4, 0.6, 'sine', 0.05); break;
    case 'cash': tone(1046, 0, 0.12, 'sine', 0.04); tone(1318, 0.08, 0.2, 'sine', 0.035); break;
    case 'gavel': noise(0, 0.05, 0.2, 300); tone(130, 0, 0.14, 'sine', 0.12, 80); break;
    case 'news': [659, 784, 988].forEach((f, i) => tone(f, i * 0.11, 0.16, 'sine', 0.04)); break;
    case 'stamp': noise(0, 0.08, 0.15, 250); tone(110, 0, 0.14, 'sine', 0.1, 70); break;
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

// ---------- background music: calm ambient score ----------
// Slow minor progression (Dm – Bb – F – C) on soft sine pads, with a sparse melody.
let musicTimer: number | null = null;
let step = 0;
const CHORDS = [[147, 175, 220], [117, 147, 175], [175, 220, 262], [131, 165, 196]];
const MELODY = [587, 0, 523, 0, 466, 0, 440, 0, 523, 0, 587, 0, 698, 0, 659, 0];
function pad(freq: number, dur: number, vol: number) {
  const c = ac();
  if (!c || !master) return;
  for (const detune of [-4, 4]) {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    o.detune.value = detune;
    g.gain.setValueAtTime(0.0001, c.currentTime);
    g.gain.exponentialRampToValueAtTime(vol, c.currentTime + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
    o.connect(g).connect(master);
    o.start();
    o.stop(c.currentTime + dur + 0.05);
  }
}
function musicTick() {
  if (!prefs.music) return;
  const chord = CHORDS[Math.floor(step / 2) % CHORDS.length];
  if (step % 2 === 0) chord.forEach((f) => pad(f, 3.4, 0.018));
  const m = MELODY[step % MELODY.length];
  if (m) tone(m, 0.2, 1.2, 'sine', 0.012);
  step++;
}
export function startMusic() {
  if (musicTimer !== null || !prefs.music) return;
  if (!ac()) return;
  musicTick();
  musicTimer = window.setInterval(musicTick, 1700);
}
export function stopMusic() {
  if (musicTimer !== null) window.clearInterval(musicTimer);
  musicTimer = null;
}

export const soundPrefs = () => ({ ...prefs });
export function setSfx(on: boolean) { prefs = { ...prefs, sfx: on }; save(); if (on) play('info'); }
export function setMusic(on: boolean) { prefs = { ...prefs, music: on }; save(); if (on) startMusic(); else stopMusic(); }
