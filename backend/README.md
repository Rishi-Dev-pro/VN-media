# Voice Note (VN) Platform — Backend API

This repository contains the backend REST API foundation, database models, and authentication system for the Voice Note (VN) sharing platform. It is engineered with an API-first architecture to serve both modern web (React) and mobile (React Native / Expo Android) applications.

---

## Technical Stack

- **Runtime:** Node.js (`v24.x`)
- **Web Framework:** Express (`v4.x`)
- **Database:** MongoDB (`v8.x`)
- **ODM:** Mongoose (`v8.x`)
- **Authentication:** `jsonwebtoken` (JWT), `bcryptjs` (Password hashing)
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

---

## Authentication Architecture (Phase 2)

Authentication uses stateless **JSON Web Tokens (JWT)**. Passwords are hashed asynchronously using `bcryptjs` (salt cost factor 10) prior to database persistence.

### Protected Endpoint Usage
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
  - **Request Body:**
    ```json
    {
      "username": "john_doe",
      "email": "john@example.com",
      "password": "securePassword123"
    }
    ```
  - **Response (201 Created):**
    ```json
    {
      "success": true,
      "message": "User registered successfully",
      "data": {
        "user": {
          "id": "6a774...",
          "username": "john_doe",
          "email": "john@example.com",
          "avatar": null,
          "bio": "",
          "createdAt": "2026-08-08T15:00:00.000Z",
          "updatedAt": "2026-08-08T15:00:00.000Z"
        }
      }
    }
    ```

- **`POST /api/auth/login`**: Authenticate credentials and receive a JWT.
  - **Request Body:**
    ```json
    {
      "email": "john@example.com",
      "password": "securePassword123"
    }
    ```
  - **Response (200 OK):**
    ```json
    {
      "success": true,
      "message": "Login successful",
      "data": {
        "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
        "user": {
          "id": "6a774...",
          "username": "john_doe",
          "email": "john@example.com",
          "avatar": null,
          "bio": ""
        }
      }
    }
    ```

### 3. User Management (Protected)
- **`GET /api/users/me`**: Get current authenticated user profile.
  - **Headers:** `Authorization: Bearer <token>`
  - **Response (200 OK):** Returns current user details (excluding `passwordHash`).

- **`PATCH /api/users/me`**: Update current authenticated user profile (`username`, `avatar`, `bio`).
  - **Headers:** `Authorization: Bearer <token>`
  - **Request Body:**
    ```json
    {
      "username": "john_updated",
      "avatar": "https://storage.vnplatform.com/avatars/john.png",
      "bio": "Voice note creator."
    }
    ```
  - **Response (200 OK):** Returns updated user profile.

---

## Data Models (Phase 1)

- **`User`** (`src/models/User.js`): Accounts (`username`, `email`, `passwordHash`, `avatar`, `bio`, `timestamps`).
- **`VoiceNote`** (`src/models/VoiceNote.js`): Audio metadata (`ownerId`, `title`, `description`, `audioUrl`, `duration`, `visibility`, `timestamps`).
- **`Like`** (`src/models/Like.js`): Likes join schema (`userId`, `voiceNoteId`, `createdAt`).
- **`Album`** (`src/models/Album.js`): Albums (`ownerId`, `title`, `description`, `coverImage`, `timestamps`).
- **`AlbumItem`** (`src/models/AlbumItem.js`): Album items join schema (`albumId`, `voiceNoteId`, `position`, `createdAt`).

---

## Current Status & Phase 2 Scope

> [!NOTE]
> **Phase 0, Phase 1 & Phase 2 Status: COMPLETE.**
> Authentication, user management, and database models are fully implemented and verified via 27 automated tests.

### Intentionally NOT Implemented Yet (Belongs to Future Phases):
- ❌ VoiceNote creation/upload API (`POST /api/vns`)
- ❌ Audio file upload & cloud storage handlers
- ❌ Audio streaming & offline download endpoints
- ❌ Like/Unlike API endpoints (`POST /api/vns/:id/like`)
- ❌ Album creation & reordering API endpoints
- ❌ Search, discovery, & social feed features

---

## Future Roadmap

1. **Phase 3 — Voice Note Core & File Storage:** Storage service abstraction, audio file uploads, metadata extraction, VN routes.
2. **Phase 4 — Social Features & Albums:** Likes API, Album CRUD, AlbumItem ordering endpoints, public feeds.
