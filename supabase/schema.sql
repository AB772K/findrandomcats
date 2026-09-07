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
  notes_balance integer not null default 3 check (notes_balance >= 0),
  created_at    timestamptz not null default now()
);

-- Public-facing profile fields. Nullable: a profile is perfectly usable blank,
-- and the UI falls back to an initials avatar / "Cat lover".
alter table public.profiles add column if not exists display_name        text;
alter table public.profiles add column if not exists profile_picture_url text;
alter table public.profiles add column if not exists bio                 text;

-- Lifetime NOTES spent, tracked separately from the balance so the public
-- profile can show spend without ever revealing what is left in the wallet.
alter table public.profiles add column if not exists notes_spent integer not null default 0;

do $do$ begin
  alter table public.profiles add constraint profiles_display_name_len
    check (display_name is null or length(btrim(display_name)) between 1 and 40);
exception when duplicate_object then null; end $do$;

do $do$ begin
  alter table public.profiles add constraint profiles_bio_len
    check (bio is null or length(bio) <= 300);
exception when duplicate_object then null; end $do$;

do $do$ begin
  alter table public.profiles add constraint profiles_notes_spent_nonneg check (notes_spent >= 0);
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

create index if not exists comments_cat_id_created_at_idx on public.comments (cat_id, created_at desc);
create index if not exists comments_user_id_idx on public.comments (user_id);
create index if not exists ratings_cat_id_idx on public.ratings (cat_id);
create index if not exists ratings_user_id_idx on public.ratings (user_id);

-- Backfill for databases created before notes_spent existed: every comment on
-- record cost exactly 1 NOTE. Runs after comments so a fresh install is a no-op.
update public.profiles p
set notes_spent = c.n
from (select user_id, count(*)::int as n from public.comments group by user_id) c
where c.user_id = p.user_id and p.notes_spent = 0;

-- --------------------------------------------- profile on signup (3 NOTES)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  insert into public.profiles (user_id, notes_balance)
  values (new.id, 3)
  on conflict (user_id) do nothing;
  return new;
end;
$fn$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------------ RLS
alter table public.profiles enable row level security;
alter table public.cats     enable row level security;
alter table public.ratings  enable row level security;
alter table public.comments enable row level security;

-- profiles: you can only ever see / touch your own row.
drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = user_id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- cats: readable by everyone, insertable by signed-in users as themselves.
drop policy if exists "cats: public read" on public.cats;
create policy "cats: public read" on public.cats
  for select using (true);

drop policy if exists "cats: authenticated insert" on public.cats;
create policy "cats: authenticated insert" on public.cats
  for insert to authenticated
  with check (
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
drop policy if exists "comments: authenticated read" on public.comments;
create policy "comments: authenticated read" on public.comments
  for select to authenticated using (true);

drop policy if exists "comments: delete own" on public.comments;
create policy "comments: delete own" on public.comments
  for delete to authenticated using (auth.uid() = user_id);
-- NOTE: there is deliberately no INSERT policy. Comments must go through
-- post_comment(), which charges the NOTE in the same transaction.

-- ------------------------------------------------------------ random cat
create or replace function public.random_cat(exclude_ids uuid[] default '{}')
returns setof public.cats
language sql
stable
as $fn$
  select *
  from public.cats
  where not (id = any (exclude_ids))
  order by random()
  limit 1;
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

-- ------------------------------------------- comments with their authors
-- Comments live behind RLS and profiles are readable only by their owner, so a
-- plain join would return nothing for other people's names. Same trick as
-- cat_rating_summary(): a security-definer function hands back exactly the
-- public fields (profile id, display name, avatar) and nothing else -- never
-- the author's email, user_id, or NOTES balance.
create or replace function public.cat_comments(p_cat_id uuid)
returns table (
  id                  uuid,
  cat_id              uuid,
  body                text,
  created_at          timestamptz,
  author_id           uuid,
  display_name        text,
  profile_picture_url text
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
         p.id,
         p.display_name,
         p.profile_picture_url
  from public.comments c
  left join public.profiles p on p.user_id = c.user_id
  where c.cat_id = p_cat_id
  order by c.created_at desc
  limit 100;
$fn$;

grant execute on function public.cat_comments(uuid) to authenticated;

-- ------------------------------------------------------ public profiles
-- The /u/[id] page reads only through these two functions. Deliberately absent:
-- notes_balance, user_id, email, and any per-cat rating rows.
create or replace function public.public_profile(p_profile_id uuid)
returns table (
  id                  uuid,
  display_name        text,
  profile_picture_url text,
  bio                 text,
  created_at          timestamptz,
  comment_count       bigint,
  notes_spent         integer,
  rating_count        bigint
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
         p.notes_spent,
         (select count(*) from public.ratings r where r.user_id = p.user_id)
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

grant execute on function public.public_profile(uuid) to anon, authenticated;
grant execute on function public.profile_rating_summary(uuid) to anon, authenticated;

-- --------------------------------------------- update your own profile
-- Display name / bio / avatar go through a function so the same trimming and
-- length rules apply no matter what the client sends. notes_balance and
-- notes_spent are untouchable here.
create or replace function public.update_my_profile(
  p_display_name        text,
  p_bio                 text,
  p_profile_picture_url text
)
returns public.profiles
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

  update public.profiles
  set display_name        = nullif(btrim(coalesce(p_display_name, '')), ''),
      bio                 = nullif(btrim(coalesce(p_bio, '')), ''),
      profile_picture_url = coalesce(
                              nullif(btrim(coalesce(p_profile_picture_url, '')), ''),
                              profile_picture_url
                            )
  where user_id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception 'No profile found for this account.' using errcode = 'P0002';
  end if;

  return v_profile;
end;
$fn$;

grant execute on function public.update_my_profile(text, text, text) to authenticated;

-- ------------------------------------- post a comment, charging 1 NOTE
create or replace function public.post_comment(p_cat_id uuid, p_body text)
returns public.comments
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_profile public.profiles;
  v_comment public.comments;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to comment.' using errcode = '42501';
  end if;

  if length(btrim(coalesce(p_body, ''))) = 0 then
    raise exception 'Comment cannot be empty.' using errcode = '22023';
  end if;

  -- Lock the profile row so two concurrent comments cannot spend the same NOTE.
  select * into v_profile
  from public.profiles
  where user_id = auth.uid()
  for update;

  if not found then
    raise exception 'No profile found for this account.' using errcode = 'P0002';
  end if;

  if v_profile.notes_balance < 1 then
    raise exception 'You are out of NOTES.' using errcode = 'P0001';
  end if;

  update public.profiles
  set notes_balance = notes_balance - 1,
      notes_spent   = notes_spent + 1
  where id = v_profile.id;

  insert into public.comments (cat_id, user_id, body)
  values (p_cat_id, auth.uid(), btrim(p_body))
  returning * into v_comment;

  return v_comment;
end;
$fn$;

grant execute on function public.post_comment(uuid, text) to authenticated;

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
