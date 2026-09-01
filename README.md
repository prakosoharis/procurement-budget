# IT Budget vs Actual Dashboard — local Docker build

Port of the original Lovable app ("Entity Insights Hub") to Next.js, running fully
locally via Docker: Next.js app + Postgres (Neon-compatible — same connection
string shape, so pointing `DATABASE_URL` at a real Neon project later is a
drop-in swap, no code changes needed).

## What's running

- **app** — Next.js 16 (App Router), port `3010` on the host
- **db** — Postgres 16, port `5433` on the host (5432 was already taken locally by another project)

All budget data lives in Postgres now (`budget_rows` table) instead of the
original's bundled JSON + per-browser localStorage — "Upload XLSX" and
"Refresh from Database" are real, shared operations now. Login is required for
every page and API route except `/login` itself.

## First-time setup

```bash
# 1. Copy env template and fill in a JWT secret (Groq key optional — only
#    needed for the AI Copilot chat / insights features)
cp .env.example .env
# generate a secret:
openssl rand -base64 32   # paste into JWT_SECRET in .env

# 2. Start Postgres
docker compose up -d db

# 3. Push the schema (one-time, or after editing db/schema.ts)
npm install
npx drizzle-kit push

# 4. Load the seed dataset (~4,900 rows, same data the original app ships with)
set -a; source .env; set +a
npx tsx scripts/seed.ts

# 5. Create your login account(s) — no self-signup, admin creates accounts manually
npx tsx scripts/create-user.ts you@company.com "YourPassword123!"

# 6. Build and start the full stack
docker compose up -d --build

# App is now at http://localhost:3010
```

## Day-to-day

```bash
docker compose up -d      # start
docker compose down       # stop (data persists in the db_data volume)
docker compose logs -f app
```

To add more users later:

```bash
set -a; source .env; set +a
npx tsx scripts/create-user.ts someone@company.com "TheirPassword"
```

## Local dev without Docker (optional)

```bash
docker compose up -d db     # just the database
npm run dev                 # Next.js on :3000, reads .env.local
```

## Known note

The bundled seed dataset (from the zip you provided) has 4,901 rows; the
currently-live `it-budget-vs-actual.lovable.app` shows 4,703 in its header —
that site has apparently been refreshed since the zip was exported. This port
faithfully replicates the zip's data; swap in a newer export via "Upload XLSX"
if you want the dashboard to match the live numbers exactly.
