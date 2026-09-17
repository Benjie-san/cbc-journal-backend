# MongoDB Backup and Recovery

This project no longer depends on MongoDB Atlas for its primary database. The recovered data is hosted by the local MongoDB Windows service.

## Current off-site backup choice

The current low-cost operating plan is:

- Keep the automatic daily plaintext local backup for quick recovery.
- Periodically create a separate `age` passphrase-encrypted copy.
- Upload only the encrypted `.age` file and its checksum to MEGA manually.
- Keep the passphrase outside MEGA and outside the backup host.

The public-recipient OneDrive script remains a future automation option. Do not
schedule it while the project is using the manual MEGA workflow.

## Recovered database

- Local connection: `mongodb://127.0.0.1:27017/journal`
- Logical archive: `C:\Users\zerep\MongoRestore\journal-logical-backup.archive.gz`
- Archive SHA-256: `D3A0B55868D1625622EC625F60A267B389F72B6B404D770063A82F0C0575888E`
- Original Atlas snapshot: `C:\Users\zerep\Downloads\cbc-journal-2026-09-14T14-08-57.274Z.tgz`

The Atlas download was a physical WiredTiger snapshot, not a normal `mongodump` archive. It was extracted, opened temporarily by `mongod` on port `27018`, and converted into the logical archive above. The temporary server has been shut down.

## Verified restored data

The source database was named `test`. It was restored as `journal` on the permanent local server at port `27017`.

| Collection | Documents |
| --- | ---: |
| `users` | 18 |
| `journalentries` | 332 |
| `journalversions` | 361 |
| `readingplandays` | 1,096 |
| `readingcompletions` | 0 |
| **Total** | **1,807** |

The restore completed with `1,807 document(s) restored successfully` and `0 document(s) failed to restore`. Collection indexes were also restored.

## Live database after phone synchronization

The original restore counts above remain the recovery baseline. After the Google Play closed-testing build synchronized phone data on 2026-09-16, a read-only verification reported:

| Measurement | Count |
| --- | ---: |
| Users | 21 |
| Journal entries, including deleted | 342 |
| Active journal entries | 340 |
| Users owning journal entries | 20 |

The latest journal write completed successfully through `https://api.cbcjournal.cc`. Cloudflare transports requests but does not store the database; MongoDB data remains on the host PC.

## Restore the logical archive again

Make sure the normal MongoDB service is running on port `27017`, then run this in Command Prompt:

```bat
"C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" --uri="mongodb://127.0.0.1:27017" --archive="%USERPROFILE%\MongoRestore\journal-logical-backup.archive.gz" --gzip --nsFrom="test.*" --nsTo="journal.*" --drop
```

`--drop` replaces the existing collections. Do not use it unless replacing the current local database is intended.

## Create a new logical backup

```bat
"C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe" --uri="mongodb://127.0.0.1:27017" --db=journal --archive="%USERPROFILE%\MongoRestore\journal-backup.archive.gz" --gzip
```

Use dated filenames for recurring backups and periodically test restoration into a separate database. A backup is not considered reliable until a restore has been tested.

## Manual encrypted MEGA backup

Use this workflow when you want an off-PC copy without reserving a flash drive or
running a cloud-sync task:

1. Confirm the local MongoDB service is running and create a fresh local archive.

   ```powershell
   & "C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend\scripts\backupMongo.ps1"
   ```

2. In a new PowerShell window, choose the newest `*.archive.gz` file and encrypt
   it with a passphrase. `age` prompts for the passphrase without putting it in
   the command line or shell history:

   ```powershell
   $journalSource = Get-ChildItem -LiteralPath "C:\Users\zerep\MongoBackups\Journal" -Filter "*.archive.gz" |
     Sort-Object LastWriteTime -Descending |
     Select-Object -First 1
   if ($null -eq $journalSource) { throw "No local archive found." }
   $journalEncrypted = "$($journalSource.FullName).age"
   if (Test-Path -LiteralPath $journalEncrypted -PathType Any) { throw "Encrypted output already exists: $journalEncrypted" }
   & age.exe --passphrase --output $journalEncrypted $journalSource.FullName
   if ($LASTEXITCODE -ne 0) { throw "age encryption failed." }
   ```

3. Create a checksum beside the encrypted file:

   ```powershell
   $journalHash = (Get-FileHash -LiteralPath $journalEncrypted -Algorithm SHA256).Hash
   "$journalHash  $([System.IO.Path]::GetFileName($journalEncrypted))" |
     Set-Content -LiteralPath "$journalEncrypted.sha256" -Encoding ascii
   ```

