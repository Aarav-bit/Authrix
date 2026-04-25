"""
Deepfake Authenticator - FastAPI Backend
"""

import os
import uuid
import logging
import shutil
import subprocess
from pathlib import Path

from fastapi import FastAPI, File, UploadFile, HTTPException, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import Optional

# ── Logging (must be set up before any logger usage) ─────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

from detector import DeepfakeAuthenticator
from auth import validate_api_key, check_usage_limit, increment_usage

# ── Video conversion helper ───────────────────────────────────────────────────
def convert_to_mp4(src: Path):
    """
    Convert a video file to mp4 using the bundled ffmpeg binary.
    Returns the converted Path, or None if conversion failed.
    """
    if src.suffix.lower() == ".mp4":
        return None  # already mp4

    dst = src.with_suffix(".mp4")

    # Use imageio-ffmpeg bundled binary (always available, no system install needed)
    ffmpeg_bin = "ffmpeg"
    try:
        import imageio_ffmpeg
        ffmpeg_bin = imageio_ffmpeg.get_ffmpeg_exe()
        logger.info(f"Using bundled ffmpeg: {ffmpeg_bin}")
    except Exception as e:
        logger.warning(f"imageio_ffmpeg not available, trying system ffmpeg: {e}")

    try:
        result = subprocess.run(
            [
                ffmpeg_bin, "-y", "-i", str(src),
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "28",
                "-c:a", "aac", "-movflags", "+faststart",
                str(dst),
            ],
            capture_output=True,
            timeout=120,
        )
        if result.returncode == 0 and dst.exists() and dst.stat().st_size > 1000:
            logger.info(f"Converted {src.name} -> {dst.name} ({dst.stat().st_size // 1024} KB)")
            return dst
        stderr = result.stderr.decode(errors="ignore")[-500:]
        logger.warning(f"ffmpeg exit {result.returncode}: {stderr}")
    except Exception as e:
        logger.warning(f"ffmpeg conversion failed: {e}")

    # Fallback: moviepy
    try:
        try:
            from moviepy import VideoFileClip
        except ImportError:
            from moviepy.editor import VideoFileClip
        clip = VideoFileClip(str(src))
        clip.write_videofile(
            str(dst), codec="libx264", audio_codec="aac",
            logger=None, preset="ultrafast",
        )
        clip.close()
        if dst.exists() and dst.stat().st_size > 1000:
            logger.info(f"moviepy converted {src.name} -> {dst.name}")
            return dst
    except Exception as e:
        logger.warning(f"moviepy conversion also failed: {e}")

    return None


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

# ── Singleton authenticator ───────────────────
authenticator = None


@app.on_event("startup")
async def startup_event():
    global authenticator
    logger.info("Initializing DeepfakeAuthenticator...")
    logger.info(f"Frontend path: {_vanilla_dir} (exists={_vanilla_dir.exists()})")
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

    tmp_prefix = UPLOAD_DIR / f"ext_{uuid.uuid4().hex}"
    actual_path = None
    downloaded = False

    try:
        # yt-dlp: handles YouTube, Twitter, Instagram, TikTok
        try:
            import yt_dlp
            ydl_opts = {
                "format": "bestvideo[ext=mp4][height<=720]+bestaudio[ext=m4a]/best[ext=mp4][height<=720]/best",
                "outtmpl": str(tmp_prefix) + ".%(ext)s",
                "quiet": True,
                "no_warnings": True,
                "merge_output_format": "mp4",
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                ydl.download([video_url])

            for ext in (".mp4", ".webm", ".mkv", ".avi", ".mov"):
                candidate = Path(str(tmp_prefix) + ext)
                if candidate.exists() and candidate.stat().st_size > 1000:
                    actual_path = candidate
                    downloaded = True
                    logger.info(f"yt-dlp: {actual_path.name} ({actual_path.stat().st_size // 1024}KB)")
                    break

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

        # Fallback: direct HTTP fetch
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
                detail="Could not download video. For YouTube, ensure yt-dlp is installed: pip install yt-dlp",
            )

        # Convert if needed
        converted = convert_to_mp4(actual_path)
        analyze_path = converted if converted else actual_path

        result = authenticator.analyze(str(analyze_path))  # full mode for URL downloads
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"analyze-url failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        for f in UPLOAD_DIR.glob(f"{tmp_prefix.name}*"):
            try:
                f.unlink()
            except Exception:
                pass


