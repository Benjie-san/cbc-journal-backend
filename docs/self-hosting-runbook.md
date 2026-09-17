# Journal Self-Hosting Runbook

Last updated: 2026-09-16

This records the migration from MongoDB Atlas and Render to a local Windows-hosted database and API, with Cloudflare Tunnel providing the stable public HTTPS endpoint.

## Repository locations

- Backend: `C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend`
- Expo app: `C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal`

For a clean installation or rebuild, follow [self-hosting-setup.md](./self-hosting-setup.md). This runbook records the completed migration and current operational state.

The ordered work after this migration is tracked in [next-phase-roadmap.md](./next-phase-roadmap.md).

## Current architecture

```text
Android app (Google Play closed testing or Expo development client)
  -> https://api.cbcjournal.cc
  -> Cloudflare Tunnel
  -> local Express API on port 4000
  -> local MongoDB database journal on port 27017

Firebase Authentication
  -> Google or email sign-in in the app
  -> Firebase ID token sent to POST /auth
  -> Firebase Admin verifies the token
  -> backend JWT returned to the app
```

MongoDB and Express are not exposed through router port forwarding. `cloudflared` creates an outbound connection from the host PC to Cloudflare.

## Migration outcome

The original migration goal is complete:

- MongoDB Atlas and Render are no longer required for normal operation.
- The recovered database runs on the host PC.
- The Express API is available publicly through a permanent Cloudflare Tunnel.
- The Google Play closed-testing build authenticates and synchronizes against the self-hosted API without Metro.
- Existing phone data survived the Play Store update and synchronized into local MongoDB.

## Completed work

### Database recovery

- Installed and verified MongoDB Database Tools `100.18.0`.
- Extracted the Atlas WiredTiger snapshot.
- Opened the snapshot using a temporary MongoDB process on port `27018`.
- Converted the physical snapshot to a portable gzip-compressed `mongodump` archive.
- Restored the source `test` database into the local `journal` database on port `27017`.
- Verified 1,807 restored documents and zero failures.
- Shut down the temporary port `27018` process.
- Retained a verified logical backup and checksum. See [backup-recovery.md](./backup-recovery.md).

### Local backend

- Configured `MONGODB_URI=mongodb://127.0.0.1:27017/journal`.
- Added a local JWT secret and configured port `4000`.
- Added `.env.example` without real secrets.
- Added `jsonwebtoken` as a direct dependency.
- Updated the database connection message to refer to MongoDB rather than Atlas.
- Installed backend dependencies.
- Added the Firebase Admin service account as `firebase-service-account.json` and confirmed it belongs to `cbc-journal`.
- Verified `GET /` returns `{ "status": "ok" }`.
- Verified Firebase authentication and restored a real existing user session from the local database.
- Removed authorization-header logging from the backend routes and middleware.
- Removed the misplaced Firebase client `google-services.json` from the backend repository.
- Added `scripts/backupMongo.ps1` for compressed, checksummed local backups.
- Registered and successfully tested the daily `Journal MongoDB Backup` Windows task.
- Added a release-based deployment workflow documented in
  [deployment.md](./deployment.md).
- Registered the `Journal Backend` SYSTEM task to start the selected immutable
  release from `C:\ProgramData\CBCJournal`, separate from the source checkout.
- Hardened the runner after an unexpected Node exit: it now supervises Node, retries after 10 seconds, and is allowed to continue on battery power. Task Scheduler restart settings provide a second recovery layer.

The following files must remain uncommitted:

- `.env`
- `firebase-service-account.json`

### Expo Android app

- Configured local API access through `.env.local`:

  ```env
  EXPO_PUBLIC_API_BASE_URL=https://api.cbcjournal.cc
  ```

- Added dynamic Expo configuration in `app.config.js`.
- Enabled Android cleartext HTTP only when the configured API URL begins with `http://`.
- Configured every EAS profile to use the permanent HTTPS API URL.
- Installed a valid `google-services.json` for Firebase project `cbc-journal` and package `com.anonymous.Journal`.
- Uploaded `GOOGLE_SERVICES_JSON` to the EAS development, preview, and production environments as a secret file variable.
- Removed the unrelated `eas@0.1.0` package; builds use `eas-cli` instead.
- Aligned Expo SDK 54 package versions.
- Regenerated `package-lock.json` using npm 10 for compatibility with EAS.
- Passed the exact EAS install command: `npm ci --include=dev` under npm 10.
- Passed Expo Doctor: 18/18 checks.
- Passed lint with 0 errors and 14 existing warnings.
- Built, downloaded, installed, and launched the Android development client.
- Passed local CRUD, offline operation, reconnect, and synchronization smoke tests against the recovered database.
- Updated the development, preview, and production EAS profiles to use `https://api.cbcjournal.cc`.
- Generated and verified preview APK version code `9`.
- Generated production AAB version code `10` with the Google Play-registered EAS upload key.
- Published version code `10` to the Google Play closed-testing Alpha track.
- Installed the Play-signed update over version code `8` without clearing phone storage.
- Successfully authenticated and synchronized the phone's offline journals through the public API.

