# Deploy QLDA — Vercel (front-end) + Railway (backend)

This guide walks through deploying the QLDA monorepo to production with **Vercel for the front-end** and **Railway for the backend**. Vercel can host the FE Vite SPA out of the box; the Express + Prisma + scheduler back-end is better suited to a long-running container host like Railway, Render, or Fly. (See "Alternative: backend on Vercel too" at the end if you really want Vercel for both.)

## Prerequisites

- GitHub account with push access to <https://github.com/JasonDuong255/Project-Management>
- A Supabase **production** project — separate from the dev project. You'll need its:
  - URL (`https://<ref>.supabase.co`)
  - Anon key
  - Service-role key
  - JWT secret
  - Database password
- Vercel account (free tier works) connected to your GitHub.
- Railway account (free tier works) connected to your GitHub.

> All steps below assume your `main` branch already has the v3.x changes (current as of `e37bbcb`). If you're on a feature branch, deploy from that branch.

---

## Step 1 — Provision the production database (Supabase)

1. Log in to <https://supabase.com/dashboard>. Create a **new project**. Copy the project ref, anon key, service-role key, JWT secret, and DB password to a scratch file — you'll paste them into Vercel and Railway shortly.
2. Run the schema and RLS once against the prod DB. From your local machine:
   ```bash
   cd D:\code\QLDA\backend
   set DATABASE_URL=postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?connection_limit=10^&pool_timeout=30
   set DIRECT_URL=postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres
   npx prisma db push --skip-generate
   npx prisma db execute --file prisma/migrations/20260501_rls/migration.sql --schema prisma/schema.prisma
   ```
   (Use **port 5432**, session mode — not 6543. Prisma's interactive transactions break on transaction-mode pgbouncer.)
3. Optional: seed demo data (`npm run seed` with the same env vars set). Skip for a clean prod.

---

## Step 2 — Deploy the back-end to Railway

1. <https://railway.app/new> → **Deploy from GitHub repo** → pick `JasonDuong255/Project-Management`.
2. After the project is created, open it → **+ New** → **Service** → **GitHub Repo** → same repo.
3. In the new service's **Settings**:
   - **Root Directory**: `backend`
   - **Watch Paths** (optional): `backend/**`
   - Railway auto-detects `backend/Dockerfile` and uses it. No build command needed.
4. **Variables** tab → add (use `Raw editor` to paste at once):
   ```
   NODE_ENV=production
   PORT=4000
   CORS_ORIGIN=https://qlda.vercel.app
   DATABASE_URL=postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?connection_limit=10&pool_timeout=30
   DIRECT_URL=postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres
   SUPABASE_URL=https://<prod-ref>.supabase.co
   SUPABASE_ANON_KEY=<prod-anon>
   SUPABASE_SERVICE_ROLE_KEY=<prod-service-role>
   SUPABASE_JWT_SECRET=<prod-jwt-secret>
   EMAIL_TRANSPORT=console
   ```
   - `CORS_ORIGIN` is a placeholder for now — you'll update it after Vercel gives you the FE URL.
   - `EMAIL_TRANSPORT=console` until you wire SMTP.
5. **Networking** → **Generate Domain**. Railway gives you something like `qlda-backend-production.up.railway.app`. Note this URL.
6. Verify health: `curl https://<railway-domain>/health` → `{"ok":true,...}`.
7. Verify auth: log in via the dev front-end with prod creds (or use the smoke-test script, swapping `API` to the Railway URL). If `/api/snapshot` returns 401 right away, double-check the `SUPABASE_*` keys match the FE's later.

> Railway redeploys automatically on every push to `main`. To deploy a different branch, change it under Settings → Source.

---

## Step 3 — Deploy the front-end to Vercel

1. <https://vercel.com/new> → **Import Git Repository** → pick `JasonDuong255/Project-Management`.
2. **Configure Project** screen:
   - **Project Name**: `qlda` (or whatever you want; this becomes the subdomain)
   - **Framework Preset**: Vite (Vercel auto-detects this)
   - **Root Directory**: click **Edit** → set to `front-end`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
   - **Install Command**: `npm install` (default)
3. **Environment Variables** — add three (apply to all environments unless you want a separate Preview setup):
   ```
   VITE_API_URL=https://<railway-domain>/api
   VITE_SUPABASE_URL=https://<prod-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<prod-anon-key>
   ```
   - **`VITE_API_URL` is the Railway URL with `/api` suffixed**, e.g. `https://qlda-backend-production.up.railway.app/api`.
   - The Supabase pair must be the **same project** as the backend's `SUPABASE_URL` / `SUPABASE_ANON_KEY`. If they diverge, JWTs from the FE won't verify on the BE.
4. **Deploy**. First build takes 1–2 min.
5. Vercel gives you a domain like `qlda.vercel.app` (and an auto-generated `qlda-<hash>-<scope>.vercel.app` per-deploy preview). Copy the production URL.

### SPA rewrite

Vite + React Router needs a fallback to `index.html` for client-side routing. Add `front-end/vercel.json`:

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

Commit this file. Without it, hard-refreshing on `/projects/p-1` returns 404.

> Vercel's Vite preset usually auto-applies this, but the explicit `vercel.json` is cheap insurance and doesn't hurt.

---

## Step 4 — Wire CORS

After Vercel gives you the FE URL:

1. Go back to **Railway** → backend service → **Variables**.
2. Update `CORS_ORIGIN` to your Vercel URL(s):
   ```
   CORS_ORIGIN=https://qlda.vercel.app,https://www.qlda.vercel.app
   ```
   - Comma-separated. Include any custom domain you bind later.
3. Railway auto-redeploys on the variable change. Wait ~30 s.

---

## Step 5 — Smoke test

1. Open `https://qlda.vercel.app`. The login screen appears.
2. Click any demo account (or type a username). Auth should succeed; dashboard loads.
3. DevTools → Network → confirm:
   - `signInWithPassword` call goes to `*.supabase.co` ✓
   - `GET /api/snapshot` goes to your Railway URL ✓ (200 OK with JSON)
4. Hard-refresh on `/projects` (deep link). Should still load (SPA rewrite working).
5. Optional E2E: navigate to a project as `pm.an` → click **"Yêu cầu đóng TTK"**, then log in as `dev.duy` (KSV) → approve. The Railway logs in your dashboard should show `[email:console]` lines for the notifications.

If something fails, check this order:
- `/health` on the backend URL — is the backend even up?
- Browser DevTools Network — what status code, what error body?
- Railway logs — any Prisma error, env-var validation failure, or CORS reject?
- Vercel build logs — did the build succeed with the right `VITE_*` vars baked in?

---

## Step 6 — Custom domain (optional)

### On Vercel (FE)
- Settings → Domains → Add → `qlda.example.com`
- Update DNS as Vercel instructs. SSL is automatic.
- After it's live, update Railway's `CORS_ORIGIN` to include the new domain.

### On Railway (BE)
- Settings → Networking → Custom Domain → `api.qlda.example.com`
- Add the CNAME in your DNS.
- Update Vercel's `VITE_API_URL` to `https://api.qlda.example.com/api`.
- Trigger a redeploy on Vercel for the new env to take effect.

---

## Continuous deployment

Both Vercel and Railway redeploy automatically on every push to `main`. Branch deploys:

- **Vercel**: Every PR opens a unique preview URL (e.g. `qlda-git-v3.2-close-workflow-<scope>.vercel.app`).
- **Railway**: by default deploys from `main`. To deploy a feature branch, change Source branch in Settings.

Vercel previews use the same env vars as production unless you override per-environment. **Important:** if your Vercel preview hits the production Railway BE, every preview can mutate prod data. Either:
- Make Vercel previews target a staging Railway service (override `VITE_API_URL` for "Preview" environment), or
- Disable Vercel previews on this repo (Settings → Git → uncheck Preview deployments).

---

## Alternative: back-end on Vercel too

You _can_ run the Express app as a Vercel serverless function. Trade-offs:

- ⛔ The scheduler (`RUN_SCHEDULER=true`) won't work — no long-running process.
- ⛔ Prisma cold-starts add ~500–2000 ms of first-request latency.
- ⛔ Realtime subscriptions are FE-only on Supabase, so this isn't blocked, but BE-side WebSocket-style features (none today) wouldn't work.
- ✅ One platform to manage; auto-scaling is free.

If you accept those: install `serverless-http`, create `backend/api/index.ts` that exports a wrapped handler, add a `backend/vercel.json` with `{ "rewrites": [{"source":"/(.*)","destination":"/api/index"}] }`, and import the project as a separate Vercel project (Root Directory: `backend`). Skip the scheduler. Plan to migrate off Vercel for BE if v3.2-part-3 (the scheduler) ships.

---

## Reference: env vars summary

| Where | Var | Local dev | Production |
| ----- | --- | --------- | ---------- |
| FE (Vercel) | `VITE_API_URL` | `/api` | `https://<railway-domain>/api` |
| FE (Vercel) | `VITE_SUPABASE_URL` | dev project | **prod project** |
| FE (Vercel) | `VITE_SUPABASE_ANON_KEY` | dev anon | **prod anon** |
| BE (Railway) | `NODE_ENV` | `development` | `production` |
| BE (Railway) | `PORT` | `4000` | Railway sets this; honor `$PORT` |
| BE (Railway) | `CORS_ORIGIN` | `http://localhost:5173` | `https://qlda.vercel.app` (+ custom domain) |
| BE (Railway) | `DATABASE_URL`, `DIRECT_URL` | dev pooler URL (5432, session) | prod pooler URL (5432, session) |
| BE (Railway) | `SUPABASE_URL` / `*_ANON_KEY` / `*_SERVICE_ROLE_KEY` | dev keys | prod keys |
| BE (Railway) | `SUPABASE_JWT_SECRET` | optional | **set it** for fast verify |
| BE (Railway) | `EMAIL_TRANSPORT` | `console` | `console` for now; `smtp` once SMTP wired |
| BE (Railway) | `RUN_SCHEDULER` | unset | `true` on **one** instance (lands in v3.2 part 3) |

Full per-var docs: [`backend/README.md`](../backend/README.md) and [`front-end/README.md`](../front-end/README.md).
