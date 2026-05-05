# Audit summary

> One page. For details see `coverage.md`, `role-mapping.md`, `data-model-delta.md`.

## Coverage at a glance

| Status | Count | What it means |
| ------ | ----- | -------------- |
| ✅ Done | 14 | End-to-end works today; tested. |
| 🟡 Partial | 27 | Some layers exist; gaps documented. |
| ❌ Missing | 22 | No implementation. |
| 🚫 Blocking | 6 | Existing build conflicts with BRD; needs replacement, not addition. |
| 📌 Out of scope | 1 | BRD requirement intentionally **not** addressed (stakeholder decision). |

**Total numbered requirements audited:** ~70.

## The 6 blocking items (must be addressed first)

| # | What | Why blocking |
| - | ---- | ------------ |
| B1 | Replace `ProjectStatus` enum (5 lifecycle values → 3 operational: `ACTIVE/PAUSED/CLOSED`) | All workflow + alerting cascades from these 3 values; can't model close/pause without them. |
| B2 | Replace `HealthStatus` enum + auto-compute it from plan-item deadlines (`STABLE/NEEDS_REVIEW/AT_RISK`) | BRD ties health to deadline rules; cannot keep manual GREEN/AMBER/RED. |
| B3 | Replace single-step `DONE` close with 3-step KSV → TCNL flow + rejection paths | Adds new table, new endpoints, new permissions. |
| B5 | Replace 7-day deadline derivation with 4-day push alerts that update project health automatically | A scheduler/worker has to exist; today it's pure FE derivation. |
| B6 | Add "locked when CLOSED" enforcement on every project mutation | New middleware; without this, the BRD's read-only requirement is violated. |
| B7 | Re-gate project creation from PMO-only to TCHC (`ADMIN_HC`) | Today `POST /projects` requires PMO; BRD assigns it to TCHC. One-line auth change. |

> Item numbering preserved (no B4) so existing references and commit messages stay valid. **B4 is out of scope** — see below.

## Out-of-scope items

| # | What | Decision | Date |
| - | ---- | -------- | ---- |
| B4 | AD / LDAP federation (BRD IV.1.1 + VIII.3 auth piece) | **Skipped** — Supabase Auth (email + password) is the system of record for QLDA. A future stakeholder may revisit if VNA group security policy mandates AD SSO. | 2026-05-04 |

Implications:
- BRD **IV.1.1** ("Đăng nhập bằng LDAP domain AITS") will not be implemented as written. Any production rollout under VNA group needs a sign-off on this deviation.
- BRD **VIII.3** still partially applies — the *audit-logging* requirement (log IP, time, login state) is **kept** and tracked under v3.2's existing audit-log work. Only the auth-provider clause is dropped.

## Top 10 most-impactful missing items

(Ranked by user-facing value × BRD criticality.)

1. **File upload for documents** (Supabase Storage). BRD requires real file attachments, not URLs.
2. **Risk fields fleshed out** — cause, dueDate, resolutionResult, resolutionProgress, nextPlan, notes; plus delete; plus history.
3. **Reports export** — weekly TTK report and detailed plan, customer-supplied templates (Excel).
4. **External personnel catalog** — KH/Đối tác as first-class table, reusable across projects.
5. **Catalogs `ttkForms` and `deploymentForms`** with audit trail per row.
6. **HRM integration** — sync employees in, drive AITS personnel picker.
7. **a.Office integration** — push worklogs out, pull personal plans in.
8. **KTQT integration** — pull contract hour cap, validate at allocation save time.
9. **Activity log expansion** — split DOCUMENT_ADDED/UPDATED, add RISK_*, PERSONNEL_ADDED/REMOVED, ALLOCATION_UPDATED, all close-flow events.
10. **Permission groups** — proper RBAC with sơ-đồ-cây UI (defer; today's 4 enum roles are enough for v3.x).

## Recommended sequencing

| Phase | Theme | Why this order |
| ----- | ----- | --------------- |
| **v3.1** | Data model + auth foundation | Touches everything downstream; do once. Includes B1, B2, B7 (enums, role re-gate); add `User.functionalTitle`, `project_close_requests` table. |
| **v3.2** | Close/pause workflow + auto-status | B3, B5, B6. New endpoints, scheduler. **Now also picks up the audit-log fields from VIII.3** (IP, login time, login state). |
| **v3.3** | Risk + personnel + document upgrades | Field additions (risks), KH/Đối tác catalog, Supabase Storage for documents. |
| **v3.4** | Catalogs + activity log expansion | New catalogs (ttkForms, deploymentForms), audit per-row, new activity actions. |
| **v3.5** | Reports export | Excel/PDF generation; customer templates. |
| ~~v3.6~~ | ~~AD/LDAP federation (B4)~~ | **Out of scope** — see "Out-of-scope items" above. Phase doc kept for reference if this ever revives. |
| **v3.7** | HRM / KTQT / a.Office integrations | Stub mock services, then wire to real systems when ready. |
| **v3.8** | Permission groups (sơ đồ cây) | Optional; defer until 4-role becomes constraining. |

Total estimated work: **5–9 weeks** of focused dev (down from 6–10 with v3.6 dropped), depending on integration availability. The integration phase (v3.7) often slips due to cross-system access dependencies; plan for that.

## Quick wins (≤1 day each)

These are pure-additive and unblock visible value fast:

- B7 (re-gate project creation to ADMIN_HC) — 30-min change.
- Risk delete endpoint + UI button — 1 hour.
- Split DOCUMENT_ADDED vs DOCUMENT_UPDATED in the activity log — 30 minutes.
- Add `RISK_CREATED/UPDATED/DELETED` actions — 1 hour.
- Wrap "project locked when CLOSED" middleware (B6) — 2–3 hours.
- ProjectsPage column-level filters — half a day.

## Risk areas

- **Status enum migration (B1)** requires a value mapping for any production data. Demo data is fine to wipe.
- **Integration (HRM/KTQT/a.Office)** likely has political and access barriers; build mock layers first.
- **VIII.3 deviation** — AD auth is now out of scope (B4). Confirm the deviation is acceptable to VNA group security/compliance before going to production.
- **Permission groups (defer)** — easy to over-engineer; defer until concrete need.
