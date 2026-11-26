@echo off
setlocal EnableExtensions
cd /d "%~dp0"

echo.
echo === Sign in to GitHub first ===
where gh >nul 2>&1
if not errorlevel 1 goto :github_cli_login

rem Git Credential Manager ships with current Git for Windows and does not need gh.
git credential-manager github login
if errorlevel 1 (
  set "FAIL_REASON=GitHub sign-in failed. Install or update Git for Windows (which includes Git Credential Manager), then rerun this script."
  goto :failed
)
goto :supabase_check

:github_cli_login
gh auth status >nul 2>&1
if errorlevel 1 (
  gh auth login
  if errorlevel 1 goto :failed
)
gh auth status
if errorlevel 1 goto :failed
gh auth setup-git
if errorlevel 1 goto :failed

:supabase_check
echo.
echo === Check Supabase updates ===
set "HAS_DB=0"
set "HAS_FUNCTIONS=0"
git status --porcelain -- supabase\migrations | findstr . >nul && set "HAS_DB=1"
git status --porcelain -- supabase\functions | findstr . >nul && set "HAS_FUNCTIONS=1"
if "%HAS_DB%"=="1" goto :supabase_login
if "%HAS_FUNCTIONS%"=="1" goto :supabase_login
goto :git_push

:supabase_login
where supabase >nul 2>&1
if errorlevel 1 (
  set "FAIL_REASON=Supabase CLI is required because Supabase files changed. Install it from https://supabase.com/docs/guides/cli and rerun."
  goto :failed
)
supabase projects list >nul 2>&1
if errorlevel 1 (
  supabase login
  if errorlevel 1 goto :failed
)
supabase projects list >nul 2>&1
if errorlevel 1 goto :failed

if "%HAS_DB%"=="1" (
  echo Linking Supabase project euvfoyxntkqxoydgpqjq...
  supabase link --project-ref euvfoyxntkqxoydgpqjq
  if errorlevel 1 goto :failed
  echo Applying Supabase database migrations...
  supabase db push
  if errorlevel 1 goto :failed
)
if "%HAS_FUNCTIONS%"=="1" (
  for /d %%D in (supabase\functions\*) do (
    git status --porcelain -- "%%D" | findstr . >nul
    if not errorlevel 1 (
      echo Deploying changed Edge Function: %%~nxD
      supabase functions deploy %%~nxD --project-ref euvfoyxntkqxoydgpqjq
      if errorlevel 1 goto :failed
    )
  )
)

:git_push
for /f %%B in ('git branch --show-current') do set "CURRENT_BRANCH=%%B"
if not "%CURRENT_BRANCH%"=="main" (
  set "FAIL_REASON=This script expects the main branch. Current branch: %CURRENT_BRANCH%"
  goto :failed
)
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Update SciFe provider bridge and GMC strategy"
  if errorlevel 1 goto :failed
)
git pull --rebase origin main
if errorlevel 1 goto :failed
git push origin main
if errorlevel 1 goto :failed

echo.
echo Updates are pushed to origin/main.
pause
exit /b 0

:failed
echo.
if defined FAIL_REASON (echo %FAIL_REASON%) else (echo An authentication, Supabase, Git, or push step failed. Fix the error above and rerun this script.)
pause
exit /b 1
