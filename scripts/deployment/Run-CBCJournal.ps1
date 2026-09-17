$ErrorActionPreference = "Stop"

$baseDirectory = "C:\ProgramData\CBCJournal"
$releaseRoot = Join-Path $baseDirectory "releases"
$pointerFile = Join-Path $baseDirectory "current-release.txt"
$environmentFile = Join-Path $baseDirectory "config\backend.env"
$serviceAccountFile = Join-Path $baseDirectory "config\firebase-service-account.json"
$logDirectory = Join-Path $baseDirectory "logs"
$nodeExe = "C:\Program Files\nodejs\node.exe"

function Get-CurrentReleasePath {
    if (-not (Test-Path -LiteralPath $pointerFile -PathType Leaf)) {
        throw "No deployed release is selected. Run cbcjournal-deploy from an elevated terminal."
    }

    $releaseName = (Get-Content -LiteralPath $pointerFile -Raw).Trim()
    if ($releaseName -notmatch '^[0-9]{8}-[0-9]{6}-[0-9a-f]{7,40}$') {
        throw "The deployment pointer contains an invalid release name."
    }

    $rootPath = [IO.Path]::GetFullPath($releaseRoot).TrimEnd('\') + '\'
    $releasePath = [IO.Path]::GetFullPath((Join-Path $releaseRoot $releaseName))
    if (-not $releasePath.StartsWith($rootPath, [StringComparison]::OrdinalIgnoreCase)) {
        throw "The deployment pointer resolves outside the release directory."
    }
    if (-not (Test-Path -LiteralPath (Join-Path $releasePath "src\index.js") -PathType Leaf)) {
        throw "The selected release is incomplete: $releaseName"
    }

    return $releasePath
}

foreach ($requiredFile in @($nodeExe, $environmentFile, $serviceAccountFile)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required production file is missing: $requiredFile"
    }
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$env:NODE_ENV = "production"
$env:NO_COLOR = "1"
$env:DOTENV_CONFIG_PATH = $environmentFile
$env:FIREBASE_SERVICE_ACCOUNT_PATH = $serviceAccountFile
Remove-Item Env:FORCE_COLOR -ErrorAction SilentlyContinue

while ($true) {
    $releasePath = Get-CurrentReleasePath
    $entryPoint = Join-Path $releasePath "src\index.js"
    $logFile = Join-Path $logDirectory ("backend-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))
    Set-Location -LiteralPath $releasePath

    "[{0}] Starting journal backend release {1}" -f `
        (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), (Split-Path $releasePath -Leaf) |
        Out-File -LiteralPath $logFile -Append -Encoding utf8

    & $nodeExe $entryPoint 2>&1 | ForEach-Object {
        $_ | Out-File -LiteralPath $logFile -Append -Encoding utf8
    }

    $nodeExitCode = $LASTEXITCODE
    "[{0}] Journal backend exited with code {1}; restarting in 10 seconds" -f `
        (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $nodeExitCode |
        Out-File -LiteralPath $logFile -Append -Encoding utf8
    Start-Sleep -Seconds 10
}
