# Data model delta — what BRD requires vs schema today

Reference: `backend/prisma/schema.prisma` (current) vs BRD sections IV.1–IV.6 + VIII.

## Existing tables (12) — keep all

`profiles`, `projects`, `project_members`, `project_documents`, `monthly_allocations`, `project_risks`, `plan_items`, `plan_item_assignees`, `worklogs`, `delay_raises`, `activity_logs`, `catalog_groups`.

All map cleanly to BRD entities. Below: per-table additions.

## Per-table changes

### `profiles` (User)

| Field | Status | BRD reference | Notes |
| ----- | ------ | ------------- | ----- |
| `functionalTitle` enum | ❌ ADD | I (KSV, TCNL definitions) | Values: `TCNL`, `KSV`, `NORMAL` (default). Used to identify TCNL/KSV in approval flow. Alt: store on `unit` + `title` strings, but enum gives compile-time safety. |
| `isActive` boolean | ❌ ADD | IV.2 quản lý người dùng ("trạng thái hoạt động") | Default true. Used in user list and login gate. |
| `hrmEmployeeCode` | 🟡 RENAME | IV.5.1.2 ("nhân sự AITS lấy từ HRM") | Already have `employeeCode` — works as the HRM identity link. Keep but document. |

### `projects`

| Field | Status | BRD reference | Notes |
| ----- | ------ | ------------- | ----- |
| `status` enum | 🚫 REPLACE | IV.2 catalog #2 ("Đang triển khai", "Đã đóng"), III.1.2.5 ("Tạm đóng") | BRD has 3 values: `ACTIVE` (Đang triển khai), `PAUSED` (Tạm đóng), `CLOSED` (Đóng). Today we have 5 (`INITIATION`, `PLANNING`, `IN_PROGRESS`, `AT_RISK`, `DONE`). **Replace** the enum (BRD's status is operational, not lifecycle-stage). Map old values: PLANNING/IN_PROGRESS/AT_RISK → ACTIVE, DONE → CLOSED, INITIATION → ACTIVE. |
| `health` enum | 🚫 REPLACE | IV.2 catalog #3 | BRD: `STABLE` (Ổn định), `NEEDS_REVIEW` (Cần xem xét, ≤1 day to deadline), `AT_RISK` (Có rủi ro, past deadline). Today: `GREEN/AMBER/RED`. **Rename** + drive value automatically from plan-item deadlines instead of manual. |
| `projectType` enum | ❌ ADD | III.1.2.2.1 ("Loại dự án: Tiền khả thi/Khả thi/Có HĐ/Nội bộ") | Values: `PRELIMINARY`, `FEASIBILITY`, `CONTRACT`, `INTERNAL`. Drives KTQT validation rule (`projectType === 'CONTRACT' || 'FEASIBILITY'` → enforce KTQT cap). |
| `ttkDecisionDocFile` | ❌ ADD | III.1.2.1 ("Số quyết định thành lập TTK", "Hồ sơ căn cứ") | A file URL field (we already have URL-only doc handling). |
| `psUserId` | ❌ ADD | IV.4.1 ("PS dự án") | "PS" = Phó Sếp / Project Sponsor; references a user. Today we conflate it into `personnelInfo`. Make it a real FK. |
| `closedAt` / `pausedAt` | ❌ ADD | IV.6 (close/pause workflow) | Timestamps for state transitions, used for read-only enforcement. |
| `closeRequestedAt`, `closeRequestedBy`, `closeApprovedByKsvAt`, `closeApprovedByKsvId`, `closeRejectedReason` | ❌ ADD | IV.6.3 (multi-step close) | Or move to a separate `project_close_requests` table — see "new tables" below. |
| `basisInfo.ttkDecisionNumber` | ✅ exists | III.1.2.1 | Already in JSONB. |
| `basisInfo.outputContracts/inputContracts/etc.` | ✅ exists | III.1.2.1 ("Hồ sơ căn cứ") | JSONB lists. |
| `personnelInfo.aitsMembers[].coordinatorRole` | 🟡 INFER | III.1.2.2.1 (Điều phối TTK) | Today inferred via string match on `role`. Promote to explicit boolean. Or move out of JSONB onto `project_members.is_coordinator`. |

