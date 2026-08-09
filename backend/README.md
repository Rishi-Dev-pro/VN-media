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

   # Run Phase 8 Followers & Following Social Graph Tests
   node tests/testPhase8Follows.js

   # Run Phase 9 Following Feed Tests
   node tests/testPhase9FollowingFeed.js

   # Run Phase 10 Activity Events Foundation Tests
   node tests/testPhase10ActivityEvents.js

   # Run Phase 11 In-App Notifications Foundation Tests
   node tests/testPhase11Notifications.js

   # Run Phase 12 Notification Preferences & Controls Tests
   node tests/testPhase12NotificationPreferences.js

   # Run Phase 13 Real-Time Notification Delivery Foundation Tests
   node tests/testPhase13RealtimeNotifications.js

   # Run Phase 14 Voice Note Lifecycle & Storage Integrity Tests
   node tests/testPhase14VoiceNoteLifecycle.js
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

## Storage & Streaming Architecture (Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, Phase 10, Phase 11, Phase 12, Phase 13 & Phase 14)

The Voice Note storage and streaming foundation utilizes a decoupled **Storage Service Abstraction** and **Real-Time Gateway** pattern with a soft-deletion lifecycle:

```text
User Controller / Follow Controller / Voice Note Controller / Album Controller / Like Controller / Activity Controller / Notification Controller
        ↓
   User Service / Follow Service / VoiceNote Service / ActivityEvent Service / Notification Service / Notification Preference Service
        ↓
   Storage Service (Decoupled abstraction layer)  +  Real-Time Gateway (Socket.IO user rooms user:<userId>)
        ↓                                                 ↓
 LocalStorageProvider (backend/storage/audio/)        Connected Recipient (`notification:new`)
```

### Access & Discovery Authorization Matrix (Single Source of Truth)

> [!IMPORTANT]
> **Privacy & Lifecycle Invariant**: Soft-deleted VoiceNotes (`deletedAt != null`) are strictly isolated and excluded from public feed, search, tag discovery, creator profiles, following feed, albums, stream/download endpoints, and profile statistics. Audio replacement (`PATCH /api/vns/:id/audio`) uses a failure-safe sequence: validate new audio -> save to disk -> update DB -> delete old file on disk.

