[CmdletBinding()]
param(
    [string]$MongoUri = "mongodb://127.0.0.1:27017",
    [string]$Database = "journal",
    [string]$BackupDirectory = "",
    [string]$OffsiteDirectory = "",
    [string]$OneDriveRoot = "",
    [string]$MongoDumpPath = "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe",
    [string]$AgePath = "age.exe",
    [string]$RecipientFile = "C:\ProgramData\CBCJournal\backup-age-recipient.txt"
)

$ErrorActionPreference = "Stop"

if ($Database -notmatch '^[A-Za-z0-9_-]+$') {
    throw "Database must contain only letters, numbers, underscores, or hyphens."
}

function Resolve-ExistingFile([string]$Path, [string]$Description) {
    if ([System.IO.Path]::IsPathRooted($Path)) {
        if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
            throw "$Description was not found at: $Path"
        }
        return [System.IO.Path]::GetFullPath($Path)
    }

    $command = Get-Command $Path -CommandType Application -ErrorAction SilentlyContinue
    if ($null -eq $command) {
        throw "$Description was not found on PATH: $Path"
    }
    return $command.Source
}

function Test-PathWithin([string]$Child, [string]$Parent) {
    $childFull = ([System.IO.Path]::GetFullPath($Child)).TrimEnd('\')
    $parentFull = ([System.IO.Path]::GetFullPath($Parent)).TrimEnd('\')
    return $childFull.Equals($parentFull, [System.StringComparison]::OrdinalIgnoreCase) -or
        $childFull.StartsWith("$parentFull\", [System.StringComparison]::OrdinalIgnoreCase)
}

if ([string]::IsNullOrWhiteSpace($BackupDirectory)) {
    $BackupDirectory = Join-Path $env:USERPROFILE "MongoBackups\Journal"
}
if ([string]::IsNullOrWhiteSpace($OneDriveRoot)) {
    $OneDriveRoot = $env:OneDrive
}
if ([string]::IsNullOrWhiteSpace($OneDriveRoot)) {
    throw "OneDrive is not configured. Supply -OneDriveRoot explicitly."
}
if ([string]::IsNullOrWhiteSpace($OffsiteDirectory)) {
    $OffsiteDirectory = Join-Path $OneDriveRoot "CBCJournal\EncryptedBackups"
}

$mongoDump = Resolve-ExistingFile $MongoDumpPath "mongodump"
$age = Resolve-ExistingFile $AgePath "age"
$recipientPath = Resolve-ExistingFile $RecipientFile "age recipient file"
$resolvedBackupDirectory = ([System.IO.Path]::GetFullPath($BackupDirectory)).TrimEnd('\')
$resolvedOffsiteDirectory = ([System.IO.Path]::GetFullPath($OffsiteDirectory)).TrimEnd('\')

$resolvedOneDrive = ([System.IO.Path]::GetFullPath($OneDriveRoot)).TrimEnd('\')
if (-not (Test-PathWithin $resolvedOffsiteDirectory $resolvedOneDrive)) {
    throw "OffsiteDirectory must be inside OneDrive. Plaintext must never be written to a synced destination."
}
if ((Test-PathWithin $resolvedBackupDirectory $resolvedOffsiteDirectory) -or
    (Test-PathWithin $resolvedOffsiteDirectory $resolvedBackupDirectory)) {
    throw "BackupDirectory and OffsiteDirectory must be separate; refusing an unsafe layout."
}

$recipient = (Get-Content -LiteralPath $recipientPath -Raw).Trim()
if ($recipient -notmatch '^age1[a-z0-9]{10,}$') {
    throw "RecipientFile must contain one age public recipient beginning with age1; passphrases and private keys are not accepted."
}

# Create directories only after all destination safety checks have passed.
New-Item -ItemType Directory -Path $resolvedBackupDirectory -Force | Out-Null
New-Item -ItemType Directory -Path $resolvedOffsiteDirectory -Force | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$archiveName = "$Database-$timestamp.archive.gz"
$archivePath = Join-Path $resolvedBackupDirectory $archiveName
$archiveChecksumPath = "$archivePath.sha256"
$encryptedName = "$archiveName.age"
$stagingPath = Join-Path $resolvedBackupDirectory ".${encryptedName}.$([guid]::NewGuid().ToString('N')).tmp"
$offsiteEncryptedPath = Join-Path $resolvedOffsiteDirectory $encryptedName
$offsiteChecksumPath = "$offsiteEncryptedPath.sha256"
$historyPath = Join-Path $resolvedBackupDirectory "encrypted-backup-history.log"
$offsiteFileCreated = $false

if (Test-Path -LiteralPath $archivePath -PathType Any) {
    throw "Refusing to overwrite existing local backup: $archivePath"
}
if (Test-Path -LiteralPath $archiveChecksumPath -PathType Any) {
    throw "Refusing to overwrite existing local checksum: $archiveChecksumPath"
}

try {
    & $mongoDump `
        "--uri=$MongoUri" `
        "--db=$Database" `
        "--archive=$archivePath" `
        --gzip 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "mongodump exited with code $LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) { throw "mongodump did not create the expected archive." }
    if ((Get-Item -LiteralPath $archivePath).Length -eq 0) { throw "mongodump created an empty archive." }

    $archiveHash = (Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash
    "$archiveHash  $archiveName" | Set-Content -LiteralPath $archiveChecksumPath -Encoding ascii

    # Encrypt into a local, non-OneDrive staging path. Only the resulting .age file is copied off-host.
    & $age --encrypt --recipient $recipient --output $stagingPath $archivePath 2>$null
    if ($LASTEXITCODE -ne 0) { throw "age encryption failed with code $LASTEXITCODE" }
    if (-not (Test-Path -LiteralPath $stagingPath -PathType Leaf)) { throw "age did not create the encrypted archive." }
    if ((Get-Item -LiteralPath $stagingPath).Length -eq 0) { throw "age created an empty encrypted archive." }

    if (Test-Path -LiteralPath $offsiteEncryptedPath -PathType Any) {
        throw "Refusing to overwrite existing off-site backup: $offsiteEncryptedPath"
    }
    if (Test-Path -LiteralPath $offsiteChecksumPath -PathType Any) {
        throw "Refusing to overwrite existing off-site checksum: $offsiteChecksumPath"
    }

    [System.IO.File]::Copy($stagingPath, $offsiteEncryptedPath, $false)
    $offsiteFileCreated = $true
    $encryptedHash = (Get-FileHash -LiteralPath $stagingPath -Algorithm SHA256).Hash
    "$encryptedHash  $encryptedName" | Set-Content -LiteralPath $offsiteChecksumPath -Encoding ascii -NoNewline
    $copiedHash = (Get-FileHash -LiteralPath $offsiteEncryptedPath -Algorithm SHA256).Hash
    if ($copiedHash -ne $encryptedHash) { throw "Encrypted off-site copy failed checksum verification." }

    "$(Get-Date -Format o) SUCCESS database=$Database archive=$archiveName encrypted=$offsiteEncryptedPath bytes=$((Get-Item -LiteralPath $offsiteEncryptedPath).Length) sha256=$encryptedHash" |
        Tee-Object -FilePath $historyPath -Append
}
catch {
    if (Test-Path -LiteralPath $stagingPath -PathType Leaf) { Remove-Item -LiteralPath $stagingPath -Force }
    if ($offsiteFileCreated -and (Test-Path -LiteralPath $offsiteEncryptedPath -PathType Leaf)) { Remove-Item -LiteralPath $offsiteEncryptedPath -Force }
    if ($offsiteFileCreated -and (Test-Path -LiteralPath $offsiteChecksumPath -PathType Leaf)) { Remove-Item -LiteralPath $offsiteChecksumPath -Force }
    "$(Get-Date -Format o) FAILURE database=$Database message=$($_.Exception.Message)" |
        Tee-Object -FilePath $historyPath -Append
    throw
}
finally {
    if (Test-Path -LiteralPath $stagingPath -PathType Leaf) { Remove-Item -LiteralPath $stagingPath -Force }
}
