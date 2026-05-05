# Coverage matrix — BRD vs implementation

Per-requirement audit. Status legend: **✅ Done · 🟡 Partial · ❌ Missing · 🚫 Blocking** (current behavior must be replaced) **· 📌 Out of scope** (intentionally not addressed; documented in `summary.md`).

## I — Definitions

Reference only; no functional requirements here. Mapping captured in `role-mapping.md`.

## II — Overview / goals

| BRD ref | Requirement | Status | Notes |
| ------- | ----------- | ------ | ----- |
| II.2.1 | Real-time progress tracking | 🟡 | Snapshot refresh on every mutation + Supabase Realtime ARE real-time. But "real-time progress" depth (e.g. live cursor, presence) is not implemented and probably not required. |
| II.2.2 | Resource & hour control | 🟡 | Monthly allocations exist; KTQT validation is missing. |
| II.2.3 | Auto risk alerts | ❌ | No scheduler; `NotificationCenterPage` is derivation-only, not push. |
| II.2.4 | HRM / KTQT / a.Office integration | ❌ | No integration code at all. |
| II.2.5 | Reporting + dashboard | 🟡 | Dashboard exists; export to file (Excel/PDF) does not. |
| II.2.6 | Future extensibility | ✅ | Modular backend; clean schema; React Context architecture. |

## III — Business processes

### III.1.2 Workflow steps

| BRD # | Function | Actor | Status | Citation / gap |
| ----- | -------- | ----- | ------ | -------------- |
| III.1.2.1 | Khởi tạo dự án (TCHC) | TCHC | 🟡 | Endpoint exists at `backend/src/modules/projects/projects.routes.ts:11` but gated to `PMO`. BRD makes TCHC the creator. **Reassign auth to `PMO || ADMIN_HC`.** Field-wise: missing first-class `psUserId` (today conflated into `personnelInfo`); missing `ttkDecisionDocFile` (have URL only via `basisInfo`). |
| III.1.2.2 | Triển khai dự án | — | ✅ | 7 tabs in `front-end/src/pages/ProjectDetailPage.tsx` cover the 6 BRD screens + Khởi tạo. |
| III.1.2.2.1 | Cập nhật chung (Điều phối TTK) | Điều phối TTK | 🟡 | Form exists; missing `projectType` enum (`PRELIMINARY/FEASIBILITY/CONTRACT/INTERNAL`); auth open to PM but BRD specifies coordinator. Today `canEditProjectInfo` allows PM admin OR coordinator — close enough but should narrow to coordinator for `basisInfo`/`financialInfo` per BRD. |
| III.1.2.2.2 | Plan management & progress tracking | PM, Điều phối TTK / Thành viên TTK | ✅ | `savePlanItem`, `addWorklog` cover this. |
| III.1.2.2.2.1 | CRUD task tổng + subtask | Chuyên viên QLDA | ✅ | Implemented end-to-end including cascade delete and history (`backend/src/modules/plan-items/plan-items.service.ts`). |
| III.1.2.2.2.2 | Cập nhật tiến độ + worklog → a.Office | Thành viên TTK | 🟡 | Worklog persistence: ✅. **Sync to a.Office: ❌** (no integration). Auto-status (NOT_STARTED→IN_PROGRESS→DONE on ≥100%) is implemented (`backend/src/modules/worklogs/worklogs.routes.ts:46-50`). Missing: `actualHours` rollup from subtasks to parent (today stored directly per item). |
| III.1.2.2.3.1 | Personal plan resources from a.Office | — | ❌ | No a.Office integration. UI to display Gantt of personal plan exists in `GanttPage` (member view) but the data is from our DB, not a.Office. |
| III.1.2.2.3.2 | TTK plan resources + KTQT validation | Điều phối TTK | 🟡 | Allocation upsert works (`backend/src/modules/allocations/allocations.routes.ts`); **KTQT comparison and the "block save if exceeds" rule: ❌** (no KTQT integration). The "Đối với dự án Có HĐ/Khả thi" branch needs `projectType` first. |
| III.1.2.2.3.3 | Actual & remaining resources | — | 🟡 | Worklogs aggregation exists in the FE Reports/Workload tab. Missing the a.Office side (DBHĐ + others) and the PJ/RQ/CRQ/Khác categorization. |
| III.1.2.2.4 | Documents (CRUD + history) | Chuyên viên QLDA | 🟡 | CRUD exists. **File upload missing — URL-only today.** Document update logs as `DOCUMENT_ADDED` (should be `DOCUMENT_UPDATED`). |
| III.1.2.2.5 | Risks (CRUD + history) | Chuyên viên QLDA | 🟡 | Upsert exists. **Delete missing.** **History missing** (no `RISK_*` activity log actions). Several BRD fields missing (`cause`, `dueDate`, `resolutionResult`, `resolutionProgress`, `nextPlan`, `notes` — see `data-model-delta.md`). |
| III.1.2.2.6 | Personnel CRUD | Chuyên viên QLDA | 🟡 | Stored in `personnelInfo` JSONB; FE has the editor. **History limited** (only `PERSONNEL_UPDATED`, no add/remove). KH/Đối tác catalog (1.2.2) missing. |
| III.1.2.4 | Reports (weekly TTK / summary / PMO eval) | Chuyên viên QLDA | ❌ | `ReportsPage` shows tabular data but **no export** (Excel/PDF). PMO evaluation report not implemented. |
| III.1.2.5 | Đóng / tạm đóng dự án | Various | 🚫 | We only have `status: 'DONE'` (single-step). BRD requires multi-step KSV → TCNL flow. **Replace.** See IV.6 below. |

