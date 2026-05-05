# QLDA — Project Management

Monorepo for the QLDA (Quản lý dự án) project-management web app. Built for AITS / VNA group internal use.

## Layout

```
D:\code\QLDA\
├── front-end\     React + Vite + TypeScript SPA
├── backend\       Express + Prisma + Supabase API
└── .docs\         project knowledge base (BRD, audit, plan, onboarding)
```

## Quick start

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env   # fill in Supabase credentials
npm run dev            # http://localhost:4000

# 2. Frontend (in a second terminal)
cd front-end
npm install
cp .env.example .env   # fill in Supabase credentials
npm run dev            # http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:4000`, so both run cleanly side-by-side. Open <http://localhost:5173>; the login page lists the 8 demo accounts (all password `123456`).

## Deployment

Both apps need env vars set before deploy. **Read these first:**

- [`.docs/DEPLOY.md`](./.docs/DEPLOY.md) — full step-by-step guide for **Vercel (front-end) + Render (backend)** including Supabase prod setup, CORS wiring, and smoke testing. **Start here.**
- [`backend/README.md`](./backend/README.md) — backend env vars (Supabase keys, `DATABASE_URL`, `CORS_ORIGIN`, etc.) and deployment notes.
- [`front-end/README.md`](./front-end/README.md) — frontend env vars (`VITE_API_URL`, `VITE_SUPABASE_*`) and static-host deployment notes.

### What changes between local dev and production (cheat-sheet)

**Backend (`backend/.env`):**

| Var | Local dev | Production |
| --- | --------- | ---------- |
| `NODE_ENV` | `development` | `production` |
| `CORS_ORIGIN` | `http://localhost:5173` | your FE's HTTPS origin(s) |
| `DATABASE_URL` / `DIRECT_URL` | dev Supabase pooler URL (**port 5432, session mode**) | prod Supabase pooler URL (same shape, different ref + password) |
| `SUPABASE_URL` / `*_ANON_KEY` / `*_SERVICE_ROLE_KEY` | dev project keys | **prod project keys** |
| `SUPABASE_JWT_SECRET` | optional (network fallback) | **set it** for fast local JWT verify |
| `EMAIL_TRANSPORT` | `console` | `smtp` (set `SMTP_HOST` + creds) |
| `RUN_SCHEDULER` | unset | `true` on **one** instance only |

**Frontend (`front-end/.env`):**

| Var | Local dev | Production |
| --- | --------- | ---------- |
| `VITE_API_URL` | `/api` (vite proxy) | `https://api.qlda.example.com/api` |
| `VITE_SUPABASE_URL` | dev project URL | **prod project URL** |
| `VITE_SUPABASE_ANON_KEY` | dev anon | **prod anon** |

The FE's `VITE_SUPABASE_*` pair must match the BE's `SUPABASE_*` pair. Both apps must talk to the **same Supabase project** or JWTs won't verify.

## Tested end-to-end

| Flow | Tested |
| ---- | ------ |
| Login / logout / role-based snapshot filter | smoke-test (4 demo roles) |
| Project CRUD + activity log diffs | e2e-test |
| Plan items (parent + subtask, cascade delete) | e2e-test |
| Worklogs + auto-status transitions | e2e-test |
| Risks / allocations / catalogs / reset-demo-data | e2e-test |
| **Close workflow** (pause/resume/KSV→TCNL approval) | close-workflow-test |
| Lock-when-closed (BRD IV.6) | close-workflow-test |

Run all of them:
```bash
cd backend
npm run dev               # leave running in one terminal
npx tsx src/db/smoke-test.ts
npx tsx src/db/e2e-test.ts
npx tsx src/db/close-workflow-test.ts
```

## Branch + workflow

See [`.docs/GIT_WORKFLOW.md`](./.docs/GIT_WORKFLOW.md). Branch names: `v<X.Y>-<purpose>`. Commits: `v<X.Y> <type>: <summary>`. Merges to `main` use `--no-ff`.

## Project context

For everything else (BRD, audit, phased plan, onboarding):

| File | What |
| ---- | ---- |
| [`.docs/00-context.md`](./.docs/00-context.md) | 60-second project catch-up |
| [`.docs/01-current-state.md`](./.docs/01-current-state.md) | what's actually built today |
| [`.docs/BRD.md`](./.docs/BRD.md) | the Business Requirements Document |
| [`.docs/audit/`](./.docs/audit/) | gap analysis: BRD vs current state |
| [`.docs/plan/`](./.docs/plan/) | phased implementation plan |
| [`.docs/ONBOARDING.md`](./.docs/ONBOARDING.md) | full first-day developer guide |
| [`.docs/BACKEND_SETUP.md`](./.docs/BACKEND_SETUP.md) | how FE + BE wire together |
