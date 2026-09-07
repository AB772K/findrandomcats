import { avatarColorOf, displayNameOf, initialsOf } from '@/lib/avatar';

const SIZES = {
  sm: 'h-8 w-8 text-[11px]',
  md: 'h-10 w-10 text-sm',
  lg: 'h-20 w-20 text-2xl',
} as const;

/**
 * Profile picture with a generated fallback: initials on a colour derived from
 * the profile id, so every commenter has a face even before they upload one.
 */
export default function Avatar({
  name,
  url,
  seed,
  size = 'md',
}: {
  name: string | null;
  url: string | null;
  seed: string | null;
  size?: keyof typeof SIZES;
}) {
  const label = displayNameOf(name);
  const shell = `${SIZES[size]} shrink-0 overflow-hidden rounded-full ring-2 ring-blush-100`;

  if (url) {
    return (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={url} alt={label} className={`${shell} object-cover`} loading="lazy" />
    );
  }

  return (
    <span
      aria-hidden
      className={`${shell} flex items-center justify-center font-display font-semibold text-white`}
      style={{ backgroundColor: avatarColorOf(seed) }}
    >
      {initialsOf(name)}
    </span>
  );
}
