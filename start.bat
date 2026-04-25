@echo off
title Deepfake Authenticator
color 0A

echo.
echo  ============================================
echo    DEEPFAKE AUTHENTICATOR - Starting...
echo  ============================================
echo.

:: Check if venv exists
if not exist "venv\Scripts\activate.bat" (
    echo  [!] Virtual environment not found.
    echo  [*] Run setup.bat first to install dependencies.
    echo.
    pause
    exit /b 1
)

:: Activate venv
call venv\Scripts\activate.bat

:: Kill anything on port 8000
echo  [*] Clearing port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8000 " 2^>nul') do (
    taskkill /PID %%a /F >nul 2>&1
)

echo  [*] Starting server...
echo  [*] Open your browser at: http://localhost:8000
echo.
echo  Press Ctrl+C to stop the server.
echo  ============================================
echo.

:: Open browser after 5 seconds in background
start /b cmd /c "timeout /t 8 /nobreak >nul && start http://localhost:8000"

:: Start server
cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level warning

echo.
echo  Server stopped.
pause