Successful EAS builds:

```text
Development: https://expo.dev/accounts/zerephyr/projects/Journal/builds/c919870b-d470-43b6-b9f8-88c1be0439f2
Preview APK: https://expo.dev/accounts/zerephyr/projects/Journal/builds/57720946-05c7-4f74-a611-7d473cfad804
Production AAB: https://expo.dev/accounts/zerephyr/projects/Journal/builds/8454fe89-6a63-4ab3-be6f-7cdc8724e7f1
```

### Google Play signing and verification

- Android developer verification status: `Registered` for `com.anonymous.Journal`.
- Google Play app-signing certificate matches the certificate on the existing phone installation.
- The EAS upload certificate matches the Upload key certificate registered in Play Console.
- Direct installation of the EAS preview APK over the Play Store build was intentionally avoided because upload-key and Play app-signing certificates are different.
- Play Store delivery re-signs the AAB-generated APK with the correct app-signing key, preserving existing application storage during the update.
- The missing R8/deobfuscation file message was a non-blocking warning because this build did not rely on uploaded obfuscation mappings.

### Authentication troubleshooting

The initial Google login popup was misleading because `src/api/google.ts` returned the same generic message for every stage of the login pipeline.

Verified Android OAuth values:

- Package: `com.anonymous.Journal`
- Development APK SHA-1: `79:D8:9C:6E:48:3F:79:DD:8C:DF:A4:70:F5:4E:4B:E7:08:D6:13:55`
- Google and Email/Password providers are enabled in Firebase.
- The APK contains the expected web OAuth client ID.

Google sign-in was actually succeeding. The failure occurred when the local backend attempted to verify the Firebase ID token. The backend process had been started in a restricted environment that redirected its Google OAuth request to `127.0.0.1:9`. Restarting the backend with normal outbound internet access fixed token verification and restored the app session.

The backend requires outbound HTTPS access to Google for Firebase Admin token verification. MongoDB remains local.

The first Play closed-test login displayed the same generic Google failure message when the Node backend had stopped. Logs proved that earlier attempts had completed `POST /auth`, `/me`, journal writes, streak updates, and reading-plan reads successfully. The public 502 was caused by the unavailable Node origin, not by Google Play signing or Firebase. The backend runner was hardened afterward.

## Normal local startup

### 1. Start or verify MongoDB

MongoDB should run as the Windows service on port `27017`.

```powershell
Get-Service MongoDB
```

If it is stopped, start it from an elevated PowerShell window:

```powershell
Start-Service MongoDB
```

### 2. Verify the backend startup task

The `Journal Backend` task runs as SYSTEM at Windows startup. Check it from an elevated PowerShell terminal:

```powershell
Get-ScheduledTask -TaskName "Journal Backend"
Get-ScheduledTaskInfo -TaskName "Journal Backend"
Get-Content "C:\ProgramData\CBCJournal\logs\backend-$(Get-Date -Format yyyy-MM-dd).log" -Tail 30
```

For a manual diagnostic fallback, stop the task and run the selected release
with the production configuration variables set. Do not start production from
the mutable source checkout. Normal releases use:

```powershell
cbcjournal-deploy
```

Verify in a browser at `http://localhost:4000/`.

The runner relaunches Node after an unexpected exit. A temporary Cloudflare 502 is expected while Windows is restarting or while MongoDB and Node are still starting.

The API exposes `GET /health` for liveness and `GET /ready` for readiness.
Readiness pings MongoDB and returns HTTP 503 while the database is unavailable;
the compatibility `GET /` endpoint remains a simple JSON status check. On
SIGINT or SIGTERM, Node stops accepting requests, closes MongoDB, and exits
after the configured bounded shutdown timeout (`SHUTDOWN_TIMEOUT_MS`, default
10 seconds). A shutdown timeout or close failure produces a nonzero exit code.

### 3. Start the emulator

Start the `Pixel_7` AVD from Android Studio and confirm it is visible:

```powershell
adb devices
```

### 4. Start Metro

In a second normal PowerShell terminal:

```powershell
cd C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal
npx expo start --dev-client --android
```

Keep the backend and Metro terminals open during development-client testing.

## Important build lesson

The EAS dependency error was caused by a lockfile generated by npm 11 while the EAS image validated it with npm 10. Firebase Auth required two nested Async Storage `1.24.0` peer entries that npm 11 had omitted.

Before future EAS builds, validate with npm 10:

```powershell
npx --yes npm@10.9.2 install --package-lock-only --include=dev
npx --yes npm@10.9.2 ci --include=dev
npx expo-doctor
npm run lint
```

Do not use `npm audit fix --force`; the reported dependency vulnerabilities need deliberate review because forced upgrades may break Expo compatibility.

