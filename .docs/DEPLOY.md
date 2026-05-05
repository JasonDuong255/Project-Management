# Deploy QLDA — Vercel (front-end) + Render (backend)

This guide walks through deploying the QLDA monorepo to production with **Vercel for the front-end** (free) and **Render for the backend** (free tier — sleeps after 15 min idle). The Express + Prisma back-end is better suited to a long-running container host than to Vercel's serverless functions; Render's free Web Service tier supports our `backend/Dockerfile` out of the box.

> **Render free-tier caveat:** the service sleeps after 15 minutes of inactivity. The first request after sleep takes ~30 s to wake (Node + Prisma cold start). Acceptable for a demo or low-traffic internal tool; upgrade to a paid Starter plan ($7/mo) if you need 24/7 instant response. The deadline-alert scheduler (`RUN_SCHEDULER=true`, lands in v3.2 part 3) will not fire reliably on the free tier — schedule that on a paid plan.

## Prerequisites

- GitHub account with push access to <https://github.com/JasonDuong255/Project-Management>
- A Supabase **production** project — separate from the dev project. You'll need its:
  - URL (`https://<ref>.supabase.co`)
  - Anon key
  - Service-role key
  - JWT secret
  - Database password
- Vercel account (free tier works) connected to your GitHub.
- Render account (free tier works) connected to your GitHub.

> All steps assume your `main` branch already has the v3.x changes (current as of `4363e89`). If you're on a feature branch, deploy from that branch.

---

## Step 1 — Provision the production database (Supabase)

1. Log in to <https://supabase.com/dashboard>. Create a **new project**. Copy the project ref, anon key, service-role key, JWT secret, and DB password to a scratch file — you'll paste them into Vercel and Render shortly.
2. Run the schema and RLS once against the prod DB. From your local machine:

   **Bash / Git Bash:**
   ```bash
   cd D:/code/QLDA/backend
   export DATABASE_URL='postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?connection_limit=10&pool_timeout=30'
   export DIRECT_URL='postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres'
   npx prisma db push --skip-generate
   npx prisma db execute --file prisma/migrations/20260501_rls/migration.sql --schema prisma/schema.prisma
   ```

   **PowerShell:**
   ```powershell
   cd D:\code\QLDA\backend
   $env:DATABASE_URL = 'postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?connection_limit=10&pool_timeout=30'
   $env:DIRECT_URL  = 'postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres'
   npx prisma db push --skip-generate
   npx prisma db execute --file prisma/migrations/20260501_rls/migration.sql --schema prisma/schema.prisma
   ```

   Use **port 5432** (session mode), not 6543. Prisma's interactive transactions break on transaction-mode pgbouncer.

3. Optional: seed demo data (`npm run seed` with the same env vars set). Skip for a clean prod.

---

## Step 2 — Deploy the back-end to Render

