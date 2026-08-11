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

   # Run Phase 15 Public Albums & Album Discovery Tests
   node tests/testPhase15PublicAlbums.js

   # Run Phase 16 Content Engagement & Social Metrics Tests
   node tests/testPhase16Engagement.js

   # Run Phase 17 User Comments & Discussions Tests
   node tests/testPhase17Comments.js
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

## Storage & Streaming Architecture (Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, Phase 10, Phase 11, Phase 12, Phase 13, Phase 14, Phase 15, Phase 16 & Phase 17)

The Voice Note storage, streaming foundation, social engagement, and threaded discussion layer utilize a decoupled **Storage Service Abstraction**, **Batched Engagement Service (`EngagementService`)**, **Comment Service (`CommentService`)**, **Real-Time Gateway**, and **Public/Private Album Visibility System**:

```text
User Controller / Follow Controller / Voice Note Controller / Album Controller / Like Controller / Comment Controller / Activity Controller / Notification Controller
        ↓
   User Service / Follow Service / VoiceNote Service / Engagement Service / Comment Service / ActivityEvent Service / Notification Service
        ↓
   Storage Service (Decoupled abstraction layer)  +  Real-Time Gateway (Socket.IO user rooms user:<userId>)
        ↓                                                 ↓
 LocalStorageProvider (backend/storage/audio/)        Connected Recipient (`notification:new`)
```

### Access & Discovery Authorization Matrix (Single Source of Truth)

> [!IMPORTANT]
> **Privacy & Lifecycle Invariant**: Soft-deleted VoiceNotes (`deletedAt != null`) are strictly isolated. All public VoiceNote list responses across all endpoints (public feed, following feed, search, tag discovery, creator profiles, single VN, album items) expose consistent engagement metadata (`likeCount`, `likedByMe`, `commentCount`), using batched N+1-free queries (3 queries total regardless of feed size). Comments support max 1-level reply nesting, soft deletion (`deletedAt = timestamp`, `content = "[deleted]"` for parent masking), and preference-controlled notifications (`voiceNoteCommented`).

| Endpoint Request / Socket Event | Target Visibility | Requester Role | Result | HTTP Status / Event |
| :--- | :--- | :--- | :--- | :--- |
| `GET /api/vns/feed` | Public | Public / Optional Auth | ALLOW (Paginated feed with enriched `likeCount`, `likedByMe`, & `commentCount`) | `200 OK` |
| `GET /api/vns/search` | Public | Public / Optional Auth | ALLOW (Search public VoiceNotes with enriched `likeCount`, `likedByMe`, & `commentCount`) | `200 OK` |
| `GET /api/vns/tags/:tag` | Public | Public / Optional Auth | ALLOW (Tag discovery with enriched `likeCount`, `likedByMe`, & `commentCount`) | `200 OK` |
| `GET /api/vns/:id` | Public | Public / Optional Auth | ALLOW (View single VoiceNote with `likeCount`, `likedByMe`, & `commentCount`) | `200 OK` |
| `POST /api/vns/:id/comments` | Active | Authenticated | ALLOW (Creates comment/reply, triggers `COMMENT_CREATED` ActivityEvent & `VOICE_NOTE_COMMENTED` Notification) | `201 Created` |
| `GET /api/vns/:id/comments` | Public / Accessible | Public / Optional Auth | ALLOW (Paginated top-level comments with 1-level nested replies, sanitized authors) | `200 OK` |
| `DELETE /api/vns/:id/comments/:commentId` | Active | Comment Owner Only | ALLOW (Soft-deletes comment by setting `deletedAt = timestamp`) | `200 OK` |
| `POST /api/vns/:id/like` | Active | Authenticated | ALLOW (Adds Like, returns `{ liked: true, likeCount }`, triggers ActivityEvent & Notification) | `200 OK` |
| `DELETE /api/vns/:id/like` | Active | Authenticated | ALLOW (Removes Like, returns `{ liked: false, likeCount }`) | `200 OK` |
| `GET /api/albums/discover` | Public | Public / Optional Auth | ALLOW (Paginated discovery feed of public albums with publicItemCount) | `200 OK` |
| `GET /api/albums/search` | Public | Public / Optional Auth | ALLOW (Search public albums by title and description) | `200 OK` |
| `GET /api/users/:username/albums` | Public | Public / Optional Auth | ALLOW (Paginated public albums owned by creator) | `200 OK` |
| `GET /api/albums/:id` | Public | Public / Optional Auth | ALLOW (View public album metadata and active public items enriched with engagement metadata) | `200 OK` |
| `GET /api/albums/:id` | Private | Non-Owner / Guest | REJECT (Returns `404 Not Found` to protect private album existence) | `404 Not Found` |
| `DELETE /api/vns/:id` | Active | Owner Only | ALLOW (Soft-deletes VoiceNote by setting `deletedAt = timestamp`) | `200 OK` |

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

