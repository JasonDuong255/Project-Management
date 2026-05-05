# QLDA — Front-end

React + TypeScript SPA for the QLDA Project Management system. Talks to the [QLDA backend](../backend/README.md) (Express + Prisma + Supabase).

> Bigger picture: see `../.docs/00-context.md` for the project overview, role model, and architecture. See `../.docs/BACKEND_SETUP.md` for how the FE and BE wire together.

## Stack

React 19 · Vite 8 · TypeScript (strict) · React Router 7 · Supabase JS (auth + realtime) · Recharts · lucide-react · dayjs.

## Setup

```bash
cd D:\code\QLDA\front-end
npm install
cp .env.example .env   # then fill in Supabase + API URL (see "Environment variables" below)
npm run dev            # http://localhost:5173 (assumes the backend is running on :4000)
```

> The vite dev server proxies `/api` → `http://localhost:4000`, so `VITE_API_URL=/api` works in dev. See `vite.config.ts`.

## Environment variables

All env vars must be **prefixed with `VITE_`** to be exposed to the bundle. Vite reads them from `.env` at build time.

| Variable | Required | Used for | Where to find it |
| -------- | :------: | -------- | ---------------- |
| `VITE_API_URL` | yes | Where the FE sends REST requests. In dev: `/api` (vite proxies to BE). In prod: the public URL of your backend, e.g. `https://api.qlda.example.com/api`. | depends on deploy |
| `VITE_SUPABASE_URL` | yes | Supabase project URL — used by `@supabase/supabase-js` for auth + realtime. Must match the BE's `SUPABASE_URL`. | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Anon public key — safe to ship to the browser. Must match the BE's `SUPABASE_ANON_KEY`. | Supabase dashboard → Project Settings → API → `anon public` |

**Never** put `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_JWT_SECRET` in a `VITE_*` var — those go in the backend only and would leak to the browser.

### What changes between local dev and production

| Var | Local dev | Production |
| --- | --------- | ---------- |
| `VITE_API_URL` | `/api` (vite proxies to `localhost:4000`) | `https://api.qlda.example.com/api` (your deployed BE URL) |
| `VITE_SUPABASE_URL` | dev Supabase project URL | **prod Supabase project URL** |
| `VITE_SUPABASE_ANON_KEY` | dev anon key | **prod anon key** |

The `VITE_SUPABASE_*` pair must match the backend's pair — i.e., FE and BE talk to the **same** Supabase project. If they diverge, JWTs issued by Supabase to the FE will fail verification on the BE.

### Login email convention

Demo accounts authenticate via Supabase email + password using emails of the form `<username>@qlda.local`. The login form accepts a bare username and the FE prepends the suffix automatically (`src/lib/supabase.ts → resolveEmail`). In prod, point users at real email addresses or replace the resolver.

## Build

```bash
npm run build       # tsc -b && vite build → dist/
npm run preview     # serves dist/ locally for sanity-check
```

The build inlines the values of `VITE_*` env vars at compile time. **Different deploy environments need different builds.** A `dist/` built with dev `VITE_SUPABASE_URL` will NOT work in prod.

## Deployment

The output of `npm run build` is a static `dist/` folder — host on any static host that supports SPA routing (single-page fallback to `index.html`).

### Steps

1. **Set env vars** on your build pipeline (Cloudflare Pages, Vercel, Netlify, etc.):
   ```
   VITE_API_URL=https://api.qlda.example.com/api
   VITE_SUPABASE_URL=https://<prod-ref>.supabase.co
   VITE_SUPABASE_ANON_KEY=<prod-anon-key>
   ```
2. **Build command**: `npm run build`. **Publish dir**: `dist`.
3. **SPA rewrite**: configure the host to fall back to `/index.html` for any route that doesn't match a static file. Otherwise direct-loading `/projects/:id` returns 404.
   - Cloudflare Pages → already does this by default for SPAs
   - Netlify → `_redirects` file: `/* /index.html 200`
   - Vercel → `vercel.json`: `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`
4. **CORS**: ensure the backend's `CORS_ORIGIN` env var lists your FE's deployed origin (e.g. `https://qlda.example.com`).

### Quick checks after deploy

- Open the deployed FE URL → login page should show 8 demo accounts.
- Pick `sys.chau` → quick-login → Dashboard should populate (no 401 / CORS errors in DevTools network tab).
- Open DevTools → Application → Local Storage → confirm a `sb-<ref>-auth-token` row exists.
- Hard-refresh on `/projects` (deep link) → page should still load (SPA fallback working).

If `/api/snapshot` 401s right after login, the FE's `VITE_SUPABASE_*` pair doesn't match the BE's `SUPABASE_*` pair.
