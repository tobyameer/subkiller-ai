# SubKiller Testing Guide

This document provides manual testing checklists for verifying SubKiller functionality in local development and production environments.

## Local Development Testing

### Prerequisites

- Backend server running: `npm run dev:server`
- Frontend dev server running: `cd frontendMain && npm run dev`
- MongoDB running (local or Atlas)
- Environment variables configured (see `README.md`)

### 1. Health Endpoint

**Test:** Backend health check

```bash
curl http://localhost:4000/api/health
```

**Expected:** 
```json
{
  "ok": true,
  "time": "2024-01-01T00:00:00.000Z",
  "db": "connected"
}
```

**Status:** ✅ Pass / ❌ Fail

---

### 2. Authentication Flow

**Test:** User registration and login

1. Navigate to `http://localhost:5173/register`
2. Fill in registration form
3. Submit and verify account is created
4. Navigate to `http://localhost:5173/login`
5. Log in with created credentials
6. Verify redirect to dashboard

**Expected:** 
- Registration succeeds
- Login succeeds
- User is authenticated and redirected

**Status:** ✅ Pass / ❌ Fail

---

### 3. Newsletter Subscription

**Test:** Newsletter subscription endpoint

```bash
curl -X POST http://localhost:4000/api/newsletter/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Expected:**
```json
{
  "ok": true,
  "emailSaved": true,
  "emailSent": false
}
```

**Status:** ✅ Pass / ❌ Fail

**Notes:** 
- `emailSent` will be `false` in development if SMTP is not configured (uses mock mode)
- Check server logs for email mock logs

---

### 4. AI Copilot Chat

**Test:** AI chat endpoint (customer support questions)

```bash
# Test without authentication (public support)
curl -X POST http://localhost:4000/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"How do I connect Gmail?"}'
```

**Expected:**
```json
{
  "reply": "To connect Gmail, click the 'Connect Gmail' button on the Dashboard..."
}
```

**Test:** AI chat with authentication (data analysis)

1. Log in to the app
2. Navigate to `/ai-copilot`
3. Ask a question like "How do I connect Gmail?"
4. Verify helpful response about SubKiller
5. If you have subscription data, ask "What are my subscriptions?"

**Expected:**
- Support questions get helpful answers
- Data analysis questions use subscription context if available
- Rate limiting works (try 11 requests quickly - should get 429 error)

**Status:** ✅ Pass / ❌ Fail

---

### 5. Rate Limiting

**Test:** Rate limit enforcement

```bash
# Make 11 requests rapidly to auth endpoint
for i in {1..11}; do
  curl -X POST http://localhost:4000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' &
done
wait
```

**Expected:** 
- First 10 requests should process (return 401 for wrong password, but not rate limited)
- 11th request should return 429 (Too Many Requests)

**Status:** ✅ Pass / ❌ Fail

---

### 6. CORS Configuration

**Test:** CORS allows frontend origin

1. Open browser DevTools → Network tab
2. Navigate to `http://localhost:5173`
3. Check that API requests succeed
4. Verify no CORS errors in console

**Expected:**
- All API requests succeed
- No CORS errors in console
- `Access-Control-Allow-Origin` header present in responses

**Status:** ✅ Pass / ❌ Fail

---

## Production Testing

After deploying to production (Netlify frontend + Render backend):

### 1. Health Endpoint

```bash
curl https://your-backend-url.onrender.com/api/health
```

**Expected:** Same as local testing

**Status:** ✅ Pass / ❌ Fail

---

### 2. Frontend Loads

1. Visit your Netlify URL
2. Verify page loads without errors
3. Check browser console for errors

**Expected:**
- Page loads correctly
- No console errors
- API calls go to production backend URL

**Status:** ✅ Pass / ❌ Fail

---

### 3. Authentication Flow

1. Register a new account
2. Log in
3. Verify dashboard loads

**Expected:** Same as local testing

**Status:** ✅ Pass / ❌ Fail

---

