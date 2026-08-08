# Voice Note (VN) Platform — Backend API (Phase 0 Foundation)

This repository contains the backend REST API foundation for the Voice Note (VN) sharing platform. It is engineered with an API-first architecture to serve both modern web (React) and mobile (React Native / Expo Android) applications.

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
   Modify `.env` variables if your local setup requires custom ports or MongoDB URIs.

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

## API Endpoints

### Health Status
- **URL:** `/api/health`
- **Method:** `GET`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "VN Platform API is running",
    "data": {
      "status": "ok",
      "uptime": 12.34,
      "timestamp": "2026-08-08T15:00:00.000Z",
      "database": {
        "state": "connected",
        "isConnected": true,
        "host": "localhost:27017",
        "name": "vn_platform"
      }
    }
  }
  ```

### 404 Route Handling
Unmatched routes (e.g. `GET /api/nonexistent`) return:
```json
{
  "success": false,
  "message": "Route GET /api/nonexistent not found"
}
```

---

## Project Structure

```
backend/
├── src/
│   ├── config/          # Environment configuration and MongoDB connection setup
│   ├── controllers/     # Route handler logic
│   ├── middleware/      # Global 404 and centralized error handling middleware
│   ├── models/          # Reserved for future Mongoose data models
│   ├── routes/          # API endpoint router declarations
│   ├── services/        # Business logic services
│   ├── utils/           # Standardized API response utilities
│   ├── app.js           # Express app setup and middleware configuration
│   └── server.js        # Server bootstrapper & graceful shutdown handler
├── .env
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

---

## Current Status & Phase 0 Limitations

> [!NOTE]
> **Phase 0 Status: COMPLETE.**
> This codebase currently represents the core architectural foundation.

### Not Implemented Yet (Planned for Future Phases):
- ❌ User registration, login, JWT authentication, password hashing
- ❌ User profile management
- ❌ Voice note audio uploads, metadata, and S3 / cloud storage integration
- ❌ Audio streaming and offline download endpoints
- ❌ Public / Private visibility permissions
- ❌ Likes, Albums, and Album Items
- ❌ Search and discovery features

---

## Future Roadmap (Phase 1+)

1. **Phase 1 — Authentication & User Management:** User model, password hashing (bcrypt), JWT generation/validation middleware, user profiles.
2. **Phase 2 — Voice Note Core & File Storage:** Storage service abstraction (local/cloud), VoiceNote model, file uploads, audio metadata extraction.
3. **Phase 3 — Social Features & Albums:** Like system, Album and AlbumItem models, public feed API.
