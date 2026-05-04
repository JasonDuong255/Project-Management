# 00 — Project context

> Read this first. 60 seconds to load the project into your head.

## What is QLDA?

**QLDA** ("Quản lý dự án" / Project Management) is an internal PPM (Project & Portfolio Management) web app. One company, four roles, one lifecycle: initiation → administrative approval → planning → execution → reporting.

| Role | Vietnamese | What they do |
| ---- | ---------- | ------------ |
| `PMO` | Phòng Quản lý Dự án | Top of the org. Sees everything, creates projects, manages catalogs (LOVs). |
| `ADMIN_HC` | Hành chính | Approves project establishment (the TTK decision). |
| `PM` | Project Manager | Owns delivery of one or more projects. Plans tasks, allocates members. |
| `DELIVERY_MEMBER` | Thành viên tổ triển khai | Logs work against tasks, raises delays. |

**Legacy aliases:** `SYSTEM_ADMIN ≡ PMO`, `PROJECT_ADMIN ≡ PM`. The backend normalizes both at read time.

## Stack at a glance

| Layer | Choice | Notes |
| ----- | ------ | ----- |
| Frontend | React 19 + Vite + TypeScript (strict) | Single global stylesheet (`src/index.css`), no UI library, no Tailwind. |
| State | One React Context (`src/context/AppContext.tsx`) | Whole `AppSnapshot` lives here; mutations replace it wholesale. |
| Data layer | `src/lib/apiClient.ts` | Drop-in for the deleted `mockApi.ts`. Talks REST to the backend, attaches Supabase JWTs. |
| Auth | Supabase Auth (email + password) | FE uses anon key; BE verifies tokens with `getUser` (or HS256 if `SUPABASE_JWT_SECRET` is set). |
| Realtime | Supabase Realtime (`postgres_changes`) | Any insert/update/delete on QLDA tables triggers `refresh()` in the FE. |
| Backend | Express + Prisma (`../backend/`) | Connects directly to Supabase Postgres via `DATABASE_URL`. RLS bypassed via direct connection. |
| Database | Supabase Postgres (`yvmbzokglemjgcbdueoa`) | 12 tables; nested project sub-objects stored as JSONB. RLS enabled for the realtime path. |

## Key invariants

1. **Every mutation returns a fresh `AppSnapshot`** — the FE replaces all state on every write. Don't introduce partial responses.
2. **Authorization rules are in `src/lib/calculations.ts` (FE) and `backend/src/lib/permissions.ts` (BE)**. Two implementations, must stay in sync. Both are ports of `getVisibleProjects` / `canManageProjectPlan` / `isProjectCoordinator`.
3. **Project progress is auto-computed** by `recalculateProjectProgress` whenever a plan item is saved/deleted or a worklog is added. Never set `Project.progress` directly.
4. **Plan items cascade**: deleting a parent task deletes its subtasks, assignees, worklogs, and delay raises (via Postgres `ON DELETE CASCADE`).
5. **Activity log has 16 fixed actions** (`types/index.ts:226-241`). Adding new audit events requires extending the union *and* `ACTION_LABELS`/`ACTION_TONES` in `ProjectDetailPage.tsx`.

## Pages

| Path | Component | Visible to |
| ---- | --------- | ---------- |
| `/login` | `LoginPage` | unauth — quick-login buttons for all 8 demo users |
| `/dashboard` | `DashboardPage` | any logged-in user |
| `/projects` | `ProjectsPage` | filtered per role |
| `/projects/:id` | `ProjectDetailPage` (~3.8k lines, 7 tabs) | filtered per role |
| `/member-workspace` | `MemberWorkspacePage` | DELIVERY_MEMBER |
| `/gantt` | `GanttPage` | any |
| `/reports` | `ReportsPage` | any (filtered) |
| `/notifications` | `NotificationCenterPage` | any |
| `/admin/catalogs` | `AdminCatalogPage` | PMO only |

## Demo accounts

All passwords are `123456`. Login form accepts username (no `@`) — FE appends `@qlda.local`.

`sys.chau` (PMO), `hc.hoa` (ADMIN_HC), `pm.an` (PM), `pm.ha` (PM), `dev.binh`, `dev.duy`, `dev.khang`, `dev.lan` (DELIVERY_MEMBER).

## Where the existing docs live

| Doc | What you'll learn |
| --- | ----------------- |
| `./ONBOARDING.md` | Full first-day guide. Tech stack with line-number citations. **The most thorough single doc.** |
| `./BACKEND_SETUP.md` | How to run FE + BE locally and what's wired between them. |
| `./GIT_WORKFLOW.md` | Branch naming (`v<X.Y>-<purpose>`), commit format (`v<X.Y> <type>: <summary>`), merge rules. |
| `../front-end/README.md` | Short — Vite template notes plus one-liner intent. |
| `../backend/README.md` | Backend setup, scripts, demo credentials, Docker. |

## Branch history (recent)

```
v2.0  Supabase backend integration (replaced mockApi)
v2.1  GIT_WORKFLOW.md
v2.2  AITS Library design tokens
v2.3  ← this branch — BA audit against the BRD
```
