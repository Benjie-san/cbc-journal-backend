# CBC Journal Self-Hosting Setup

Last updated: 2026-09-17

This guide recreates the working CBC Journal deployment on a Windows PC. It covers local MongoDB, the Node/Express backend, the permanent Cloudflare Tunnel, automatic startup, validation, and recovery.

The deployed request path is:

```text
Android or web client
  -> https://api.cbcjournal.cc
  -> Cloudflare Tunnel
  -> http://127.0.0.1:4000
  -> mongodb://127.0.0.1:27017/journal
```

Cloudflare transports HTTPS requests but does not store journal data. MongoDB remains on the host PC; encrypted backup copies may be synchronized to OneDrive after encryption.

## 1. Security boundaries

- Never forward router ports `27017` or `4000`.
- Bind MongoDB to localhost unless a separately secured network design is intentionally introduced.
- Keep `.env`, `firebase-service-account.json`, Cloudflare tunnel JSON credentials, `cert.pem`, and backup archives out of Git.
- Do not place an interactive Cloudflare Access login in front of the native mobile API. The API already uses Firebase authentication followed by a backend JWT.
- The host PC must be powered on, awake, and online for the API to be available.

## 2. Required software and access

Install or obtain:

1. Git and Node.js.
2. MongoDB Community Server, installed as the `MongoDB` Windows service.
3. MongoDB Compass, optional but useful for inspection.
4. MongoDB Database Tools, including `mongodump.exe` and `mongorestore.exe`.
5. `cloudflared`.
6. Access to the Cloudflare account containing `cbcjournal.cc`.
7. Access to Firebase project `cbc-journal` and its Firebase Admin service-account JSON.
8. The backend repository at:

   ```text
   C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend
   ```

Verify the main executables:

```powershell
node --version
npm --version
& "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe" --version
& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" --version
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" --version
```

## 3. Set up local MongoDB

### 3.1 Verify the MongoDB service

Open an elevated PowerShell terminal:

```powershell
Get-Service MongoDB
Set-Service MongoDB -StartupType Automatic
Start-Service MongoDB
```

MongoDB should listen only on `127.0.0.1:27017`. Connect Compass with:

```text
mongodb://127.0.0.1:27017
```

### 3.2 Restore the recovered logical archive

The verified recovery archive is:

```text
C:\Users\zerep\MongoRestore\journal-logical-backup.archive.gz
```

Its recorded SHA-256 is:

```text
D3A0B55868D1625622EC625F60A267B389F72B6B404D770063A82F0C0575888E
```

Check the archive before restoring:

```powershell
Get-FileHash `
  -Algorithm SHA256 `
  -LiteralPath "C:\Users\zerep\MongoRestore\journal-logical-backup.archive.gz"
```

Restore the source database `test` into the local database `journal`:

```powershell
& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" `
  --uri="mongodb://127.0.0.1:27017" `
  --archive="C:\Users\zerep\MongoRestore\journal-logical-backup.archive.gz" `
  --gzip `
  --nsFrom="test.*" `
  --nsTo="journal.*" `
  --drop
```

`--drop` replaces existing collections. Use it only when intentionally rebuilding the local database from the archive.

The recovery baseline was 1,807 documents with zero restore failures. See [backup-recovery.md](./backup-recovery.md) for the collection counts and recovery history.

## 4. Configure the backend

### 4.1 Install dependencies

```powershell
Set-Location "C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend"
npm ci
```

### 4.2 Create the private environment file

