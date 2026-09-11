# Reel Search — Project Plan

## The Idea

Instagram reels dekhte waqt bahut saari useful/informative reels milti hain — tech tips, movie recommendations, tutorials, etc. Instagram ka "Save" feature collections mein organize karne deta hai (jaise "Tech", "Movies"), lekin **kisi bhi collection ke andar keyword search karna possible nahi hai**. Agar kaafi mahine baad ek particular topic wali reel wapas dhoondni ho, to scroll karke manually dhoondhne ke alawa koi rasta nahi — jo bahut time-consuming aur frustrating hai.

**Goal:** Ek web app banana jahan reels ko save karke, unke content (caption + transcript + AI summary) ke basis par keyword se search kiya ja sake — taaki koi bhi purani saved reel seconds mein mil jaaye.

Yeh ek **learning project** bhi hai — do log alag-alag stacks (Java/Spring Boot aur Python/Django) mil ke seekhte hue ek real, daily-use tool banayenge.

---

## Team & Tech Stack

| Person | Stack | Responsibility |
|---|---|---|
| Dev 1 | **Spring Boot (Java)** | Core public-facing REST API — collections, reels, search |
| Dev 2 | **Django / Python** | Background processing service — transcript, summary, tagging |
| Both | **React** | Frontend — save page, browse/search page |

**Platform decision:** Web-only for now. No native Android app. A **Chrome extension** is a possible future addition (Phase 3) to make saving reels faster directly from Instagram, but not part of the MVP.

**Other tools:**
- **PostgreSQL** — main database (with full-text search for keyword matching)
- **yt-dlp** — download reel video from an Instagram URL
- **Whisper** — speech-to-text transcription
- **LLM API** (Claude/GPT) — summarization + auto-tagging
- **Instagram oEmbed API** — fetch caption + thumbnail without downloading video (used early, before AI processing)
- **Docker Compose** — run all services together locally
- **Railway/Render** (backend) + **Vercel** (frontend) — deployment

---

## Phase 1 — MVP (Web only, manual link save)

**Goal:** Prove the core loop works — save a reel, find it later by keyword.

- [x] Finalize API contract & data model (done — see `api-contract-data-model.md`)
- [x] Spring Boot: collections CRUD (`POST/GET /collections`)
- [x] Spring Boot: save a reel by pasting its Instagram link (`POST /reels`), fetch caption + thumbnail via oEmbed
- [x] Spring Boot: list reels within a collection (`GET /reels?collection_id=`)
- [x] Spring Boot: basic keyword search over caption (`GET /search?q=`)
- [x] React: Save page — paste link, choose collection, submit
- [x] React: Browse/Search page — collections list, reel grid with thumbnails, search bar
- [ ] Deploy all three (Spring Boot, Postgres, React) and start using it daily for real

**What's intentionally missing in Phase 1:** No transcript, no AI summary, no Python service yet. Search only works over the Instagram caption — this alone solves a big chunk of the problem and gets something usable in front of you fast.

---

## Phase 2 — AI-Powered Search (add the Python service)

**Goal:** Make search work even when the caption doesn't mention the keyword — i.e., search what's actually *said* in the reel.

- [ ] Python service: `/process-reel` endpoint — download video (yt-dlp), transcribe (Whisper)
- [ ] Python service: summarize + auto-generate tags via LLM
- [ ] Python service: call back to Spring Boot (`PATCH /reels/{id}`) with transcript, summary, tags
- [ ] Spring Boot: trigger the Python service asynchronously right after a reel is saved
- [ ] Spring Boot: extend search to cover transcript + summary + tags (not just caption)
- [ ] Add a `status` indicator in the UI (pending / processing / done) so you know when a reel is searchable
- [ ] Handle failures gracefully (retry or mark `failed` instead of getting stuck)

**Outcome:** Search a keyword like "fast downloader" and get reels where that phrase was only spoken in the video, never written in the caption.

---

## Phase 3 — Faster Saving & Polish

**Goal:** Remove friction from the "paste a link" step, and make the tool nice enough to potentially share with others.

- [ ] **Chrome extension** — adds a "Save to [App]" button directly on Instagram, skips the copy-paste step
- [ ] Better search — move from basic keyword match to Postgres full-text ranking, or embeddings-based semantic search (find reels by meaning, not just exact words)
- [ ] Multi-user support + proper auth (if you decide to open this up beyond the two of you)
- [ ] UI polish — better thumbnails, tag filters, sort by date/collection
- [ ] Rate-limiting / cost controls on the AI pipeline (Whisper + LLM calls add up if usage grows)

**Not planned yet, revisit only if Phase 3 is reached:** native Android/iOS app, public multi-tenant product, monetization.

---

## Guiding Principles
1. **Ship Phase 1 before touching Phase 2.** The temptation will be to jump straight to AI — resist it. A working manual-save + caption-search tool is already useful on day one.
2. **Services stay decoupled.** Spring Boot never touches Python's internals and vice versa — they only talk via the REST contract. This lets both of you work in parallel without blocking each other.
3. **Use it yourselves daily.** The best signal for what to build next comes from your own real usage, not from planning further ahead than necessary.
