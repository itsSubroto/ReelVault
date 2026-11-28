"""
Information Retrieval (IR) Evaluation Suite for ReelVault Semantic & Hybrid Search.

Computes Recall@1, Recall@3, Recall@5, MRR (Mean Reciprocal Rank), and NDCG@5.

Usage:
  Offline embedding benchmark (no running server required):
    python eval/evaluate_search.py

  Live backend API benchmark (compares keyword, semantic, and hybrid modes):
    python eval/evaluate_search.py --api-url http://localhost:8080 --token <JWT>
"""

import argparse
import json
import math
import os
import sys
from pathlib import Path
from typing import Optional

import requests

# Allow importing services.embedding_service when run from ai-service/ or ai-service/eval/
AI_SERVICE_DIR = Path(__file__).resolve().parent.parent
if str(AI_SERVICE_DIR) not in sys.path:
    sys.path.insert(0, str(AI_SERVICE_DIR))

from services.embedding_service import EmbeddingService, build_reel_document


def cosine_sim(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    return dot / (na * nb) if na > 1e-12 and nb > 1e-12 else 0.0


def keyword_score(query: str, doc: dict) -> float:
    tokens = [t.lower() for t in query.split() if len(t) >= 2]
    haystack = " ".join([
        doc.get("caption", ""),
        doc.get("summary", ""),
        doc.get("transcript", ""),
        " ".join(doc.get("tags", [])),
        doc.get("author_name", ""),
    ]).lower()
    return sum(1.0 for tok in tokens if tok in haystack)


def recall_at_k(ranked_ids: list[str], relevant: dict[str, int], k: int) -> float:
    rel_set = {doc_id for doc_id, grade in relevant.items() if grade > 0}
    if not rel_set:
        return 0.0
    hits = sum(1 for doc_id in ranked_ids[:k] if doc_id in rel_set)
    return hits / len(rel_set)


def mrr(ranked_ids: list[str], relevant: dict[str, int]) -> float:
    rel_set = {doc_id for doc_id, grade in relevant.items() if grade > 0}
    for idx, doc_id in enumerate(ranked_ids, start=1):
        if doc_id in rel_set:
            return 1.0 / idx
    return 0.0


def ndcg_at_k(ranked_ids: list[str], relevant: dict[str, int], k: int) -> float:
    dcg = 0.0
    for idx, doc_id in enumerate(ranked_ids[:k], start=1):
        rel = relevant.get(doc_id, 0)
        if rel > 0:
            dcg += (2 ** rel - 1) / math.log2(idx + 1)
    ideal_rels = sorted([g for g in relevant.values() if g > 0], reverse=True)[:k]
    idcg = sum((2 ** rel - 1) / math.log2(idx + 1) for idx, rel in enumerate(ideal_rels, start=1))
    return dcg / idcg if idcg > 0 else 0.0


def evaluate_offline(dataset: dict) -> dict:
    docs = dataset["documents"]
    queries = dataset["queries"]

    doc_vectors: dict[str, list[float]] = {}
    model_used = None
    for doc in docs:
        text = build_reel_document(
            caption=doc.get("caption", ""),
            transcript=doc.get("transcript", ""),
            summary=doc.get("summary", ""),
            tags=doc.get("tags", []),
            author_name=doc.get("author_name", ""),
        )
        vec, model_used = EmbeddingService.generate_embedding(text, task_type="RETRIEVAL_DOCUMENT")
        doc_vectors[doc["id"]] = vec

    results_by_mode = {"keyword": [], "semantic": [], "hybrid": []}

    for q_item in queries:
        q_text = q_item["query"]
        relevant = q_item["relevant"]
        q_vec, _ = EmbeddingService.generate_embedding(q_text, task_type="RETRIEVAL_QUERY")

        kw_ranked = [
            d["id"]
            for d in sorted(docs, key=lambda d: keyword_score(q_text, d), reverse=True)
            if keyword_score(q_text, d) > 0
        ]
        sem_ranked = [
            d["id"]
            for d in sorted(docs, key=lambda d: cosine_sim(q_vec, doc_vectors[d["id"]]), reverse=True)
        ]

        # RRF (k=60) matching SearchService.java
        rrf_scores: dict[str, float] = {}
        for rank, doc_id in enumerate(kw_ranked, start=1):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (60 + rank)
        for rank, doc_id in enumerate(sem_ranked, start=1):
            rrf_scores[doc_id] = rrf_scores.get(doc_id, 0.0) + 1.0 / (60 + rank)
        hyb_ranked = sorted(rrf_scores.keys(), key=lambda doc_id: rrf_scores[doc_id], reverse=True)

        for mode, ranked in [("keyword", kw_ranked), ("semantic", sem_ranked), ("hybrid", hyb_ranked)]:
            results_by_mode[mode].append({
                "recall@1": recall_at_k(ranked, relevant, 1),
                "recall@3": recall_at_k(ranked, relevant, 3),
                "recall@5": recall_at_k(ranked, relevant, 5),
                "mrr": mrr(ranked, relevant),
                "ndcg@5": ndcg_at_k(ranked, relevant, 5),
            })

    summary = {"model": model_used, "num_queries": len(queries), "modes": {}}
    for mode, rows in results_by_mode.items():
        n = len(rows)
        summary["modes"][mode] = {
            metric: round(sum(r[metric] for r in rows) / n, 4)
            for metric in ["recall@1", "recall@3", "recall@5", "mrr", "ndcg@5"]
        }
    return summary


def evaluate_live_api(dataset: dict, api_url: str, token: str) -> dict:
    headers = {"Authorization": f"Bearer {token}"}
    queries = dataset["queries"]
    results_by_mode = {"keyword": [], "semantic": [], "hybrid": []}

    for q_item in queries:
        q_text = q_item["query"]
        relevant = q_item["relevant"]
        for mode in ["keyword", "semantic", "hybrid"]:
            resp = requests.get(
                f"{api_url.rstrip('/')}/api/search",
                params={"q": q_text, "mode": mode, "limit": 10},
                headers=headers,
                timeout=15,
            )
            resp.raise_for_status()
            items = resp.json()
            ranked = [item.get("shortcode") or str(item.get("id")) for item in items]
            results_by_mode[mode].append({
                "recall@1": recall_at_k(ranked, relevant, 1),
                "recall@3": recall_at_k(ranked, relevant, 3),
                "recall@5": recall_at_k(ranked, relevant, 5),
                "mrr": mrr(ranked, relevant),
                "ndcg@5": ndcg_at_k(ranked, relevant, 5),
            })

    summary = {"api_url": api_url, "num_queries": len(queries), "modes": {}}
    for mode, rows in results_by_mode.items():
        n = len(rows)
        summary["modes"][mode] = {
            metric: round(sum(r[metric] for r in rows) / n, 4)
            for metric in ["recall@1", "recall@3", "recall@5", "mrr", "ndcg@5"]
        }
    return summary


def main():
    parser = argparse.ArgumentParser(description="Evaluate ReelVault search quality (Recall@K, MRR, NDCG@5)")
    parser.add_argument("--dataset", default=str(Path(__file__).with_name("dataset.json")), help="Path to eval dataset JSON")
    parser.add_argument("--api-url", default=None, help="Optional live backend URL (e.g. http://localhost:8080)")
    parser.add_argument("--token", default=None, help="JWT bearer token when using --api-url")
    parser.add_argument("--output", default=None, help="Optional path to write JSON report")
    args = parser.parse_args()

    with open(args.dataset, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    if args.api_url:
        if not args.token:
            raise SystemExit("--token is required when --api-url is provided")
        report = evaluate_live_api(dataset, args.api_url, args.token)
    else:
        report = evaluate_offline(dataset)

    print("\n=== ReelVault Search Evaluation Report ===")
    print(f"Queries: {report['num_queries']} | Source: {report.get('model') or report.get('api_url')}")
    print(f"{'Mode':<10} {'Recall@1':>10} {'Recall@3':>10} {'Recall@5':>10} {'MRR':>10} {'NDCG@5':>10}")
    print("-" * 64)
    for mode, metrics in report["modes"].items():
        print(
            f"{mode:<10} "
            f"{metrics['recall@1']:>10.4f} "
            f"{metrics['recall@3']:>10.4f} "
            f"{metrics['recall@5']:>10.4f} "
            f"{metrics['mrr']:>10.4f} "
            f"{metrics['ndcg@5']:>10.4f}"
        )

    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2)
        print(f"\nSaved report to {args.output}")


if __name__ == "__main__":
    main()