Copy `.env.example` to `.env`, then provide real values locally:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/journal
JWT_SECRET=<long-random-secret>
PORT=4000
JSON_BODY_LIMIT=1mb
SHUTDOWN_TIMEOUT_MS=10000
```

Generate `JWT_SECRET` with a cryptographically secure password generator. Never reuse a personal password or commit this file.

`MONGODB_URI` and `JWT_SECRET` are required at startup. `PORT` must be an
integer from 1 through 65535. `JSON_BODY_LIMIT` accepts a positive byte size
such as `512kb` or `1mb`; the default is `1mb`. `SHUTDOWN_TIMEOUT_MS` bounds
graceful shutdown and defaults to 10 seconds. Startup validation reports only
configuration names, never their values.

### 4.3 Add Firebase Admin credentials

Download a Firebase Admin service-account JSON for project `cbc-journal` and save it as:

```text
C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend\firebase-service-account.json
```

Confirm both `.env` and `firebase-service-account.json` are ignored by Git:

```powershell
git check-ignore -v .env firebase-service-account.json
```

The backend needs outbound HTTPS access to Google so Firebase Admin can verify ID tokens.

### 4.4 Start and test manually

```powershell
npm start
```

Expected startup messages include MongoDB connected and the API listening on port `4000`.

From a second terminal:

```powershell
curl.exe --fail-with-body http://127.0.0.1:4000/
```

Expected response:

```json
{"status":"ok"}
```

`GET /health` is a liveness check and `GET /ready` is a readiness check that
pings MongoDB. Both return JSON; `/ready` returns HTTP 503 until MongoDB is
reachable. The root endpoint remains available for compatibility.

Stop the manual process before enabling automatic startup.

## 5. Configure automatic backend startup

The repository contains:

- `scripts/runBackend.ps1`: starts Node, writes logs, and restarts Node after an unexpected exit.
- `scripts/installBackendStartupTask.ps1`: registers the `Journal Backend` task under `SYSTEM` at Windows startup.

Open PowerShell as Administrator and run:

```powershell
& "C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend\scripts\installBackendStartupTask.ps1"
Start-ScheduledTask -TaskName "Journal Backend"
```

Verify it:

```powershell
Get-ScheduledTask -TaskName "Journal Backend" |
  Select-Object TaskName, State

Get-ScheduledTaskInfo -TaskName "Journal Backend" |
  Select-Object LastRunTime, LastTaskResult

curl.exe --fail-with-body http://127.0.0.1:4000/
```

Backend logs are stored under:

```text
C:\ProgramData\CBCJournal\logs
```

The task is configured to start when available, run on battery, ignore duplicate starts, and restart after task-level failure. The runner also supervises Node and retries it after 10 seconds.

## 6. Install and authenticate Cloudflare Tunnel

### 6.1 Install `cloudflared`

```powershell
winget install --id Cloudflare.cloudflared
```

Verify it using the installed path:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" --version
```

### 6.2 Authenticate the host PC

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel login
```

The browser opens Cloudflare authorization. Select `cbcjournal.cc` and approve it. Cloudflare saves `cert.pem` under the current user's `.cloudflared` directory. Treat it as a secret.

### 6.3 Create the named tunnel

Check for an existing tunnel before creating one:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel list
```

For this deployment, the existing tunnel is:

```text
Name: journal-backend
ID:   bdd14428-4154-40b3-b326-1baa13a0d347
```

On a fresh Cloudflare account, create it with:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" `
  tunnel create journal-backend
```

This creates a tunnel credential JSON under `%USERPROFILE%\.cloudflared`. Do not commit or share it.

### 6.4 Create the DNS route

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" `
  tunnel route dns journal-backend api.cbcjournal.cc
```

This creates the Cloudflare DNS record routing `api.cbcjournal.cc` to the named tunnel.

### 6.5 Create the local tunnel configuration

Create `%USERPROFILE%\.cloudflared\config.yml`:

```yaml
tunnel: bdd14428-4154-40b3-b326-1baa13a0d347
credentials-file: C:\Users\zerep\.cloudflared\bdd14428-4154-40b3-b326-1baa13a0d347.json

ingress:
  - hostname: api.cbcjournal.cc
    service: http://127.0.0.1:4000
  - service: http_status:404
```

The final catch-all rule is required. It prevents unrecognized hostnames from being forwarded to the backend.

Validate the configuration:

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" `
  tunnel --config "C:\Users\zerep\.cloudflared\config.yml" ingress validate
