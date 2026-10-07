import { afterAll, describe, expect, it } from 'vitest';
import { createGame } from '../engine/newGame';
import { advanceTurn } from '../engine/turn';
import { PARTIES } from './parties';
import { PEOPLE } from './people';
import { castDictionary, getCast, realNames, setCast } from './cast';

const HEB = /[֐-׿]/;
afterAll(() => setCast('real'));

describe('the cast switch', () => {
  it('real is the default and the real names are kept', () => {
    expect(getCast()).toBe('real');
    expect(PEOPLE.find((p) => p.id === 'likud_1')!.name).toBe('בנימין נתניהו');
  });

  it('fictional replaces every politician and party name, uniquely, and keeps the structure', () => {
    const before = { people: PEOPLE.length, parties: PARTIES.length, ids: PEOPLE.map((p) => p.id).join() };
    setCast('fictional');
    expect(PEOPLE.length).toBe(before.people);
    expect(PARTIES.length).toBe(before.parties);
    expect(PEOPLE.map((p) => p.id).join()).toBe(before.ids);
    const names = PEOPLE.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    expect(PEOPLE.find((p) => p.id === 'likud_1')!.name).toBe('בנצי כסאי');
    expect(PEOPLE.find((p) => p.id === 'bluewhite_1')!.name).toBe('אלוף (מיל.) דני דרגות');
    expect(PEOPLE.find((p) => p.id === 'amcha_1')!.name).toBe('זלמן ותיקי');
    expect(PARTIES.find((p) => p.id === 'utj')!.name).toBe('אגודת הקוגל המאוחדת');
    expect(PEOPLE.find((p) => p.id === 'utj_1')!.name).toBe('הרב משולם קוגלמן');
  });

  it('no real politician name or party name survives inside a fictional game', () => {
    setCast('fictional');
    const real = ['likud', 'yashar', 'utj', 'democrats', 'reservists'].map((id) => PEOPLE.find((p) => p.id === `${id}_1`)!.id);
    expect(real.length).toBeGreaterThan(0);
    const s = createGame({ playerName: 'בודק', gender: 'm', difficulty: 'normal', seed: 3, role: 'pm', partyId: 'likud', cast: 'fictional' });
    const json = JSON.stringify(s);
    const originals = realNames();
    const leaked = originals.filter((n) => json.includes(n));
    expect(leaked, `real names leaked into the game: ${leaked.slice(0, 5).join(', ')}`).toEqual([]);
    for (const party of ['הליכוד', 'יהדות התורה', 'הציונות הדתית', 'ישראל ביתנו']) expect(json.includes(party), party).toBe(false);
    for (const surname of ['נתניהו', 'ליברמן', 'דרעי', 'סמוטריץ', 'בן גביר', 'איזנקוט', 'עבאס', 'הנדל', 'גנץ']) expect(json.includes(surname), surname).toBe(false);
    expect(s.cast).toBe('fictional');
  });

  it('stays free of real names after several turns of play', () => {
    setCast('fictional');
    let s = createGame({ playerName: 'בודק', gender: 'm', difficulty: 'normal', seed: 5, role: 'pm', partyId: 'likud', cast: 'fictional' });
    for (let i = 0; i < 6; i++) s = advanceTurn(s);
    const json = JSON.stringify(s);
    const leaked = realNames().filter((n) => json.includes(n));
    expect(leaked, `leaked: ${leaked.slice(0, 5).join(', ')}`).toEqual([]);
    for (const surname of ['נתניהו', 'ליברמן', 'דרעי', 'סמוטריץ', 'בן גביר', 'איזנקוט', 'עבאס', 'הנדל', 'גנץ']) expect(json.includes(surname), surname).toBe(false);
  });

  it('English and Arabic exist for every fictional name', () => {
    setCast('fictional');
    const d = castDictionary();
    for (const p of PEOPLE) {
      expect(d.en[p.name], p.name).toBeTruthy();
      expect(d.ar[p.name], p.name).toBeTruthy();
      expect(HEB.test(d.en[p.name]) || HEB.test(d.ar[p.name]), p.name).toBe(false);
    }
    for (const p of PARTIES) expect(d.en[p.name], p.name).toBeTruthy();
  });

  it('switching back restores the real data exactly', () => {
    setCast('fictional');
    setCast('real');
    expect(PEOPLE.find((p) => p.id === 'likud_1')!.name).toBe('בנימין נתניהו');
    expect(PARTIES.find((p) => p.id === 'likud')!.name).toBe('הליכוד');
    expect(PEOPLE.find((p) => p.id === 'democrats_1')!.gender).toBe('m');
  });
});
