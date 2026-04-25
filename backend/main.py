"""
Deepfake Authenticator - FastAPI Backend
"""

import os
import uuid
import logging
import shutil
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from detector import DeepfakeAuthenticator

# ── Logging ──────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── App setup ────────────────────────────────
app = FastAPI(
    title="Deepfake Authenticator API",
    description="AI-powered deepfake detection using MediaPipe + HuggingFace",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Upload directory ──────────────────────────
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".webm", ".wmv"}
MAX_FILE_SIZE_MB = 100

# ── Singleton authenticator (lazy-loaded on first request) ───
authenticator: DeepfakeAuthenticator | None = None

@app.on_event("startup")
async def startup_event():
    global authenticator
    logger.info("Initializing DeepfakeAuthenticator...")
    authenticator = DeepfakeAuthenticator()
    logger.info(
        f"DeepfakeAuthenticator ready — model: "
        f"{'HuggingFace' if authenticator.decision_agent.use_hf_model else 'Heuristic'}"
    )


# ── Routes ────────────────────────────────────

@app.get("/health")
async def health():
    agent = authenticator.decision_agent if authenticator else None
    if agent and agent.use_hf_model:
        model_info = f"Ensemble ({len(agent.models)} ViT models)"
    elif agent:
        model_info = "Heuristic"
    else:
        model_info = "Loading"
    return {
        "status": "ok",
        "model": model_info,
        "ready": authenticator is not None,
    }


@app.post("/analyze")
async def analyze_video(file: UploadFile = File(...)):
    """
    Analyze an uploaded video for deepfake content.

    Returns:
        result: "REAL" or "FAKE"
        confidence: 0–100 percentage
        details: list of human-readable explanations
        frame_timeline: per-frame fake probability for visualization
        metadata: video info and processing stats
    """
    if not authenticator:
        raise HTTPException(status_code=503, detail="Server is still initializing, please retry.")

    # Validate file extension
    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # Save uploaded file with unique name
    unique_name = f"{uuid.uuid4().hex}{suffix}"
    save_path = UPLOAD_DIR / unique_name

    try:
        with save_path.open("wb") as f:
            content = await file.read()

            # Check file size
            size_mb = len(content) / (1024 * 1024)
            if size_mb > MAX_FILE_SIZE_MB:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large ({size_mb:.1f} MB). Max allowed: {MAX_FILE_SIZE_MB} MB",
                )

            f.write(content)

        logger.info(f"Saved upload: {unique_name} ({size_mb:.1f} MB)")

        # Run analysis
        result = authenticator.analyze(str(save_path))
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Analysis failed for {unique_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        # Clean up uploaded file
        if save_path.exists():
            save_path.unlink()
            logger.info(f"Cleaned up: {unique_name}")


# ── Serve frontend ────────────────────────────
# Prefer built React dist, fall back to vanilla HTML
_react_dist   = Path(__file__).parent.parent / "frontend-dist"
_vanilla_dir  = Path(__file__).parent.parent / "frontend-vanilla"

if _react_dist.exists():
    # Serve React SPA
    app.mount("/assets", StaticFiles(directory=str(_react_dist / "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(
            str(_react_dist / "index.html"),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )

    # Catch-all for React Router (SPA fallback)
    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        index = _react_dist / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return {"detail": "Not found"}

elif _vanilla_dir.exists():
    # Fallback: vanilla HTML
    @app.get("/script.js")
    async def serve_script():
        return FileResponse(
            str(_vanilla_dir / "script.js"),
            media_type="application/javascript",
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )

    @app.get("/")
    async def serve_index():
        return FileResponse(
            str(_vanilla_dir / "index.html"),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
