import { describe, expect, it } from 'vitest';
import { STEPS, UI } from './Tutorial';

const HEB = /[֐-׿]/;
const ARB = /[؀-ۿ]/;

describe('interactive tutorial', () => {
  it('has unique step ids and texts in all three languages', () => {
    expect(new Set(STEPS.map((s) => s.id)).size).toBe(STEPS.length);
    for (const s of STEPS) {
      for (const f of [s.title, s.text]) {
        expect(f.he.trim(), s.id).not.toBe('');
        expect(f.en.trim(), s.id).not.toBe('');
        expect(f.ar.trim(), s.id).not.toBe('');
        expect(HEB.test(f.en) || HEB.test(f.ar), `${s.id}: Hebrew inside a translation`).toBe(false);
        expect(ARB.test(f.he) || ARB.test(f.en), `${s.id}: Arabic inside another language`).toBe(false);
      }
    }
    for (const [k, v] of Object.entries(UI)) {
      expect(v.he && v.en && v.ar, k).toBeTruthy();
      expect(HEB.test(v.en) || HEB.test(v.ar), k).toBe(false);
    }
  });

  it('forces a press on every step that is not just reading', () => {
    for (const s of STEPS) {
      if (s.until) expect(s.target, `${s.id} waits for a press but points at nothing`).toBeTypeOf('function');
      else expect(s.target, `${s.id} is a reading step`).toBeUndefined();
    }
  });

  it('covers the main screens and ends by moving the turn forward', () => {
    const ids = STEPS.map((s) => s.id).join(' ');
    for (const k of ['capital-open', 'interview', 'nav-economy', 'nav-parliament', 'chat-send', 'speech-write', 'next-turn']) expect(ids).toContain(k);
    expect(STEPS.at(-1)!.id).toBe('done');
  });
});
