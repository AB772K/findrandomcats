'use client';

import { useCallback, useState } from 'react';
import AdSlot from '@/components/AdSlot';
import CatImage from '@/components/CatImage';
import CommentBox from '@/components/CommentBox';
import RatingBreakdown from '@/components/RatingBreakdown';
import StarPicker from '@/components/StarPicker';
import VideoAdSlot from '@/components/VideoAdSlot';
import { fetchRandomCat, postComment, rateCat } from '@/lib/actions';
import type { CatBundle } from '@/lib/types';

const CATS_PER_AD = 2;
/** The rewarded-video placeholder is rarer than the banner so it stays a treat. */
const CATS_PER_VIDEO_AD = 6;

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

  const showVideoAd = viewed > 0 && viewed % CATS_PER_VIDEO_AD === 0;
  // Never stack both placeholders on the same cat.
  const showAd = viewed > 0 && viewed % CATS_PER_AD === 0 && !showVideoAd;

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
          className="btn-primary px-8 py-3.5 text-base"
        >
          {loading ? 'Finding…' : bundle ? 'Find another random cat' : 'Find a Random Cat'}
        </button>
        <p className="text-xs text-ink/45">
          {viewed} {viewed === 1 ? 'cat' : 'cats'} viewed this session
        </p>
      </div>

      {error ? (
        <p className="card bg-rose-50/80 px-4 py-3 text-sm text-rose-700">{error}</p>
      ) : null}

      {showAd ? <AdSlot index={viewed / CATS_PER_AD} /> : null}
      {showVideoAd ? <VideoAdSlot /> : null}

      {bundle ? (
        <article key={bundle.cat.id} className="card animate-fade-up space-y-6 p-4 sm:p-6">
          <CatImage cat={bundle.cat} priority />

          <div className="space-y-4 border-t border-lilac-100 pt-5">
            <StarPicker myStars={bundle.myStars} disabled={!signedIn} onRate={handleRate} />
            <RatingBreakdown tallies={bundle.tallies} totalRatings={bundle.totalRatings} />
          </div>

          <div className="border-t border-lilac-100 pt-5">
            <CommentBox
              comments={bundle.comments}
              notesBalance={notes}
              signedIn={signedIn}
              onPost={handleComment}
            />
          </div>
        </article>
      ) : (
        <p className="text-center text-sm text-ink/45">Hit the button and meet a cat.</p>
      )}
    </div>
  );
}