## IV — Functional requirements

### IV.1 — Truy cập hệ thống

| BRD ref | Requirement | Status | Notes |
| ------- | ----------- | ------ | ----- |
| IV.1.1 | LDAP / AD login | 📌 | **Out of scope** (stakeholder decision, 2026-05-04). Supabase Auth (email + password) stays as system of record. See `summary.md` → "Out-of-scope items". |
| IV.1.2 | Logout | ✅ | `apiClient.logout` calls `supabase.auth.signOut`. |

### IV.2 — Quản trị hệ thống

#### Catalogs

| BRD # | Catalog | Status | Notes |
| ----- | ------- | ------ | ----- |
| IV.2.1 | Vai trò dự án (CRUD: tên, nhiệm vụ, active) | 🟡 | `catalog_groups.projectMemberRoles` exists, but rows store only `{value, label, description?}` — missing `nhiệm vụ` (responsibility) and `active`. Need richer row schema (or move to a real `catalog_options` table). |
| IV.2.2 | Trạng thái dự án (READ-ONLY: Đang triển khai, Đã đóng) | 🚫 | Today: 5 lifecycle values (`INITIATION/PLANNING/IN_PROGRESS/AT_RISK/DONE`). **Replace** with 3 BRD-spec values (`ACTIVE/PAUSED/CLOSED`). UI: should be read-only in catalog page (BRD says system-managed). |
| IV.2.3 | Sức khỏe dự án (READ-ONLY: Ổn định, Cần xem xét, Có rủi ro) | 🚫 | Today: GREEN/AMBER/RED, manually set. BRD: derived automatically from plan-item deadlines. **Replace** + add the auto-computation rule. |
| IV.2.4 | Hình thức TTK | ❌ | Catalog doesn't exist. Add new key `ttkForms`. The "Hình thức TTK: Kiêm nhiệm/Chuyên trách" we currently store in `basisInfo.ttkMode` (enum) — needs to come from this catalog. |
| IV.2.5 | Hình thức triển khai | ❌ | Same — add `deploymentForms` catalog; today inline in `basisInfo.deploymentMode`. |
| IV.2.6 | Loại tài liệu | ✅ | `documentCategories` catalog. |
| IV.2.7 | Nhân sự KH/Đối tác | ❌ | Today inside `personnelInfo` JSONB per project. **Promote** to top-level `external_personnel` table. |

Audit trail on catalog rows (createdBy, createdAt, updatedBy, updatedAt) required by BRD for at least IV.2.4, IV.2.5, IV.2.7 — not present today. The current shape `Json values: CatalogOption[]` cannot capture per-row audit. **Replace `catalog_groups` with `catalog_options` rows table** (or add audit per-row inside JSONB).

#### User & permission

| BRD # | Function | Status | Notes |
| ----- | -------- | ------ | ----- |
| IV.2 user | Quản lý người dùng (xem từ HRM, gán quyền) | 🟡 | We have profiles. **Missing**: HRM sync (no integration); user-list UI with "trạng thái có tham gia dự án nào không" / "trạng thái hoạt động". |
| IV.2 perm | Quản lý phân quyền (sơ đồ cây) | ❌ | We use a 4-value enum role. BRD wants permission groups + per-function permissions, displayed as a tree. **Major addition** — see `data-model-delta.md` (deferred to a later phase). |

