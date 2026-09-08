'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { NO_CAT_MESSAGE, UNAVAILABLE_MESSAGE, detectCat } from '@/lib/cat-detector';
import { findNotePackage } from '@/lib/notes';
import { isPremiumFontKey } from '@/app/fonts/premium';
import { PROFANITY_MESSAGE, isProfane } from '@/lib/profanity';
import type {
  Cat,
  CatBundle,
  CommentRow,
  MyProfile,
  LeaderboardMetric,
  LeaderboardRow,
  LeaderboardScope,
  NoteKind,
  NotesWallet,
  ReactionKind,
  ReactionState,
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
export async function fetchRandomCat(
  seenIds: string[] = [],
  preferCommented = false,
): Promise<CatBundle | null> {
  const supabase = createClient();

  // Every 4th pull asks for a cat that already has a thread, so comments people
  // wrote do not vanish the moment the feed moves on. Early in a database's
  // life there may be no commented cats at all, so this always falls back.
  const rpc = preferCommented ? 'random_commented_cat' : 'random_cat';

  let { data, error } = await supabase.rpc(rpc, { exclude_ids: seenIds });

  if (!error && (!data || data.length === 0) && preferCommented) {
    ({ data, error } = await supabase.rpc('random_cat', { exclude_ids: seenIds }));
  }

  // Every cat seen already -- start over rather than dead-end the user.
  if (!error && (!data || data.length === 0) && seenIds.length > 0) {
    ({ data, error } = await supabase.rpc('random_cat', { exclude_ids: [] }));
  }

  if (error) throw new Error(error.message);

  const cat = (data as Cat[] | null)?.[0];
  return cat ? loadBundle(cat) : null;
}

/** One cat by id, for the detail page reached from a profile's upload grid. */
export async function fetchCat(catId: string): Promise<CatBundle | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from('cats').select('*').eq('id', catId).maybeSingle();
  if (error || !data) return null;
  return loadBundle(data as Cat);
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

export type CommentMutationResult =
  | { ok: true; comments: CommentRow[]; wallet?: NotesWallet }
  | { ok: false; error: string };

async function reloadComments(catId: string): Promise<CommentRow[]> {
  const supabase = createClient();
  const { data } = await supabase.rpc('cat_comments', { p_cat_id: catId });
  return (data ?? []) as CommentRow[];
}

/**
 * Edits your own comment inside the 10-minute window. No NOTE moves: the NOTE
 * paid for the comment, not for its wording.
 */
export async function editComment(
  catId: string,
  commentId: string,
  body: string,
): Promise<CommentMutationResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Write something first.' };
  if (trimmed.length > 2000) return { ok: false, error: 'Comments are capped at 2000 characters.' };
  if (isProfane(trimmed)) return { ok: false, error: PROFANITY_MESSAGE };

  const supabase = createClient();
  const { error } = await supabase.rpc('edit_comment', {
    p_comment_id: commentId,
    p_body: trimmed,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, comments: await reloadComments(catId) };
}

/** Deletes your own comment inside the same window. The NOTE is not refunded. */
export async function deleteComment(
  catId: string,
  commentId: string,
): Promise<CommentMutationResult> {
  const supabase = createClient();
  const { error } = await supabase.rpc('delete_comment', { p_comment_id: commentId });
  if (error) return { ok: false, error: error.message };

  // Deleting refunds the NOTE, so the wallet has to come back with the comments
  // or the balance on screen would still show it as spent.
  const [comments, wallet] = await Promise.all([reloadComments(catId), getNotesWallet()]);
  return { ok: true, comments, wallet: wallet ?? undefined };
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

  // Verify there is actually a cat in there BEFORE anything is stored, so a
  // rejected photo leaves nothing behind in the bucket to clean up.
  const bytes = await file.arrayBuffer();
  const check = await detectCat(bytes);
  if (!check.ok) {
    // 'unavailable' means we could not decide. Fail closed: an upload nobody
    // checked is exactly what this is meant to prevent.
    return { error: check.reason === 'no-cat' ? NO_CAT_MESSAGE : UNAVAILABLE_MESSAGE };
  }

  const extension = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${user.id}/${Date.now()}.${extension || 'jpg'}`;

  const { error: storageError } = await supabase.storage
    .from('cat-photos')
    .upload(path, bytes, { contentType: file.type, upsert: false });
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
  // Land on their own profile so the new cat is visible in the upload grid
  // straight away; the query param carries the toast across the redirect.
  redirect(`/u/${profile.id}?uploaded=${Date.now()}`);
}

/* --------------------------------------------------------------- reactions */

export type ReactionResult =
  | { ok: true; state: ReactionState }
  | { ok: false; error: string };

/**
 * Applies a reaction to a comment. The toggle/switch decision lives in
 * set_comment_reaction() so it stays atomic: sending the reaction you already
 * have removes it, a different one replaces it. Returns the fresh counts so the
 * caller can patch one row rather than refetch the thread.
 */
export async function reactToComment(
  commentId: string,
  reaction: ReactionKind,
): Promise<ReactionResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to react.' };

  const { data, error } = await supabase.rpc('set_comment_reaction', {
    p_comment_id: commentId,
    p_reaction: reaction,
  });
  if (error) return { ok: false, error: error.message };

  const row = (data as ReactionState[] | null)?.[0];
  if (!row) return { ok: false, error: 'Could not save that reaction.' };

  return { ok: true, state: row };
}

/* ------------------------------------------------------------ delete a cat */

export type DeleteCatResult = { ok: true; refunded: number } | { ok: false; error: string };

/**
 * Removes one of your own uploads. delete_cat() checks ownership itself and
 * refunds a premium NOTE to everyone who paid one to comment on it -- they lose
 * the thread through no fault of their own. Daily notes are not refunded; they
 * cost nothing and top back up anyway.
 */
/**
 * Pulls the in-bucket path back out of a Supabase public URL, which looks like
 * .../storage/v1/object/public/<bucket>/<path>. Returns null for anything that
 * is not a URL into this bucket -- an external Cat API or Wikimedia link, say.
 */
function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;

  const path = url.slice(at + marker.length).split('?')[0];
  if (!path) return null;

  try {
    return decodeURIComponent(path);
  } catch {
    // A malformed escape sequence means this is not a path we wrote.
    return null;
  }
}

export async function deleteCat(catId: string): Promise<DeleteCatResult> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in first.' };

  // Read the image details BEFORE the row goes away -- afterwards there is
  // nothing left to derive the storage path from.
  const { data: cat } = await supabase
    .from('cats')
    .select('image_url, source_type')
    .eq('id', catId)
    .maybeSingle();

  const { data, error } = await supabase.rpc('delete_cat', { p_cat_id: catId });
  if (error) return { ok: false, error: error.message };

  // Only user uploads live in our bucket; every other source_type is a hotlink
  // to somebody else's server and has no file here to remove.
  if (cat?.source_type === 'user_upload') {
    const path = storagePathFromPublicUrl(String(cat.image_url ?? ''), 'cat-photos');
    if (path) {
      // Best effort. The row and the refunds are already committed, so a
      // storage hiccup must not surface as a failed delete -- the worst case is
      // an orphaned file, which is what this whole branch exists to reduce.
      const { error: storageError } = await supabase.storage.from('cat-photos').remove([path]);
      if (storageError) {
        console.error(`deleteCat: could not remove ${path} from cat-photos`, storageError.message);
      }
    }
  }

  revalidatePath('/');
  return { ok: true, refunded: Number(data ?? 0) };
}

/* ------------------------------------------------------------ leaderboards */

export async function fetchLeaderboard(
  metric: LeaderboardMetric,
  scope: LeaderboardScope = 'all-time',
): Promise<LeaderboardRow[]> {
  const supabase = createClient();
  // Two functions rather than a flag, so neither board can be talked into
  // returning the other's window by a crafted argument.
  const rpc = scope === 'monthly' ? 'monthly_leaderboard' : 'leaderboard';
  const { data, error } = await supabase.rpc(rpc, { p_metric: metric, p_limit: 50 });
  if (error) return [];
  return (data ?? []) as LeaderboardRow[];
}

/* ----------------------------------------------------------------- profile */

export type SaveProfileResult =
  | { ok: true }
  | { ok: false; error: string; field?: 'display_name' };

/** The signed-in user's own editable fields, for the settings form. */
export async function getMyProfile(): Promise<MyProfile | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select(
      'display_name, profile_picture_url, bio, premium_comment_color, premium_comment_glow, premium_comment_font, premium_notes_balance',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  return {
    display_name: (data?.display_name as string | null) ?? null,
    profile_picture_url: (data?.profile_picture_url as string | null) ?? null,
    bio: (data?.bio as string | null) ?? null,
    premium_comment_color: (data?.premium_comment_color as string | null) ?? null,
    premium_comment_glow: Boolean(data?.premium_comment_glow),
    premium_comment_font: (data?.premium_comment_font as string | null) ?? null,
    // Styling is gated on the CURRENT balance, so read it here rather than
    // inferring anything from lifetime spend.
    premium_notes_balance: (data?.premium_notes_balance as number | null) ?? 0,
  };
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

  if (displayName.length > 40) {
    return { ok: false, error: 'Display names are capped at 40 characters.', field: 'display_name' };
  }
  if (bio.length > 300) return { ok: false, error: 'Bios are capped at 300 characters.' };
  if (displayName && isProfane(displayName)) {
    return {
      ok: false,
      error: 'Please pick a display name without that language.',
      field: 'display_name',
    };
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

  // Sent on every save, but the database only applies them while the user holds
  // a premium NOTE -- and rejects the call outright if a style is set without
  // one, so hiding the section in the UI is not the security boundary.
  const rawColor = String(formData.get('premium_comment_color') ?? '').trim();
  const glow = formData.get('premium_comment_glow') === 'on';
  const rawFont = String(formData.get('premium_comment_font') ?? '').trim().toLowerCase();
  const font = isPremiumFontKey(rawFont) ? rawFont : null;
  if (rawFont && !font) return { ok: false, error: 'Pick a font from the list.' };
  const color = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor.toLowerCase() : null;
  if (rawColor && !color) return { ok: false, error: 'Pick a colour in #rrggbb form.' };

  const { error } = await supabase.rpc('update_my_profile', {
    p_display_name: displayName,
    p_bio: bio,
    // null leaves the existing picture in place.
    p_profile_picture_url: pictureUrl,
    p_premium_comment_color: color,
    p_premium_comment_glow: glow,
    p_premium_comment_font: font,
  });
  if (error) {
    // update_my_profile() already rewords the unique violation, but a direct
    // constraint error can still surface if the function is out of date.
    const taken =
      /already taken/i.test(error.message) ||
      /profiles_display_name_lower_key|duplicate key/i.test(error.message);
    if (/premium NOTE/i.test(error.message)) {
      return { ok: false, error: 'Premium comment styling needs at least 1 premium NOTE.' };
    }
    return {
      ok: false,
      error: taken ? 'That name is already taken.' : error.message,
      field: taken ? 'display_name' : undefined,
    };
  }

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
