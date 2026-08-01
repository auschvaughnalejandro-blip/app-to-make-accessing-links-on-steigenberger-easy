# Steigenberger Hotel Doha — Guest Services Hub

One QR code that opens a single page linking to all eight guest services, built
so that tapping a link feels instant.

```
npm install
npm run build     # -> dist/index.html   (6.4 KB brotli, single request)
npm run dev       # preview at http://localhost:4173
npm run qr        # -> qr/*.svg + *.png  (generate AFTER the domain is live)
npm run check     # verify all 8 links resolve + prerender opt-in status
npm run typecheck # TypeScript 7 (tsgo)
```

---

## How the speed actually works

The eight destinations are not fast. Measured sequentially from a cold connection:

| Destination | TTFB | Notes |
| --- | --- | --- |
| 6 × `*.steigenbergerhoteldoha.com` | 1.4–2.8s | WordPress / Apache / Bluehost shared |
| `hrewards.com` | 0.64s | third party |
| `app.getalacarte.com` | 1.1s | third party, client-rendered SPA |

Nothing on the hub page can make WordPress respond faster. What it *can* do is
remove the waiting from the guest's experience, in three layers:

**1. The hub itself is effectively free.** One static file, no framework, no web
fonts, no blocking JS, logo inlined as a data URI. 7.5 KB gzip (6.4 KB brotli) —
small enough to arrive in a single network round trip. Served as a flat file by
Apache, it answers in ~0.72s on the existing Bluehost account, versus ~1.97s for
the same content rendered through WordPress.

**2. `preconnect` — works in every browser.** DNS lookup and TLS handshake cost
~0.5s per destination. The hub opens those connections while the guest is still
reading, so that cost is already paid by the time they tap. Applies to all eight
links plus `i0.wp.com`, the CDN the WordPress sites serve images from.

**3. Speculation Rules `prerender` — the big one, Chromium only.** Six of the
links are subdomains of `steigenbergerhoteldoha.com`. Because the hub lives on
that same registrable domain, the browser is permitted to load and fully render
those pages *before* the tap. When the guest clicks, the page is already there —
0ms. Set to `eagerness: "moderate"`, so it triggers on hover (desktop) or
touchstart (mobile) rather than prerendering six 1–2 MB pages on load and
burning guest mobile data.

> **Same-site is decided by registrable domain, not by server.** It makes no
> difference whether the hub is served by Bluehost, Vercel, or anything else —
> only that it sits on `steigenbergerhoteldoha.com`.

### The limitation, stated plainly

**Prerendering is Chromium-only.** Safari and Firefox have not shipped the
Speculation Rules API. On iOS *every* browser uses WebKit, so iPhone guests get
layers 1 and 2 (~0.5s saved, instant hub, tap feedback) but **not** 0ms clicks.
Android Chrome and desktop Chrome/Edge get the full effect.

There is no workaround from the hub side. The only lever that would help iOS
guests is making the WordPress sites themselves faster.

**Layer 3 also requires a one-line change to the six WordPress sites** — see
[htaccess-snippet.txt](htaccess-snippet.txt). Until it is applied, those links
silently fall back to layer 2. Nothing breaks; they just aren't instant.
Run `npm run check` to see the current opt-in status of each.

---

## Project layout

```
src/links.ts       SINGLE SOURCE OF TRUTH — all 8 links, sections, hub URL
src/icons.ts       inline SVG icon paths
src/styles.css     inlined into <head> at build time
src/template.ts    HTML generator
scripts/build.ts       -> dist/index.html
scripts/make-qr.ts     -> qr/  (decodes each output to verify before writing)
scripts/make-assets.ts logo + icon variants from public/logo-source.jpg
scripts/check-links.ts link + header health check
scripts/serve.ts       local preview server
vercel.json            static deploy + cache/security headers
htaccess-snippet.txt   the WordPress opt-in, with instructions
```

### Editing the links

`src/links.ts` is the only file to touch. Adding a link there automatically
wires up its card, its `preconnect` hint, and — if it is on
`steigenbergerhoteldoha.com` — its prerender rule. They cannot drift apart
because they are all derived from the same array.

