import os
import logging
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, BackgroundTasks, Query, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from services.metadata import MetadataService
from services.ai_pipeline import AiPipelineService
from services.embedding_service import EmbeddingService, EMBEDDING_DIMENSION
from backfill_embeddings import backfill_embeddings

load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai_service")

app = FastAPI(
    title="ReelVault AI Service",
    description="FastAPI microservice for metadata extraction, Whisper transcription, AI summarization, and 768-d semantic embeddings",
    version="3.0.0"
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
ADMIN_API_SECRET = os.getenv("ADMIN_API_SECRET", "reelvault-admin-secret")


class ProcessReelRequest(BaseModel):
    reel_id: str
    instagram_url: str


class ReprocessAllRequest(BaseModel):
    force: Optional[bool] = False


class EmbedTextRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=12000)
    task_type: str = Field(default="RETRIEVAL_QUERY")


class BackfillEmbeddingsRequest(BaseModel):
    force: bool = False
    batch_size: int = Field(default=16, ge=1, le=64)
    limit: Optional[int] = Field(default=None, ge=1, le=5000)


@app.get("/health")
@app.get("/api/health")
@app.get("/api/health/")
def health_check():
    return {
        "status": "healthy",
        "service": "ReelVault FastAPI AI Processing Service",
        "spring_boot_url": SPRING_BOOT_URL,
        "embedding_dimension": EMBEDDING_DIMENSION,
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


@app.post("/api/embeddings")
@app.post("/api/embeddings/")
def create_embedding(req: EmbedTextRequest):
    """
    Generates a 768-dimensional normalized semantic embedding vector for a search query or reel text.
    """
    try:
        task_type = req.task_type if req.task_type in {"RETRIEVAL_QUERY", "RETRIEVAL_DOCUMENT"} else "RETRIEVAL_QUERY"
        vec, model_name = EmbeddingService.generate_embedding(req.text, task_type=task_type)
        return {
            "embedding": vec,
            "model": model_name,
            "dimensions": len(vec),
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Embedding endpoint error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate embedding: {e}")


@app.post("/api/embeddings/backfill")
@app.post("/api/embeddings/backfill/")
def trigger_embedding_backfill(
    req: Optional[BackfillEmbeddingsRequest] = None,
    x_admin_secret: Optional[str] = Header(default=None, alias="X-Admin-Secret"),
):
    """
    Protected idempotent batch backfill endpoint for existing Reels without valid embeddings.
    """
    if ADMIN_API_SECRET and x_admin_secret != ADMIN_API_SECRET:
        raise HTTPException(status_code=403, detail="Invalid or missing X-Admin-Secret header")

    opts = req or BackfillEmbeddingsRequest()
    try:
        result = backfill_embeddings(
            force=opts.force,
            batch_size=opts.batch_size,
            limit=opts.limit,
        )
        return result
    except Exception as e:
        logger.error(f"Embedding backfill failed: {e}")
        raise HTTPException(status_code=500, detail=f"Embedding backfill failed: {e}")


@app.post("/api/process-reel", status_code=status.HTTP_202_ACCEPTED)
@app.post("/api/process-reel/", status_code=status.HTTP_202_ACCEPTED)
def process_reel(req: ProcessReelRequest, background_tasks: BackgroundTasks):
    """
    Asynchronously triggers the full AI pipeline:
    yt-dlp metadata -> immediate Spring Boot patch -> Whisper transcript -> LLM summary & tags -> 768-d embedding -> final Spring Boot patch.
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
    a thumbnail, tags, or embedding for full metadata & AI backfill.
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
            reel.get("embeddingStatus") != "DONE" or
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
