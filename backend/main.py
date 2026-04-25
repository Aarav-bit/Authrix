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


@app.post("/analyze-url")
async def analyze_from_url(payload: dict):
    """Download a video from a URL and analyze it. Used by the browser extension."""
    if not authenticator:
        raise HTTPException(status_code=503, detail="Server is still initializing")

    video_url = payload.get("url", "").strip()
    if not video_url:
        raise HTTPException(status_code=400, detail="No URL provided")

    # Use a unique prefix — yt-dlp appends its own extension
    tmp_prefix = UPLOAD_DIR / f"ext_{uuid.uuid4().hex}"
    actual_path = None
    downloaded = False

    try:
        # ── yt-dlp: handles YouTube, Twitter, Instagram, TikTok ─────────────
        try:
            import yt_dlp
            ydl_opts = {
                "format": "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best",
                "outtmpl": str(tmp_prefix) + ".%(ext)s",   # yt-dlp adds extension
                "quiet": True,
                "no_warnings": True,
                "merge_output_format": "mp4",
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])

            # Find whatever file yt-dlp created
            for ext in (".mp4", ".webm", ".mkv", ".avi", ".mov"):
                candidate = Path(str(tmp_prefix) + ext)
                if candidate.exists() and candidate.stat().st_size > 1000:
                    actual_path = candidate
                    downloaded = True
                    logger.info(f"yt-dlp: {actual_path.name} ({actual_path.stat().st_size // 1024}KB)")
                    break

            # Glob fallback in case yt-dlp used a different naming scheme
            if not downloaded:
                for f in sorted(UPLOAD_DIR.glob(f"{tmp_prefix.name}*")):
                    if f.stat().st_size > 1000:
                        actual_path = f
                        downloaded = True
                        logger.info(f"yt-dlp (glob): {actual_path.name}")
                        break

        except ImportError:
            logger.info("yt-dlp not installed — trying direct HTTP fetch")
        except Exception as e:
            logger.warning(f"yt-dlp failed ({e}) — trying direct fetch")

        # ── Fallback: direct HTTP fetch for plain video URLs ─────────────────
        if not downloaded:
            try:
                import httpx
                actual_path = Path(str(tmp_prefix) + ".mp4")
                async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
                    r = await client.get(video_url, headers={"User-Agent": "Mozilla/5.0"})
                    if r.status_code == 200 and len(r.content) > 1000:
                        actual_path.write_bytes(r.content)
                        downloaded = True
                        logger.info(f"Direct fetch: {len(r.content) // 1024}KB")
            except Exception as e:
                logger.warning(f"Direct fetch failed: {e}")

        if not downloaded or actual_path is None:
            raise HTTPException(
                status_code=400,
                detail="Could not download video. For YouTube, ensure yt-dlp is installed: pip install yt-dlp"
            )

        # Analyze — no file extension check needed here (yt-dlp handles format)
        result = authenticator.analyze(str(actual_path))
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"analyze-url failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Clean up all files with our prefix
        for f in UPLOAD_DIR.glob(f"{tmp_prefix.name}*"):
            try:
                f.unlink()
            except Exception:
                pass


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
