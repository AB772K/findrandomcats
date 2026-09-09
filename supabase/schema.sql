-- FindRandomCats schema
-- Run this in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).

-- ---------------------------------------------------------------- enums
do $do$ begin
  create type cat_source_type as enum ('user_upload', 'cat_api', 'wikimedia', 'unsplash');
exception when duplicate_object then null; end $do$;

-- ------------------------------------------------------------- profiles
create table if not exists public.profiles (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null unique references auth.users (id) on delete cascade,
  notes_balance integer not null default 3 check (notes_balance >= 0), -- renamed to daily_notes_balance below
  created_at    timestamptz not null default now()
);

-- Public-facing profile fields. Nullable: a profile is perfectly usable blank,
-- and the UI falls back to an initials avatar / "Cat lover".
alter table public.profiles add column if not exists display_name        text;
alter table public.profiles add column if not exists profile_picture_url text;
alter table public.profiles add column if not exists bio                 text;

-- ------------------------------------------------------ the two wallets
-- NOTES come in two flavours. Daily notes top up to 3 every 24h and are free;
-- premium notes are bought, never expire, and are only ever added by a paid
-- purchase. They are tracked in separate columns so a top-up can never quietly
-- inflate something the user paid for.
--
-- notes_balance / notes_spent predate the split -- rename them in place so
-- existing wallets and lifetime totals carry over instead of resetting to zero.
do $do$ begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'notes_balance')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'profiles'
                       and column_name = 'daily_notes_balance')
  then
    alter table public.profiles rename column notes_balance to daily_notes_balance;
  end if;

  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'profiles'
               and column_name = 'notes_spent')
     and not exists (select 1 from information_schema.columns
                     where table_schema = 'public' and table_name = 'profiles'
                       and column_name = 'daily_notes_spent')
  then
    alter table public.profiles rename column notes_spent to daily_notes_spent;
  end if;
end $do$;

-- Fresh installs get the columns outright; the renames above make these no-ops.
alter table public.profiles add column if not exists daily_notes_balance integer not null default 3;
alter table public.profiles add column if not exists daily_notes_spent   integer not null default 0;
alter table public.profiles add column if not exists premium_notes_balance integer not null default 0;
alter table public.profiles add column if not exists premium_notes_spent   integer not null default 0;

-- When the daily allowance was last topped up. Defaulting to epoch rather than
-- now() means every existing profile is immediately due a top-up on first read.
alter table public.profiles add column if not exists daily_notes_reset_at timestamptz not null default 'epoch';

do $do$ begin
  alter table public.profiles add constraint profiles_daily_notes_balance_nonneg
    check (daily_notes_balance >= 0);
exception when duplicate_object then null; end $do$;

do $do$ begin
  alter table public.profiles add constraint profiles_premium_notes_balance_nonneg
    check (premium_notes_balance >= 0);
exception when duplicate_object then null; end $do$;

do $do$ begin
  alter table public.profiles add constraint profiles_premium_notes_spent_nonneg
    check (premium_notes_spent >= 0);
exception when duplicate_object then null; end $do$;

do $do$ begin
  alter table public.profiles add constraint profiles_display_name_len
    check (display_name is null or length(btrim(display_name)) between 1 and 40);
exception when duplicate_object then null; end $do$;

do $do$ begin
  alter table public.profiles add constraint profiles_bio_len
    check (bio is null or length(bio) <= 300);
exception when duplicate_object then null; end $do$;

-- Premium comment styling. Only settable while holding a premium NOTE (see
-- update_my_profile), but the stored values keep applying afterwards -- the
-- comments were already paid for.
alter table public.profiles add column if not exists premium_comment_color text;
alter table public.profiles add column if not exists premium_comment_glow boolean not null default false;
alter table public.profiles add column if not exists premium_comment_font text;

-- Whitelisted rather than free text: the value becomes a CSS class name on the
-- client, and only these six have a font actually shipped for them.
--
-- Dropped and re-added rather than guarded with a duplicate_object handler,
-- because the list itself changes: the original six were swapped out for this
-- set, and a constraint that already exists would otherwise keep the old names.
alter table public.profiles drop constraint if exists profiles_premium_comment_font_known;

-- Anyone still holding a retired font falls back to the default style rather
-- than failing the new constraint. premiumFontClass() ignores unknown keys too,
-- so this is belt and braces on top of a UI that already degrades gracefully.
update public.profiles
set premium_comment_font = null
where premium_comment_font is not null
  and premium_comment_font not in
    ('fraunces', 'grotesk', 'bricolage', 'dancing', 'baloo', 'instrument');

alter table public.profiles add constraint profiles_premium_comment_font_known
  check (premium_comment_font is null or premium_comment_font in
    ('fraunces', 'grotesk', 'bricolage', 'dancing', 'baloo', 'instrument'));

do $do$ begin
  -- Constrained to a 6-digit hex literal so the value can be dropped straight
  -- into a style attribute without becoming an injection vector.
  alter table public.profiles add constraint profiles_premium_comment_color_hex
    check (premium_comment_color is null or premium_comment_color ~* '^#[0-9a-f]{6}$');
exception when duplicate_object then null; end $do$;

-- Display names are unique the way Instagram handles usernames: case
-- insensitive, so "Sarah" and "sarah" cannot both exist. Partial, because any
-- number of people may still have no display name at all.
create unique index if not exists profiles_display_name_lower_key
  on public.profiles (lower(display_name))
  where display_name is not null;

do $do$ begin
  alter table public.profiles add constraint profiles_daily_notes_spent_nonneg
    check (daily_notes_spent >= 0);
exception when duplicate_object then null; end $do$;

