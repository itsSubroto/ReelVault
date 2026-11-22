# ReelVault — API Contract & Data Model

This document defines the data model, database schema, and REST API specification for ReelVault. It acts as the shared contract between the **Spring Boot Core API**, the **React Frontend**, and the **Python AI Processing Service** (Phase 2).

---

## 1. Data Model

### 1.1 User (`users`)
Represents an authenticated user account.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | Unique identifier (generated) |
| `username` | `VARCHAR(50)` | NOT NULL, UNIQUE | User login handle |
| `email` | `VARCHAR(100)` | NOT NULL, UNIQUE | User email address |
| `password` | `VARCHAR(255)` | NOT NULL | BCrypt / Argon2 hashed password |
| `name` | `VARCHAR(100)` | NULLABLE | Display name |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL | Account creation timestamp |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL | Last update timestamp |

---

### 1.2 Collection (`collections`)
A user-defined folder or category to organize saved reels (e.g., "Tech", "Recipes", "Gym", "Design").

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | Unique identifier (generated) |
| `user_id` | `UUID` | NULLABLE, FK(`users.id` ON DELETE CASCADE) | Owner of this collection |
| `name` | `VARCHAR(100)` | NOT NULL | Collection name (e.g., "Tech Tips") |
| `description` | `VARCHAR(255)` | NULLABLE | Optional brief description |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL | Creation timestamp |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL | Last update timestamp |

---

### 1.3 Reel (`reels`)
An Instagram reel saved by the user, belonging to a collection.

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | `UUID` | PRIMARY KEY | Unique identifier (generated) |
| `collection_id` | `UUID` | NOT NULL, FK(`collections.id` ON DELETE CASCADE) | The collection this reel belongs to |
| `instagram_url` | `VARCHAR(500)` | NOT NULL | Original Instagram reel URL |
| `shortcode` | `VARCHAR(50)` | NOT NULL | Shortcode extracted from URL (e.g., `C1234abcd`) |
| `caption` | `TEXT` | NULLABLE | Caption text retrieved via oEmbed / metadata |
| `thumbnail_url` | `VARCHAR(1000)` | NULLABLE | Thumbnail image URL |
| `author_name` | `VARCHAR(100)` | NULLABLE | Instagram username or creator display name |
| `status` | `VARCHAR(20)` | NOT NULL, DEFAULT 'SAVED' | Processing status: `SAVED`, `PENDING`, `PROCESSING`, `DONE`, `FAILED` |
| `transcript` | `TEXT` | NULLABLE | Audio transcription (Phase 2) |
| `summary` | `TEXT` | NULLABLE | AI-generated summary (Phase 2) |
| `tags` | `TEXT[]` / `JSONB` | NULLABLE | AI-generated tags (Phase 2) |
| `created_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL | Date reel was saved |
| `updated_at` | `TIMESTAMP WITH TIME ZONE` | NOT NULL | Last update timestamp |

---

## 2. REST API Contract

All endpoints use JSON for request and response bodies unless otherwise specified.
Base path: `/api`

### 2.1 Authentication API

#### 2.1.1 Register
- **Method:** `POST`
- **Path:** `/api/auth/register`
- **Public:** Yes
- **Request Body:**
```json
{
  "username": "divya",
  "email": "divya@example.com",
  "password": "securepassword123",
  "name": "Divya Patani"
}
```
- **Response:** `201 Created`
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "e6a0d24f-a2e6-42d4-ba09-5a91b29a67e9",
    "username": "divya",
    "email": "divya@example.com",
    "name": "Divya Patani",
    "createdAt": "2026-11-21T16:00:00Z"
  }
}
```

#### 2.1.2 Login
- **Method:** `POST`
- **Path:** `/api/auth/login`
- **Public:** Yes
- **Request Body:**
```json
{
  "usernameOrEmail": "divya",
  "password": "securepassword123"
}
```
- **Response:** `200 OK` (returns JWT `token` and `user` object)

#### 2.1.3 Get Current User Profile (Session validation)
- **Method:** `GET`
- **Path:** `/api/auth/me`
- **Header:** `Authorization: Bearer <jwt_token>`
- **Public:** No (Requires valid JWT)
- **Response:** `200 OK` (returns authenticated `user` object) or `401 Unauthorized`

