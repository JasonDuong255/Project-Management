# ONBOARDING — QLDA Frontend (`front-end/`)

> Local folder layout (post-monorepo restructure): `D:\code\QLDA\front-end\` (this app), `D:\code\QLDA\backend\` (Express API), `D:\code\QLDA\.docs\` (project docs). The GitHub repo is still named `Project-Management` (`JasonDuong255/Project-Management`); only the local folder was renamed.

A spec to get a new developer productive in their first day. Every claim cites the file it came from. If something is not in the repo, it is marked **Not documented in repo — ask the team.**

---

## 1. Project Overview

**QLDA** (Quản lý dự án — Vietnamese for "Project Management") is an internal PPM (Project & Portfolio Management) demo SPA for tracking the full project lifecycle: initiation → administrative approval → planning → execution → worklog tracking → reporting. The branding name visible in the sidebar is **QLDA** (`src/components/AppShell.tsx:100`); the package name is generic `frontend` (`package.json:2`).

Core flows (inferred from page names in `src/App.tsx:43-65` and panel copy):

- **PMO** creates a project → **ADMIN_HC** approves the establishment → **PM** plans tasks, assigns members, allocates monthly hours → **DELIVERY_MEMBER** logs work and raises delays → all roles consume dashboards/reports.

The login page sets the tone (`src/pages/LoginPage.tsx:65-95`):

> "Bộ khung frontend React + TypeScript dùng JSON làm nguồn fake API, mô phỏng đủ các vai trò PM, thành viên triển khai và admin hệ thống."
>
> *Translation: a React + TypeScript frontend skeleton using JSON as a fake API, simulating PM, delivery member, and system admin roles.*

This is a **demo / prototype** — there is no real backend. Mock data lives in `public/mock/*.json` and is loaded into `localStorage` on first run (`src/lib/mockApi.ts:484-518`).

**Production URL / staging:** Not documented in repo — ask the team. The repo's `master` branch contained a `CNAME` file recently (`git log --oneline`), suggesting GitHub Pages may have been used at some point, but the current `main` does not configure a deploy target.

---

## 2. Tech Stack

Versions are pinned in `package.json:12-33`. Notes describe how each is used **here**, not generic library descriptions.

| Concern             | Choice                                  | Version  | How it's used here                                                                            |
| ------------------- | --------------------------------------- | -------- | --------------------------------------------------------------------------------------------- |
| Framework           | React                                   | 19.2.4   | Function components only; `StrictMode` enabled in `src/main.tsx:7`                            |
| Language            | TypeScript                              | ~5.9.3   | Strict mode + `verbatimModuleSyntax` (forces `import type`) — `tsconfig.app.json:14`          |
| Bundler / dev       | Vite                                    | 8.0.1    | Bare config — only `@vitejs/plugin-react` (`vite.config.ts:5-7`); default port 5173           |
| Package manager     | npm (`package-lock.json` present)       | —        | No `pnpm-lock` / `yarn.lock`. Engines field is **absent**, so node version is unpinned.       |
| Router              | react-router-dom                        | 7.13.1   | `BrowserRouter` with route config (not file-based) in `src/App.tsx:41-68`                     |
| State management    | React Context only                      | built-in | Single `AppProvider` in `src/context/AppContext.tsx:82` exposes everything via `useAppData()` |
| Server-state / data | Custom mock API → `localStorage`        | n/a      | `src/lib/mockApi.ts` — every mutation returns a fresh `AppSnapshot`                           |
| Styling             | Plain CSS with CSS variables            | n/a      | One global stylesheet `src/index.css` (~2200 lines); `src/App.css` is intentionally empty     |
| Component library   | None                                    | —        | Custom primitives in `src/components/` (`StatCard`, `StatusPill`, `SectionHeader`)            |
| Icons               | lucide-react                            | 0.577.0  | Imported per-file: `import { LayoutDashboard } from 'lucide-react'`                           |
| Charts              | recharts                                | 3.8.0    | Used on `DashboardPage` and `ReportsPage` (Pie/Bar/Line)                                      |
| Date handling       | dayjs                                   | 1.11.20  | Wrapped through `src/lib/formatters.ts` for DD/MM/YYYY formatting                             |
| Forms               | None — raw `useState` + `<form>`        | —        | See `src/pages/LoginPage.tsx:103-129` for the canonical pattern                               |
| Validation          | None                                    | —        | Validation is inline (e.g. `ProjectsPage.tsx:285-294`)                                        |
| Testing             | **None configured**                     | —        | No `vitest`, `jest`, `playwright`, `@testing-library/*`, no `*.test.*` files                  |
| Linting             | ESLint flat config + typescript-eslint  | 9.39.4   | `eslint.config.js` extends `recommended` + `react-hooks` + `react-refresh` only               |
| Formatting          | None                                    | —        | No `.prettierrc`, no `prettier` dep                                                           |
| CI / CD             | **None**                                | —        | No `.github/workflows`, no `Dockerfile`, no other CI config                                   |
| Hosting             | Not documented in repo — ask the team   | —        | (See §1 note about historical `CNAME` on `master`.)                                           |

Worth noting from `tsconfig.app.json:11-25`: `moduleResolution: "bundler"`, `noUnusedLocals: true`, `noUnusedParameters: true`, `erasableSyntaxOnly: true`. These will fail your build if violated.

---

## 3. Getting Started

### Prerequisites

- **Node.js** — version not pinned in repo (no `engines` field, no `.nvmrc`). Vite 8 requires Node ≥ 20.19; use Node 20 LTS or newer.
- **npm** — comes with Node.
- **Git** — for cloning.
- **Modern browser** — the app uses `window.structuredClone` (`src/lib/mockApi.ts:458`), available in Chrome 98+/Firefox 94+/Safari 15.4+.

### First-time setup

Run from the front-end repo root (`front-end/`):

```bash
git clone https://github.com/JasonDuong255/Project-Management.git front-end
cd front-end
npm install
npm run dev
```

Vite will print the local URL (default `http://localhost:5173`). Open it. The `LoginRoute` shows a loading card while `mockApi.getSnapshot()` boots (`src/App.tsx:17-37`), then renders the login screen.

### Environment variables

**There is no `.env.example` and no `import.meta.env.*` references in the codebase.** The app needs no env vars to run.

### Demo credentials

The app seeds 8 demo users (all password `123456`) via `public/mock/users.json`. The login page displays them as quick-login buttons (`src/pages/LoginPage.tsx:131-146`). Defaults are `pm.an / 123456` (`LoginPage.tsx:12-13`).

| Username   | Role              | Use for                                          |
| ---------- | ----------------- | ------------------------------------------------ |
| `sys.chau` | PMO               | Full PMO view, admin catalog page, create projects |
| `hc.hoa`   | ADMIN_HC          | Approval workflow                                 |
| `pm.an`    | PM                | PM workspace (default login)                      |
| `pm.ha`    | PM                | Second PM for multi-PM tests                      |
| `dev.binh` | DELIVERY_MEMBER   | Member workspace, log time, raise delays         |
| `dev.duy`, `dev.khang`, `dev.lan` | DELIVERY_MEMBER | Workload distribution tests       |

### Common first-run issues

- **Stale demo data.** Mutations write to `localStorage` (keys `ppm-demo-db-v2` and `ppm-demo-current-user-v2` — `src/lib/mockApi.ts:24-25`). To re-seed: open the Admin Catalog page or call `resetDemoData()` (`mockApi.ts:1201-1205`), or in DevTools console run `localStorage.clear()` and refresh.
- **Build fails on unused vars.** Strict TS flags reject unused locals/params (`tsconfig.app.json:21-22`). Prefix with `_` only works at the lint level — TS still rejects them.
- **`verbatimModuleSyntax` errors.** Always `import type { Foo }` for types-only imports (see any page file, e.g. `src/pages/ProjectsPage.tsx:17`).

---

## 4. Available Scripts

All four are defined in `package.json:6-11`. There are no others.

### Development
- `npm run dev` — starts Vite dev server at `http://localhost:5173` with HMR.

### Building
- `npm run build` — runs `tsc -b && vite build`. The `tsc -b` step uses the project-references `tsconfig.json` so both `tsconfig.app.json` and `tsconfig.node.json` are type-checked. Vite output goes to `dist/`.

### Linting
- `npm run lint` — runs `eslint .` over the whole repo using the flat config in `eslint.config.js`.

### Utilities / Preview
- `npm run preview` — runs `vite preview` to serve the built `dist/` locally, usually for sanity-checking a production build before deploying.

### Testing / Deployment
- **No test script.** No CI / deployment scripts.

---

## 5. Architecture

### High-level

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (SPA — Vite-built React 19)                         │
│                                                             │
│  src/main.tsx → <App />                                     │
│    └─ <AppProvider>  ◄── src/context/AppContext.tsx         │
│         loads snapshot once on mount                        │
│         exposes mutations via useAppData()                  │
│       └─ <BrowserRouter>                                    │
│            ├─ /login           ← LoginRoute                 │
│            └─ <ProtectedRoute>                              │
│                 └─ <AppShell>  ← sidebar + topbar           │
│                      └─ <Outlet> ← page                     │
│                                                             │
│  ┌─────────── data flow ───────────┐                        │
│  │ Page calls useAppData().xxx()   │                        │
│  │   ↓                             │                        │
│  │ AppContext calls mockApi.xxx()  │                        │
│  │   ↓                             │                        │
│  │ mockApi reads/writes            │                        │
│  │   localStorage['ppm-demo-db-v2']│                        │
│  │   ↓ returns AppSnapshot         │                        │
│  │ AppContext setState(snapshot)   │                        │
│  └─────────────────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘

First run only:
  mockApi.ensureDatabase() → fetches /mock/*.json (7 files)
                          → normalizeDatabase()
                          → writes to localStorage
```

### Rendering model
**Pure SPA.** No SSR, no SSG, no RSC. `index.html` ships an empty `<div id="root">` and a single `<script type="module" src="/src/main.tsx">` (`index.html:10-11`). Routing is client-side via `react-router-dom@7` `BrowserRouter`.

### Request lifecycle (user click → result)

Take "create a project" as the canonical example:

1. User submits form in `ProjectsPage.tsx:265-310`.
2. `createProject(input)` from `useAppData()` is called (`ProjectsPage.tsx:295`).
3. `AppContext.createProject` delegates to `mockApi.createProject(input)` (`AppContext.tsx:120-123`).
4. `mockApi.createProject` calls `updateDatabase(recipe)` (`mockApi.ts:572-643`):
   - clones the current DB,
   - applies the mutation,
   - writes the DB back to `localStorage`,
   - waits 220 ms (artificial latency, `mockApi.ts:27-31`),
   - returns a fresh `AppSnapshot`.
5. Context calls `setState(snapshot)` and React re-renders all consumers.

### Module boundaries

There are **no enforced layering rules** (no ESLint `import/no-restricted-paths`, no path alias guard). The de-facto convention from reading the code:

- `src/pages/*` → may import `components/`, `context/`, `lib/`, `types`.
- `src/components/*` → may import `context/`, `lib/`, `types`.
- `src/lib/*` → pure functions; depend on `types` only. **Calculations live here, not in components.**
- `src/context/AppContext.tsx` → only entry point that calls `mockApi`.
- `src/lib/mockApi.ts` → only file that touches `localStorage` and `fetch('/mock/...')`.

Components do not call `mockApi` directly anywhere in the codebase.

---

## 6. Folder Structure

```
Project-Management/
├── public/
│   ├── favicon.svg, icons.svg                  # static assets served at /
│   └── mock/                                   # SEED DATA (fetched once)
│       ├── users.json          (8 users, all password "123456")
│       ├── projects.json       (sample portfolio)
│       ├── plan-items.json     (tasks + subtasks, parentId tree)
│       ├── worklogs.json       (time entries)
│       ├── delay-raises.json   (re-plan requests)
│       ├── activity-logs.json  (audit trail)
│       └── catalogs.json       (LOVs: statuses, departments, roles)
├── src/
│   ├── main.tsx                                # ReactDOM root
│   ├── App.tsx                                 # router + provider wiring
│   ├── index.css                               # ~2200 lines, the entire design system
│   ├── App.css                                 # intentionally empty
│   ├── assets/                                 # bundled images (hero.png, *.svg)
│   ├── components/                             # 6 cross-page primitives
│   │   ├── AppShell.tsx                        # sidebar + topbar layout (used by every protected route)
│   │   ├── ProtectedRoute.tsx                  # auth + role gate
│   │   ├── SectionHeader.tsx                   # page-title block
│   │   ├── StatCard.tsx                        # KPI card with --card-accent var
│   │   ├── StatusPill.tsx                      # tone-coloured badge (neutral/info/success/warning/danger)
│   │   └── GanttChart.tsx                      # custom Gantt (no external lib)
│   ├── context/
│   │   └── AppContext.tsx                      # the only context, the only state container
│   ├── lib/
│   │   ├── mockApi.ts                          # localStorage-backed API (~1200 lines)
│   │   ├── calculations.ts                     # pure selectors & permission helpers
│   │   └── formatters.ts                       # date/role/catalog label helpers
│   ├── pages/                                  # one file per route, named exports
│   │   ├── LoginPage.tsx                       # demo login + quick-login buttons
│   │   ├── DashboardPage.tsx                   # KPIs + charts (recharts)
│   │   ├── ProjectsPage.tsx                    # list + create-project modal (~630 lines)
│   │   ├── ProjectDetailPage.tsx               # 7-tab project workspace (~3800 lines, the big one)
│   │   ├── MemberWorkspacePage.tsx             # delivery-member task list
│   │   ├── GanttPage.tsx                       # Gantt by project or by member
│   │   ├── ReportsPage.tsx                     # tabular reports
│   │   ├── NotificationCenterPage.tsx          # 7-day deadline alerts
│   │   ├── AdminCatalogPage.tsx                # read-only LOV viewer (PMO/SYSTEM_ADMIN only)
│   │   └── WorkloadPage.tsx                    # ⚠ ORPHANED — see §19 Gotchas
│   └── types/
│       └── index.ts                            # ~440 lines, all domain types in one file
├── index.html                                  # Vite entry
├── package.json, package-lock.json
├── vite.config.ts                              # plugin: react() only
├── tsconfig.json (refs) → tsconfig.app.json + tsconfig.node.json
├── eslint.config.js
└── .gitignore
```

### Path aliases

**None.** All imports are relative (`'../lib/calculations'`, `'../types'`). There is no `paths` field in any `tsconfig.*.json`, no `resolve.alias` in `vite.config.ts`. Don't introduce `@/` aliases without coordinating — every existing import would need updating.

### Barrel exports

Only `src/types/index.ts` acts as a barrel (re-exports nothing — it's the canonical types file). Other folders export per-file.

---

## 7. Routing

- **Library:** `react-router-dom@7.13.1`.
- **Pattern:** **Config-based** (not file-based). All routes are listed in one `<Routes>` block in `src/App.tsx:41-68`.

### Route map

| Path                       | Element                  | Access                          |
| -------------------------- | ------------------------ | ------------------------------- |
| `/login`                   | `LoginRoute`             | Public; redirects to `/dashboard` if already logged in |
| `/`                        | `Navigate to /dashboard` | Index of the protected layout   |
| `/dashboard`               | `DashboardPage`          | Any logged-in user              |
| `/notifications`           | `NotificationCenterPage` | Any logged-in user              |
| `/projects`                | `ProjectsPage`           | Any logged-in user (filtered)   |
| `/projects/:projectId`     | `ProjectDetailPage`      | Any logged-in user (filtered)   |
| `/member-workspace`        | `MemberWorkspacePage`    | DELIVERY_MEMBER (others see empty state — `MemberWorkspacePage.tsx:11-27`) |
| `/gantt`                   | `GanttPage`              | Any logged-in user              |
| `/reports`                 | `ReportsPage`            | Any logged-in user (filtered)   |
| `/admin/catalogs`          | `AdminCatalogPage`       | **PMO + SYSTEM_ADMIN only** (`App.tsx:55-62`) |
| `*`                        | `Navigate to /dashboard` | Catch-all                       |

### Route protection

Two layers in `src/components/ProtectedRoute.tsx`:

```tsx
// Outer guard: redirect unauthenticated users to /login
if (!currentUser) {
  return <Navigate to="/login" replace state={{ from: location.pathname }} />
}
// Inner role guard: redirect users without the required role back to dashboard
if (allowedRoles && !allowedRoles.includes(currentUser.role)) {
  return <Navigate to="/dashboard" replace />
}
```

The outer `<ProtectedRoute />` wraps the whole protected tree. A nested `<ProtectedRoute allowedRoles={['SYSTEM_ADMIN', 'PMO']}>` enforces the admin gate (`App.tsx:55-62`).

**Note:** the original-path-on-redirect behaviour exists (`location.state.from` is set), but only `LoginPage.tsx:17-23` reads it; `LoginRoute` always sends users to `/dashboard` after login.

### Layout / nesting

`<AppShell />` (sidebar + topbar) is a layout route inside the protection block (`App.tsx:46`). All page components render into its `<Outlet />` (`AppShell.tsx:179`). The sidebar nav itself is filtered by role in `AppShell.tsx:75-77`.

### Dynamic routes

Only one — `/projects/:projectId`, read with `useParams()` in `ProjectDetailPage.tsx:15`.

---

## 8. State Management

### Inventory

| Kind           | Library                | Where                                                         |
| -------------- | ---------------------- | ------------------------------------------------------------- |
| Local state    | `useState`/`useEffect` | Per-component (e.g. form state in `ProjectsPage.tsx:138-157`) |
| Global state   | React Context          | `src/context/AppContext.tsx` — the single global store        |
| Server state   | Same Context           | (No real server; the Context wraps `mockApi`)                 |
| URL state      | `useParams`, `useLocation`, `useNavigate` from `react-router-dom` | e.g. `ProjectDetailPage.tsx:15` |
| Form state     | `useState`             | No library; see `LoginPage.tsx:12-15`                         |

There is **no** Redux, Zustand, Jotai, Recoil, MobX, TanStack Query, SWR, or React Hook Form anywhere.

### `AppContext` shape

`AppContext` exposes the entire `AppSnapshot` (current user + all collections) flattened together with mutations (`AppContext.tsx:31-59`):

```ts
interface AppContextValue extends AppSnapshot {
  isLoading: boolean
  login, logout, refresh, resetDemoData
  createProject, updateProject
  addProjectDocument, updateProjectDocument, deleteProjectDocument
  savePlanItem, deletePlanItem
  addWorklog, raiseDelay
  saveAllocation, saveRisk
  updateCatalogGroup, getUser
}
```

Every mutation method follows the same pattern (`AppContext.tsx:120-123`):

```ts
async function createProject(input: CreateProjectInput) {
  const snapshot = await mockApi.createProject(input)
  setState(snapshot)
}
```

### Cross-component communication

**There is none beyond context.** No event bus, no pub-sub. If component A needs to react to a mutation in component B, both consume `useAppData()` and rely on the context re-render.

### Consuming the context — canonical example

```tsx
// src/pages/ReportsPage.tsx:16-17
const { currentUser, projects, planItems, worklogs, users, delayRaises, getUser } =
  useAppData()
```

`useAppData()` throws if used outside the provider (`AppContext.tsx:231-238`) — useful guardrail when adding tests later.

---

## 9. Data Layer

### "API" client

There is no real API client. `src/lib/mockApi.ts` is a synchronous-feeling, `localStorage`-backed CRUD layer with artificial latency. The two storage keys (`mockApi.ts:24-25`):

```ts
const STORAGE_KEY = 'ppm-demo-db-v2'
const CURRENT_USER_KEY = 'ppm-demo-current-user-v2'
```

The bump suffix `-v2` matters: if you change the on-disk shape, increment to `-v3` or callers will see a half-migrated DB.

### Endpoints

Every exported function in `mockApi.ts` is the equivalent of a REST endpoint. Group them as:

- **Auth:** `login`, `logout`, `getSnapshot` (`mockApi.ts:542-570`).
- **Project CRUD:** `createProject`, `updateProject`.
- **Project sub-resources:** `addProjectDocument`, `updateProjectDocument`, `deleteProjectDocument`, `saveAllocation`, `saveRisk`.
- **Plan tasks:** `savePlanItem`, `deletePlanItem`.
- **Time / delays:** `addWorklog`, `raiseDelay`.
- **Catalog:** `updateCatalogGroup`.
- **Demo control:** `resetDemoData`.

### Typing

Strong end-to-end. Every input has a dedicated `*Input` interface in `src/types/index.ts` (e.g. `CreateProjectInput`, `SavePlanItemInput`, `SaveRiskInput`). The DB shape is `MockDatabase`; the React-facing snapshot is `AppSnapshot extends MockDatabase` (`types/index.ts:282-294`).

### Caching / revalidation / optimistic updates

- **Caching:** `localStorage` IS the cache. There is no in-memory cache beyond React state.
- **Revalidation:** Every mutation returns a *full* `AppSnapshot` and replaces the entire state — no partial revalidation, no `react-query`-style invalidation.
- **Optimistic updates:** None. The UI awaits the (artificial 220 ms) round-trip.

### Error handling

Minimal. `fetchJsonFile` throws on non-`ok` responses (`mockApi.ts:474-482`). Mutations have no error path — they assume `localStorage` is writable. Components don't wrap calls in `try/catch`. Login is the only mutation that returns a typed result (`AppContext.tsx:26-29, 101-113`):

```ts
interface LoginResult { ok: boolean; message?: string }
```

### Mocking for development / testing

Mocking *is* the production path here — there is no real backend to mock against. To "reset" mocks: call `resetDemoData()` from `useAppData()`, or `localStorage.clear()` in DevTools.

---

## 10. Styling System

### Strategy

**Plain CSS, single global stylesheet at `src/index.css` (~2200 lines).** No CSS Modules, no styled-components, no Tailwind, no PostCSS plugins.

### Design tokens

All tokens are CSS variables on `:root` in `src/index.css:5-49`:

```css
:root {
  /* Core palette */
  --bg: #f5f5f7;
  --panel: #ffffff;
  --ink: #1a1a2e;
  --muted: #6b7280;
  --accent: #e8612c;          /* primary action — orange */
  --teal: #0f766e;
  --info: #2563eb;
  --warning: #d97706;
  --danger: #dc2626;
  --success: #16a34a;
  --radius: 12px;
  --radius-lg: 16px;
  --shadow, --shadow-md, --shadow-lg: ...

  /* Sidebar */
  --sidebar-width: 260px;
  --sidebar-active-bg: #fff3ed;
  --sidebar-active-text: #e8612c;
}
```

The header comment calls it the **"QLDA — New Design System (Deli-Plany inspired)"**.

### Theming / dark mode

Light only. `color-scheme: light` is set explicitly (`index.css:15`). No `prefers-color-scheme` overrides found.

### Component classes

Components reach for class names defined in `index.css`. Common ones (search the stylesheet to see them all):

- Layout: `.app-shell`, `.sidebar`, `.app-content`, `.topbar`, `.page-grid`
- Cards: `.panel`, `.stat-card`, `.detail-card`, `.feature-card`
- Status: `.status-pill`, `.tone-success`, `.tone-warning`, `.tone-danger`, `.tone-info`, `.tone-neutral`
- Buttons: `.primary-button`, `.ghost-button`, `.topbar-icon-btn`
- Tables: `.table-wrapper`, `.stack-list`, `.list-row`
- Gantt: `.gantt-panel`, `.gantt-row`, `.gantt-bar`, etc.

Component-level customisation goes through CSS-var overrides via inline `style`, e.g. `StatCard.tsx:19`:

```tsx
<article className="stat-card" style={{ '--card-accent': accent } as CSSProperties}>
```

### Responsive design

Single breakpoints are inside `index.css` (search for `@media`). The shell assumes a desktop sidebar; mobile is **Not documented in repo — ask the team** as a designed concern.

---

## 11. Component Conventions

### Naming and exports

- **Named exports only**, except `App` (the only `export default` — `src/App.tsx:80`). Every page and component does `export function FooPage()` / `export function FooComponent()`.
- File name = component name in PascalCase (`StatCard.tsx`, `ProjectDetailPage.tsx`).
- Pages live in `src/pages/`; reusable building blocks in `src/components/`.
- One component per file. No co-located styles, no co-located tests, no `index.ts` barrels per folder.

### Component anatomy

Canonical small component (`src/components/StatCard.tsx`):

```tsx
import type { CSSProperties, ReactNode } from 'react'