### `project_members` (M2M)

| Field | Status | BRD reference | Notes |
| ----- | ------ | ------------- | ----- |
| `isCoordinator` boolean | ❌ ADD | III.1.2.2.1 | Replace string-match. |
| `roleInProject` (string) | ❌ ADD | IV.5.1.2 ("vai trò") | Today only on `personnelInfo.aitsMembers[]` JSONB. Promote to a column. |
| `responsibility` text | ❌ ADD | IV.5.1.2 ("nhiệm vụ") | Same. |
| `totalPlannedHours` int | 🟡 EXISTS in JSONB | IV.5.1.2 ("tổng giờ công") | Today on `personnelInfo.aitsMembers[]`; replicate to row level. |

### `plan_items`

| Field | Status | BRD reference | Notes |
| ----- | ------ | ------------- | ----- |
| `workType` enum | 🟡 EXISTS | — | Today: `PRELIMINARY`, `SUBTASK`, `MILESTONE`. BRD only distinguishes "task tổng quan" vs "subtask". Keep current enum. |
| `actualHours` (computed from worklogs) | 🟡 EXISTS but manually set | IV.5.2.7 ("giờ công task = tổng giờ công subtask") | We store `actualHours` directly. Rule should be: a parent task's `actualHours` is the sum of its children's `actualHours`. Today the FE/BE doesn't enforce that. Add a computed-field rule or trigger. |
| `progressNote` | 🟡 lives on Worklog | IV.5.2.7 ("nội dung kết quả thực hiện") | Already on `worklogs.progressNote`. Fine. |

### `project_risks`

BRD asks for these fields (IV.5.1.4):

| BRD field | Status | Mapping |
| --------- | ------ | ------- |
| Nhận diện rủi ro | ✅ `title` | — |
| Nội dung | ❌ ADD `description` | New column. |
| Giải pháp | ✅ `mitigation` | — |
| Nhân sự thực hiện | ✅ `ownerId` | — |
| Thời hạn xử lý | ❌ ADD `dueDate` | New column. |
| Kết quả thực hiện | ❌ ADD `resolutionResult` | New column. |
| Tiến độ xử lý | ❌ ADD `resolutionProgress` int | 0-100. |
| Thời gian cập nhật | ✅ `lastUpdated` | — |
| Kế hoạch tiếp theo | ❌ ADD `nextPlan` | New column. |
| Ghi chú | ❌ ADD `notes` | New column. |
| `cause` (nguyên nhân) | ❌ ADD | III.1.2.2.5 — separate from "nội dung". |
| Risk delete | ❌ MISSING ENDPOINT | Today only upsert; no DELETE. |

### `project_documents`

| Field | Status | BRD reference | Notes |
| ----- | ------ | ------------- | ----- |
| `fileBlob` / Supabase Storage path | ❌ ADD | III.1.2.2.4 ("File tài liệu"), IV.5.1.3 ("File"), V chuyển đổi | BRD requires actual file upload, not URLs. Today we store URLs only. Need Supabase Storage wiring. |
| Document audit trail (uploadedBy, updatedBy, …) | ✅ exists | — | — |

### `monthly_allocations`

| Field | Status | BRD reference | Notes |
| ----- | ------ | ------------- | ----- |
| (existing schema is fine) | ✅ | III.1.2.2.3.2 | — |
| `validatedAgainstKtqt` boolean | ❌ ADD | III.1.2.2.3.2 ("So sánh với KTQT") | Optional — used as a marker; the validation itself runs at write time. |

### `worklogs`

| Field | Status | BRD reference | Notes |
| ----- | ------ | ------------- | ----- |
| `category` enum | ❌ ADD | IV.5.3.3 (PJ / RQ / CRQ / Khác) | Used in resource view. Default `PJ`. |
| `syncedToAOfficeAt` | ❌ ADD | III.1.2.2.2.2 ("đồng bộ sang a.Office") | Marker for the integration. NULL until pushed. |

