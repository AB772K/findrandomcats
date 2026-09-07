'use client';

import { useCallback, useState } from 'react';
import AdSlot from '@/components/AdSlot';
import CatImage from '@/components/CatImage';
import CommentBox from '@/components/CommentBox';
import RatingBreakdown from '@/components/RatingBreakdown';
import StarPicker from '@/components/StarPicker';
import { fetchRandomCat, postComment, rateCat } from '@/lib/actions';
import type { CatBundle } from '@/lib/types';

const CATS_PER_AD = 2;

export default function CatFeed({
  signedIn,
  initialNotes,
}: {
  signedIn: boolean;
  initialNotes: number | null;
}) {
  const [bundle, setBundle] = useState<CatBundle | null>(null);
  const [notes, setNotes] = useState(initialNotes);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [viewed, setViewed] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showAd = viewed > 0 && viewed % CATS_PER_AD === 0;

  const findCat = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchRandomCat(seenIds);
      if (!next) {
        setError('No cats in the database yet. Run `npm run seed` or upload one.');
        return;
      }
      setBundle(next);
      setSeenIds((prev) => (prev.includes(next.cat.id) ? prev : [...prev, next.cat.id]));
      setViewed((prev) => prev + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not fetch a cat.');
    } finally {
      setLoading(false);
    }
  }, [seenIds]);

  const handleRate = useCallback(
    async (stars: number) => {
      if (!bundle) return;
      setError(null);
      try {
        setBundle(await rateCat(bundle.cat.id, stars));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save your rating.');
      }
    },
    [bundle],
  );

  const handleComment = useCallback(
    async (body: string) => {
      if (!bundle) return 'No cat loaded.';
      const result = await postComment(bundle.cat.id, body);
      if (!result.ok) return result.error;

      setBundle({ ...bundle, comments: result.comments });
      setNotes(result.notesBalance);
      return null;
    },
    [bundle],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={findCat}
          disabled={loading}
          className="rounded-full bg-ink px-6 py-3 text-base font-semibold text-cream shadow-sm transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Finding…' : bundle ? 'Find another random cat' : 'Find a Random Cat'}
        </button>
        <p className="text-xs text-ink/50">
          {viewed} {viewed === 1 ? 'cat' : 'cats'} viewed this session
        </p>
      </div>

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      {showAd ? <AdSlot index={viewed / CATS_PER_AD} /> : null}

      {bundle ? (
        <article className="space-y-6 rounded-2xl border border-ink/10 bg-white p-4 shadow-sm sm:p-6">
          <CatImage cat={bundle.cat} priority />

          <div className="space-y-4 border-t border-ink/10 pt-5">
            <StarPicker myStars={bundle.myStars} disabled={!signedIn} onRate={handleRate} />
            <RatingBreakdown tallies={bundle.tallies} totalRatings={bundle.totalRatings} />
          </div>

          <div className="border-t border-ink/10 pt-5">
            <CommentBox
              comments={bundle.comments}
              notesBalance={notes}
              signedIn={signedIn}
              onPost={handleComment}
            />
          </div>
        </article>
      ) : (
        <p className="text-center text-sm text-ink/50">
          Hit the button and meet a cat.
        </p>
      )}
    </div>
  );
}
