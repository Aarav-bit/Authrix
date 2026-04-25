@echo off
echo.
echo ==========================================
echo    DEEPFAKE AUTHENTICATOR -- SETUP
echo ==========================================
echo.

where python >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python not found. Please install Python 3.9+
    pause
    exit /b 1
)

echo Creating virtual environment...
python -m venv venv
call venv\Scripts\activate.bat

echo Upgrading pip...
python -m pip install --upgrade pip -q

echo Installing core dependencies...
pip install fastapi==0.111.0 "uvicorn[standard]==0.29.0" python-multipart==0.0.9 -q
pip install opencv-python==4.9.0.80 mediapipe==0.10.14 numpy==1.26.4 Pillow==10.3.0 -q

echo Installing HuggingFace dependencies (optional)...
pip install transformers==4.41.0 torch==2.3.0 --index-url https://download.pytorch.org/whl/cpu -q
if %errorlevel% neq 0 (
    echo WARNING: torch/transformers install failed -- will use heuristic fallback
)

echo.
echo ==========================================
echo          SETUP COMPLETE
echo ==========================================
echo.
echo To start the server:
echo   venv\Scripts\activate.bat
echo   cd backend
echo   python main.py
echo.
echo Then open: http://localhost:8000
echo.
pause