### 3. User Management & Public Profiles (Phase 2, Phase 7 & Phase 15)
- **`GET /api/users/me`**: Get current authenticated user profile (includes `email`). Auth required.
- **`PATCH /api/users/me`**: Update current authenticated user profile (`username`, `avatar`, `bio`). Username changes preserve immutable `_id` relationships. Auth required.
- **`GET /api/users/:username`**: Retrieve public user profile metadata and statistics (`stats: { publicVoiceNotes, publicAlbums, followers, following }`). Strips `email` and `passwordHash`. Public / Unauthenticated.
- **`GET /api/users/:username/voice-notes`**: Retrieve paginated list of active public VoiceNotes owned by creator (`?page=1&limit=20`), enriched with `likeCount`, `likedByMe`, and `commentCount`. Public / Unauthenticated.
- **`GET /api/users/:username/albums`**: Retrieve paginated list of public Albums owned by creator (`?page=1&limit=20`). Strictly excludes private Albums. Public / Unauthenticated.

### 4. Followers & Following Social Graph (Phase 8)
- **`POST /api/users/:id/follow`**: Follow a user. Idempotent (`{ following: true }`). Rejects self-follow (`400 Bad Request`). Auth required.
- **`DELETE /api/users/:id/follow`**: Unfollow a user. Idempotent (`{ following: false }`). Auth required.
- **`GET /api/users/:id/follow-status`**: Check if authenticated user follows target user (`{ following: boolean }`). Auth required.
- **`GET /api/users/:id/followers`**: Retrieve paginated list of users following target user (`?page=1&limit=20`). Accepts User ID or username. Public / Unauthenticated.
- **`GET /api/users/:id/following`**: Retrieve paginated list of users followed by target user (`?page=1&limit=20`). Accepts User ID or username. Public / Unauthenticated.

### 5. Voice Note Management, Discovery & Lifecycle (Phase 3, Phase 4, Phase 6, Phase 9, Phase 14, Phase 16 & Phase 17)
- **`GET /api/vns/feed`**: Retrieve global public discovery feed (`visibility = 'public'`, `deletedAt = null`), enriched with `likeCount`, `likedByMe`, and `commentCount`. Optional auth.
- **`GET /api/vns/feed/following`**: Retrieve personalized feed of active public VoiceNotes from followed creators (`?page=1&limit=20`), enriched with `likeCount`, `likedByMe`, and `commentCount`. Auth required.
- **`GET /api/vns/search`**: Search active public VoiceNotes across `title`, `description`, and `tags` (`?page=1&limit=20`), enriched with `likeCount`, `likedByMe`, and `commentCount`. Optional auth.
- **`GET /api/vns/tags/:tag`**: Retrieve active public VoiceNotes matching a normalized tag (`?page=1&limit=20`), enriched with `likeCount`, `likedByMe`, and `commentCount`. Optional auth.
- **`POST /api/vns`**: Upload an audio file and create a VoiceNote (`audio`, `title`, `description`, `visibility`, `tags`). Auth required.
- **`PATCH /api/vns/:id`**: Update VoiceNote metadata (`title`, `description`, `visibility`, `tags`). Owner only. Auth required.
- **`PATCH /api/vns/:id/audio`**: Replace audio file for an existing active VoiceNote (`audio`). Failure-safe. Owner only. Auth required.
- **`GET /api/vns/me`**: Retrieve paginated list of active VoiceNotes owned by current user, enriched with `likeCount`, `likedByMe`, and `commentCount`. Auth required.
- **`GET /api/vns/:id`**: Retrieve single active VoiceNote metadata, enriched with `likeCount`, `likedByMe`, and `commentCount`. Optional auth.
- **`GET /api/vns/:id/stream`**: Stream audio file with HTTP Range support (`bytes=start-end`). Returns 404 for deleted VoiceNotes. Optional auth.
- **`GET /api/vns/:id/download`**: Download complete audio file. Returns 404 for deleted VoiceNotes. Optional auth.
- **`DELETE /api/vns/:id`**: Soft-delete owned VoiceNote (`deletedAt = timestamp`). Owner only. Auth required.

