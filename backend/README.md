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

## Storage Architecture (Phase 3)

The Voice Note storage foundation utilizes a decoupled **Storage Service Abstraction** pattern:

```text
Voice Note Controller
        ↓
   VoiceNote Service (Atomic DB / Storage lifecycle orchestration)
        ↓
   Storage Service (Decoupled abstraction layer)
        ↓
 LocalStorageProvider (Writes to backend/storage/audio/)
```

### Key Security & Reliability Features:
- **Filename Sanitization**: Uploaded files are assigned UUID v4 names (e.g. `8f2c9a1e-....wav`). Original client filenames and path traversal attempts (`../../`) are stripped.
- **Audio Validation Policy**:
  - **Extensions**: `.mp3`, `.wav`, `.m4a`, `.aac`, `.ogg`
  - **MIME types**: `audio/mpeg`, `audio/wav`, `audio/m4a`, `audio/aac`, `audio/ogg`
  - **Magic Bytes Validation**: Binary file headers are checked (ID3/MPEG sync, RIFF/WAVE, ftyp, OggS) to reject fake renamed files.
- **Real Audio Duration**: Duration is calculated directly from audio metadata using `music-metadata`. Client-supplied duration inputs are ignored.
- **File & Database Consistency**: If MongoDB creation fails after saving an audio file, the stored file is automatically deleted (rollback). Deleting a VoiceNote record removes both the file on disk and the database record.

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

### 4. Voice Note Management (Phase 3 - Protected)
- **`POST /api/vns`**: Upload an audio file and create a VoiceNote.
  - **Headers:** `Authorization: Bearer <token>`
  - **Content-Type:** `multipart/form-data`
  - **Form Data Fields:**
    - `audio` *(required)*: Audio file binary (MP3, WAV, M4A, AAC, OGG)
    - `title` *(required, max 100 chars)*: Voice note title
    - `description` *(optional, max 1000 chars)*: Description text
    - `visibility` *(optional)*: `public` or `private` (default: `public`)
  - **Response (201 Created):**
    ```json
    {
      "success": true,
      "message": "Voice note uploaded successfully",
      "data": {
        "voiceNote": {
          "id": "6a77fb...",
          "ownerId": "6a77fb...",
          "title": "Morning Motivation",
          "description": "Daily thoughts.",
          "audioUrl": "audio/8f2c9a1e-86a3-4c91-9e2b-2a784d1e9f1a.wav",
          "duration": 3.5,
          "visibility": "private",
          "createdAt": "2026-08-09T04:00:00.000Z",
          "updatedAt": "2026-08-09T04:00:00.000Z"
        }
      }
    }
    ```

- **`GET /api/vns/me`**: Retrieve paginated list of VoiceNotes owned by current authenticated user.
  - **Headers:** `Authorization: Bearer <token>`
  - **Query Params:** `?page=1&limit=20`
  - **Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Voice notes retrieved successfully",
      "data": {
        "voiceNotes": [...],
        "pagination": {
          "page": 1,
          "limit": 20,
          "total": 1,
          "totalPages": 1
        }
      }
    }
    ```

- **`GET /api/vns/:id`**: Retrieve a single VoiceNote owned by current authenticated user.
  - **Headers:** `Authorization: Bearer <token>`
  - **Response (200 OK):** Returns single VoiceNote object. Non-owners receive `403 Forbidden`.

- **`DELETE /api/vns/:id`**: Delete a VoiceNote owned by current user and remove stored audio file.
  - **Headers:** `Authorization: Bearer <token>`
  - **Response (200 OK):** `{"success": true, "message": "Voice note deleted successfully"}`

---

## Data Models (Phase 1)

- **`User`** (`src/models/User.js`): Accounts (`username`, `email`, `passwordHash`, `avatar`, `bio`, `timestamps`).
- **`VoiceNote`** (`src/models/VoiceNote.js`): Audio metadata (`ownerId`, `title`, `description`, `audioUrl`, `duration`, `visibility`, `timestamps`).
- **`Like`** (`src/models/Like.js`): Likes join schema (`userId`, `voiceNoteId`, `createdAt`).
- **`Album`** (`src/models/Album.js`): Albums (`ownerId`, `title`, `description`, `coverImage`, `timestamps`).
- **`AlbumItem`** (`src/models/AlbumItem.js`): Album items join schema (`albumId`, `voiceNoteId`, `position`, `createdAt`).

---

## Current Status & Phase 3 Scope

> [!NOTE]
> **Phase 0, Phase 1, Phase 2 & Phase 3 Status: COMPLETE.**
> Voice Note upload, storage abstraction, audio duration extraction, file/DB consistency, and owner-scoped lifecycle management are fully implemented and verified via 23 automated tests (50 total test cases across all phases).

### Intentionally NOT Implemented Yet (Belongs to Future Phases):
- ❌ Public VN feed
- ❌ Public/private access authorization rules (Phase 4)
- ❌ HTTP range-based audio streaming (`GET /api/vns/:id/stream`)
- ❌ Audio download API (`GET /api/vns/:id/download`)
- ❌ Likes API endpoints (`POST /api/vns/:id/like`)
- ❌ Albums API & item reordering
- ❌ Search & recommendations
- ❌ Mobile offline playback & social features

---

## Future Roadmap

1. **Phase 4 — Authorization, Public Feeds & Audio Streaming:** Public/private visibility authorization, public discovery feeds, audio streaming endpoint, and download handlers.
2. **Phase 5 — Social Features & Albums:** Likes API, Album CRUD, AlbumItem ordering endpoints.

