/**
 * Verifies every link in the manifest still resolves, and reports how long each
 * destination takes to respond. Run with `npm run check`.
 *
 * Also reports whether each same-site destination is sending the
 * Supports-Loading-Mode header, so you can confirm the .htaccess change landed
 * (see htaccess-snippet.txt).
 */

import { ALL_LINKS, isSameSite } from '../src/links.ts';

const TIMEOUT_MS = 20_000;
const HEADER = 'supports-loading-mode';

interface Result {
  label: string;
  url: string;
  status: number | string;
  ms: number;
  sameSite: boolean;
  optedIn: boolean;
}

async function check(label: string, url: string): Promise<Result> {
  const sameSite = isSameSite(url);
  const started = performance.now();

  try {
    // GET rather than HEAD: some shared hosts answer HEAD with 405.
    // redirect: 'follow' so a 301 to www/https still counts as reachable.
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'User-Agent': 'steigenberger-links-checker' },
    });
    // Drain the body so the socket closes cleanly.
    await res.arrayBuffer();

    return {
      label,
      url,
      status: res.status,
      ms: Math.round(performance.now() - started),
      sameSite,
      optedIn: (res.headers.get(HEADER) ?? '').includes('credentialed-prerender'),
    };
  } catch (err) {
    return {
      label,
      url,
      status: err instanceof Error ? err.name : 'ERROR',
      ms: Math.round(performance.now() - started),
      sameSite,
      optedIn: false,
    };
  }
}

async function main(): Promise<void> {
  console.log(`\n  Checking ${ALL_LINKS.length} links...\n`);

  const results = await Promise.all(ALL_LINKS.map((l) => check(l.label, l.href)));

  let broken = 0;
  let missingHeader = 0;

  for (const r of results) {
    const ok = typeof r.status === 'number' && r.status >= 200 && r.status < 400;
    if (!ok) broken++;

    let note = '';
    if (r.sameSite) {
      if (r.optedIn) {
        note = 'prerender: ON';
      } else {
        note = 'prerender: OFF (add .htaccess header)';
        missingHeader++;
      }
    } else {
      note = 'third-party, preconnect only';
    }

    console.log(
      `  ${ok ? 'ok ' : 'XX '} ${String(r.status).padEnd(6)} ${String(r.ms + 'ms').padStart(7)}  ` +
        `${r.label.padEnd(28)} ${note}`,
    );
  }

  console.log('');
  if (broken > 0) {
    console.error(`  ${broken} link(s) failed to load.\n`);
    process.exitCode = 1;
  } else {
    console.log('  All links reachable.');
  }

  if (missingHeader > 0) {
    console.log(
      `  ${missingHeader} same-site link(s) not yet opted in to prerendering — ` +
        `see htaccess-snippet.txt.\n`,
    );
  } else {
    console.log('  All same-site links opted in to prerendering.\n');
  }
}

await main();