### IV.3 — Dashboard

| BRD ref | Requirement | Status | Notes |
| ------- | ----------- | ------ | ----- |
| IV.3.A | Số liệu thống kê tiến độ | ✅ | `DashboardPage` shows progress KPIs + charts. |
| IV.3.A | Số liệu thống kê nguồn lực | 🟡 | Some resource info; BRD likely expects more (per-FSD) — not specified at the BRD level. |

### IV.4 — Khởi tạo dự án

| BRD # | Function | Actor | Status | Notes |
| ----- | -------- | ----- | ------ | ----- |
| IV.4.1 | Tạo mới dự án | TCHC | 🟡 | Endpoint exists; gated to PMO. **Re-gate to TCHC (`ADMIN_HC`).** Missing first-class `psUserId`. Activity log entry exists. |
| IV.4.2 | Xem danh sách dự án + tìm kiếm | TCHC | 🟡 | `ProjectsPage` shows lists per role and supports search by topbar global search. **Missing**: column-level filters (by status, PM, PS, health, hình thức TTK, hình thức triển khai). |
| IV.4.3 | Cập nhật thông tin khởi tạo | TCHC | ✅ | `PATCH /projects/:id` with the relevant fields. |

### IV.5 — Triển khai dự án

| BRD # | Function | Status | Notes |
| ----- | -------- | ------ | ----- |
| IV.5.1.1 | Chung | ✅ | All listed fields editable. |
| IV.5.1.2 | Nhân sự (CRUD) | 🟡 | Edit modal exists. **Missing**: per-project history of personnel add/remove. **Missing**: KH/Đối tác catalog (1.2.2) — today new external personnel are created inline, not synced to a reusable catalog. |
| IV.5.1.2.1 | Xem danh sách 3 loại bảng (paginate, search per column) | 🟡 | Bảng AITS/KH/Đối tác exist but **paginate+search-per-column** is not implemented (small dataset today). |
| IV.5.1.2.2 | Thêm AITS từ HRM | 🚫 | We pick from local `users` (which were seeded). No HRM sync. |
| IV.5.1.2.3 | Sửa (AITS read-only fields) | 🟡 | Today AITS fields are editable in `personnelInfo.aitsMembers[]`. Need to lock fields that should come from HRM. |
| IV.5.1.2.4 | Xóa khỏi DA, giữ giờ công | ✅ | Removing from `memberIds` doesn't delete worklogs (worklogs reference `members` only via FK to `profiles.id`, not to `project_members`). |
| IV.5.1.3 | Tài liệu CRUD | 🟡 | URL-only, no file upload. |
| IV.5.1.4 | Rủi ro | 🟡 | Many fields missing (see `data-model-delta.md`); no delete. |
| IV.5.2.1–6 | Plan CRUD | ✅ | Done. |
| IV.5.2.7 | Khai báo giờ + tiến độ | 🟡 | Worklog inserts work; `actualHours` rollup from subtask → parent isn't enforced. |
| IV.5.2.8 | Gantt | ✅ | `GanttPage` + `GanttChart`. |
| IV.5.3.1 | Theo dõi kế hoạch cá nhân (Gantt + DBHĐ vs TKDA classification) | 🟡 | Gantt shows project tasks. Missing the DBHĐ side (a.Office). |
| IV.5.3.2 | Phân bổ giờ công theo tháng / TV TTK | ✅ | `MonthlyAllocation` upsert + `WorkloadPage` (now a tab in ProjectDetail). |
| IV.5.3.3 | Nguồn lực (3 nhóm: DA / a.Office / thực hiện) | 🟡 | DA-side works. a.Office-side missing. PJ/RQ/CRQ/Khác categorization missing. |
| IV.5.4 | Worklog → a.Office | ❌ | No outbound integration. |
| IV.5.5.1 | Xuất báo cáo tuần | ❌ | No export. |
| IV.5.5.2 | Xuất KH triển khai chi tiết | ❌ | No export. |
| IV.5.6.1 | Cảnh báo trước hạn 4 ngày | 🚫 | We have `getTaskDeadlineNotifications` with 7-day window, derivation only. **Need**: 4-day window per BRD, push notifications, and **auto-set project health → "Cần xem xét"**. |
| IV.5.6.2 | Cảnh báo quá hạn | 🚫 | Same — derivation only. **Need**: auto-set project health → "Có rủi ro" + persistent notification rows. |

