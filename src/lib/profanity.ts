import Filter from 'bad-words';

/**
 * `bad-words` ships a small, conventional list of ordinary swear words -- not an
 * exhaustive slur database. One instance is reused; the constructor builds a
 * regex and is not free.
 */
const filter = new Filter();

// Cats get called "pussy" constantly and entirely innocently on this site.
filter.removeWords('pussy', 'pussies');

export const PROFANITY_MESSAGE =
  'Please keep it friendly — that comment contains language we do not allow. Reword it and try again.';

export function isProfane(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  // isProfane() splits on whitespace/punctuation, so it misses words glued to
  // other characters. Normalising common letter-for-symbol swaps catches the
  // lazy evasions without turning this into an arms race.
  const normalised = trimmed
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[!1|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[3]/g, 'e')
    .replace(/[^a-z\s]/g, ' ');

  return filter.isProfane(trimmed) || filter.isProfane(normalised);
}
