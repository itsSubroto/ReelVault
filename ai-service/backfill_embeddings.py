import argparse
import logging
import os
import sys
import time
from typing import Optional

import pg8000.native

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from services.embedding_service import (  # noqa: E402
    EMBEDDING_DIMENSION,
    EmbeddingService,
    build_reel_document,
    format_pgvector,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai_service.backfill_embeddings")


def get_db_connection() -> pg8000.native.Connection:
    return pg8000.native.Connection(
        user=os.getenv("POSTGRES_USER", "postgres"),
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5433")),
        database=os.getenv("POSTGRES_DB", "reelvault"),
        password=os.getenv("POSTGRES_PASSWORD", "password"),
    )


def _fetch_tags_map(conn: pg8000.native.Connection, reel_ids: list[str]) -> dict[str, list[str]]:
    if not reel_ids:
        return {}
    rows = conn.run(
        "SELECT reel_id::text, tag FROM reel_tags WHERE reel_id::text = ANY(:ids);",
        ids=reel_ids,
    )
    tags_map: dict[str, list[str]] = {}
    for reel_id, tag in rows:
        if tag:
            tags_map.setdefault(str(reel_id), []).append(str(tag))
    return tags_map


def backfill_embeddings(
    force: bool = False,
    batch_size: int = 16,
    limit: Optional[int] = None,
    sleep_between_batches: float = 0.25,
    conn: Optional[pg8000.native.Connection] = None,
) -> dict:
    """
    Idempotent batch backfill for reel embeddings.

    Skips reels that already have a valid embedding (embedding IS NOT NULL AND embedding_status = 'DONE')
    unless `force=True` is explicitly provided.
    """
    owns_conn = conn is None
    if conn is None:
        conn = get_db_connection()

    try:
        where_clause = "" if force else "WHERE embedding IS NULL OR embedding_status IS DISTINCT FROM 'DONE'"
        limit_clause = f"LIMIT {int(limit)}" if limit and limit > 0 else ""

        rows = conn.run(
            f"""
            SELECT id::text, caption, transcript, summary, author_name, embedding_status
            FROM reels
            {where_clause}
            ORDER BY created_at DESC
            {limit_clause};
            """
        )

        total_candidates = len(rows)
        logger.info(
            "Found %d candidate reels for embedding backfill (force=%s, batch_size=%d)",
            total_candidates, force, batch_size,
        )

        if total_candidates == 0:
            return {
                "total_candidates": 0,
                "processed": 0,
                "succeeded": 0,
                "failed": 0,
                "model": None,
            }

        succeeded = 0
        failed = 0
        last_model = None

        for start in range(0, total_candidates, batch_size):
            batch = rows[start:start + batch_size]
            batch_ids = [str(r[0]) for r in batch]
            tags_map = _fetch_tags_map(conn, batch_ids)

            docs: list[str] = []
            for r in batch:
                reel_id = str(r[0])
                docs.append(
                    build_reel_document(
                        caption=r[1] or "",
                        transcript=r[2] or "",
                        summary=r[3] or "",
                        tags=tags_map.get(reel_id, []),
                        author_name=r[4] or "",
                    )
                )

            try:
                embeddings = EmbeddingService.generate_embeddings_batch(
                    docs,
                    task_type="RETRIEVAL_DOCUMENT",
                    batch_size=len(docs),
                    allow_fallback=True,
                )
            except Exception as batch_exc:
                logger.warning("Batch failed (%s); falling back to item-by-item processing.", batch_exc)
                embeddings = []
                for doc in docs:
                    try:
                        embeddings.append(
                            EmbeddingService.generate_embedding(doc, task_type="RETRIEVAL_DOCUMENT")
                        )
                    except Exception as item_exc:
                        logger.error("Single item embedding failed: %s", item_exc)
                        embeddings.append((None, None))

            for r, (vec, model_name) in zip(batch, embeddings):
                reel_id = str(r[0])
                if vec is None or len(vec) != EMBEDDING_DIMENSION:
                    failed += 1
                    conn.run(
                        """
                        UPDATE reels
                        SET embedding_status = 'FAILED',
                            embedding_updated_at = NOW()
                        WHERE id::text = :id;
                        """,
                        id=reel_id,
                    )
                    continue

                vec_literal = format_pgvector(vec)
                conn.run(
                    """
                    UPDATE reels
                    SET embedding = CAST(:vec AS vector),
                        embedding_model = :model,
                        embedding_status = 'DONE',
                        embedding_updated_at = NOW()
                    WHERE id::text = :id;
                    """,
                    vec=vec_literal,
                    model=model_name,
                    id=reel_id,
                )
                succeeded += 1
                last_model = model_name

            if sleep_between_batches > 0 and start + batch_size < total_candidates:
                time.sleep(sleep_between_batches)

        result = {
            "total_candidates": total_candidates,
            "processed": succeeded + failed,
            "succeeded": succeeded,
            "failed": failed,
            "model": last_model,
        }
        logger.info("Embedding backfill complete: %s", result)
        return result
    finally:
        if owns_conn:
            conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill 768-d semantic embeddings for existing ReelVault reels.")
    parser.add_argument("--force", action="store_true", help="Regenerate embeddings even if valid embeddings already exist.")
    parser.add_argument("--batch-size", type=int, default=16, help="Number of reels per embedding batch.")
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of reels to process.")
    args = parser.parse_args()

    summary = backfill_embeddings(force=args.force, batch_size=args.batch_size, limit=args.limit)
    print(summary)
