[CmdletBinding()]
param(
    [string]$MongoUri = "mongodb://127.0.0.1:27017",
    [string]$Database = "journal",
    [string]$BackupDirectory = "",
    [string]$MongoDumpPath = "C:\Program Files\MongoDB\Tools\100\bin\mongodump.exe"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($BackupDirectory)) {
    $BackupDirectory = Join-Path $env:USERPROFILE "MongoBackups\Journal"
}

$resolvedBackupDirectory = [System.IO.Path]::GetFullPath($BackupDirectory)

if (-not (Test-Path -LiteralPath $MongoDumpPath -PathType Leaf)) {
    throw "mongodump was not found at: $MongoDumpPath"
}

New-Item -ItemType Directory -Path $resolvedBackupDirectory -Force | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$archivePath = Join-Path $resolvedBackupDirectory "$Database-$timestamp.archive.gz"
$checksumPath = "$archivePath.sha256"
$historyPath = Join-Path $resolvedBackupDirectory "backup-history.log"

try {
    & $MongoDumpPath `
        "--uri=$MongoUri" `
        "--db=$Database" `
        "--archive=$archivePath" `
        --gzip

    if ($LASTEXITCODE -ne 0) {
        throw "mongodump exited with code $LASTEXITCODE"
    }

    if (-not (Test-Path -LiteralPath $archivePath -PathType Leaf)) {
        throw "mongodump did not create the expected archive."
    }

    $archive = Get-Item -LiteralPath $archivePath
    if ($archive.Length -eq 0) {
        throw "mongodump created an empty archive."
    }

    $hash = Get-FileHash -LiteralPath $archivePath -Algorithm SHA256
    "$($hash.Hash)  $($archive.Name)" | Set-Content -LiteralPath $checksumPath -Encoding ascii

    $successMessage = "$(Get-Date -Format o) SUCCESS database=$Database archive=$archivePath bytes=$($archive.Length) sha256=$($hash.Hash)"
    $successMessage | Tee-Object -FilePath $historyPath -Append
} catch {
    if (Test-Path -LiteralPath $archivePath) {
        Remove-Item -LiteralPath $archivePath -Force
    }
    if (Test-Path -LiteralPath $checksumPath) {
        Remove-Item -LiteralPath $checksumPath -Force
    }

    $failureMessage = "$(Get-Date -Format o) FAILURE database=$Database message=$($_.Exception.Message)"
    $failureMessage | Tee-Object -FilePath $historyPath -Append
    throw
}
