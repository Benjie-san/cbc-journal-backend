# CBC Journal deployment

The backend source checkout is not the production runtime. Production runs an immutable exported release under `C:\ProgramData\CBCJournal\releases`, selected by the small `current-release.txt` pointer.

## One-time installation

From an elevated PowerShell window, while the repository is on a clean, tested `main` branch:

```powershell
& .\scripts\deployment\Install-CBCJournalDeployment.ps1
cbcjournal-deploy
```

The installer:

- copies the deployment tools to `C:\ProgramData\CBCJournal\bin`;
- copies `.env` and the Firebase service-account file to the ACL-restricted `config` directory without printing them;
- records the source repository path;
- puts the deployment command on the machine PATH; and
- registers the `Journal Backend` scheduled task under `SYSTEM`.

The source copies of the secrets are deliberately left in place during the migration. Remove them from the checkout only after deployment and application smoke tests pass.

## Normal workflow

Develop and commit on `dev`. Before release, confirm tests pass and then fast-forward `main` locally:

```powershell
git switch main
git merge --ff-only dev
cbcjournal-deploy
```

Open a new terminal after the one-time installer so the updated machine PATH is loaded. Nothing is pushed automatically.

The deploy command refuses a dirty tree or any branch other than `main`. It tests the exact commit, exports only `package.json`, `package-lock.json`, and `src`, installs production dependencies in a new release directory, switches the release pointer, starts the scheduled task, and checks local health and readiness. A local activation failure restores the previous pointer automatically. A public health failure is reported separately because Cloudflare Tunnel can fail independently of the application.

## Layout

```text
C:\ProgramData\CBCJournal\
  bin\
  config\
    backend.env
    firebase-service-account.json
    repository-path.txt
  releases\
    YYYYMMDD-HHmmss-<commit>\
  logs\
  current-release.txt
```

Releases are retained. Do not delete one while it is named by `current-release.txt`.

## Credential updates

The installer preserves existing production credentials by default. To intentionally recopy them from the repository, use:

```powershell
& .\scripts\deployment\Install-CBCJournalDeployment.ps1 -UpdateCredentials
```

This is an explicit maintenance operation, not part of ordinary deployments.

## Verification

```powershell
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4000/health
Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4000/ready
Invoke-WebRequest -UseBasicParsing https://api.cbcjournal.cc/health
Get-ScheduledTask -TaskName "Journal Backend"
```