### 6. Comments & Discussions (Phase 17)
- **`POST /api/vns/:id/comments`**: Create a top-level comment or reply (`content`, `parentCommentId`). Enforces 1-level reply limit. Auth required.
- **`GET /api/vns/:id/comments`**: Retrieve paginated top-level comments and 1-level replies for a VoiceNote (`?page=1&limit=20`). Optional auth.
- **`DELETE /api/vns/:id/comments/:commentId`**: Soft-delete comment owned by user (`deletedAt = timestamp`). Comment owner only. Auth required.

### 7. Activity Events Foundation (Phase 10 & Phase 17)
- **`GET /api/activity/me`**: Retrieve paginated list of activity events generated by authenticated user (`?page=1&limit=20`). Auth required.

### 8. In-App Notifications & Real-Time Delivery (Phase 11, Phase 12, Phase 13 & Phase 17)
- **`GET /api/notifications`**: Retrieve paginated notifications for authenticated user (`?page=1&limit=20&unread=true`). Auth required.
- **`GET /api/notifications/preferences`**: Retrieve notification preferences for authenticated user (`userFollowed`, `voiceNoteLiked`, `voiceNoteCommented`). Auth required.
- **`PATCH /api/notifications/preferences`**: Update notification preferences for authenticated user. Auth required.
- **`PATCH /api/notifications/read-all`**: Mark all unread notifications as read. Auth required.
- **`PATCH /api/notifications/:id/read`**: Mark single notification as read. Auth required.
- **Socket.IO Real-Time Gateway**: Authenticated sockets (`auth.token`) join room `user:<userId>`. Emits `notification:new` payloads instantly.

### 9. Likes & Engagement (Phase 5 & Phase 16)
- **`POST /api/vns/:id/like`**: Add a Like for a VoiceNote. Returns `{ liked: true, likeCount }`. Idempotent. Auth required.
- **`DELETE /api/vns/:id/like`**: Remove a Like for a VoiceNote. Returns `{ liked: false, likeCount }`. Idempotent. Auth required.
- **`GET /api/vns/:id/likes`**: Get aggregate Like count and `likedByMe` status (`{ count, likedByMe }`). Optional auth.

