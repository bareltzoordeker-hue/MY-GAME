import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Terms from the old fictional / satirical world that must not return in v2. */
const FORBIDDEN = ['צבריה', 'מוטי ספין', 'ערוץ 12.5', 'ירושלמה', 'אילתיה', 'בועת המרכז', 'גמל-נט', 'טוקבק', 'אל תתרגש', 'סאטירי'];

function walk(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) { if (n !== 'node_modules') walk(p, out); } else if (/\.(ts|tsx|html)$/.test(n)) out.push(p);
  }
  return out;
}

describe('v2 cleanup', () => {
  it('no source or page text uses the old fictional-world terms', () => {
    const root = process.cwd(); // the project folder
    const files = [...walk(join(root, 'src')), ...walk(join(root, 'pages'))].filter((f) => !f.endsWith('cleanup.test.ts'));
    const hits: string[] = [];
    for (const f of files) {
      const txt = readFileSync(f, 'utf8');
      for (const w of FORBIDDEN) if (txt.includes(w)) hits.push(`${f}: ${w}`);
    }
    expect(hits).toEqual([]);
  });
});
