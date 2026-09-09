/**
 * Content rules beyond ordinary swearing.
 *
 * `bad-words` (see profanity.ts) covers mild profanity and nothing else. A bio
 * is more exposed than a single comment -- it sits on a public profile, next to
 * a name, for as long as the account exists -- so it is also checked for the
 * things that are not merely rude: encouragement of self-harm, threats against
 * a person, and slurs.
 *
 * This is a word list, and a word list is a floor rather than a ceiling. It
 * catches the obvious and the lazily disguised; it will not catch someone who
 * is deliberately working around it, and it is not a substitute for a real
 * moderation service. It is deliberately short: a sprawling list of slurs in a
 * repository is its own problem, and every extra pattern is another chance to
 * flag someone innocent.
 */

export type HarmCategory = 'self-harm' | 'threat' | 'slur';

const PATTERNS: { category: HarmCategory; pattern: RegExp }[] = [
  // Self-harm, in both directions: someone describing their own intent, and
  // someone urging it at a reader.
  { category: 'self-harm', pattern: /\b(?:kill|hurt|harm)\s+(?:my|your|him|her|them)self\b/ },
  { category: 'self-harm', pattern: /\bk\s*y\s*s\b/ },
  { category: 'self-harm', pattern: /\bcommit\s+suicide\b/ },
  { category: 'self-harm', pattern: /\b(?:cut|slit)\s+(?:my|your|his|her|their)\s+wrists?\b/ },
  { category: 'self-harm', pattern: /\bend\s+(?:my|your|his|her|their)\s+(?:own\s+)?life\b/ },
  { category: 'self-harm', pattern: /\bwant\s+to\s+die\b/ },

  // Threats aimed at a person, rather than the word "kill" in isolation --
  // "this cat is killing me" is not a threat and must not read as one.
  { category: 'threat', pattern: /\b(?:i\s*(?:'|’)?\s*(?:ll|m)|i\s+will|i\s+am|imma|im|gonna|going\s+to)\s+(?:going\s+to\s+)?(?:kill|murder|stab|shoot|beat|hurt)\s+(?:you|u|him|her|them)\b/ },
  { category: 'threat', pattern: /\byou\s+(?:will|are\s+going\s+to|gonna)\s+die\b/ },
  { category: 'threat', pattern: /\bwatch\s+your\s+back\b/ },

  // Slurs. Written as patterns rather than plain words so the usual
  // letter-for-number swaps do not walk straight through.
  { category: 'slur', pattern: /\br[e3]t[a@4]rd(?:s|ed)?\b/ },
  { category: 'slur', pattern: /\bf[a@4]gg?(?:ot|ots|s)?\b/ },
  { category: 'slur', pattern: /\bn[i1!][gq]{2}(?:er|a|ers|as|uh)\b/ },
  { category: 'slur', pattern: /\btr[a@4]nn(?:y|ies)\b/ },
];

/** Mirrors profanity.ts so the two filters see the same disguised text. */
function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[0]/g, 'o')
    .replace(/[3]/g, 'e')
    // Collapse runs of the same letter: "kiiiill you" should not slip past.
    .replace(/(.)\1{2,}/g, '$1$1')
    .replace(/\s+/g, ' ');
}

/** The category of harm found, or null when the text is clear. */
export function harmCategory(text: string): HarmCategory | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const candidates = [trimmed.toLowerCase(), normalise(trimmed)];
  for (const { category, pattern } of PATTERNS) {
    if (candidates.some((c) => pattern.test(c))) return category;
  }
  return null;
}

/**
 * What to tell someone, per category.
 *
 * The self-harm wording is deliberately not a telling-off. Someone typing that
 * into a bio may mean it, and a scolding is the wrong response to a person who
 * might be struggling; the message declines the text and points somewhere
 * useful instead.
 */
export const HARM_MESSAGE: Record<HarmCategory, string> = {
  'self-harm':
    'We can’t publish that. If you’re going through something, please talk to someone who can help — findahelpline.com lists free, confidential support in your country.',
  threat: 'We can’t publish threats of violence. Please reword that.',
  slur: 'We can’t publish slurs. Please reword that.',
};
