@echo off
rem Aria ERP - local Docker demo launcher for Windows.
rem Double-click to start, or run from a terminal: aria-local.cmd start, stop, restart, status, logs, update, backup, restore, reload-demo, reset, open, uninstall or help
rem See deployment\local\README.md
setlocal
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0deployment\local\aria-local.ps1" %*
set "EXITCODE=%ERRORLEVEL%"
rem Keep the window open when launched by double-click (no arguments).
if "%~1"=="" pause
exit /b %EXITCODE%
