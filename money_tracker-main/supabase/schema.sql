-- ============================================================
-- Expense Tracker — Supabase Schema + RLS
-- Run this entire file once in the Supabase SQL editor.
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── user_profiles ───────────────────────────────────────────
-- Mirrors auth.users but is readable/writeable from the client.
create table if not exists public.user_profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  currency    text    not null default '₹',
  theme       text    not null default 'dark',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = id);

-- ── books ────────────────────────────────────────────────────
create table if not exists public.books (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  color       text not null default '#0A84FF',
  icon_id     text not null default 'book',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.books enable row level security;

create policy "Users can CRUD own books"
  on public.books for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists books_user_idx on public.books(user_id);

-- ── transactions ─────────────────────────────────────────────
create table if not exists public.transactions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  book_id     uuid not null references public.books(id) on delete cascade,
  type        text not null check (type in ('income','expense')),
  amount      numeric(14,2) not null check (amount > 0),
  category    text not null,
  date        date not null,
  notes       text,
  attachment  boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.transactions enable row level security;

create policy "Users can CRUD own transactions"
  on public.transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists transactions_user_idx  on public.transactions(user_id);
create index if not exists transactions_book_idx  on public.transactions(book_id);
create index if not exists transactions_date_idx  on public.transactions(date desc);

-- ── offline_queue ─────────────────────────────────────────────
-- Stores operations that failed while offline.
-- The client processes this queue when connectivity is restored.
-- (This table is LOCAL-ONLY — it lives in localStorage on the client.
--  It is defined here for documentation purposes only.)

-- ── updated_at triggers ───────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger books_set_updated_at
  before update on public.books
  for each row execute function public.set_updated_at();

create or replace trigger transactions_set_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

create or replace trigger profiles_set_updated_at
  before update on public.user_profiles
  for each row execute function public.set_updated_at();

-- ── auto-create profile on signup ────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.user_profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
