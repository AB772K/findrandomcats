'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import { displayNameOf } from '@/lib/avatar';
import type { CommentRow, NoteKind, NotesWallet } from '@/lib/types';

function CommentItem({ comment }: { comment: CommentRow }) {
  const name = displayNameOf(comment.display_name);
  const premium = comment.used_premium_note;

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
        <Link href={`/u/${comment.author_id}`} className="transition duration-200 hover:opacity-80">
          {avatar}
        </Link>
      ) : (
        avatar
      )}

      <div className="min-w-0 flex-1">
        {/* Premium comments get a slow-drifting pastel border: a 1px gradient
            frame (padding + inner fill), not a glow, so it reads as a nicer
            edge rather than something plastic. */}
        <div
          className={
            premium
              ? 'animate-shimmer rounded-2xl rounded-tl-md bg-[linear-gradient(110deg,#e3a5c0,#bcaee2,#e3a5c0)] bg-[length:200%_100%] p-px'
              : ''
          }
        >
          <div
            className={`rounded-2xl rounded-tl-md px-4 py-2.5 ${
              premium ? 'bg-paper' : 'border border-blush-100 bg-paper shadow-soft'
            }`}
          >
            <div className="flex items-baseline gap-2">
              {comment.author_id ? (
                <Link
                  href={`/u/${comment.author_id}`}
                  className="font-display text-sm font-semibold text-ink transition hover:text-blush-500"
                >
                  {name}
                </Link>
              ) : (
                <span className="font-display text-sm font-semibold text-ink/60">{name}</span>
              )}
              {premium ? (
                <span
                  title="Posted with a premium NOTE"
                  className="rounded-full border border-lilac-200 bg-lilac-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-lilac-400"
                >
                  Premium
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink/80">
              {comment.body}
            </p>
          </div>
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
  wallet,
  signedIn,
  onPost,
}: {
  comments: CommentRow[];
  wallet: NotesWallet | null;
  signedIn: boolean;
  onPost: (body: string, noteKind: NoteKind) => Promise<string | null>;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const daily = wallet?.daily_notes_balance ?? 0;
  const premium = wallet?.premium_notes_balance ?? 0;

  // Premium is the default whenever they hold any, matching the precedence
  // post_comment() applies server-side.
  const [noteKind, setNoteKind] = useState<NoteKind>(premium > 0 ? 'premium' : 'daily');

  // Only correct the selection when it becomes unaffordable. Re-applying the
  // default on every balance change would silently undo an explicit choice
  // each time a comment is posted.
  useEffect(() => {
    setNoteKind((current) => {
      if (current === 'premium' && premium < 1) return 'daily';
      if (current === 'daily' && daily < 1 && premium > 0) return 'premium';
      return current;
    });
  }, [daily, premium]);

  const broke = daily < 1 && premium < 1;
  const blocked = !signedIn || broke;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (blocked || busy || !body.trim()) return;

    setBusy(true);
    setError(null);
    const message = await onPost(body, noteKind);
    setBusy(false);

    if (message) setError(message);
    else setBody('');
  }

  const options: { kind: NoteKind; label: string; count: number }[] = [
    { kind: 'daily', label: 'daily note', count: daily },
    { kind: 'premium', label: 'premium note', count: premium },
  ];

  return (
    <section className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-base font-semibold">
          Comments <span className="font-normal text-ink/45">({comments.length})</span>
        </h3>
        <span className="text-xs text-ink/45">Costs 1 NOTE</span>
      </div>

      {signedIn ? (
        <form onSubmit={submit} className="space-y-3">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={3}
            maxLength={2000}
            placeholder={broke ? 'You are out of NOTES.' : 'Say something about this cat…'}
            disabled={blocked || busy}
            className="field resize-y"
          />

          <fieldset disabled={blocked || busy} className="space-y-1.5">
            <legend className="sr-only">Which note to spend</legend>
            <div className="flex flex-wrap gap-2">
              {options.map((option) => {
                const empty = option.count < 1;
                const active = noteKind === option.kind;
                return (
                  <label
                    key={option.kind}
                    className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition duration-200 ${
                      active
                        ? 'border-blush-300 bg-blush-50 text-ink'
                        : 'border-blush-100 bg-paper text-ink/55 hover:border-lilac-200'
                    } ${empty ? 'cursor-not-allowed opacity-45' : 'cursor-pointer'}`}
                  >
                    <input
                      type="radio"
                      name="note-kind"
                      className="sr-only"
                      checked={active}
                      disabled={empty}
                      onChange={() => setNoteKind(option.kind)}
                    />
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${active ? 'bg-blush-400' : 'bg-ink/15'}`}
                    />
                    Post with {option.label}
                    <span className="tabular-nums text-ink/40">({option.count})</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-ink/45">
              {broke ? (
                <>
                  Out of NOTES —{' '}
                  <Link href="/notes" className="underline transition hover:text-ink">
                    get more
                  </Link>
                  .
                </>
              ) : (
                <>
                  {daily} daily · {premium} premium
                </>
              )}
            </p>
            <button type="submit" disabled={blocked || busy || !body.trim()} className="btn-primary">
              {busy ? 'Posting…' : `Post for 1 ${noteKind === 'premium' ? 'premium ' : ''}NOTE`}
            </button>
          </div>

          {error ? (
            <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {error}
            </p>
          ) : null}
        </form>
      ) : (
        <p className="rounded-2xl border border-blush-100 bg-paper px-4 py-3 text-sm text-ink/60">
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
