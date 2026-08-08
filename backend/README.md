# Voice Note (VN) Platform — Backend API

This repository contains the backend REST API foundation and database model layer for the Voice Note (VN) sharing platform. It is engineered with an API-first architecture to serve both modern web (React) and mobile (React Native / Expo Android) applications.

---

## Technical Stack

- **Runtime:** Node.js (`v24.x`)
- **Web Framework:** Express (`v4.x`)
- **Database:** MongoDB (`v8.x`)
- **ODM:** Mongoose (`v8.x`)
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

4. **Run Database Model Tests:**
   ```bash
   node tests/testModels.js
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

---

## Data Models & Schema Design (Phase 1)

### 1. User (`src/models/User.js`)
- **Fields:**
  - `username` (String, required, unique, trimmed, min 3, max 30, alphanumeric/underscore regex)
  - `email` (String, required, unique, trimmed, lowercase, valid email regex)
  - `passwordHash` (String, required - placeholder for future password hashes)
  - `avatar` (String, optional, URL/reference string)
  - `bio` (String, optional, max 500 chars)
  - `timestamps` (`createdAt`, `updatedAt`)
- **Indexes:** `username` (unique), `email` (unique).

### 2. VoiceNote (`src/models/VoiceNote.js`)
- **Fields:**
  - `ownerId` (ObjectId referencing `User`, required, indexed)
  - `title` (String, required, trimmed, max 100 chars)
  - `description` (String, optional, trimmed, max 1000 chars)
  - `audioUrl` (String, required, trimmed - audio storage key/URL)
  - `duration` (Number, required, min 0 seconds)
  - `visibility` (String, enum: `['public', 'private']`, default `'public'`, required, indexed)
  - `timestamps` (`createdAt`, `updatedAt`)
- **Indexes:** `{ ownerId: 1, createdAt: -1 }`, `{ visibility: 1, createdAt: -1 }`.

### 3. Like (`src/models/Like.js`)
- **Fields:**
  - `userId` (ObjectId referencing `User`, required, indexed)
  - `voiceNoteId` (ObjectId referencing `VoiceNote`, required, indexed)
  - `createdAt` timestamp
- **Indexes:** Compound unique index `{ userId: 1, voiceNoteId: 1 }` (prevents duplicate likes per user per voice note).

### 4. Album (`src/models/Album.js`)
- **Fields:**
  - `ownerId` (ObjectId referencing `User`, required, indexed)
  - `title` (String, required, trimmed, max 100 chars)
  - `description` (String, optional, trimmed, max 1000 chars)
  - `coverImage` (String, optional, URL/reference)
  - `timestamps` (`createdAt`, `updatedAt`)
- **Indexes:** `{ ownerId: 1, createdAt: -1 }`.

### 5. AlbumItem (`src/models/AlbumItem.js`)
- **Fields:**
  - `albumId` (ObjectId referencing `Album`, required, indexed)
  - `voiceNoteId` (ObjectId referencing `VoiceNote`, required, indexed)
  - `position` (Number, required, min 1 - ordering index)
  - `createdAt` timestamp
- **Indexes:** Compound unique index `{ albumId: 1, voiceNoteId: 1 }` (prevents duplicate VNs in album), Compound unique index `{ albumId: 1, position: 1 }` (guarantees unique position per item).

---

## Entity Relationships

```
User
├── owns many VoiceNotes (VoiceNote.ownerId -> User._id)
├── owns many Albums (Album.ownerId -> User._id)
└── creates many Likes (Like.userId -> User._id)

VoiceNote
├── belongs to one User
└── referenced by many Likes & AlbumItems

Album
├── belongs to one User
└── contains many AlbumItems (AlbumItem.albumId -> Album._id)

AlbumItem
├── belongs to one Album
└── references one VoiceNote (AlbumItem.voiceNoteId -> VoiceNote._id)
```

---

## API Endpoints

### Health Status
- **URL:** `/api/health`
- **Method:** `GET`
- **Response:** Standard success payload with database status.

### 404 Route Handling
- Unmatched routes return `{ "success": false, "message": "Route GET /api/... not found" }`.

---

## Current Status & Phase 1 Scope

> [!NOTE]
> **Phase 0 & Phase 1 Status: COMPLETE.**
> The backend foundation and Mongoose data models are fully implemented and verified via automated test scripts.

### Intentionally NOT Implemented Yet (Belong to Future Phases):
- ❌ Registration & Login API endpoints (`POST /api/auth/register`, `POST /api/auth/login`)
- ❌ Password hashing (bcrypt) execution
- ❌ JWT token generation & authentication middleware
- ❌ VoiceNote creation/upload API (`POST /api/vns`)
- ❌ Audio file upload & cloud storage handlers
- ❌ Like/Unlike API endpoints (`POST /api/vns/:id/like`)
- ❌ Album creation & reordering API endpoints
- ❌ Search, profiles, streaming, & offline download features

---

## Future Roadmap

1. **Phase 2 — Authentication & User Management:** Auth controllers, bcrypt hashing, JWT middleware, register/login routes.
2. **Phase 3 — Voice Note Core & File Storage:** Storage service abstraction, audio file uploads, metadata extraction, VN routes.
3. **Phase 4 — Social Features & Albums:** Likes API, Album CRUD, AlbumItem ordering endpoints, public feeds.
