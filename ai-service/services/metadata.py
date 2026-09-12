import logging
import re
import yt_dlp

logger = logging.getLogger("ai_service.metadata")

class MetadataService:
    @staticmethod
    def extract_shortcode(url: str) -> str:
        match = re.search(r'(?:instagram\.com/(?:reel|reels|p)/)([a-zA-Z0-9_-]+)', url)
        return match.group(1) if match else "unknown"

    @classmethod
    def extract_reel_metadata(cls, url: str) -> dict:
        """
        Extracts real high-resolution thumbnail URL, full caption, and creator name via yt-dlp.
        Works without any Meta Developer App or Instagram Access Token!
        """
        shortcode = cls.extract_shortcode(url)
        clean_url = f"https://www.instagram.com/reel/{shortcode}/"

        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'no_warnings': True,
            'extract_flat': False,
        }

        try:
            logger.info(f"Extracting metadata via yt-dlp for shortcode: {shortcode}")
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(clean_url, download=False)

                caption = info.get('description') or info.get('title') or f"Instagram Reel ({shortcode})"
                thumbnail_url = info.get('thumbnail')
                author_name = info.get('uploader') or info.get('uploader_id') or "Instagram Creator"

                logger.info(f"Successfully extracted metadata for {shortcode}: author={author_name}, thumb={'yes' if thumbnail_url else 'no'}")
                return {
                    'shortcode': shortcode,
                    'caption': caption.strip(),
                    'thumbnail_url': thumbnail_url,
                    'author_name': author_name,
                    'duration': info.get('duration'),
                }
        except Exception as e:
            logger.error(f"yt-dlp extraction failed for {url}: {e}")
            return {
                'shortcode': shortcode,
                'caption': f"Saved Instagram Reel ({shortcode})",
                'thumbnail_url': None,
                'author_name': "Instagram Creator",
                'duration': None,
            }
