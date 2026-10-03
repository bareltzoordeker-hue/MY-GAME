// Converts the captured PNG screenshots to WebP in two widths, and compresses the OG image.
// Run: npm run assets:optimize (after dropping new PNG captures into public/images/screens)
import sharp from 'sharp';
import { readdirSync, statSync, unlinkSync } from 'node:fs';

const dir = 'public/images/screens';
for (const f of readdirSync(dir).filter((x) => x.endsWith('.png'))) {
  const base = f.replace('.png', '');
  const src = `${dir}/${f}`;
  const meta = await sharp(src).metadata();
  const widths = base === 'mobile' ? [390] : [1366, 720];
  for (const w of widths) {
    const out = `${dir}/${base}-${w}.webp`;
    await sharp(src).resize({ width: Math.min(w, meta.width) }).webp({ quality: 78 }).toFile(out);
    console.log(out, `${(statSync(out).size / 1024).toFixed(0)}KB`);
  }
  unlinkSync(src); // the PNG source is not shipped
}
const og = 'public/og-image.png';
const tmp = 'public/og-image.tmp.png';
await sharp(og).png({ compressionLevel: 9, palette: true, quality: 85 }).toFile(tmp);
unlinkSync(og);
await sharp(tmp).toFile(og);
unlinkSync(tmp);
console.log(og, `${(statSync(og).size / 1024).toFixed(0)}KB`);
