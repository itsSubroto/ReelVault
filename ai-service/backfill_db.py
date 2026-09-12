import sys
import os
import pg8000.native

sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from services.metadata import MetadataService
from services.ai_pipeline import AiPipelineService

def run_backfill():
    print("Connecting to PostgreSQL using pg8000 on port 5433...")
    conn = pg8000.native.Connection(
        user='postgres',
        host='localhost',
        port=5433,
        database='reelvault',
        password='password'
    )

    rows = conn.run("SELECT id, shortcode, instagram_url FROM reels;")
    print(f"Found {len(rows)} reels in database.")

    for row in rows:
        reel_id = str(row[0])
        shortcode = row[1]
        url = row[2]
        print(f"\nProcessing reel: {shortcode} ({url})...")

        meta = MetadataService.extract_reel_metadata(url)
        caption = meta.get('caption', '')
        thumbnail_url = meta.get('thumbnail_url', '')
        author_name = meta.get('author_name', 'Instagram Creator')

        summary, tags = AiPipelineService._generate_summary_and_tags(caption, "")
        print(f"  -> Author: {author_name}")
        print(f"  -> Thumbnail: {'Found' if thumbnail_url else 'None'}")
        print(f"  -> Summary: {summary[:60]}...")
        print(f"  -> Tags: {tags}")

        # Update reel
        conn.run(
            "UPDATE reels SET caption = :caption, thumbnail_url = :thumb, author_name = :author, summary = :summary, status = 'DONE' WHERE id = :id;",
            caption=caption,
            thumb=thumbnail_url,
            author=author_name,
            summary=summary,
            id=reel_id
        )

        # Clear and insert tags
        conn.run("DELETE FROM reel_tags WHERE reel_id = :id;", id=reel_id)
        for tag in tags:
            conn.run("INSERT INTO reel_tags (reel_id, tag) VALUES (:id, :tag);", id=reel_id, tag=tag)

        print(f"  Successfully updated {shortcode} in database!")

    print("\nBackfill complete! All database reels now have real metadata, thumbnails, and tags.")

if __name__ == '__main__':
    run_backfill()
