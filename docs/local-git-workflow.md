# CBC Journal Local Git Workflow

This project intentionally uses one backend checkout. `main` is the production
checkpoint and `dev` is the existing development branch.

Because the Windows startup task executes this directory directly, switching
branches or editing files also changes what the next backend process will load.
Git provides checkpoints and rollback, but a branch alone does not isolate a
running production process.

## Branch roles

- `main`: reviewed production state.
- `dev`: local development and testing.

Local commits do not require GitHub. Do not push as part of ordinary development
or deployment unless that is separately intended and reviewed.

## Start a development window

1. Confirm a maintenance window. The API will remain unavailable while the
   single checkout is on `dev`.
2. Stop the `Journal Backend` scheduled task and confirm no backend Node process
   or listener remains on port 4000.
3. Require a clean production checkpoint:

   ```powershell
   git switch main
   git status --short
   ```

4. Switch to the development branch:

   ```powershell
   git switch dev
   ```

Do not start the production task while the checkout is on `dev`.

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

1. Keep the backend task stopped.
2. Switch to `main` and fast-forward it to the reviewed `dev` commit:

   ```powershell
   git switch main
   git merge --ff-only dev
   ```

3. Confirm `git status --short` is empty.
4. Start the backend task.
5. Verify local `/health`, local `/ready`, public `/health`, authentication, and
   one phone synchronization.
6. Record the deployed commit and smoke-test result.

Do not deploy an uncommitted worktree. Do not use `git reset --hard` or a forced
push for a normal deployment.

## Rollback

If the deployed commit fails its smoke test, keep the task stopped, create a
normal revert commit on `main`, restart the task, and repeat the health,
authentication, and synchronization checks. A revert preserves an auditable
record of both the failed deployment and rollback.

Database migrations and credential changes require their own backup and rollback
steps; reverting source code alone may not reverse them safely.
