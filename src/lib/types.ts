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
  created_at: string;
};

export type Profile = {
  id: string;
  user_id: string;
  notes_balance: number;
  created_at: string;
};

/** One row per star value that actually received at least one rating. */
export type RatingTally = {
  stars: number;
  count: number;
  percent: number;
};

export type CommentRow = {
  id: string;
  cat_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

/** Everything the cat card needs, assembled server-side. */
export type CatBundle = {
  cat: Cat;
  tallies: RatingTally[];
  totalRatings: number;
  myStars: number | null;
  comments: CommentRow[];
};
