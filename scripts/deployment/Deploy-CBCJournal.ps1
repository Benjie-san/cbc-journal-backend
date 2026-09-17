#Requires -RunAsAdministrator

param(
    [string]$RepositoryPath,
    [switch]$SkipPublicHealthCheck
)

$ErrorActionPreference = "Stop"
$baseDirectory = "C:\ProgramData\CBCJournal"
$releaseRoot = Join-Path $baseDirectory "releases"
$pointerFile = Join-Path $baseDirectory "current-release.txt"
$repositoryPathFile = Join-Path $baseDirectory "config\repository-path.txt"
$taskName = "Journal Backend"
$archivePath = $null
$stagingPath = $null
$previousRelease = $null
$pointerChanged = $false

function Invoke-CheckedCommand {
    param([string]$FilePath, [string[]]$ArgumentList)
    & $FilePath @ArgumentList
    if ($LASTEXITCODE -ne 0) {
        throw "$FilePath failed with exit code $LASTEXITCODE"
    }
}

function Assert-ReleaseChildPath {
    param([string]$CandidatePath)
    $rootPath = [IO.Path]::GetFullPath($releaseRoot).TrimEnd('\') + '\'
    $fullPath = [IO.Path]::GetFullPath($CandidatePath)
    if (-not $fullPath.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "Unsafe release path: $fullPath"
    }
}

function Set-ReleasePointer {
    param([string]$ReleaseName)
    $temporaryPointer = Join-Path $baseDirectory ("current-release.{0}.tmp" -f [Guid]::NewGuid().ToString("N"))
    [IO.File]::WriteAllText($temporaryPointer, "$ReleaseName`r`n", [Text.UTF8Encoding]::new($false))
    if (Test-Path -LiteralPath $pointerFile) {
        [IO.File]::Replace($temporaryPointer, $pointerFile, $null)
    } else {
        Move-Item -LiteralPath $temporaryPointer -Destination $pointerFile
    }
}

function Wait-ForEndpoint {
    param([string]$Uri, [int]$Attempts = 12, [int]$DelaySeconds = 5)
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 10
            if ($response.StatusCode -eq 200) { return $true }
        } catch {
            if ($attempt -eq $Attempts) { return $false }
        }
        Start-Sleep -Seconds $DelaySeconds
    }
    return $false
}

function Stop-BackendTask {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
    if ($task.State -eq "Running") {
        Stop-ScheduledTask -TaskName $taskName
        for ($attempt = 1; $attempt -le 20; $attempt++) {
            if ((Get-ScheduledTask -TaskName $taskName).State -ne "Running") { return }
            Start-Sleep -Milliseconds 500
        }
        throw "The backend task did not stop in time."
    }
}

