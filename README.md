# ReelVault 🎬

ReelVault is a full-stack web application designed to save and organize Instagram reels into collections and instantly find them using keyword search over captions (and speech transcripts + AI summaries in Phase 2).

---

## Tech Stack

- **Backend:** Java 21, Spring Boot 4, Spring Data JPA, PostgreSQL Driver, Lombok, Jackson
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
├── backend/                       # Spring Boot REST API
│   ├── mvnw, mvnw.cmd             # Maven wrapper
│   ├── pom.xml
│   └── src/
│       ├── main/java/com/reelvault/
│       │   ├── config/            # CORS and Jackson configs
│       │   ├── controller/        # Collections, Reels, Search controllers
│       │   ├── dto/               # Request & Response records
│       │   ├── entity/            # JPA entities (Collection, Reel, ReelStatus)
│       │   ├── exception/         # Exception handlers & error models
│       │   ├── repository/        # Spring Data repositories
│       │   └── service/           # Business logic & Instagram metadata fetcher
│       └── test/                  # Full integration test suite
└── frontend/                      # React 19 + Vite Frontend
    ├── package.json
    ├── vite.config.js             # Vite config with API proxy to :8080
    └── src/
        ├── api/client.js          # Centralized API service
        ├── components/
        │   ├── Navbar.jsx         # Search bar, Save Reel button
        │   ├── Sidebar.jsx        # Collections list & reel counts
        │   ├── ReelCard.jsx       # Reel preview card with keyword highlights
        │   ├── ReelGrid.jsx       # Responsive grid with empty states
        │   ├── SaveReelModal.jsx  # Link input modal with collection selector
        │   └── CreateCollectionModal.jsx
        ├── App.jsx
        └── index.css
```

---

## Quick Start (Local Development)

### 1. Database
PostgreSQL is pre-configured to connect to `localhost:5433` (database: `reelvault`, username: `postgres`, password: `password`).

### 2. Run Backend (Spring Boot)
Open a terminal in `backend/`:
```bash
cd backend
./mvnw spring-boot:run
```
*(On Windows PowerShell: `.\mvnw.cmd spring-boot:run`)*
The API will be live at `http://localhost:8080`.

### 3. Run Frontend (React + Vite)
Open a terminal in `frontend/`:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser. All API calls to `/api` are automatically proxied to the backend at `http://localhost:8080`.

---

## Running with Docker Compose

To start all services (Postgres, Spring Boot backend, React frontend) together:
```bash
docker compose up --build
```
- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8080`
- PostgreSQL: `localhost:5433`

---

## Running Tests

To run the backend integration test suite:
```bash
cd backend
./mvnw test
```

---

## API Summary

- `GET /api/collections` — List all collections with reel counts
- `POST /api/collections` — Create a new collection
- `DELETE /api/collections/{id}` — Delete a collection
- `GET /api/reels` — List saved reels (optional `?collectionId=...`)
- `POST /api/reels` — Save an Instagram reel link (`{ "url": "...", "collectionId": "..." }`)
- `DELETE /api/reels/{id}` — Delete a saved reel
- `GET /api/search?q={query}` — Instant keyword search over reel captions
