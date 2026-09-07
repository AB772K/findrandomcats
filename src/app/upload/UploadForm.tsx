'use client';

import { useState } from 'react';
import { uploadCat } from '@/lib/actions';

export default function UploadForm() {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    // A successful upload redirects, so anything returned here is a failure.
    const result = await uploadCat(new FormData(event.currentTarget));
    setBusy(false);
    if (result?.error) setError(result.error);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-4 rounded-2xl border border-ink/10 bg-white p-5 shadow-sm"
    >
      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink/60">Photo (max 5 MB)</span>
        <input
          name="image"
          type="file"
          accept="image/*"
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-ink/10 file:px-2 file:py-1 file:text-xs"
        />
      </label>

      {preview ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={preview}
          alt="Selected cat"
          className="aspect-[4/3] w-full rounded-xl object-cover"
        />
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink/60">Caption (optional)</span>
        <input
          name="caption"
          type="text"
          maxLength={140}
          className="w-full rounded-lg border border-ink/15 px-3 py-2 text-sm outline-none focus:border-ink/40"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-cream transition hover:bg-ink/85 disabled:opacity-50"
      >
        {busy ? 'Uploading…' : 'Add to the cat pool'}
      </button>

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
    </form>
  );
}
