#Requires -RunAsAdministrator

param(
    [string]$RepositoryPath = (Split-Path -Parent (Split-Path -Parent $PSScriptRoot)),
    [switch]$UpdateCredentials
)

$ErrorActionPreference = "Stop"
$RepositoryPath = (Resolve-Path -LiteralPath $RepositoryPath).Path
$baseDirectory = "C:\ProgramData\CBCJournal"
$binDirectory = Join-Path $baseDirectory "bin"
$configDirectory = Join-Path $baseDirectory "config"
$releaseDirectory = Join-Path $baseDirectory "releases"
$logDirectory = Join-Path $baseDirectory "logs"
$sourceDirectory = $PSScriptRoot
$environmentSource = Join-Path $RepositoryPath ".env"
$serviceAccountSource = Join-Path $RepositoryPath "firebase-service-account.json"
$environmentTarget = Join-Path $configDirectory "backend.env"
$serviceAccountTarget = Join-Path $configDirectory "firebase-service-account.json"
$repositoryPathTarget = Join-Path $configDirectory "repository-path.txt"
$taskName = "Journal Backend"

foreach ($requiredFile in @(
    $environmentSource,
    $serviceAccountSource,
    (Join-Path $sourceDirectory "Deploy-CBCJournal.ps1"),
    (Join-Path $sourceDirectory "Run-CBCJournal.ps1"),
    (Join-Path $sourceDirectory "cbcjournal-deploy.cmd")
)) {
    if (-not (Test-Path -LiteralPath $requiredFile -PathType Leaf)) {
        throw "Required installation file is missing: $requiredFile"
    }
}

foreach ($directory in @($baseDirectory, $binDirectory, $configDirectory, $releaseDirectory, $logDirectory)) {
    New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetAccessRuleProtection($true, $false)
$inheritance = [Security.AccessControl.InheritanceFlags]"ContainerInherit, ObjectInherit"
$propagation = [Security.AccessControl.PropagationFlags]::None
$fullControl = [Security.AccessControl.FileSystemRights]::FullControl
foreach ($sidValue in @("S-1-5-18", "S-1-5-32-544", [Security.Principal.WindowsIdentity]::GetCurrent().User.Value)) {
    $sid = [Security.Principal.SecurityIdentifier]::new($sidValue)
    $rule = [Security.AccessControl.FileSystemAccessRule]::new(
        $sid, $fullControl, $inheritance, $propagation, "Allow"
    )
    $acl.AddAccessRule($rule)
}
Set-Acl -LiteralPath $configDirectory -AclObject $acl

Copy-Item -LiteralPath (Join-Path $sourceDirectory "Deploy-CBCJournal.ps1") -Destination $binDirectory -Force
Copy-Item -LiteralPath (Join-Path $sourceDirectory "Run-CBCJournal.ps1") -Destination $binDirectory -Force
Copy-Item -LiteralPath (Join-Path $sourceDirectory "cbcjournal-deploy.cmd") -Destination $binDirectory -Force

if ($UpdateCredentials -or -not (Test-Path -LiteralPath $environmentTarget)) {
    Copy-Item -LiteralPath $environmentSource -Destination $environmentTarget -Force
}
if ($UpdateCredentials -or -not (Test-Path -LiteralPath $serviceAccountTarget)) {
    Copy-Item -LiteralPath $serviceAccountSource -Destination $serviceAccountTarget -Force
}
[IO.File]::WriteAllText($repositoryPathTarget, "$RepositoryPath`r`n", [Text.UTF8Encoding]::new($false))

$machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
$pathEntries = @($machinePath -split ';' | Where-Object { $_ })
if (-not ($pathEntries | Where-Object { $_.TrimEnd('\') -ieq $binDirectory.TrimEnd('\') })) {
    [Environment]::SetEnvironmentVariable("Path", (($pathEntries + $binDirectory) -join ';'), "Machine")
}

$powerShellExe = "C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe"
$runner = Join-Path $binDirectory "Run-CBCJournal.ps1"
$action = New-ScheduledTaskAction `
    -Execute $powerShellExe `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$runner`"" `
    -WorkingDirectory $baseDirectory
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
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
    -Description "Runs the active CBC Journal backend release at Windows startup." `
    -Force | Out-Null

Write-Host "Installed CBC Journal deployment tooling in $baseDirectory"
Write-Host "Credentials were copied without displaying their contents."
Write-Host "Open a new elevated terminal, switch the repository to main, then run: cbcjournal-deploy"
