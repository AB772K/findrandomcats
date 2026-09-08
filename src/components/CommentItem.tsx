'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Avatar from '@/components/Avatar';
import { displayNameOf } from '@/lib/avatar';
import type { CommentRow } from '@/lib/types';

function remainingLabel(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return minutes > 0 ? `${minutes}m` : `${seconds}s`;
}

export default function CommentItem({
  comment,
  onEdit,
  onDelete,
}: {
  comment: CommentRow;
  onEdit: (commentId: string, body: string) => Promise<string | null>;
  onDelete: (commentId: string) => Promise<string | null>;
}) {
  const name = displayNameOf(comment.display_name);
  const premium = comment.used_premium_note;
  // Only premium comments carry a colour; cat_comments() already nulls it out
  // for the rest, so an unstyled author simply falls back to the house look.
  const accent = premium ? comment.premium_comment_color : null;
  const glow = premium && comment.premium_comment_glow;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The window closes while the page is open, so the controls have to expire on
  // their own rather than only on reload. Rendered as null until mounted so the
  // server and client markup agree.
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!comment.is_mine) return;
    const until = new Date(comment.editable_until).getTime();
    if (Number.isNaN(until)) return;

    const tick = () => setRemaining(until - Date.now());
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [comment.is_mine, comment.editable_until]);

  const canChange = comment.is_mine && remaining !== null && remaining > 0;

  async function save() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await onEdit(comment.id, draft);
    setBusy(false);
    if (message) setError(message);
    else setEditing(false);
  }

  async function remove() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const message = await onDelete(comment.id);
    setBusy(false);
    if (message) setError(message);
  }

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
            frame, not a glow, so it reads as a nicer edge rather than plastic. */}
        <div
          className={
            premium && !accent
              ? 'animate-shimmer rounded-2xl rounded-tl-md bg-[linear-gradient(110deg,#e3a5c0,#bcaee2,#e3a5c0)] bg-[length:200%_100%] p-px'
              : ''
          }
          // A chosen colour replaces the drifting default gradient with a solid
          // 1px frame in that colour; the glow is a real blurred box-shadow, not
          // a thicker border.
          style={
            accent
              ? {
                  borderRadius: '1rem',
                  padding: '1px',
                  background: accent,
                  boxShadow: glow ? `0 0 20px -2px ${accent}, 0 0 6px -1px ${accent}` : undefined,
                }
              : undefined
          }
        >
          <div
            className={`rounded-2xl rounded-tl-md px-4 py-2.5 ${
              premium ? 'bg-paper' : 'border border-blush-100 bg-paper shadow-soft'
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-2">
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
                  style={accent ? { borderColor: accent, color: accent } : undefined}
                >
                  Premium
                </span>
              ) : null}
            </div>

            {editing ? (
              <div className="mt-2 space-y-2">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  maxLength={2000}
                  disabled={busy}
                  className="field resize-y"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={save}
                    disabled={busy || !draft.trim()}
                    className="btn-primary px-4 py-1.5 text-xs"
                  >
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDraft(comment.body);
                      setEditing(false);
                      setError(null);
                    }}
                    disabled={busy}
                    className="text-xs text-ink/50 underline transition hover:text-ink"
                  >
                    Cancel
                  </button>
                  <span className="ml-auto text-[11px] text-ink/35">Editing is free</span>
                </div>
              </div>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-ink/80">
                {comment.body}
              </p>
            )}
          </div>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 pl-4 text-[11px] text-ink/40">
          <span>{new Date(comment.created_at).toLocaleString()}</span>
          {comment.edited_at ? <span title={new Date(comment.edited_at).toLocaleString()}>edited</span> : null}

          {canChange && !editing ? (
            <>
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="underline transition hover:text-ink"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="underline transition hover:text-rose-600"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
              <span className="text-ink/30">{remainingLabel(remaining)} left to change it</span>
            </>
          ) : null}
        </div>

        {error ? (
          <p className="mt-1 rounded-2xl border border-rose-100 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </li>
  );
}