| Endpoint Request / Socket Event | Target Visibility | Requester Role | Result | HTTP Status / Event |
| :--- | :--- | :--- | :--- | :--- |
| `DELETE /api/vns/:id` | Active | Owner Only | ALLOW (Soft-deletes VoiceNote by setting `deletedAt = timestamp`) | `200 OK` |
| `PATCH /api/vns/:id/audio` | Active | Owner Only | ALLOW (Failure-safe audio replacement & old file cleanup) | `200 OK` |
| `PATCH /api/vns/:id` | Active | Owner Only | ALLOW (Update title, description, visibility, tags) | `200 OK` |
| `GET /api/vns/:id/stream` | Active | Authorized | ALLOW (Stream audio; returns `404` if soft-deleted) | `200 OK` / `404` |
| `GET /api/vns/:id/download` | Active | Authorized | ALLOW (Download audio; returns `404` if soft-deleted) | `200 OK` / `404` |
| `GET /api/notifications/preferences` | Any | Authenticated User | ALLOW (Retrieve user's notification preferences) | `200 OK` |
| `PATCH /api/notifications/preferences` | Any | Authenticated User | ALLOW (Update partial boolean notification preferences) | `200 OK` |
| `GET /api/notifications` | Any | Authenticated User | ALLOW (Paginated notifications for recipient with unreadCount) | `200 OK` |

---

## Protected Endpoint Usage
To access protected routes, supply the JWT token in the `Authorization` request header:
```http
Authorization: Bearer <token>
```
To connect via Socket.IO, supply the JWT token in `auth.token` (`Bearer <token>`).

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
- **`GET /api/users/:username`**: Retrieve public user profile metadata and statistics (`stats: { publicVoiceNotes, followers, following }`). Strips `email` and `passwordHash`. Excludes deleted VoiceNotes from `publicVoiceNotes` count. Public / Unauthenticated.
- **`GET /api/users/:username/voice-notes`**: Retrieve paginated list of active public VoiceNotes owned by creator (`?page=1&limit=20`). Strictly excludes private and soft-deleted VoiceNotes. Public / Unauthenticated.

### 4. Followers & Following Social Graph (Phase 8)
- **`POST /api/users/:id/follow`**: Follow a user. Idempotent (`{ following: true }`). Rejects self-follow (`400 Bad Request`). Auth required.
- **`DELETE /api/users/:id/follow`**: Unfollow a user. Idempotent (`{ following: false }`). Auth required.
- **`GET /api/users/:id/follow-status`**: Check if authenticated user follows target user (`{ following: boolean }`). Auth required.
- **`GET /api/users/:id/followers`**: Retrieve paginated list of users following target user (`?page=1&limit=20`). Accepts User ID or username. Public / Unauthenticated.
- **`GET /api/users/:id/following`**: Retrieve paginated list of users followed by target user (`?page=1&limit=20`). Accepts User ID or username. Public / Unauthenticated.

### 5. Voice Note Management, Discovery & Lifecycle (Phase 3, Phase 4, Phase 6, Phase 9 & Phase 14)
- **`GET /api/vns/feed`**: Retrieve global public discovery feed (`visibility = 'public'`, `deletedAt = null`). Optional auth.
- **`GET /api/vns/feed/following`**: Retrieve personalized feed of active public VoiceNotes from followed creators (`?page=1&limit=20`). Strictly excludes private and soft-deleted VoiceNotes. Auth required.
- **`GET /api/vns/search`**: Search active public VoiceNotes across `title`, `description`, and `tags` (`?page=1&limit=20`). Excludes soft-deleted VoiceNotes. Optional auth.
- **`GET /api/vns/tags/:tag`**: Retrieve active public VoiceNotes matching a normalized tag (`?page=1&limit=20`). Optional auth.
- **`POST /api/vns`**: Upload an audio file and create a VoiceNote (`audio`, `title`, `description`, `visibility`, `tags`). Auth required.
- **`PATCH /api/vns/:id`**: Update VoiceNote metadata (`title`, `description`, `visibility`, `tags`). Owner only. Auth required.
- **`PATCH /api/vns/:id/audio`**: Replace audio file for an existing active VoiceNote (`audio`). Failure-safe. Owner only. Auth required.
- **`GET /api/vns/me`**: Retrieve paginated list of active VoiceNotes owned by current user. Auth required.
- **`GET /api/vns/:id`**: Retrieve single active VoiceNote metadata. Optional auth.
- **`GET /api/vns/:id/stream`**: Stream audio file with HTTP Range support (`bytes=start-end`). Returns 404 for deleted VoiceNotes. Optional auth.
- **`GET /api/vns/:id/download`**: Download complete audio file. Returns 404 for deleted VoiceNotes. Optional auth.
- **`DELETE /api/vns/:id`**: Soft-delete owned VoiceNote (`deletedAt = timestamp`). Owner only. Auth required.

### 6. Activity Events Foundation (Phase 10)
- **`GET /api/activity/me`**: Retrieve paginated list of activity events generated by authenticated user (`?page=1&limit=20`). Strictly returns events where `actorId = req.user._id`. Auth required.

### 7. In-App Notifications & Real-Time Delivery (Phase 11, Phase 12 & Phase 13)
- **`GET /api/notifications`**: Retrieve paginated notifications for authenticated user (`?page=1&limit=20&unread=true`). Includes total `unreadCount`. Auth required.
- **`GET /api/notifications/preferences`**: Retrieve notification preferences for authenticated user (`{ userFollowed: boolean, voiceNoteLiked: boolean }`). Auth required.
- **`PATCH /api/notifications/preferences`**: Update notification preferences for authenticated user (partial boolean updates). Rejects non-booleans and unknown keys (`400 Bad Request`). Auth required.
- **`PATCH /api/notifications/read-all`**: Mark all unread notifications for authenticated user as read (`{ updatedCount: number }`). Auth required.
- **`PATCH /api/notifications/:id/read`**: Mark a single notification owned by authenticated user as read (`{ read: true }`). Auth required.
- **Socket.IO Real-Time Gateway**: Authenticated sockets (`auth.token`) join room `user:<userId>`. Emits `notification:new` payloads instantly to connected recipient sockets upon database persistence.

### 8. Likes (Phase 5)
- **`POST /api/vns/:id/like`**: Add a Like for a VoiceNote. Idempotent (`{ liked: true }`). Auth required.
- **`DELETE /api/vns/:id/like`**: Remove a Like for a VoiceNote. Idempotent (`{ liked: false }`). Auth required.
- **`GET /api/vns/:id/likes`**: Get aggregate Like count and `likedByMe` status. Optional auth.

### 9. Albums & Album Items (Phase 5 - Private Collections)
- **`POST /api/albums`**: Create a new Album (`title`, `description`, `coverImage`). Auth required.
- **`GET /api/albums`**: Retrieve paginated list of Albums owned by current user. Auth required.
- **`GET /api/albums/:id`**: Retrieve single Album owned by user with items sorted by `position ASC`. Filters out soft-deleted VoiceNotes. Auth required.
- **`PATCH /api/albums/:id`**: Update Album metadata (`title`, `description`, `coverImage`). Auth required.
- **`DELETE /api/albums/:id`**: Delete Album and its `AlbumItem` join records. **Does NOT delete VoiceNote documents or audio files on disk.** Auth required.
- **`POST /api/albums/:id/items`**: Add an accessible active VoiceNote to an Album (`voiceNoteId`). Auto-assigns next `position`. Auth required.
- **`DELETE /api/albums/:id/items/:itemId`**: Remove an item from an Album. **Does NOT delete VoiceNote or audio file.** Auth required.
- **`PATCH /api/albums/:id/items/reorder`**: Reorder Album items (`items: [{ itemId, position }]`). Uses two-phase atomic updates to satisfy compound unique index `{ albumId: 1, position: 1 }`. Auth required.

---

## Data Models (Phase 1, Phase 6, Phase 7, Phase 8, Phase 10, Phase 11, Phase 12 & Phase 14)

- **`User`** (`src/models/User.js`): Accounts (`username`, `email`, `passwordHash`, `avatar`, `bio`, `timestamps`).
- **`VoiceNote`** (`src/models/VoiceNote.js`): Audio metadata (`ownerId`, `title`, `description`, `tags`, `audioUrl`, `duration`, `visibility`, `deletedAt`, `timestamps`). Compound indexes on `{ ownerId: 1, deletedAt: 1, createdAt: -1 }`, `{ visibility: 1, deletedAt: 1, createdAt: -1 }`, `{ visibility: 1, tags: 1, deletedAt: 1, createdAt: -1 }`, and `{ ownerId: 1, visibility: 1, deletedAt: 1, createdAt: -1 }`.
- **`Like`** (`src/models/Like.js`): Likes join schema (`userId`, `voiceNoteId`, `createdAt`).
- **`Album`** (`src/models/Album.js`): Albums (`ownerId`, `title`, `description`, `coverImage`, `timestamps`).
- **`AlbumItem`** (`src/models/AlbumItem.js`): Album items join schema (`albumId`, `voiceNoteId`, `position`, `createdAt`).
- **`Follow`** (`src/models/Follow.js`): Follow social graph (`followerId`, `followingId`, `createdAt`). Database unique index `{ followerId: 1, followingId: 1 }`.
- **`ActivityEvent`** (`src/models/ActivityEvent.js`): Internal activity logs (`actorId`, `type`, `targetType`, `targetId`, `metadata`, `createdAt`).
- **`Notification`** (`src/models/Notification.js`): In-app notifications (`recipientId`, `actorId`, `type`, `targetType`, `targetId`, `activityEventId`, `metadata`, `readAt`, `createdAt`). Unique index on `{ activityEventId: 1 }`.
- **`NotificationPreference`** (`src/models/NotificationPreference.js`): User notification controls (`userId`, `userFollowed`, `voiceNoteLiked`, `createdAt`, `updatedAt`). Unique index on `{ userId: 1 }`.

---

## Current Status & Phase 14 Scope

> [!NOTE]
> **Phase 0 through Phase 14 Status: COMPLETE.**
> VoiceNote lifecycle management (`deletedAt` soft-deletion), failure-safe audio replacement (`PATCH /api/vns/:id/audio`), owner authorization, deleted content isolation across search/feed/tags/profiles/following feed/albums/statistics, stream/download protection, and regression safety are fully implemented and verified via 47 automated tests (577 total test cases across all phases).

### Intentionally NOT Implemented Yet (Belongs to Future Phases):
- ❌ Push notifications (FCM / APNs)
- ❌ Email & SMS notifications
- ❌ Public albums and album sharing
- ❌ Comments
- ❌ Recommendation algorithms
- ❌ Listening & download history analytics

---

## Future Roadmap

1. **Phase 15 — User Comments & Discussions:** VoiceNote comments, comment replies, and comment notifications.
