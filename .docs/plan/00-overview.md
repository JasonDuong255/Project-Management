# Plan overview

## Phase ladder

```
v3.0  monorepo restructure         ✅ DONE (8973483)
       │
       ▼
v3.1  foundation
       ├─ replace ProjectStatus (B1)        replaces 5-value enum with 3 BRD values
       ├─ replace HealthStatus (B2 part 1)  rename + open computation
       ├─ re-gate project create (B7)       ADMIN_HC = TCHC
       ├─ User.functionalTitle              TCNL/KSV identifiable
       ├─ User.isActive
       ├─ project.projectType, psUserId, closedAt, pausedAt
       ├─ project_close_requests (table)
       ├─ project_members.isCoordinator + roleInProject + responsibility
       └─ schema migration + value backfill
       │
       ▼
v3.2  close-workflow + auto-health
       ├─ POST /projects/:id/pause                         (QLDA → PAUSED)
       ├─ POST /projects/:id/resume                        (QLDA → ACTIVE)
       ├─ POST /projects/:id/close-requests                (QLDA → KSV)
       ├─ PATCH /projects/:id/close-requests/:id/ksv       (KSV approve/reject)
       ├─ PATCH /projects/:id/close-requests/:id/tcnl      (TCNL confirm/reject)
       ├─ middleware: deny mutations when project.status === CLOSED  (B6)
       ├─ scheduled job: compute project.health + create notifications  (B5, B2 part 2)
       └─ FE: close-flow UI (panel on ProjectDetailPage, KSV inbox, TCNL inbox)
       │
       ▼
v3.3  risks + personnel + documents
       ├─ project_risks: cause, dueDate, resolutionResult, resolutionProgress, nextPlan, notes
       ├─ DELETE /projects/:id/risks/:riskId
       ├─ external_personnel + project_external_personnel tables
       ├─ Supabase Storage: documents.storagePath replaces url-only
       ├─ FE: rich risk modal, doc upload widget, KH/Đối tác picker
       └─ history: RISK_CREATED/UPDATED/DELETED, PERSONNEL_ADDED/REMOVED
       │
       ▼
v3.4  catalogs + activity log
       ├─ replace catalog_groups with catalog_options (per-row audit)
       ├─ new keys: ttkForms, deploymentForms
       ├─ FE: catalog page redesign with audit columns
       ├─ activity actions: split DOCUMENT_ADDED/UPDATED, add ALLOCATION_UPDATED, close-flow events
       └─ migrate existing catalog values
       │
       ▼
v3.5  reports
       ├─ ExcelJS or similar npm dep
       ├─ POST /reports/weekly?projectId=          → .xlsx
       ├─ POST /reports/detailed-plan?projectId=   → .xlsx
       ├─ template files in repo (customer-supplied)
       └─ FE: download buttons on ReportsPage + ProjectDetailPage
       │
       ▼
v3.6  AD / LDAP                          📌 OUT OF SCOPE (skipped)
       └─ Supabase Auth stays. See ../audit/summary.md → "Out-of-scope items".
          Login-event audit log (IP, time, login state) absorbed into v3.2.
       │
       ▼
v3.7  integrations: HRM / KTQT / a.Office
       ├─ adapter modules with mock implementations first
       ├─ HRM: sync employees → profiles
       ├─ KTQT: pull project hour cap → enforce in allocations
       ├─ a.Office: push worklogs out, pull personal plans in
       └─ scheduled jobs (daily ingest)
       │
       ▼
v3.8  permission groups (deferred)
       ├─ permission_groups, permission_group_functions, user_permission_groups
       ├─ sơ-đồ-cây UI on AdminCatalogPage
       └─ swap RBAC middleware to read groups instead of role enum
```

## Dependency rationale

- **v3.1 first** because it touches the schema enums every other phase relies on. Doing v3.2 before v3.1 means the close workflow's `PAUSED` status doesn't exist; v3.5's reports filter projects by status that hasn't been re-modeled.
- **v3.2 next** because the close workflow + auto-health are the most visible BRD gaps and unblock production-ready close behavior.
- **v3.3, v3.4, v3.5** are mostly independent — could be done in parallel if you have multiple devs, but sequenced linearly here.
- **v3.6 (AD/LDAP) is out of scope.** Supabase Auth stays. The audit-logging slice of BRD VIII.3 (IP, login time, login state) moves into v3.2 alongside the existing audit-log work.
- **v3.7 (integrations)** depends on external system availability (HRM/KTQT/a.Office endpoints); ship adapter mocks first so the UI works even before the real systems are reachable.
- **v3.8 (permission groups)** is the optional stretch — only do it if 4 enum roles become limiting.

## Estimated effort

| Phase | Effort | Critical path? |
| ----- | ------ | -------------- |
| v3.1 | 3–5 days | yes |
| v3.2 | 5–7 days | yes |
| v3.3 | 4–5 days | no |
| v3.4 | 3–4 days | no |
| v3.5 | 3–4 days | no |
| ~~v3.6~~ | ~~5–10 days~~ | 📌 out of scope |
| v3.7 | 10–15 days (3 systems) | depends on infra |
| v3.8 | 5–7 days | no (defer) |

**Critical path to "BRD-compliant operational system":** v3.1 → v3.2 → v3.3 → v3.4 → v3.5 ≈ **3–5 weeks.** AD/LDAP no longer on the path.

## Per-commit discipline

Each phase ships as one branch:

```bash
git checkout main
git pull --ff-only
git checkout -b v3.x-<purpose>
# do the work, commit explicitly per GIT_WORKFLOW (no `git add -A`)
git push -u origin v3.x-<purpose>
git checkout main
git merge --no-ff v3.x-<purpose> -m "Merge branch 'v3.x-<purpose>'"
git push origin main
```

Phase docs are kept in this folder so other agents (or you, two weeks later) can pick up mid-phase.
