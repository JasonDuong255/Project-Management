# QLDA Backend

Express + Prisma + Supabase API for the QLDA front-end SPA.

## Setup

```bash
cd D:\code\QLDA\backend
npm install
cp .env.example .env   # then fill in Supabase credentials (see "Environment variables" below)
```

## Environment variables

All env vars are loaded from `backend/.env` (gitignored) and validated at startup by `src/config/env.ts`. The server refuses to boot if any required var is missing or malformed.

| Variable | Required | Used for | Where to find it |
| -------- | :------: | -------- | ---------------- |
| `PORT` | no (default `4000`) | Express listen port | — |
| `NODE_ENV` | no (default `development`) | log verbosity, helmet defaults | set `production` in prod |
| `CORS_ORIGIN` | yes | comma-separated allow-list of origins that the FE serves from. e.g. `https://qlda.example.com,https://staging.qlda.example.com` | your FE domain(s) |
| `DATABASE_URL` | yes | Prisma runtime queries — **must be the session-mode (port 5432) URL**, not the pgbouncer-transaction (6543) one. Prisma's interactive transactions break on transaction-mode pgbouncer. | Supabase dashboard → Project Settings → Database → Connection string → **Session pooler** (or Direct connection) |
| `DIRECT_URL` | recommended | Used by `prisma migrate` and `prisma db push`. Same session-mode URL. | same as `DATABASE_URL` |
| `SUPABASE_URL` | yes | Supabase project URL. Used by the service-role admin client. | Supabase dashboard → Project Settings → API → Project URL |
| `SUPABASE_ANON_KEY` | yes | Anon key — used to instantiate the admin client (still needs anon for the realtime path); SAFE to ship to FE. | Supabase dashboard → Project Settings → API → `anon public` |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service-role key — used only on the BE for admin actions (creating users, resetting demo data). **Never expose this to the FE.** | Supabase dashboard → Project Settings → API → `service_role secret` |
| `SUPABASE_JWT_SECRET` | optional | If set, the backend verifies user JWTs locally with HS256 (fast). If empty, the backend falls back to `supabase.auth.getUser(token)` which makes one network call per request. | Supabase dashboard → Project Settings → API → JWT Secret |
| `EMAIL_TRANSPORT` | no (default `console`) | `console` writes notification emails to stdout (dev). `smtp` posts via nodemailer (prod). | — |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | required when `EMAIL_TRANSPORT=smtp` | SMTP relay credentials. Currently a placeholder; transport implementation lands in v3.2 follow-up. | your SMTP provider |
| `RUN_SCHEDULER` | no | When set to `true`, enables the in-process job runner (auto-health + deadline alerts). Disable in dev environments that don't need cron-side-effects. Lands in v3.2 follow-up. | — |

### `.env.example` template

