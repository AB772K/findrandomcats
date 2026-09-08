export type CatSourceType = 'user_upload' | 'cat_api' | 'wikimedia' | 'unsplash';

export type Cat = {
  id: string;
  image_url: string;
  source_type: CatSourceType;
  source_url: string | null;
  author_name: string | null;
  license: string | null;
  caption: string | null;
  uploaded_by: string | null;
  view_count: number;
  created_at: string;
};

export type Profile = {
  id: string;
  user_id: string;
  daily_notes_balance: number;
  daily_notes_spent: number;
  premium_notes_balance: number;
  premium_notes_spent: number;
  daily_notes_reset_at: string;
  display_name: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  premium_comment_color: string | null;
  premium_comment_glow: boolean;
  created_at: string;
};

/** Which wallet pays for a comment. */
export type NoteKind = 'daily' | 'premium';

/** How many daily notes a full top-up restores. */
export const DAILY_NOTES_ALLOWANCE = 3;

/** The signed-in user's own wallet, from my_notes(). Never another user's. */
export type NotesWallet = {
  daily_notes_balance: number;
  premium_notes_balance: number;
  daily_notes_spent: number;
  premium_notes_spent: number;
  /** ISO timestamp when the daily allowance next tops up. */
  next_reset_at: string;
};

/** The subset of a profile anyone may see, straight from public_profile(). */
export type PublicProfile = {
  id: string;
  display_name: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  created_at: string;
  comment_count: number;
  daily_notes_spent: number;
  premium_notes_spent: number;
  rating_count: number;
};

/** What the signed-in user may edit about themselves. */
export type MyProfile = {
  display_name: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  premium_comment_color: string | null;
  premium_comment_glow: boolean;
  /**
   * Current premium balance, not lifetime spend: styling is gated on holding a
   * premium NOTE right now, and the server function checks the same thing.
   */
  premium_notes_balance: number;
};

/** Used when a premium commenter has not picked a colour. */
export const DEFAULT_PREMIUM_COLOR = '#e3a5c0';

/** One row per star value that actually received at least one rating. */
export type RatingTally = {
  stars: number;
  count: number;
  percent: number;
};

/**
 * A comment as returned by cat_comments(): the author's public fields are
 * joined in server-side. `author_id` is a profiles.id, safe to put in a URL.
 */
export type CommentRow = {
  id: string;
  cat_id: string;
  body: string;
  created_at: string;
  /** Null until the author edits it. */
  edited_at: string | null;
  used_premium_note: boolean;
  author_id: string | null;
  display_name: string | null;
  profile_picture_url: string | null;
  /** The author's chosen accent. Null on non-premium comments and unset styles. */
  premium_comment_color: string | null;
  premium_comment_glow: boolean;
  /** True only for the signed-in reader's own comments. */
  is_mine: boolean;
  /** ISO timestamp after which this comment can no longer be edited or removed. */
  editable_until: string;
};

/** How long after posting a comment stays editable. Mirrors comment_edit_window(). */
export const COMMENT_EDIT_WINDOW_MS = 10 * 60 * 1000;

/** Everything the cat card needs, assembled server-side. */
export type CatBundle = {
  cat: Cat;
  tallies: RatingTally[];
  totalRatings: number;
  myStars: number | null;
  comments: CommentRow[];
};
