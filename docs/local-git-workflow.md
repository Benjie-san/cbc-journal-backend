# CBC Journal Local Git Workflow

This project intentionally uses one backend checkout. `main` is the production
checkpoint and `dev` is the existing development branch. Production runs an
exported release under `C:\ProgramData\CBCJournal`, so switching the source
checkout no longer changes the running application.

## Branch roles

- `main`: reviewed production state.
- `dev`: local development and testing.

Local commits do not require GitHub. Do not push as part of ordinary development
or deployment unless that is separately intended and reviewed.

## Start a development window

Require a clean production checkpoint, then switch to `dev`:

   ```powershell
   git switch main
   git status --short
   ```

```powershell
git switch dev
```

The deployed release remains available while development is in progress.

## Develop and commit locally

Make one bounded change at a time. Before committing:

```powershell
npm test
git diff --check
git status --short
git diff --cached --name-only
git diff --cached --check
git check-ignore -v .env .env.local firebase-service-account.json
```

Review the complete staged diff, then create one local commit for the slice.
Environment files, Firebase Admin credentials, Cloudflare credentials, private
keys, and backup archives must remain outside Git. `.env.example` may contain
configuration names and safe placeholders only.

## Review and deploy

Review everything that would enter production:

```powershell
git log --oneline main..dev
git diff --stat main...dev
git diff --check main...dev
git diff main...dev
```

After tests and review pass:

1. Switch to `main` and fast-forward it to the reviewed `dev` commit:

   ```powershell
   git switch main
   git merge --ff-only dev
   ```

2. Confirm `git status --short` is empty.
3. Run `cbcjournal-deploy` from an elevated terminal. The command tests and
   exports the exact committed state; it never deploys worktree-only files.
4. Verify authentication and one phone synchronization in addition to the
   automated health checks.
5. Record the deployed commit and smoke-test result.

Do not deploy an uncommitted worktree. Do not use `git reset --hard` or a forced
push for a normal deployment.

## Rollback

Activation failures automatically restore the previous release pointer. If a
problem appears during later smoke testing, select the retained prior release
and restart the task, then create a normal revert commit on `main`. See
[deployment.md](./deployment.md) for the runtime layout.

Database migrations and credential changes require their own backup and rollback
steps; reverting source code alone may not reverse them safely.
