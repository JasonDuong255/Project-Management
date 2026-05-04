# 01 — Current state of the app

> Snapshot of what is **actually built and wired** as of branch `v2.3-brd-audit`. Not aspirational. Cite code paths so a reviewer can verify in 30 seconds.

## 1. Architecture

```
┌─────────────── Frontend (React 19, Vite, port 5173) ──────────────┐
│                                                                    │
│  src/main.tsx                                                      │
│   └─ AppProvider          (src/context/AppContext.tsx)             │
│       ├─ supabase.auth.onAuthStateChange → refresh()               │
│       ├─ Realtime channel on 11 tables → refresh() on any change   │
│       └─ BrowserRouter                                             │
│           ├─ /login                                                │
│           └─ <ProtectedRoute>/<AppShell>                           │
│               └─ /dashboard, /projects[/:id], /member-workspace,   │
│                  /gantt, /reports, /notifications, /admin/catalogs │
│                                                                    │
│  Data layer:    src/lib/apiClient.ts   (REST + Bearer JWT)         │
│  Auth client:   src/lib/supabase.ts    (anon key)                  │
│  Permissions:   src/lib/calculations.ts                            │
└────────────────────────────────────────────────────────────────────┘
                              │ /api proxied via vite
                              ▼
┌──────────────── Backend (Express + Prisma, port 4000) ────────────┐
│  middlewares: requireAuth, validateBody, requireRoles, errorHandler│
│  modules/                                                          │
│   ├─ snapshot       GET /api/snapshot                              │
│   ├─ projects       POST/PATCH /api/projects[/:id]                 │
│   ├─ documents      POST/PATCH/DELETE /api/projects/:id/documents  │
│   ├─ plan-items     POST/PATCH/DELETE /api/projects/:id/plan-items │
│   ├─ worklogs       POST /api/projects/:id/worklogs                │
│   ├─ delay-raises   POST /api/projects/:id/delay-raises            │
│   ├─ allocations    POST /api/projects/:id/allocations             │
│   ├─ risks          POST /api/projects/:id/risks                   │
│   ├─ catalogs       PATCH /api/catalogs/:groupKey                  │
│   └─ admin          POST /api/admin/reset-demo-data                │
│                                                                    │
│  lib/ permissions, normalize, recalc, activity-log, supabase       │
└────────────────────────────────────────────────────────────────────┘
                              │ DATABASE_URL (pooled, port 6543)
                              ▼
                Supabase Postgres + Auth + Realtime
                      (project `yvmbzokglemjgcbdueoa`)
```

Every mutation endpoint runs `assembleSnapshot(currentUser)` at the end and returns the filtered snapshot. The FE calls `setState(snapshot)`, replacing all state.

## 2. Backend tables (Prisma schema)

`backend/prisma/schema.prisma` — 12 tables, JSONB for nested project sub-objects.

| Table | Purpose | Cascading |
| ----- | ------- | --------- |
| `profiles` | User row, PK = Supabase `auth.users.id` (uuid). Holds normalized role. | — |
| `projects` | Project core fields + 4 JSONB blobs (approval/basis/financial/personnel) | M2M members, sub-tables for docs/risks/allocations/plan-items |
| `project_members` | M2M projects ↔ profiles | cascade with project |
| `project_documents` | Title + URL only (no real upload) | cascade with project |
| `monthly_allocations` | Composite key (project, member, month) | cascade with project |
| `project_risks` | Risk register | cascade with project |
| `plan_items` | Tasks + subtasks via `parentId` self-FK; `monthAllocations` JSONB | cascade with project + parent |
| `plan_item_assignees` | M2M plan_items ↔ profiles | cascade |
| `worklogs` | Time entries; auto-bump `actualHours` on the task | cascade with task |
| `delay_raises` | Re-plan requests | cascade with task |
| `activity_logs` | Audit trail; 16-action enum; field-level `changes` JSONB | cascade with project |
| `catalog_groups` | 7 LOV groups (`projectStatuses`, …, `projectMemberRoles`) | — |

Enums match the FE TS unions exactly. Legacy `SYSTEM_ADMIN` / `PROJECT_ADMIN` are normalized to `PMO` / `PM` at insert time — DB only stores the 4 normalized roles.

RLS is enabled on every table with `SELECT` policies that mirror `getVisibleProjects`. **Writes from the FE are blocked** (no insert/update/delete policies). All writes go through Express. Realtime broadcasts still fire because they are logical-replication events.

## 3. Endpoint inventory

