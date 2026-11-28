import hashlib
import logging
import math
import os
import random
import re
import time
from typing import Optional

import requests

logger = logging.getLogger("ai_service.embeddings")

EMBEDDING_DIMENSION = 768
GEMINI_MODEL_NAME = "gemini-embedding-001"
OPENAI_MODEL_NAME = "text-embedding-3-small"
LOCAL_MODEL_NAME = "local-semantic-hash-768"

# Semantic concept clusters used only by the deterministic local fallback
# so offline mode still bridges common contextual vocabulary gaps.
_CONCEPT_CLUSTERS = {
    "concept_containers": {
        "docker", "container", "containers", "kubernetes", "k8s", "pod", "pods",
        "orchestration", "microservices", "deploy", "deployment", "devops", "compose",
    },
    "concept_backend": {
        "backend", "api", "rest", "spring", "fastapi", "server", "database", "postgres",
        "postgresql", "sql", "scalable", "scalability", "architecture", "microservice",
    },
    "concept_frontend": {
        "frontend", "react", "javascript", "typescript", "css", "tailwind", "html",
        "ui", "ux", "component", "responsive", "vite", "browser",
    },
    "concept_ai_ml": {
        "ai", "ml", "llm", "gpt", "gemini", "whisper", "embedding", "embeddings",
        "vector", "semantic", "neural", "model", "prompt", "rag", "transcription",
    },
    "concept_fitness": {
        "workout", "gym", "fitness", "exercise", "protein", "muscle", "strength",
        "cardio", "training", "fat", "calorie", "calories", "hypertrophy", "abs",
    },
    "concept_cooking": {
        "recipe", "cook", "cooking", "food", "meal", "breakfast", "lunch", "dinner",
        "snack", "paneer", "oats", "smoothie", "vegan", "vegetarian", "healthy",
    },
    "concept_finance": {
        "finance", "money", "invest", "investing", "stock", "stocks", "mutual",
        "budget", "savings", "tax", "wealth", "passive", "income", "compound",
    },
    "concept_productivity": {
        "productivity", "study", "notes", "focus", "habit", "habits", "routine",
        "time", "learning", "workflow", "notion", "obsidian", "pomodoro",
    },
    "concept_comedy": {
        "funny", "comedy", "humor", "meme", "skit", "laugh", "joke", "hilarious",
        "entertainment", "prank", "parody",
    },
    "concept_cinema": {
        "movie", "movies", "film", "cinema", "series", "show", "thriller",
        "scifi", "review", "watchlist", "netflix", "director",
    },
}


def l2_normalize(vec: list[float]) -> list[float]:
    """Normalize a vector to unit L2 norm for cosine similarity."""
    norm = math.sqrt(sum(x * x for x in vec))
    if norm <= 1e-12:
        return [0.0] * len(vec)
    return [float(x / norm) for x in vec]


def format_pgvector(vec: list[float]) -> str:
    """Format a float list into pgvector literal syntax: '[0.1,0.2,...]'."""
    return "[" + ",".join(f"{v:.8f}" for v in vec) + "]"


def parse_pgvector(raw: str | list[float] | None) -> Optional[list[float]]:
    """Parse a pgvector literal string or list into a list of floats."""
    if raw is None:
        return None
    if isinstance(raw, list):
        return [float(x) for x in raw]
    cleaned = raw.strip()
    if not cleaned or cleaned == "[]":
        return None
    if cleaned.startswith("[") and cleaned.endswith("]"):
        cleaned = cleaned[1:-1]
    return [float(x) for x in cleaned.split(",") if x.strip()]


def build_reel_document(
    caption: Optional[str] = "",
    transcript: Optional[str] = "",
    summary: Optional[str] = "",
    tags: Optional[list[str]] = None,
    author_name: Optional[str] = "",
) -> str:
    """Assemble a clean, structured document string from a reel's searchable fields."""
    parts = []
    if summary and summary.strip():
        parts.append(f"Summary: {summary.strip()}")
    if caption and caption.strip():
        parts.append(f"Caption: {caption.strip()}")
    if transcript and transcript.strip():
        parts.append(f"Transcript: {transcript.strip()}")
    if tags:
        clean_tags = [str(t).strip().lstrip("#") for t in tags if t and str(t).strip()]
        if clean_tags:
            parts.append(f"Tags: {', '.join(clean_tags)}")
    if author_name and author_name.strip():
        parts.append(f"Creator: {author_name.strip()}")

    combined = "\n".join(parts).strip()
    if not combined:
        return "Saved social media video reel"
    # Keep well within embedding model token windows (~2000 words / 8000 chars)
    return combined[:8000]