### `activity_logs`

| Action | Status | BRD reference | Notes |
| ------ | ------ | ------------- | ----- |
| Existing 16 actions | ✅ | — | — |
| `RISK_CREATED`, `RISK_UPDATED`, `RISK_DELETED` | ❌ ADD | IV.5.1.4 ("Ghi nhận lịch sử thay đổi") | Currently risks are saved silently. |
| `PERSONNEL_ADDED`, `PERSONNEL_REMOVED` | ❌ ADD | IV.5.1.2.4 ("Ghi nhận lịch sử") | Today only `PERSONNEL_UPDATED`. |
| `PROJECT_PAUSED`, `PROJECT_REOPENED_FROM_PAUSE`, `CLOSE_REQUESTED`, `CLOSE_APPROVED_KSV`, `CLOSE_REJECTED_KSV`, `CLOSE_CONFIRMED_TCNL`, `CLOSE_REJECTED_TCNL` | ❌ ADD | IV.6 (multi-step close) | New action types for the close workflow. |
| `ALLOCATION_UPDATED` | ❌ ADD | III.1.2.2.3.2 | Today silent. |
| `DOCUMENT_UPDATED` (separate from ADDED) | ❌ ADD | IV.5.1.3 | We currently log `DOCUMENT_ADDED` for both add and edit. Split. |

### `catalog_groups`

| Catalog key | Status | BRD reference | Notes |
| ----------- | ------ | ------------- | ----- |
| `projectStatuses` | ✅ exists | IV.2 #2 | Replace values to `Đang triển khai / Đã đóng` (READ-ONLY). |
| `healthStatuses` | ✅ exists | IV.2 #3 | Replace values to `Ổn định / Cần xem xét / Có rủi ro` (READ-ONLY). |
| `taskStatuses` | ✅ exists | — | Keep. |
| `riskLevels` | ✅ exists | — | Keep. |
| `documentCategories` | ✅ exists | IV.2 #6 | Keep — already CRUD. |
| `departments` | ✅ exists | — | Keep — used widely. |
| `projectMemberRoles` | ✅ exists | IV.2 #1 ("Vai trò dự án") | Keep — already CRUD. |
| `ttkForms` | ❌ ADD | IV.2 #4 ("Hình thức TTK") | New catalog with audit fields. |
| `deploymentForms` | ❌ ADD | IV.2 #5 ("Hình thức triển khai") | New catalog. |

The catalog values today don't carry audit (`createdBy`, `createdAt`, `updatedBy`, `updatedAt`); the BRD requires these for `ttkForms`/`deploymentForms`/`projectMemberRoles`. That requires a richer catalog row schema.

## New tables

### `external_personnel` (formerly inside JSONB)

BRD I.2 #7 — "Nhân sự KH/Đối tác" is a **catalog** (reusable across projects). Today they live inside `personnelInfo.customerMembers[]` and `personnelInfo.partners[]` per project. Promote to a top-level table:

```prisma
model ExternalPersonnel {
  id            String  @id @default(cuid())
  kind          ExternalPersonnelKind  // CUSTOMER | PARTNER
  fullName      String
  employeeCode  String
  title         String
  unit          String
  email         String
  phone         String
  isActive      Boolean @default(true)
  createdById   String  @db.Uuid
  createdAt     DateTime @default(now())
  updatedById   String?  @db.Uuid
  updatedAt     DateTime @updatedAt
}
```

And per-project assignments:

```prisma
model ProjectExternalPersonnel {
  projectId            String
  externalPersonnelId  String
  roleInProject        String
  responsibility       String
  totalPlannedHours    Int @default(0)
  @@id([projectId, externalPersonnelId])
}
```

This makes 1.2.3 (sync changes back to KH/Đối tác catalog) actually realizable.

### `project_close_requests`

For the multi-step close workflow (IV.6.3.1–3.5):

