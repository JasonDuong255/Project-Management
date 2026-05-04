# Git workflow

How to ship changes on this repo, including when working with an AI agent
(Claude Code, Cursor, etc.). Follow this every time so history stays
consistent and review-able.

## TL;DR

1. Branch off `main` with a versioned name: `vX.Y-short-purpose`
2. Commit on the feature branch with a versioned, type-prefixed message
3. Push the feature branch
4. Merge it into `main` with `--no-ff`
5. Push `main`

## Branch naming

`v<major>.<minor>-<kebab-purpose>`

Examples (existing in this repo):

- `v1.0-phân-bổ-giờ-công`
- `v1.6-log-history`
- `v2.0-supabase-backend`

Bump the **minor** for additive work, **major** for breaking changes or
large reshapes (new backend, redesign, etc.). The purpose tag is
descriptive — keep it short, kebab-case, ASCII when possible.

## Commit message format

```
v<X.Y> <type>: <short summary>

<optional body — what changed and why, grouped by area>
```

`<type>` is one of:

| type      | when to use                                            |
| --------- | ------------------------------------------------------ |
| feature   | new user-visible capability                            |
| fix       | bug fix                                                |
| refactor  | restructuring without behavior change                  |
| test      | adds/updates tests only                                |
| docs      | docs only                                              |
| chore     | tooling, config, deps, CI, build                       |
| style     | formatting/whitespace, no semantic change              |
| perf      | performance improvement                                |

Mixed commits: pick the dominant type and call out the rest in the body.
Prefer splitting if the changes are large and independent.

Example (this repo):

```
v2.0 feature: integrate Supabase backend and refactor UI copy

Backend
- Replace mockApi with Supabase-backed apiClient and shared client.
- Wire AppContext, AppShell, AdminCatalog and ProjectsPage to live API.
- Add BACKEND_SETUP.md and ONBOARDING.md, ignore .env files.

Frontend
- Move workload management into ProjectDetail tab; remove WorkloadPage.
- Tighten verbose labels, descriptions and empty states across all pages
  for a cleaner, more professional UI.
```

## Step-by-step

Assuming you start with uncommitted work on `main`:

```bash
# 1. Create the feature branch
git checkout -b v2.1-<purpose>

# 2. Stage everything you mean to ship — list files explicitly,
#    never `git add -A` or `git add .` (avoids leaking .env, dumps, etc.)
git add path/to/file1 path/to/file2 ...
git rm path/to/deleted-file        # for deletions
git status --short                  # sanity check

# 3. Commit (use a HEREDOC for multi-line messages)
git commit -m "$(cat <<'EOF'
v2.1 <type>: <summary>

<body>
EOF
)"

# 4. Push the feature branch
git push -u origin v2.1-<purpose>

# 5. Merge into main with a merge commit (preserves branch context)
git checkout main
git merge --no-ff v2.1-<purpose> -m "Merge branch 'v2.1-<purpose>'"

# 6. Push main
git push origin main
```

If the team wants PR review instead of a direct merge, stop after step 4
and open a PR via `gh pr create`.

## Rules and guardrails

**Never:**

- Force-push to `main` (`git push --force` to main is forbidden).
- Skip hooks (`--no-verify`) or signing (`--no-gpg-sign`) — fix the
  failure instead.
- `git add -A` / `git add .` — list files explicitly so secrets and
  scratch files don't sneak in.
- Amend a commit that has already been pushed.
- Commit `.env`, credentials, dumps, or large binaries. Keep `.env` and
  `.env.local` in `.gitignore` (already configured).

**Always:**

- Branch from an up-to-date `main` (`git pull --ff-only` first).
- Run a sanity check before pushing: `git status`, `git log --oneline -5`,
  `git diff --stat origin/main..HEAD`.
- Use `--no-ff` when merging features into `main` so the branch is
  visible in history.
- Check secret files: before staging, run
  `git check-ignore -v .env .env.local` and verify they are ignored.

## When working with an AI agent

The agent must follow this workflow without improvising. Tell it
explicitly:

> "Use the workflow in `GIT_WORKFLOW.md`. Branch name `v<X.Y>-<purpose>`,
> commit message `v<X.Y> <type>: <summary>`, push the feature branch, then
> merge into `main` with `--no-ff` and push `main`."

The agent should:

- Confirm the next version number by reading `git log --oneline` for the
  highest `vX.Y` tag.
- Stage files explicitly (one `git add` with the file list, plus `git rm`
  for deletions). It must not run `git add -A`.
- Run `git check-ignore -v .env .env.local` before committing.
- Surface the diff stats and the unpushed-commit count to the user before
  pushing if `main` is more than a couple of commits ahead of
  `origin/main`.
- Never use destructive flags (`--force`, `--hard`, `--no-verify`) without
  the user spelling out the request.

## Mapping AI agent calls (Claude Code reference)

For agents using Claude Code's tool surface specifically:

- Use the `Bash` tool for every git command.
- Pass multi-line commit/merge messages via a single-quoted HEREDOC
  (`@'...'@` in PowerShell) so `$` and backticks aren't expanded.
- Don't prepend `cd <repo>` to git commands — the working directory is
  already set; the prepend triggers an extra permission prompt.
- After each step (commit, push, merge, push), surface the resulting
  `git log --oneline -3` so the user can see what landed.
