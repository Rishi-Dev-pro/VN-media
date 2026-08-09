# Voice Note (VN) Platform — Backend API

This repository contains the backend REST API foundation, database models, and authentication system for the Voice Note (VN) sharing platform. It is engineered with an API-first architecture to serve both modern web (React) and mobile (React Native / Expo Android) applications.

---

## Technical Stack

- **Runtime:** Node.js (`v24.x`)
- **Web Framework:** Express (`v4.x`)
- **Database:** MongoDB (`v8.x`)
- **ODM:** Mongoose (`v8.x`)
- **Authentication:** `jsonwebtoken` (JWT), `bcryptjs` (Password hashing)
- **Runtime:** Node.js (`v24.x`)
- **Web Framework:** Express (`v4.x`)
- **Database:** MongoDB (`v8.x`)
- **ODM:** Mongoose (`v8.x`)
- **Authentication:** `jsonwebtoken` (JWT), `bcryptjs` (Password hashing)
- **Multipart Upload & Audio Processing:** `multer`, `music-metadata`
- **Security & Utilities:** `dotenv`, `cors`, `helmet`

---

## Prerequisites

- **Node.js**: v18.0.0 or higher (v24+ recommended)
- **npm**: v9.0.0 or higher
- **MongoDB**: Active local instance (`mongodb://localhost:27017`) or remote MongoDB Atlas cluster URI.

---

## Getting Started & Installation

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

4. **Run Test Suites:**
   ```bash
   # Run Phase 1 Database Model Tests
   node tests/testModels.js

   # Run Phase 2 Authentication Tests
   node tests/testAuth.js

   # Run Phase 3 Voice Note Upload & Storage Tests
   node tests/testVoiceNoteUpload.js

   # Run Phase 4 Public/Private Access, Streaming & Download Tests
   node tests/testPhase4Access.js

   # Run Phase 5 Likes & Album Management Tests
   node tests/testPhase5SocialAlbums.js

   # Run Phase 6 Search, Tags & Discovery Tests
   node tests/testPhase6Search.js

   # Run Phase 7 User Profiles & Public Creator Pages Tests
   node tests/testPhase7Profiles.js
   ```

---

## Running the Application

### Development Mode (with hot-reloading)
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

---

## Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | Port number for Express HTTP server | `5000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |
| `MONGODB_URI` | MongoDB connection URI string | `mongodb://localhost:27017/vn_platform` |
| `JWT_SECRET` | Secret key used to sign authentication JWT tokens | `dev_jwt_secret_key_change_in_production` |
| `JWT_EXPIRES_IN` | JWT token expiration duration (e.g. `7d`, `24h`) | `7d` |
| `MAX_AUDIO_FILE_SIZE_MB` | Maximum allowed audio upload file size in megabytes | `10` |
| `AUDIO_STORAGE_PATH` | Relative directory path for local audio file storage | `storage/audio` |

---

## Storage & Streaming Architecture (Phase 3, Phase 4, Phase 5, Phase 6 & Phase 7)

The Voice Note storage and streaming foundation utilizes a decoupled **Storage Service Abstraction** pattern:

```text
User Controller / Voice Note Controller / Album Controller / Like Controller
        ↓
   User Service / VoiceNote Service (Centralized Auth, Public Profiles & Stream orchestration)
        ↓
   Storage Service (Decoupled abstraction layer)
        ↓
 LocalStorageProvider (Writes & streams from backend/storage/audio/)
```

### Access & Discovery Authorization Matrix (Single Source of Truth)

> [!IMPORTANT]
> **Privacy Invariant**: Public profiles (`GET /api/users/:username`) and public creator listings (`GET /api/users/:username/voice-notes`) only expose safe public metadata (`id`, `username`, `avatar`, `bio`, `createdAt`, `publicVoiceNotes` count). `email` and `passwordHash` are **NEVER** exposed. Private VoiceNotes and private Albums NEVER appear in public creator profiles or listings.

