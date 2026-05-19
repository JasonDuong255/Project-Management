# Plan — close the BRD gaps

Phased implementation plan derived from `../audit/coverage.md`. Each phase is **a separate feature branch** following `../GIT_WORKFLOW.md` (branch `vX.Y-purpose`, commit `vX.Y type: summary`).

## Latest implementation note

The latest user-trial changes are documented in `../02-feature-changes-2026-05-19.md`. Some items overlap the original v3.1-v3.3 plan, especially TCHC project creation, close/pause flow, document attachment, tab ordering, task locking and resource-management updates. Use that snapshot before treating unchecked phase-plan items as still fully open.

## Files

| File | Purpose |
| ---- | ------- |
| `00-overview.md` | The phase ladder + dependency graph + delivery sequence. Read this first. |
| `v3.1-foundation.md` | Data model + auth role re-gate (B1, B2, B7 + supporting schema). |
| `v3.2-close-workflow.md` | Multi-step close, pause, lock-when-closed, auto-health (B3, B5, B6). |
| `v3.3-risks-personnel-docs.md` | Risk field expansion + delete; KH/Đối tác catalog; Supabase Storage. |
| `v3.4-catalogs-and-audit.md` | New catalogs (ttkForms, deploymentForms); per-row audit; activity-log expansion. |
| `v3.5-reports.md` | Weekly TTK + detailed plan exports. |
| `v3.6-ad-ldap.md` | AD/LDAP federation (B4) — 📌 **out of scope**, kept for reference. |
| `v3.7-integrations.md` | HRM / KTQT / a.Office. Mock first, real later. |
| `v3.8-permissions.md` | Permission groups + sơ-đồ-cây UI (deferred). |

## Conventions

- Each phase doc starts with **Goal**, **BRD references**, **Files to touch**, **Migration notes**, **Verification steps**, **Estimate**.
- Phases are **sequenced by dependency**, not by importance. v3.1 must land before v3.2; v3.2 before most others.
- Every phase ends with the GIT_WORKFLOW merge sequence (branch → commit → push → merge `--no-ff` → push main).

## Status convention inside phase docs

```
[ ] not started
[~] in progress
[x] done
```

Update inline as work proceeds so other agents see real-time status.
