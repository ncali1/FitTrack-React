-- FitTrack cloud schema
-- Run this once in your Supabase project's SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: uses "if not exists" / "or replace" throughout.

-- 1. Exercises -----------------------------------------------------------
create table if not exists public.exercises (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_sets int not null,
  target_reps int not null,
  target_muscle_groups text[] not null default '{}',
  created_at bigint not null,
  updated_at bigint not null
);

-- 2. Routines (multiple per user; weekly_assignments = { monday: [exerciseId, ...], ... }) ---
create table if not exists public.routines (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Routine',
  is_active boolean not null default false,
  weekly_assignments jsonb not null default '{}',
  created_at bigint not null,
  updated_at bigint not null
);

-- 3. Workout sessions (one row per user per day; exercises = performance log array) ---
create table if not exists public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  exercises jsonb not null default '[]',
  created_at bigint not null,
  updated_at bigint not null,
  unique (user_id, date)
);

-- 4. Body weight logs (one row per user per day, separate from workout data) ---
create table if not exists public.body_weight_logs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  date text not null,
  weight_kg double precision not null,
  created_at bigint not null,
  updated_at bigint not null,
  unique (user_id, date)
);

create index if not exists exercises_user_id_idx on public.exercises (user_id);
create index if not exists routines_user_id_idx on public.routines (user_id);
create index if not exists workout_sessions_user_id_idx on public.workout_sessions (user_id);
create index if not exists workout_sessions_user_date_idx on public.workout_sessions (user_id, date);
create index if not exists body_weight_logs_user_id_idx on public.body_weight_logs (user_id);
create index if not exists body_weight_logs_user_date_idx on public.body_weight_logs (user_id, date);

-- Row-level security: every user can only ever see/write their own rows -----
alter table public.exercises enable row level security;
alter table public.routines enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.body_weight_logs enable row level security;

drop policy if exists "exercises_owner" on public.exercises;
create policy "exercises_owner" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "routines_owner" on public.routines;
create policy "routines_owner" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "workout_sessions_owner" on public.workout_sessions;
create policy "workout_sessions_owner" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "body_weight_logs_owner" on public.body_weight_logs;
create policy "body_weight_logs_owner" on public.body_weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
