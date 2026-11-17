# CI, Security and Release

What runs when you push, how the app reaches GitHub Pages, and which security gates exist today.

This page separates **what is in place** from **what is intended**. They are not yet the same.

## Workflows

There are four workflow files in `.github/workflows/`. Every action is pinned to a commit SHA (with the version in a comment), and every workflow starts from `permissions: contents: read`, with extra permissions granted only to the job that needs them.

### CI

`.github/workflows/ci.yml`

| | |
| --- | --- |
| Triggers | Push to `main`, pull request into `main`, and called by Deploy (`workflow_call`) |
| Runner | `ubuntu-latest`, Node 24, npm cache |
| Steps | `npm ci`, `npm run lint`, `npm run test`, `npm run build` |

These are the same three commands as the [definition of done](Getting-Started.md#definition-of-done).

### Security

`.github/workflows/security.yml`, on push to `main` and on PRs into `main`.

| Job (check name) | What it does |
| --- | --- |
| `Secret scan (gitleaks)` | Runs the gitleaks CLI (version and SHA-256 pinned) over every commit a PR adds, or the whole history on a push to `main`. The CLI is used instead of `gitleaks-action`, which only scans a PR's first 30 commits. |
| `SAST (Semgrep)` | `p/default`, `p/typescript` and `p/react` rulesets, in a digest-pinned `semgrep/semgrep` container. Fails on any finding. |
| `Dependency scan` | `npm audit --omit=dev --audit-level=high` (gating); Dependency Review on PRs, failing on high/critical in any scope; the full `npm audit` in the job summary (not gating). Accepted risks are listed one by one in `allow-ghsas`, each linked to a `security` issue (currently #19). |

### CodeQL

`.github/workflows/codeql.yml`, advanced setup with the `security-extended` queries, for `javascript-typescript` and `actions` (the workflow files themselves). Runs on push, PRs and weekly. Keep CodeQL **Default setup** off: the two conflict.

### Deploy

`.github/workflows/deploy.yml`

| | |
| --- | --- |
| Triggers | Push to `main`, or a manual run (`workflow_dispatch`) |
| Permissions | `contents: read`; only the deploy job gets `pages: write` and `id-token: write` |
| Concurrency | Group `pages`, with `cancel-in-progress: true`, so a newer push replaces a deploy in flight |
| CI job | Runs `ci.yml` (lint, test, build). The build job waits for it, so a commit that fails CI is not published. |
| Build job | `npm ci`, `npm run build`, upload `dist` as the Pages artifact |
| Deploy job | `actions/deploy-pages` to the `github-pages` environment |

### Dependabot

`.github/dependabot.yml` opens weekly update PRs for npm and GitHub Actions, after a 7-day cooldown on new releases. React, the Vite toolchain and Capacitor are grouped because their packages must move together. After a Capacitor update, run `npx cap sync` and commit the native changes on the Dependabot branch.

Build-time environment for the deploy:

| Variable | Value |
| --- | --- |
| `BASE_PATH` | `/<repository name>/`, because project sites live under a subpath |
| `VITE_SUPABASE_URL` | Repo secret of the same name. Optional. |
| `VITE_SUPABASE_ANON_KEY` | Repo secret of the same name. Optional. |

Leave the two secrets unset and the deployed app is local-only.

## How a release happens

**Every push to `main` deploys.** There are no version tags and no separate release step. `package.json` is at version `0.0.0`, which is what Profile shows under "Version".

Two facts about the current setup worth knowing:

- The deploy workflow runs the CI checks first and only builds and publishes if they pass. It does not wait for the security scans. Those are meant to block at the PR stage through the ruleset on `main`, but only once that ruleset is applied (see below). Until then they report and do not block.
- The site is live at <https://ncali1.github.io/FitTrack-React/>. Pages is set to build from GitHub Actions.

For a fork, the one-time setup is repo Settings → Pages → Source: **GitHub Actions** (`README.md`).

The native apps are not released by any workflow. TODO: confirm how iOS and Android builds are signed and distributed.

## Branch and PR workflow

From `.kiro/steering/git-workflow.md`:

1. Never commit straight to `main`. It is always releasable.
2. Work on a short-lived feature branch named for the change, for example `rest-timer-qol`.
3. Before opening a PR, merge or rebase the latest `main` into the branch and resolve conflicts there. Look for features `main` has meanwhile implemented a different way.
4. Open a PR into `main`. CI must pass before merging.
5. Delete the branch after it is merged.

### Commits

- Imperative, sentence-case subject that says what changed: "Add cardio logging", "Stop the page behind sheets and modals from scrolling".
- One logical change per commit. Explain the why in the body when it is not obvious.
- Never commit `.env`, `.env.local`, `dist/`, or real Supabase keys.
- `ios/` and `android/` are committed. After `npx cap sync`, commit the native changes in the same PR.

## Security gates

### In place today

Verified against the repository files and the GitHub API at the time of writing.

| Gate | Status |
| --- | --- |
| Lint, test and build on every PR | In place (`ci.yml`) |
| Deploy gated on CI | In place (`deploy.yml` runs `ci.yml` first) |
| Least-privilege `permissions` on every workflow | In place |
| Actions pinned to commit SHAs | In place. Dependabot keeps the pins current. |
| CodeQL (advanced setup) | In place (`codeql.yml`) |
| Semgrep | In place (`security.yml`) |
| gitleaks | In place (`security.yml`) |
| `npm audit` (runtime, high and above) | In place (`security.yml`) |
| Dependency Review on PRs | In place (`security.yml`) |
| Dependabot version updates | In place (`.github/dependabot.yml`) |
| Dependency graph, Dependabot alerts and security updates | On (repo settings) |
| GitHub secret scanning and push protection | On (repo settings) |
| Local env files kept out of git | `.gitignore` covers `.env`, `.env.local` and `*.local`, and `.env.example` has names only. A key pasted into a tracked file is blocked at push time by GitHub push protection for known key formats, and caught by gitleaks at the PR. |
| Row-level security on every cloud table | In place (`supabase/schema.sql`) |
| Only the public anon key in the client | A configuration rule, not a check. `src/services/supabaseClient.ts` passes whatever `VITE_SUPABASE_ANON_KEY` holds to `createClient`, and Vite embeds it in the public bundle, so a service-role key put there would ship to every visitor. Only ever set the anon key. |

### Intended but not set up

These are repository settings, not files, so they are applied separately (tracked in #17).

| Gate | Status |
| --- | --- |
| Branch ruleset on `main` (required checks, resolved threads, no force-push or deletion) | Defined in `.github/rulesets/main.json`, not yet applied. Until it is, "CI must pass before merging" is a convention, not an enforced rule. |
| Squash merge only, auto-delete merged branches | All three merge methods are allowed, and branches are not deleted after merge |
| AI review (Claude, CodeRabbit) | CodeRabbit is installed as a GitHub App and reviews PRs (it ran on PR #9). There is no Claude review workflow in the repo. |

To apply the ruleset: `gh api -X POST repos/ncali1/FitTrack-React/rulesets --input .github/rulesets/main.json`. Its required checks are the job names above, so renaming a job means updating the ruleset too. The `Analyze` checks pass whenever analysis completes, so the ruleset also has a `code_scanning` rule: a PR that adds a CodeQL security alert of high severity or above, or any error-level alert, cannot merge.

### When a scanner flags something

The rule for once the scanners exist. Pick one:

1. Fix it.
2. If it is a false positive, dismiss it with a reason, or add `// nosemgrep: <rule-id>` with a comment saying why.
3. If it is an accepted risk, open an issue labelled `security` that says why and when to revisit it.

Never disable a rule, skip a check or weaken a ruleset to get CI green.

## Security practices in the code

| Practice | Where |
| --- | --- |
| No secrets in the repo; Supabase keys come from env vars and repo secrets | `.env.example`, `deploy.yml` |
| Every cloud table is limited to `auth.uid() = user_id` | `supabase/schema.sql` |
| Password reset does not reveal which emails have accounts | `src/stores/auth.ts`, `src/components/auth/AuthGate.tsx` |
| Imported backup files are shape-checked before anything is written | `assertBackupShape` in `src/utils/exportData.ts` |
| The outbox is tagged per user, so queued changes do not upload into another account. Untagged entries left by older app versions are dropped, not sent (see [Cloud Sync and Auth](Cloud-Sync-and-Auth.md)). | `src/services/cloudSync.ts` |
| No analytics or third-party tracking | `.kiro/steering/product.md`, `public/privacy.html` |

If a secret is ever committed, it has to be rotated. Deleting it from the repo is not enough, because it stays in history.

## Dependencies

- Do not add a dependency when an existing one or a few lines of code will do (`.kiro/steering/tech.md`).
- Prefer small, maintained, tree-shakeable packages.
- For anything native, use an official `@capacitor/*` plugin or a `@capacitor-community/*` one matching Capacitor 8.
- Keep `package-lock.json` committed. CI installs with `npm ci`.

## Related pages

- [Getting Started](Getting-Started.md)
- [Testing](Testing.md)
- [Cloud Sync and Auth](Cloud-Sync-and-Auth.md#secrets)
