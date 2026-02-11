# ============================================================
# rNews Scheduler - Windows Auto-Start Installer
# Creates a Task Scheduler task that starts the scheduler on logon
# Run as: powershell -ExecutionPolicy Bypass -File scripts\install-windows.ps1
# ============================================================

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
$TaskName = "rNews Scheduler"
$LogDir = Join-Path $ProjectDir "logs"

Write-Host "📦 Installing rNews Scheduler for Windows..."
Write-Host "   Project: $ProjectDir"
Write-Host ""

# Ensure dependencies are installed
if (-not (Test-Path (Join-Path $ProjectDir "node_modules"))) {
    Write-Host "📥 Installing npm dependencies..."
    Push-Location $ProjectDir
    npm install
    Pop-Location
}

# Create log directory
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# Verify Node.js is available
$NodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $NodePath) {
    Write-Host "❌ Node.js not found. Please install Node.js >= 20."
    Write-Host "   Download: https://nodejs.org/"
    exit 1
}

$NpxPath = (Get-Command npx -ErrorAction SilentlyContinue).Source
Write-Host "   Node: $NodePath"
Write-Host "   Logs: $LogDir"
Write-Host ""

# Create a wrapper batch script for Task Scheduler
$WrapperScript = Join-Path $ScriptDir "start-scheduler.bat"
@"
@echo off
cd /d "$ProjectDir"
npx tsx src/index.ts start >> "$LogDir\scheduler.log" 2>> "$LogDir\scheduler-error.log"
"@ | Out-File -FilePath $WrapperScript -Encoding ASCII

# Remove existing task if it exists
Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false -ErrorAction SilentlyContinue

# Create the scheduled task
$Action = New-ScheduledTaskAction -Execute $WrapperScript -WorkingDirectory $ProjectDir
$Trigger = New-ScheduledTaskTrigger -AtLogon
$Settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -StartWhenAvailable `
    -RestartCount 3 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $Action `
    -Trigger $Trigger `
    -Settings $Settings `
    -Description "rNews - Personal news aggregation scheduler" | Out-Null

# Start the task immediately
Start-ScheduledTask -TaskName $TaskName

Write-Host "✅ rNews Scheduler installed and started!"
Write-Host ""
Write-Host "--- Useful Commands -----------------------------------------------"
Write-Host "  Status:     Get-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Start:      Start-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Stop:       Stop-ScheduledTask -TaskName '$TaskName'"
Write-Host "  Uninstall:  powershell -File $ScriptDir\uninstall-windows.ps1"
Write-Host "  View logs:  Get-Content -Tail 50 -Wait '$LogDir\scheduler.log'"
Write-Host "-------------------------------------------------------------------"