| Method | Path | Auth gate | Side effects |
| ------ | ---- | --------- | ------------ |
| GET | `/health` | none | — |
| GET | `/api/snapshot` | requireAuth | filtered by `getVisibleProjects` |
| POST | `/api/projects` | PMO only | creates project + member rows + activity log |
| PATCH | `/api/projects/:id` | `canEditProjectInfo` (incl. `approvalInfo`) | activity log diff (PROJECT_INFO_UPDATED, PERSONNEL_UPDATED, PROJECT_CLOSED, PROJECT_REOPENED) |
| POST | `/api/projects/:id/documents` | `canEditProjectInfo` | DOCUMENT_ADDED log |
| PATCH | `/api/projects/:id/documents/:docId` | `canEditProjectInfo` | DOCUMENT_ADDED log (treated as edit) |
| DELETE | `/api/projects/:id/documents/:docId` | `canEditProjectInfo` | DOCUMENT_DELETED log |
| POST | `/api/projects/:id/plan-items` | `canManageProjectPlan` | TASK/SUBTASK_CREATED log + recalc progress |
| PATCH | `/api/projects/:id/plan-items/:taskId` | `canManageProjectPlan` | TASK/SUBTASK_UPDATED or *_HOURS_CHANGED + recalc |
| DELETE | `/api/projects/:id/plan-items/:taskId` | `canManageProjectPlan` | cascade subtasks + worklogs + raises; TASK/SUBTASK_DELETED log |
| POST | `/api/projects/:id/worklogs` | member self-only (or PM/PMO) | bumps task `actualHours`, auto-status (NOT_STARTED→IN_PROGRESS, ≥100→DONE), WORKLOG_ADDED log, recalc |
| POST | `/api/projects/:id/delay-raises` | requester self-only | flips task to `replanRequested=true, status=NEEDS_REPLAN` |
| POST | `/api/projects/:id/allocations` | `canManageProjectPlan` | upsert by (project, member, month) |
| POST | `/api/projects/:id/risks` | `canManageProjectPlan` | upsert by id |
| PATCH | `/api/catalogs/:groupKey` | PMO only | replaces values for that group |
| POST | `/api/admin/reset-demo-data` | PMO only | wipes + reseeds from `front-end/public/mock/*.json` |

### Authorization helpers (FE & BE keep these in sync)

`backend/src/lib/permissions.ts` ←→ `front-end/src/lib/calculations.ts`

- `normalizeUserRole` — `SYSTEM_ADMIN→PMO`, `PROJECT_ADMIN→PM`.
- `canViewProject` — PMO/ADMIN_HC see all; PM sees admin/coordinator projects; member sees their member projects.
- `canManageProjectPlan` — only when `approvalInfo.status === 'APPROVED'` AND user is PMO / project admin / project coordinator.
- `canEditProjectInfo` — PMO / ADMIN_HC / project admin / coordinator (no approval gate, used for `approvalInfo` itself).
- `isProjectCoordinator` — checks `personnelInfo.aitsMembers[].role` contains `'dieu phoi du an'`.

## 4. Page-by-page feature inventory

### `LoginPage` (`src/pages/LoginPage.tsx`)
- Username + password form (calls `apiClient.login` → Supabase Auth).
- Quick-login buttons listing all 8 demo accounts (renders from `users` collection — currently empty pre-login because no JWT yet, so the buttons disappear before login).
- All passwords hard-coded to `123456`; FE appends `@qlda.local`.

### `AppShell` (`src/components/AppShell.tsx`)
- Sidebar nav with role-filtered items (PMO sees `Cài đặt hệ thống`).
- Profile chip + logout button.
- **Topbar global search** — input that searches projects (code/name/summary) and plan items by name across the snapshot. Results dropdown with click-to-navigate.
- Bell icon → notifications page; badge count derived from `getTaskDeadlineNotifications`.

### `DashboardPage`
- Reads-only KPIs and Recharts pie/bar/line charts derived from the snapshot.

### `ProjectsPage`
- Grouped project sections per role (PMO: pending / running / done; ADMIN_HC: pending / approved; PM: own / coordinated; member: just one section).
- "Tạo dự án" modal (PMO only): code, name, summary, sponsor, objective, start/end dates, member multi-select with role + planned hours per member.
- Project tile shows code, name, sponsor, status pill, health pill, approval pill, progress bar.

