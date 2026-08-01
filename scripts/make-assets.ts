/**
 * One-off asset preparation. Run with `npm run assets`.
 *
 * Takes the hotel wordmark (public/logo-source.jpg — 807x402 JPEG on white with
 * heavy padding) and produces the trimmed, compressed variants the page needs:
 *
 *   public/logo.webp          inlined into the HTML as a data URI
 *   public/apple-touch-icon.png   180x180, iOS home screen
 *   public/icon-192.png / icon-512.png   web app manifest
 *
 * Re-run this if the source logo is replaced. If you have the original vector,
 * drop it in as public/logo.svg and the build will prefer it automatically.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = path.join(root, 'public');
const source = path.join(publicDir, 'logo-source.jpg');

/** Background of the icon tiles — matches --surface in the light theme. */
const TILE_BG = { r: 255, g: 255, b: 254, alpha: 1 };

async function main(): Promise<void> {
  if (!existsSync(source)) {
    console.error(`  x Missing ${path.relative(root, source)}`);
    process.exitCode = 1;
    return;
  }

  const src = await readFile(source);

  // The wordmark sits in a large white field. Trimming it lets the mark itself
  // fill the circular badge instead of floating in the middle of it.
  const trimmed = await sharp(src).trim({ threshold: 10 }).toBuffer();
  const meta = await sharp(trimmed).metadata();
  console.log(`  trimmed to ${meta.width}x${meta.height} (from 807x402)`);

  // Inlined logo. The badge renders ~84px wide, so 256px covers 3x displays.
  // Going wider costs real bytes for no visible gain — it is base64'd into the
  // HTML, where every byte is on the critical path.
  const logo = await sharp(trimmed)
    .resize({ width: 256, withoutEnlargement: true })
    .webp({ quality: 88, effort: 6 })
    .toBuffer();
  await writeFile(path.join(publicDir, 'logo.webp'), logo);
  console.log(`  logo.webp            ${(logo.byteLength / 1024).toFixed(1)} KB`);

  // Square icons: the wordmark padded onto a tile, since a wide mark cropped to
  // a square would be unreadable.
  for (const size of [180, 192, 512]) {
    const inner = Math.round(size * 0.82);
    const mark = await sharp(trimmed).resize({ width: inner, withoutEnlargement: false }).toBuffer();

    const png = await sharp({
      create: { width: size, height: size, channels: 4, background: TILE_BG },
    })
      .composite([{ input: mark, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    const name = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
    await writeFile(path.join(publicDir, name), png);
    console.log(`  ${name.padEnd(20)} ${(png.byteLength / 1024).toFixed(1)} KB`);
  }

  console.log('\n  Assets ready.\n');
}

await main();
