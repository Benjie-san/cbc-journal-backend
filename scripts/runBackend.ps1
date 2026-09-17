$ErrorActionPreference = "Stop"

$backendRoot = Split-Path -Parent $PSScriptRoot
$nodeExe = "C:\Program Files\nodejs\node.exe"
$entryPoint = Join-Path $backendRoot "src\index.js"
$logDirectory = "C:\ProgramData\CBCJournal\logs"
$logFile = Join-Path $logDirectory ("backend-{0}.log" -f (Get-Date -Format "yyyy-MM-dd"))

if (-not (Test-Path -LiteralPath $nodeExe -PathType Leaf)) {
    throw "Node.js was not found at $nodeExe"
}

New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
Set-Location -LiteralPath $backendRoot
$env:NO_COLOR = "1"
Remove-Item Env:FORCE_COLOR -ErrorAction SilentlyContinue

while ($true) {
    "[{0}] Starting journal backend" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss") |
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
