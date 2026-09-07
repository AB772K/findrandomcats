'use client';

import Link from 'next/link';
import { useState } from 'react';
import Avatar from '@/components/Avatar';
import { displayNameOf } from '@/lib/avatar';
import type { CommentRow } from '@/lib/types';

function CommentItem({ comment }: { comment: CommentRow }) {
  const name = displayNameOf(comment.display_name);

  const avatar = (
    <Avatar
      name={comment.display_name}
      url={comment.profile_picture_url}
      seed={comment.author_id}
      size="md"
    />
  );

  return (
    <li className="flex gap-3">
      {/* A deleted account leaves the comment but has no profile to link to. */}
      {comment.author_id ? (
        <Link
          href={`/u/${comment.author_id}`}
          className="transition duration-300 hover:-translate-y-0.5"
        >
          {avatar}
        </Link>
      ) : (
        avatar
      )}

      <div className="min-w-0 flex-1">
        <div className="rounded-2xl rounded-tl-md bg-white/80 px-4 py-2.5 shadow-soft">
          {comment.author_id ? (
            <Link
              href={`/u/${comment.author_id}`}
              className="font-display text-sm font-semibold text-ink transition hover:text-lilac-400"
            >
              {name}
            </Link>
          ) : (
            <span className="font-display text-sm font-semibold text-ink/60">{name}</span>
          )}
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink/80">
            {comment.body}
          </p>
        </div>
        <p className="mt-1 pl-4 text-[11px] text-ink/40">
          {new Date(comment.created_at).toLocaleString()}
        </p>
      </div>
    </li>
  );
}

export default function CommentBox({
  comments,
  notesBalance,
  signedIn,
  onPost,
}: {
  comments: CommentRow[];
  notesBalance: number | null;
  signedIn: boolean;
  onPost: (body: string) => Promise<string | null>;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const broke = (notesBalance ?? 0) < 1;
  const blocked = !signedIn || broke;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked || busy || !body.trim()) return;

    setBusy(true);
    setError(null);
    const message = await onPost(body);
    setBusy(false);

    if (message) setError(message);
    else setBody('');
  }

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-base font-semibold">
          Comments <span className="font-normal text-ink/45">({comments.length})</span>
        </h3>
        <span className="text-xs text-ink/45">Costs 1 NOTE</span>
      </div>

      {signedIn ? (
        <form onSubmit={submit} className="space-y-2">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={broke ? 'You are out of NOTES.' : 'Say something about this cat…'}
            disabled={blocked || busy}
            className="field resize-y"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink/45">
              {broke
                ? 'Out of NOTES — commenting is paused.'
                : `Balance: ${notesBalance} NOTE${notesBalance === 1 ? '' : 'S'}`}
            </p>
            <button type="submit" disabled={blocked || busy || !body.trim()} className="btn-primary">
              {busy ? 'Posting…' : 'Post for 1 NOTE'}
            </button>
          </div>
          {error ? (
            <p className="rounded-2xl bg-rose-50/80 px-3 py-2 text-xs text-rose-700">{error}</p>
          ) : null}
        </form>
      ) : (
        <p className="rounded-2xl bg-white/60 px-4 py-3 text-sm text-ink/60">
          Sign in to read and post comments.
        </p>
      )}

      <ul className="space-y-4">
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </ul>

      {signedIn && comments.length === 0 ? (
        <p className="text-sm text-ink/45">No comments yet.</p>
      ) : null}
    </section>
  );
}
