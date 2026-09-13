import logging
import re
import urllib.parse
import yt_dlp

logger = logging.getLogger("ai_service.metadata")

INSTAGRAM_PATTERN = re.compile(r'(?:instagram\.com/(?:reel|reels|p)/)([a-zA-Z0-9_-]+)', re.IGNORECASE)
YOUTUBE_PATTERN = re.compile(r'(?:youtube\.com/shorts/|youtu\.be/|youtube\.com/watch\?v=)([a-zA-Z0-9_-]+)', re.IGNORECASE)

class MetadataService:
    @staticmethod
    def clean_and_unquote_url(url: str) -> str:
        """
        Recursively unquotes URL to prevent issues with single or double-encoded URLs.
        """
        prev = ""
        curr = url.strip() if url else ""
        while prev != curr:
            prev = curr
            curr = urllib.parse.unquote(curr)
        return curr

    @classmethod
    def parse_video_url(cls, raw_url: str) -> tuple[str, str, str]:
        """
        Detects platform and extracts shortcode and canonical clean URL.
        Returns: (platform, shortcode, clean_url)
        """
        clean_url = cls.clean_and_unquote_url(raw_url)

        # 1. Instagram
        ig_match = INSTAGRAM_PATTERN.search(clean_url)
        if ig_match:
            shortcode = ig_match.group(1)
            return "instagram", shortcode, f"https://www.instagram.com/reel/{shortcode}/"

        # 2. YouTube Shorts / Video
        yt_match = YOUTUBE_PATTERN.search(clean_url)
        if yt_match:
            shortcode = yt_match.group(1)
            return "youtube", shortcode, f"https://www.youtube.com/shorts/{shortcode}"

        return "unknown", "unknown", clean_url

    @classmethod
    def extract_reel_metadata(cls, url: str) -> dict:
        """
        Extracts real high-resolution thumbnail URL, full caption, and creator name via yt-dlp.
        Works for both Instagram Reels and YouTube Shorts without requiring any API keys.
        """
        platform, shortcode, clean_url = cls.parse_video_url(url)

        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'no_warnings': True,
            'extract_flat': False,
        }

        fallback_name = "YouTube Creator" if platform == "youtube" else "Instagram Creator"
        fallback_title = f"Saved YouTube Short ({shortcode})" if platform == "youtube" else f"Saved Instagram Reel ({shortcode})"

        try:
            logger.info(f"Extracting metadata via yt-dlp for [{platform}] shortcode: {shortcode}")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean_url, download=False)

                caption = info.get('description') or info.get('title') or fallback_title
                thumbnail_url = info.get('thumbnail')
                author_name = info.get('uploader') or info.get('channel') or info.get('uploader_id') or fallback_name

                logger.info(f"Successfully extracted metadata for {shortcode}: platform={platform}, author={author_name}, thumb={'yes' if thumbnail_url else 'no'}")
                return {
                    'platform': platform,
                    'shortcode': shortcode,
                    'caption': caption.strip(),
                    'thumbnail_url': thumbnail_url,
                    'author_name': author_name,
                    'duration': info.get('duration'),
                }
        except Exception as e:
            logger.error(f"yt-dlp extraction failed for {url} ({clean_url}): {e}")
            return {
                'platform': platform,
                'shortcode': shortcode,
                'caption': fallback_title,
                'thumbnail_url': None,
                'author_name': fallback_name,
                'duration': None,
            }