---

### 2.2 Collections API

#### 2.1.1 List All Collections
- **Method:** `GET`
- **Path:** `/api/collections`
- **Response:** `200 OK`
```json
[
  {
    "id": "7b8449c7-f58c-4977-b8db-4e78db382451",
    "name": "Tech Tips",
    "description": "Coding and productivity tricks",
    "reelCount": 12,
    "createdAt": "2026-09-10T18:30:00Z",
    "updatedAt": "2026-09-10T18:30:00Z"
  }
]
```

#### 2.1.2 Create Collection
- **Method:** `POST`
- **Path:** `/api/collections`
- **Request Body:**
```json
{
  "name": "Movie Recommendations",
  "description": "Weekend watchlist ideas"
}
```
- **Response:** `201 Created`
```json
{
  "id": "8c9449c7-f58c-4977-b8db-4e78db382452",
  "name": "Movie Recommendations",
  "description": "Weekend watchlist ideas",
  "reelCount": 0,
  "createdAt": "2026-09-10T18:35:00Z",
  "updatedAt": "2026-09-10T18:35:00Z"
}
```

#### 2.2.3 Get Collection by ID
- **Method:** `GET`
- **Path:** `/api/collections/{id}`
- **Response:** `200 OK` or `404 Not Found`

#### 2.2.4 Delete Collection
- **Method:** `DELETE`
- **Path:** `/api/collections/{id}`
- **Response:** `204 No Content` or `404 Not Found`

---

### 2.3 Reels API

#### 2.3.1 Save a Reel
- **Method:** `POST`
- **Path:** `/api/reels`
- **Header:** `Authorization: Bearer <jwt_token>` (recommended)
- **Request Body:**
```json
{
  "url": "https://www.instagram.com/reel/C7xyz123abc/",
  "collectionId": "7b8449c7-f58c-4977-b8db-4e78db382451"
}
```
*(Note: If `collectionId` is omitted, auto-saves to user's "Quick Save" default collection).*
- **Response:** `201 Created`

#### 2.3.2 List Reels
- **Method:** `GET`
- **Path:** `/api/reels`
- **Query Parameters:**
  - `collectionId` *(optional, UUID)*: Filter by collection. If omitted, returns all reels.
- **Response:** `200 OK` (Array of Reel objects)

#### 2.3.3 Check Reel Status (Extension lookup)
- **Method:** `GET`
- **Path:** `/api/reels/check?url={url}`
- **Response:** `200 OK`
```json
{
  "saved": true,
  "reel": {
    "id": "e4f8d223-388b-4a5c-91e8-782637b12abc",
    "shortcode": "C7xyz123abc",
    "collectionName": "Tech Tips"
  }
}
```

#### 2.3.4 Get Reel by ID
- **Method:** `GET`
- **Path:** `/api/reels/{id}`
- **Response:** `200 OK` or `404 Not Found`

#### 2.3.5 Delete Reel
- **Method:** `DELETE`
- **Path:** `/api/reels/{id}`
- **Response:** `204 No Content` or `404 Not Found`

#### 2.3.6 Update Reel (Used in Phase 2 callback or manual edit)
- **Method:** `PATCH`
- **Path:** `/api/reels/{id}`
- **Request Body:** Partial update (transcript, summary, tags, status, caption)
- **Response:** `200 OK`

---

### 2.4 Search API

#### 2.3.1 Search Reels by Keyword
- **Method:** `GET`
- **Path:** `/api/search`
- **Query Parameters:**
  - `q` *(required, string)*: Search keyword or phrase.
  - `collectionId` *(optional, UUID)*: Restrict search to a specific collection.
- **Behavior:**
  - In Phase 1: Matches against `caption` (case-insensitive substring and full-text).
  - In Phase 2: Extends match to `caption`, `transcript`, `summary`, and `tags`.
- **Response:** `200 OK`

---

## 3. Error Handling Convention

All error responses return standard JSON:
```json
{
  "timestamp": "2026-09-10T18:45:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Invalid Instagram URL format",
  "path": "/api/reels"
}
```