interface StatCardProps {
  label: string
  value: string | number
  helper: string
  accent?: string
  icon?: ReactNode
}

export function StatCard({
  label,
  value,
  helper,
  accent = 'var(--accent)',
  icon,
}: StatCardProps) {
  return (
    <article className="stat-card" style={{ '--card-accent': accent } as CSSProperties}>
      <div className="stat-card__header">
        <span>{label}</span>
        {icon ? <div className="stat-card__icon">{icon}</div> : null}
      </div>
      <strong>{value}</strong>
      <p>{helper}</p>
    </article>
  )
}
```

Patterns to copy:

- Props are a `Foo`Props interface above the component, never inlined.
- Default values via destructuring, not `defaultProps`.
- Conditional rendering uses `cond ? <X /> : null` (never `cond && <X />` — there is no codified rule, but every example follows the ternary form).
- `import type` for types-only imports (required by `verbatimModuleSyntax`).
- No `React.FC`, no `React.memo`, no `useMemo`/`useCallback` unless there's a measured reason. `ProjectsPage.tsx:160-190` is the only file with `useMemo`.
- No `forwardRef` is used anywhere in `src/components/`.

### When to create a new component vs extend

The existing components are very small (`StatCard`, `StatusPill`, `SectionHeader`). The current convention extracts a component when:

1. It's used on **two or more pages** (`StatusPill`, `SectionHeader`, `StatCard` all are).
2. It encapsulates non-trivial layout (`AppShell`, `GanttChart`).

In-page sections (e.g. the project-create modal in `ProjectsPage.tsx`) are kept inline rather than extracted.

### Accessibility

Limited but non-zero. The Gantt rows pass `role="button"` / `tabIndex={0}` and handle Enter/Space when interactive (`GanttChart.tsx:154-166`). Most other UI elements rely on native semantics (`<button>`, `<label>`). There is no `aria-live`, no focus-trap on modals, and no skip-link. Improvements are explicitly **Not documented in repo — ask the team** for any standard.

---

## 12. Forms & Validation

- **Library:** None.
- **State:** Per-form `useState` per field.
- **Submit pattern:** `<form onSubmit={...}>` with `event.preventDefault()`, then call a context mutation, then `navigate()`.
- **Validation:** Inline `if` checks, error stored in a sibling `useState` and rendered as `<p className="form-error">`.
- **Schema location:** None. There are no Zod / Yup / Joi schemas.

Canonical example (`src/pages/LoginPage.tsx:29-43`):

```tsx
async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setIsSubmitting(true)
  setError('')

  const result = await login(identifier, password)

  if (!result.ok) {
    setError(result.message ?? 'Đăng nhập thất bại')
    setIsSubmitting(false)
    return
  }

  navigate(from, { replace: true })
}
```

The biggest form in the repo is the create-project modal in `ProjectsPage.tsx:265-310` (object state + member-draft sub-state) — read it before adding any new multi-section form so you copy the local convention rather than introduce a library.

---

## 13. Authentication & Authorization

### Flow

Pure local. `mockApi.login(identifier, password)` (`mockApi.ts:547-564`) looks up a user where either `username` or `email` matches and the password is exact:

```ts
const user = database.users.find(
  (item) =>
    (item.username === identifier || item.email === identifier) &&
    item.password === password,
) ?? null
```

On success the user id is written to `localStorage['ppm-demo-current-user-v2']`. There is no token, no JWT, no session cookie, no refresh.

### Where the current user lives

In React state — `AppSnapshot.currentUser` (`types/index.ts:292-294`), accessed everywhere via `const { currentUser } = useAppData()`.

### Role checks

Two helper functions in `src/lib/calculations.ts` are the canonical authorization API:

```ts
// calculations.ts:60-69
export function normalizeUserRole(role: User['role']) {
  switch (role) {
    case 'SYSTEM_ADMIN': return 'PMO'
    case 'PROJECT_ADMIN': return 'PM'
    default: return role
  }
}
```

```ts
// calculations.ts:82-95
export function canManageProjectPlan(project: Project, currentUser: User | null) {
  if (!currentUser) return false
  const normalizedRole = normalizeUserRole(currentUser.role)
  return (
    project.approvalInfo.status === 'APPROVED' &&
    (normalizedRole === 'PMO' ||
      project.adminId === currentUser.id ||
      isProjectCoordinator(project, currentUser.id))
  )
}
```

- **Visibility filter for lists:** `getVisibleProjects(projects, currentUser)` (`calculations.ts:97-120`). PMO/ADMIN_HC see everything; PM sees projects they admin or coordinate; DELIVERY_MEMBER sees projects they're a member of.
- **Route gate:** `<ProtectedRoute allowedRoles={...} />` (see §7).

### Important normalization gotcha

`SYSTEM_ADMIN` is treated as `PMO`, and `PROJECT_ADMIN` is treated as `PM`, both at the data layer (`mockApi.ts:118-127`) and in the calculation helpers. Use `normalizeUserRole(...)` before comparing roles — never compare the raw role.

---

## 14. Testing

**There is no test setup in this repo.** No `vitest`, `jest`, `playwright`, `cypress`, `@testing-library/*` deps. No `*.test.*` / `*.spec.*` files. No `__tests__` folder. No coverage configuration.

### If you're asked to add tests

The most natural fit for this stack is **Vitest + React Testing Library + Happy DOM/jsdom**, since Vite is already the bundler. Suggested wiring (Not yet implemented — ask the team before adding):

```bash
npm i -D vitest @testing-library/react @testing-library/user-event happy-dom
```

…then add `"test": "vitest"` to `package.json` and a small `vitest.config.ts` that mirrors `vite.config.ts` plus `test.environment = 'happy-dom'`.

For mocking the data layer, prefer wrapping the `<AppProvider>` test render with a controlled `localStorage` rather than mocking `mockApi.ts` directly — the Context already abstracts everything.

---

## 15. Code Quality

### ESLint (`eslint.config.js:8-23`)

Flat config, applies to `**/*.{ts,tsx}`:

- `js.configs.recommended`
- `tseslint.configs.recommended` (non-type-checked)
- `reactHooks.configs.flat.recommended`
- `reactRefresh.configs.vite`

`globals: globals.browser`. **Type-aware lint rules are NOT enabled**, by intent — the README excerpt mentions enabling `recommendedTypeChecked` as a future opt-in (`README.md:30-48`).

### Formatting

No Prettier. Format follows whatever VSCode default emits. Indentation in source: 2 spaces. Single quotes. No semicolons (matches typescript-eslint recommended). When in doubt: copy the formatting of the file you're editing.

### TypeScript strictness (`tsconfig.app.json:20-25`)

```jsonc
"strict": true,
"noUnusedLocals": true,
"noUnusedParameters": true,
"erasableSyntaxOnly": true,
"noFallthroughCasesInSwitch": true,
"noUncheckedSideEffectImports": true
```

Plus `verbatimModuleSyntax: true` (line 14), which forces `import type { ... }` for type-only imports.

There are **zero** `// @ts-expect-error`, `// @ts-ignore`, or `eslint-disable` comments in `src/` (verified by `grep`). Don't be the first.

