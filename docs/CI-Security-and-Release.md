# CI, Security and Release

What runs when you push, how the app reaches GitHub Pages, and which security gates exist today.

This page separates **what is in place** from **what is intended**. They are not yet the same.

## Workflows

There are two workflow files in `.github/workflows/`.

### CI

`.github/workflows/ci.yml`

| | |
| --- | --- |
| Triggers | Push to `main`, pull request into `main` |
| Runner | `ubuntu-latest`, Node 24, npm cache |
| Steps | `npm ci`, `npm run lint`, `npm run test`, `npm run build` |

These are the same three commands as the [definition of done](Getting-Started.md#definition-of-done).

### Deploy

`.github/workflows/deploy.yml`

| | |
| --- | --- |
| Triggers | Push to `main`, or a manual run (`workflow_dispatch`) |
| Permissions | `contents: read`, `pages: write`, `id-token: write` |
| Concurrency | Group `pages`, with `cancel-in-progress: true`, so a newer push replaces a deploy in flight |
| Build job | `npm ci`, `npm run build`, upload `dist` as the Pages artifact |
| Deploy job | `actions/deploy-pages` to the `github-pages` environment |

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

- The deploy workflow is independent of the CI workflow. It does not wait for CI and does not run lint or tests itself. A push to `main` that fails CI is still built and deployed, as long as `npm run build` succeeds.
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
| Least-privilege permissions on the deploy workflow | In place (`deploy.yml`) |
| Local env files kept out of git | `.gitignore` covers `.env`, `.env.local` and `*.local`, and `.env.example` has names only. This only excludes those files: nothing stops a key pasted into a tracked file from being committed, since secret scanning is off (see below). |
| Row-level security on every cloud table | In place (`supabase/schema.sql`) |
| Only the public anon key in the client | A configuration rule, not a check. `src/services/supabaseClient.ts` passes whatever `VITE_SUPABASE_ANON_KEY` holds to `createClient`, and Vite embeds it in the public bundle, so a service-role key put there would ship to every visitor. Only ever set the anon key. |

### Intended but not set up

The owner's working rules call for the gates below. None of them is configured on this repository yet.

| Gate | What was found |
| --- | --- |
| CodeQL (advanced setup) | No CodeQL workflow file. CodeQL default setup is also not configured. |
| Semgrep | No workflow or config file |
| gitleaks | No workflow or config file |
| GitHub secret scanning and push protection | Both disabled in the repo's security settings |
| `npm audit` in CI | Not a step in `ci.yml` |
| Dependency Review | No workflow |
| Dependabot | No `.github/dependabot.yml`. Dependabot security updates are disabled. |
| AI review (Claude, CodeRabbit) | CodeRabbit is installed as a GitHub App and reviews PRs (it ran on PR #9). There is no Claude review workflow in the repo. |
| Branch ruleset on `main` (required checks, resolved threads) | No rulesets, and `main` has no branch protection. "CI must pass before merging" is a convention, not an enforced rule. |
| Squash merge only | All three merge methods are allowed, and recent PRs were merged with merge commits. |

Other things to tighten when the gates are added:

- `ci.yml` has no `permissions` block, so it runs with the repository's default token permissions.
- Actions are referenced by major version tag (`actions/checkout@v7`), not pinned to a commit SHA.
- Branches are not deleted automatically after merge.

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
| The outbox is tagged per user, so queued changes do not upload into another account (except untagged entries left by older app versions; see [Cloud Sync and Auth](Cloud-Sync-and-Auth.md)) | `src/services/cloudSync.ts` |
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