### IV.6 — Đóng / tạm đóng

| BRD # | Function | Status | Notes |
| ----- | -------- | ------ | ----- |
| IV.6.1 | Tạm đóng (QLDA) | ❌ | No `PAUSED` status today. **Add** + history. |
| IV.6.2 | Mở lại từ Tạm đóng (QLDA) | ❌ | Same. |
| IV.6.3.1 | Gửi phê duyệt KSV (QLDA) | ❌ | **New table** `project_close_requests` + endpoint + email. |
| IV.6.3.2 | KSV approve | ❌ | New endpoint + permission check (`isKSV`). |
| IV.6.3.3 | KSV reject + notify | ❌ | Same. |
| IV.6.3.4 | TCNL confirm + close | ❌ | New endpoint + permission check (`isTCNL`). |
| IV.6.3.5 | TCNL reject + notify | ❌ | Same. |
| Locked when CLOSED | No edits to info/plan/resources/docs/risks | ❌ | No enforcement today (we have `DONE` but it's purely a label). **Add** middleware: every mutation checks `project.status !== 'CLOSED'`. |

## V — Đào tạo

| BRD ref | Requirement | Status | Notes |
| ------- | ----------- | ------ | ----- |
| V | Online/offline 1-session training | N/A | Out of scope for software build. |

## VI — User & permission management

Already covered in IV.2.

## VII — Data migration

| BRD ref | Requirement | Status | Notes |
| ------- | ----------- | ------ | ----- |
| VII | None | ✅ | "Không có" — no work. |

## VIII — Non-functional

| BRD ref | Requirement | Status | Notes |
| ------- | ----------- | ------ | ----- |
| VIII.1 | LAN-only, 300 users / 100 concurrent | 🟡 | No load testing done. Supabase pooled connection bumped to 10 (`backend/.env`). For 100 concurrent users, raise further (50–100); confirm on Supabase plan. |
| VIII.2 | HRM / KTQT / a.Office integration | ❌ | None. |
| VIII.3 | AD authentication, log IP/time/login state | 🟡 | **AD auth: 📌 out of scope (see IV.1.1).** **Audit logging (IP/time/login state): in scope** — kept; landed in v3.2 alongside the close-flow audit work. New table `auth_log` records login attempts. |
| VIII.4 | 24/7 SLA 99% | N/A | Hosting concern; out of code scope for now. |
| VIII.5 | Capacity for daily ingest from external systems | N/A | Depends on integration design. |
| VIII.6 | Operations — helpdesk + ServiceDesk | N/A | Process-level, out of code scope. |
| VIII.7 | Backup + restore, ≤12 h downtime | 🟡 | Supabase has automatic backups. Document this and the restore runbook. |
| VIII.8 | Tiếng Việt | ✅ | Whole UI is Vietnamese. |

---

## Coverage roll-up

Total numbered requirements audited: **~70**

| Status | Count | % |
| ------ | ----- | -- |
| ✅ Done | 14 | 20% |
| 🟡 Partial | 27 | 39% |
| ❌ Missing | 22 | 31% |
| 🚫 Blocking (replace) | 6 | 9% |
| 📌 Out of scope | 1 | 1% |

The **6 blocking items** require ripping out and replacing existing implementations:

1. **Project status enum** — 5 lifecycle values → 3 operational (ACTIVE/PAUSED/CLOSED).
2. **Health enum + auto-computation** — GREEN/AMBER/RED → STABLE/NEEDS_REVIEW/AT_RISK, auto-derived.
3. **Project close workflow** — single-step `DONE` → 3-step KSV → TCNL flow.
4. **Deadline alerting** — current 7-day derivation → 4-day push + auto-status updates.
5. **Project locked when closed** — no enforcement today.
6. **Edit gates by role** — project creation needs to move PMO → ADMIN_HC.

> Original numbering had a 7th item (B4 — AD/LDAP). It is now **📌 out of scope**; numbering preserved (no B4) so commit messages and references stay valid.

The implementation plan in `../plan/` orders these 6 first, then the 22 missing items, then the 27 partials.