### Naming conventions

| Item                | Convention                  | Example                                  |
| ------------------- | --------------------------- | ---------------------------------------- |
| Components / pages  | PascalCase (file + symbol)  | `ProjectDetailPage.tsx` → `ProjectDetailPage` |
| Utility files       | camelCase                   | `formatters.ts`, `calculations.ts`       |
| Hook-like exports   | camelCase                   | `useAppData()` (only one)                |
| Types / interfaces  | PascalCase                  | `CreateProjectInput`, `MockDatabase`     |
| String enum values  | UPPER_SNAKE                 | `'IN_PROGRESS'`, `'NEEDS_REPLAN'`        |
| CSS classes         | kebab-case + BEM-ish        | `stat-card__header`, `tone-warning`      |
| LocalStorage keys   | kebab-case + `-vN` suffix   | `ppm-demo-db-v2`                         |

### Pre-commit hooks

**None.** No `husky`, no `lint-staged`, no git hooks committed.

---

## 16. Build & Deployment

### Build output

`npm run build` runs `tsc -b` (full type-check across the project references) and then `vite build`. Output goes to `dist/` (gitignored — `.gitignore:11`). What ships: hashed JS/CSS bundles + the contents of `public/` (favicon, icons, **the `mock/*.json` files** — these are required for the app to seed).