```ts
{
  id: 'gym',
  label: 'Fitness Centre',
  description: 'Opening hours and facilities',
  href: 'https://gym.steigenbergerhoteldoha.com/',
  icon: 'spa',
}
```

Then `npm run build`. No QR regeneration needed — the QR points at the hub, not
at individual links, which is the whole point of it.

---

## Deployment

Hosting on the existing Bluehost account — see
[hub-htaccess.txt](hub-htaccess.txt) for the full walkthrough and the Apache
config.

1. **Create the subdomain.** In cPanel, add `links.steigenbergerhoteldoha.com`
   with its own document root. **Do not install WordPress on it.** The apex
   `steigenbergerhoteldoha.com` 301s to `hrewards.com/en`, so a subdomain is
   required.

2. **Upload `dist/` and the `.htaccess`.** Run `npm run build`, upload the
   contents of `dist/` to the document root, and add the `.htaccess` block from
   `hub-htaccess.txt`.

   > **Upload it as a static file — never paste it into a WordPress page.**
   > Measured on their own server: a static file answers in ~0.72s, a WordPress
   > page in ~1.29s TTFB / ~1.97s total, plus several hundred KB of theme and
   > plugin assets. This one choice matters more than every other optimisation
   > here combined.

3. **Apply the other `.htaccess` snippet** — [htaccess-snippet.txt](htaccess-snippet.txt) —
   to the six WordPress sites. That is the prerendering opt-in, and is a
   different file from the one in step 2.

4. **The QR is already generated** and encodes the permanent URL above, so it
   needs no action here. Re-run `npm run qr` only if `HUB_URL` in
   `src/links.ts` ever changes.

5. **Verify** — `npm run check` should show all eight reachable and all six
   same-site links opted in.

---

## The QR code

Already generated in `qr/`, all encoding
`https://links.steigenbergerhoteldoha.com/`. Re-run `npm run qr` only if
`HUB_URL` changes — the QR points at the hub, never at individual links, so
adding or reordering services never invalidates it.

| File | Use |
| --- | --- |
| `steigenberger-qr.svg` | **print** — vector, scales to any size |
| `steigenberger-qr.png` | 2048px flat raster, digital use |
| `steigenberger-qr-logo.png` | 2048px with the wordmark centred |

- Error correction **level H** (30% recovery), which is what allows the centre
  logo. The URL is short, so the symbol stays low-density and easy to scan.
- The 4-module quiet zone is preserved. **Do not crop it** — cropping the white
  border is the most common reason a printed QR stops scanning.
- Each file is decoded with a real QR reader during generation and the build
  fails if it does not round-trip, so a broken code cannot reach a printer.
- No tracking parameters, keeping the URL short and permanent.

Before a print run, scan the actual proof with both an iPhone and an Android
camera, at ~1m and ~3m.

---

## Notes

- **Logo.** `public/logo-source.jpg` is the only asset available — a flat JPEG
  wordmark with no transparency. The circular badge is therefore light in both
  themes on purpose; a dark badge would show a white block behind the mark. If
  you have the original vector, drop it in as `public/logo.svg` and re-run
  `npm run assets` — the build prefers it automatically.
- **No framework, deliberately.** React or Next.js would add ~90 KB of JS and a
  hydration pass to an eight-link page, making it strictly slower.
- **JavaScript is optional.** The only script shows a progress bar so a slow
  destination does not look like a dead tap. With JS disabled, all eight links
  work normally.
- **Accessibility.** ≥44px tap targets, WCAG AA contrast, visible focus rings,
  `prefers-reduced-motion` honoured, external links announced to screen readers.
- **Links open in the same tab** — a prerendered page can only be activated by a
  same-tab navigation, so `target="_blank"` would discard the entire benefit.

### Not included

- Arabic / RTL version (the spa site is bilingual; this hub is English-only)
- Analytics on link clicks
- Any change to the WordPress sites beyond the one response header
