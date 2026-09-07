import type { RatingTally } from '@/lib/types';

export default function RatingBreakdown({
  tallies,
  totalRatings,
}: {
  tallies: RatingTally[];
  totalRatings: number;
}) {
  if (totalRatings === 0) {
    return <p className="text-sm text-ink/45">No ratings yet — be the first.</p>;
  }

  const average =
    tallies.reduce((sum, t) => sum + t.stars * Number(t.count), 0) / totalRatings;

  // Highest star values first so the crowd favourite reads at the top.
  const rows = [...tallies].sort((a, b) => b.stars - a.stars);

  return (
    <div className="space-y-3">
      <p className="text-sm text-ink/65">
        <span className="font-display text-base font-bold text-ink">{average.toFixed(1)}/10</span>{' '}
        from{' '}
        {totalRatings} {totalRatings === 1 ? 'rating' : 'ratings'}
      </p>

      <ul className="space-y-1">
        {rows.map((t) => {
          const percent = Number(t.percent);
          return (
            <li key={t.stars} className="flex items-center gap-3 text-xs">
              <span className="w-14 shrink-0 tabular-nums text-ink/55">{t.stars} ★</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-lilac-100">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-blush-300 to-lilac-300 transition-[width] duration-500"
                  style={{ width: `${percent}%` }}
                />
              </span>
              <span className="w-28 shrink-0 text-right tabular-nums text-ink/55">
                {percent}% rated {t.stars}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
