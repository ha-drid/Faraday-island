@echo off
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
    py -3 start-local.py
) else (
    python start-local.py
)
if errorlevel 1 pause
