# QLDA Backend

Express + Prisma + Supabase API for the QLDA front-end SPA.

## Setup

```bash
cd D:\code\QLDA\backend
npm install
cp .env.example .env   # then paste Supabase credentials
```

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
