@echo off
REM rNews startup script for Windows
REM Auto-detects Node.js version

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Please install Node.js ^>= 20.
    echo         Download: https://nodejs.org/
    exit /b 1
)

for /f "tokens=1 delims=v." %%a in ('node -v') do set NODE_MAJOR=%%a
if %NODE_MAJOR% LSS 20 (
    echo [ERROR] Node.js ^>= 20 required. Current version:
    node -v
    exit /b 1
)

node -v
npx tsx src/index.ts %*
