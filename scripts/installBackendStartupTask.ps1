#Requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$taskName = "Journal Backend"
$backendRoot = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot "runBackend.ps1"
$powerShellExe = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"

if (-not (Test-Path -LiteralPath $runner -PathType Leaf)) {
    throw "Backend runner was not found at $runner"
}

$action = New-ScheduledTaskAction `
    -Execute $powerShellExe `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`"" `
    -WorkingDirectory $backendRoot

$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

$settings = New-ScheduledTaskSettingsSet `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -RestartCount 10 `
    -RestartInterval (New-TimeSpan -Minutes 1) `
    -ExecutionTimeLimit (New-TimeSpan -Seconds 0) `
    -MultipleInstances IgnoreNew

Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Starts the CBC Journal Node.js backend at Windows startup." `
    -Force | Out-Null

Write-Host "Registered scheduled task: $taskName"
Write-Host "The task is not started automatically by this installer."
