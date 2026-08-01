/**
 * SINGLE SOURCE OF TRUTH for the guest services hub.
 *
 * Everything downstream is derived from this file:
 *   - the rendered link cards
 *   - the <link rel="preconnect"> hints        (all origins)
 *   - the <script type="speculationrules">     (same-site origins only)
 *
 * Adding a link here automatically wires up all three, so the speculation
 * hints can never drift out of sync with what is actually on the page.
 */

/** Registrable domain of the hub. Links sharing it are "same-site" and can be prerendered. */
export const SITE_DOMAIN = 'steigenbergerhoteldoha.com';

/** Canonical public URL of the hub. This is what the printed QR code encodes. */
export const HUB_URL = 'https://links.steigenbergerhoteldoha.com/';

export const HOTEL_NAME = 'Steigenberger Hotel Doha';
export const HOTEL_TAGLINE =
  'The flagship hotel of H World International in GCC, under one of its renowned brands, Steigenberger Resorts & Hotels.';

/** Icon keys map to inline SVG paths in `src/icons.ts`. */
export type IconName =
  | 'directory'
  | 'dining'
  | 'offers'
  | 'pillow'
  | 'spa'
  | 'limousine'
  | 'excursions'
  | 'tv';

export interface HubLink {
  /** Stable id, used for the DOM id and analytics later. */
  readonly id: string;
  /** Card title. Keep short — it must not wrap on a 320px screen. */
  readonly label: string;
  /** Secondary line under the title. Optional. */
  readonly description?: string;
  readonly href: string;
  readonly icon: IconName;
}

export interface HubSection {
  readonly heading: string;
  readonly links: readonly HubLink[];
}

export const SECTIONS: readonly HubSection[] = [
  {
    heading: 'Your Stay',
    links: [
      {
        id: 'directory',
        label: 'Guest Directory',
        description: 'Hotel services, facilities & contacts',
        href: 'https://directory.steigenbergerhoteldoha.com/',
        icon: 'directory',
      },
      {
        id: 'pillow-menu',
        label: 'Pillow Menu',
        description: 'Choose your perfect pillow',
        href: 'https://pillowmenu.steigenbergerhoteldoha.com/',
        icon: 'pillow',
      },
      {
        id: 'tv-guide',
        label: 'TV Guide',
        description: '100 channels available in your room',
        href: 'https://tv.steigenbergerhoteldoha.com/',
        icon: 'tv',
      },
    ],
  },
  {
    heading: 'Dining & Offers',
    links: [
      {
        id: 'restaurants',
        label: 'Restaurants & Dine Out',
        description: 'Browse menus and order',
        href: 'https://app.getalacarte.com/#/app/dineout/restaurantcollection/steigenberger-hotel-doha',
        icon: 'dining',
      },
      {
        id: 'deals',
        label: 'Deals & Packages',
        description: 'Current offers and staycations',
        href: 'https://hrewards.com/en/steigenberger-hotel-doha/deals',
        icon: 'offers',
      },
    ],
  },
  {
    heading: 'Wellness & Leisure',
    links: [
      {
        id: 'spa',
        label: 'The Opal Spa',
        description: 'Luxury urban spa treatments',
        href: 'https://spa.steigenbergerhoteldoha.com/',
        icon: 'spa',
      },
      {
        id: 'excursions',
        label: 'Excursions',
        description: 'Tours and activities around Doha',
        href: 'https://excursions.steigenbergerhoteldoha.com/',
        icon: 'excursions',
      },
    ],
  },
  {
    heading: 'Getting Around',
    links: [
      {
        id: 'limousine',
        label: 'Airport Shuttle & Limousine',
        description: 'Transfers and chauffeur service',
        href: 'https://limousine.steigenbergerhoteldoha.com/',
        icon: 'limousine',
      },
    ],
  },
] as const;

/**
 * Extra origins worth a preconnect even though nothing links to them directly.
 * The WordPress sites serve their images through Jetpack's CDN, so warming that
 * connection shaves the handshake off the destination's largest paint too.
 */
export const EXTRA_PRECONNECT_ORIGINS: readonly string[] = ['https://i0.wp.com'];

// ---------------------------------------------------------------------------
// Derived data — do not hand-maintain any of this.
// ---------------------------------------------------------------------------

export const ALL_LINKS: readonly HubLink[] = SECTIONS.flatMap((s) => s.links);

/** Origin of a URL, e.g. "https://spa.steigenbergerhoteldoha.com". */
export function originOf(url: string): string {
  return new URL(url).origin;
}

/**
 * True when `url` shares the hub's registrable domain.
 *
 * Same-site (not same-origin) is what the Speculation Rules API requires for
 * cross-origin prerendering. Matching is anchored on a leading dot so that a
 * lookalike domain such as "evilsteigenbergerhoteldoha.com" cannot pass.
 */
export function isSameSite(url: string): boolean {
  const { hostname } = new URL(url);
  return hostname === SITE_DOMAIN || hostname.endsWith(`.${SITE_DOMAIN}`);
}

/** Unique origins across every link, plus the extras. Order is stable. */
export function preconnectOrigins(): readonly string[] {
  return [...new Set([...ALL_LINKS.map((l) => originOf(l.href)), ...EXTRA_PRECONNECT_ORIGINS])];
}

/**
 * URLs eligible for prerendering: same-site only.
 *
 * Fully cross-site targets (hrewards.com, app.getalacarte.com) are excluded —
 * browsers do not permit prerendering them at all, so listing them would be
 * dead weight in the rules payload.
 */
export function prerenderableUrls(): readonly string[] {
  return ALL_LINKS.filter((l) => isSameSite(l.href)).map((l) => l.href);
}