### Environment-specific builds

There are no env-specific build modes. Vite's standard `import.meta.env.MODE` is unused.

### CI pipeline

**None.** No `.github/workflows/`, no `.gitlab-ci.yml`, no `azure-pipelines.yml`.

### Deployment

Not documented in repo — ask the team. Historical note: the `master` branch had recent `CNAME` add/update/delete commits (visible in `git log --oneline --all`), suggesting a custom-domain GitHub Pages setup may have existed; current `main` does not configure one.

### Rollback

Not documented in repo — ask the team.

---

## 17. Domain Glossary

The codebase mixes English and Vietnamese (UI strings, role labels, mock data). Quick reference:

| Term                | What it means                                                                         | Source                                          |
| ------------------- | ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **QLDA**            | "Quản lý dự án" — Vietnamese for "Project Management"; the app's brand name           | `AppShell.tsx:100`                              |
| **PMO**             | Project Management Office — top-level role, sees all projects                         | `types/index.ts:1-7`                            |
| **TTK**             | "Tổ triển khai" — deployment / delivery team. **Not** a typo for token.               | `mockApi.ts:108-116`, `ttkMode` field           |
| **HC / ADMIN_HC**   | "Hành chính" — administrative office; approves project establishment                  | `users.json:18-29`                              |
| **PM / Project Manager** | Owns delivery of a single project (`adminId` on the `Project`)                   | `types/index.ts:147-174`                        |
| **PROJECT_ADMIN**   | Legacy alias for PM; auto-normalized to PM at runtime                                 | `mockApi.ts:120-127`                            |
| **SYSTEM_ADMIN**    | Legacy alias for PMO; auto-normalized to PMO                                          | same                                            |
| **DELIVERY_MEMBER** | "Thành viên tổ triển khai" — individual contributor on the delivery team             | `users.json:59-64`                              |
| **Project coordinator (Điều phối dự án)** | A non-PM role with management privileges; participates in `canManageProjectPlan` | `calculations.ts:71-95`                  |
| **Plan item**       | A task or subtask on a project (`parentId === null` ⇒ task; otherwise subtask)        | `types/index.ts:181-202`, `mockApi.ts:931`      |
| **Work type**       | `PRELIMINARY` / `SUBTASK` / `MILESTONE`                                               | `types/index.ts:25`                             |
| **Worklog**         | A time entry against a plan item                                                      | `types/index.ts:204-212`                        |
| **Delay raise**     | A re-plan request from a member when a task is at risk                                | `types/index.ts:214-224`                        |
| **Phân bổ giờ công**  | "Hour allocation" — `MonthlyAllocation`: planned hours for a member per YYYY-MM      | `types/index.ts:62-66`                          |
| **Capacity**        | `User.monthlyCapacity` — hours the user can work per month                            | `types/index.ts:46`                             |
| **TTK mode**        | `CHUYEN_TRACH` (dedicated) or `KIEM_NHIEM` (shared / part-time)                       | `types/index.ts:30`                             |
| **Deployment mode** | `HD_PLHD` (contract / annex), `TK_THD` (project decision), `NOI_BO` (internal)        | `types/index.ts:31`                             |
| **Approval status** | `PENDING` until ADMIN_HC issues TTK; then `APPROVED` — gates planning                 | `types/index.ts:32`, `calculations.ts:90`       |
| **Health**          | `GREEN` / `AMBER` / `RED` — independent of `Project.status`                           | `types/index.ts:16`                             |
| **Catalog**         | Lookup-of-values; admin-page lists them; `updateCatalogGroup` updates one group       | `types/index.ts:266-280`, `AdminCatalogPage.tsx` |

