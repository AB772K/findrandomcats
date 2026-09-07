'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Avatar from '@/components/Avatar';
import { saveProfile } from '@/lib/actions';
import type { MyProfile } from '@/lib/types';

export default function SettingsForm({ profile }: { profile: MyProfile | null }) {
  const router = useRouter();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);

    const result = await saveProfile(new FormData(event.currentTarget));
    setBusy(false);

    if (result.ok) {
      setSaved(true);
      // Pull the fresh avatar and name into the nav.
      router.refresh();
    } else {
      setError(result.error);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      <div className="flex items-center gap-4">
        {preview ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={preview}
            alt="New profile picture"
            className="h-20 w-20 shrink-0 rounded-full object-cover shadow-soft ring-2 ring-white/80"
          />
        ) : (
          <Avatar
            name={name || profile?.display_name || null}
            url={profile?.profile_picture_url ?? null}
            seed={null}
            size="lg"
          />
        )}

        <label className="min-w-0 flex-1 space-y-1">
          <span className="text-xs font-medium text-ink/55">Profile picture (max 2 MB)</span>
          <input
            name="avatar"
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setPreview(file ? URL.createObjectURL(file) : null);
            }}
            className="field file:mr-3 file:rounded-full file:border-0 file:bg-lilac-100 file:px-3 file:py-1 file:text-xs file:text-ink/70"
          />
          <span className="block text-[11px] text-ink/40">
            Leave empty to keep your current picture.
          </span>
        </label>
      </div>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink/55">Display name</span>
        <input
          name="display_name"
          type="text"
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Cat lover"
          className="field"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-xs font-medium text-ink/55">Bio</span>
        <textarea
          name="bio"
          rows={3}
          maxLength={300}
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Here for the fluffy ones."
          className="field resize-y"
        />
        <span className="block text-right text-[11px] text-ink/40">{bio.length}/300</span>
      </label>

      <button type="submit" disabled={busy} className="btn-primary w-full">
        {busy ? 'Saving…' : 'Save profile'}
      </button>

      {error ? (
        <p className="rounded-2xl bg-rose-50/80 px-3 py-2 text-xs text-rose-700">{error}</p>
      ) : null}
      {saved ? (
        <p className="rounded-2xl bg-emerald-50/80 px-3 py-2 text-xs text-emerald-800">
          Saved — your profile is up to date.
        </p>
      ) : null}
    </form>
  );
}
