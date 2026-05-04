# `.docs/` — project knowledge base

Living documentation for the QLDA app (front-end + back-end). Anything an agent (human or AI) needs to **catch up fast** lives here.

## What's where

| File | Purpose |
| ---- | ------- |
| `00-context.md` | One-screen overview: what the app is, its users, and where existing docs live. Read this first. |
| `01-current-state.md` | What is actually built today — features, endpoints, data model, gotchas. Generated from the codebase, not aspirational. |
| `BRD.md` | The Business Requirements Document (provided by the product owner). Source of truth for *what should exist*. |
| `audit/` | Gap analysis: BRD requirements vs. `01-current-state.md`. Created after BRD is in place. |
| `plan/` | Implementation plan derived from the audit. Created after the audit is reviewed. |

## Folder layout

`.docs/` lives at the **wrapper folder** `D:\code\QLDA\` alongside `front-end/` and `backend/`:

```
D:\code\QLDA\
├── .docs\         ← this folder (untracked — see "Versioning" below)
├── front-end\     ← React SPA (git repo, GitHub remote)
└── backend\       ← Express + Prisma (currently untracked)
```

## Versioning

`.docs/` is **untracked** — the wrapper folder is not (yet) a git repo. The `front-end/` git repo still tracks its own files; this folder is shared knowledge that lives outside any single repo. To version `.docs/`, run `git init` at `D:\code\QLDA\` and add it to a new monorepo-level repo.

## Branch + workflow

The active BA branch is **`v2.3-brd-audit`** in the front-end repo. Branch naming, commit format, and merge rules are in `./GIT_WORKFLOW.md` — do not improvise.

## For agents picking this up later

1. Read `00-context.md` (60 seconds).
2. Read `01-current-state.md` to understand what the codebase does today.
3. Read `BRD.md` to understand what it *must* do.
4. Read `audit/` to see the delta.
5. Read `plan/` to see what's queued and what's done.

## Pre-existing project docs (now consolidated in this folder)

These were at the front-end repo root before; relocated here as part of the monorepo restructure.

- `./ONBOARDING.md` — first-day guide, full front-end tour, version-pinned tech stack.
- `./BACKEND_SETUP.md` — how to run the FE + BE together against Supabase.
- `./GIT_WORKFLOW.md` — git conventions for the front-end repo (branch + commit format).

The front-end repo's top-level `../front-end/README.md` (Vite template notes) stays there — it's the GitHub face of the project and `npm`/CI tooling expects it there.

The backend's own README at `../backend/README.md` stays in place — it sits in its own folder.
