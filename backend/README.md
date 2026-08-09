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

## Storage & Streaming Architecture (Phase 3 & Phase 4)

The Voice Note storage and streaming foundation utilizes a decoupled **Storage Service Abstraction** pattern:

```text
Voice Note Controller
        ↓
   VoiceNote Service (Centralized Auth & Storage Stream orchestration)
        ↓
   Storage Service (Decoupled abstraction layer)
        ↓
 LocalStorageProvider (Writes & streams from backend/storage/audio/)
```

### Access Authorization Matrix (Single Source of Truth)

| Endpoint Request | VoiceNote Visibility | Requester Role | Result | HTTP Status |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/vns/feed` | `public` | Anyone (Guest / User / Owner) | ALLOW | `200 OK` |
| `GET /api/vns/feed` | `private` | Anyone | DENIED (Excluded from feed) | N/A |
| `GET /api/vns/:id` | `public` | Anyone (Guest / User / Owner) | ALLOW | `200 OK` |
| `GET /api/vns/:id` | `private` | Owner | ALLOW | `200 OK` |
| `GET /api/vns/:id` | `private` | Other Authenticated User | DENIED | `403 Forbidden` |
| `GET /api/vns/:id` | `private` | Unauthenticated Guest | DENIED | `401 Unauthorized` |
| `GET /api/vns/:id/stream` | `public` | Anyone (Guest / User / Owner) | ALLOW | `200` / `206` |
| `GET /api/vns/:id/stream` | `private` | Owner | ALLOW | `200` / `206` |
| `GET /api/vns/:id/stream` | `private` | Other Authenticated User | DENIED | `403 Forbidden` |
| `GET /api/vns/:id/stream` | `private` | Unauthenticated Guest | DENIED | `401 Unauthorized` |
| `GET /api/vns/:id/download` | `public` | Anyone (Guest / User / Owner) | ALLOW | `200 OK` |
| `GET /api/vns/:id/download` | `private` | Owner | ALLOW | `200 OK` |
| `GET /api/vns/:id/download` | `private` | Other Authenticated User | DENIED | `403 Forbidden` |
| `GET /api/vns/:id/download` | `private` | Unauthenticated Guest | DENIED | `401 Unauthorized` |

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

### 3. User Management (Protected)
- **`GET /api/users/me`**: Get current authenticated user profile.
- **`PATCH /api/users/me`**: Update current authenticated user profile (`username`, `avatar`, `bio`).

### 4. Voice Note Management (Phase 3 & Phase 4)
- **`GET /api/vns/feed`**: Retrieve public discovery feed (`visibility = 'public'`).
  - **Auth:** Optional (`protectOptional`)
  - **Query Params:** `?page=1&limit=20`
  - **Response (200 OK):** Returns public VoiceNotes list with populated owner objects (`owner: { id, username }`).

- **`POST /api/vns`**: Upload an audio file and create a VoiceNote.
  - **Auth:** Required (`protect`)
  - **Content-Type:** `multipart/form-data`
  - **Form Data Fields:** `audio` *(file)*, `title` *(string)*, `description` *(string)*, `visibility` (`public` / `private`)

- **`GET /api/vns/me`**: Retrieve paginated list of VoiceNotes owned by current user.
  - **Auth:** Required (`protect`)

- **`GET /api/vns/:id`**: Retrieve a single VoiceNote metadata.
  - **Auth:** Optional (`protectOptional`)
  - **Access Control:** Public VNs accessible to anyone. Private VNs accessible only to owner (Non-owners receive `403 Forbidden`, guests receive `401 Unauthorized`).

- **`GET /api/vns/:id/stream`**: Stream audio file with HTTP Range support (`bytes=start-end`).
  - **Auth:** Optional (`protectOptional`)
  - **Access Control:** Obey centralized access matrix.
  - **Response:** `200 OK` (full file stream) or `206 Partial Content` (range stream with `Content-Range`, `Content-Length`, `Accept-Ranges: bytes`).

- **`GET /api/vns/:id/download`**: Download complete audio file.
  - **Auth:** Optional (`protectOptional`)
  - **Access Control:** Obey centralized access matrix.
  - **Response (200 OK):** Streams file with `Content-Disposition: attachment; filename="<sanitized_filename>"`.

- **`DELETE /api/vns/:id`**: Delete owned VoiceNote and remove stored audio file.
  - **Auth:** Required (`protect`)

---

## Data Models (Phase 1)

- **`User`** (`src/models/User.js`): Accounts (`username`, `email`, `passwordHash`, `avatar`, `bio`, `timestamps`).
- **`VoiceNote`** (`src/models/VoiceNote.js`): Audio metadata (`ownerId`, `title`, `description`, `audioUrl`, `duration`, `visibility`, `timestamps`).
- **`Like`** (`src/models/Like.js`): Likes join schema (`userId`, `voiceNoteId`, `createdAt`).
- **`Album`** (`src/models/Album.js`): Albums (`ownerId`, `title`, `description`, `coverImage`, `timestamps`).
- **`AlbumItem`** (`src/models/AlbumItem.js`): Album items join schema (`albumId`, `voiceNoteId`, `position`, `createdAt`).

---

## Current Status & Phase 4 Scope

> [!NOTE]
> **Phase 0, Phase 1, Phase 2, Phase 3 & Phase 4 Status: COMPLETE.**
> Access authorization, public discovery feed, HTTP range streaming, controlled downloads, and privacy enforcement across all endpoints are fully implemented and verified via 32 automated tests (82 total test cases across all phases).

### Intentionally NOT Implemented Yet (Belongs to Future Phases):
- ❌ Likes API endpoints (`POST /api/vns/:id/like`)
- ❌ Albums API & item reordering
- ❌ Search & user feed algorithms
- ❌ Comments & social features
- ❌ React Native / Mobile offline playback manager
- ❌ Listening / Download history analytics

---

## Future Roadmap

1. **Phase 5 — Social Features & Albums:** Likes API, Album CRUD, AlbumItem ordering endpoints, follower feeds.


