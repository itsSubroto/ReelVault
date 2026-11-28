import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from main import app
from services.metadata import MetadataService

client = TestClient(app)

def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "FastAPI" in data["service"]

def test_metadata_endpoint():
    dummy_meta = {
        "platform": "instagram",
        "shortcode": "test123",
        "caption": "Test reel caption #movies",
        "thumbnail_url": "https://example.com/thumb.jpg",
        "author_name": "TestCreator",
        "duration": 30
    }
    with patch("services.metadata.MetadataService.extract_reel_metadata", return_value=dummy_meta):
        response = client.get("/api/metadata?url=https://www.instagram.com/reel/test123/")
        assert response.status_code == 200
        data = response.json()
        assert data["shortcode"] == "test123"
        assert data["author_name"] == "TestCreator"
        assert data["thumbnail_url"] == "https://example.com/thumb.jpg"

def test_metadata_youtube_shorts():
    dummy_meta = {
        "platform": "youtube",
        "shortcode": "abcXYZ",
        "caption": "Cool YouTube Short",
        "thumbnail_url": "https://i.ytimg.com/vi/abcXYZ/hqdefault.jpg",
        "author_name": "TechChannel",
        "duration": 45
    }
    with patch("services.metadata.MetadataService.extract_reel_metadata", return_value=dummy_meta):
        response = client.get("/api/metadata?url=https://www.youtube.com/shorts/abcXYZ")
        assert response.status_code == 200
        data = response.json()
        assert data["platform"] == "youtube"
        assert data["shortcode"] == "abcXYZ"

def test_parse_url_recursive_unquote():
    platform, shortcode, clean = MetadataService.parse_video_url("https%253A%252F%252Fwww.instagram.com%252Freel%252FDb3bkwPsp4K%252F")
    assert platform == "instagram"
    assert shortcode == "Db3bkwPsp4K"
    assert clean == "https://www.instagram.com/reel/Db3bkwPsp4K/"

def test_process_reel_endpoint():
    with patch("services.ai_pipeline.AiPipelineService.process_reel") as mock_pipeline:
        payload = {
            "reel_id": "01afa4c2-0f6c-49da-ada3-889d305b4f87",
            "instagram_url": "https://www.instagram.com/reel/DdHSjEgNhPV/"
        }
        response = client.post("/api/process-reel", json=payload)
        assert response.status_code == 202
        data = response.json()
        assert data["status"] == "ACCEPTED"
        assert data["reel_id"] == payload["reel_id"]


def test_embeddings_endpoint_and_semantic_similarity():
    from services.embedding_service import EmbeddingService, EMBEDDING_DIMENSION
    import math

    # Local fallback works even without external API keys
    with patch.dict("os.environ", {"GEMINI_API_KEY": "", "OPENAI_API_KEY": ""}, clear=False):
        res1 = client.post("/api/embeddings", json={
            "text": "Docker container orchestration with Kubernetes pods for microservices",
            "task_type": "RETRIEVAL_DOCUMENT"
        })
        assert res1.status_code == 200
        d1 = res1.json()
        assert d1["dimensions"] == EMBEDDING_DIMENSION
        assert len(d1["embedding"]) == EMBEDDING_DIMENSION
        norm = math.sqrt(sum(x * x for x in d1["embedding"]))
        assert abs(norm - 1.0) < 1e-4

        vec_query, _ = EmbeddingService.generate_embedding("how to deploy containers using k8s", task_type="RETRIEVAL_QUERY")
        vec_unrelated, _ = EmbeddingService.generate_embedding("paneer tikka masala recipe for dinner", task_type="RETRIEVAL_DOCUMENT")

        sim_related = sum(a * b for a, b in zip(d1["embedding"], vec_query))
        sim_unrelated = sum(a * b for a, b in zip(vec_unrelated, vec_query))
        assert sim_related > sim_unrelated
