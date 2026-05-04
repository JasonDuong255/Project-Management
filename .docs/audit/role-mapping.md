# Role mapping — BRD vs implementation

## BRD has 8 roles

| BRD role | Vietnamese full name | Where they appear in the BRD |
| -------- | --------------------- | --------------------------- |
| **TCHC** | Tổ chức Hành chính | III.1.2 (initiation), IV.4 (project list), IV.6.3.4 (project close confirmation) |
| **TCNL** | Tổ chức Nhân lực | III.1.2 ("TCNL thực hiện chuyển trạng thái TTK sang Đóng") — sub-role within TCHC |
| **KSV** | Kiểm soát viên (DBCL dept) | IV.6.3.2/3 (approves/rejects close request) |
| **BĐH** | Ban điều hành | II.3 (scope), no operational duties spelled out |
| **PMO** | Phòng Quản lý Dự án | III.1.2.5 (handles "tạm đóng"), IV.4 ("báo cáo đánh giá PMO") |
| **PM** | Project Manager | IV.5.2 (project plan management) |
| **QLDA** / Chuyên viên QLDA | Project specialist | IV.5 widely — manages plan, risk, doc, hours, approval flow trigger |
| **Điều phối TTK** | TTK coordinator | III.1.2.2.1, 2.3.2 — manages general info + TTK resource allocation |
| **Thành viên TTK** | Delivery member | III.1.2.2.2.2 — logs progress, hours; views Gantt |

**Plus implicit:**
- **Admin** — IV.2 (catalog management, user/permission management)
- **Cá nhân Nhân sự** — IV.5.3.3 (read-only own resource view)
- **Hệ thống** — IV.5.4 (auto worklog ingest), IV.5.6 (auto alerts)

## Current implementation has 4 roles

From `backend/prisma/schema.prisma:73-78` and `front-end/src/types/index.ts`:

```
PMO
ADMIN_HC
PM
DELIVERY_MEMBER
```

Plus legacy aliases that are auto-normalized: `SYSTEM_ADMIN → PMO`, `PROJECT_ADMIN → PM`.

## Mapping

| BRD role | Current role | Coverage | Action needed |
| -------- | ------------ | -------- | ------------- |
| **TCHC** (Tổ chức Hành chính) | `ADMIN_HC` | ✅ name matches; behavior partial — we treat ADMIN_HC as approver of project establishment, BRD makes them the project **creator**. | Reassign creation rights from PMO to ADMIN_HC. Currently `POST /api/projects` is gated to PMO. |
| **TCNL** | `ADMIN_HC` (sub-role) | 🟡 BRD has TCNL as a TCHC employee with chức danh `TCNL`. We'd model this as `User.title === 'TCNL' && unit === 'TCHC'`, not a new role. | Add a "title-based check" helper: `isTCNL(user)`. Use it in the close-project flow's last step. |
| **KSV** | not modeled | ❌ Different department (DBCL), different chức danh (`KSV`). | Add helper `isKSV(user)`: `unit.includes('DBCL') && title.includes('KSV')`. Or introduce explicit `User.functionalRole` field. |
| **BĐH** | not modeled | 🟡 No operational duties in BRD beyond "in scope". | No-op for v3.x; if needed later, add as a read-only view permission. |
| **PMO** | `PMO` | ✅ name matches; behavior aligns (admin/dashboard/catalogs). | Add: PMO can `tạm đóng` a TTK (BRD III.1.2.5). Today only PMO can edit projects, `tạm đóng` falls under that umbrella. |
| **PM** | `PM` | ✅ matches. | None. |
| **QLDA** / Chuyên viên QLDA | `PM` (closest) | 🟡 BRD's QLDA role can do everything inside an active project; PM in our system also does. **However** the BRD lists QLDA on tasks where PM also appears (e.g. plan management is "PM, Điều phối TTK"). Treat QLDA = PM. | Document this synonym in `.docs/00-context.md`. |
| **Điều phối TTK** | `PM` (currently) | 🟡 We model this via a string match in `personnelInfo.aitsMembers[].role` containing `'dieu phoi du an'`. Works but undiscoverable. | Promote to first-class concept: a boolean field on `ProjectMember` (or similar). Update `isProjectCoordinator`. |
| **Thành viên TTK** | `DELIVERY_MEMBER` | ✅ matches. | None. |
| **Admin** | `PMO` (today) | 🟡 BRD splits **Admin** (catalogs, users, permissions) from **PMO** (operational). Today PMO does both. | Acceptable to keep PMO as Admin; BRD doesn't strictly forbid. Document. |
| **Cá nhân Nhân sự** | any logged-in user (read-only own data) | ✅ already supported by visibility filter. | None. |
| **Hệ thống** | scheduled task / cron / DB trigger | ❌ no scheduler, no auto-alert, no auto-worklog-sync. | Add a worker or cron — see plan/. |

## Recommended approach (Phase 1 of the plan)

1. **Keep the 4 enum values** (`PMO`, `ADMIN_HC`, `PM`, `DELIVERY_MEMBER`). Renaming the enum would break existing data.
2. **Map `ADMIN_HC = TCHC`** explicitly in `00-context.md` and re-shuffle authorization:
   - Project creation: `PMO || ADMIN_HC` (today: PMO only).
   - Project close confirmation: `ADMIN_HC` with title `TCNL`.
3. **Add `User.functionalTitle` enum** (`TCNL | KSV | NORMAL`) so we can identify TCNL/KSV without hard-coding string matches. Simpler than introducing two new role enums and back-fills cleanly.
4. **Promote project coordinator to a flag** on `project_members` table: `is_coordinator boolean`. Replace the string-match in `isProjectCoordinator` with this column.
5. **Document QLDA = PM** as an alias in the BRD glossary section of `00-context.md`.

This keeps the schema migration small (one new column + one new enum) while satisfying every BRD-named role.