### 10. Albums & Album Discovery (Phase 5, Phase 15, Phase 16 & Phase 17)
- **`GET /api/albums/discover`**: Retrieve paginated discovery feed of public Albums (`visibility = 'public'`). Optional auth.
- **`GET /api/albums/search`**: Search public Albums by `title` and `description` (`?q=query&page=1&limit=20`). Optional auth.
- **`POST /api/albums`**: Create a new Album (`title`, `description`, `coverImage`, `visibility`). Auth required.
- **`GET /api/albums`**: Retrieve paginated list of Albums owned by current user. Auth required.
- **`GET /api/albums/:id`**: Retrieve single Album with items sorted by `position ASC`. Items include VoiceNote details enriched with `likeCount`, `likedByMe`, and `commentCount`. Public if `visibility = 'public'`, owner-only if `visibility = 'private'`. Filters out private and deleted VoiceNotes for non-owners. Optional auth.
- **`PATCH /api/albums/:id`**: Update Album metadata (`title`, `description`, `coverImage`, `visibility`). Auth required.
- **`DELETE /api/albums/:id`**: Delete Album and its `AlbumItem` join records. Auth required.
- **`POST /api/albums/:id/items`**: Add an accessible active VoiceNote to an Album (`voiceNoteId`). Auth required.
- **`DELETE /api/albums/:id/items/:itemId`**: Remove an item from an Album. Auth required.
- **`PATCH /api/albums/:id/items/reorder`**: Reorder Album items (`items: [{ itemId, position }]`). Uses two-phase atomic updates. Auth required.

---

## Data Models (Phase 1, Phase 6, Phase 7, Phase 8, Phase 10, Phase 11, Phase 12, Phase 14, Phase 15, Phase 16 & Phase 17)

- **`User`** (`src/models/User.js`): Accounts (`username`, `email`, `passwordHash`, `avatar`, `bio`, `timestamps`).
- **`VoiceNote`** (`src/models/VoiceNote.js`): Audio metadata (`ownerId`, `title`, `description`, `tags`, `audioUrl`, `duration`, `visibility`, `deletedAt`, `timestamps`).
- **`Comment`** (`src/models/Comment.js`): Comments (`voiceNoteId`, `userId`, `parentCommentId`, `content`, `deletedAt`, `timestamps`). Compound indexes on `{ voiceNoteId: 1, deletedAt: 1, createdAt: 1 }` and `{ parentCommentId: 1, deletedAt: 1, createdAt: 1 }`.
- **`Like`** (`src/models/Like.js`): Likes join schema (`userId`, `voiceNoteId`, `createdAt`). Compound unique index on `{ userId: 1, voiceNoteId: 1 }`.
- **`Album`** (`src/models/Album.js`): Albums (`ownerId`, `title`, `description`, `coverImage`, `visibility`, `timestamps`). Compound indexes on `{ ownerId: 1, createdAt: -1 }`, `{ visibility: 1, createdAt: -1 }`, and `{ ownerId: 1, visibility: 1, createdAt: -1 }`.
- **`AlbumItem`** (`src/models/AlbumItem.js`): Album items join schema (`albumId`, `voiceNoteId`, `position`, `createdAt`).
- **`Follow`** (`src/models/Follow.js`): Follow social graph (`followerId`, `followingId`, `createdAt`).
- **`ActivityEvent`** (`src/models/ActivityEvent.js`): Internal activity logs (`actorId`, `type`, `targetType`, `targetId`, `metadata`, `createdAt`).
- **`Notification`** (`src/models/Notification.js`): In-app notifications (`recipientId`, `actorId`, `type`, `targetType`, `targetId`, `activityEventId`, `metadata`, `readAt`, `createdAt`).
- **`NotificationPreference`** (`src/models/NotificationPreference.js`): User notification controls (`userId`, `userFollowed`, `voiceNoteLiked`, `voiceNoteCommented`, `createdAt`, `updatedAt`).

