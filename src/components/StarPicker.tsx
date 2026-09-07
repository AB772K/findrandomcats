'use client';

import { useState, useTransition } from 'react';

const STARS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function StarPicker({
  myStars,
  disabled,
  onRate,
}: {
  myStars: number | null;
  disabled?: boolean;
  onRate: (stars: number) => Promise<void>;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  const active = hovered ?? myStars ?? 0;

  return (
    <div>
      <div
        className="flex flex-wrap gap-1"
        onMouseLeave={() => setHovered(null)}
        role="radiogroup"
        aria-label="Rate this cat from 1 to 10"
      >
        {STARS.map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={myStars === star}
            aria-label={`${star} out of 10`}
            disabled={disabled || pending}
            onMouseEnter={() => setHovered(star)}
            onFocus={() => setHovered(star)}
            onClick={() => startTransition(() => onRate(star))}
            className={`h-9 w-9 rounded-md text-lg leading-none transition disabled:cursor-not-allowed disabled:opacity-40 ${
              star <= active ? 'text-amber-500' : 'text-ink/25'
            } hover:bg-ink/5`}
          >
            ★
          </button>
        ))}
      </div>

      <p className="mt-2 text-xs text-ink/50">
        {disabled
          ? 'Sign in to rate this cat.'
          : myStars
            ? `You rated this cat ${myStars}/10. Click another star to change it.`
            : 'Pick a score from 1 to 10.'}
      </p>
    </div>
  );
}
