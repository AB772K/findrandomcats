'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { Cat, CatBundle, CommentRow, RatingTally } from '@/lib/types';

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
    user
      ? supabase
          .from('comments')
          .select('*')
          .eq('cat_id', cat.id)
          .order('created_at', { ascending: false })
          .limit(100)
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
  | { ok: true; comments: CommentRow[]; notesBalance: number }
  | { ok: false; error: string };

/**
 * Comments cost 1 NOTE. The charge and the insert happen inside the
 * post_comment() Postgres function so they cannot get out of sync.
 */
export async function postComment(catId: string, body: string): Promise<PostCommentResult> {
  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: 'Write something first.' };
  if (trimmed.length > 2000) return { ok: false, error: 'Comments are capped at 2000 characters.' };

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to comment.' };

  const { error } = await supabase.rpc('post_comment', { p_cat_id: catId, p_body: trimmed });
  if (error) {
    return {
      ok: false,
      error: /out of NOTES/i.test(error.message)
        ? 'You are out of NOTES, so you cannot comment right now.'
        : error.message,
    };
  }

  const [comments, profile] = await Promise.all([
    supabase
      .from('comments')
      .select('*')
      .eq('cat_id', catId)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('profiles').select('notes_balance').eq('user_id', user.id).single(),
  ]);

  return {
    ok: true,
    comments: (comments.data ?? []) as CommentRow[],
    notesBalance: profile.data?.notes_balance ?? 0,
  };
}

/* ------------------------------------------------------------------- notes */

export async function getNotesBalance(): Promise<number | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('notes_balance')
    .eq('user_id', user.id)
    .maybeSingle();

  return data?.notes_balance ?? 0;
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

/* -------------------------------------------------------------------- auth */

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  revalidatePath('/');
  redirect('/');
}