### 11. Direct Messaging, Offline Media Access & Downloads (Phase 18, Phase 19, Phase 20, Phase 21 & Phase 22)
- **`POST /api/conversations`**: Create or retrieve an existing 1-to-1 conversation with a target user (`userId`). Uses deterministic participant pairing (`[userA, userB].sort()`) and DB unique compound index. Auth required.
- **`GET /api/conversations`**: Retrieve paginated list of conversations for current user (`?page=1&limit=20`), enriched with sanitized `otherParticipant`, `unreadCount`, and `lastMessage`. Auth required.
- **`GET /api/conversations/:id`**: Retrieve details for a single conversation. Participant only. Auth required.
- **`POST /api/conversations/:id/messages`**: Send a text message inside a conversation (`content`). Auth required.
- **`POST /api/conversations/:id/messages/audio`**: Upload and send an audio message (`audio`). Validates audio container magic bytes, file extension, MIME type, max file size (10MB), and max duration (300s). Failure-safe rollback. Auth required.
- **`GET /api/conversations/:id/messages/:messageId/audio`**: Stream private audio message with HTTP Range support (`bytes=start-end`, `bytes=start-`, `bytes=-suffix`). Enforces strict conversation participant authorization, non-deleted state (`deletedAt = null`), storage existence, and outputs `200 OK`, `206 Partial Content`, or `416 Range Not Satisfiable` with `Cache-Control: private, no-cache, no-store`. Participant only. Auth required.
- **`GET /api/conversations/:id/messages/:messageId/download`**: Download private conversation audio message with `Content-Disposition: attachment`, HTTP Range support, and strict participant authorization. Participant only. Auth required.
- **`GET /api/vns/:id/download`**: Download VoiceNote file with `Content-Disposition: attachment`, HTTP Range support, and public/owner authorization checks. Auth required (or public for public active VoiceNotes).
- **`POST /api/downloads`**: Initiate or retrieve download tracking record for a VoiceNote or private audio message (`mediaType`, `voiceNoteId`, `messageId`, `deviceId`). Auth required.
- **`GET /api/downloads`**: Retrieve user's download records with dynamic authorization re-evaluation (revokes unauthorized/deleted media). Auth required.
- **`GET /api/downloads/:id`**: Retrieve single download record with dynamic authorization re-evaluation. Auth required.
- **`PATCH /api/downloads/:id`**: Update download lifecycle status (`pending`, `active`, `completed`, `failed`, `revoked`). Auth required.
- **`AudioCleanupService`** (`src/services/audioCleanup.service.js`): Controlled internal audio storage lifecycle cleanup service (`cleanupDeletedAudioMessages`, `detectOrphanAudioFiles`). Manages configurable retention periods (`AUDIO_DELETED_RETENTION_DAYS`, default: 7 days), batched candidate selection, duplicate storage reference protection, physical file deletion, missing file handling, and orphan detection without hard-deleting Mongoose `Message` documents.

---

## Data Models (Phase 1, Phase 6, Phase 7, Phase 8, Phase 10, Phase 11, Phase 12, Phase 14, Phase 15, Phase 16, Phase 17, Phase 18, Phase 19, Phase 20, Phase 21 & Phase 22)