Submit a new build from the CLI after changing dependencies. The EAS dashboard Retry action can reuse the prior uploaded source archive.

## Operational status

### Controlled restart validation

The controlled Windows restart test passed on 2026-09-17:

- The app temporarily received Cloudflare `1033` and `502` responses while the PC and services were offline or starting.
- MongoDB and Cloudflared returned automatically in the `Running` state.
- The `Journal Backend` scheduled task returned automatically in the `Running` state.
- The `Journal MongoDB Backup` task was present and `Ready`.
- Both `http://127.0.0.1:4000/` and `https://api.cbcjournal.cc/` returned `{"status":"ok"}`.
- The phone app synchronized successfully after pull-to-refresh without Metro or manual service startup.

This validates automatic recovery, not zero-downtime availability. A home-PC restart still produces a temporary API outage.

Completed:

- Authorization-header logging removed.
- Misplaced backend `google-services.json` removed.
- CRUD and offline synchronization smoke tests passed.
- Automatic daily compressed backups configured and tested.
- Purchased `cbcjournal.cc`; its root and `www` hostnames remain available for a future web frontend.
- Published the backend at `https://api.cbcjournal.cc` through a permanent named Cloudflare Tunnel.
- Installed both Cloudflared and the Node backend for automatic startup.
- Verified local and public health checks after stopping the manually launched processes.
- Registered the Android package under Android developer verification.
- Verified Google Play app-signing and EAS upload certificates.
- Released the self-hosted build to closed testing and completed a real phone synchronization.
- Hardened automatic backend recovery after observing scheduled task result code `1`.
- Passed the passphrase-encrypted MEGA backup recovery drill: checksum, decryption, isolated restore, document digests, and indexes all matched.

Remaining operational checks:

1. Review the 14 app lint warnings and prioritize authentication lifecycle warnings.
2. Ensure Windows does not sleep while the service is expected to be reachable.
3. Add external uptime monitoring for `https://api.cbcjournal.cc/` and an alert path.
4. Test sync idempotency, duplicate prevention, deletions/restores, conflicts, interrupted requests, and multiple devices. The multi-device last-write-wins design remains unresolved.

The controlled Windows restart and the client streak-hydration correction were completed and verified on 2026-09-17. Multi-device streak-write ordering remains part of later synchronization hardening.

## Cloudflare Tunnel

MongoDB port `27017` and Express port `4000` must never be exposed through router port forwarding.

### Temporary tunnel test

`cloudflared 2026.9.1` was installed on Windows. Because no domain was available yet, an account-less Quick Tunnel was used to validate the architecture.

- The public HTTPS health endpoint returned `{ "status": "ok" }`.
- The Expo app was temporarily pointed at the `trycloudflare.com` URL.
- Authenticated session restore, journals, trash, reading plans, streak updates, and journal creation reached the local backend successfully through Cloudflare.
- After restarting the backend, bearer authorization headers were no longer printed.

Quick Tunnel hostnames are random, temporary, and have no uptime guarantee. The application now uses the permanent named tunnel instead.

```text
Mobile app
  -> https://api.cbcjournal.cc
  -> Cloudflare Tunnel
  -> http://127.0.0.1:4000
  -> local MongoDB at 127.0.0.1:27017
```

Permanent tunnel details:

- Domain: `cbcjournal.cc`
- API hostname: `api.cbcjournal.cc`
- Tunnel name: `journal-backend`
- Tunnel ID: `bdd14428-4154-40b3-b326-1baa13a0d347`
- Cloudflared version at setup: `2026.9.1`
- Windows service: `Cloudflared`, startup mode `Automatic`
- Service configuration: `C:\Windows\System32\config\systemprofile\.cloudflared\config.yml`
- Origin: `http://127.0.0.1:4000`
- Catch-all ingress response: HTTP 404

Verify the tunnel from an elevated PowerShell terminal:

```powershell
Get-Service Cloudflared
curl.exe --fail-with-body https://api.cbcjournal.cc/
```

The tunnel credential JSON files and `cert.pem` are secrets. Do not commit, display, or share their contents.

Cloudflare Access should not be placed in front of the mobile API using an interactive browser login. The API already uses Firebase authentication followed by backend JWTs. Any additional Cloudflare policy must remain compatible with native app requests.

## Self-hosting operational requirements

- The PC, MongoDB service, backend process, and Cloudflare Tunnel must all be running.
- The PC must have stable power and internet connectivity.
- Windows sleep still makes the API unavailable; automatic recovery only applies once Windows is running.
- Keep Windows and Node dependencies patched deliberately.
- Do not open router ports for MongoDB or Express when using Cloudflare Tunnel.
- Store the Firebase service account and JWT secret outside Git.
- Rotate the Firebase service-account key if it is ever exposed.
- Maintain at least one backup outside the host PC so a disk failure does not destroy both the database and its backups.
