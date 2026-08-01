/**
 * Builds the hub into a single self-contained dist/index.html.
 *
 * Run with `npm run build` (Node 24 executes TypeScript directly — no compile step).
 */

import { readFile, writeFile, mkdir, readdir, copyFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import path from 'node:path';

import { renderPage } from '../src/template.ts';
import { ALL_LINKS, prerenderableUrls, preconnectOrigins } from '../src/links.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const publicDir = path.join(root, 'public');

/**
 * Conservative CSS minifier: strips comments and collapses whitespace only.
 * Deliberately does not touch selectors or values — the few hundred bytes a
 * more aggressive pass would save are not worth a silent visual regression.
 */
function minifyCss(css: string): string {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s*\n\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
}

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

/** Inline the logo so the page stays a single request. */
async function loadLogo(): Promise<string | undefined> {
  for (const name of ['logo.webp', 'logo.png', 'logo.svg', 'logo.jpg']) {
    const file = path.join(publicDir, name);
    if (!existsSync(file)) continue;

    const buf = await readFile(file);
    const mime = MIME[path.extname(name).toLowerCase()] ?? 'image/png';

    if (buf.byteLength > 40_000) {
      console.warn(
        `  ! ${name} is ${(buf.byteLength / 1024).toFixed(1)}KB — inlining it will bloat the ` +
          `page. Consider compressing to under 40KB.`,
      );
    }
    return `data:${mime};base64,${buf.toString('base64')}`;
  }

  console.warn('  ! No public/logo.* found — falling back to a text monogram.');
  return undefined;
}

async function copyPublic(): Promise<number> {
  if (!existsSync(publicDir)) return 0;

  let count = 0;
  for (const entry of await readdir(publicDir, { withFileTypes: true })) {
    // Skip every logo*: logo.webp is inlined into the HTML, and logo-source.jpg
    // is a build input for `npm run assets`. Neither should be deployed.
    if (!entry.isFile() || entry.name.startsWith('logo')) continue;
    await copyFile(path.join(publicDir, entry.name), path.join(dist, entry.name));
    count++;
  }
  return count;
}

async function main(): Promise<void> {
  await mkdir(dist, { recursive: true });

  const css = minifyCss(await readFile(path.join(root, 'src', 'styles.css'), 'utf8'));
  const logoDataUri = await loadLogo();

  const html = renderPage({ css, logoDataUri });
  const out = path.join(dist, 'index.html');
  await writeFile(out, html, 'utf8');

  const copied = await copyPublic();
  const { size } = await stat(out);

  // Transfer size is what the guest actually waits for; Vercel serves brotli.
  const buf = Buffer.from(html, 'utf8');
  const gzip = gzipSync(buf, { level: 9 }).byteLength;
  const brotli = brotliCompressSync(buf, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  }).byteLength;

  const kb = (n: number): string => `${(n / 1024).toFixed(1)} KB`;

  console.log('\n  Built dist/index.html');
  console.log(`    raw           ${kb(size)}`);
  console.log(`    gzip          ${kb(gzip)}`);
  console.log(`    brotli        ${kb(brotli)}   <- actual transfer size`);
  console.log(`    links         ${ALL_LINKS.length}`);
  console.log(`    preconnect    ${preconnectOrigins().length} origins`);
  console.log(`    prerender     ${prerenderableUrls().length} same-site URLs`);
  console.log(`    static files  ${copied} copied\n`);

  // Budget is set on the compressed size. 10KB brotli keeps the whole page
  // inside a single initial congestion window, so it arrives in one round trip.
  if (brotli > 10_240) {
    console.warn(`  ! Over the 10KB brotli budget — check what grew.\n`);
  }
}

await main();