---

## 18. Common Workflows

### Add a new page / route

1. Create `src/pages/MyPage.tsx`. Export a named function: `export function MyPage() { ... }`.
2. Open `src/App.tsx`, add the import alongside the others (line 7-13), and a `<Route path="/my-page" element={<MyPage />} />` inside the `<AppShell />` element block (around `App.tsx:48-54`).
3. If it should be in the sidebar, add a `NavItem` to `navItems` in `src/components/AppShell.tsx:27-64`. Pick an icon from `lucide-react`. Use `roles: ['PMO']` etc. if the link should be role-gated (this is a UI gate; the route gate must still be added in step 2 via `<ProtectedRoute allowedRoles={...}>`).
4. Wire data via `const { currentUser, ... } = useAppData()`. **Do not** call `mockApi` directly.

### Add a new API endpoint integration

1. Open `src/lib/mockApi.ts`. Pick an existing function with a similar shape (e.g. `saveRisk` for a sub-resource) and copy the pattern: declare an `Input` type in `src/types/index.ts`, then `export async function myThing(input: MyInput) { return updateDatabase((database) => { ... }) }`.
2. If the mutation should be auditable, call `addActivityLog(database, { ... })` inside the `recipe` (existing examples: `mockApi.ts:824-832`).
3. Open `src/context/AppContext.tsx`:
   - Add the input type to the imports (line 10-24).
   - Add the function signature to `AppContextValue` (line 31-59).
   - Add an implementation that calls `mockApi.myThing` and `setState(snapshot)` (e.g. mirror lines 120-123).
   - Pass it into the provider's `value` (lines 202-227).
