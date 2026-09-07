/** Shown wherever someone has not set a display name yet. */
export const FALLBACK_NAME = 'Cat lover';

/** Soft, on-palette backgrounds for generated initial avatars. */
const AVATAR_COLORS = [
  '#e0839f',
  '#a68ce4',
  '#eeaac3',
  '#c2b2ef',
  '#e8a672',
  '#7fb3a5',
  '#d98fb0',
  '#8fa8e0',
] as const;

export function displayNameOf(name: string | null | undefined): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : FALLBACK_NAME;
}

/** First letters of the first two words, e.g. "Random Cat" -> "RC". */
export function initialsOf(name: string | null | undefined): string {
  const words = displayNameOf(name).split(/\s+/).filter(Boolean).slice(0, 2);
  const letters = words.map((word) => word[0]).join('');
  return (letters || '?').toUpperCase();
}

/**
 * Picks a stable colour from the id, so the same person always gets the same
 * avatar rather than one that flickers between renders.
 */
export function avatarColorOf(seed: string | null | undefined): string {
  const key = seed ?? '';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
