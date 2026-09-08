import localFont from 'next/font/local';

/**
 * The curated set a premium commenter can pick from. Six faces chosen to feel
 * worth paying for and to stay legible at comment size -- a high-contrast
 * serif, two sans with actual personality, a flowing script, a chunky rounded
 * display, and an editorial serif.
 *
 * Self-hosted with next/font/local for the same reason as the site fonts in
 * layout.tsx: the build never has to reach fonts.gstatic.com.
 *
 * Declaring all six costs one @font-face rule each and nothing more. A browser
 * downloads a font file only when text on the page actually renders in it, so
 * a thread with no premium comments fetches none of them, and a thread with one
 * Dancing Script comment fetches exactly that one. `preload: false` keeps them
 * out of the document head's preload list, which is what would otherwise pull
 * all six down on every page.
 */
const fraunces = localFont({
  src: './fraunces-latin-var.woff2',
  weight: '400 700',
  variable: '--font-premium-fraunces',
  fallback: ['Georgia', 'serif'],
  display: 'swap',
  preload: false,
});

const grotesk = localFont({
  src: './space-grotesk-latin-var.woff2',
  weight: '400 700',
  variable: '--font-premium-grotesk',
  fallback: ['system-ui', 'sans-serif'],
  display: 'swap',
  preload: false,
});

const bricolage = localFont({
  src: './bricolage-latin-var.woff2',
  weight: '400 800',
  variable: '--font-premium-bricolage',
  fallback: ['system-ui', 'sans-serif'],
  display: 'swap',
  preload: false,
});

const dancing = localFont({
  src: './dancing-script-latin-var.woff2',
  weight: '400 700',
  variable: '--font-premium-dancing',
  fallback: ['cursive'],
  display: 'swap',
  preload: false,
});

const baloo = localFont({
  src: './baloo2-latin-var.woff2',
  weight: '400 800',
  variable: '--font-premium-baloo',
  fallback: ['ui-rounded', 'system-ui', 'sans-serif'],
  display: 'swap',
  preload: false,
});

const instrument = localFont({
  src: './instrument-serif-latin.woff2',
  weight: '400',
  variable: '--font-premium-instrument',
  fallback: ['Georgia', 'serif'],
  display: 'swap',
  preload: false,
});

/**
 * `tweak` corrects for x-height. A script or a display serif set at the same
 * pixel size as the body sans reads noticeably smaller, so those get a nudge
 * rather than being left looking cramped next to ordinary comments.
 */
export const PREMIUM_FONTS = {
  fraunces: {
    label: 'Fraunces — expressive serif',
    className: fraunces.className,
    tweak: '',
  },
  grotesk: {
    label: 'Space Grotesk — modern sans',
    className: grotesk.className,
    tweak: '',
  },
  bricolage: {
    label: 'Bricolage — quirky display',
    className: bricolage.className,
    tweak: '',
  },
  dancing: {
    label: 'Dancing Script — flowing script',
    className: dancing.className,
    tweak: 'text-[1.15em] leading-snug',
  },
  baloo: {
    label: 'Baloo — chunky and round',
    className: baloo.className,
    tweak: 'text-[1.05em]',
  },
  instrument: {
    label: 'Instrument Serif — editorial',
    className: instrument.className,
    tweak: 'text-[1.1em] leading-snug',
  },
} as const;

export type PremiumFontKey = keyof typeof PREMIUM_FONTS;

export const PREMIUM_FONT_KEYS = Object.keys(PREMIUM_FONTS) as PremiumFontKey[];

export function isPremiumFontKey(value: string | null | undefined): value is PremiumFontKey {
  return typeof value === 'string' && value in PREMIUM_FONTS;
}

/**
 * The classes to put on a comment body. Returns '' for anything unrecognised,
 * so a profile still holding a retired font key simply renders in the default
 * style instead of breaking.
 */
export function premiumFontClass(value: string | null | undefined): string {
  if (!isPremiumFontKey(value)) return '';
  const font = PREMIUM_FONTS[value];
  return `${font.className} ${font.tweak}`.trim();
}
