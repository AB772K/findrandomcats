import Filter from 'bad-words';

/**
 * `bad-words` ships a small, conventional list of ordinary swear words -- not an
 * exhaustive slur database. One instance is reused; the constructor builds a
 * regex and is not free.
 */
const filter = new Filter();

/**
 * Compounds that are entirely innocent on a cat site. The filter splits on word
 * boundaries, so "pussycat" already slips past the "pussy" entry on its own --
 * but separator forms like "pussy-cat" do not, and normalising punctuation to
 * spaces (below) would break the rest apart anyway. Stripping these first keeps
 * the standalone word blocked while the compounds read normally.
 */
const SAFE_COMPOUNDS = /\bpussy[\s-]?(?:cats?|willows?|foot(?:s|ed|ing)?)\b/gi;

export const PROFANITY_MESSAGE =
  'Please keep it friendly — that comment contains language we do not allow. Reword it and try again.';

export function isProfane(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const safe = trimmed.replace(SAFE_COMPOUNDS, ' ');

  // isProfane() splits on whitespace/punctuation, so it misses words glued to
  // other characters. Normalising common letter-for-symbol swaps catches the
  // lazy evasions without turning this into an arms race.
  const normalised = safe
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[!1|]/g, 'i')
    .replace(/[0]/g, 'o')
    .replace(/[3]/g, 'e')
    .replace(/[^a-z\s]/g, ' ')
    // Normalising punctuation can expose a compound that was hyphenated.
    .replace(SAFE_COMPOUNDS, ' ');

  return filter.isProfane(safe) || filter.isProfane(normalised);
}