class EmbeddingService:
    """
    Generates 768-dimensional normalized embeddings for ReelVault videos and search queries.

    Provider order:
      1. Google Gemini `gemini-embedding-001` (outputDimensionality=768)
      2. OpenAI `text-embedding-3-small` (dimensions=768)
      3. Deterministic local semantic-hash fallback (768 dims, offline-safe)
    """

    @classmethod
    def generate_query_embedding(cls, query: str) -> tuple[list[float], str]:
        return cls.generate_embedding(query, task_type="RETRIEVAL_QUERY")

    @classmethod
    def generate_document_embedding(
        cls,
        caption: Optional[str] = "",
        transcript: Optional[str] = "",
        summary: Optional[str] = "",
        tags: Optional[list[str]] = None,
        author_name: Optional[str] = "",
    ) -> tuple[list[float], str]:
        doc = build_reel_document(
            caption=caption,
            transcript=transcript,
            summary=summary,
            tags=tags,
            author_name=author_name,
        )
        return cls.generate_embedding(doc, task_type="RETRIEVAL_DOCUMENT")

    @classmethod
    def generate_embedding(
        cls,
        text: str,
        task_type: str = "RETRIEVAL_DOCUMENT",
        allow_fallback: bool = True,
    ) -> tuple[list[float], str]:
        clean_text = (text or "").strip()
        if not clean_text:
            raise ValueError("Cannot generate embedding for empty text")

        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        if gemini_key:
            try:
                vec = cls._embed_gemini_single(clean_text, gemini_key, task_type=task_type)
                return vec, GEMINI_MODEL_NAME
            except Exception as exc:
                logger.warning("Gemini embedding failed (%s). Checking next provider.", exc)
                if not allow_fallback:
                    raise

        openai_key = os.getenv("OPENAI_API_KEY", "").strip()
        if openai_key:
            try:
                vec = cls._embed_openai_batch([clean_text], openai_key)[0]
                return vec, OPENAI_MODEL_NAME
            except Exception as exc:
                logger.warning("OpenAI embedding failed (%s). Checking next provider.", exc)
                if not allow_fallback:
                    raise

        if not allow_fallback:
            raise RuntimeError("No cloud embedding provider succeeded and fallback is disabled")

        return cls._embed_local_fallback(clean_text), LOCAL_MODEL_NAME

    @classmethod
    def generate_embeddings_batch(
        cls,
        texts: list[str],
        task_type: str = "RETRIEVAL_DOCUMENT",
        batch_size: int = 16,
        allow_fallback: bool = True,
    ) -> list[tuple[list[float], str]]:
        if not texts:
            return []

        clean_texts = [(t or "").strip() or "Saved social media video reel" for t in texts]
        results: list[tuple[list[float], str]] = []

        gemini_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
        openai_key = os.getenv("OPENAI_API_KEY", "").strip()

        for start in range(0, len(clean_texts), batch_size):
            chunk = clean_texts[start:start + batch_size]
            if gemini_key:
                try:
                    vecs = cls._embed_gemini_batch(chunk, gemini_key, task_type=task_type)
                    results.extend((v, GEMINI_MODEL_NAME) for v in vecs)
                    continue
                except Exception as exc:
                    logger.warning(
                        "Gemini batch embed failed for chunk [%d:%d] (%s); falling back.",
                        start, start + len(chunk), exc,
                    )
                    if not allow_fallback:
                        raise

            if openai_key:
                try:
                    vecs = cls._embed_openai_batch(chunk, openai_key)
                    results.extend((v, OPENAI_MODEL_NAME) for v in vecs)
                    continue
                except Exception as exc:
                    logger.warning(
                        "OpenAI batch embed failed for chunk [%d:%d] (%s); falling back.",
                        start, start + len(chunk), exc,
                    )
                    if not allow_fallback:
                        raise

            if not allow_fallback:
                raise RuntimeError("Batch embedding failed and fallback is disabled")

            results.extend((cls._embed_local_fallback(t), LOCAL_MODEL_NAME) for t in chunk)

        return results

    @classmethod
    def _post_with_retry(
        cls,
        url: str,
        payload: dict,
        headers: Optional[dict] = None,
        max_retries: int = 4,
        base_delay: float = 1.0,
        timeout: int = 20,
    ) -> dict:
        last_exc: Optional[Exception] = None
        for attempt in range(max_retries + 1):
            try:
                resp = requests.post(url, json=payload, headers=headers or {}, timeout=timeout)
                if resp.status_code == 200:
                    return resp.json()

                retryable = resp.status_code == 429 or 500 <= resp.status_code < 600
                if not retryable or attempt == max_retries:
                    resp.raise_for_status()

                retry_after = resp.headers.get("Retry-After")
                if retry_after and retry_after.isdigit():
                    sleep_s = min(float(retry_after), 30.0)
                else:
                    sleep_s = min(base_delay * (2 ** attempt) + random.uniform(0.05, 0.35), 30.0)
                logger.warning(
                    "Rate limited or transient error (%s). Retrying in %.2fs (attempt %d/%d)",
                    resp.status_code, sleep_s, attempt + 1, max_retries,
                )
                time.sleep(sleep_s)
            except requests.RequestException as exc:
                last_exc = exc
                if attempt == max_retries:
                    raise
                sleep_s = min(base_delay * (2 ** attempt) + random.uniform(0.05, 0.35), 30.0)
                logger.warning(
                    "Request exception during embedding (%s). Retrying in %.2fs (attempt %d/%d)",
                    exc, sleep_s, attempt + 1, max_retries,
                )
                time.sleep(sleep_s)
        raise RuntimeError(f"Exhausted retries calling {url}: {last_exc}")

    @classmethod
    def _embed_gemini_single(
        cls,
        text: str,
        api_key: str,
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[float]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL_NAME}:embedContent?key={api_key}"
        payload = {
            "model": f"models/{GEMINI_MODEL_NAME}",
            "content": {"parts": [{"text": text}]},
            "taskType": task_type,
            "outputDimensionality": EMBEDDING_DIMENSION,
        }
        data = cls._post_with_retry(url, payload)
        values = data.get("embedding", {}).get("values")
        if not values or len(values) != EMBEDDING_DIMENSION:
            raise ValueError(f"Unexpected Gemini embedding length: {len(values) if values else 0}")
        return l2_normalize([float(v) for v in values])

    @classmethod
    def _embed_gemini_batch(
        cls,
        texts: list[str],
        api_key: str,
        task_type: str = "RETRIEVAL_DOCUMENT",
    ) -> list[list[float]]:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL_NAME}:batchEmbedContents?key={api_key}"
        payload = {
            "requests": [
                {
                    "model": f"models/{GEMINI_MODEL_NAME}",
                    "content": {"parts": [{"text": text}]},
                    "taskType": task_type,
                    "outputDimensionality": EMBEDDING_DIMENSION,
                }
                for text in texts
            ]
        }
        data = cls._post_with_retry(url, payload, timeout=30)
        embeddings = data.get("embeddings", [])
        if len(embeddings) != len(texts):
            raise ValueError(f"Expected {len(texts)} Gemini embeddings, got {len(embeddings)}")
        normalized = []
        for emb in embeddings:
            values = emb.get("values")
            if not values or len(values) != EMBEDDING_DIMENSION:
                raise ValueError(f"Unexpected Gemini embedding length: {len(values) if values else 0}")
            normalized.append(l2_normalize([float(v) for v in values]))
        return normalized

    @classmethod
    def _embed_openai_batch(cls, texts: list[str], api_key: str) -> list[list[float]]:
        url = "https://api.openai.com/v1/embeddings"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": OPENAI_MODEL_NAME,
            "input": texts,
            "dimensions": EMBEDDING_DIMENSION,
        }
        data = cls._post_with_retry(url, payload, headers=headers, timeout=30)
        items = sorted(data.get("data", []), key=lambda item: item.get("index", 0))
        if len(items) != len(texts):
            raise ValueError(f"Expected {len(texts)} OpenAI embeddings, got {len(items)}")
        return [l2_normalize([float(v) for v in item["embedding"]]) for item in items]

    @classmethod
    def _embed_local_fallback(cls, text: str) -> list[float]:
        """
        Deterministic 768-d local semantic-hash embedding fallback when no API key is configured.
        Combines word tokens, light suffixes/stems, bigrams, char 4-grams, and concept cluster projections.
        """
        vec = [0.0] * EMBEDDING_DIMENSION
        tokens = re.findall(r"[a-z0-9]+", text.lower())
        if not tokens:
            vec[0] = 1.0
            return vec

        def add_feature(feature: str, weight: float):
            digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=16).digest()
            idx = int.from_bytes(digest[:4], "little") % EMBEDDING_DIMENSION
            sign = 1.0 if (digest[4] & 1) == 0 else -1.0
            vec[idx] += sign * weight
            # Secondary projection reduces hash collisions across 768 dims
            idx2 = int.from_bytes(digest[5:9], "little") % EMBEDDING_DIMENSION
            sign2 = 1.0 if (digest[9] & 1) == 0 else -1.0
            vec[idx2] += sign2 * (weight * 0.5)

        stopwords = {
            "the", "and", "for", "with", "that", "this", "from", "are", "was", "were",
            "you", "your", "have", "has", "had", "into", "about", "how", "what", "when",
            "where", "which", "who", "can", "will", "just", "want", "need", "some",
        }

        for i, tok in enumerate(tokens):
            if tok in stopwords or len(tok) < 2:
                continue
            add_feature(f"w:{tok}", 1.5)
            # Light normalization stem
            stem = re.sub(r"(ing|ed|es|s)$", "", tok) if len(tok) > 4 else tok
            if stem != tok:
                add_feature(f"s:{stem}", 1.1)

            # Concept cluster boost for contextual alignment offline
            for cluster_name, words in _CONCEPT_CLUSTERS.items():
                if tok in words or stem in words:
                    add_feature(f"c:{cluster_name}", 2.2)

            # Bigrams
            if i + 1 < len(tokens):
                nxt = tokens[i + 1]
                if nxt not in stopwords:
                    add_feature(f"bg:{tok}_{nxt}", 1.0)

            # Character 4-grams for morphological similarity
            if len(tok) >= 4:
                for pos in range(len(tok) - 3):
                    add_feature(f"cg:{tok[pos:pos + 4]}", 0.35)

        return l2_normalize(vec)
