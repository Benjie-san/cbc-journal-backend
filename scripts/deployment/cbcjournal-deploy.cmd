@echo off
"C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "C:\ProgramData\CBCJournal\bin\Deploy-CBCJournal.ps1" %*
exit /b %ERRORLEVEL%