try {
    if (-not $RepositoryPath) {
        if (-not (Test-Path -LiteralPath $repositoryPathFile -PathType Leaf)) {
            throw "Repository path configuration is missing: $repositoryPathFile"
        }
        $RepositoryPath = (Get-Content -LiteralPath $repositoryPathFile -Raw).Trim()
    }
    $RepositoryPath = (Resolve-Path -LiteralPath $RepositoryPath).Path

    $branch = (& git -C $RepositoryPath branch --show-current).Trim()
    if ($LASTEXITCODE -ne 0 -or $branch -ne "main") {
        throw "Deployment requires the repository to be on the main branch. Current branch: $branch"
    }
    $status = (& git -C $RepositoryPath status --porcelain)
    if ($LASTEXITCODE -ne 0 -or $status) {
        throw "Deployment requires a clean working tree."
    }

    Write-Host "Running backend tests for the exact main commit..."
    Push-Location $RepositoryPath
    try {
        Invoke-CheckedCommand -FilePath "npm.cmd" -ArgumentList @("test")
        Invoke-CheckedCommand -FilePath "git.exe" -ArgumentList @("diff", "--check")
    } finally {
        Pop-Location
    }

    $commit = (& git -C $RepositoryPath rev-parse HEAD).Trim()
    if ($LASTEXITCODE -ne 0 -or $commit -notmatch '^[0-9a-f]{40}$') {
        throw "Unable to resolve the deployment commit."
    }
    $releaseName = "{0}-{1}" -f (Get-Date -Format "yyyyMMdd-HHmmss"), $commit.Substring(0, 12)
    $stagingPath = Join-Path $releaseRoot (".staging-" + $releaseName)
    $releasePath = Join-Path $releaseRoot $releaseName
    Assert-ReleaseChildPath $stagingPath
    Assert-ReleaseChildPath $releasePath
    if ((Test-Path -LiteralPath $stagingPath) -or (Test-Path -LiteralPath $releasePath)) {
        throw "Release path already exists: $releaseName"
    }

    New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
    New-Item -ItemType Directory -Path $stagingPath | Out-Null
    $archivePath = Join-Path $baseDirectory ("deploy-{0}.zip" -f [Guid]::NewGuid().ToString("N"))
    Invoke-CheckedCommand -FilePath "git.exe" -ArgumentList @(
        "-C", $RepositoryPath, "archive", "--format=zip", "--output=$archivePath",
        $commit, "--", "package.json", "package-lock.json", "src"
    )
    Expand-Archive -LiteralPath $archivePath -DestinationPath $stagingPath
    Remove-Item -LiteralPath $archivePath -Force
    $archivePath = $null

    Write-Host "Installing production dependencies into isolated release $releaseName..."
    Push-Location $stagingPath
    try {
        Invoke-CheckedCommand -FilePath "npm.cmd" -ArgumentList @("ci", "--omit=dev", "--no-audit", "--no-fund")
    } finally {
        Pop-Location
    }
    Move-Item -LiteralPath $stagingPath -Destination $releasePath
    $stagingPath = $null

    if (Test-Path -LiteralPath $pointerFile -PathType Leaf) {
        $previousRelease = (Get-Content -LiteralPath $pointerFile -Raw).Trim()
    }
    Stop-BackendTask
    Set-ReleasePointer $releaseName
    $pointerChanged = $true
    Start-ScheduledTask -TaskName $taskName

    if (-not (Wait-ForEndpoint "http://127.0.0.1:4000/health")) {
        throw "The new release failed its local health check."
    }
    if (-not (Wait-ForEndpoint "http://127.0.0.1:4000/ready")) {
        throw "The new release failed its local readiness check."
    }

    if (-not $SkipPublicHealthCheck) {
        if (-not (Wait-ForEndpoint "https://api.cbcjournal.cc/health" -Attempts 6 -DelaySeconds 5)) {
            Write-Warning "Local checks passed, but the public health check failed. The release remains active; inspect Cloudflare Tunnel."
        }
    }

    Write-Host "Deployment succeeded: $releaseName"
    Write-Host "Previous releases were retained for manual rollback."
} catch {
    $deploymentError = $_
    if ($pointerChanged) {
        Write-Warning "Deployment failed after activation; restoring the previous release pointer."
        try {
            Stop-BackendTask
            if ($previousRelease) {
                Set-ReleasePointer $previousRelease
                Start-ScheduledTask -TaskName $taskName
            } elseif (Test-Path -LiteralPath $pointerFile) {
                Remove-Item -LiteralPath $pointerFile -Force
            }
        } catch {
            Write-Warning "Automatic rollback also failed; inspect the scheduled task and release pointer."
        }
    }
    throw $deploymentError
} finally {
    if ($archivePath -and (Test-Path -LiteralPath $archivePath)) {
        Remove-Item -LiteralPath $archivePath -Force
    }
    if ($stagingPath -and (Test-Path -LiteralPath $stagingPath)) {
        Assert-ReleaseChildPath $stagingPath
        if ((Split-Path $stagingPath -Leaf) -like ".staging-*") {
            Remove-Item -LiteralPath $stagingPath -Recurse -Force
        }
    }
}