1. <https://dashboard.render.com/> → **New +** → **Web Service**.
2. **Connect your GitHub repo** → select `JasonDuong255/Project-Management`. (First time: authorize Render's GitHub app for this repo.)
3. **Configure the service:**
   - **Name**: `qlda-backend` (this becomes the subdomain: `qlda-backend.onrender.com`)
   - **Region**: pick the one closest to your Supabase project. We're using Sydney (`ap-southeast-2`), so **Singapore** is the closest Render region.
   - **Branch**: `main` (or the v3.x feature branch you're testing)
   - **Root Directory**: `backend`
   - **Runtime**: **Docker** (Render auto-detects `backend/Dockerfile`)
   - **Instance Type**: **Free** (512 MB RAM, sleeps after 15 min idle)
   - **Health Check Path**: `/health`
   - **Auto-Deploy**: Yes (default)
4. **Environment variables** — scroll down, click **Add Environment Variable** for each. Or use **Add from .env** and paste this block:
   ```
   NODE_ENV=production
   PORT=10000
   CORS_ORIGIN=https://qlda.vercel.app
   DATABASE_URL=postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres?connection_limit=10&pool_timeout=30
   DIRECT_URL=postgresql://postgres.<prod-ref>:<prod-pwd>@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres
   SUPABASE_URL=https://<prod-ref>.supabase.co
   SUPABASE_ANON_KEY=<prod-anon>
   SUPABASE_SERVICE_ROLE_KEY=<prod-service-role>
   SUPABASE_JWT_SECRET=<prod-jwt-secret>
   EMAIL_TRANSPORT=console
   ```
   - **`PORT=10000`** is Render's default expected port. Our Express app already reads `process.env.PORT`, so this works.
   - `CORS_ORIGIN` is a placeholder for now — you'll update it after Vercel gives you the FE URL.
   - `EMAIL_TRANSPORT=console` until you wire SMTP.
5. **Create Web Service**. First build takes 3–5 min (Docker layer install).
6. Render gives you `https://qlda-backend.onrender.com`. Note this URL.
7. Verify health: `curl https://qlda-backend.onrender.com/health` → `{"ok":true,...}`.
   - First call after build takes ~10–30 s (cold start).

> Render redeploys automatically on every push to the configured branch. Watch deploy progress in the **Events** tab.

### Free-tier sleep behavior

If nobody hits the backend for 15 min, Render spins it down. The next request reanimates it (~30 s wake). Symptoms:
- First page load after a long idle → "loading…" spinner for 30 s, then everything works.
- Realtime broadcasts still flow through Supabase (those don't touch the backend), so the FE stays "live" even when the BE is asleep.

To work around: upgrade to **Starter** ($7/mo) — no sleep — or hit `/health` from a cron pinger (e.g., UptimeRobot every 14 min, free).

---

## Step 3 — Deploy the front-end to Vercel

1. <https://vercel.com/new> → **Import Git Repository** → pick `JasonDuong255/Project-Management`.
2. **Configure Project** screen:
   - **Project Name**: `qlda` (becomes the subdomain `qlda.vercel.app`)
   - **Framework Preset**: Vite (auto-detected)
   - **Root Directory**: click **Edit** → set to `front-end`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
   - **Install Command**: `npm install` (default)
3. **Environment Variables** — add three:
   ```
   VITE_API_URL=https://qlda-backend.onrender.com/api
   VITE_SUPABASE_URL=https://<prod-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<prod-anon-key>
   ```
   - **`VITE_API_URL` is the Render URL with `/api` suffixed.**
   - The Supabase pair must be the **same project** as the backend's `SUPABASE_URL` / `SUPABASE_ANON_KEY`. If they diverge, JWTs from the FE won't verify on the BE.
4. **Deploy**. First build takes 1–2 min.
5. Vercel gives you `https://qlda.vercel.app` (and a per-deploy preview URL). Copy the production URL.

The SPA-rewrite is already handled by `front-end/vercel.json` — deep links like `/projects/p-1` fall back to `index.html` correctly. No extra config needed.

---

## Step 4 — Wire CORS

After Vercel gives you the FE URL:

1. Go back to **Render** → `qlda-backend` → **Environment**.
2. Edit `CORS_ORIGIN` to your Vercel URL(s):
   ```
   CORS_ORIGIN=https://qlda.vercel.app,https://www.qlda.vercel.app
   ```
   - Comma-separated. Include any custom domain you bind later.
3. Click **Save Changes**. Render auto-redeploys (~2 min).

---

## Step 5 — Smoke test

1. Open `https://qlda.vercel.app`. The login screen appears. (First load after a long idle hits the cold-start ~30 s wake — be patient.)
2. Click any demo account (or type a username). Auth should succeed; dashboard loads.
3. DevTools → Network → confirm:
   - `signInWithPassword` call goes to `*.supabase.co` ✓
   - `GET /api/snapshot` goes to `qlda-backend.onrender.com` ✓ (200 OK with JSON)
4. Hard-refresh on `/projects` (deep link). Should still load (SPA rewrite working).
5. Optional E2E: navigate to a project as `pm.an` → click **"Yêu cầu đóng TTK"**, then log in as `dev.duy` (KSV) → approve. The Render logs should show `[email:console]` lines for the notifications.

If something fails, check this order:
- `/health` on the Render URL — is the backend even up? (Wake the cold start first.)
- Browser DevTools Network — what status code, what error body?
- Render **Logs** tab — any Prisma error, env-var validation failure, or CORS reject?
- Vercel **Build Logs** — did the build succeed with the right `VITE_*` vars baked in?

---

## Step 6 — Custom domain (optional)

### On Vercel (FE)
- **Settings** → **Domains** → **Add** → `qlda.example.com`
- Update DNS as Vercel instructs. SSL is automatic.
- After it's live, update Render's `CORS_ORIGIN` to include the new domain.

### On Render (BE)
- **Settings** → **Custom Domains** → **Add Custom Domain** → `api.qlda.example.com`
- Add the CNAME in your DNS as Render instructs.
- Update Vercel's `VITE_API_URL` to `https://api.qlda.example.com/api`.
- Trigger a redeploy on Vercel (Deployments → … → Redeploy) for the new env to take effect.

---

## Continuous deployment

Both Vercel and Render redeploy automatically on every push to the configured branch.

- **Vercel**: every PR opens a unique preview URL (e.g. `qlda-git-v3.2-close-workflow-<scope>.vercel.app`).
- **Render**: by default deploys from `main`. To deploy a feature branch, change Branch in Settings → Build & Deploy.

Vercel previews use the same env vars as production unless you override per-environment. **Important:** if your Vercel preview hits the production Render BE, every preview can mutate prod data. Either:
- Make Vercel previews target a staging Render service (override `VITE_API_URL` for "Preview" environment), or
- Disable Vercel previews on this repo (Settings → Git → uncheck Preview deployments).

---

## Why Render free is "good enough but not great"

| Aspect | Free tier behavior | Workaround |
| ------ | ------------------ | ---------- |
| Sleep after 15 min idle | First request after idle takes ~30 s | UptimeRobot ping every 14 min, or upgrade to Starter ($7/mo) |
| 512 MB RAM | Fine for our Express + Prisma + ~50 active users | Upgrade if you hit OOM in logs |
| 750 build-hours/month | One always-on web service uses ~720h | Sleep ensures we stay under the cap |
| Scheduler (`RUN_SCHEDULER=true`) | Won't fire reliably (sleeps) | Schedule on Starter plan, or move alerts to a separate cron service (e.g., GitHub Actions calling a webhook) |
| No persistent disk | Fine — all state in Supabase | — |

For a real production deployment under VNA group, plan to upgrade to Starter ($7/mo per service) once daily-traffic warrants no cold starts.

---

## Reference: env vars summary

| Where | Var | Local dev | Production |
| ----- | --- | --------- | ---------- |
| FE (Vercel) | `VITE_API_URL` | `/api` | `https://qlda-backend.onrender.com/api` |
| FE (Vercel) | `VITE_SUPABASE_URL` | dev project | **prod project** |
| FE (Vercel) | `VITE_SUPABASE_ANON_KEY` | dev anon | **prod anon** |
| BE (Render) | `NODE_ENV` | `development` | `production` |
| BE (Render) | `PORT` | `4000` | `10000` (Render default) |
| BE (Render) | `CORS_ORIGIN` | `http://localhost:5173` | `https://qlda.vercel.app` (+ custom domain) |
| BE (Render) | `DATABASE_URL`, `DIRECT_URL` | dev pooler URL (5432, session) | prod pooler URL (5432, session) |
| BE (Render) | `SUPABASE_URL` / `*_ANON_KEY` / `*_SERVICE_ROLE_KEY` | dev keys | prod keys |
| BE (Render) | `SUPABASE_JWT_SECRET` | optional | **set it** for fast verify |
| BE (Render) | `EMAIL_TRANSPORT` | `console` | `console` for now; `smtp` once SMTP wired |
| BE (Render) | `RUN_SCHEDULER` | unset | `true` on **one** instance — **needs paid plan** (free sleeps) |

Full per-var docs: [`backend/README.md`](../backend/README.md) and [`front-end/README.md`](../front-end/README.md).
