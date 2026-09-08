'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import CommentItem from '@/components/CommentItem';
import EmojiPicker from '@/components/EmojiPicker';
import type {
  CommentRow,
  NoteKind,
  NotesWallet,
  ReactionKind,
  ReactionState,
} from '@/lib/types';

export default function CommentBox({
  comments,
  wallet,
  signedIn,
  rated,
  onPost,
  onEdit,
  onDelete,
  onReact,
}: {
  comments: CommentRow[];
  wallet: NotesWallet | null;
  signedIn: boolean;
  /** Whether this user has already rated this cat. Commenting depends on it. */
  rated: boolean;
  onPost: (body: string, noteKind: NoteKind) => Promise<string | null>;
  onEdit: (commentId: string, body: string) => Promise<string | null>;
  onDelete: (commentId: string) => Promise<string | null>;
  onReact: (commentId: string, reaction: ReactionKind) => Promise<ReactionState | string>;
}) {
  const [body, setBody] = useState('');
  const textarea = useRef<HTMLTextAreaElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  /** Drops an emoji in at the caret rather than always appending at the end. */
  function insertEmoji(emoji: string) {
    const el = textarea.current;
    setBody((current) => {
      if (!el) return current + emoji;
      const start = el.selectionStart ?? current.length;
      const end = el.selectionEnd ?? current.length;
      const next = current.slice(0, start) + emoji + current.slice(end);
      // Restore the caret after React has painted the new value.
      requestAnimationFrame(() => {
        el.focus();
        const at = start + emoji.length;
        el.setSelectionRange(at, at);
      });
      return next;
    });
  }

  // A null wallet means the balance is unknown -- not that it is empty. Reading
  // it as zero is what made a signed-in user with notes see "You are out of
  // NOTES." whenever my_notes() failed to come back.
  const walletKnown = wallet !== null;
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

  // Only block on a balance we actually know. When we do not, let them try:
  // post_comment() charges the note and is the real enforcement anyway, so the
  // worst case is an honest error message instead of a box disabled by mistake.
  const broke = walletKnown && daily < 1 && premium < 1;
  // Rating first is a rule of the site, not a UI preference: post_comment()
  // refuses an unrated cat regardless. Greying the box out here just means the
  // rule is visible before someone writes a paragraph, rather than after.
  const blocked = !signedIn || broke || !rated;

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

      {signedIn && !rated ? (
        <p className="rounded-2xl border border-lilac-200 bg-lilac-50 px-4 py-2.5 text-xs text-ink/60">
          Give this cat a score out of 10 first — then you can comment.
        </p>
      ) : null}

      {signedIn ? (
        <form onSubmit={submit} className="space-y-3">
          {/* The picker sits inside the box, bottom-right, the way chat apps
              do it. pb-10 keeps typed text clear of the button rather than
              letting the last line run underneath it. */}
          <div className="relative">
            <textarea
              ref={textarea}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={3}
              maxLength={2000}
              placeholder={
                !rated
                  ? 'Rate this cat first…'
                  : broke
                    ? 'You are out of NOTES.'
                    : 'Say something about this cat…'
              }
              disabled={blocked || busy}
              className="field resize-y pb-10"
            />
            <div className="absolute bottom-2.5 right-2.5">
              <EmojiPicker onPick={insertEmoji} disabled={blocked || busy} />
            </div>
          </div>

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
            <p className="flex-1 text-xs text-ink/45">
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
          <CommentItem
            key={comment.id}
            comment={comment}
            signedIn={signedIn}
            onEdit={onEdit}
            onDelete={onDelete}
            onReact={onReact}
          />
        ))}
      </ul>

      {signedIn && comments.length === 0 ? (
        <p className="text-sm text-ink/45">No comments yet.</p>
      ) : null}
    </section>
  );
}
