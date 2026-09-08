import localFont from 'next/font/local';

/**
 * The curated set a premium commenter can pick from. Six distinct, readable
 * faces rather than a font menu -- enough to feel like a choice, few enough
 * that every option is legible at comment size.
 *
 * Self-hosted with next/font/local for the same reason as the site fonts in
 * layout.tsx: the build never has to reach fonts.gstatic.com.
 *
 * Declaring all six costs one @font-face rule each and nothing more. A browser
 * downloads a font file only when text on the page actually renders in it, so
 * a thread with no premium comments fetches none of them, and a thread with one
 * Caveat comment fetches exactly Caveat. `preload: false` keeps them out of the
 * document head's preload list, which is what would otherwise pull all six
 * down on every page.
 */
const inter = localFont({
  src: './inter-latin-var.woff2',
  weight: '100 900',
  variable: '--font-premium-inter',
  fallback: ['system-ui', 'sans-serif'],
  display: 'swap',
  preload: false,
});

const quicksand = localFont({
  src: './quicksand-latin-var.woff2',
  weight: '300 700',
  variable: '--font-premium-quicksand',
  fallback: ['ui-rounded', 'system-ui', 'sans-serif'],
  display: 'swap',
  preload: false,
});

const anton = localFont({
  src: './anton-latin.woff2',
  weight: '400',
  variable: '--font-premium-anton',
  fallback: ['Impact', 'system-ui', 'sans-serif'],
  display: 'swap',
  preload: false,
});

const playfair = localFont({
  src: './playfair-latin-var.woff2',
  weight: '400 900',
  variable: '--font-premium-playfair',
  fallback: ['Georgia', 'serif'],
  display: 'swap',
  preload: false,
});

const jetbrains = localFont({
  src: './jetbrains-latin-var.woff2',
  weight: '100 800',
  variable: '--font-premium-jetbrains',
  fallback: ['ui-monospace', 'monospace'],
  display: 'swap',
  preload: false,
});

const caveat = localFont({
  src: './caveat-latin-var.woff2',
  weight: '400 700',
  variable: '--font-premium-caveat',
  fallback: ['cursive'],
  display: 'swap',
  preload: false,
});

/** Keys match the profiles.premium_comment_font check constraint. */
export const PREMIUM_FONTS = {
  inter: { label: 'Inter — clean', className: inter.className },
  quicksand: { label: 'Quicksand — rounded', className: quicksand.className },
  anton: { label: 'Anton — bold', className: anton.className },
  playfair: { label: 'Playfair Display — elegant', className: playfair.className },
  jetbrains: { label: 'JetBrains Mono — monospace', className: jetbrains.className },
  caveat: { label: 'Caveat — handwritten', className: caveat.className },
} as const;

export type PremiumFontKey = keyof typeof PREMIUM_FONTS;

export const PREMIUM_FONT_KEYS = Object.keys(PREMIUM_FONTS) as PremiumFontKey[];

export function isPremiumFontKey(value: string | null | undefined): value is PremiumFontKey {
  return typeof value === 'string' && value in PREMIUM_FONTS;
}

/** The class to put on a comment body, or '' when the author picked nothing. */
export function premiumFontClass(value: string | null | undefined): string {
  return isPremiumFontKey(value) ? PREMIUM_FONTS[value].className : '';
}