- **`User`** (`src/models/User.js`): Accounts (`username`, `email`, `passwordHash`, `avatar`, `bio`, `timestamps`).
- **`VoiceNote`** (`src/models/VoiceNote.js`): Audio metadata (`ownerId`, `title`, `description`, `tags`, `audioUrl`, `duration`, `visibility`, `deletedAt`, `timestamps`).
- **`Conversation`** (`src/models/Conversation.js`): 1-to-1 conversations (`participantOne`, `participantTwo`, `lastMessageAt`, `lastMessageId`, `timestamps`). Compound unique index on `{ participantOne: 1, participantTwo: 1 }`.
- **`Message`** (`src/models/Message.js`): Text & audio messages (`conversationId`, `senderId`, `content`, `messageType: 'text'|'audio'`, `audioUrl`, `duration`, `mimeType`, `fileSize`, `readAt`, `deletedAt`, `timestamps`). Compound indexes on `{ conversationId: 1, deletedAt: 1, createdAt: 1 }` and `{ conversationId: 1, senderId: 1, readAt: 1, deletedAt: 1 }`.
- **`Download`** (`src/models/Download.js`): Offline media download tracking (`userId`, `mediaType`, `voiceNoteId`, `messageId`, `conversationId`, `deviceId`, `status`, `fileSize`, `mimeType`, `downloadUrl`, `errorMessage`, `lastAccessedAt`, `timestamps`). Compound unique index on `{ userId: 1, mediaType: 1, voiceNoteId: 1, messageId: 1, deviceId: 1 }`.
- **`Comment`** (`src/models/Comment.js`): Comments (`voiceNoteId`, `userId`, `parentCommentId`, `content`, `deletedAt`, `timestamps`). Compound indexes on `{ voiceNoteId: 1, deletedAt: 1, createdAt: 1 }` and `{ parentCommentId: 1, deletedAt: 1, createdAt: 1 }`.
- **`Like`** (`src/models/Like.js`): Likes join schema (`userId`, `voiceNoteId`, `createdAt`). Compound unique index on `{ userId: 1, voiceNoteId: 1 }`.
- **`Album`** (`src/models/Album.js`): Albums (`ownerId`, `title`, `description`, `coverImage`, `visibility`, `timestamps`). Compound indexes on `{ ownerId: 1, createdAt: -1 }`, `{ visibility: 1, createdAt: -1 }`, and `{ ownerId: 1, visibility: 1, createdAt: -1 }`.
- **`AlbumItem`** (`src/models/AlbumItem.js`): Album items join schema (`albumId`, `voiceNoteId`, `position`, `createdAt`).
- **`Follow`** (`src/models/Follow.js`): Follow social graph (`followerId`, `followingId`, `createdAt`).
- **`ActivityEvent`** (`src/models/ActivityEvent.js`): Internal activity logs (`actorId`, `type`, `targetType`, `targetId`, `metadata`, `createdAt`).
- **`Notification`** (`src/models/Notification.js`): In-app notifications (`recipientId`, `actorId`, `type`, `targetType`, `targetId`, `activityEventId`, `metadata`, `readAt`, `createdAt`).
- **`NotificationPreference`** (`src/models/NotificationPreference.js`): User notification controls (`userId`, `userFollowed`, `voiceNoteLiked`, `voiceNoteCommented`, `createdAt`, `updatedAt`).

---

## Current Status & Phase 22 Scope

> [!NOTE]
> **Phase 0 through Phase 22 Status: COMPLETE.**
> Private 1-to-1 direct messaging, deterministic participant pairing, text & audio messages (`messageType = 'audio'`), audio container signature validation (magic bytes), duration extraction, max file size & duration limits, storage failure rollback (no orphan files), authorization-aware private audio streaming (`GET /api/conversations/:id/messages/:messageId/audio`), HTTP byte range request parsing (`bytes=start-end`, `bytes=start-`, `bytes=-suffix`), `200 OK`, `206 Partial Content`, and `416 Range Not Satisfiable` HTTP responses, `Cache-Control` security, configurable audio retention lifecycle (`AUDIO_DELETED_RETENTION_DAYS`, default: 7 days), `AudioCleanupService` batched file cleanup, idempotency, duplicate reference protection, orphan file detection, non-destructive Message document preservation, offline media access download endpoints (`GET /api/vns/:id/download` and `GET /api/conversations/:id/messages/:messageId/download`), `Content-Disposition: attachment` headers, `Download` state tracking model, status updates (`pending`, `active`, `completed`, `failed`, `revoked`), dynamic authorization re-evaluation, user and device isolation, conversation listing with batched unread counts, recipient message read state updates, soft deletion (`deletedAt = timestamp`), real-time Socket.IO delivery (`message:new`), privacy boundaries, and regression safety are fully implemented and verified via 53 automated tests in `testPhase22OfflineMedia.js` (1,029 passing test cases across all phases).

### Intentionally NOT Implemented Yet (Belongs to Future Phases):
- ❌ Production hardening, security rate-limiting & final audit (Phase 23)
- ❌ Client-side offline cache/storage implementation (frontend/mobile responsibility)
- ❌ Group chats / group audio messages
- ❌ Message reactions or message editing
- ❌ Typing indicators or presence system

---

## Future Roadmap

1. **Phase 23 — Production Hardening, Security & Final Backend Audit:** Security hardening, rate limiting, final performance audit, and production deployment preparation.