@app.post("/analyze")
async def analyze_video(
    file: UploadFile = File(...),
    x_api_key: Optional[str] = Header(None, alias="X-API-Key")
):
    """Analyze an uploaded video for deepfake content."""
    import asyncio
    # Check API key (allow localhost without key for development)
    if x_api_key:
        key_data = validate_api_key(x_api_key)
        if not key_data:
            raise HTTPException(status_code=401, detail="Invalid API key")
        
        allowed, used, limit = check_usage_limit(x_api_key)
        if not allowed:
            raise HTTPException(
                status_code=429,
                detail=f"Monthly limit exceeded ({used}/{limit}). Upgrade your plan at https://authrix.ai/pricing"
            )
        
        logger.info(f"API request from {key_data['email']} ({key_data['tier']}) - {used+1}/{limit}")
    else:
        logger.info("Local request (no API key)")

    if not authenticator:
        raise HTTPException(status_code=503, detail="Server is still initializing, please retry.")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{suffix}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    unique_name = f"{uuid.uuid4().hex}{suffix}"
    save_path = UPLOAD_DIR / unique_name
    converted_path = None

    try:
        content = await file.read()
        size_mb = len(content) / (1024 * 1024)
        if size_mb > MAX_FILE_SIZE_MB:
            raise HTTPException(
                status_code=413,
                detail=f"File too large ({size_mb:.1f} MB). Max allowed: {MAX_FILE_SIZE_MB} MB",
            )

        save_path.write_bytes(content)
        logger.info(f"Saved upload: {unique_name} ({size_mb:.1f} MB)")

        # Convert webm/mkv/etc to mp4 — OpenCV on Windows cannot decode webm natively
        analyze_path = save_path
        if suffix in (".webm", ".mkv", ".avi", ".wmv"):
            logger.info(f"File has {suffix} extension — conversion needed")
            converted_path = convert_to_mp4(save_path)
            if converted_path:
                analyze_path = converted_path
                logger.info(f"✓ Conversion successful — using {analyze_path.name}")
            else:
                logger.error(f"✗ Conversion FAILED for {suffix} — will attempt direct analysis (likely to fail)")
        else:
            logger.info(f"File is {suffix} — no conversion needed")

        logger.info(f"Calling authenticator.analyze({analyze_path})")
        # Detect duration for fast_mode
        try:
            import cv2 as _cv2
            _cap = _cv2.VideoCapture(str(analyze_path))
            _fps = _cap.get(_cv2.CAP_PROP_FPS)
            _tot = _cap.get(_cv2.CAP_PROP_FRAME_COUNT)
            _cap.release()
            duration = _tot / _fps if _fps > 0 else 999
        except Exception:
            duration = 999
        fast = duration < 30
        logger.info(f"Video duration: {duration:.1f}s → fast_mode={fast}")

        # Run with 120s timeout — never hang forever
        import asyncio, concurrent.futures as _cf
        loop = asyncio.get_event_loop()
        with _cf.ThreadPoolExecutor(max_workers=1) as pool:
            try:
                result = await asyncio.wait_for(
                    loop.run_in_executor(pool, lambda: authenticator.analyze(str(analyze_path), fast_mode=fast)),
                    timeout=120.0
                )
            except asyncio.TimeoutError:
                raise HTTPException(status_code=504, detail="Analysis timed out after 120s. Try a shorter video.")
        
        # Increment usage counter if API key provided
        if x_api_key:
            increment_usage(x_api_key)
        
        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Analysis failed for {unique_name}: {e}")
        # Write detailed error to file for debugging
        error_log = UPLOAD_DIR / "last_error.txt"
        import traceback
        error_log.write_text(f"File: {unique_name}\nError: {e}\n\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    finally:
        for p in [save_path, converted_path]:
            if p is not None and p.exists():
                try:
                    p.unlink()
                    logger.info(f"Cleaned up: {p.name}")
                except Exception:
                    pass


# ── Serve frontend ────────────────────────────
_react_dist  = Path(__file__).parent.parent / "frontend-dist"
_vanilla_dir = Path(__file__).parent.parent / "frontend-vanilla"

if _react_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(_react_dist / "assets")), name="assets")

    @app.get("/")
    async def serve_index():
        return FileResponse(
            str(_react_dist / "index.html"),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )

    @app.get("/{full_path:path}")
    async def spa_fallback(full_path: str):
        index = _react_dist / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return {"detail": "Not found"}

elif _vanilla_dir.exists():
    from fastapi.staticfiles import StaticFiles as SF

    @app.get("/script.js")
    async def serve_script():
        return FileResponse(
            str(_vanilla_dir / "script.js"),
            media_type="application/javascript",
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )

    @app.get("/pricing")
    async def serve_pricing():
        return FileResponse(
            str(_vanilla_dir / "pricing.html"),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )

    @app.get("/")
    async def serve_index():
        return FileResponse(
            str(_vanilla_dir / "index.html"),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )

    # Serve any other static file from frontend-vanilla/
    @app.get("/{filename:path}")
    async def serve_static(filename: str):
        file_path = _vanilla_dir / filename
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(
            str(_vanilla_dir / "index.html"),
            headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