| Endpoint Request | VoiceNote Visibility | Requester Role | Result | HTTP Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/users/:username` | Any | Anyone (Guest / User / Owner) | ALLOW (Public user profile & stats) | `200 OK` |
| `GET /api/users/:username/voice-notes` | `public` | Anyone (Guest / User / Owner) | ALLOW | `200 OK` |
| `GET /api/users/:username/voice-notes` | `private` | Anyone | DENIED (Excluded from creator listing) | N/A |
| `GET /api/vns/feed` | `public` | Anyone (Guest / User / Owner) | ALLOW | `200 OK` |
| `GET /api/vns/feed` | `private` | Anyone | DENIED (Excluded from feed) | N/A |
| `GET /api/vns/search` | `public` | Anyone (Guest / User / Owner) | ALLOW | `200 OK` |
| `GET /api/vns/search` | `private` | Anyone | DENIED (Excluded from search) | N/A |
| `GET /api/vns/tags/:tag` | `public` | Anyone (Guest / User / Owner) | ALLOW | `200 OK` |
| `GET /api/vns/tags/:tag` | `private` | Anyone | DENIED (Excluded from tags) | N/A |
| `GET /api/vns/:id` | `public` | Anyone (Guest / User / Owner) | ALLOW | `200 OK` |
| `GET /api/vns/:id` | `private` | Owner | ALLOW | `200 OK` |
| `GET /api/vns/:id` | `private` | Other Authenticated User | DENIED | `403 Forbidden` |
| `GET /api/vns/:id` | `private` | Unauthenticated Guest | DENIED | `401 Unauthorized` |
| `PATCH /api/vns/:id` | Any | Owner | ALLOW (Metadata/tags update) | `200 OK` |
| `PATCH /api/vns/:id` | Any | Other Authenticated User | DENIED | `403 Forbidden` |

---

## Protected Endpoint Usage
To access protected routes, supply the JWT token in the `Authorization` request header:
```http
Authorization: Bearer <token>
```

---

## API Endpoints

### 1. Health Status
- **`GET /api/health`**: Returns system uptime, server status, and database connectivity.

### 2. Authentication
- **`POST /api/auth/register`**: Register a new user account.
- **`POST /api/auth/login`**: Authenticate credentials and receive a JWT.

### 3. User Management & Public Profiles (Phase 2 & Phase 7)
- **`GET /api/users/me`**: Get current authenticated user profile (includes `email`). Auth required.
- **`PATCH /api/users/me`**: Update current authenticated user profile (`username`, `avatar`, `bio`). Username changes preserve immutable `_id` relationships. Auth required.
- **`GET /api/users/:username`**: Retrieve public user profile metadata and statistics (`stats: { publicVoiceNotes }`). Strips `email` and `passwordHash`. Public / Unauthenticated.
- **`GET /api/users/:username/voice-notes`**: Retrieve paginated list of public VoiceNotes owned by creator (`?page=1&limit=20`). Strictly excludes private VoiceNotes. Public / Unauthenticated.

### 4. Voice Note Management & Discovery (Phase 3, Phase 4 & Phase 6)
- **`GET /api/vns/feed`**: Retrieve public discovery feed (`visibility = 'public'`). Optional auth.
- **`GET /api/vns/search`**: Search public VoiceNotes across `title`, `description`, and `tags` (`?q=term&page=1&limit=20`). Empty `q` returns recent public VoiceNotes. Optional auth.
- **`GET /api/vns/tags/:tag`**: Retrieve public VoiceNotes matching a normalized tag (`?page=1&limit=20`). Optional auth.
- **`POST /api/vns`**: Upload an audio file and create a VoiceNote (`audio`, `title`, `description`, `visibility`, `tags`). Auth required.
- **`PATCH /api/vns/:id`**: Update VoiceNote metadata (`title`, `description`, `visibility`, `tags`). Owner only. Auth required.
- **`GET /api/vns/me`**: Retrieve paginated list of VoiceNotes owned by current user. Auth required.
- **`GET /api/vns/:id`**: Retrieve single VoiceNote metadata. Optional auth.
- **`GET /api/vns/:id/stream`**: Stream audio file with HTTP Range support (`bytes=start-end`). Optional auth.
- **`GET /api/vns/:id/download`**: Download complete audio file. Optional auth.
- **`DELETE /api/vns/:id`**: Delete owned VoiceNote and remove stored audio file. Auth required.

### 5. Likes (Phase 5)
- **`POST /api/vns/:id/like`**: Add a Like for a VoiceNote. Idempotent (`{ liked: true }`). Auth required.
- **`DELETE /api/vns/:id/like`**: Remove a Like for a VoiceNote. Idempotent (`{ liked: false }`). Auth required.
- **`GET /api/vns/:id/likes`**: Get aggregate Like count and `likedByMe` status. Optional auth.

### 6. Albums & Album Items (Phase 5 - Private Collections)
> [!IMPORTANT]
> **Albums are private owner-managed collections.** Public albums and album sharing are intentionally not implemented yet.

- **`POST /api/albums`**: Create a new Album (`title`, `description`, `coverImage`). Auth required.
- **`GET /api/albums`**: Retrieve paginated list of Albums owned by current user. Auth required.
- **`GET /api/albums/:id`**: Retrieve single Album owned by user with items sorted by `position ASC`. Auth required.
- **`PATCH /api/albums/:id`**: Update Album metadata (`title`, `description`, `coverImage`). Auth required.
- **`DELETE /api/albums/:id`**: Delete Album and its `AlbumItem` join records. **Does NOT delete VoiceNote documents or audio files on disk.** Auth required.
- **`POST /api/albums/:id/items`**: Add an accessible VoiceNote to an Album (`voiceNoteId`). Auto-assigns next `position`. Auth required.
- **`DELETE /api/albums/:id/items/:itemId`**: Remove an item from an Album. **Does NOT delete VoiceNote or audio file.** Auth required.
- **`PATCH /api/albums/:id/items/reorder`**: Reorder Album items (`items: [{ itemId, position }]`). Uses two-phase atomic updates to satisfy compound unique index `{ albumId: 1, position: 1 }`. Auth required.

---

## Data Models (Phase 1, Phase 6 & Phase 7)

- **`User`** (`src/models/User.js`): Accounts (`username`, `email`, `passwordHash`, `avatar`, `bio`, `timestamps`).
- **`VoiceNote`** (`src/models/VoiceNote.js`): Audio metadata (`ownerId`, `title`, `description`, `tags`, `audioUrl`, `duration`, `visibility`, `timestamps`).
- **`Like`** (`src/models/Like.js`): Likes join schema (`userId`, `voiceNoteId`, `createdAt`).
- **`Album`** (`src/models/Album.js`): Albums (`ownerId`, `title`, `description`, `coverImage`, `timestamps`).
- **`AlbumItem`** (`src/models/AlbumItem.js`): Album items join schema (`albumId`, `voiceNoteId`, `position`, `createdAt`).

---

## Current Status & Phase 7 Scope

> [!NOTE]
> **Phase 0, Phase 1, Phase 2, Phase 3, Phase 4, Phase 5, Phase 6 & Phase 7 Status: COMPLETE.**
> Public user profiles, public creator VoiceNote listings, credential privacy, username change relationship preservation, index optimization, and regression safety are fully implemented and verified via 42 automated tests (212 total test cases across all phases).

### Intentionally NOT Implemented Yet (Belongs to Future Phases):
- ❌ Followers, following, and follow/unfollow actions
- ❌ Public albums and album sharing
- ❌ User activity feeds
- ❌ Comments & notifications
- ❌ Recommendation algorithms
- ❌ Listening & download history analytics

---

## Future Roadmap

1. **Phase 8 — Social Network & User Feeds:** Follower interactions, following feeds, user activity feeds, and social notifications.





