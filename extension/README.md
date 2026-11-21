# ReelVault — Quick Save Browser Extension 🎬⚡

The official browser companion extension for **ReelVault**. Quickly save YouTube videos, YouTube Shorts, and Instagram Reels into your collections directly from your browser without manually copying and pasting URLs.

---

## 🚀 Features

1. **⚡ 1-Click Save (In-Page Floating Button)**:
   - Floating "Save to ReelVault" action button appears automatically when watching any YouTube video, Shorts, or browsing Instagram Reels.
   - Shows instant visual feedback (`Saving...` &rarr; `✓ In ReelVault`).
   - In-page toast notification with a quick link to open ReelVault dashboard.

2. **📌 Extension Toolbar Popup**:
   - Automatically detects active tab's platform (YouTube / Instagram) and video title.
   - Lets you choose which collection to save into (or defaults to auto-created `⚡ Quick Save` collection).
   - Allows inline creation of new collections directly from the popup without leaving your page.
   - Shows recent quick saves with direct vault links.
   - Real-time Spring Boot backend status indicator (Online/Offline).

3. **🖱️ Right-Click Context Menu**:
   - Right-click any video, page, or link: choose **⚡ Save to ReelVault**.
   - Triggers desktop notification on success.

4. **⌨️ Global Keyboard Shortcut**:
   - Press **`Alt + Shift + S`** (or **`Cmd + Shift + S`** on Mac) on any video page to instantly save it.

---

## 🛠️ Installation Guide (Chrome / Edge / Brave)

1. Open your browser and go to:
   ```text
   chrome://extensions
   ```
   *(For Microsoft Edge: `edge://extensions`, for Brave: `brave://extensions`)*

2. In the top-right corner, toggle **Developer mode** to **ON**.

3. Click the **Load unpacked** button in the top-left.

4. Select the directory:
   ```text
   D:\ReelVault\extension
   ```

5. Click the puzzle icon in Chrome's toolbar and **Pin** "ReelVault Quick Save".

---

## 🔐 How Authentication Works

- Click the ReelVault extension icon in your toolbar.
- If not logged in, enter your ReelVault username/email and password.
- The extension securely communicates with `http://localhost:8080/api/auth/login` and stores the JWT token locally in `chrome.storage.local`.
- All save requests automatically include `Authorization: Bearer <token>`.

---

## 🌐 Supported URL Formats

- **YouTube Videos:** `https://www.youtube.com/watch?v=...`
- **YouTube Shorts:** `https://www.youtube.com/shorts/...`
- **Shortened YouTube Links:** `https://youtu.be/...`
- **Instagram Reels:** `https://www.instagram.com/reel/...` / `https://www.instagram.com/reels/...`
- **Instagram Posts:** `https://www.instagram.com/p/...`

---

## ⚙️ Backend API Endpoints Used

- `GET /api/health` — Checks backend availability
- `POST /api/auth/login` — Authenticates user
- `GET /api/collections` — Fetches user's collections
- `POST /api/collections` — Creates a new collection
- `GET /api/reels/check?url={url}` — Checks if video is already saved
- `POST /api/reels` — Saves video (auto-assigns to default "Quick Save" if `collectionId` is omitted)
