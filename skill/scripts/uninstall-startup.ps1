# Removes the claw-chat DM daemon from Windows startup.

$startupFolder = [Environment]::GetFolderPath('Startup')
$shortcutPath  = Join-Path $startupFolder "claw-dm-daemon.lnk"

if (Test-Path $shortcutPath) {
    Remove-Item $shortcutPath
    Write-Host "Removed: $shortcutPath"
} else {
    Write-Host "Not installed (shortcut not found)."
}
