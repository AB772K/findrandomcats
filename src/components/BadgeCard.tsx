import {
  BADGE_RANKS,
  METRIC_LABELS,
  type ProfileBadge,
  type ProfileBadgeHistoryRow,
} from '@/lib/types';

type AnyBadge = ProfileBadge | ProfileBadgeHistoryRow;

const monthLabel = (period: string) =>
  new Date(`${period}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/**
 * One badge, as a chip.
 *
 * Deliberately small: a profile can hold six at once, and six full cards would
 * bury everything else on the page.
 */
export default function BadgeList({ badges }: { badges: AnyBadge[]; owner: string }) {
  if (badges.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {badges.map((badge) => {
        const rank = BADGE_RANKS[badge.rank] ?? BADGE_RANKS[3];
        return (
          <li
            key={`${badge.metric}-${'period' in badge ? badge.period : 'now'}`}
            className="flex items-center gap-2 rounded-2xl border border-blush-100 bg-paper px-3 py-2"
          >
            <span aria-hidden className="text-lg leading-none">{rank.medal}</span>
            <span className="min-w-0">
              <span
                className="block font-display text-sm font-semibold"
                style={{ color: rank.color, textShadow: rank.glow }}
              >
                {rank.label}
              </span>
              <span className="block text-[11px] text-ink/50">
                {METRIC_LABELS[badge.metric] ?? badge.metric}
                {'period' in badge ? ` · ${monthLabel(badge.period)}` : ''}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
