@echo off
setlocal

cd /d "C:\GitHub\Adncoder.github.io"

echo.
echo ========================================
echo   ANDREW WEBSITE - PREVIEW
echo ========================================
echo.

echo [1/2] Syncing publishable Obsidian writing...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-writing.ps1"

if errorlevel 1 (
    echo.
    echo ERROR: Writing sync failed.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting Quartz preview...
echo.
echo Open:
echo http://localhost:8080
echo.
echo Press Ctrl+C when you are finished previewing.
echo.

call npx quartz build --serve