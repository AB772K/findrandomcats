'use client';

import { useCallback, useState } from 'react';
import CommentBox from '@/components/CommentBox';
import StarPicker from '@/components/StarPicker';
import { deleteComment, editComment, postComment, rateCat } from '@/lib/actions';
import type { CatBundle, NoteKind, NotesWallet } from '@/lib/types';

/**
 * The interactive half of a cat's detail page. Rating and commenting reuse the
 * same server actions as the feed, so a cat behaves identically whether it was
 * reached at random or from a profile's upload grid.
 */
export default function CatDetail({
  bundle: initial,
  wallet: initialWallet,
  signedIn,
}: {
  bundle: CatBundle;
  wallet: NotesWallet | null;
  signedIn: boolean;
}) {
  const [bundle, setBundle] = useState(initial);
  const [wallet, setWallet] = useState(initialWallet);
  const [error, setError] = useState<string | null>(null);

  const handleRate = useCallback(
    async (stars: number) => {
      setError(null);
      try {
        setBundle(await rateCat(bundle.cat.id, stars));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not save your rating.');
      }
    },
    [bundle.cat.id],
  );

  const handleComment = useCallback(
    async (body: string, noteKind: NoteKind) => {
      const result = await postComment(bundle.cat.id, body, noteKind);
      if (!result.ok) return result.error;
      setBundle((prev) => ({ ...prev, comments: result.comments }));
      setWallet(result.wallet);
      return null;
    },
    [bundle.cat.id],
  );

  const handleEdit = useCallback(
    async (commentId: string, body: string) => {
      const result = await editComment(bundle.cat.id, commentId, body);
      if (!result.ok) return result.error;
      setBundle((prev) => ({ ...prev, comments: result.comments }));
      return null;
    },
    [bundle.cat.id],
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      const result = await deleteComment(bundle.cat.id, commentId);
      if (!result.ok) return result.error;
      // The NOTE is refunded server-side; reflect it without a reload.
      if (result.wallet) setWallet(result.wallet);
      setBundle((prev) => ({ ...prev, comments: result.comments }));
      return null;
    },
    [bundle.cat.id],
  );

  return (
    <div className="space-y-5">
      <StarPicker myStars={bundle.myStars} disabled={!signedIn} onRate={handleRate} />

      {error ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}

      <CommentBox
        comments={bundle.comments}
        wallet={wallet}
        signedIn={signedIn}
        onPost={handleComment}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}
