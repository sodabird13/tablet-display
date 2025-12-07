-- Settings table (single row)
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  background_image_url text,
  show_sample_events boolean default true,
  google_calendar_id text,
  google_calendar_api_key text,
  calendar_title text default 'Weekly Calendar',
  calendar_start_hour integer default 8,
  calendar_end_hour integer default 21,
  inserted_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Calendar events table
create table if not exists public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  color text default 'blue',
  is_all_day boolean default false,
  is_recurring boolean default true,
  start_time time,
  end_time time,
  specific_date date,
  days_of_week integer[] default '{}',
  excluded_dates date[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Allow anon access for single-tenant display (adjust for multi-user setups)
alter table public.settings enable row level security;
alter table public.calendar_events enable row level security;

create policy "allow read" on public.settings for select using (true);
create policy "allow upsert" on public.settings for all using (true) with check (true);

create policy "allow read" on public.calendar_events for select using (true);
create policy "allow mutate" on public.calendar_events for all using (true) with check (true);
