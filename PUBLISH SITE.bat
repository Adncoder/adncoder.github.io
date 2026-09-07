@echo off
setlocal

cd /d "%~dp0"

echo.
echo ========================================
echo   ANDREW WEBSITE - PUBLISH
echo ========================================
echo.

echo [1/3] Syncing publishable Obsidian writing...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\publish-writing.ps1" -RepoRoot "%CD%"

if errorlevel 1 (
    echo.
    echo ERROR: Writing sync failed.
    pause
    exit /b 1
)

echo.
echo [2/3] Verifying Quartz build...
call npx quartz build

if errorlevel 1 (
    echo.
    echo ERROR: Quartz build failed.
    echo Nothing has been pushed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   CHANGES ABOUT TO BECOME PUBLIC
echo ========================================
echo.

git status --short
if errorlevel 1 goto publish_failed


echo.
echo Review ALL files above carefully, including any unrelated site edits.
echo.
echo Nothing has been published yet.
echo.

set /p CONFIRM=Type PUBLISH to push these changes to the public website:

if /I not "%CONFIRM%"=="PUBLISH" (
    echo.
    echo Publication cancelled.
    echo No changes were pushed.
    pause
    exit /b 0
)

echo.
echo [3/3] Publishing reviewed changes to GitHub...
git add --all
if errorlevel 1 goto publish_failed

git diff --cached --quiet
if errorlevel 1 (
    git commit -m "Update website writing and design"
    if errorlevel 1 goto publish_failed
)

rem Use a normal push: remote changes must never be overwritten automatically.
git push origin HEAD

if errorlevel 1 (
    echo.
    echo ERROR: GitHub sync failed.
    pause
    exit /b 1
)

echo.
echo ========================================
echo   PUSH COMPLETE
echo ========================================
echo.
echo GitHub Actions will now build the site.
echo Website:
echo https://adncoder.github.io
echo.

pause
exit /b 0

:publish_failed
echo ERROR: Preparing the website commit failed. Nothing was pushed.
pause
exit /b 1
