@echo off
echo =======================================================
echo     CivicAI: Intelligent Grievance & Dispatch Platform
echo =======================================================
echo.

:: Check virtual environment
if not exist venv (
    echo [ERROR] Virtual environment 'venv' not found.
    echo Please run 'python -m venv venv' and install packages first.
    pause
    exit /b 1
)

:: Start FastAPI Backend in a separate cmd window
echo [STARTING] Launching FastAPI Backend on http://127.0.0.1:8000...
start "CivicAI Backend Service" cmd /k "cd backend && ..\venv\Scripts\python -m uvicorn main:app --host 127.0.0.1 --port 8000"

:: Wait 3 seconds for database seeding and server launch
echo [WAITING] Allowing service initialization...
timeout /t 3 /nobreak > nul

:: Open Frontend Dashboard
echo [LAUNCHING] Opening unified workspace in default browser...
start "" "frontend/index.html"

echo.
echo =======================================================
echo  CivicAI is online!
echo  Keep the 'CivicAI Backend Service' window running.
echo =======================================================
pause
