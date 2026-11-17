@echo off
REM Run from the repo folder after extracting the zip over it.
cd /d "%~dp0"
git add -A
git commit -m "Fix AI screenshot scan: retry + model fallback, count scan only on success, bump SW cache, add ai-proxy"
git push origin HEAD
pause
