# Audit — BRD vs current state

This folder cross-references every requirement in `../BRD.md` against `../01-current-state.md`. **Last run:** 2026-05-04 against branch `main` at commit `8973483`.

## Files

| File | Purpose |
| ---- | ------- |
| `coverage.md` | Per-requirement matrix: ✅ implemented / 🟡 partial / ❌ missing, with file-path citations and notes. **Read this first.** |
| `role-mapping.md` | How BRD roles (TCHC, TCNL, KSV, BĐH, PMO, QLDA, Điều phối TTK, Thành viên TTK) map onto the 4 roles we have today (PMO, ADMIN_HC, PM, DELIVERY_MEMBER). Drives the Phase 1 of the plan. |
| `data-model-delta.md` | What new entities, fields, and enums the BRD requires that we don't have today. Drives the Phase 2 of the plan. |
| `summary.md` | One-page exec summary: count of items per status, top 10 missing-and-blocking items, recommended sequencing. |

## Methodology

For each numbered requirement in the BRD I checked:
1. **FE coverage** — does a page or button exist? Does it call the right action?
2. **BE coverage** — does the API endpoint exist? Does it enforce the right authorization?
3. **DB coverage** — do the schema fields exist? Do enums match?
4. **Behavioral coverage** — automated rules (auto-status, validation, alerts) — present or not?

Status legend:
- **✅ Done** — implemented end-to-end (FE + BE + DB), tested in `e2e-test.ts` or smoke test.
- **🟡 Partial** — some layers exist; gaps documented inline.
- **❌ Missing** — no implementation.
- **🚫 Blocking** — pre-existing assumption in our build conflicts with the BRD; needs replacement, not addition.

## How the audit drives the plan

Every row in `coverage.md` that isn't ✅ becomes a line item in `../plan/`. Items are then grouped by dependency and risk into phases.