-- ----------------------------------------------------------------- cats
create table if not exists public.cats (
  id          uuid primary key default gen_random_uuid(),
  image_url   text not null,
  source_type cat_source_type not null,
  source_url  text,
  author_name text,
  license     text,
  caption     text,
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- -------------------------------------------------------------- ratings
create table if not exists public.ratings (
  id         uuid primary key default gen_random_uuid(),
  cat_id     uuid not null references public.cats (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  stars      integer not null check (stars between 1 and 10),
  created_at timestamptz not null default now(),
  constraint ratings_cat_user_unique unique (cat_id, user_id)
);

-- ------------------------------------------------------------- comments
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  cat_id     uuid not null references public.cats (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  body       text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now()
);

-- How many times random_cat() / random_commented_cat() has served this cat.
-- Bumped inside those functions so a view is only counted when a cat is
-- actually handed to a viewer, not on every render of an already-loaded card.
alter table public.cats add column if not exists view_count integer not null default 0;

do $do$ begin
  alter table public.cats add constraint cats_view_count_nonneg check (view_count >= 0);
exception when duplicate_object then null; end $do$;

-- Which wallet paid for this comment. Drives the premium styling in the UI and
-- is set inside post_comment(), never by the client.
alter table public.comments add column if not exists used_premium_note boolean not null default false;

-- Set by edit_comment(); null means the comment has never been changed.
alter table public.comments add column if not exists edited_at timestamptz;

-- --------------------------------------------------- comment reactions
do $do$ begin
  create type comment_reaction as enum ('like', 'funny', 'love', 'dislike');
exception when duplicate_object then null; end $do$;

-- One row per (comment, user). The unique constraint is what makes reactions
-- switchable rather than stackable: changing your mind updates the row instead
-- of adding a second one. Removing a reaction deletes the row outright.
--
-- Reacting to your own comment is allowed, matching how the big social sites
-- behave. It is not much of a leaderboard exploit: every comment costs a NOTE,
-- so self-congratulation is rate-limited by the wallet.
create table if not exists public.comment_reactions (
  id         uuid primary key default gen_random_uuid(),
  comment_id uuid not null references public.comments (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  reaction   comment_reaction not null,
  created_at timestamptz not null default now(),
  constraint comment_reactions_comment_user_unique unique (comment_id, user_id)
);

create index if not exists comment_reactions_comment_id_idx on public.comment_reactions (comment_id);
create index if not exists comment_reactions_user_id_idx on public.comment_reactions (user_id);

create index if not exists comments_cat_id_created_at_idx on public.comments (cat_id, created_at desc);
create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists ratings_cat_id_idx on public.ratings (cat_id);
create index if not exists ratings_user_id_idx on public.ratings (user_id);

-- Backfill for databases created before the spend counters existed: every
-- comment on record cost exactly 1 NOTE, and every one of those predates the
-- premium wallet, so they all count as daily spend. Runs after comments so a
-- fresh install is a no-op.
update public.profiles p
set daily_notes_spent = c.n
from (select user_id, count(*)::int as n from public.comments group by user_id) c
where c.user_id = p.user_id and p.daily_notes_spent = 0;

-- --------------------------------------- profile on signup (3 DAILY NOTES)
-- Signup grants daily notes only. Premium notes are never handed out for free.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (user_id, daily_notes_balance, premium_notes_balance, daily_notes_reset_at)
  values (new.id, 3, 0, now())
  on conflict (user_id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------- comment edit window
-- How long after posting a comment may still be changed or removed. Defined
-- once here so the RLS policy, edit_comment(), delete_comment() and the value
-- the UI counts down to can never drift apart.
create or replace function public.comment_edit_window()
returns interval
language sql
immutable
as $fn$
  select interval '10 minutes';
$fn$;

grant execute on function public.comment_edit_window() to anon, authenticated;

-- ------------------------------------------------------------------ RLS
alter table public.profiles enable row level security;
alter table public.cats     enable row level security;
alter table public.ratings  enable row level security;
alter table public.comments enable row level security;
alter table public.comment_reactions enable row level security;

-- profiles: you can read your own row and nothing else. Writes go through the
-- security-definer functions further down, never straight at the table.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = user_id);

-- There is deliberately NO update policy, and no write grant below.
--
-- There used to be one -- "profiles: update own", for update using
-- (auth.uid() = user_id) -- and with the table-level UPDATE grant that
-- authenticated holds by default it let a signed-in user PATCH their own
-- profiles row through PostgREST and set any column on it. That is not a
-- theoretical hole: a plain user account could set premium_notes_balance to
-- 9999 in one request, and could equally write premium_display_title,
-- daily_notes_spent or premium_comment_* directly.
--
-- Every gate in this schema lives in a security-definer function --
-- update_my_profile() checks the premium NOTE before allowing a style,
-- set_display_title() checks the badge is held, post_comment() charges the
-- wallet -- and all of them were decorative while the client could simply
-- write the row itself. Nothing in the app ever needed the grant: every
-- profiles access in src/ is a SELECT, and every write already goes through
-- one of those functions.
--
-- So writes are revoked at the grant level as well as the policy level. Two
-- locks rather than one, because a future policy added without the grants in
-- mind should not silently reopen this.
-- The policy is dropped as well as the grants. An earlier pass revoked the
-- grants but left "profiles: update own" in place, inert; an audit found it
-- still listed in pg_policies. Inert is not gone, and a later grant would have
-- woken it up.
drop policy if exists "profiles: update own" on public.profiles;

revoke insert, update, delete, truncate, references
  on public.profiles from anon, authenticated;

-- cats: readable by everyone, insertable by signed-in users as themselves.
drop policy if exists "cats: public read" on public.cats;
create policy "cats: public read" on public.cats
  for select using (true);

-- The insert policy is the one place a signed-in client still writes a table
-- directly, so it carries the whole weight. It used to check only that
-- uploaded_by was your own profile, which left the row itself forgeable: an
-- audit inserted a cat straight through PostgREST with an arbitrary image_url
-- and source_type = 'cat_api', never going near uploadCat() and so never
-- meeting the cat detector that is supposed to be impossible to skip.
--
-- It cannot be made airtight from here -- the detector runs in Node, not in
-- Postgres, and anything reachable from the client is reachable without the
-- app. What it CAN do is stop the row being a lie: the image must live in this
-- project's own cat-photos bucket under the uploader's own user id, so a cat
-- row can only ever point at a file that user actually uploaded, and it must
-- be marked user_upload rather than dressed up as seeded cat_api content.
drop policy if exists "cats: authenticated insert" on public.cats;
create policy "cats: authenticated insert" on public.cats
  for insert to authenticated
  with check (
    source_type = 'user_upload'
    and image_url like '%/storage/v1/object/public/cat-photos/' || auth.uid()::text || '/%'
    and
    uploaded_by in (select id from public.profiles where user_id = auth.uid())
  );

-- ratings: a user can read and write ONLY their own rating row. Aggregates are
-- served by cat_rating_summary() below, so no client can ever map a star value
-- back to a person.
drop policy if exists "ratings: read own" on public.ratings;
create policy "ratings: read own" on public.ratings
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "ratings: insert own" on public.ratings;
create policy "ratings: insert own" on public.ratings
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "ratings: update own" on public.ratings;
create policy "ratings: update own" on public.ratings
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- comments: any signed-in user may read them; you may only remove your own.
-- Retired. It was `using (true)`, which let any signed-in client read every
-- comment row including its user_id -- while cat_comments() deliberately
-- returns author_id, a profiles.id, precisely so that link is not handed out.
-- The direct read gave back what the function was shaped to withhold, and
-- nothing in src/ ever used it: comments are read through cat_comments().
drop policy if exists "comments: authenticated read" on public.comments;

-- There is deliberately no DELETE policy any more. Deleting now refunds a NOTE,
-- and that refund has to happen in the same transaction as the delete, so
-- delete_comment() must be the only way through -- a direct PostgREST delete
-- would remove the comment and silently keep the NOTE spent. The function
-- re-checks ownership and the 10-minute window itself, so nothing is lost by
-- dropping the policy.
drop policy if exists "comments: delete own" on public.comments;
-- Likewise there is no UPDATE policy: edits must go through edit_comment(),
-- which re-checks ownership and the window.

-- comment_reactions: no policies at all. Counts reach the client already
-- aggregated by cat_comments(), and writes go through set_comment_reaction(),
-- which owns the toggle/switch logic. Direct row access would let a client
-- enumerate exactly who reacted to what.
drop policy if exists "reactions: read all" on public.comment_reactions;
-- NOTE: there is deliberately no INSERT policy. Comments must go through
-- post_comment(), which charges the NOTE in the same transaction.

-- ------------------------------------------------------------ random cat
-- Volatile plpgsql rather than a stable sql function: serving a cat also counts
-- a view, so this writes.
--
-- SECURITY DEFINER is load-bearing, not decoration. `cats` has RLS enabled with
-- a SELECT policy and an INSERT policy but NO UPDATE policy, so the view_count
-- bump below matches zero rows for anon and authenticated callers -- and since
-- the function returns exactly those updated rows, it handed back nothing and
-- the feed reported "No cats in the database yet" against a table with 22 cats
-- in it. Running as the owner is what lets the counter be written. The only
-- write is +1 to view_count on the single id already chosen, and `cats` is
-- world-readable anyway, so this grants the caller nothing they lacked.
create or replace function public.random_cat(exclude_ids uuid[] default '{}')
returns setof public.cats
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  select c.id into v_id
  from public.cats c
  where not (c.id = any (exclude_ids))
  order by random()
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
    update public.cats
    set view_count = view_count + 1
    where id = v_id
    returning *;
end;
$fn$;

-- ------------------------------------------------- random commented cat
-- Cats scroll past and their comment threads become unreachable, so the feed
-- deliberately loops back to ones people have talked about. Weighted by comment
-- count via -ln(random()) / weight, which draws each row with probability
-- proportional to its weight, so a busy thread resurfaces more often than one
-- with a single reply -- without ever pinning the same cat to the top.
create or replace function public.random_commented_cat(exclude_ids uuid[] default '{}')
returns setof public.cats
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_id uuid;
begin
  select c.id into v_id
  from public.cats c
  join (
    select cat_id, count(*)::int as n
    from public.comments
    group by cat_id
  ) t on t.cat_id = c.id
  where not (c.id = any (exclude_ids))
  order by -ln(random()) / t.n
  limit 1;

  if v_id is null then
    return;
  end if;

  return query
    update public.cats
    set view_count = view_count + 1
    where id = v_id
    returning *;
end;
$fn$;

-- --------------------------------------------------- anonymous aggregates
create or replace function public.cat_rating_summary(p_cat_id uuid)
returns table (stars integer, count bigint, percent numeric)
language sql
stable
security definer
set search_path = public
as $fn$
  with tallies as (
    select r.stars, count(*)::bigint as count
    from public.ratings r
    where r.cat_id = p_cat_id
    group by r.stars
  ), total as (
    select coalesce(sum(count), 0)::bigint as n from tallies
  )
  select t.stars,
         t.count,
         round((t.count * 100.0) / nullif((select n from total), 0), 1) as percent
  from tallies t
  order by t.stars;
$fn$;

grant execute on function public.cat_rating_summary(uuid) to anon, authenticated;
grant execute on function public.random_cat(uuid[]) to anon, authenticated;
grant execute on function public.random_commented_cat(uuid[]) to anon, authenticated;

-- ------------------------------------------- comments with their authors
-- Comments live behind RLS and profiles are readable only by their owner, so a
-- plain join would return nothing for other people's names. Same trick as
-- cat_rating_summary(): a security-definer function hands back exactly the
-- public fields (profile id, display name, avatar) and nothing else -- never
-- the author's email, user_id, or NOTES balance.
-- Return type changes, so the old signature has to go first.
drop function if exists public.cat_comments(uuid);

create function public.cat_comments(p_cat_id uuid)
returns table (
  id                    uuid,
  cat_id                uuid,
  body                  text,
  created_at            timestamptz,
  edited_at             timestamptz,
  used_premium_note     boolean,
  author_id             uuid,
  display_name          text,
  profile_picture_url   text,
  premium_comment_color text,
  premium_comment_glow  boolean,
  premium_comment_font  text,
  display_title         text,
  -- The percentile band of the displayed Title, so a comment can be coloured
  -- by tier without a second lookup per row.
  display_title_tier    smallint,
  shows_premium_title   boolean,
  is_mine               boolean,
  editable_until        timestamptz,
  like_count            bigint,
  funny_count           bigint,
  love_count            bigint,
  dislike_count         bigint,
  my_reaction           text
)
language sql
stable
security definer
set search_path = public
as $fn$
  select c.id,
         c.cat_id,
         c.body,
         c.created_at,
         c.edited_at,
         c.used_premium_note,
         p.id,
         p.display_name,
         p.profile_picture_url,
         -- Styling only travels with comments that actually cost a premium
         -- NOTE, so a custom look cannot leak onto ordinary ones.
         case when c.used_premium_note then p.premium_comment_color end,
         case when c.used_premium_note then coalesce(p.premium_comment_glow, false) else false end,
         case when c.used_premium_note then p.premium_comment_font end,
         -- An achievement title, once selected, rides on every comment the
         -- author writes -- daily or premium. It was earned, not bought.
         p.premium_display_title,
         (select b.tier
            from public.profile_badges b
            join public.badge_titles t
              on t.category = b.category and t.tier = b.tier
           where b.profile_id = p.id and t.title = p.premium_display_title
           limit 1),
         -- The Premium mark is different: it is not an achievement and is not
         -- selectable. It appears exactly when a comment was paid for with a
         -- premium NOTE, so it says something about this comment rather than
         -- about the person.
         c.used_premium_note,
         -- Ownership as a bare boolean: the UI needs to know whether to offer
         -- edit/delete without ever learning whose user_id owns a comment.
         c.user_id = auth.uid(),
         c.created_at + public.comment_edit_window(),
         -- Reactions come back pre-aggregated. The only per-person fact
         -- returned is the reader's OWN reaction -- nobody can learn who else
         -- reacted to what.
         coalesce(rx.likes, 0),
         coalesce(rx.funny, 0),
         coalesce(rx.loves, 0),
         coalesce(rx.dislikes, 0),
         (select r.reaction::text
          from public.comment_reactions r
          where r.comment_id = c.id and r.user_id = auth.uid())
  from public.comments c
  left join public.profiles p on p.user_id = c.user_id
  left join lateral (
    select count(*) filter (where r.reaction = 'like')    as likes,
           count(*) filter (where r.reaction = 'funny')   as funny,
           count(*) filter (where r.reaction = 'love')    as loves,
           count(*) filter (where r.reaction = 'dislike') as dislikes
    from public.comment_reactions r
    where r.comment_id = c.id
  ) rx on true
  where c.cat_id = p_cat_id
  order by c.created_at desc
  limit 100;
$fn$;

grant execute on function public.cat_comments(uuid) to authenticated;

-- --------------------------------------------------- react to a comment
-- Toggle/switch in one call: sending the reaction you already have removes it,
-- sending a different one replaces it, and the unique constraint guarantees a
-- person can never hold two reactions on the same comment. Returns the fresh
-- counts so the caller does not have to refetch the whole thread.
create or replace function public.set_comment_reaction(
  p_comment_id uuid,
  p_reaction   text
)
returns table (
  like_count    bigint,
  funny_count   bigint,
  love_count    bigint,
  dislike_count bigint,
  my_reaction   text
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_existing comment_reaction;
  v_wanted   comment_reaction;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to react.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.comments where id = p_comment_id) then
    raise exception 'That comment no longer exists.' using errcode = 'P0002';
  end if;

  -- Reacting to yourself is refused here, not merely hidden in the UI: the
  -- reaction bar is disabled on your own comments, but a hand-rolled RPC call
  -- would otherwise let anyone inflate their own leaderboard standing.
  if exists (
    select 1 from public.comments
    where id = p_comment_id and user_id = auth.uid()
  ) then
    raise exception 'You can''t react to your own comment.' using errcode = '42501';
  end if;

  -- Invalid values are rejected by the cast rather than silently ignored.
  begin
    v_wanted := p_reaction::comment_reaction;
  exception when invalid_text_representation then
    raise exception 'Unknown reaction.' using errcode = '22023';
  end;

  select r.reaction into v_existing
  from public.comment_reactions r
  where r.comment_id = p_comment_id and r.user_id = auth.uid();

  if v_existing is not null and v_existing = v_wanted then
    delete from public.comment_reactions
    where comment_id = p_comment_id and user_id = auth.uid();
  else
    insert into public.comment_reactions (comment_id, user_id, reaction)
    values (p_comment_id, auth.uid(), v_wanted)
    on conflict (comment_id, user_id) do update set reaction = excluded.reaction;
  end if;

  return query
    select count(*) filter (where r.reaction = 'like'),
           count(*) filter (where r.reaction = 'funny'),
           count(*) filter (where r.reaction = 'love'),
           count(*) filter (where r.reaction = 'dislike'),
           max(r.reaction::text) filter (where r.user_id = auth.uid())
    from public.comment_reactions r
    where r.comment_id = p_comment_id;
end;
$fn$;

grant execute on function public.set_comment_reaction(uuid, text) to authenticated;

-- ------------------------------------------------------ public profiles
-- The /u/[id] page reads only through these two functions. Lifetime spend is
-- public; the wallets are not. Deliberately absent: daily_notes_balance,
-- premium_notes_balance, user_id, email, and any per-cat rating rows.
-- Return type changes (notes_spent splits in two), so drop the old one first.
drop function if exists public.public_profile(uuid);

create function public.public_profile(p_profile_id uuid)
returns table (
  id                  uuid,
  display_name        text,
  profile_picture_url text,
  bio                 text,
  created_at          timestamptz,
  comment_count       bigint,
  daily_notes_spent   integer,
  premium_notes_spent integer,
  rating_count        bigint,
  display_title       text,
  display_title_tier  smallint
)
language sql
stable
security definer
set search_path = public
as $fn$
  select p.id,
         p.display_name,
         p.profile_picture_url,
         p.bio,
         p.created_at,
         (select count(*) from public.comments c where c.user_id = p.user_id),
         p.daily_notes_spent,
         p.premium_notes_spent,
         (select count(*) from public.ratings r where r.user_id = p.user_id),
         p.premium_display_title,
         (select b.tier
            from public.profile_badges b
            join public.badge_titles t
              on t.category = b.category and t.tier = b.tier
           where b.profile_id = p.id and t.title = p.premium_display_title
           limit 1)
  from public.profiles p
  where p.id = p_profile_id;
$fn$;

-- Aggregate-only view of the stars this person has GIVEN. Returns tallies, so
-- there is no way to map a star value back to a specific cat.
create or replace function public.profile_rating_summary(p_profile_id uuid)
returns table (stars integer, count bigint, percent numeric)
language sql
stable
security definer
set search_path = public
as $fn$
  with mine as (
    select r.stars
    from public.ratings r
    join public.profiles p on p.user_id = r.user_id
    where p.id = p_profile_id
  ), tallies as (
    select m.stars, count(*)::bigint as count from mine m group by m.stars
  ), total as (
    select coalesce(sum(count), 0)::bigint as n from tallies
  )
  select t.stars,
         t.count,
         round((t.count * 100.0) / nullif((select n from total), 0), 1) as percent
  from tallies t
  order by t.stars;
$fn$;

-- Lifetime reactions RECEIVED across everything this person has written.
-- Aggregate only: totals, never which comment or who reacted.
create or replace function public.profile_reaction_totals(p_profile_id uuid)
returns table (likes bigint, funny bigint, loves bigint, dislikes bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select count(*) filter (where r.reaction = 'like'),
         count(*) filter (where r.reaction = 'funny'),
         count(*) filter (where r.reaction = 'love'),
         count(*) filter (where r.reaction = 'dislike')
  from public.profiles p
  join public.comments c on c.user_id = p.user_id
  join public.comment_reactions r on r.comment_id = c.id
  where p.id = p_profile_id;
$fn$;

grant execute on function public.profile_reaction_totals(uuid) to anon, authenticated;

-- ----------------------------------------------------- notes spend log
-- daily_notes_spent and premium_notes_spent on profiles are lifetime counters,
-- so they can answer "who has spent the most ever" but not "who has spent the
-- most this month" -- the number carries no dates. This is the missing half:
-- one row per NOTE spent, stamped with when.
--
-- comment_id is what makes refunds exact. A NOTE is refunded by deleting its
-- row, not by writing a negative one, so a month can never go negative and the
-- monthly board always agrees with the lifetime counter beside it. It is
-- ON DELETE SET NULL rather than CASCADE deliberately: deleting a cat refunds
-- the premium NOTES spent on it but NOT the daily ones, so the rows have to
-- outlive the comment and be removed only where a refund actually happened.
create table if not exists public.notes_spend_log (
  id         bigserial   primary key,
  profile_id uuid        not null references public.profiles(id) on delete cascade,
  comment_id uuid        references public.comments(id) on delete set null,
  kind       text        not null,
  created_at timestamptz not null default now(),
  constraint notes_spend_log_kind_known check (kind in ('daily', 'premium'))
);

create index if not exists notes_spend_log_month_idx
  on public.notes_spend_log (kind, created_at, profile_id);
create index if not exists notes_spend_log_comment_idx
  on public.notes_spend_log (comment_id);

-- Reachable only through the security-definer functions below, same as the
-- payout ledger: enabled, no policies, so PostgREST can see nothing directly.
alter table public.notes_spend_log enable row level security;

-- Backfill from the comments that already exist, using each comment's own
-- timestamp. Without this the monthly board would read as empty until people
-- started commenting again, which would look like a broken feature rather than
-- a new one. Guarded on the table being empty so re-running the schema does
-- not double every historical spend.
insert into public.notes_spend_log (profile_id, comment_id, kind, created_at)
select p.id,
       c.id,
       case when c.used_premium_note then 'premium' else 'daily' end,
       c.created_at
from public.comments c
join public.profiles p on p.user_id = c.user_id
where not exists (select 1 from public.notes_spend_log);

-- ------------------------------------------------------- leaderboards
-- Board metric name -> reaction enum value. Kept in one place so the all-time
-- and monthly boards cannot drift apart on what 'loves' means.
create or replace function public.metric_reaction(p_metric text)
returns comment_reaction
language sql
immutable
as $fn$
  select case p_metric
           when 'likes'    then 'like'
           when 'funny'    then 'funny'
           when 'loves'    then 'love'
           when 'dislikes' then 'dislike'
         end::comment_reaction;
$fn$;

grant execute on function public.metric_reaction(text) to anon, authenticated;

-- One month's score for any metric, whatever it is counted from.
--
-- The monthly board and the monthly payout both rank the same thing, so they
-- read it from the same function rather than each carrying their own copy of
-- the query -- the reason metric_reaction() exists, applied one level up. The
-- two arms are mutually exclusive: a metric is either a reaction or a wallet,
-- so exactly one of them ever returns rows.
create or replace function public.monthly_metric_tally(
  p_metric text,
  p_start  timestamptz,
  p_end    timestamptz
)
returns table (profile_id uuid, score bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  -- Reactions RECEIVED in the window, by the author who earned them.
  select p.id, count(*)::bigint
  from public.profiles p
  join public.comments c on c.user_id = p.user_id
  join public.comment_reactions r on r.comment_id = c.id
  where public.metric_reaction(p_metric) is not null
    and r.reaction = public.metric_reaction(p_metric)
    and r.created_at >= p_start
    and r.created_at <  p_end
  group by p.id

  union all

  -- NOTES spent in the window, from the log rather than the lifetime counter.
  select l.profile_id, count(*)::bigint
  from public.notes_spend_log l
  where p_metric in ('daily_notes_spent', 'premium_notes_spent')
    and l.kind = case p_metric when 'daily_notes_spent' then 'daily' else 'premium' end
    and l.created_at >= p_start
    and l.created_at <  p_end
  group by l.profile_id;
$fn$;

grant execute on function public.monthly_metric_tally(text, timestamptz, timestamptz) to anon, authenticated;

-- The all-time counterpart, for the same reason: the all-time board and the
-- all-time badges must rank identically, so they read from one query. Reactions
-- are counted; NOTES spent come from the lifetime counters on the profile,
-- which are the authority on a lifetime total and predate the spend log.
create or replace function public.all_time_metric_tally(p_metric text)
returns table (profile_id uuid, score bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select p.id, count(*)::bigint
  from public.profiles p
  join public.comments c on c.user_id = p.user_id
  join public.comment_reactions r on r.comment_id = c.id
  where public.metric_reaction(p_metric) is not null
    and r.reaction = public.metric_reaction(p_metric)
  group by p.id
  having count(*) > 0

  union all

  select p.id,
         (case p_metric
            when 'daily_notes_spent' then p.daily_notes_spent
            else p.premium_notes_spent
          end)::bigint
  from public.profiles p
  where p_metric in ('daily_notes_spent', 'premium_notes_spent')
    and (case p_metric
           when 'daily_notes_spent' then p.daily_notes_spent
           else p.premium_notes_spent
         end) > 0;
$fn$;

grant execute on function public.all_time_metric_tally(text) to anon, authenticated;

-- One function, one metric per call, whitelisted. Returns nothing but the
-- name, the avatar and the single number being ranked -- no wallet balances,
-- no user ids, no emails, and no way to ask for a column that is not on the
-- list. Profiles scoring zero are left out rather than padding the table.
--
-- Six metrics: the four reaction boards, plus the two NOTES-spent boards. The
-- spend boards were dropped once for ranking who burned the most currency
-- rather than who the room liked; they are back because they now have a
-- monthly window, where spending is a month's effort rather than an
-- accumulated total nobody can catch up with.
create or replace function public.leaderboard(p_metric text, p_limit integer default 50)
returns table (
  profile_id          uuid,
  display_name        text,
  profile_picture_url text,
  score               bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
begin
  if p_metric not in ('likes', 'funny', 'loves', 'dislikes',
                      'daily_notes_spent', 'premium_notes_spent') then
    raise exception 'Unknown leaderboard.' using errcode = '22023';
  end if;

  return query
    select p.id, p.display_name, p.profile_picture_url, t.score
    from public.all_time_metric_tally(p_metric) t
    join public.profiles p on p.id = t.profile_id
    order by t.score desc, p.display_name asc nulls last
    limit v_limit;
end;
$fn$;

grant execute on function public.leaderboard(text, integer) to anon, authenticated;

-- ------------------------------------------------- this month's standings
-- Same shape, same whitelist, same security-definer stance as leaderboard();
-- the only difference is the window. Filtered on comment_reactions.created_at,
-- so the board is the reactions RECEIVED this calendar month rather than the
-- comments written in it -- an old comment that gets loved today still counts
-- toward today's month.
--
-- The NOTES-spent boards are windowed the same way, off notes_spend_log rather
-- than the lifetime counters, which is the whole reason that table exists.
--
-- date_trunc('month', now()) means no reset job is needed anywhere: the board
-- empties itself the moment the date rolls over.
create or replace function public.monthly_leaderboard(p_metric text, p_limit integer default 50)
returns table (
  profile_id          uuid,
  display_name        text,
  profile_picture_url text,
  score               bigint
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
  v_start timestamptz := date_trunc('month', now());
  v_end   timestamptz := date_trunc('month', now()) + interval '1 month';
begin
  if p_metric not in ('likes', 'funny', 'loves', 'dislikes',
                      'daily_notes_spent', 'premium_notes_spent') then
    raise exception 'Unknown leaderboard.' using errcode = '22023';
  end if;

  return query
    select p.id, p.display_name, p.profile_picture_url, t.score
    from public.monthly_metric_tally(p_metric, v_start, v_end) t
    join public.profiles p on p.id = t.profile_id
    where t.score > 0
    order by t.score desc, p.display_name asc nulls last
    limit v_limit;
end;
$fn$;

grant execute on function public.monthly_leaderboard(text, integer) to anon, authenticated;

-- ==================================================== monthly payouts ====
-- Ledger of every reward ever issued. The unique key is what makes the payout
-- idempotent: a second run for the same month inserts nothing and therefore
-- credits nothing, so a retried cron job or a nervous manual re-run is safe.
create table if not exists public.leaderboard_payouts (
  id            uuid primary key default gen_random_uuid(),
  period        date not null,
  metric        text not null,
  profile_id    uuid not null references public.profiles (id) on delete cascade,
  rank          integer not null,
  notes_awarded integer not null,
  paid_at       timestamptz not null default now(),
  constraint leaderboard_payouts_unique unique (period, metric, profile_id)
);

create index if not exists leaderboard_payouts_profile_idx on public.leaderboard_payouts (profile_id);

alter table public.leaderboard_payouts enable row level security;
-- No policies: this is a system ledger. Nothing in the app reads it directly.

-- The prize scale. Ranks past 50 are worth nothing, which is also what keeps
-- the payout bounded no matter how large the site gets.
create or replace function public.payout_for_rank(p_rank integer)
returns integer
language sql
immutable
as $fn$
  select case
           when p_rank = 1  then 50
           when p_rank = 2  then 30
           when p_rank = 3  then 20
           when p_rank = 4  then 15
           when p_rank = 5  then 10
           when p_rank = 6  then 8
           when p_rank = 7  then 6
           when p_rank = 8  then 5
           when p_rank = 9  then 4
           when p_rank = 10 then 3
           when p_rank between 11 and 50 then 1
           else 0
         end;
$fn$;

-- Pays out one finished month, all four categories, and returns what it did.
--
-- p_period is any date inside the month to settle; it defaults to LAST month,
-- which is what the 1st-of-the-month cron job wants.
--
-- This is the one legitimate place premium_notes_balance goes up outside a
-- payment webhook: the notes are issued by the system as a prize, not bought.
-- It is deliberately NOT granted to anon or authenticated -- only the owner and
-- service_role may call it, so no client can award itself anything.
--
-- Ties share a rank and therefore share a prize (standard competition ranking):
-- two people tied at the top both take 50 and the next is rank 3. The
-- alternative, breaking ties by name, would hand out 50 versus 30 on alphabetical
-- order, which is not a thing anyone should lose 20 notes to.
create or replace function public.run_monthly_leaderboard_payout(p_period date default null)
returns table (metric text, profiles_paid integer, notes_awarded integer)
language plpgsql
security definer
set search_path = public
as $fn$
-- The OUT parameter names (metric, notes_awarded) are also column names in
-- leaderboard_payouts, so unqualified references inside the statement below are
-- ambiguous. Resolve them to the column, which is what every one of them means;
-- assignments to the OUT variables are plpgsql statements and unaffected.
#variable_conflict use_column
declare
  v_period date := coalesce(
    date_trunc('month', p_period)::date,
    (date_trunc('month', now()) - interval '1 month')::date
  );
  v_start timestamptz := v_period::timestamptz;
  v_end   timestamptz := (v_period + interval '1 month')::timestamptz;
  m       text;
  v_paid  integer;
  v_notes integer;
begin
  -- Every board pays, on the same scale. The two NOTES-spent boards are ranked
  -- from the same monthly_metric_tally() the monthly board displays, so what
  -- someone was shown all month is exactly what they are paid for.
  foreach m in array array['likes', 'funny', 'loves', 'dislikes',
                           'daily_notes_spent', 'premium_notes_spent'] loop
    with tallies as (
      select t.profile_id, t.score
      from public.monthly_metric_tally(m, v_start, v_end) t
      where t.score > 0
    ), ranked as (
      select profile_id,
             rank() over (order by score desc)::integer as rnk
      from tallies
    ), prizes as (
      select profile_id, rnk, public.payout_for_rank(rnk) as notes
      from ranked
      where rnk <= 50
    ), inserted as (
      insert into public.leaderboard_payouts (period, metric, profile_id, rank, notes_awarded)
      select v_period, m, profile_id, rnk, notes
      from prizes
      where notes > 0
      on conflict (period, metric, profile_id) do nothing
      returning profile_id, notes_awarded
    ), credited as (
      update public.profiles p
      set premium_notes_balance = p.premium_notes_balance + i.notes_awarded
      from inserted i
      where p.id = i.profile_id
      returning i.notes_awarded
    )
    select count(*)::integer, coalesce(sum(notes_awarded), 0)::integer
    into v_paid, v_notes
    from credited;

    -- The badge for this metric is settled at the same instant it is paid.
    -- Ranked from the same window the prizes came from, so the holder recorded
    -- here is exactly the holder who was paid -- and someone who held the badge
    -- earlier in the month and lost it before now gets nothing, which is the
    -- whole point of a badge being live and stealable.
    insert into public.monthly_badge_history (profile_id, metric, rank, score, period)
    select r.profile_id, m, r.rnk, r.score, v_period
    from (
      select t.profile_id,
             t.score,
             rank() over (order by t.score desc)::integer as rnk
      from public.monthly_metric_tally(m, v_start, v_end) t
      where t.score > 0
    ) r
    where r.rnk <= public.badge_rank_limit()
    on conflict (profile_id, metric, period) do nothing;

    return query select m, v_paid, v_notes;
  end loop;

  -- Badges are recomputed in the same job, right after the prizes settle, so
  -- the two can never disagree about a month.
  perform public.recompute_profile_badges(v_period);
end;
$fn$;

-- Clients must never be able to call this.
revoke all on function public.run_monthly_leaderboard_payout(date) from public, anon, authenticated;

-- ======================================================= badges & titles ==
-- Eighteen achievement titles: six categories x three percentile tiers. The
-- category keys are the same ones the leaderboards use, so there is one
-- vocabulary for 'loves' rather than a second one saying 'hearts'.
create table if not exists public.badge_titles (
  category text     not null,
  tier     smallint not null,
  title    text     not null unique,
  label    text     not null,
  primary key (category, tier),
  constraint badge_titles_category_known check (category in ('likes', 'funny', 'loves', 'dislikes')),
  constraint badge_titles_tier_known     check (tier in (1, 2, 3))
);

-- The category list grew with the two NOTES-spent boards. A CHECK constraint
-- cannot be added conditionally, so it is dropped and rewritten -- which also
-- means an existing database picks up the new categories on re-running this.
alter table public.badge_titles drop constraint if exists badge_titles_category_known;
alter table public.badge_titles add constraint badge_titles_category_known
  check (category in ('likes', 'funny', 'loves', 'dislikes',
                      'daily_notes_spent', 'premium_notes_spent'));

-- tier is the percentile band, so 1 = top 1% and is the rarest.
insert into public.badge_titles (category, tier, title, label) values
  ('loves',    3, 'Fine',             'Hearts'),
  ('loves',    2, 'Gorgeous',         'Hearts'),
  ('loves',    1, 'Rizzler',          'Hearts'),
  ('likes',    3, 'Elite',            'Likes'),
  ('likes',    2, 'Majestic',         'Likes'),
  ('likes',    1, 'The GOAT',         'Likes'),
  ('funny',    3, 'Comedian',         'Funny'),
  ('funny',    2, 'Unhinged',         'Funny'),
  ('funny',    1, 'Absolute Cinema',  'Funny'),
  ('dislikes', 3, 'Obnoxious',        'Disliked'),
  ('dislikes', 2, 'Opps Everywhere',  'Disliked'),
  ('dislikes', 1, 'Most Wanted',      'Disliked'),
  ('daily_notes_spent',   3, 'Regular',         'Daily NOTES'),
  ('daily_notes_spent',   2, 'Addicted',        'Daily NOTES'),
  ('daily_notes_spent',   1, 'Obsessed',        'Daily NOTES'),
  ('premium_notes_spent', 3, 'Premium Enjoyer', 'Premium NOTES'),
  ('premium_notes_spent', 2, 'Whale',           'Premium NOTES'),
  ('premium_notes_spent', 1, 'The Financier',   'Premium NOTES')
on conflict (category, tier) do update
  set title = excluded.title, label = excluded.label;

-- What each profile currently holds. Primary key on (profile_id, category)
-- means one badge per category -- the best tier reached, not a collection of
-- all three.
create table if not exists public.profile_badges (
  profile_id  uuid        not null references public.profiles (id) on delete cascade,
  category    text        not null,
  tier        smallint    not null,
  awarded_at  timestamptz not null default now(),
  primary key (profile_id, category),
  foreign key (category, tier) references public.badge_titles (category, tier)
);

create index if not exists profile_badges_profile_idx on public.profile_badges (profile_id);

alter table public.badge_titles   enable row level security;
alter table public.profile_badges enable row level security;

-- The eighteen titles are public knowledge -- people should be able to see what
-- is out there to earn. Who holds what is served by profile_titles() instead,
-- so profile_badges itself needs no policy.
drop policy if exists "badge titles: public read" on public.badge_titles;
create policy "badge titles: public read" on public.badge_titles for select using (true);

-- The title a profile has chosen to display. Written only by
-- set_display_title(), which checks the badge is actually held.
alter table public.profiles add column if not exists premium_display_title text;

-- ------------------------------------------------------ title history
-- What a profile held, month by month, kept after the badge itself is gone.
-- profile_badges answers "who holds this now" and is overwritten every time
-- the job runs; this answers "who held it in September 2026", which no amount
-- of current state can reconstruct.
--
-- period matches leaderboard_payouts' convention -- the first of the month the
-- settlement was for -- so a payout row and a history row from the same run
-- carry the same date and can be read side by side.
--
-- title is stored rather than looked up through badge_titles. A title that is
-- later renamed or retired must still read correctly in the history of the
-- month it was actually held; a foreign key would rewrite the past instead.
create table if not exists public.badge_history (
  profile_id  uuid        not null references public.profiles (id) on delete cascade,
  category    text        not null,
  tier        smallint    not null,
  title       text        not null,
  period      date        not null,
  recorded_at timestamptz not null default now(),
  -- One tier of one category per month. The insert below is ON CONFLICT DO
  -- NOTHING, so this key is what makes a settled month immutable: a re-run
  -- neither duplicates the row nor rewrites it.
  primary key (profile_id, category, period)
);

create index if not exists badge_history_profile_idx
  on public.badge_history (profile_id, period desc);

-- Served only through profile_title_history(), like profile_badges.
alter table public.badge_history enable row level security;

-- NOTE ON HISTORICAL DATA: there is deliberately no backfill here. Before this
-- table existed nothing recorded which tier anyone held in a past month, and
-- profile_badges holds only the present, so earlier months cannot be
-- reconstructed -- inventing them from today's standings would be a fabricated
-- record, not a recovered one. History starts at the next run of the job.

-- ------------------------------------------------ recompute every title
-- Run monthly, not on every reaction: recomputing live would make titles
-- appear mid-scroll. Titles are PERMANENT once earned -- this job grants and
-- improves, never removes. See the upsert below for why.
--
-- Percentile is taken among profiles with at least one of that thing -- one
-- reaction of that type, or one NOTE spent from that wallet -- so the
-- denominator is people actually in the running rather than every account that
-- ever signed up. greatest(1, ceil(n * pct)) keeps the top tier
-- reachable on a small site: with 40 contenders ceil(0.4) is 1, so exactly one
-- Rizzler exists rather than none at all.
-- Adding the parameter would otherwise create a second overload alongside the
-- old zero-argument version, leaving two functions of the same name and a
-- coin toss over which one the job calls.
drop function if exists public.recompute_profile_badges();

create or replace function public.recompute_profile_badges(p_period date default null)
returns table (category text, granted integer, revoked integer)
language plpgsql
security definer
set search_path = public
as $fn$
#variable_conflict use_column
declare
  cat       text;
  v_granted integer;
  v_revoked integer;
  -- Defaults to the month the payout settles, so calling this on its own
  -- stamps history the same way the monthly job does.
  v_period  date := coalesce(
    date_trunc('month', p_period)::date,
    (date_trunc('month', now()) - interval '1 month')::date
  );
begin
  foreach cat in array array['likes', 'funny', 'loves', 'dislikes',
                             'daily_notes_spent', 'premium_notes_spent'] loop
    with tallies as (
      select t.profile_id, t.score
      from public.all_time_metric_tally(cat) t
    ), totals as (
      select count(*)::numeric as n from tallies
    ), ranked as (
      select t.profile_id, rank() over (order by t.score desc) as rnk
      from tallies t
    ), tiered as (
      select r.profile_id,
             (case
                when r.rnk <= greatest(1, ceil((select n from totals) * 0.01)) then 1
                when r.rnk <= greatest(1, ceil((select n from totals) * 0.02)) then 2
                when r.rnk <= greatest(1, ceil((select n from totals) * 0.03)) then 3
              end)::smallint as tier
      from ranked r
    ), qualified as (
      select profile_id, tier from tiered where tier is not null
    ), upserted as (
      -- TITLES ARE PERMANENT. This job only ever grants or improves; it does
      -- not take anything away.
      --
      -- There used to be a `pruned` step here deleting the badge of anyone who
      -- had slipped out of the top 3%, on the reasoning that an all-time board
      -- moves as other people catch up. That is now a deliberate reversal: a
      -- title records that you once stood there, and standing there later
      -- becomes harder as the site grows, so taking it back punishes people for
      -- other users' activity rather than their own. Do not reinstate it.
      --
      -- `least` is what makes the upsert one-directional: tier 1 is the rarest,
      -- so the smaller number wins and a drop from Top 1% to Top 3% leaves the
      -- existing tier alone. Only an improvement restamps awarded_at, so
      -- "held since" keeps meaning the day that tier was reached.
      insert into public.profile_badges (profile_id, category, tier)
      select q.profile_id, cat, q.tier from qualified q
      on conflict (profile_id, category) do update
        set tier = least(profile_badges.tier, excluded.tier),
            awarded_at = case
                           when excluded.tier < profile_badges.tier
                           then now() else profile_badges.awarded_at
                         end
      returning profile_id
    )
    select (select count(*)::integer from upserted), 0
    into v_granted, v_revoked;

    -- Snapshot the whole category, not just what changed: the question this
    -- answers is "what did people hold in this month", so a profile holding
    -- steady has to appear every month, not only the month it first won.
    -- Same statement, same transaction as the grant/revoke above, so history
    -- and current holdings can never disagree about a month.
    insert into public.badge_history (profile_id, category, tier, title, period)
    select b.profile_id, b.category, b.tier, t.title, v_period
    from public.profile_badges b
    join public.badge_titles t on t.category = b.category and t.tier = b.tier
    where b.category = cat
    -- DO NOTHING, not DO UPDATE. A month's record is written once and is then
    -- immutable. The previous version restamped the row on conflict, which
    -- made re-running the job for an already-settled month rewrite that month
    -- using TODAY's standings -- silently turning a record of what was true in
    -- July into a claim about September. Nothing else writes this table and
    -- nothing deletes from it except a profile being deleted, so this is what
    -- makes the history permanent rather than merely usually-correct.
    --
    -- The cost is that a genuinely bad settlement cannot be corrected by
    -- re-running: its rows must be deleted first, deliberately, by hand. That
    -- is the right trade -- an explicit deletion is visible, a silent rewrite
    -- is not.
    on conflict (profile_id, category, period) do nothing;

    return query select cat, v_granted, v_revoked;
  end loop;

  -- The sweep that cleared a display title once its badge was revoked is gone
  -- too: nothing here revokes any more, so a displayed title can no longer stop
  -- being held. set_display_title() still checks the badge at the moment of
  -- choosing, which is the only check now needed.
  --
  -- One caveat, deliberately kept: admin_set_profile_badge() can still remove a
  -- title, and clears the display itself when it does. That is a human typing a
  -- correction for a title granted in error -- the opposite of an automatic
  -- job quietly taking one back -- and it is the escape hatch that was asked
  -- for. Nothing automatic can reach it.
end;
$fn$;

revoke all on function public.recompute_profile_badges(date) from public, anon, authenticated;

-- ------------------------------------------------ what a profile holds
-- Public view of the titles a profile currently holds, for their /u/[id] page
-- and the picker on /settings. Aggregate-safe: nothing here but the badges.
create or replace function public.profile_titles(p_profile_id uuid)
returns table (category text, tier smallint, title text, label text, awarded_at timestamptz)
language sql
stable
security definer
set search_path = public
as $fn$
  select b.category, b.tier, t.title, t.label, b.awarded_at
  from public.profile_badges b
  join public.badge_titles t on t.category = b.category and t.tier = b.tier
  where b.profile_id = p_profile_id
  order by b.tier asc, t.label asc;
$fn$;

grant execute on function public.profile_titles(uuid) to anon, authenticated;

-- ------------------------------------------- what a profile has ever held
-- The history counterpart to profile_titles(), same stance: security definer,
-- aggregate-safe, nothing here but badges and the month they were held in.
-- Most recent month first, so a profile page reads newest-down.
--
-- label is joined from badge_titles for display but the title itself comes
-- from the history row, so a retired title still renders under the month it
-- was held; a category no longer in badge_titles falls back to its own key.
create or replace function public.profile_title_history(p_profile_id uuid)
returns table (
  category    text,
  tier        smallint,
  title       text,
  label       text,
  period      date,
  recorded_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select h.category,
         h.tier,
         h.title,
         coalesce(t.label, h.category),
         h.period,
         h.recorded_at
  from public.badge_history h
  left join public.badge_titles t on t.category = h.category and t.tier = h.tier
  where h.profile_id = p_profile_id
  order by h.period desc, h.category asc;
$fn$;

grant execute on function public.profile_title_history(uuid) to anon, authenticated;

-- ========================================================= badges (live) ==
-- A BADGE IS NOT A TITLE. Two systems, deliberately separate:
--
--   Title  -- all-time percentile, permanent once earned, chosen for display.
--            Stored in profile_badges / badge_history. Those names predate this
--            section and are left alone: renaming them would touch every
--            function in this file for no user-visible gain.
--   Badge  -- a top-three place on THIS MONTH's leaderboard. Not stored at all
--            while the month is running: it is computed live, so it changes
--            hands the moment someone overtakes you. That is the point of it.
--
-- WHY TOP THREE. It has to be scarce enough to be worth taking. Top ten across
-- six metrics would put sixty people in badges at once, which is a
-- participation list rather than a standing; top three gives eighteen holders
-- site-wide, and maps onto a podium people already understand.
create or replace function public.badge_rank_limit()
returns integer language sql immutable as $fn$ select 3 $fn$;

grant execute on function public.badge_rank_limit() to anon, authenticated;

-- Who holds a badge on one metric right now. Live, not a snapshot: every call
-- re-ranks the current month, so overtaking someone takes their badge away in
-- the same instant it gives you one.
create or replace function public.current_badge_holders(p_metric text)
returns table (profile_id uuid, rank integer, score bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select r.profile_id, r.rnk, r.score
  from (
    select t.profile_id,
           t.score,
           rank() over (order by t.score desc)::integer as rnk
    from public.monthly_metric_tally(
           p_metric,
           date_trunc('month', now()),
           date_trunc('month', now()) + interval '1 month') t
    where t.score > 0
  ) r
  where r.rnk <= public.badge_rank_limit();
$fn$;

grant execute on function public.current_badge_holders(text) to anon, authenticated;

-- Every badge one profile currently holds, across all six metrics.
create or replace function public.profile_badges_now(p_profile_id uuid)
returns table (metric text, rank integer, score bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select m.metric, h.rank, h.score
  from unnest(array['likes','funny','loves','dislikes',
                    'daily_notes_spent','premium_notes_spent']) as m(metric)
  cross join lateral public.current_badge_holders(m.metric) h
  where h.profile_id = p_profile_id
  order by h.rank, m.metric;
$fn$;

grant execute on function public.profile_badges_now(uuid) to anon, authenticated;

-- ------------------------------------------------------- badge history
-- The permanent half. A badge held mid-month and lost before settlement leaves
-- no trace anywhere -- only whoever holds it when the month is settled gets a
-- row here, and that is the same moment they are paid for it. Same write-once
-- guarantee as Title history: ON CONFLICT DO NOTHING, so re-running a
-- settlement cannot rewrite what a past month said.
create table if not exists public.monthly_badge_history (
  profile_id  uuid        not null references public.profiles (id) on delete cascade,
  metric      text        not null,
  rank        integer     not null,
  score       bigint      not null,
  period      date        not null,
  recorded_at timestamptz not null default now(),
  primary key (profile_id, metric, period)
);

create index if not exists monthly_badge_history_profile_idx
  on public.monthly_badge_history (profile_id, period desc);

alter table public.monthly_badge_history enable row level security;

create or replace function public.profile_badge_history(p_profile_id uuid)
returns table (metric text, rank integer, score bigint, period date, recorded_at timestamptz)
language sql
stable
security definer
set search_path = public
as $fn$
  select h.metric, h.rank, h.score, h.period, h.recorded_at
  from public.monthly_badge_history h
  where h.profile_id = p_profile_id
  order by h.period desc, h.rank asc, h.metric asc;
$fn$;

grant execute on function public.profile_badge_history(uuid) to anon, authenticated;

-- ==================================================== admin corrections ==
-- WHY THIS EXISTS, AND WHY IT IS NOT A HOLE IN THE PROTECTION ABOVE.
--
-- recompute_profile_badges() writes badge_history with ON CONFLICT DO NOTHING,
-- so a month, once settled, is immutable. That is deliberate: the automatic job
-- can be re-run for any period, and DO UPDATE would have let a re-run restamp
-- an old month with TODAY's standings -- silently turning a record of what was
-- true in July into a claim about September. Do not change that back.
--
-- But immutability with no escape hatch is its own failure. If the job never
-- ran for a month, or ran with a bug, or the site was down, the record for that
-- month is simply wrong, and the protected path cannot fix it -- DO NOTHING
-- will not correct a row that already exists, and cannot invent one for a month
-- that was never settled.
--
-- So the escape hatch is a SEPARATE function that a human calls on purpose,
-- one row at a time, with the period spelled out. The distinction that matters
-- is not "can this overwrite" -- both could -- it is whether an overwrite can
-- happen as a SIDE EFFECT of a routine job nobody is watching. The automatic
-- path must never rewrite the past by accident. This path only rewrites what
-- someone deliberately named, and it hands back what it destroyed so the
-- correction leaves a trace rather than happening silently.
--
-- Not exposed anywhere in the app, and not meant to be: call it from SQL or an
-- admin script.

-- Who may call the admin functions. A table rather than a flag on profiles: a
-- profiles row sits behind policies that have already been wrong once (a user
-- could write their own row until it was revoked above), and admin should not
-- live inside that blast radius. Nothing can read or write this table from
-- PostgREST -- RLS on, no policies, no grants -- so it is reachable only by the
-- security-definer functions below and by a direct database connection.
create table if not exists public.badge_admins (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

alter table public.badge_admins enable row level security;

-- The project owner, by email so this stays readable and portable rather than
-- carrying a bare uuid. Add others the same way, from SQL.
insert into public.badge_admins (user_id, note)
select id, 'project owner'
from auth.users
where email = 'basitzahid0@gmail.com'
on conflict (user_id) do nothing;

-- Is the caller allowed to make corrections?
create or replace function public.is_badge_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_claims text := nullif(current_setting('request.jwt.claims', true), '');
begin
  -- A direct database connection -- psql, the session pooler, a migration --
  -- carries no PostgREST request context. Whoever holds it can already write
  -- these tables directly, so gating it would protect nothing. session_user is
  -- checked as well as the claims because security definer changes
  -- current_user but not session_user, so a PostgREST request still reports
  -- the authenticator role here even if its claims were somehow absent.
  if v_claims is null
     and session_user not in ('anon', 'authenticated', 'authenticator') then
    return true;
  end if;

  -- service_role is the backend key: it reaches PostgREST with claims but no
  -- end user, and can likewise write these tables directly regardless.
  if v_claims is not null and (v_claims::json ->> 'role') = 'service_role' then
    return true;
  end if;

  -- Everyone else must be named in badge_admins. A signed-out caller has a
  -- null auth.uid(), which matches nothing.
  return exists (select 1 from public.badge_admins a where a.user_id = auth.uid());
end;
$fn$;

revoke all on function public.is_badge_admin() from public, anon, authenticated;

-- ------------------------------------------ correct one month of history
-- Deliberately an upsert, unlike the automatic path. Returns what was there
-- before, so an overwrite is reported rather than silent: 'inserted' with nulls
-- means it filled a gap, 'updated' with the old values means it replaced a
-- record, and the caller can see which.
create or replace function public.admin_backfill_badge_history(
  p_profile_id uuid,
  p_category   text,
  p_tier       integer,
  p_title      text,
  p_period     date
)
returns table (
  action               text,
  previous_tier        smallint,
  previous_title       text,
  previous_recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_title  text := btrim(coalesce(p_title, ''));
  v_prev   public.badge_history;
begin
  if not public.is_badge_admin() then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'No such profile.' using errcode = 'P0002';
  end if;
  if p_tier is null or p_tier not in (1, 2, 3) then
    raise exception 'Tier must be 1, 2 or 3.' using errcode = '22023';
  end if;
  if v_title = '' then
    raise exception 'A title is required.' using errcode = '22023';
  end if;
  -- Against the live category list rather than a second copy of it, so a typo
  -- cannot quietly create history for a board that does not exist.
  if not exists (select 1 from public.badge_titles t where t.category = p_category) then
    raise exception 'Unknown category: %', p_category using errcode = '22023';
  end if;
  if p_period is null then
    raise exception 'A period is required.' using errcode = '22023';
  end if;

  select * into v_prev
  from public.badge_history h
  where h.profile_id = p_profile_id and h.category = p_category and h.period = v_period;

  insert into public.badge_history (profile_id, category, tier, title, period)
  values (p_profile_id, p_category, p_tier::smallint, v_title, v_period)
  on conflict (profile_id, category, period) do update
    set tier = excluded.tier,
        title = excluded.title,
        recorded_at = now();

  return query select
    case when v_prev.profile_id is null then 'inserted' else 'updated' end,
    v_prev.tier,
    v_prev.title,
    v_prev.recorded_at;
end;
$fn$;

-- Reachable, but only ever successful for an admin: the body is the gate, so a
-- regular user gets a refusal rather than a silent no-op. Never granted to anon.
revoke all on function public.admin_backfill_badge_history(uuid, text, integer, text, date)
  from public, anon;
grant execute on function public.admin_backfill_badge_history(uuid, text, integer, text, date)
  to authenticated;

-- ------------------------------------- correct what someone holds RIGHT NOW
-- A parallel function rather than one doing both, because the two tables answer
-- different questions and are keyed differently: history is (profile, category,
-- period) and is a record of the past; profile_badges is (profile, category) and
-- is the present. Folding them together would mean guessing that a correction to
-- one is always a correction to the other, which is exactly the kind of implicit
-- side effect the automatic path is protected against.
--
-- A null tier revokes the badge, which is the other half of "correct it".
create or replace function public.admin_set_profile_badge(
  p_profile_id uuid,
  p_category   text,
  p_tier       integer
)
returns table (
  action              text,
  previous_tier       smallint,
  previous_awarded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_prev public.profile_badges;
begin
  if not public.is_badge_admin() then
    raise exception 'Not permitted.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = p_profile_id) then
    raise exception 'No such profile.' using errcode = 'P0002';
  end if;

  select * into v_prev
  from public.profile_badges b
  where b.profile_id = p_profile_id and b.category = p_category;

  if p_tier is null then
    delete from public.profile_badges b
    where b.profile_id = p_profile_id and b.category = p_category;

    -- A revoked badge cannot stay on display, the same sweep the monthly job
    -- performs -- otherwise a correction here would leave a title showing that
    -- its owner no longer holds.
    update public.profiles p
    set premium_display_title = null
    where p.id = p_profile_id
      and p.premium_display_title is not null
      and not exists (
        select 1
        from public.profile_badges b
        join public.badge_titles t on t.category = b.category and t.tier = b.tier
        where b.profile_id = p.id and t.title = p.premium_display_title
      );

    return query select
      case when v_prev.profile_id is null then 'nothing to revoke' else 'revoked' end,
      v_prev.tier,
      v_prev.awarded_at;
    return;
  end if;

  -- The (category, tier) foreign key to badge_titles does the validating here,
  -- so an unknown pair is refused by the constraint rather than by a copy of it.
  insert into public.profile_badges (profile_id, category, tier)
  values (p_profile_id, p_category, p_tier::smallint)
  on conflict (profile_id, category) do update
    set tier = excluded.tier,
        awarded_at = now();

  return query select
    case when v_prev.profile_id is null then 'granted' else 'changed' end,
    v_prev.tier,
    v_prev.awarded_at;
end;
$fn$;

revoke all on function public.admin_set_profile_badge(uuid, text, integer) from public, anon;
grant execute on function public.admin_set_profile_badge(uuid, text, integer) to authenticated;

-- --------------------------------------------------- choose your title
-- Only a badge you currently hold may be displayed. The picker on /settings
-- lists exactly those, but listing is not permission: this re-checks against
-- profile_badges, so a hand-rolled RPC call cannot pin "Rizzler" to a profile
-- that never earned it.
--
-- Passing null clears the title, which always succeeds -- taking your own title
-- down needs no entitlement.
create or replace function public.set_display_title(p_title text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_profile public.profiles;
  v_title   text := nullif(btrim(coalesce(p_title, '')), '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where user_id = auth.uid();
  if not found then
    raise exception 'No profile found for this account.' using errcode = 'P0002';
  end if;

  if v_title is not null and not exists (
    select 1
    from public.profile_badges b
    join public.badge_titles t on t.category = b.category and t.tier = b.tier
    where b.profile_id = v_profile.id and t.title = v_title
  ) then
    raise exception 'You have not earned that title.' using errcode = '42501';
  end if;

  update public.profiles
  set premium_display_title = v_title
  where id = v_profile.id;

  return v_title;
end;
$fn$;

grant execute on function public.set_display_title(text) to authenticated;

-- ------------------------------------------------------ scheduling it
-- pg_cron is available on this project, so the payout runs itself. If the
-- extension cannot be installed (insufficient privilege on a self-hosted
-- setup), the notice below fires and the function simply has to be invoked by
-- hand -- from the SQL editor, or with the service-role key:
--
--     select * from public.run_monthly_leaderboard_payout();          -- last month
--     select * from public.run_monthly_leaderboard_payout('2026-08-01'); -- a specific one
--
-- Either way it is idempotent, so a manual run after an automated one is a
-- no-op rather than a double payout.
do $do$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable (%): run_monthly_leaderboard_payout() must be triggered manually', sqlerrm;
end $do$;

-- Scheduled through EXECUTE so the statements are only name-resolved at run
-- time -- the whole script is parsed up front, and a bare cron.schedule() would
-- fail to parse on a database where the extension did not exist yet.
do $do$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    return;
  end if;

  -- Drop any previous definition first so re-running the script does not stack
  -- duplicate jobs.
  execute $x$ select cron.unschedule(jobid) from cron.job
               where jobname = 'findrandomcats-monthly-payout' $x$;

  -- 00:05 UTC on the 1st: past midnight, so date_trunc has certainly rolled
  -- over, and the default period is the month that just finished.
  execute $x$ select cron.schedule(
                'findrandomcats-monthly-payout',
                '5 0 1 * *',
                $job$ select public.run_monthly_leaderboard_payout(); $job$
              ) $x$;
end $do$;

grant execute on function public.public_profile(uuid) to anon, authenticated;
grant execute on function public.profile_rating_summary(uuid) to anon, authenticated;

-- --------------------------------------------- update your own profile
-- Display name / bio / avatar go through a function so the same trimming and
-- length rules apply no matter what the client sends. Neither wallet balance
-- nor either spend counter is reachable from here.
--
-- Signature gains the two styling fields, so the old three-argument version has
-- to be dropped rather than replaced.
drop function if exists public.update_my_profile(text, text, text);
drop function if exists public.update_my_profile(text, text, text, text, boolean);
-- Also the current signature, so re-running the script is a clean replace
-- rather than "already exists with same argument types".
drop function if exists public.update_my_profile(text, text, text, text, boolean, text);

-- ------------------------------------------------ the moderation backstop
-- src/lib/moderation.ts is the fuller filter and runs in the server action, but
-- update_my_profile() is granted to authenticated and so is callable directly:
-- a hand-rolled RPC call skips every check the action makes. Verified, not
-- assumed -- a probe set a bio to a threat straight through the RPC.
--
-- This is the boundary copy: the severe categories only -- self-harm, threats
-- at a person, slurs -- because those are the ones that must not survive a
-- bypass. Ordinary swearing stays in the JavaScript filter, where a false
-- positive costs nothing worse than a reworded sentence. The two are allowed to
-- differ; this one is the floor.
create or replace function public.is_harmful_text(p_text text)
returns boolean
language sql
immutable
as $fn$
  select case
    when coalesce(btrim(p_text), '') = '' then false
    else
      -- Letter-for-number swaps folded first, so the lazy disguises collapse
      -- onto the same spellings.
      translate(lower(p_text), '@4$013', 'aasoie') ~
        -- self-harm
        '(kill|hurt|harm)\s+(my|your|him|her|them)self'
        '|commit\s+suicide'
        '|(cut|slit)\s+(my|your|his|her|their)\s+wrists?'
        '|end\s+(my|your|his|her|their)\s+(own\s+)?life'
        '|\mk\s*y\s*s\M'
        -- threats aimed at a person, not the bare word "kill"
        '|(i\s*(ll|m)|i\s+will|i\s+am|imma|im|gonna|going\s+to)\s+(going\s+to\s+)?(kill|murder|stab|shoot|beat|hurt)\s+(you|u|him|her|them)\M'
        '|you\s+(will|are\s+going\s+to|gonna)\s+die\M'
        -- slurs
        '|\mretard(s|ed)?\M'
        '|\mfagg?(ot|ots|s)?\M'
        '|\mni[gq]{2}(er|a|ers|as|uh)\M'
        '|\mtranny\M|\mtrannies\M'
  end;
$fn$;

grant execute on function public.is_harmful_text(text) to authenticated;

create function public.update_my_profile(
  p_display_name          text,
  p_bio                   text,
  p_profile_picture_url   text,
  p_premium_comment_color text default null,
  p_premium_comment_glow  boolean default false,
  p_premium_comment_font  text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_profile public.profiles;
  v_glow    boolean := coalesce(p_premium_comment_glow, false);
  v_color   text    := nullif(btrim(coalesce(p_premium_comment_color, '')), '');
  v_font    text    := nullif(btrim(lower(coalesce(p_premium_comment_font, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where user_id = auth.uid() for update;

  if not found then
    raise exception 'No profile found for this account.' using errcode = 'P0002';
  end if;

  -- The real gate. The UI hides this section without premium NOTES, but hiding
  -- a control is not a permission check: a hand-rolled RPC call would otherwise
  -- set a custom style having never bought anything.
  if v_profile.premium_notes_balance < 1 and (v_color is not null or v_glow or v_font is not null) then
    raise exception 'Premium comment styling needs at least 1 premium NOTE.'
      using errcode = 'P0001';
  end if;

  if v_color is not null and v_color !~* '^#[0-9a-f]{6}$' then
    raise exception 'Pick a colour in #rrggbb form.' using errcode = '22023';
  end if;

  -- The backstop. Both fields are public: the name rides on every comment, the
  -- bio sits on the profile. See is_harmful_text() for why this exists when the
  -- server action already checks.
  if public.is_harmful_text(p_display_name) or public.is_harmful_text(p_bio) then
    raise exception 'That text is not allowed here.' using errcode = '22023';
  end if;

  if v_font is not null and v_font not in
     ('fraunces','grotesk','bricolage','dancing','baloo','instrument') then
    raise exception 'Unknown font.' using errcode = '22023';
  end if;

  begin
    update public.profiles
    set display_name        = nullif(btrim(coalesce(p_display_name, '')), ''),
        bio                 = nullif(btrim(coalesce(p_bio, '')), ''),
        profile_picture_url = coalesce(
                                nullif(btrim(coalesce(p_profile_picture_url, '')), ''),
                                profile_picture_url
                              ),
        -- Styling is only rewritten while they hold a premium NOTE. Otherwise
        -- it is left exactly as it was, so running out of NOTES never silently
        -- wipes a style they already chose.
        premium_comment_color = case
                                  when premium_notes_balance >= 1 then v_color
                                  else premium_comment_color
                                end,
        premium_comment_glow  = case
                                  when premium_notes_balance >= 1 then v_glow
                                  else premium_comment_glow
                                end,
        premium_comment_font  = case
                                  when premium_notes_balance >= 1 then v_font
                                  else premium_comment_font
                                end
    where user_id = auth.uid()
    returning * into v_profile;
  exception when unique_violation then
    -- Only one unique index can fire here, so this is unambiguous. Caught and
    -- reworded because the raw message names the index, which tells the user
    -- nothing about what to do next.
    raise exception 'That name is already taken.' using errcode = '23505';
  end;

  return v_profile;
end;
$fn$;

grant execute on function public.update_my_profile(text, text, text, text, boolean, text) to authenticated;

-- ------------------------------------------ is this nickname free?
-- Answers the live check on the onboarding form. It is a convenience, NOT the
-- rule: profiles_display_name_lower_key is still what enforces uniqueness, and
-- update_my_profile() still catches the violation and rewords it. Two people
-- typing the same name at once will both be told it is free and the second
-- save will still lose, which is correct -- a check and a write cannot be made
-- atomic across a network round trip, so the constraint stays the authority.
--
-- Security definer because profiles are readable only by their owner: without
-- it this could never see the name it is supposed to be checking against. It
-- returns a single boolean and never the row, so it cannot be used to page
-- through who holds what.
--
-- The caller's own current name counts as available, so re-saving your own
-- profile does not report your name as taken.
create or replace function public.display_name_available(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select not exists (
    select 1
    from public.profiles p
    where p.display_name is not null
      and lower(p.display_name) = lower(btrim(coalesce(p_name, '')))
      and p.user_id is distinct from auth.uid()
  );
$fn$;

grant execute on function public.display_name_available(text) to authenticated;

-- ------------------------------------------------------- the daily wallet
-- Tops the daily allowance back up to 3 if a full 24h has passed. Written as a
-- conditional UPDATE so two concurrent callers cannot both grant a top-up:
-- whoever loses the race finds daily_notes_reset_at already moved and matches
-- no rows. greatest() never removes notes a user already has.
create or replace function public.refresh_daily_notes(p_profile_id uuid)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_profile public.profiles;
begin
  update public.profiles
  set daily_notes_balance  = greatest(daily_notes_balance, 3),
      daily_notes_reset_at = now()
  where id = p_profile_id
    and now() - daily_notes_reset_at >= interval '24 hours'
  returning * into v_profile;

  if not found then
    select * into v_profile from public.profiles where id = p_profile_id;
  end if;

  return v_profile;
end;
$fn$;

-- The /notes page reads the signed-in user's own wallet through here so the
-- 24h top-up is applied on view. Balances are returned only for the caller --
-- there is no way to ask for somebody else's.
create or replace function public.my_notes()
returns table (
  daily_notes_balance   integer,
  premium_notes_balance integer,
  daily_notes_spent     integer,
  premium_notes_spent   integer,
  next_reset_at         timestamptz
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into v_profile from public.profiles where user_id = auth.uid();
  if not found then
    raise exception 'No profile found for this account.' using errcode = 'P0002';
  end if;

  v_profile := public.refresh_daily_notes(v_profile.id);

  return query select v_profile.daily_notes_balance,
                      v_profile.premium_notes_balance,
                      v_profile.daily_notes_spent,
                      v_profile.premium_notes_spent,
                      v_profile.daily_notes_reset_at + interval '24 hours';
end;
$fn$;

grant execute on function public.my_notes() to authenticated;

-- refresh_daily_notes() takes an arbitrary profile id, so no client may call it
-- -- only the security-definer functions above, which run as the owner. Postgres
-- grants EXECUTE to PUBLIC by default and anon/authenticated inherit that, so
-- the revoke has to name PUBLIC or it does nothing.
revoke all on function public.refresh_daily_notes(uuid) from public, anon, authenticated;

-- ------------------------------------- post a comment, charging 1 NOTE
-- Gains a wallet argument, so the old two-argument version has to go or calls
-- with two arguments become ambiguous against the new default.
drop function if exists public.post_comment(uuid, text);

create or replace function public.post_comment(
  p_cat_id      uuid,
  p_body        text,
  p_use_premium boolean default false
)
returns public.comments
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_profile public.profiles;
  v_comment public.comments;
  v_premium boolean;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to comment.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Comment cannot be empty.' using errcode = '22023';
  end if;

  -- Rate first. Checked here rather than only in the UI, because the UI is the
  -- half a determined caller skips -- and because this must be true before a
  -- NOTE is charged, not after. Cheap enough to sit ahead of the row lock.
  if not exists (
    select 1 from public.ratings
    where cat_id = p_cat_id and user_id = auth.uid()
  ) then
    raise exception 'Rate this cat before commenting.' using errcode = 'P0001';
  end if;

  -- Lock the profile row so two concurrent comments cannot spend the same NOTE.
  select * into v_profile
  from public.profiles
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'No profile found for this account.' using errcode = 'P0002';
  end if;

  -- Apply any owed top-up before deciding whether they can afford this.
  if now() - v_profile.daily_notes_reset_at >= interval '24 hours' then
    update public.profiles
    set daily_notes_balance  = greatest(daily_notes_balance, 3),
        daily_notes_reset_at = now()
    where id = v_profile.id
    returning * into v_profile;
  end if;

  if v_profile.daily_notes_balance < 1 and v_profile.premium_notes_balance < 1 then
    raise exception 'You are out of NOTES.' using errcode = 'P0001';
  end if;

  -- Which wallet to charge. Falling back premium -> daily is free, so it is
  -- done silently; the reverse would spend money the user did not agree to
  -- part with, so an empty daily wallet is an explicit error instead.
  if p_use_premium and v_profile.premium_notes_balance >= 1 then
    v_premium := true;
  elsif not p_use_premium and v_profile.daily_notes_balance >= 1 then
    v_premium := false;
  elsif p_use_premium then
    v_premium := false;
  else
    raise exception 'You are out of daily NOTES. Switch to a premium note to post this.'
      using errcode = 'P0001';
  end if;

  if v_premium then
    update public.profiles
    set premium_notes_balance = premium_notes_balance - 1,
        premium_notes_spent   = premium_notes_spent + 1
    where id = v_profile.id;
  else
    update public.profiles
    set daily_notes_balance = daily_notes_balance - 1,
        daily_notes_spent   = daily_notes_spent + 1
    where id = v_profile.id;
  end if;

  insert into public.comments (cat_id, user_id, body, used_premium_note)
  values (p_cat_id, auth.uid(), btrim(p_body), v_premium)
  returning * into v_comment;

  -- The dated half of the spend. The counters above answer "how many ever";
  -- this answers "how many this month", which is what the monthly board ranks.
  insert into public.notes_spend_log (profile_id, comment_id, kind, created_at)
  values (v_profile.id, v_comment.id,
          case when v_premium then 'premium' else 'daily' end,
          v_comment.created_at);

  return v_comment;
end;
$fn$;

grant execute on function public.post_comment(uuid, text, boolean) to authenticated;

-- ------------------------------------------- edit / delete your comment
-- Editing never touches either wallet: the NOTE bought the comment, not the
-- wording, so a correction is free and a deletion is not refunded (otherwise
-- post-then-delete would be a way to comment for nothing).
create or replace function public.edit_comment(p_comment_id uuid, p_body text)
returns public.comments
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_comment public.comments;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Comment cannot be empty.' using errcode = '22023';
  end if;

  if length(btrim(p_body)) > 2000 then
    raise exception 'Comments are capped at 2000 characters.' using errcode = '22023';
  end if;

  select * into v_comment from public.comments where id = p_comment_id;

  if not found then
    raise exception 'That comment no longer exists.' using errcode = 'P0002';
  end if;

  if v_comment.user_id <> auth.uid() then
    raise exception 'You can only edit your own comments.' using errcode = '42501';
  end if;

  if v_comment.created_at <= now() - public.comment_edit_window() then
    raise exception 'The edit window for this comment has closed.' using errcode = 'P0001';
  end if;

  update public.comments
  set body = btrim(p_body),
      edited_at = now()
  where id = p_comment_id
  returning * into v_comment;

  return v_comment;
end;
$fn$;

grant execute on function public.edit_comment(uuid, text) to authenticated;

-- Deleting inside the window refunds the NOTE to whichever wallet paid for it,
-- and unwinds the matching lifetime counter, in the same transaction as the
-- delete so a wallet can never drift from the comments that spent it.
create or replace function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_comment public.comments;
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into v_comment from public.comments where id = p_comment_id;

  if not found then
    raise exception 'That comment no longer exists.' using errcode = 'P0002';
  end if;

  if v_comment.user_id <> auth.uid() then
    raise exception 'You can only delete your own comments.' using errcode = '42501';
  end if;

  if v_comment.created_at <= now() - public.comment_edit_window() then
    raise exception 'The edit window for this comment has closed.' using errcode = 'P0001';
  end if;

  -- Lock the wallet before touching it, exactly as post_comment() does, so a
  -- refund and a concurrent spend cannot interleave.
  select * into v_profile
  from public.profiles
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'No profile found for this account.' using errcode = 'P0002';
  end if;

  -- used_premium_note records which wallet was charged, so the refund always
  -- goes back where the NOTE came from. greatest(..., 0) keeps the spent
  -- counters inside their non-negative constraints even if a row predates them.
  if v_comment.used_premium_note then
    update public.profiles
    set premium_notes_balance = premium_notes_balance + 1,
        premium_notes_spent   = greatest(premium_notes_spent - 1, 0)
    where id = v_profile.id;
  else
    update public.profiles
    set daily_notes_balance = daily_notes_balance + 1,
        daily_notes_spent   = greatest(daily_notes_spent - 1, 0)
    where id = v_profile.id;
  end if;

  -- The NOTE went back to the wallet above, so its log row goes too --
  -- otherwise this month's spend board would keep counting a NOTE the user is
  -- holding again. Deleted rather than reversed, so no month can go negative.
  delete from public.notes_spend_log where comment_id = p_comment_id;

  -- Reactions go with the comment. The FK is ON DELETE CASCADE so this is
  -- belt and braces, but doing it explicitly keeps the intent visible: the
  -- author's public totals must fall by exactly what this comment earned, in
  -- the same transaction as the refund and the delete.
  delete from public.comment_reactions where comment_id = p_comment_id;
  delete from public.comments where id = p_comment_id;
end;
$fn$;

grant execute on function public.delete_comment(uuid) to authenticated;

-- ------------------------------------------ delete one of your own cats
-- Removing a cat destroys every comment on it, including ones people paid a
-- premium NOTE to write. Those NOTES are refunded: the commenter did nothing
-- wrong and the thread is being taken away from them. Daily notes are not
-- refunded -- they cost nothing and top back up on their own.
--
-- Refunds are aggregated per commenter, so someone who left five premium
-- comments gets five NOTES back in a single UPDATE.
create or replace function public.delete_cat(p_cat_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_cat      public.cats;
  v_profile  public.profiles;
  v_refunded integer := 0;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into v_cat from public.cats where id = p_cat_id;
  if not found then
    raise exception 'That cat no longer exists.' using errcode = 'P0002';
  end if;

  select * into v_profile from public.profiles where user_id = auth.uid();
  if not found then
    raise exception 'No profile found for this account.' using errcode = 'P0002';
  end if;

  -- Uploader only. uploaded_by holds a profiles.id, so this compares like for
  -- like; a seeded cat has uploaded_by null and can never match.
  if v_cat.uploaded_by is null or v_cat.uploaded_by <> v_profile.id then
    raise exception 'You can only delete cats you uploaded.' using errcode = '42501';
  end if;

  select coalesce(sum(x.n), 0)::integer into v_refunded
  from (
    select count(*)::int as n
    from public.comments
    where cat_id = p_cat_id and used_premium_note
    group by user_id
  ) x;

  update public.profiles p
  set premium_notes_balance = p.premium_notes_balance + x.n,
      premium_notes_spent   = greatest(p.premium_notes_spent - x.n, 0)
  from (
    select user_id, count(*)::int as n
    from public.comments
    where cat_id = p_cat_id and used_premium_note
    group by user_id
  ) x
  where p.user_id = x.user_id;

  -- Only the premium NOTES were refunded above, so only their log rows go.
  -- The daily ones were not refunded and must keep counting -- which is why
  -- notes_spend_log.comment_id is ON DELETE SET NULL: were it CASCADE, the
  -- delete below would silently erase spends nobody was paid back for.
  delete from public.notes_spend_log l
  using public.comments c
  where l.comment_id = c.id
    and c.cat_id = p_cat_id
    and c.used_premium_note;

  -- comments, ratings and (through comments) comment_reactions are all
  -- ON DELETE CASCADE from here.
  delete from public.cats where id = p_cat_id;

  return v_refunded;
end;
$fn$;

grant execute on function public.delete_cat(uuid) to authenticated;

-- --------------------------------------------------- buying premium notes
-- Payments are NOT live. There is deliberately no function here that adds to
-- premium_notes_balance: anything callable by the client would be free money.
--
-- When a processor is wired up, the credit belongs in a webhook handler running
-- with the service-role key (Stripe: checkout.session.completed), which should
-- verify the signature, look the order up by its payment intent id, and insert
-- into a `purchases` table keyed on that id so a replayed webhook cannot credit
-- the same payment twice. See src/app/checkout/.


-- ------------------------------------------------------------- storage
insert into storage.buckets (id, name, public)
values ('cat-photos', 'cat-photos', true)
on conflict (id) do nothing;

drop policy if exists "cat photos: public read" on storage.objects;
create policy "cat photos: public read" on storage.objects
  for select using (bucket_id = 'cat-photos');

drop policy if exists "cat photos: authenticated upload" on storage.objects;
create policy "cat photos: authenticated upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'cat-photos');

-- Deleting a cat has to take its image with it, and uploads are namespaced by
-- uploader id, so a caller may remove files from their own folder and nowhere
-- else. Without this the bucket has no DELETE policy at all and the cleanup in
-- deleteCat() would be silently refused by RLS, leaving the file orphaned.
drop policy if exists "cat photos: owner delete" on storage.objects;
create policy "cat photos: owner delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'cat-photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- Avatars get their own bucket. Files are namespaced by user id and a user may
-- only write inside their own folder, so nobody can overwrite someone's face.
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

drop policy if exists "avatars: public read" on storage.objects;
create policy "avatars: public read" on storage.objects
  for select using (bucket_id = 'avatars');

drop policy if exists "avatars: owner upload" on storage.objects;
create policy "avatars: owner upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars: owner update" on storage.objects;
create policy "avatars: owner update" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- ============================================== table grants (the second lock)
-- Supabase grants anon and authenticated full DML on every table in public by
-- default, leaving RLS as the only thing in the way. That was enough everywhere
-- except profiles, where a matching policy existed -- and the pair let a
-- signed-in user set their own premium_notes_balance to 9999.
--
-- Every other table was then audited as a real signed-in user, measuring rows
-- actually changed rather than trusting an errorless reply: a write blocked by
-- RLS matches zero rows and reports success, which reads exactly like a write
-- that worked. RLS was genuinely holding all of them shut.
--
-- The grants are narrowed regardless, to precisely what src/ does. This is the
-- second lock: a policy added later without the grants in mind should not be
-- able to open a table the way it did on profiles. The application writes two
-- tables directly -- cats and ratings -- and reaches everything else through
-- security-definer functions, which run as the owner and are unaffected by any
-- grant here.
--
-- This block must stay LAST in the file. Default privileges re-grant anon and
-- authenticated as each table is created, so a revoke placed earlier is undone
-- by every table defined after it.
revoke insert, update, delete, truncate, references
  on all tables in schema public from anon, authenticated;

-- uploadCat() inserts exactly these four columns. Column-level rather than
-- table-level, so id, created_at and view_count cannot be supplied by the
-- client -- a forged view_count would otherwise ride in on the same request.
grant insert (image_url, source_type, caption, uploaded_by)
  on public.cats to authenticated;

-- rateCat() upserts exactly these three.
grant insert (cat_id, user_id, stars) on public.ratings to authenticated;
grant update (cat_id, user_id, stars) on public.ratings to authenticated;

-- Reads: the three tables the app selects from directly, plus badge_titles,
-- which is deliberately public -- people should be able to see what is out
-- there to earn. Everything else is read through a security-definer function
-- that returns a shaped result, so a table grant would only widen what a client
-- can ask for.
revoke select on all tables in schema public from anon, authenticated;
grant select on public.profiles     to anon, authenticated;
grant select on public.cats         to anon, authenticated;
grant select on public.ratings      to anon, authenticated;
grant select on public.badge_titles to anon, authenticated;