4. Upload only the `.age` file and `.sha256` file to MEGA. Never upload the
   matching `.archive.gz` plaintext file.
5. Confirm the files appear in MEGA through its web interface, then keep the
   passphrase separately. Do not store the passphrase in the same MEGA folder.
6. Periodically perform the encrypted recovery drill below. Do not delete the
   only local archive until the encrypted copy has been verified.

The passphrase should be long and randomly generated, not a personal sentence.
Keep two protected copies under CBC custody. Losing the passphrase makes every
manual MEGA archive unrecoverable.

### Latest manual MEGA upload

On 2026-09-17, the following encrypted archive and checksum were uploaded to the
MEGA `Journal` folder:

```text
journal-2026-09-17_09-29-01.archive.gz.age
journal-2026-09-17_09-29-01.archive.gz.age.sha256
```

The local encrypted file was 196,565 bytes. Its SHA-256 was verified locally as:

```text
5911137A3234167787DA4799427A11285283257266C740B1AF5AA7EFBB29A418
```

The uploaded listing showed only the encrypted archive and checksum; no plaintext
`.archive.gz` was uploaded. The encrypted recovery drill below passed on the same
day.

### Encrypted MEGA recovery drill (2026-09-17)

The archive and checksum were downloaded from MEGA into a temporary directory
outside the project and outside OneDrive. The sidecar hash matched the downloaded
`.age` file (`Checksum verified`). `age --decrypt --passphrase` produced a local
temporary `journal-restore.archive.gz`, and `mongorestore` restored it into the
isolated database `journal_restore_drill_20260917` without touching `journal`:

```text
1,853 document(s) restored successfully
0 document(s) failed to restore
```

The live and restored databases matched exactly:

| Collection | Live | Drill | Canonical digest |
| --- | ---: | ---: | --- |
| `users` | 21 | 21 | Match |
| `journalentries` | 361 | 361 | Match |
| `journalversions` | 375 | 375 | Match |
| `readingplandays` | 1,096 | 1,096 | Match |
| `readingcompletions` | 0 | 0 | Match |
| **Total** | **1,853** | **1,853** | **Match** |

Indexes were restored as well. After verification, only the exact temporary
database and temporary downloaded/decrypted files were removed; the live
`journal` database and the MEGA upload were left unchanged.

## Automatic daily backup

The script `scripts/backupMongo.ps1` creates a gzip-compressed logical archive, a SHA-256 checksum sidecar, and an entry in `backup-history.log`.

- Destination: `C:\Users\zerep\MongoBackups\Journal`
- Scheduled task: `Journal MongoDB Backup`
- Schedule: daily at 2:00 AM, with start-when-available enabled
- First manual archive validation: passed with `mongorestore --dryRun`
- Scheduled-task test: passed with result code `0`

Inspect the task with:

```powershell
Get-ScheduledTask -TaskName "Journal MongoDB Backup"
Get-ScheduledTaskInfo -TaskName "Journal MongoDB Backup"
```

These backups are local. The encrypted off-PC path currently uses the manual MEGA
workflow above. The public-recipient script `scripts/backupMongoEncrypted.ps1`
remains a deferred OneDrive automation option; it creates the plaintext archive
only in the non-OneDrive local directory, encrypts it with an age public recipient,
then copies only the `.age` file and its
checksum into OneDrive. It refuses passphrases, private keys, overwrites, and
offsite directories outside OneDrive.

## Encrypted OneDrive backup