```

### 6.6 Test interactively

```powershell
& "C:\Program Files (x86)\cloudflared\cloudflared.exe" `
  tunnel --config "C:\Users\zerep\.cloudflared\config.yml" run journal-backend
```

In a second terminal:

```powershell
curl.exe --fail-with-body https://api.cbcjournal.cc/
```

Do not proceed to service installation until the public response is `{"status":"ok"}`.

## 7. Install Cloudflared as a Windows service

The Windows service runs as `LocalSystem`, so it needs its own configuration and credential copy under the system profile.

First create `%USERPROFILE%\.cloudflared\service-config.yml`:

```yaml
tunnel: bdd14428-4154-40b3-b326-1baa13a0d347
credentials-file: C:\Windows\System32\config\systemprofile\.cloudflared\bdd14428-4154-40b3-b326-1baa13a0d347.json

ingress:
  - hostname: api.cbcjournal.cc
    service: http://127.0.0.1:4000
  - service: http_status:404
```

Open PowerShell as Administrator and run:

```powershell
$journalCloudflareDir = "C:\Windows\System32\config\systemprofile\.cloudflared"

New-Item -ItemType Directory -Force -Path $journalCloudflareDir

Copy-Item `
  -LiteralPath "C:\Users\zerep\.cloudflared\bdd14428-4154-40b3-b326-1baa13a0d347.json" `
  -Destination "$journalCloudflareDir\bdd14428-4154-40b3-b326-1baa13a0d347.json" `
  -Force

Copy-Item `
  -LiteralPath "C:\Users\zerep\.cloudflared\service-config.yml" `
  -Destination "$journalCloudflareDir\config.yml" `
  -Force

& "C:\Program Files (x86)\cloudflared\cloudflared.exe" service install

Set-ItemProperty `
  -LiteralPath "HKLM:\SYSTEM\CurrentControlSet\Services\Cloudflared" `
  -Name ImagePath `
  -Value '"C:\Program Files (x86)\cloudflared\cloudflared.exe" --config=C:\Windows\System32\config\systemprofile\.cloudflared\config.yml tunnel run'

Restart-Service Cloudflared
Get-Service Cloudflared
```

Verify the service startup mode and command:

```powershell
Get-CimInstance Win32_Service -Filter "Name='Cloudflared'" |
  Select-Object Name, State, StartMode, PathName |
  Format-List
```

Expected state is `Running` and start mode is `Auto`.

## 8. Point clients at the public API

The Expo app uses:

```env
EXPO_PUBLIC_API_BASE_URL=https://api.cbcjournal.cc
```

The development, preview, and production profiles in `eas.json` use the same URL. `GOOGLE_SERVICES_JSON` is stored as a secret file variable in all three EAS environments.

Verify that no active build profile still references Render or `10.0.2.2` before building a standalone release.

## 9. End-to-end validation

Run these checks in order:

1. Local MongoDB service:

   ```powershell
   Get-Service MongoDB
   ```

2. Local backend:

   ```powershell
   curl.exe --fail-with-body http://127.0.0.1:4000/
   ```

3. Cloudflared service:

   ```powershell
   Get-Service Cloudflared
   ```

4. Public backend:

   ```powershell
   curl.exe --fail-with-body https://api.cbcjournal.cc/
   ```

5. Authenticated client checks:
   - Google sign-in.
   - Session restoration.
   - Create, update, delete, and restore a journal.
   - Offline creation followed by reconnection and synchronization.
   - Reading-plan retrieval.

6. Confirm successful routes in the current backend log without logging tokens or journal content.

## 10. Controlled restart validation

Save unrelated work, then restart Windows. Do not manually start MongoDB, Node, Cloudflared, or Metro.

After Windows returns, wait 60-90 seconds and run:

```powershell
Get-Service MongoDB, Cloudflared
Get-ScheduledTask -TaskName "Journal Backend" |
  Select-Object TaskName, State
