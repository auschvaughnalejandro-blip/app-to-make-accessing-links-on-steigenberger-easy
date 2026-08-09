# Steigenberger Hotel Doha — Guest Services Hub

One QR code that opens a single page linking to all eight guest services, built
so that tapping a link feels instant.

This is a **plain static site** — one `index.html` file plus a handful of
image files. No build step, no Node, no npm install. Open `index.html` in any
text editor, edit it, save it, upload it. That's the whole workflow.

To preview a change, just double-click `index.html` to open it in a browser,
or drag the file onto an open browser window.

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
fonts, no blocking JS. ~10 KB gzip — small enough to arrive in a single network
round trip. Served as a flat file by Apache, it answers in ~0.72s on the
existing Bluehost account, versus ~1.97s for the same content rendered through
WordPress.

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

---

## Project layout

```
index.html             The entire site: markup, CSS, and JS in one file
favicon.svg             ┐
apple-touch-icon.png     │
icon-192.png             │ referenced directly by index.html — upload as-is
icon-512.png             │
site.webmanifest         │
logo.webp               ┘
logo-source.jpg         Original JPEG the logo variants came from (not deployed)
qr/                     Pre-generated QR code, see below
hub-htaccess.txt        Apache config for hosting the hub itself
htaccess-snippet.txt    The WordPress opt-in, applied to the 6 hotel subdomains
```

There is nothing to build. Everything you upload is everything in this
repository except `logo-source.jpg`, `README.md`, and the two `.txt` files
(those three are reference material, not part of the deployed site).

### Editing the links

Open `index.html` and find the `<!-- LINK CARDS -->` comment inside `<main>` —
that section explains what to do inline, but the short version:

**Adding a card that links to `*.steigenbergerhoteldoha.com`** (same-site,
eligible for the instant-tap effect):
1. Copy an existing `<li>...</li>` card block and edit the `href`, icon, title,
   and description.
2. Add its origin to the `<link rel="preconnect">` block in `<head>`.
3. Add its full URL to the `"urls"` array in the `<script
   type="speculationrules">` block near the bottom of the file.

**Adding a card that links anywhere else** (a different domain entirely, like
the existing Restaurants and Deals cards):
1. Copy a card block and edit it.
2. Add `rel="noopener"` to the `<a>` tag.
3. Copy the "opens an external site" badge from the Restaurants or Deals card.
4. Optionally add its origin to `preconnect`. Do **not** add it to
   `speculationrules` — browsers refuse to prerender a fully cross-site
   destination, so it would do nothing.

**Adding a social link at the bottom:** copy one of the three `<a
class="social-link">` blocks in the footer and edit the `href`, `aria-label`,
and icon.

There's no automatic check that these stay in sync — that trade-off was
deliberate, see "Why one plain file" below. Save, upload, done.

---

## Deployment

Hosting on the existing Bluehost account — see
[hub-htaccess.txt](hub-htaccess.txt) for the full walkthrough and the Apache
config.

1. **Create the subdomain.** In cPanel, add `links.steigenbergerhoteldoha.com`
   with its own document root. **Do not install WordPress on it.** The apex
   `steigenbergerhoteldoha.com` 301s to `hrewards.com/en`, so a subdomain is
   required.

2. **Upload everything in this folder** (except `README.md`, `logo-source.jpg`,
   and the two `.txt` files) to that document root, and add the `.htaccess`
   block from `hub-htaccess.txt`.

   > **Upload it as a static file — never paste it into a WordPress page.**
   > Measured on their own server: a static file answers in ~0.72s, a WordPress
   > page in ~1.29s TTFB / ~1.97s total, plus several hundred KB of theme and
   > plugin assets. This one choice matters more than every other optimisation
   > here combined.

3. **Apply the other `.htaccess` snippet** — [htaccess-snippet.txt](htaccess-snippet.txt) —
   to the six WordPress sites. That is the prerendering opt-in, and is a
   different file from the one in step 2.

4. **The QR is already generated** and encodes the permanent URL below, so it
   needs no action here — see "The QR code" below for when it *would* need
   regenerating.

5. **Verify** — open `https://links.steigenbergerhoteldoha.com/` on a phone,
   confirm the page loads and all eight cards go somewhere real. Scan the
   printed QR too.

---

## The QR code

Already generated in `qr/`, all encoding
`https://links.steigenbergerhoteldoha.com/`.

| File | Use |
| --- | --- |
| `steigenberger-qr.svg` | **print** — vector, scales to any size |
| `steigenberger-qr.png` | 2048px flat raster, digital use |
| `steigenberger-qr-logo.png` | 2048px with the wordmark centred |

- Error correction **level H** (30% recovery), which is what allows the centre
  logo.
- The 4-module quiet zone is preserved. **Do not crop it** — cropping the white
  border is the most common reason a printed QR stops scanning.
- No tracking parameters, keeping the URL short and permanent.

**It never needs regenerating just because a link changed** — the QR points at
the hub page itself, not at any individual service, so adding, removing, or
reordering cards never invalidates it.

**The only thing that would invalidate it** is if the hub's own address
(`https://links.steigenbergerhoteldoha.com/`) ever changed — a different
subdomain, a different domain entirely. That should be rare (once, maybe,
ever). If it happens: any QR code generator can encode the new URL — scan the
result with two different phones before sending it to print, and don't crop
the white border. There's no need to keep tooling in this repo for something
you'll do once every few years.

Before a print run, scan the actual proof with both an iPhone and an Android
camera, at ~1m and ~3m.

---

## Notes

- **Logo.** `logo-source.jpg` is the original flat JPEG wordmark, kept for
  reference only — it is not uploaded. `logo.webp`, referenced by
  `index.html`, is the version actually shown on the page. The circular badge
  behind it is light in both themes on purpose: the source has no
  transparency, so a dark badge would show a white block behind the mark. If
  you get a transparent vector logo later, swap in `logo.webp` (same
  filename) and it'll drop in with no other changes needed.
- **No framework, deliberately.** React or Next.js would add ~90 KB of JS and a
  hydration pass to an eight-link page, making it strictly slower.
- **JavaScript is optional.** The only script shows a progress bar so a slow
  destination does not look like a dead tap. With JS disabled, all eight links
  work normally.
- **Accessibility.** ≥44px tap targets, WCAG AA contrast, visible focus rings,
  `prefers-reduced-motion` honoured, external links announced to screen readers.
- **Links open in the same tab** — a prerendered page can only be activated by a
  same-tab navigation, so `target="_blank"` would discard the entire benefit.
  The social links at the bottom follow the same rule for consistency, since
  they're supplementary, not the main task a guest came to do.

### Why one plain file

This used to be a small TypeScript + Node build pipeline: a data file for the
links, a template that generated the HTML, and scripts that generated the QR
code and checked that every link resolved. That bought a few real things — the
preconnect hints and prerender rules couldn't drift out of sync with the
cards, and a broken QR code couldn't reach a printer.

It also meant needing Node and `npm install` just to change a link's label, on
a project that ships as a single static file with no server-side code at all.
For a page maintained by hand and updated rarely, that trade-off wasn't worth
it — so the guardrails were traded for a file anyone can open and edit
directly, with no install step. The cost is that the three places mentioned
above (card, preconnect, speculation rules) need to be updated by hand instead
of being derived automatically. For a page that changes a few times a year,
that's a fine trade.

### Not included

- Arabic / RTL version (the spa site is bilingual; this hub is English-only)
- Analytics on link clicks
- Any change to the WordPress sites beyond the one response header
