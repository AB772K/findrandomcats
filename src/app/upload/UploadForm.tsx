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

    try {
      // A successful upload redirects, so anything returned here is a failure.
      const result = await uploadCat(new FormData(event.currentTarget));
      if (result?.error) setError(result.error);
    } catch (cause) {
      // A rejected action (body too large, network drop, a redirect that fails
      // to follow) used to escape here uncaught, leaving the button stuck on
      // "Uploading…" with nothing on screen to explain why.
      setError(
        cause instanceof Error && cause.message
          ? `Upload failed: ${cause.message}`
          : 'Upload failed. Check your connection and try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card space-y-4 p-6"
    >
      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink/55">Photo (max 5 MB)</span>
        <input
          name="image"
          type="file"
          accept="image/*"
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPreview(file ? URL.createObjectURL(file) : null);
          }}
          className="field file:mr-3 file:rounded-full file:border-0 file:bg-lilac-50 file:px-3 file:py-1 file:text-xs file:text-ink/70"
        />
      </label>

      {preview ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={preview}
          alt="Selected cat"
          className="aspect-[4/3] w-full rounded-2xl object-cover"
        />
      ) : null}

      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink/55">Caption (optional)</span>
        <input
          name="caption"
          type="text"
          maxLength={140}
          className="field"
        />
      </label>

      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full"
      >
        {busy ? 'Checking for a cat…' : 'Add to the cat pool'}
      </button>

      <p className="text-center text-[11px] text-ink/40">
        Every upload is checked for an actual cat before it goes live, which takes a few seconds.
      </p>

      {error ? (
        <p className="rounded-2xl border border-rose-100 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </form>
  );
}
