'use client';

import { useState } from 'react';
import type { CommentRow } from '@/lib/types';

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
        <h3 className="text-sm font-semibold">
          Comments <span className="font-normal text-ink/50">({comments.length})</span>
        </h3>
        <span className="text-xs text-ink/50">Costs 1 NOTE</span>
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
            className="w-full resize-y rounded-lg border border-ink/15 bg-white px-3 py-2 text-sm outline-none focus:border-ink/40 disabled:bg-ink/5 disabled:text-ink/40"
          />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink/50">
              {broke
                ? 'Out of NOTES — commenting is paused.'
                : `Balance: ${notesBalance} NOTE${notesBalance === 1 ? '' : 'S'}`}
            </p>
            <button
              type="submit"
              disabled={blocked || busy || !body.trim()}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-cream transition hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? 'Posting…' : 'Post for 1 NOTE'}
            </button>
          </div>
          {error ? <p className="text-xs text-red-600">{error}</p> : null}
        </form>
      ) : (
        <p className="rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink/60">
          Sign in to read and post comments.
        </p>
      )}

      <ul className="divide-y divide-ink/10">
        {comments.map((comment) => (
          <li key={comment.id} className="py-3">
            <p className="whitespace-pre-wrap text-sm text-ink/85">{comment.body}</p>
            <p className="mt-1 text-xs text-ink/40">
              {new Date(comment.created_at).toLocaleString()}
            </p>
          </li>
        ))}
      </ul>

      {signedIn && comments.length === 0 ? (
        <p className="text-sm text-ink/50">No comments yet.</p>
      ) : null}
    </section>
  );
}
