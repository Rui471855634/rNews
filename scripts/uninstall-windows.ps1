# ============================================================
# rNews Scheduler - Windows Auto-Start Uninstaller
# Removes the Task Scheduler task
# Run as: powershell -ExecutionPolicy Bypass -File scripts\uninstall-windows.ps1
# ============================================================

$TaskName = "rNews Scheduler"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "🗑️  Uninstalling rNews Scheduler for Windows..."

$Task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($Task) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "✅ Scheduled task removed."
} else {
    Write-Host "ℹ️  Task not found (not installed)."
}

# Clean up wrapper script
$WrapperScript = Join-Path $ScriptDir "start-scheduler.bat"
if (Test-Path $WrapperScript) {
    Remove-Item $WrapperScript
    Write-Host "✅ Wrapper script removed."
}

Write-Host ""
Write-Host "Note: Log files in ./logs/ are preserved. Delete them manually if desired."
