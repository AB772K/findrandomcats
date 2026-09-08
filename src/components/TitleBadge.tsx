/**
 * The two kinds of mark that can sit beside a name, deliberately different so
 * they never read as the same thing:
 *
 *   achievement — an earned title, chosen by its holder, carried on every
 *                 comment they write. Warm blush, filled.
 *   premium     — not an achievement and not selectable. It marks a comment
 *                 that was paid for with a premium NOTE, so it says something
 *                 about the comment, not the person. Cool lilac, outlined.
 *
 * Keeping one filled and one outlined means the pair can appear together on a
 * premium comment by a titled author without competing.
 */
export default function TitleBadge({
  children,
  kind = 'achievement',
  accent,
  title,
}: {
  children: React.ReactNode;
  kind?: 'achievement' | 'premium';
  /** The author's premium colour, applied only to the premium mark. */
  accent?: string | null;
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

  return (
    <span
      title={title ?? 'Earned title'}
      className={`${base} bg-blush-100 text-blush-500`}
    >
      {children}
    </span>
  );
}