curl.exe --fail-with-body http://127.0.0.1:4000/
curl.exe --fail-with-body https://api.cbcjournal.cc/
```

The controlled restart passed on 2026-09-17. During the restart, the phone briefly received Cloudflare errors `1033` and `502`, which is expected while the tunnel connector and backend origin are unavailable or starting in sequence. After Windows returned, MongoDB and Cloudflared were `Running`, the `Journal Backend` task was `Running`, both health endpoints returned `{"status":"ok"}`, and the phone synchronized after pull-to-refresh without manually starting any component.

`Get-ScheduledTaskInfo` accepts one task-name string at a time. To inspect both tasks, use:

```powershell
"Journal Backend", "Journal MongoDB Backup" | ForEach-Object {
  $journalTaskName = $_
  Get-ScheduledTaskInfo -TaskName $journalTaskName |
    Select-Object @{Name="TaskName"; Expression={$journalTaskName}}, LastRunTime, LastTaskResult, NextRunTime
}
```

An ordinary Windows restart necessarily causes a short outage until Windows, MongoDB, Node, and Cloudflared start again. Client retry and clearer temporary-outage messaging remain worthwhile UX improvements.

## 11. Backups and recovery checks

Run a manual backup:

```powershell
& "C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend\scripts\backupMongo.ps1"
```

The scheduled task `Journal MongoDB Backup` runs daily at 2:00 AM with start-when-available enabled. Backups are written to:

```text
C:\Users\zerep\MongoBackups\Journal
```

Each backup includes a gzip archive, SHA-256 sidecar, and history entry. Backups are still on the same physical PC, so the encrypted MEGA copy remains important for protection against disk loss, theft, or catastrophic Windows failure.

A full isolated restore drill passed on 2026-09-17 with 1,846 documents restored, zero failures, and matching document identities, canonical BSON digests, and indexes. See [backup-recovery.md](./backup-recovery.md) for the evidence and exact commands.

The passphrase-encrypted MEGA archive was also downloaded, checksum-verified,
decrypted, and restored into an isolated database on 2026-09-17: 1,853 documents,
zero failures, matching collection digests, and restored indexes. The temporary
database and decrypted files were removed after verification.

### Encrypted off-PC copy

The current low-cost off-PC path is manual passphrase encryption followed by
uploading only the encrypted file to MEGA; see [backup-recovery.md](./backup-recovery.md).
Do not schedule the OneDrive script until that design is explicitly resumed.

If OneDrive automation is later resumed, use `scripts/backupMongoEncrypted.ps1`. It uses the standard
`age` format with an asymmetric public recipient. The plaintext archive is created
under `C:\Users\zerep\MongoBackups\Journal`, encrypted to a local staging file,
and only then copied to `C:\Users\zerep\OneDrive\CBCJournal\EncryptedBackups`.
The script rejects an offsite path outside OneDrive, rejects passphrases/private
keys as recipients, refuses overwrites, and verifies the copied encrypted file's
SHA-256. Keep the matching private recovery identity protected separately from the
host and ordinary OneDrive folders. Setup, task-action guidance, and the isolated recovery drill
are in [backup-recovery.md](./backup-recovery.md).

## 12. Troubleshooting order

When `api.cbcjournal.cc` returns 502, check from the inside out:

1. `Get-Service MongoDB`
2. `curl.exe http://127.0.0.1:4000/`
3. `Get-ScheduledTask -TaskName "Journal Backend"`
4. `Get-ScheduledTaskInfo -TaskName "Journal Backend"`
5. Read `C:\ProgramData\CBCJournal\logs`.
6. `Get-Service Cloudflared`
7. `curl.exe https://api.cbcjournal.cc/`

If `/auth` and `/me` return HTTP 200 before a client displays a generic Google error, investigate later API/network stages rather than assuming the native Google sign-in itself failed.
