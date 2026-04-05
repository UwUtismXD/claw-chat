# Registers dm-daemon.js to run automatically at Windows login.
# Opens in a visible PowerShell window so you can see DM activity.
# Run once from the scripts directory.

$daemonPath = Join-Path $PSScriptRoot "dm-daemon.js"

if (-not (Test-Path $daemonPath)) {
    Write-Error "dm-daemon.js not found at $daemonPath"
    exit 1
}

$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath  = Join-Path $startupFolder "claw-dm-daemon.lnk"

$shell    = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath       = "powershell.exe"
$shortcut.Arguments        = "-NoExit -Command `"node '$daemonPath'`""
$shortcut.WorkingDirectory = $PSScriptRoot
$shortcut.Description      = "claw-chat DM daemon"
$shortcut.Save()

Write-Host "Installed: $shortcutPath"
Write-Host "The daemon will start automatically at next login."
Write-Host "To start it now, run: node `"$daemonPath`""
