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
        Generates 1-2 sentence informative summary and list of tags.
        Order of precedence:
        1. Google Gemini (GEMINI_API_KEY / GOOGLE_API_KEY)
        2. OpenAI (OPENAI_API_KEY)
        3. Intelligent Local NLP Engine (heuristics, promo filtering, transcript keyword mining)
        """
        prompt = (
            "Summarize the core topic of this video in 1-2 clear, informative sentences (avoid clickbait hooks or promo phrases).\n"
            "Then extract 4-6 relevant single-word lowercase tags derived from the summary and transcript.\n\n"
            f"Caption:\n{caption}\n\n"
            f"Spoken Transcript:\n{transcript}\n\n"
            "Format your response EXACTLY as:\n"
            "Summary: <1-2 sentence summary>\n"
            "Tags: <comma-separated tags>"
        )

        # 1. Try Google Gemini API (zero external SDK dependencies needed)
        gemini_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY')
        if gemini_key:
            try:
                gemini_url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={gemini_key}"
                resp = requests.post(
                    gemini_url,
                    json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"temperature": 0.2, "maxOutputTokens": 200}
                    },
                    timeout=12
                )
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        text = candidates[0]["content"]["parts"][0].get("text", "")
                        summary_match = re.search(r'Summary:\s*(.+?)(?:\n|Tags:|$)', text, re.DOTALL)
                        tags_match = re.search(r'Tags:\s*(.+)', text)
                        if summary_match and tags_match:
                            summary = summary_match.group(1).strip()
                            tags = [t.strip().lstrip('#').lower() for t in tags_match.group(1).split(',') if t.strip()]
                            logger.info("Generated high-quality summary and tags using Google Gemini API")
                            return summary, tags[:6]
            except Exception as e:
                logger.warning(f"Gemini API summarization failed ({e}). Proceeding to fallback.")

        # 2. Try OpenAI API
        openai_key = os.getenv('OPENAI_API_KEY', '')
        if openai_key:
            try:
                from openai import OpenAI
                client = OpenAI(api_key=openai_key)
                res = client.chat.completions.create(
                    model="gpt-4o-mini",
                    messages=[{"role": "user", "content": prompt}],
                    temperature=0.3,
                )
                content = res.choices[0].message.content or ""
                summary_match = re.search(r'Summary:\s*(.+?)(?:\n|Tags:|$)', content, re.DOTALL)
                tags_match = re.search(r'Tags:\s*(.+)', content)

                summary = summary_match.group(1).strip() if summary_match else ""
                tags = [t.strip().lstrip('#').lower() for t in tags_match.group(1).split(',') if t.strip()] if tags_match else []
                if summary:
                    logger.info("Generated summary and tags using OpenAI API")
                    return summary, tags[:6]
            except Exception as e:
                logger.warning(f"OpenAI API call failed ({e}). Proceeding to local NLP engine.")

        # 3. Intelligent Local NLP Engine (Offline / No API Key required)
        logger.info("Running local NLP pipeline for summarization and tag extraction")
        return cls._local_nlp_summary_and_tags(caption, transcript)

    @classmethod
    def _local_nlp_summary_and_tags(cls, caption: str, transcript: str) -> tuple[str, list[str]]:
        """
        Cleans clickbait, filters promotional lines, synthesizes meaningful summary,
        and generates topical tags strictly from summary and transcript content.
        """
        promo_patterns = [
            r'link\s*(in|on)\s*(bio|description)',
            r'follow\s*(@|for)',
            r'tap\s*the\s*link',
            r'dm\s*for',
            r'comment\s*below',
            r'sale\s*is\s*live',
            r'use\s*code',
            r'discount',
            r'flat\s*\d+%',
            r'credit\s*:',
            r'subscribe\s*to',
            r'save\s*this',
            r'share\s*with',
            r'double\s*tap',
        ]
        promo_regex = re.compile('|'.join(promo_patterns), re.IGNORECASE)

        # Clean lines
        informative_lines = []
        for raw_line in caption.split('\n'):
            line = raw_line.strip()
            if not line:
                continue
            if line.startswith('#'):
                continue
            # Remove URLs and handles
            clean = re.sub(r'https?://\S+|www\.\S+|@\w+', '', line).strip()
            # Remove emojis and excessive symbols
            clean = re.sub(r'[^\w\s.,?!:;\'"()-]', '', clean).strip()
            # Skip promotional or clickbait spam lines
            if promo_regex.search(line) or len(clean.split()) < 3:
                continue
            informative_lines.append(clean)

        # Synthesize summary:
        # If spoken transcript is available and informative, prioritize it
        has_real_transcript = transcript and "No spoken audio transcript available" not in transcript and len(transcript.strip()) > 20
        if has_real_transcript:
            clean_transcript = re.sub(r'\s+', ' ', transcript).strip()
            sentences = re.split(r'(?<=[.?!])\s+', clean_transcript)
            summary = ' '.join(sentences[:2]) if sentences else clean_transcript[:180]
        elif informative_lines:
            # Pick the most substantial informative sentences (avoid short 1-3 word hooks)
            chosen = sorted(informative_lines[:4], key=lambda l: len(l), reverse=True)
            summary = chosen[0]
            if len(chosen) > 1 and len(summary) < 90:
                summary += " " + chosen[1]
        else:
            # Fallback: clean whatever text is available
            cleaned_caption = re.sub(r'#\w+|https?://\S+', '', caption).strip()
            summary = cleaned_caption.split('\n')[0] if cleaned_caption else "Saved video post."

        if len(summary) > 200:
            summary = summary[:197].rsplit(' ', 1)[0] + "..."

        # Tag Generation strictly derived from summary and transcript
        text_for_tags = f"{summary} {transcript if has_real_transcript else ''}".lower()
        extracted_words = re.findall(r'\b[a-zA-Z]{4,}\b', text_for_tags)

        stopwords = {
            'this', 'that', 'with', 'from', 'have', 'more', 'your', 'about', 'link', 'follow',
            'check', 'video', 'reel', 'like', 'comment', 'here', 'what', 'when', 'where',
            'which', 'will', 'make', 'just', 'look', 'their', 'there', 'they', 'them', 'some',
            'saved', 'post', 'instagram', 'youtube', 'short', 'shorts', 'watch', 'want', 'know',
            'give', 'good', 'best', 'great', 'also', 'then', 'than', 'into', 'only', 'over'
        }

        # Also extract relevant hashtags from the caption if they match topical words
        caption_hashtags = [tag.lstrip('#').lower() for tag in re.findall(r'#(\w+)', caption) if len(tag) > 3 and tag.lower() not in stopwords]

        # Calculate word frequencies for summary/transcript
        word_freq = {}
        for w in extracted_words:
            if w not in stopwords:
                word_freq[w] = word_freq.get(w, 0) + 1

        sorted_words = sorted(word_freq.keys(), key=lambda w: word_freq[w], reverse=True)

        combined_tags = list(dict.fromkeys(caption_hashtags[:3] + sorted_words))[:6]
        if not combined_tags:
            combined_tags = ["video", "content"]

        return summary, combined_tags

    @staticmethod
    def _patch_spring_boot(url: str, data: dict):
        resp = requests.patch(url, json=data, timeout=10)
        resp.raise_for_status()
        return resp.json()