```prisma
model ProjectCloseRequest {
  id                   String    @id @default(cuid())
  projectId            String    @unique  // one open request per project
  requestedById        String    @db.Uuid // QLDA who triggered
  requestedAt          DateTime  @default(now())
  ksvDecision          KsvDecision  @default(PENDING)  // PENDING | APPROVED | REJECTED
  ksvDecidedById       String?   @db.Uuid
  ksvDecidedAt         DateTime?
  ksvRejectReason      String?
  tcnlDecision         TcnlDecision @default(PENDING)
  tcnlDecidedById      String?   @db.Uuid
  tcnlDecidedAt        DateTime?
  tcnlRejectReason     String?
}
```

### `permission_groups` + `permission_groups_functions`

For the BRD's IV.2 "Quản lý phân quyền" with sơ-đồ-cây UI:

```prisma
model PermissionGroup {
  id           String  @id @default(cuid())
  name         String  @unique
  description  String  @default("")
  functions    PermissionGroupFunction[]
  users        UserPermissionGroup[]
}
model PermissionGroupFunction {
  groupId      String
  functionKey  String  // e.g. 'projects:create', 'risks:delete'
  @@id([groupId, functionKey])
}
model UserPermissionGroup {
  userId       String  @db.Uuid
  groupId      String
  @@id([userId, groupId])
}
```

This is a proper RBAC layer on top of the 4-role enum, matching BRD's intent of "Admin chủ động phân quyền". The 4-role enum stays as a coarse default; permission groups give fine-grained CRUD.

> **Caveat:** this is a major addition. Acceptable to defer to a later phase if the 4 roles cover near-term needs.

### `notifications`

For IV.5.6 alerts and IV.6.3.1 in-app notifications:

```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String   @db.Uuid
  kind        NotificationKind
  payload     Json     // structured data the FE renders
  readAt      DateTime?
  createdAt   DateTime @default(now())
  @@index([userId, readAt])
}
enum NotificationKind {
  TASK_DEADLINE_NEAR
  TASK_OVERDUE
  CLOSE_REQUEST_RECEIVED
  CLOSE_APPROVED
  CLOSE_REJECTED
}
```

### Integration mirror tables (deferred)

For HRM / KTQT / a.Office integrations the BRD requires (VIII):

```prisma
model AOfficePersonalAllocation { /* DBHĐ, RQ, CRQ, Khác hours per user/month */ }
model KtqtBusinessPlan { /* hours cap per project */ }
model HrmUser { /* mirror from HRM */ }
```

These are **stubs** today — see plan/. Until the actual integration endpoints exist, we mock them with sync jobs.

## Summary of schema work

| Change | Tables touched | Migration risk |
| ------ | -------------- | -------------- |
| Replace `ProjectStatus` enum | `projects` | High — value mapping needed for existing rows. |
| Replace `HealthStatus` enum | `projects` | Low — values just renamed. |
| Add `User.functionalTitle` enum + `User.isActive` | `profiles` | Low. |
| Add `project_type`, `ps_user_id`, `closed_at`, `paused_at` | `projects` | Low. |
| Add `is_coordinator`, `role_in_project`, `responsibility`, `total_planned_hours` | `project_members` | Medium — backfill from JSONB needed. |
| Risk fields | `project_risks` | Low — additive. |
| Worklog fields | `worklogs` | Low — additive. |
| 8 new activity-log actions | `activity_logs` (enum) | Low — additive. |
| 2 new catalogs (`ttkForms`, `deploymentForms`) + audit columns on rows | `catalog_groups` (or replace with `catalog_options` table for richer schema) | Medium. |
| New tables: `external_personnel`, `project_external_personnel`, `project_close_requests`, `notifications` | new | Low — additive, no data migration. |
| Permission groups | new | Optional / deferred. |
| Integration mirrors | new | Deferred — not in v3.x. |

Total: **~5 enum changes, ~12 new columns, 4 new tables, 1 deferred big table, 8 new enum values for activity log.**
