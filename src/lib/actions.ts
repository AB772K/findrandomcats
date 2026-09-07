'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { findNotePackage } from '@/lib/notes';
import { PROFANITY_MESSAGE, isProfane } from '@/lib/profanity';
import type {
  Cat,
  CatBundle,
  CommentRow,
  MyProfile,
  NoteKind,
  NotesWallet,
  RatingTally,
} from '@/lib/types';

/* ------------------------------------------------------------------ helpers */

async function loadBundle(cat: Cat): Promise<CatBundle> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [summary, mine, comments] = await Promise.all([
    supabase.rpc('cat_rating_summary', { p_cat_id: cat.id }),
    user
      ? supabase
          .from('ratings')
          .select('stars')
          .eq('cat_id', cat.id)
          .eq('user_id', user.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    // cat_comments() joins each author's public profile fields; a plain select
    // could not, because profiles are only readable by their owner.
    user
      ? supabase.rpc('cat_comments', { p_cat_id: cat.id })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const tallies = (summary.data ?? []) as RatingTally[];

  return {
    cat,
    tallies,
    totalRatings: tallies.reduce((sum, t) => sum + Number(t.count), 0),
    myStars: (mine.data as { stars: number } | null)?.stars ?? null,
    comments: (comments.data ?? []) as CommentRow[],
  };
}

/* -------------------------------------------------------------- random cat */

/**
 * Pulls one random cat, avoiding ones already seen this session so a short
 * browse does not keep serving the same face.
 */
export async function fetchRandomCat(seenIds: string[] = []): Promise<CatBundle | null> {
  const supabase = createClient();

  let { data, error } = await supabase.rpc('random_cat', { exclude_ids: seenIds });

  // Every cat seen already -- start over rather than dead-end the user.
  if (!error && (!data || data.length === 0) && seenIds.length > 0) {
    ({ data, error } = await supabase.rpc('random_cat', { exclude_ids: [] }));
  }

  if (error) throw new Error(error.message);

  const cat = (data as Cat[] | null)?.[0];
  return cat ? loadBundle(cat) : null;
}

/* ------------------------------------------------------------------ rating */

export async function rateCat(catId: string, stars: number): Promise<CatBundle> {
  if (!Number.isInteger(stars) || stars < 1 || stars > 10) {
    throw new Error('Rating must be a whole number from 1 to 10.');
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Sign in to rate cats.');

  const { error } = await supabase
    .from('ratings')
    .upsert({ cat_id: catId, user_id: user.id, stars }, { onConflict: 'cat_id,user_id' });
  if (error) throw new Error(error.message);

  const { data: cat, error: catError } = await supabase
    .from('cats')
    .select('*')
    .eq('id', catId)
    .single();
  if (catError) throw new Error(catError.message);

  return loadBundle(cat as Cat);
}

/* ---------------------------------------------------------------- comments */

export type PostCommentResult =
  | { ok: true; comments: CommentRow[]; wallet: NotesWallet }
  | { ok: false; error: string };

/**
 * Comments cost 1 NOTE from one of the two wallets. Picking the wallet,
 * charging it, and inserting the row all happen inside post_comment() so they
 * cannot get out of sync -- and so the client cannot claim a premium note it
 * did not pay for.
 */
export async function postComment(
  catId: string,
  body: string,
  noteKind: NoteKind = 'daily',
): Promise<PostCommentResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Write something first.' };
  if (trimmed.length > 2000) return { ok: false, error: 'Comments are capped at 2000 characters.' };

  // Rejected outright rather than censored -- a silently starred-out comment
  // reads as if we put words in someone's mouth, and it still costs a NOTE.
  if (isProfane(trimmed)) return { ok: false, error: PROFANITY_MESSAGE };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to comment.' };

  const { error } = await supabase.rpc('post_comment', {
    p_cat_id: catId,
    p_body: trimmed,
    p_use_premium: noteKind === 'premium',
  });
  if (error) {
    return {
      ok: false,
      error: /out of daily NOTES/i.test(error.message)
        ? 'You are out of daily NOTES — switch to a premium note to post this.'
        : /out of NOTES/i.test(error.message)
          ? 'You are out of NOTES, so you cannot comment right now.'
          : error.message,
    };
  }

  const [comments, wallet] = await Promise.all([
    supabase.rpc('cat_comments', { p_cat_id: catId }),
    getNotesWallet(),
  ]);

  return {
    ok: true,
    comments: (comments.data ?? []) as CommentRow[],
    wallet: wallet ?? EMPTY_WALLET,
  };
}

/* ------------------------------------------------------------------- notes */

const EMPTY_WALLET: NotesWallet = {
  daily_notes_balance: 0,
  premium_notes_balance: 0,
  daily_notes_spent: 0,
  premium_notes_spent: 0,
  next_reset_at: new Date(0).toISOString(),
};

/**
 * The signed-in user's own wallet. my_notes() applies any owed 24h top-up as a
 * side effect, so simply viewing a page is enough to refill the daily notes.
 */
export async function getNotesWallet(): Promise<NotesWallet | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.rpc('my_notes');
  if (error) return null;

  return (data as NotesWallet[] | null)?.[0] ?? null;
}

/* ------------------------------------------------------------------ upload */

export async function uploadCat(formData: FormData): Promise<{ error: string } | never> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in to upload a cat.' };

  const file = formData.get('image');
  const caption = String(formData.get('caption') ?? '').trim();

  if (!(file instanceof File) || file.size === 0) return { error: 'Pick an image first.' };
  if (!file.type.startsWith('image/')) return { error: 'That file is not an image.' };
  if (file.size > 5 * 1024 * 1024) return { error: 'Images must be under 5 MB.' };

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();
  if (profileError) return { error: profileError.message };

  const extension = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${user.id}/${Date.now()}.${extension || 'jpg'}`;

  const { error: storageError } = await supabase.storage
    .from('cat-photos')
    .upload(path, file, { contentType: file.type, upsert: false });
  if (storageError) return { error: storageError.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from('cat-photos').getPublicUrl(path);

  const { error: insertError } = await supabase.from('cats').insert({
    image_url: publicUrl,
    source_type: 'user_upload',
    caption: caption || null,
    uploaded_by: profile.id,
  });
  if (insertError) return { error: insertError.message };

  revalidatePath('/');
  redirect('/upload?uploaded=1');
}

/* ----------------------------------------------------------------- profile */

export type SaveProfileResult = { ok: true } | { ok: false; error: string };

/** The signed-in user's own editable fields, for the settings form. */
export async function getMyProfile(): Promise<MyProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('display_name, profile_picture_url, bio')
    .eq('user_id', user.id)
    .maybeSingle();

  return (data as MyProfile | null) ?? { display_name: null, profile_picture_url: null, bio: null };
}

/**
 * Saves display name, bio and (optionally) a new avatar. The picture goes to
 * the `avatars` bucket under the user's own folder, mirroring uploadCat().
 */
export async function saveProfile(formData: FormData): Promise<SaveProfileResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to edit your profile.' };

  const displayName = String(formData.get('display_name') ?? '').trim();
  const bio = String(formData.get('bio') ?? '').trim();

  if (displayName.length > 40) return { ok: false, error: 'Display names are capped at 40 characters.' };
  if (bio.length > 300) return { ok: false, error: 'Bios are capped at 300 characters.' };
  if (displayName && isProfane(displayName)) {
    return { ok: false, error: 'Please pick a display name without that language.' };
  }
  if (bio && isProfane(bio)) {
    return { ok: false, error: 'Please reword your bio without that language.' };
  }

  let pictureUrl: string | null = null;
  const file = formData.get('avatar');

  if (file instanceof File && file.size > 0) {
    if (!file.type.startsWith('image/')) return { ok: false, error: 'That file is not an image.' };
    if (file.size > 2 * 1024 * 1024) return { ok: false, error: 'Profile pictures must be under 2 MB.' };

    const extension = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    // The leading user id folder is what the storage RLS policy checks.
    const path = `${user.id}/${Date.now()}.${extension || 'jpg'}`;

    const { error: storageError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { contentType: file.type, upsert: false });
    if (storageError) return { ok: false, error: storageError.message };

    pictureUrl = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
  }

  const { error } = await supabase.rpc('update_my_profile', {
    p_display_name: displayName,
    p_bio: bio,
    // null leaves the existing picture in place.
    p_profile_picture_url: pictureUrl,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/* --------------------------------------------------------------- purchases */

/**
 * Placeholder checkout. There is no payment processor yet, so this never
 * charges anything and never credits a note.
 *
 * When Stripe goes in, this action should create a Checkout Session server-side
 * (never trusting a price from the client -- look it up from NOTE_PACKAGES by
 * id, as below) and redirect to session.url. The premium notes themselves must
 * be credited by the checkout.session.completed webhook running with the
 * service-role key, not here and not on the browser's return trip: only the
 * webhook can prove money actually moved.
 */
export async function startCheckout(packageId: string): Promise<{ error: string }> {
  const pkg = findNotePackage(packageId);
  if (!pkg) return { error: 'That package does not exist.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Sign in to buy premium NOTES.' };

  return {
    error: `Payments aren't live yet — the ${pkg.notes}-note pack is not purchasable for now.`,
  };
}

/* -------------------------------------------------------------------- auth */

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/');
  redirect('/');
}
