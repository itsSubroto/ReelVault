import os
import re
import logging
import tempfile
import requests
from .metadata import MetadataService

logger = logging.getLogger("ai_service.pipeline")

class AiPipelineService:

    @classmethod
    def process_reel(cls, reel_id: str, instagram_url: str, spring_boot_url: str = "http://localhost:8080"):
        """
        Full Phase 2 Pipeline:
        1. Extract real metadata (thumbnail, caption, author) with yt-dlp.
        2. Immediately PATCH Spring Boot so the user sees the real thumbnail and caption right away!
        3. Extract audio and transcribe via Whisper.
        4. Summarize and generate tags (LLM + smart NLP fallback).
        5. PATCH Spring Boot with transcript, summary, tags, and status='DONE'.
        """
        logger.info(f"Starting processing pipeline for reel {reel_id} ({instagram_url})")

        # Step 1: Metadata Extraction
        meta = MetadataService.extract_reel_metadata(instagram_url)
        caption = meta.get('caption', '')
        thumbnail_url = meta.get('thumbnail_url')
        author_name = meta.get('author_name')

        # Step 2: Immediate Patch to Spring Boot (Thumbnail & Caption live!)
        try:
            cls._patch_spring_boot(
                f"{spring_boot_url}/api/reels/{reel_id}",
                {
                    "caption": caption,
                    "thumbnailUrl": thumbnail_url,
                    "authorName": author_name,
                    "status": "PROCESSING",
                }
            )
            logger.info(f"Updated reel {reel_id} with initial metadata and PROCESSING status")
        except Exception as e:
            logger.error(f"Failed to send initial PATCH to Spring Boot for reel {reel_id}: {e}")

        # Step 3: Transcription (Whisper / Audio extraction)
        transcript = cls._transcribe(instagram_url, caption)

        # Step 4: AI Summarization and Tag Generation
        summary, tags = cls._generate_summary_and_tags(caption, transcript)

        # Step 5: Final Patch with Full AI Data and status='DONE'
        try:
            cls._patch_spring_boot(
                f"{spring_boot_url}/api/reels/{reel_id}",
                {
                    "caption": caption,
                    "thumbnailUrl": thumbnail_url,
                    "authorName": author_name,
                    "transcript": transcript,
                    "summary": summary,
                    "tags": tags,
                    "status": "DONE",
                }
            )
            logger.info(f"Completed processing for reel {reel_id}, marked as DONE with {len(tags)} tags")
        except Exception as e:
            logger.error(f"Failed to send final PATCH to Spring Boot for reel {reel_id}: {e}")
            try:
                cls._patch_spring_boot(
                    f"{spring_boot_url}/api/reels/{reel_id}",
                    {"status": "FAILED"}
                )
            except Exception:
                pass

    @classmethod
    def _transcribe(cls, instagram_url: str, fallback_caption: str) -> str:
        """
        Attempts audio download and transcription via Whisper.
        Falls back to caption context if Whisper or ffmpeg is not installed.
        """
        try:
            import whisper
            import yt_dlp

            with tempfile.TemporaryDirectory() as tmpdir:
                audio_path = os.path.join(tmpdir, "audio.mp3")
                ydl_opts = {
                    'format': 'bestaudio/best',
                    'outtmpl': audio_path,
                    'quiet': True,
                    'no_warnings': True,
                }
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([instagram_url])

                if os.path.exists(audio_path):
                    model = whisper.load_model("base")
                    result = model.transcribe(audio_path)
                    text = result.get('text', '').strip()
                    if text:
                        return text
        except Exception as e:
            logger.debug(f"Audio transcription bypassed ({e}). Using caption context.")

        return fallback_caption if fallback_caption else "No spoken audio transcript available."

    @classmethod
    def _generate_summary_and_tags(cls, caption: str, transcript: str) -> tuple[str, list[str]]:
        """
        Generates 1-2 sentence summary and list of tags.
        Uses OpenAI/Claude/Gemini if API key is provided, or smart NLP heuristic fallback.
        """
        openai_key = os.getenv('OPENAI_API_KEY', '')
        if openai_key:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=openai_key)
                prompt = (
                    f"Summarize this Instagram reel content in 1 concise sentence and extract 4-6 relevant single-word tags.\n"
                    f"Caption: {caption}\nTranscript: {transcript}\n\n"
                    f"Respond in format:\nSummary: <summary>\nTags: tag1, tag2, tag3"
                )
                res = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                )
                content = res.choices[0].message.content or ""
                summary_match = re.search(r'Summary:\s*(.+)', content)
                tags_match = re.search(r'Tags:\s*(.+)', content)

                summary = summary_match.group(1).strip() if summary_match else caption[:150]
                tags = [t.strip().lstrip('#').lower() for t in tags_match.group(1).split(',') if t.strip()] if tags_match else []
                return summary, tags
            except Exception as e:
                logger.warning(f"LLM API call failed, using local NLP extractor: {e}")

        # Smart rule-based / hashtag NLP fallback
        hashtags = [tag.lstrip('#').lower() for tag in re.findall(r'#(\w+)', caption)]

        words = re.findall(r'\b[a-zA-Z]{4,}\b', caption.lower())
        stopwords = {'this', 'that', 'with', 'from', 'have', 'more', 'your', 'about', 'link', 'follow', 'check', 'video', 'reel', 'like', 'comment'}
        keywords = [w for w in words if w not in stopwords]

        combined_tags = list(dict.fromkeys(hashtags + keywords))[:6]

        clean_lines = [line.strip() for line in caption.split('\n') if line.strip() and not line.startswith('#')]
        summary = clean_lines[0] if clean_lines else "Saved Instagram reel."
        if len(summary) > 160:
            summary = summary[:157] + "..."

        return summary, combined_tags

    @staticmethod
    def _patch_spring_boot(url: str, data: dict):
        resp = requests.patch(url, json=data, timeout=10)
        resp.raise_for_status()
        return resp.json()