### 4. CORS Verification

1. Open browser DevTools → Network tab
2. Make API requests from frontend
3. Verify no CORS errors

**Expected:**
- Requests succeed
- No CORS errors
- `Access-Control-Allow-Credentials: true` header present

**Status:** ✅ Pass / ❌ Fail

---

### 5. Gmail Connection

1. Log in to app
2. Click "Connect Gmail"
3. Complete OAuth flow
4. Verify Gmail connection status shows connected

**Expected:**
- OAuth redirect works
- Gmail connection succeeds
- Connection status updates

**Status:** ✅ Pass / ❌ Fail

---

### 6. Newsletter Subscription

1. From landing page (not logged in)
2. Subscribe to newsletter
3. Check email (if SMTP configured)

**Expected:**
- Subscription succeeds
- Confirmation email received (if SMTP configured)
- Response shows `emailSent: true` if SMTP works

**Status:** ✅ Pass / ❌ Fail

---

### 7. AI Copilot (Production)

1. Log in as Pro user
2. Navigate to `/ai-copilot`
3. Ask support questions
4. Ask data analysis questions (if subscriptions exist)
5. Test rate limiting (11 rapid requests)

**Expected:**
- Support questions answered correctly
- Data analysis uses subscription context
- Rate limiting works (429 after 10 requests/min)

**Status:** ✅ Pass / ❌ Fail

---

## Automated Tests (Optional)

### Health Endpoint Test

Create `dist-server/tests/health.test.js`:

```javascript
import request from "supertest";
import { app } from "../server.js"; // You'd need to export app from server.js

describe("GET /api/health", () => {
  it("should return 200 with ok status", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.time).toBeDefined();
  });
});
```

### AI Chat Input Validation Test

Create `dist-server/tests/aiChat.test.js`:

```javascript
import request from "supertest";
import { app } from "../server.js";

describe("POST /api/ai/chat", () => {
  it("should reject empty message", async () => {
    const res = await request(app)
      .post("/api/ai/chat")
      .send({ message: "" });
    expect(res.status).toBe(400);
  });

  it("should reject message too long", async () => {
    const longMessage = "a".repeat(501);
    const res = await request(app)
      .post("/api/ai/chat")
      .send({ message: longMessage });
    expect(res.status).toBe(400);
  });

  it("should accept valid message", async () => {
    const res = await request(app)
      .post("/api/ai/chat")
      .send({ message: "How do I connect Gmail?" });
    expect(res.status).toBe(200);
    expect(res.body.reply).toBeDefined();
  });
});
```

---

## Common Issues

### Backend not reachable

- **Check:** Backend server is running
- **Check:** `VITE_API_URL` is set correctly
- **Check:** Backend URL is accessible (curl health endpoint)

### CORS errors

- **Check:** `FRONTEND_ORIGIN` includes your frontend URL
- **Check:** Backend CORS configuration allows credentials
- **Check:** Origin matches exactly (including protocol and port)

### Rate limiting too strict

- **Check:** Rate limit configuration in `dist-server/middleware/rateLimit.js`
- **Check:** Limits are appropriate for your use case

### AI Copilot not responding

- **Check:** `OPENAI_API_KEY` is set in backend
- **Check:** Backend logs for OpenAI API errors
- **Check:** Rate limiting hasn't blocked requests

### Authentication fails

- **Check:** JWT secrets are set
- **Check:** Cookies are being sent (check Network tab)
- **Check:** CORS allows credentials

---

## Test Summary

| Test | Local | Production |
|------|-------|------------|
| Health endpoint | ⬜ | ⬜ |
| Authentication | ⬜ | ⬜ |
| Newsletter | ⬜ | ⬜ |
| AI Copilot | ⬜ | ⬜ |
| Rate limiting | ⬜ | ⬜ |
| CORS | ⬜ | ⬜ |
| Gmail connect | ⬜ | ⬜ |

**Legend:** ⬜ Not tested | ✅ Pass | ❌ Fail