4. Use it in a page: `const { myThing } = useAppData()`.

### Add a new reusable component

1. Create `src/components/MyThing.tsx` with a named export and a `MyThingProps` interface above it.
2. Add styles in `src/index.css` — find a similar component's section and follow its block-element-modifier-ish pattern.
3. Use `import type { ReactNode }` etc. (`verbatimModuleSyntax`).
4. No tests, no Storybook, no docs file are expected. Keep the component small (existing ones are 10-30 lines).

### Add a feature flag

There is no feature-flag system in the repo. The closest pattern is the **catalog** mechanism (`AdminCatalogPage.tsx`, `mockApi.updateCatalogGroup`) for runtime-configurable lists. For boolean flags: **Not documented in repo — ask the team**.

### Debug a failing build

`npm run build` fails most often because of:

1. **Unused locals/params** — TS rejects them (`tsconfig.app.json:21-22`). The error mentions the symbol; either use it or remove it.
2. **`verbatimModuleSyntax` violation** — TS demands `import type` for types-only imports. Fix: add `type` to the import.
3. **Reference-build mismatch** — both `tsconfig.app.json` and `tsconfig.node.json` are checked. If the failure mentions `vite.config.ts`, it's the `node.json` project.

To narrow down: `npx tsc -b --verbose` (this is whitelisted in `.claude/settings.local.json`). Then `npm run lint` separately to catch ESLint issues that don't break TS.

