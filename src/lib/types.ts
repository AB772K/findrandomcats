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
  premium_comment_font: string | null;
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
  display_title: string | null;
  display_title_tier: 1 | 2 | 3 | null;
};

/** Lifetime reactions a profile has RECEIVED, from profile_reaction_totals(). */
export type ReactionTotals = {
  likes: number;
  funny: number;
  loves: number;
  dislikes: number;
};

/** What the signed-in user may edit about themselves. */
export type MyProfile = {
  display_name: string | null;
  profile_picture_url: string | null;
  bio: string | null;
  premium_comment_color: string | null;
  premium_comment_glow: boolean;
  premium_comment_font: string | null;
  /** The achievement title currently on display, or null. */
  premium_display_title: string | null;
  /**
   * Current premium balance, not lifetime spend: styling is gated on holding a
   * premium NOTE right now, and the server function checks the same thing.
   */
  premium_notes_balance: number;
};

/** One title a profile has earned, from profile_titles(). */
export type ProfileTitle = {
  category: LeaderboardMetric;
  /** Percentile band: 1 is the top 1% and the rarest. */
  tier: 1 | 2 | 3;
  title: string;
  /** Human name for the category, e.g. "Hearts". */
  label: string;
  awarded_at: string;
};

/** What each tier is called, for the picker and the profile page. */
export const TIER_LABELS: Record<number, string> = {
  1: 'Top 1%',
  2: 'Top 2%',
  3: 'Top 3%',
};

/**
 * One neon per tier, borrowed from the premium-glow language so a title reads
 * as the same family of thing rather than a new one.
 *
 * `glow` is a text-shadow rather than a box-shadow: a title often sits INSIDE a
 * premium comment that is already glowing at the box level, and two box glows
 * layered on each other turn to mush. Lighting the letters instead stays legible
 * on top of one.
 *
 * Rarest is warmest: tier 1 is the gold nobody else has, and cools through
 * cyan to violet as the tier widens.
 */
export const TIER_NEON: Record<number, { color: string; glow: string }> = {
  1: { color: '#ffcf3d', glow: '0 0 6px rgba(255,207,61,.85), 0 0 14px rgba(255,170,0,.45)' },
  2: { color: '#3ddbff', glow: '0 0 6px rgba(61,219,255,.85), 0 0 14px rgba(0,170,255,.4)' },
  3: { color: '#c17dff', glow: '0 0 6px rgba(193,125,255,.8), 0 0 14px rgba(150,80,255,.35)' },
};

/** Used when a premium commenter has not picked a colour. */
export const DEFAULT_PREMIUM_COLOR = '#e3a5c0';

/** The four reactions a comment can carry. */
export type ReactionKind = 'like' | 'funny' | 'love' | 'dislike';

/** Icon + label for each reaction, shared by the bar and the emoji picker. */
export const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'like', emoji: '\u{1F44D}', label: 'Like' },
  { kind: 'funny', emoji: '\u{1F602}', label: 'Funny' },
  { kind: 'love', emoji: '\u2764\uFE0F', label: 'Love' },
  { kind: 'dislike', emoji: '\u{1F44E}', label: 'Dislike' },
];

/** Counts returned by set_comment_reaction(), used to patch a row in place. */
export type ReactionState = {
  like_count: number;
  funny_count: number;
  love_count: number;
  dislike_count: number;
  my_reaction: ReactionKind | null;
};

/** The six ranked lists on /leaderboard. */
/** Reaction metrics only -- NOTES spent is deliberately not rankable. */
/** One month in which a profile held a title, kept after the badge is gone. */
export type ProfileTitleHistoryRow = {
  category: LeaderboardMetric;
  tier: 1 | 2 | 3;
  title: string;
  label: string;
  /** First of the month this was true, matching the payout ledger's period. */
  period: string;
  recorded_at: string;
};

export type LeaderboardMetric =
  | 'likes'
  | 'funny'
  | 'loves'
  | 'dislikes'
  | 'daily_notes_spent'
  | 'premium_notes_spent';

/**
 * A Badge: a top-three place on THIS month's leaderboard. Live, so it changes
 * hands the moment someone overtakes you -- unlike a Title, which is all-time
 * and permanent once earned.
 */
export type ProfileBadge = {
  metric: LeaderboardMetric;
  rank: number;
  score: number;
};

/** A Badge that was still held when a month was settled, and so was paid. */
export type ProfileBadgeHistoryRow = ProfileBadge & {
  period: string;
  recorded_at: string;
};

/** Human names for the six boards, shared by the profile and the leaderboard. */
export const METRIC_LABELS: Record<LeaderboardMetric, string> = {
  likes: 'Likes',
  funny: 'Funny',
  loves: 'Hearts',
  dislikes: 'Dislikes',
  daily_notes_spent: 'Daily NOTES spent',
  premium_notes_spent: 'Premium NOTES spent',
};

/** Podium treatment for the three badge ranks. */
export const BADGE_RANKS: Record<number, { label: string; medal: string; color: string; glow: string }> = {
  1: { label: '1st', medal: '\u{1F947}', color: '#ffd75e', glow: '0 0 8px rgba(255,215,94,.8)' },
  2: { label: '2nd', medal: '\u{1F948}', color: '#d7dee8', glow: '0 0 8px rgba(215,222,232,.7)' },
  3: { label: '3rd', medal: '\u{1F949}', color: '#e0a06a', glow: '0 0 8px rgba(224,160,106,.7)' },
};

/** How many ranks per board earn a Badge. Mirrors badge_rank_limit() in SQL. */
export const BADGE_RANK_LIMIT = 3;

/** Which window a board covers. Monthly is the current calendar month. */
export type LeaderboardScope = 'monthly' | 'all-time';

export type LeaderboardRow = {
  profile_id: string;
  display_name: string | null;
  profile_picture_url: string | null;
  score: number;
};

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
  premium_comment_font: string | null;
  /** The author's selected Title, on every comment they write. */
  display_title: string | null;
  /** Its percentile band, so the Title can be drawn in its tier's neon. */
  display_title_tier: 1 | 2 | 3 | null;
  /** True when this comment was paid for with a premium NOTE. */
  shows_premium_title: boolean;
  like_count: number;
  funny_count: number;
  love_count: number;
  dislike_count: number;
  /** The reader's own reaction, or null. Never anyone else's. */
  my_reaction: ReactionKind | null;
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
