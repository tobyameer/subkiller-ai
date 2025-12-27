# Backend Server Startup Guide

## Quick Start

### Start Backend Only
```bash
cd /Users/mohsenameer/repos/react/subkiller
npm run dev:server
```

### Start Frontend Only
```bash
cd /Users/mohsenameer/repos/react/subkiller
npm run dev:client
```

### Start Both (Backend + Frontend)
```bash
cd /Users/mohsenameer/repos/react/subkiller
npm run dev
```

## Developer Checklist

### 1. Verify Backend is Running

**Check health endpoint:**
```bash
curl http://localhost:4000/api/health
```

**Expected response:**
```json
{
  "ok": true,
  "time": "2024-01-15T10:30:00.000Z",
  "db": "connected"
}
```

**If DB is down, you'll see:**
```json
{
  "ok": true,
  "time": "2024-01-15T10:30:00.000Z",
  "db": "disconnected"
}
```
Server still runs, but database routes return 503.

### 2. Check Backend Logs

When backend starts successfully, you should see:
```
==================================================
[startup] SubKiller Backend Starting...
[startup] PORT: 4000
[startup] NODE_ENV: development
[startup] MONGO_URI: mongodb://localhost:27017/subkiller
[startup] FRONTEND_ORIGIN: http://localhost:5173, http://localhost:5174, ...
[startup] Google OAuth configured: true
==================================================
[db] Connected to MongoDB
==================================================
[startup] ✅ SubKiller backend running on http://localhost:4000
[startup] Health check: http://localhost:4000/api/health
[startup] MongoDB: ✅ Connected
==================================================
```

### 3. Verify Frontend Can Connect

Open browser console and check:
- `[api] BASE_URL configured: http://localhost:4000` ✅
- No `ERR_CONNECTION_REFUSED` errors ✅
- `/api/auth/me` or `/api/health` requests succeed ✅

## Troubleshooting

### Backend Won't Start

**1. Missing Environment Variables**
Error: `Missing required env var JWT_ACCESS_SECRET`

Solution: Create `.env` file in project root:
```bash
JWT_ACCESS_SECRET=your-secret-here
JWT_REFRESH_SECRET=your-refresh-secret-here
OPENAI_API_KEY=sk-...
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
GOOGLE_REDIRECT_URI=http://localhost:4000/api/gmail/callback
MONGO_URI=mongodb://localhost:27017/subkiller
PORT=4000
NODE_ENV=development
```

**2. Port Already in Use**
Error: `Port 4000 is already in use`

Solution:
```bash
# Find and kill the process
lsof -ti:4000 | xargs kill -9

# Or use a different port
PORT=4001 npm run dev:server
```

**3. MongoDB Not Running**
Server will start but in "degraded mode":
```
[startup] ⚠️ Starting server in degraded mode (MongoDB not connected)
```

Solution:
```bash
# On macOS with Homebrew:
brew services start mongodb-community

# Or start manually:
mongod
```

**4. Server Crashes on Startup**
Check console for error messages. Common issues:
- Missing required env vars (see #1)
- Invalid MongoDB URI
- Port conflict (see #2)

### Frontend Shows Connection Errors

**Error: `ERR_CONNECTION_REFUSED`**
- Backend is not running → Start it: `npm run dev:server`
- Backend is on wrong port → Check backend logs for actual port
- Firewall blocking → Check firewall settings

**Error: `CORS` blocked**
- Backend CORS allows localhost:5173, localhost:5174, 127.0.0.1:5173, 127.0.0.1:5174
- If frontend is on a different port, add it to `FRONTEND_ORIGIN` env var

## Testing Endpoints

```bash
# Health check (works even if DB is down)
curl http://localhost:4000/api/health

# Test newsletter subscription (requires DB)
curl -X POST http://localhost:4000/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# Test auth status (requires DB + auth)
curl http://localhost:4000/api/auth/me \
  -H "Cookie: accessToken=..."
```

## Expected Ports

- **Backend**: http://localhost:4000 (or PORT env var)
- **Frontend**: http://localhost:5173 (or 5174 if 5173 is busy)