### `ProjectDetailPage` (~3.8k lines, 7 tabs)
1. **PROJECT_INIT** — init metadata, basis info (durationDays, ttkMode, deploymentMode, contracts/decisions reference items), approval flow.
2. **OVERVIEW** — high-level KPIs, health, current phase, adjusted plan, risk summary.
3. **PERSONNEL** — AITS members (linked to a User), customer members, partners (free-text). Edit modal exists.
4. **DOCUMENTS** — list, add, edit, delete with category and URL.
5. **RISKS** — register: title, level, status, owner, mitigation; upsert.
6. **PLAN** — task list with parent + subtask, edit modal (workType, baseline + actual dates, planned hours, deliverable, dependency note); cascade delete.
7. **WORKLOAD** — monthly allocation grid by member; capacity overlay.

Other features in this page: log work modal (DELIVERY_MEMBER), raise delay modal, activity log feed.

### `MemberWorkspacePage`
- DELIVERY_MEMBER only.
- List of tasks assigned to the user (read-only here; logging happens on `ProjectDetailPage`).
- List of delay raises submitted by the user.

### `GanttPage`
- Custom Gantt (no external lib). Two view modes: "by project" vs "by member".

### `ReportsPage`
- Tabular reports across projects + plan items + worklogs. Filtered by visibility.

### `NotificationCenterPage`
- Derived from `getTaskDeadlineNotifications`: tasks within 7 days of deadline that aren't 100%, with their unfinished children.

### `AdminCatalogPage`
- PMO only.
- 7 catalog groups, each with: list of values, add value modal, delete-value action.
- "Reset demo data" panel with confirm gate.

## 5. Data flow invariants

1. **Snapshot replacement** — every mutation returns the full snapshot; FE does `setState(snapshot)`. No partial updates.
2. **Realtime → refresh** — FE subscribes to `postgres_changes` on 11 tables; any event re-fetches `/api/snapshot`. Cross-tab consistency confirmed end-to-end.
3. **Project progress is computed**, never set: `recalculateProjectProgress` runs in the same transaction as plan-item save/delete and worklog add.
4. **Cascade deletes are at the DB layer** (`onDelete: Cascade` on the FK relations). Deleting a parent task removes children + assignees + worklogs + raises atomically.
5. **Activity log writes are diff-based** — only changed fields land in `changes`. 16 fixed actions; adding a new one requires updating the Prisma enum + FE `ACTION_LABELS`.
6. **Connection pool** — `DATABASE_URL` must use `connection_limit≥10`; `/api/snapshot` fires 7 parallel queries. (`backend/.env`)

## 6. Demo data set

After `npm run seed` (or `POST /api/admin/reset-demo-data`):

| Entity | Count |
| ------ | ----- |
| Users / profiles | 8 |
| Projects | 3 |
| Plan items | 14 |
| Worklogs | 8 |
| Delay raises | 2 |
| Project members (M2M) | 8 |
| Risks | 4 |
| Documents | 4 |
| Monthly allocations | 16 |
| Catalog groups | 7 |
| Activity logs | 0 (accumulate as users use the app) |

## 7. Known gaps / behavior notes

These are real holes a future BRD likely cares about:

- **No file storage.** Documents store URL strings only — no upload, no Supabase Storage wiring.
- **No notifications backend.** `NotificationCenterPage` is purely derived — no email, no Slack, no in-app push.
- **No password reset flow.** Supabase Auth supports it but the FE has no "forgot password" link.
- **No user/account CRUD.** All 8 users come from the seed; there is no admin UI to invite a new user.
- **No project archive/delete.** Projects can transition to `DONE` but there is no soft/hard delete endpoint.
- **No bulk worklog import** or weekly time-card view.
- **No reporting export** (PDF, CSV).
- **No comment/discussion thread** on tasks or projects.
- **Approval workflow is single-step** — request → approve. No multi-stage review chain.
- **`DOCUMENT_ADDED` is logged for both add and update** — small UX issue, no separate `DOCUMENT_UPDATED` action.
- **Worklog edit / delete is not implemented** — only insert.
- **Risk delete is not implemented** — only upsert.
- **Member capacity is per-month, not per-week.**
- **No locale switching.** All UI is Vietnamese (with English code labels).
- **`activity_logs` is in the realtime publication but no UI shows live audit broadcasts** — only in-tab snapshot refresh picks them up.
- **No mobile responsiveness story** documented.

## 8. Test surface

| Tool | What it does |
| ---- | ------------ |
| `backend/src/db/smoke-test.ts` | Login as 4 roles, hit `/api/snapshot`, assert visibility filter. |
| `backend/src/db/e2e-test.ts` | Exercises every mutation endpoint and verifies cascades + RBAC. |
| `npm run lint` (frontend) | Flat ESLint, recommended + react-hooks. |
| `tsc -b` (frontend), `tsc --noEmit` (backend) | Strict TS with `verbatimModuleSyntax`. |

No unit tests, no Playwright/Cypress.
