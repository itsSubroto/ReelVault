import os
import logging
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks, Query, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional

from services.metadata import MetadataService
from services.ai_pipeline import AiPipelineService

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai_service")

app = FastAPI(
    title="ReelVault AI Service",
    description="FastAPI microservice for Instagram metadata extraction (yt-dlp), Whisper transcription, and AI summarization",
    version="2.0.0"
)

# Enable CORS for local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")

class ProcessReelRequest(BaseModel):
    reel_id: str
    instagram_url: str

class ReprocessAllRequest(BaseModel):
    force: Optional[bool] = False

@app.get("/health")
@app.get("/api/health")
@app.get("/api/health/")
def health_check():
    return {
        "status": "healthy",
        "service": "ReelVault FastAPI AI Processing Service",
        "spring_boot_url": SPRING_BOOT_URL
    }

@app.get("/api/metadata")
@app.get("/api/metadata/")
def extract_metadata(url: str = Query(..., description="Instagram reel or post URL")):
    """
    Synchronously extracts high-res thumbnail, full caption, and creator name via yt-dlp.
    Called by Spring Boot during saveReel for instant UI rendering.
    """
    if not url:
        raise HTTPException(status_code=400, detail="Query parameter 'url' is required.")
    logger.info(f"Extracting metadata for: {url}")
    return MetadataService.extract_reel_metadata(url)

@app.post("/api/process-reel", status_code=status.HTTP_202_ACCEPTED)
@app.post("/api/process-reel/", status_code=status.HTTP_202_ACCEPTED)
def process_reel(req: ProcessReelRequest, background_tasks: BackgroundTasks):
    """
    Asynchronously triggers the full AI pipeline:
    yt-dlp metadata -> immediate Spring Boot patch -> Whisper transcript -> LLM summary & tags -> final Spring Boot patch.
    """
    logger.info(f"Received process-reel request for reel_id: {req.reel_id}")
    background_tasks.add_task(
        AiPipelineService.process_reel,
        req.reel_id,
        req.instagram_url,
        SPRING_BOOT_URL
    )
    return {
        "message": "Reel processing started in background",
        "reel_id": req.reel_id,
        "status": "ACCEPTED"
    }

@app.post("/api/reprocess-all", status_code=status.HTTP_202_ACCEPTED)
@app.post("/api/reprocess-all/", status_code=status.HTTP_202_ACCEPTED)
def reprocess_all(background_tasks: BackgroundTasks, req: Optional[ReprocessAllRequest] = None):
    """
    Fetches all reels from Spring Boot and queues any reel that lacks
    a thumbnail or tags for full metadata & AI backfill.
    """
    force = req.force if req else False
    try:
        resp = requests.get(f"{SPRING_BOOT_URL}/api/reels", timeout=10)
        resp.raise_for_status()
        reels = resp.json()
    except Exception as e:
        logger.error(f"Failed to connect to Spring Boot at {SPRING_BOOT_URL}: {e}")
        raise HTTPException(status_code=502, detail=f"Failed to connect to Spring Boot backend: {e}")

    queued_count = 0
    for reel in reels:
        reel_id = reel.get("id")
        url = reel.get("instagramUrl")
        needs_processing = (
            not reel.get("thumbnailUrl") or
            "Saved Instagram Reel" in (reel.get("caption") or "") or
            force
        )

        if needs_processing and reel_id and url:
            background_tasks.add_task(
                AiPipelineService.process_reel,
                reel_id,
                url,
                SPRING_BOOT_URL
            )
            queued_count += 1

    return {
        "message": f"Queued {queued_count} reels for metadata & AI enrichment",
        "queued_count": queued_count,
        "total_reels": len(reels)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