---

## 19. Gotchas & Tribal Knowledge

These are things you cannot derive from a quick read of the structure.

### Data normalization runs on every read AND write
`mockApi.ts:427-439` `normalizeDatabase()` is called on every `readDatabase()` and `writeDatabase()`. This silently rewrites:
- `User.role`: `SYSTEM_ADMIN` → `PMO`, `PROJECT_ADMIN` → `PM` (`mockApi.ts:118-127`).
- `User.employeeCode`, `phone`, `monthlyCapacity` — fills missing fields with derived defaults.
- `Project.basisInfo` / `financialInfo` / `personnelInfo` / `approvalInfo` — fills missing nested objects, infers approval status from `progress > 0`, resolves AITS personnel `userId` from email/name fallbacks.
- `PlanItem.assigneeId` / `assigneeIds` — keeps both in sync.

**Implication:** if you save a partial Project (e.g. a patch), the next read may have **more fields populated than you wrote**. Don't compare for "did this field change?" by reading round-trip — track changes pre-write (which is what `updateProject` does at `mockApi.ts:736-745`).

### `WorkloadPage.tsx` is dead-ish but still in the tree
`src/App.tsx:15` has the comment:

```ts
// WorkloadPage removed — workload is now a tab inside ProjectDetailPage
```

…but `src/pages/WorkloadPage.tsx` (502 lines) still exists. Strict TS would flag it as unreachable except it's never imported, so the compiler ignores it. Treat it as a reference for the workload-allocation logic that now lives inside `ProjectDetailPage.tsx`. **Don't link to it from anywhere new** — assume it's pending deletion.

