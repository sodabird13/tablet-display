# CLAUDE.md

## 1) Overview

Tablet Display is a Vite-powered React SPA that renders a wall-display style dashboard showing time, date, weather, BTC/COIN prices, and a calendar grid. Settings and calendar events now persist in Supabase (Postgres + Storage) while weather/market data come from free public APIs (Open-Meteo, CoinGecko, FinancialModelingPrep). The runtime is entirely client-side; React Query coordinates data fetching/caching against Supabase and the external APIs.

**Main modules**
- `src/pages/` – Route-level screens (`Home`, `Calendar`, `Edit`) that orchestrate queries/mutations.
- `src/components/display/` – Presentation components (time/date/weather cards, calendar grid, modals).
- `src/components/calendar/` – Calendar-specific settings modal.
- `src/components/ui/` – shadcn/ui primitives.
- `src/api/supabaseClient.js` – Instantiates the Supabase JS client from env vars.
- `src/api/dataClient.js` – CRUD helpers for `settings`, `calendar_events`, and background uploads.
- `src/api/freeData.js` – Weather and market data via public APIs.
- `supabase/schema.sql` – Reference SQL for the required tables + permissive RLS policies.

## 2) Tech stack
- **Framework/bundler** – React 18 + Vite 6.
- **Routing/state** – `react-router-dom@7`, `@tanstack/react-query@5`.
- **Styling/UI** – Tailwind CSS 3.4, shadcn/ui, Lucide icons, Framer Motion.
- **Data layer** – Supabase (Postgres tables + public storage bucket) accessed via `@supabase/supabase-js`.
- **External APIs** – Open-Meteo (weather/forecast), CoinGecko (BTC price/change), FinancialModelingPrep (COIN equity quote).

## 3) How to run locally
1. **Requirements** – Node.js 20.x, npm 10.x, Supabase project.
2. **Environment** – Copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL=https://qelrfqlyurhmqshnkedx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=sb_publishable_m9mq0jIMToDFdKpzMF1P5w_9-DNnWVK`
   - `VITE_SUPABASE_STORAGE_BUCKET=backgrounds` (or your bucket name)
   - `VITE_WEATHER_LAT` / `VITE_WEATHER_LON` (optional, defaults to Seattle)
3. **Install & run**
   ```bash
   npm install
   npm run dev
   ```
   Dev server: http://localhost:5173
4. **Production build**
   ```bash
   npm run build
   npm run preview  # optional dist smoke-test
   ```

## 4) Supabase + API dependencies
- **Supabase tables** – `settings` (singleton display prefs) and `calendar_events` (recurring/one-off events). Schema + RLS in `supabase/schema.sql`.
- **Data client (`src/api/dataClient.js`)**
  - `fetchSettings` / `saveSettings`
  - `listCalendarEvents`, `createCalendarEvent`, `updateCalendarEvent`, `deleteCalendarEvent`
  - `uploadBackgroundImage` (Supabase Storage public bucket)
- **Components using Supabase**
  - `Home`, `Calendar`, `Edit`, `CalendarSettingsModal`, `CalendarCard` via React Query hooks hitting dataClient.
  - `EventEditModal` callbacks trigger the same mutations.
- **External API helpers (`src/api/freeData.js`)**
  - Weather summary + 5-day forecast from Open-Meteo.
  - BTC price/change from CoinGecko.
  - COIN stock quote from FinancialModelingPrep demo endpoint.
- **Env + storage** – Background uploads go to `backgrounds` bucket; bucket should be public or return signed URLs.

## 5) Next steps / migration levers
- **Stay on Supabase (recommended path)**
  1. Harden RLS if the tablet is ever multi-tenant (tie rows to auth or service role keys).
  2. Move FinancialModelingPrep calls into Supabase Edge Functions if the public demo key hits rate limits; store paid API keys server-side.
  3. Add scheduled Edge Functions/cron to cache weather/price data server-side if you want to reduce client fetches.
