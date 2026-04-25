#!/bin/bash
# Deepfake Authenticator — Setup Script

set -e

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║     DEEPFAKE AUTHENTICATOR — SETUP       ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "❌ Python 3 not found. Please install Python 3.9+"
  exit 1
fi

PYTHON_VERSION=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✅ Python $PYTHON_VERSION detected"

# Create virtual environment
echo ""
echo "📦 Creating virtual environment..."
python3 -m venv venv
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip -q

# Install dependencies
echo ""
echo "📥 Installing dependencies..."
echo "   (This may take a few minutes for torch/transformers)"
echo ""

pip install fastapi==0.111.0 uvicorn[standard]==0.29.0 python-multipart==0.0.9 -q
pip install opencv-python==4.9.0.80 mediapipe==0.10.14 numpy==1.26.4 Pillow==10.3.0 -q

echo ""
echo "🤖 Installing HuggingFace model dependencies..."
echo "   (Optional — skip with Ctrl+C if you want heuristic-only mode)"
pip install transformers==4.41.0 torch==2.3.0 --index-url https://download.pytorch.org/whl/cpu -q || \
  echo "⚠️  torch/transformers install failed — will use heuristic fallback"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║           SETUP COMPLETE ✅              ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "To start the server:"
echo "  source venv/bin/activate"
echo "  cd backend && python main.py"
echo ""
echo "Then open: http://localhost:8000"
echo ""
