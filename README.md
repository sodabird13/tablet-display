# Tablet Display

React + Vite dashboard built for the wall-mounted tablet display. The app now stores state in Supabase (Postgres + Storage) and uses free public APIs for weather and market data.

## Prerequisites

- Node.js 20.x and npm 10.x
- Supabase project with:
  - Tables `settings` and `calendar_events` (see `supabase/schema.sql`)
  - Public storage bucket (default name: `backgrounds`)

## Environment variables

Copy `.env.example` to `.env` and fill in:

```
VITE_SUPABASE_URL=https://qelrfqlyurhmqshnkedx.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_m9mq0jIMToDFdKpzMF1P5w_9-DNnWVK
# Optional overrides:
VITE_SUPABASE_STORAGE_BUCKET=backgrounds
VITE_WEATHER_LAT=47.608013
VITE_WEATHER_LON=-122.335167
```

_(Keep the Supabase secret key for server-side scripts only; it is **not** required in the browser.)_

## First run

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:5173.

## Production build

```bash
npm run build
npm run preview   # optional smoke test for dist/
```

## Supabase schema

See `supabase/schema.sql` for the SQL that creates the required tables and policies.