# Frontend ⇄ Backend integration

This SPA now talks to a real backend (Express + Prisma + Supabase) at `D:\code\QLDA\backend`. The previous `mockApi.ts`/`localStorage` data path has been removed.

## Environment

Create `.env` (already created with the project's Supabase keys):

```
VITE_API_URL=/api
VITE_SUPABASE_URL=https://yvmbzokglemjgcbdueoa.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

`vite.config.ts` proxies `/api` → `http://localhost:4000` in dev so the FE and BE share an origin.

## Running both processes

Open two terminals.

```powershell
# Terminal 1 — backend
cd D:\code\QLDA\backend
npm run dev     # http://localhost:4000

# Terminal 2 — frontend
cd D:\code\QLDA\Project-Management
npm run dev     # http://localhost:5173
```

Visit http://localhost:5173 — the login page lists all 8 demo accounts as quick-login buttons.

## Test accounts

All passwords are `123456`. Type just the **username** (no `@`) — the FE appends `@qlda.local`.

| Username | Role | Notes |
| -------- | ---- | ----- |
| sys.chau | PMO | Sees all projects, can edit catalogs, can reset demo data |
| hc.hoa | ADMIN_HC | Approval workflow |
| pm.an | PM | Owns PRJ-2026-001 + PRJ-2026-002 |
| pm.ha | PM | Owns PRJ-2026-003 |
| dev.binh, dev.duy, dev.khang, dev.lan | DELIVERY_MEMBER | Members of various projects |

## Data layer

- **No mock data anywhere** — `src/lib/mockApi.ts` is deleted, `localStorage` is no longer used as a data store.
- **`src/lib/apiClient.ts`** is the single network layer. It mirrors the original `mockApi` exports so `AppContext` swaps cleanly.
- **`src/lib/supabase.ts`** owns the Supabase client (login + realtime).
- **Realtime**: `AppContext` subscribes to `postgres_changes` on every QLDA table; any insert/update/delete triggers `refresh()` so two browser windows stay in sync.

## Verifying end-to-end

The backend ships with two scripts you can run after the BE is up on `:4000`:

```powershell
cd D:\code\QLDA\backend
npx tsx src/db/smoke-test.ts   # logs in as 4 roles, asserts visibility filter
npx tsx src/db/e2e-test.ts     # exercises every mutation endpoint
```

Both should print "✓" / "PASSED" lines and exit 0.