`backend/.env.example` carries the same shape with placeholders. Copy it to `.env` and fill in real values; **never commit `.env`** (it's gitignored).

### What changes between local dev and production

| Var | Local dev | Production |
| --- | --------- | ---------- |
| `NODE_ENV` | `development` | `production` |
| `PORT` | `4000` | whatever your platform exposes (Railway / Render / Fly inject this; respect the var) |
| `CORS_ORIGIN` | `http://localhost:5173` | your FE's https origin(s), comma-separated |
| `DATABASE_URL` / `DIRECT_URL` | session-mode pooler URL with the dev DB password | same shape, against the prod Supabase project |
| `SUPABASE_*` | dev project's keys | **prod project's keys** (different project ref + keys) |
| `SUPABASE_JWT_SECRET` | usually unset (falls back to network verify) | **set it** — 1 ms verify vs ~50 ms network call per request |
| `EMAIL_TRANSPORT` | `console` (or unset) | `smtp` |
| `RUN_SCHEDULER` | unset (no cron noise) | `true` on **one** instance |

### Single-instance scheduler

If you run multiple backend replicas in production, set `RUN_SCHEDULER=true` on **only one** instance to avoid duplicate alert notifications.

## First-time database setup

```bash
# 1. (one-time) drop any pre-existing tables in the public schema
npx tsx src/db/reset-public.ts

# 2. apply Prisma schema
npx prisma db push --skip-generate

# 3. apply RLS policies for Realtime
npx prisma db execute --file prisma/migrations/20260501_rls/migration.sql --schema prisma/schema.prisma

# 4. (only if migrating from a previous seed with different emails)
npx tsx src/db/reset-auth.ts

# 5. seed demo data (also creates 8 demo auth users)
npm run seed
```

## Daily

```bash
npm run dev      # tsx watch on src/server.ts (port 4000)
npm run lint
npm test
```

## Demo credentials

All accounts use password `123456`. Email follows `<username>@qlda.local`.

| Username | Email | Role |
| -------- | ----- | ---- |
| sys.chau | sys.chau@qlda.local | PMO |
| hc.hoa | hc.hoa@qlda.local | ADMIN_HC |
| pm.an | pm.an@qlda.local | PM |
| pm.ha | pm.ha@qlda.local | PM |
| dev.binh, dev.duy, dev.khang, dev.lan | *@qlda.local | DELIVERY_MEMBER |

## Useful scripts

| Script | Purpose |
| ------ | ------- |
| `npx tsx src/db/summary.ts` | print all accounts + data counts |
| `npx tsx src/db/inspect.ts` | print public-schema tables, row counts, FKs |
| `npx tsx src/db/list-auth.ts` | print all Supabase auth users |
| `npx tsx src/db/reset-public.ts` | drop all public-schema tables (destructive) |
| `npx tsx src/db/reset-auth.ts` | delete all Supabase auth users (destructive) |
| `npx tsx src/db/smoke-test.ts` | log in as 4 demo users, hit `/api/snapshot` |
| `npx tsx src/db/e2e-test.ts` | exercise every mutation endpoint and verify cascades/RBAC |
| `npm run seed` | wipe + re-seed all data |

## Docker

```bash
docker build -t qlda-backend .
docker run -p 4000:4000 --env-file .env qlda-backend
```

## Deployment

Pick any platform that runs Node 20+ and lets you set env vars. The image is small (`node:22-alpine` base) and listens on `$PORT`.

### Steps

1. **Provision Supabase production project.** Different from dev. Note the project ref, anon key, service-role key, and JWT secret.
2. **Run the schema once** against the prod DB:
   ```bash
   DATABASE_URL=<prod-session-url> DIRECT_URL=<prod-session-url> npx prisma db push --skip-generate
   DATABASE_URL=<prod-session-url> npx prisma db execute \
     --file prisma/migrations/20260501_rls/migration.sql --schema prisma/schema.prisma
   ```
3. **Seed prod demo data (optional).** If you want the 8 demo users + sample projects in prod, run `npm run seed`. Otherwise create real users via the Supabase dashboard or your own user-management endpoint.
4. **Set env vars** on the platform per the table above. The minimum required set is:
   ```
   NODE_ENV=production
   CORS_ORIGIN=https://your-frontend-domain.com
   DATABASE_URL=postgresql://postgres.<ref>:<pwd>@aws-…pooler.supabase.com:5432/postgres
   DIRECT_URL=…   (same)
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_ANON_KEY=<anon>
   SUPABASE_SERVICE_ROLE_KEY=<service>
   SUPABASE_JWT_SECRET=<jwt-secret>
   ```
5. **Deploy**: `docker build` + push to your registry, or push the repo to a buildpack platform. The container has no persistent state — all data lives in Supabase.

### Quick checks after deploy

```bash
# Health
curl https://api.qlda.example.com/health

# Auth + snapshot (replace TOKEN with a real Supabase JWT for a logged-in user)
curl https://api.qlda.example.com/api/snapshot -H "Authorization: Bearer $TOKEN"
```

If `/health` returns 200 but `/api/snapshot` returns 500, check `DATABASE_URL` — most often it's the wrong port (must be **5432**, not 6543).

## Endpoints

All under `/api`, all require `Authorization: Bearer <supabase_access_token>` except `/health`.

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET    | /health | unauth |
| GET    | /api/snapshot | full AppSnapshot, filtered by user visibility |
| POST   | /api/projects | PMO/ADMIN_HC only |
| PATCH  | /api/projects/:id | canEditProjectInfo |
| POST   | /api/projects/:id/documents | canEditProjectInfo |
| PATCH  | /api/projects/:id/documents/:docId | canEditProjectInfo |
| DELETE | /api/projects/:id/documents/:docId | canEditProjectInfo |
| POST   | /api/projects/:id/plan-items | canManageProjectPlan |
| PATCH  | /api/projects/:id/plan-items/:taskId | canManageProjectPlan |
| DELETE | /api/projects/:id/plan-items/:taskId | canManageProjectPlan; cascades |
| POST   | /api/projects/:id/worklogs | members log own time only |
| POST   | /api/projects/:id/delay-raises | members raise own delays only |
| POST   | /api/projects/:id/allocations | canManageProjectPlan; upsert |
| POST   | /api/projects/:id/risks | canManageProjectPlan; upsert |
| PATCH  | /api/catalogs/:groupKey | PMO only |
| POST   | /api/admin/reset-demo-data | PMO only |
