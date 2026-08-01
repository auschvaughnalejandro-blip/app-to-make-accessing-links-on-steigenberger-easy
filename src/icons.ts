import type { IconName } from './links.ts';

/**
 * Inline stroke icons, 24x24. Kept as bare path markup so the template can wrap
 * them in a single shared <svg> shell — no icon font, no sprite request.
 *
 * They are decorative: the card's text carries the meaning, so the wrapper sets
 * aria-hidden and screen readers skip them entirely.
 */
export const ICONS: Record<IconName, string> = {
  directory:
    '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',

  pillow:
    '<path d="M3.5 8.5C3.5 6.6 5 5 7 5h10c2 0 3.5 1.6 3.5 3.5v7c0 1.9-1.5 3.5-3.5 3.5H7c-2 0-3.5-1.6-3.5-3.5z"/><path d="M7 9c3.2 1.3 6.8 1.3 10 0"/><path d="M7 15c3.2-1.3 6.8-1.3 10 0"/>',

  tv: '<rect x="2" y="7" width="20" height="13" rx="2"/><path d="m17 2-5 5-5-5"/>',

  dining:
    '<path d="M6 2v6a2 2 0 0 0 2 2 2 2 0 0 0 2-2V2"/><path d="M8 10v12"/><path d="M17 2c1.4 2 2 4.5 2 7s-.9 4-2 4-2-1.5-2-4 .6-5 2-7z"/><path d="M17 13v9"/>',

  offers:
    '<path d="M20.59 13.41 13.42 20.58a2 2 0 0 1-2.83 0L2 12V2h10z"/><circle cx="7" cy="7" r="1.25"/>',

  spa: '<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',

  excursions: '<path d="m1 6 7-3 8 3 7-3v15l-7 3-8-3-7 3z"/><path d="M8 3v15"/><path d="M16 6v15"/>',

  limousine:
    '<path d="M5 17H3v-5l2-5h14l2 5v5h-2"/><path d="M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/>',
};
