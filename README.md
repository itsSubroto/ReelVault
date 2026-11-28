# ReelVault 🎬

ReelVault is a full-stack web application designed to save and organize Instagram Reels, YouTube Videos, and YouTube Shorts into collections and instantly find them using **hybrid semantic + full-text search** over captions, speech transcripts, AI summaries, and tags.

---

## Tech Stack

- **Core REST API:** Java 21, Spring Boot 4, Spring Data JPA, PostgreSQL Driver, Lombok, Jackson
- **AI Processing Service:** Python 3.14, FastAPI, Uvicorn, yt-dlp, Whisper
- **Database:** PostgreSQL 18
- **Frontend:** React 19, Vite, Tailwind CSS v4, Lucide Icons
- **Deployment & Orchestration:** Docker Compose, Nginx

---

## Project Structure

```
ReelVault/
├── api-contract-data-model.md     # Shared API contract & schema spec
├── project-plan.md                # Project roadmap and phases
├── docker-compose.yml             # Local multi-container setup
├── backend/                       # Spring Boot Core REST API (:8080)
│   ├── mvnw, mvnw.cmd             # Maven wrapper
│   ├── pom.xml
│   └── src/
│       ├── main/java/com/reelvault/
│       │   ├── config/            # CORS and Jackson configs
│       │   ├── controller/        # Collections, Reels, Search controllers
│       │   ├── dto/               # Request & Response records
│       │   ├── entity/            # JPA entities (Collection, Reel, ReelStatus)
│       │   ├── repository/        # Spring Data repositories
│       │   └── service/           # Business logic & Instagram metadata fetcher
│       └── test/                  # Full integration test suite
├── ai-service/                    # FastAPI AI Processing Service (:8000)
│   ├── main.py                    # FastAPI application & REST endpoints
│   ├── requirements.txt
│   ├── backfill_db.py             # Direct database sync script
│   └── services/
│       ├── metadata.py            # yt-dlp metadata & thumbnail extraction
│       └── ai_pipeline.py         # Whisper transcription & LLM summarization
├── extension/                     # Chrome Extension (Manifest V3)
│   ├── manifest.json              # Extension manifest & permissions
│   ├── background.js              # Service worker (auth & API proxy)
│   ├── content.js, content.css    # In-page floating button & collection popup
│   ├── popup.html, popup.js       # Toolbar popup interface
│   └── icons/                     # Extension branding icons
└── frontend/                      # React 19 + Vite Frontend (:5173)
    ├── package.json
    ├── vite.config.js             # Vite config with API proxy to :8080
    └── src/
        ├── api/client.js          # Centralized API service
        ├── components/
        │   ├── Navbar.jsx         # Search bar, Save Reel & Sync AI buttons
        │   ├── Sidebar.jsx        # Collections list & reel counts
        │   ├── ReelCard.jsx       # Reel card with CDN image fix, AI summary & tags
        │   ├── ReelGrid.jsx       # Responsive grid with empty states
        │   ├── SaveReelModal.jsx  # Link input modal with collection selector
        │   └── CreateCollectionModal.jsx
        ├── App.jsx
        └── index.css
```

---

## Quick Start (Local Development)

### 1. Database
PostgreSQL 18 is running on `localhost:5433` (database: `reelvault`, username: `postgres`, password: `password`).

### 2. Run Backend (Spring Boot)
Open a terminal in `backend/`:
```bash
cd backend
./mvnw spring-boot:run
```
*(On Windows PowerShell: `.\mvnw.cmd spring-boot:run`)*
The API will be live at `http://localhost:8080`.

### 3. Run AI Processing Service (FastAPI)
Open a terminal in `ai-service/`:
```bash
cd ai-service
uvicorn main:app --port 8000 --reload

or 

python -m uvicorn main:app --port 8000 --reload   
```
The FastAPI service will be live at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).

### 4. Run Frontend (React + Vite)
Open a terminal in `frontend/`:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

### 5. Install Browser Extension (Chrome / Edge / Brave)
1. Open `chrome://extensions` (or `edge://extensions` / `brave://extensions`).
2. Toggle **Developer mode** to **ON** in the top right.
3. Click **Load unpacked** and select the `extension/` folder in this repo.
4. Pin the extension to your browser toolbar.
5. Browse YouTube or Instagram to use the floating **"Save to ReelVault"** button and collection selector window!

---

## Running with Docker Compose

To start all services together:
```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8080`
- AI Service: `http://localhost:8000`
- PostgreSQL: `localhost:5433`

---

## Semantic Search & Embeddings

ReelVault uses **PostgreSQL + `pgvector` (`pgvector/pgvector:pg18`)** with **768-dimensional embeddings** and **Reciprocal Rank Fusion (RRF)** to automatically combine semantic meaning with exact keyword matching—no separate search engine (like Elasticsearch) or UI mode toggle is required.

### Environment Variables
- `GEMINI_API_KEY` *(optional)*: Primary embedding provider (`gemini-embedding-001`, 768-d).
- `OPENAI_API_KEY` *(optional)*: Secondary embedding provider (`text-embedding-3-small`, 768-d).
- If neither key is set, `ai-service` automatically falls back to a deterministic local 768-d semantic hash embedder.
- `ADMIN_API_SECRET`: Secret header (`X-Admin-Secret`) protecting `/api/admin/embeddings/*` endpoints (default `reelvault-admin-secret` for local dev).

### Backfilling Existing Reels
```bash
# Via Python CLI in ai-service/
cd ai-service
python backfill_embeddings.py

# Or via Backend Admin API
curl -X POST http://localhost:8080/api/admin/embeddings/backfill -H "X-Admin-Secret: reelvault-admin-secret"
```

### Search Quality Evaluation (Recall@K, MRR, NDCG@5)
```bash
cd ai-service
python eval/evaluate_search.py
```

---

## Running Tests

- **Backend:** `cd backend && ./mvnw test`
- **AI Service:** `cd ai-service && python -m pytest`
