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
create index if not exists ratings_cat_id_idx on public.ratings (cat_id);

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
  set notes_balance = notes_balance - 1
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
