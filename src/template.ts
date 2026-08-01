import {
  ALL_LINKS,
  HOTEL_NAME,
  HOTEL_TAGLINE,
  HUB_URL,
  SECTIONS,
  isSameSite,
  preconnectOrigins,
  prerenderableUrls,
} from './links.ts';
import { ICONS } from './icons.ts';

/** Escape for HTML text nodes and double-quoted attribute values. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Serialise JSON for embedding in a <script> block.
 * Escaping `<` prevents a value containing "</script" from closing the element early.
 */
function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function renderIcon(name: keyof typeof ICONS): string {
  return (
    `<span class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" focusable="false">${ICONS[name]}</svg></span>`
  );
}

function renderSections(): string {
  return SECTIONS.map((section) => {
    const items = section.links
      .map((link) => {
        const external = !isSameSite(link.href);

        // Third-party destinations get noopener; same-site ones are ours.
        // Nothing uses target="_blank" — a prerendered page can only be
        // activated by a same-tab navigation, so opening a new tab would
        // throw away the entire speed benefit.
        const rel = external ? ' rel="noopener"' : '';

        const badge = external
          ? `<span class="card-ext" aria-hidden="true">↗</span>` +
            `<span class="sr-only"> (opens an external site)</span>`
          : '';

        const desc = link.description
          ? `<span class="card-desc">${esc(link.description)}</span>`
          : '';

        return (
          `<li><a class="card" id="link-${esc(link.id)}" href="${esc(link.href)}"${rel}>` +
          `${renderIcon(link.icon)}` +
          `<span class="card-text">` +
          `<span class="card-title">${esc(link.label)}${badge}</span>${desc}` +
          `</span></a></li>`
        );
      })
      .join('');

    return (
      `<section class="section"><h2>${esc(section.heading)}</h2>` +
      `<ul class="links">${items}</ul></section>`
    );
  }).join('');
}

/**
 * Warm the TCP + TLS connection to every destination while the guest is still
 * reading the page. Measured at ~0.5s per origin on these hosts, and unlike
 * prerendering this works in every browser.
 */
function renderPreconnect(): string {
  return preconnectOrigins()
    .map(
      (origin) =>
        `<link rel="preconnect" href="${esc(origin)}" crossorigin>` +
        `<link rel="dns-prefetch" href="${esc(origin)}">`,
    )
    .join('');
}

/**
 * Speculation Rules — the part that makes clicks genuinely instant.
 *
 * Only same-site URLs are listed; browsers refuse to prerender fully cross-site
 * targets. Each target must also answer with
 *   Supports-Loading-Mode: credentialed-prerender
 * or the browser discards the prerender and falls back to a normal navigation
 * (no error, just not instant) — see htaccess-snippet.txt.
 *
 * eagerness "moderate" fires on hover / touchstart rather than on page load.
 * These WordPress pages are 1-2MB each; prerendering all six eagerly would burn
 * guest mobile data and compete with the hub's own load.
 *
 * Chromium-only. Safari and Firefox ignore this block and keep the preconnect
 * benefit above.
 */
function renderSpeculationRules(): string {
  const urls = prerenderableUrls();
  if (urls.length === 0) return '';

  const rules = { prerender: [{ urls, eagerness: 'moderate' }] };
  return `<script type="speculationrules">${safeJson(rules)}</script>`;
}

/** Structured data so the hub can surface sensibly if it is ever shared or indexed. */
function renderJsonLd(): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Hotel',
    name: HOTEL_NAME,
    description: HOTEL_TAGLINE,
    url: HUB_URL,
    address: { '@type': 'PostalAddress', addressLocality: 'Doha', addressCountry: 'QA' },
    sameAs: ALL_LINKS.map((l) => l.href),
  };
  return `<script type="application/ld+json">${safeJson(data)}</script>`;
}

/**
 * The only JavaScript on the page. Purely cosmetic: shows a progress bar so a
 * slow destination does not look like a dead tap. Wrapped in a guard so any
 * failure leaves plain working links behind.
 */
const TAP_FEEDBACK_JS = `
try{
var p=document.getElementById('progress'),t;
function go(a){if(!p)return;p.classList.add('on');a.classList.add('is-loading');
clearTimeout(t);t=setTimeout(function(){p.classList.remove('on');a.classList.remove('is-loading')},12000);}
document.addEventListener('click',function(e){
var a=e.target.closest&&e.target.closest('a.card');
if(!a||e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;go(a);},{passive:true});
window.addEventListener('pageshow',function(){if(p)p.classList.remove('on');
var l=document.querySelector('.card.is-loading');if(l)l.classList.remove('is-loading');});
}catch(_){}`.trim();

export interface RenderOptions {
  /** Inlined logo as a data URI. Falls back to a text monogram when absent. */
  readonly logoDataUri?: string | undefined;
  readonly css: string;
}

export function renderPage(opts: RenderOptions): string {
  const logo = opts.logoDataUri
    ? `<img src="${opts.logoDataUri}" alt="" width="256" height="80" decoding="async">`
    : `<span style="font:700 1.5rem/1 system-ui;letter-spacing:.06em">SHD</span>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(HOTEL_NAME)} — Guest Services</title>
<meta name="description" content="Quick access to guest services at ${esc(HOTEL_NAME)}: guest directory, dining, spa, offers, transport, excursions, TV guide and pillow menu.">
<link rel="canonical" href="${esc(HUB_URL)}">
<meta name="theme-color" content="#f4f1ec" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#14130f" media="(prefers-color-scheme: dark)">
<meta name="color-scheme" content="light dark">
<meta property="og:type" content="website">
<meta property="og:title" content="${esc(HOTEL_NAME)} — Guest Services">
<meta property="og:description" content="All guest services in one place.">
<meta property="og:url" content="${esc(HUB_URL)}">
<meta name="twitter:card" content="summary">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
${renderPreconnect()}
<style>${opts.css}</style>
</head>
<body>
<div id="progress"></div>
<div class="wrap">
<header class="header">
<div class="logo">${logo}</div>
<h1>${esc(HOTEL_NAME)}</h1>
<p class="tagline">${esc(HOTEL_TAGLINE)}</p>
</header>
<main>
${renderSections()}
</main>
<footer class="footer"><p>&copy; ${new Date().getFullYear()} ${esc(HOTEL_NAME)}</p></footer>
</div>
${renderSpeculationRules()}
${renderJsonLd()}
<script>${TAP_FEEDBACK_JS}</script>
</body>
</html>`;
}
