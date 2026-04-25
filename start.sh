#!/bin/bash
clear
echo ""
echo " ============================================"
echo "   DEEPFAKE AUTHENTICATOR - Starting..."
echo " ============================================"
echo ""

# Check venv
if [ ! -f "venv/bin/activate" ]; then
    echo " [!] Virtual environment not found."
    echo " [*] Run ./setup.sh first to install dependencies."
    echo ""
    exit 1
fi

source venv/bin/activate

# Kill anything on port 8000
echo " [*] Clearing port 8000..."
lsof -ti:8000 | xargs kill -9 2>/dev/null

echo " [*] Starting server..."
echo " [*] Open your browser at: http://localhost:8000"
echo ""
echo " Press Ctrl+C to stop."
echo " ============================================"
echo ""

# Open browser after 8s in background
(sleep 8 && open "http://localhost:8000" 2>/dev/null || xdg-open "http://localhost:8000" 2>/dev/null) &

cd backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --log-level warning
