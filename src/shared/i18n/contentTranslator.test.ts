import { describe, expect, it, beforeAll } from 'vitest';
import { translate, load } from './contentTranslator';
import en from './content.en';
import ar from './content.ar';
import { PATTERNS } from './patterns';
import { EXTRA_PATTERNS } from './patterns.extra';

const HEB = /[֐-׿]/;

beforeAll(async () => {
  await load('en');
  await load('ar');
});

describe('content dictionaries', () => {
  it('have the same keys in English and Arabic', () => {
    expect(Object.keys(ar).sort()).toEqual(Object.keys(en).sort());
  });

  it('contain no Hebrew in the translated values', () => {
    const bad = (d: Record<string, string>) => Object.entries(d).filter(([, v]) => HEB.test(v)).map(([k]) => k);
    expect(bad(en)).toEqual([]);
    expect(bad(ar)).toEqual([]);
  });

  it('patterns use the same placeholders in all three languages', () => {
    const ph = (s: string) => [...s.matchAll(/\{#?(\d)\}/g)].map((m) => m[1]).sort().join();
    for (const [he, e, a] of [...PATTERNS, ...EXTRA_PATTERNS]) {
      expect(ph(e), he).toBe(ph(he));
      expect(ph(a), he).toBe(ph(he));
    }
  });
});

describe('translate()', () => {
  it('translates exact strings and keeps surrounding whitespace', () => {
    expect(translate('  הליכוד ', 'en')).toBe('  Likud ');
  });

  it('fills sentence patterns with translated values', () => {
    const out = translate('תקציב 2027 עוד לא אושר. אם הוא לא יעבור בזמן, הכנסטון יתפזר ויתקיימו בחירות.', 'en');
    expect(out).toContain('2027');
    expect(out).not.toMatch(HEB);
  });

  it('translates "label · value" lists piece by piece', () => {
    const out = translate('הליכוד · מומחיות 65 · Loyalty 53', 'en');
    expect(out).not.toMatch(HEB);
    expect(out).toContain('65');
  });

  it('does not let a general pattern swallow an untranslatable sentence', () => {
    // contains Hebrew nothing in the dictionary knows – it must stay as it is, not turn into a half-translated mix
    expect(translate('משפט שלא קיים באף מילון בעולם הזה', 'en')).toBeNull();
  });

  it('translates the conversation lines, including a nested complaint', () => {
    expect(translate('שלום. מה תרצה לדבר עליו?', 'en')).toBe('Hello. What would you like to talk about?');
    const out = translate('תודה שהקשבת. המשרד שלי לא עומד במשימות בתקציב הנוכחי. אני מצפה לתוספת תקציב לתחום. מה אתה מציע?', 'ar');
    expect(out).not.toMatch(HEB);
    expect(out).toContain('شكرًا لأنك استمعت');
  });

  it('leaves Hebrew alone', () => {
    expect(translate('הליכוד', 'he')).toBeNull();
  });
});
