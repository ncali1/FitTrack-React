---
inclusion: manual
---

# Git workflow

- `main` is always releasable: **every push to `main` deploys to GitHub Pages**
  (`.github/workflows/deploy.yml`). Never commit straight to `main`.
- Work on a short-lived feature branch named for the change (`rest-timer-qol`, `cardio-logging`).
- Before opening a PR, merge or rebase the latest `main` into the branch and resolve conflicts
  there. Look especially for features that `main` has meanwhile implemented in a different way.
- Open a PR into `main`. CI (lint, test, build) must pass before merging.
- Delete the branch after it's merged.

## Commits

- Imperative, sentence-case subject that says what changed for the user or the code:
  "Add cardio logging", "Stop the page behind sheets and modals from scrolling".
- One logical change per commit. Explain the *why* in the body when it isn't obvious.
- Never commit `.env`, `.env.local`, `dist/`, or real Supabase keys.

## Native projects

`ios/` and `android/` are committed. After `npx cap sync` or plugin changes, commit the
resulting native-project changes in the same PR as the JS change that needed them.
