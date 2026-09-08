'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteCat } from '@/lib/actions';

/**
 * Only rendered for the uploader. delete_cat() re-checks ownership server-side,
 * so hiding this is presentation, not the permission boundary.
 *
 * Two-step by design: deleting a cat destroys every comment on it, which is not
 * something to hang off a single mis-tap.
 */
export default function DeleteCatButton({
  catId,
  redirectTo,
  compact = false,
}: {
  catId: string;
  /** Where to go afterwards. Omit to just refresh in place. */
  redirectTo?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    const result = await deleteCat(catId);

    if (!result.ok) {
      setBusy(false);
      setError(result.error);
      return;
    }

    if (redirectTo) router.push(redirectTo);
    else router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={
          compact
            ? 'text-[11px] text-ink/45 underline transition hover:text-rose-600'
            : 'btn-soft text-rose-600 hover:text-rose-700'
        }
      >
        Delete this cat
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink/60">
        Delete this cat and every comment on it? Anyone who spent a premium NOTE here gets it back.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={remove}
          disabled={busy}
          className="rounded-full bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white transition duration-200 hover:bg-rose-700 disabled:opacity-50"
        >
          {busy ? 'Deleting…' : 'Yes, delete it'}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          disabled={busy}
          className="text-xs text-ink/50 underline transition hover:text-ink"
        >
          Cancel
        </button>
      </div>
      {error ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