- **Go fully local later**
  1. Replace `supabaseClient` with a lightweight REST adapter hitting a local Node/Fastify API + SQLite/Postgres.
  2. Reuse the schema from `supabase/schema.sql`.
  3. Swap `uploadBackgroundImage` to write to disk or MinIO; adjust React Query hooks accordingly.
  4. Proxy weather/market API calls through the backend to avoid CORS/rate limits.

## 6) Raspberry Pi notes
- Pi 4/5 with 4 GB RAM recommended.
- Install Node.js 20.x (use `nvm` or NodeSource arm64 builds).
- System packages: `git`, `curl`, `build-essential`, `python3`, (`libxi-dev`, `libxtst-dev` if building native deps).
- For production, build once (`npm run build`) and serve `dist/` via a lightweight static server (
  `npm run preview`, `serve -s dist`, Caddy, etc.). Weather/price polling runs every 15–30 minutes; keep device time synced. Public APIs have modest rate limits, so consider caching if you deploy multiple displays.

## 7) Deployment to Pi

### Pi Connection Details
- **Pi IP**: `192.168.1.84`
- **Username**: `jleavitt13`
- **Deploy path**: `/home/jleavitt13/tablet-display/dist/`
- **App URL**: `http://192.168.1.84:3001`
- **SSH key**: `~/.ssh/id_ed25519` (already configured)

### Deploy steps
```bash
# 1. Build locally
npm run build

# 2. Deploy to Pi (no password needed - uses SSH key)
rsync -avz --delete dist/ jleavitt13@192.168.1.84:/home/jleavitt13/tablet-display/dist/
```

### SSH access
```bash
ssh jleavitt13@192.168.1.84
```

### Notes
- The Pi serves the static `dist/` folder on port 3001
- No rebuild needed on the Pi - just rsync the pre-built dist folder
- Changes take effect immediately after rsync (no server restart needed for static files)
- SSH key auth is configured - no password prompts for deploy or SSH

### Quick deploy command (copy-paste ready)
```bash
cd /Users/joshleavitt/projects/tablet-display && npm run build && \
rsync -avz --delete dist/ jleavitt13@192.168.1.84:/home/jleavitt13/tablet-display/dist/ && \
rsync -avz server/index.js server/package.json jleavitt13@192.168.1.84:/home/jleavitt13/tablet-display/server/ && \
ssh jleavitt13@192.168.1.84 "sudo systemctl restart tablet-display.service"
```

### Server Architecture
The Pi runs an Express server (`server/index.js`) that:
1. Serves the static `dist/` folder
2. Provides `/api/google-calendar-events` endpoint for server-side Google Calendar fetching
3. Handles JWT signing with the service account credentials (required because tablet browsers may not support Web Crypto API)

The server is managed by systemd: `tablet-display.service`

### Server management on Pi
```bash
# Check status
ssh jleavitt13@192.168.1.84 "sudo systemctl status tablet-display.service"

# View logs
ssh jleavitt13@192.168.1.84 "sudo journalctl -u tablet-display.service -f"

# Restart
ssh jleavitt13@192.168.1.84 "sudo systemctl restart tablet-display.service"
```

## 8) Google Calendar Integration

### Service Account Credentials
The app uses Google Calendar API with service account authentication. Credentials are stored in `.env.local` (not committed to git):

```
VITE_GOOGLE_SERVICE_ACCOUNT_EMAIL=tablet-display-calendar@calendar-474821.iam.gserviceaccount.com
VITE_GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

**Important**: These are baked into the build at compile time (VITE_ prefix). The `.env.local` file must exist locally before running `npm run build`.

### Calendar Setup
- Calendar ID configured in Supabase settings table: `811madrona@gmail.com`
- The calendar must be shared with the service account email for access
- Events refresh every 5 minutes automatically, or manually via refresh button on `/calendar` page
