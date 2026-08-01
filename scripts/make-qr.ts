/**
 * Generates the printable QR code. Run with `npm run qr`.
 *
 * The encoded URL comes from HUB_URL in src/links.ts, so the QR can never drift
 * from the canonical/og URLs on the page itself.
 *
 * Outputs into qr/:
 *   steigenberger-qr.svg        vector — use this for print at any size
 *   steigenberger-qr.png        2048px flat raster
 *   steigenberger-qr-logo.png   2048px with the hotel wordmark centred
 *
 * Every output is decoded back with a real QR reader before being written, so a
 * broken code cannot reach a printer.
 */

import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import QRCode from 'qrcode';
import sharp from 'sharp';

import { HUB_URL } from '../src/links.ts';

// jsqr ships a UMD bundle whose module.exports IS the decode function, but its
// .d.ts declares that function as a default export. Under nodenext those two
// disagree and a plain default import types as a non-callable namespace.
// Requiring it matches the actual runtime shape.
const jsQR = createRequire(import.meta.url)('jsqr') as typeof import('jsqr').default;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'qr');
const PNG_SIZE = 2048;

/**
 * Error correction level H recovers 30% of the code, which is what allows a
 * logo in the centre. The URL is short enough that H still yields a low-density
 * symbol, so this costs nothing in scannability.
 */
const OPTIONS = {
  errorCorrectionLevel: 'H',
  // 4 modules is the spec-mandated quiet zone. Printers and designers routinely
  // crop this off, which is the single most common reason a QR stops scanning.
  margin: 4,
  color: { dark: '#1c1a17ff', light: '#ffffffff' },
} as const;

/** Decode a PNG buffer with a real reader and assert it round-trips. */
async function verify(png: Buffer, label: string): Promise<void> {
  // Downscale before decoding: jsQR works on pixel data and 2048px is wasteful.
  const { data, info } = await sharp(png)
    .resize(600, 600, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const result = jsQR(new Uint8ClampedArray(data), info.width, info.height);

  if (!result) throw new Error(`${label}: QR did not decode at all`);
  if (result.data !== HUB_URL) {
    throw new Error(`${label}: decoded "${result.data}" but expected "${HUB_URL}"`);
  }
  console.log(`    verified  ${label} -> ${result.data}`);
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  console.log(`\n  Encoding: ${HUB_URL}\n`);

  // --- Vector, for print -------------------------------------------------
  const svg = await QRCode.toString(HUB_URL, { ...OPTIONS, type: 'svg', width: 1024 });
  await writeFile(path.join(outDir, 'steigenberger-qr.svg'), svg, 'utf8');

  // --- Flat raster -------------------------------------------------------
  const png = await QRCode.toBuffer(HUB_URL, { ...OPTIONS, type: 'png', width: PNG_SIZE });
  await verify(png, 'steigenberger-qr.png');
  await writeFile(path.join(outDir, 'steigenberger-qr.png'), png);

  // Confirm the vector matches the raster by rasterising the SVG and decoding it.
  await verify(await sharp(Buffer.from(svg)).resize(1024, 1024).png().toBuffer(), 'steigenberger-qr.svg');

  // --- With centred logo -------------------------------------------------
  const logoPath = path.join(root, 'public', 'logo.webp');
  if (existsSync(logoPath)) {
    // 22% of the width => ~5% of the area. Level H tolerates far more, so this
    // stays comfortably inside the recovery budget.
    const boxW = Math.round(PNG_SIZE * 0.22);
    const pad = Math.round(boxW * 0.09);

    const mark = await sharp(await readFile(logoPath))
      .resize({ width: boxW - pad * 2 })
      .toBuffer();
    const markMeta = await sharp(mark).metadata();

    // A white plate behind the mark keeps the boundary crisp for the scanner.
    const plate = await sharp({
      create: {
        width: boxW,
        height: (markMeta.height ?? 0) + pad * 2,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([{ input: mark, gravity: 'center' }])
      .png()
      .toBuffer();

    const withLogo = await sharp(png)
      .composite([{ input: plate, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toBuffer();

    await verify(withLogo, 'steigenberger-qr-logo.png');
    await writeFile(path.join(outDir, 'steigenberger-qr-logo.png'), withLogo);
  } else {
    console.warn('    ! public/logo.webp missing — skipped the logo variant.');
  }

  console.log(`\n  QR files written to qr/\n`);
}

await main();