The format is [age](https://github.com/FiloSottile/age), using asymmetric encryption.
The unattended backup job needs only a public recipient; keep the private recovery
identity protected separately from both OneDrive and this PC.

Install the official Windows build in an Administrator PowerShell (the project
documents the upstream package; verify the installed version before use):

```powershell
winget install --id FiloSottile.age --exact
Get-Command age.exe, age-keygen.exe
```

`Documents` on this host resolves to `C:\Users\zerep\OneDrive\Documents`; it is
therefore **not** a suitable unprotected key location. The preferred option for
CBC is a passphrase-protected identity stored in a CBC-controlled password
manager or separate secure vault. A removable drive is an alternative, not a
requirement. Do not paste the identity into chat, Git, a scheduled-task argument,
or an ordinary synced folder:

```powershell
$journalRecoveryDir = "E:\CBCJournal-Recovery" # replace E: with the removable drive
if (-not (Test-Path -LiteralPath (Split-Path -Qualifier $journalRecoveryDir))) {
  throw "Recovery drive is not connected."
}
$resolvedRecoveryDir = [System.IO.Path]::GetFullPath($journalRecoveryDir)
$resolvedOneDrive = [System.IO.Path]::GetFullPath($env:OneDrive).TrimEnd('\')
if ($resolvedRecoveryDir.StartsWith("$resolvedOneDrive\", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "The recovery identity must not be stored in OneDrive."
}
New-Item -ItemType Directory -Force -Path $journalRecoveryDir | Out-Null
& age-keygen.exe -o (Join-Path $journalRecoveryDir "backup-recovery-key.txt")
```

For the preferred password-manager/vault option, create a passphrase-protected
identity, copy only the `.age` file into the approved CBC vault, and remove the
temporary plaintext identity:

```powershell
$journalRecoveryDir = "C:\Users\zerep\AppData\Local\CBCJournal-Recovery"
New-Item -ItemType Directory -Force -Path $journalRecoveryDir | Out-Null
$journalPlainIdentity = Join-Path $journalRecoveryDir "backup-recovery-key.txt"
$journalProtectedIdentity = Join-Path $journalRecoveryDir "backup-recovery-key.txt.age"
try {
  & age-keygen.exe -o $journalPlainIdentity
  $journalRecipient = (& age-keygen.exe -y $journalPlainIdentity).Trim()
  & age.exe --passphrase --output $journalProtectedIdentity $journalPlainIdentity
} finally {
  if (Test-Path -LiteralPath $journalPlainIdentity -PathType Leaf) {
    Remove-Item -LiteralPath $journalPlainIdentity -Force
  }
}
```

Copy the passphrase-protected `.age` identity into the approved CBC password
manager or secure vault, verify that copy, and then remove the local `.age` file.
Make a second protected recovery copy under separate CBC custody before relying
on these backups. Losing every copy of this identity makes all encrypted archives
unrecoverable. Copy only the derived public recipient to the host's non-synced
configuration file:

```powershell
if (-not $journalRecipient) {
  $journalKey = Join-Path $journalRecoveryDir "backup-recovery-key.txt"
  $journalRecipient = (& age-keygen.exe -y $journalKey).Trim()
}
if ($journalRecipient -notmatch '^age1[a-z0-9]{10,}$') { throw "No valid age recipient found." }
New-Item -ItemType Directory -Force -Path "C:\ProgramData\CBCJournal" | Out-Null
Set-Content -LiteralPath "C:\ProgramData\CBCJournal\backup-age-recipient.txt" -Value $journalRecipient -Encoding ascii -NoNewline
```

Do not proceed until the recovery identity has at least two protected copies and
the passphrase can be recovered by an authorized CBC administrator. After the
decrypt/restore drill passes, remove any local plaintext identity. If a removable
drive is used, safely eject and disconnect it. The unattended host retains only
the public recipient.

Run one manual encrypted backup after replacing the default OneDrive path only if
needed:

```powershell
& "C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend\scripts\backupMongoEncrypted.ps1"
```

The expected destination is:
`C:\Users\zerep\OneDrive\CBCJournal\EncryptedBackups`.
Confirm that the destination contains only `*.archive.gz.age` and `.sha256` files;
the corresponding plaintext archive remains in
`C:\Users\zerep\MongoBackups\Journal` and is never copied to OneDrive.

After the manual run succeeds, keep the existing `Journal MongoDB Backup` task
unchanged so local recovery does not depend on OneDrive. Create a separate
`Journal Encrypted Offsite Backup` task under the `zerep` Windows account. A
per-user task is required because OneDrive does not run under `SYSTEM`. Pass the
explicit `-OneDriveRoot C:\Users\zerep\OneDrive` and explicit `-AgePath` values
to avoid depending on a scheduled task's environment variables or PATH. Schedule
it after the local job, for example at 2:30 AM with start-when-available enabled.
Do not run it as an account that can read the disconnected private recovery key.
Inspect both task actions afterward with:

```powershell
Get-ScheduledTask -TaskName "Journal MongoDB Backup", "Journal Encrypted Offsite Backup" |
  Select-Object TaskName, State, Actions
```

The encrypted script logs success/failure only to the local
`encrypted-backup-history.log`; it does not log the private key or passphrase.

## Encrypted recovery drill

For the current manual MEGA workflow, download the `.age` file and its `.sha256`
sidecar into a new temporary folder. Keep the passphrase out of MEGA and out of
the command line. Verify the checksum, then decrypt to a temporary archive:

```powershell
$encrypted = "C:\Temp\cbc-mega-restore\journal-YYYY-MM-DD_HH-mm-ss.archive.gz.age"
$decrypted = Join-Path $env:TEMP "cbc-journal-restore-$([guid]::NewGuid().ToString('N')).archive.gz"
$expected = (Get-Content -LiteralPath "$encrypted.sha256").Split()[0]
$actual = (Get-FileHash -LiteralPath $encrypted -Algorithm SHA256).Hash
if ($actual -ne $expected) { throw "Encrypted backup checksum mismatch." }
& age.exe --decrypt --passphrase --output $decrypted $encrypted
if ($LASTEXITCODE -ne 0) { throw "age decryption failed." }
```

Restore `$decrypted` with `mongorestore --gzip --nsFrom="journal.*"` and
`--nsTo="journal_restore_<unique-id>.*"`, compare counts, IDs, canonical BSON
digests, and indexes with the live database, then drop only that exact temporary
database. Remove the temporary decrypted archive and download folder afterward.
Never place the passphrase or decrypted archive in MEGA.

## Stability and recovery drill (2026-09-17)

The first non-destructive recovery drill was completed on 2026-09-17 (Asia/Singapore). No Windows restart, scheduled-task change, service change, or live-database restore was performed.

### Read-only preflight

- `Get-Service MongoDB` reported `Running` with `Automatic` startup.
- The live server responded at `mongodb://127.0.0.1:27017`; the `journal` database contained 21 users, 358 journal entries, 371 journal versions, 1,096 reading-plan days, and 0 reading completions (1,846 total documents).
- The latest existing automatic archive, `journal-2026-09-17_02-00-02.archive.gz`, was rehashed. Its SHA-256 matched its `.sha256` sidecar: `535DC1F1203C8045A08A3833E3FA45125A458C82B91F911D835084F146E608CC`.
- `Get-ScheduledTask` and `Get-ScheduledTaskInfo` for `Journal MongoDB Backup` returned `Access denied` from the non-elevated shell. Existing task configuration in this document was not changed; an elevated inspection remains pending.

### Fresh archive and restore

The existing script was run unchanged:

```powershell
& "C:\Users\zerep\OneDrive\Desktop\PROJECTS\journal-backend\scripts\backupMongo.ps1"
```

It created:

```text
C:\Users\zerep\MongoBackups\Journal\journal-2026-09-17_03-03-15.archive.gz
```

The archive is 195,032 bytes. Its SHA-256 is `14635A1EBDEE36505280D84E3CFE08B4FC0AC802A71CD0D794B0B2715DBC0AB8`, and the sidecar contains the same hash.

Before restoring, an administrative database listing confirmed that the uniquely named target `journal_restore_drill_20260917_030315` did not exist. The archive was restored with namespace remapping and without `--drop`:

```powershell
& "C:\Program Files\MongoDB\Tools\100\bin\mongorestore.exe" `
  "--uri=mongodb://127.0.0.1:27017" `
  "--archive=C:\Users\zerep\MongoBackups\Journal\journal-2026-09-17_03-03-15.archive.gz" `
  --gzip `
  "--nsFrom=journal.*" `
  "--nsTo=journal_restore_drill_20260917_030315.*"
```

`mongorestore` reported 1,846 documents restored successfully and 0 failures. It also restored the collection indexes from archive metadata. Counts, sorted `_id` sets, and canonical BSON SHA-256 digests matched between `journal` and the temporary database:

| Collection | Live | Drill | Digest match |
| --- | ---: | ---: | :---: |
| `users` | 21 | 21 | Yes |
| `journalentries` | 358 | 358 | Yes |
| `journalversions` | 371 | 371 | Yes |
| `readingplandays` | 1,096 | 1,096 | Yes |
| `readingcompletions` | 0 | 0 | Yes |
| **Total** | **1,846** | **1,846** | **Yes** |

After verification, only the exact temporary database was dropped. A final database listing confirmed `journal_restore_drill_20260917_030315` no longer exists and `journal` still exists. The live counts remained unchanged.

### Findings and remaining limits

- The backup script, archive, checksum sidecar, namespace remapping, and restore path passed this drill.
- A normal local backup and isolated restore passed. The manual MEGA encrypted upload, checksum verification, decryption, and isolated restore also passed. The OneDrive public-key automation remains deferred.
- Scheduled-task state needs an elevated read-only inspection.
- The backup drill itself did not exercise service recovery, but the separate controlled Windows restart test passed later on 2026-09-17.

## Compass

Connect Compass to:

```text
mongodb://127.0.0.1:27017
```

The working database should appear as `journal`. The old temporary `test` database on port `27018` is no longer part of the setup.
