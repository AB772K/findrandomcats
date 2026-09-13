import { TIER_NEON, periodLabel } from '@/lib/types';

/**
 * The two kinds of mark that can sit beside a name, deliberately different so
 * they never read as the same thing:
 *
 *   achievement — an earned Title, chosen by its holder, carried on every
 *                 comment they write. Neon, coloured by tier.
 *   premium     — not an achievement and not selectable. It marks a comment
 *                 that was paid for with a premium NOTE, so it says something
 *                 about the comment, not the person. Cool lilac, outlined.
 *
 * Keeping one lit and one merely outlined means the pair can appear together on
 * a premium comment by a titled author without competing.
 *
 * The tier glow is a text-shadow, not a box-shadow. A Title often sits inside a
 * premium comment that is already glowing at the box level, and two box glows
 * layered on one another turn to mush; lighting the letters keeps the Title
 * readable on top of one.
 */
export default function TitleBadge({
  children,
  kind = 'achievement',
  accent,
  tier,
  period,
  title,
}: {
  children: React.ReactNode;
  kind?: 'achievement' | 'premium';
  /** The author's premium colour, applied only to the premium mark. */
  accent?: string | null;
  /** Percentile band, 1 is rarest. Absent falls back to the house blush. */
  tier?: 1 | 2 | 3 | null;
  /** First-of-month the Title was earned; rendered as "September 2026 -- ". */
  period?: string | null;
  title?: string;
}) {
  const base =
    'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap';

  if (kind === 'premium') {
    return (
      <span
        title={title ?? 'Posted with a premium NOTE'}
        className={`${base} border border-lilac-200 bg-lilac-50 text-lilac-400`}
        style={accent ? { borderColor: accent, color: accent } : undefined}
      >
        {children}
      </span>
    );
  }

  const neon = tier ? TIER_NEON[tier] : null;
  // The month travels with the Title wherever it is shown: a Title is a record
  // of when you stood there, and the date is half of what makes it one.
  const when = period ? periodLabel(period) : null;

  return (
    <span
      title={title ?? (when ? `Earned ${when}` : 'Earned Title')}
      className={`${base} ${neon ? 'bg-ink/85' : 'bg-blush-100 text-blush-500'}`}
      style={
        neon
          ? { color: neon.color, textShadow: neon.glow, boxShadow: `0 0 0 1px ${neon.color}55` }
          : undefined
      }
    >
      {when ? <span className="font-normal opacity-75">{when} — </span> : null}
      {children}
    </span>
  );
}