### `ProjectDetailPage.tsx` is the elephant
~3800 lines, 7 tabs (`PROJECT_INIT | OVERVIEW | PERSONNEL | DOCUMENTS | RISKS | PLAN | WORKLOAD`). Before adding a feature: search inside this file first. There's almost certainly already-extracted helpers (`cloneAitsPersonnel`, `sanitizeReferenceItems`, etc., near the top) you should reuse rather than re-write.

### Project progress is auto-recalculated
`recalculateProjectProgress(database, projectId)` runs at the end of `savePlanItem` / `deletePlanItem` / `addWorklog` (`mockApi.ts:441-455`). It overwrites `Project.progress` with the simple mean of its plan items' progress. **Do not also update progress manually** in the same mutation — your value will be ignored.

### Activity log has fixed action types
`ActivityLogAction` is a string-union of 16 specific values (`types/index.ts:226-241`). Adding a new audit event = adding a value to that union AND extending `ACTION_LABELS` and `ACTION_TONES` in `ProjectDetailPage.tsx:61-95`. Forgetting either causes silent runtime fallthrough (label shown as the raw enum string).

### Storage versioning
The `-v2` suffix in storage keys (`mockApi.ts:24-25`) is a manual schema-version mechanism. If you change `MockDatabase` shape in a backwards-incompatible way, **bump to `-v3`** in both constants. Existing demo browsers will silently re-seed from `/mock/*.json`.

### Visibility != permission
- `getVisibleProjects(projects, user)` (`calculations.ts:97-120`) filters what shows on the list page.
- `canManageProjectPlan(project, user)` (`calculations.ts:82-95`) gates whether the user can edit.

A user can be allowed to **view** a project (because they're a member) without being allowed to **manage** the plan. Always pick the right helper.

### Demo passwords are committed
`public/mock/users.json` contains plaintext passwords (all `123456`). This is intentional for the demo. If the app ever gains a real backend, this file must not be deployed, and `LoginPage.tsx`'s "demo accounts" section (lines 131-146) must be feature-flagged or removed.

### TODO / FIXME / @deprecated count
**Zero.** Verified by grep across `src/`. If you leave one behind, it's the first.

### Lint vs build divergence
`npm run lint` does not type-check. `npm run build` does (via `tsc -b`). Code that's lint-clean can still fail the build. CI would need to run both — currently nothing does.

---

## 20. Where to Get Help

### Code owners
**Not configured in repo.** No `CODEOWNERS` file. The original GitHub author per `git remote get-url origin` is `JasonDuong255/Project-Management`.

### Internal docs
- `README.md` — project intent (one paragraph) plus the React + Vite template's stock content.
- `src/index.css:1-3` — design system header comment ("QLDA — New Design System (Deli-Plany inspired)").
- No `CONTRIBUTING.md`, no `docs/`, no in-code links to Confluence/Notion/Slack.

### External docs (versions match `package.json`)
- React 19 — https://react.dev
- React Router 7 — https://reactrouter.com (note: v7 unifies the framework + library APIs; this app uses the library mode via `BrowserRouter`)
- Vite 8 — https://vite.dev/config/
- TypeScript 5.9 handbook — https://www.typescriptlang.org/docs/
- typescript-eslint 8 — https://typescript-eslint.io/
- recharts 3 — https://recharts.org
- lucide-react — https://lucide.dev
- dayjs — https://day.js.org

---

*Last generated: 2026-05-01. Re-running the spec prompt against the codebase will refresh this file.*
