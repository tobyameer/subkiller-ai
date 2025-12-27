# SubKiller Production Deployment Guide

This guide walks you through deploying SubKiller to production:

- **Frontend**: Netlify (static hosting)
- **Backend**: Render/Railway/Fly.io (Node.js server)

## Prerequisites

- Git repository hosted on GitHub/GitLab/Bitbucket
- MongoDB database (MongoDB Atlas recommended)
- Accounts:
  - Netlify (free tier works)
  - Render/Fly.io/Railway (free tier works for Render)
- Google Cloud Console project (for OAuth)
- OpenAI API key (for AI Copilot)

---

## Part A: Deploy Backend First

**IMPORTANT**: Deploy the backend first to get the backend URL, then configure the frontend.

### Step 1: Choose Backend Host

Choose one:

- **Render** (recommended for simplicity)
- **Railway** (good free tier)
- **Fly.io** (good performance)

### Step 2: Create Backend Service

#### Option A: Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. Click **"New +"** → **"Web Service"**
3. **Connect your Git repository** (if not already connected)
4. **Select your repository** (subkiller)

**Configure Build Settings:**

- **Name**: `subkiller-backend` (or your preferred name)
- **Environment**: `Node`
- **Region**: Choose closest to your users
- **Branch**: `main` (or your default branch)
- **Root Directory**: Leave empty
- **Runtime**: `Node`
- **Build Command**: Leave empty (backend doesn't need building)
- **Start Command**: `node --experimental-specifier-resolution=node dist-server/server.js`
- **Instance Type**: Free tier works (will spin down after inactivity)

#### Option B: Railway

1. **Go to Railway**: https://railway.app
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Select your repository
4. **Settings** → **Generate Domain** (or use custom domain)
5. **Settings** → **Deploy**:
   - **Start Command**: `node --experimental-specifier-resolution=node dist-server/server.js`
   - **Root Directory**: Leave empty

#### Option C: Fly.io

1. **Install Fly CLI**: `curl -L https://fly.io/install.sh | sh`
2. **Login**: `fly auth login`
3. **Launch**: `fly launch` (in repo root)
4. Configure:
   - **App name**: subkiller-backend
   - **Region**: Choose closest
   - **Postgres**: No (using MongoDB)
   - **Redis**: No
5. **Edit `fly.toml`** (if created):

   ```toml
   [build]
     builder = "paketobuildpacks/builder:base"

   [[services]]
     internal_port = 4000
     protocol = "tcp"
   ```

6. **Deploy**: `fly deploy`

### Step 3: Add Environment Variables

**In your backend host dashboard**, add these environment variables:

#### Required Variables:

```bash
# Server (Render/Railway/Fly will set PORT automatically, but include as fallback)
PORT=10000
NODE_ENV=production

# Database
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/subkiller

# JWT Secrets (generate secure random strings)
# Generate with: openssl rand -hex 32
JWT_ACCESS_SECRET=your-super-secret-access-key-min-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-min-32-chars

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=https://your-backend-url.onrender.com/api/gmail/callback

# OpenAI (for AI Copilot)
OPENAI_API_KEY=sk-...

# CORS Origins (will be updated after frontend deployment)
# For now, include your local dev URLs + placeholder for Netlify
CORS_ORIGINS=http://localhost:5173,http://localhost:5174,https://your-site-name.netlify.app
```

#### Optional Variables:

```bash
# Stripe (if using billing)
STRIPE_SECRET_KEY=sk_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_PREMIUM=price_...

# Plaid (if using bank connections)
PLAID_CLIENT_ID=your-plaid-client-id
PLAID_SECRET=your-plaid-secret
PLAID_ENV=production  # or 'sandbox'

# Email (Resend API) - Production-safe, works on free hosting
RESEND_API_KEY=re_xxxxxxxxxxxxx  # Get from https://resend.com/api-keys
EMAIL_FROM=no-reply@subkiller.app  # Must be verified domain in Resend (or use default)
```

**Important Notes:**

- Generate JWT secrets: `openssl rand -hex 32`
- For MongoDB, use MongoDB Atlas connection string
- For Resend, sign up at https://resend.com and get an API key
- `EMAIL_FROM` must use a verified domain in Resend (or use default `no-reply@subkiller.app`)
- In development (`NODE_ENV !== "production"`), emails are automatically logged instead of sent

### Step 4: Deploy Backend

1. Click **"Create Web Service"** (Render) or **"Deploy"** (Railway/Fly)
2. Wait for deployment to complete
3. **Copy the service URL** (e.g., `https://subkiller-backend.onrender.com`)
4. **Test health endpoint**: `curl https://your-backend-url.onrender.com/api/health`
   - Should return: `{"ok":true,"time":"...","uptime":...,"env":"production","db":"connected"}`

### Step 5: Update Google OAuth Redirect URI

1. **Go to Google Cloud Console**: https://console.cloud.google.com
2. Navigate to **APIs & Services** → **Credentials**
3. Find your OAuth 2.0 Client ID
4. **Add Authorized redirect URIs**:
   - Production: `https://your-backend-url.onrender.com/api/gmail/callback`
   - Development: `http://localhost:4000/api/gmail/callback`
5. **Save**

### Step 6: Update CORS Origins

After you deploy the frontend (Part B), return here:

1. In your backend host dashboard, go to **Environment Variables**
2. Update `CORS_ORIGINS` to include your Netlify URL:
   ```
   CORS_ORIGINS=https://your-site-name.netlify.app,http://localhost:5173,http://localhost:5174
   ```
3. **Redeploy** the backend service

---

## Part B: Deploy Frontend to Netlify

### Step 1: Prepare Repository

The repository is already configured with `netlify.toml` at the root. Verify it exists.

### Step 2: Create Netlify Site

1. **Go to Netlify Dashboard**: https://app.netlify.com
2. Click **"Add new site"** → **"Import an existing project"**
3. **Connect to Git provider** (GitHub/GitLab/Bitbucket)
4. **Select your repository** (subkiller)

### Step 3: Configure Build Settings

Netlify should auto-detect from `netlify.toml`, but verify:

- **Base directory**: `frontendMain`
- **Build command**: `npm ci && npm run build`
- **Publish directory**: `frontendMain/dist`
- **Node version**: 20

### Step 4: Add Environment Variables

**DO NOT deploy yet.** First, set the backend URL.

1. In Netlify site settings, go to **"Site configuration"** → **"Environment variables"**
2. Click **"Add a variable"**
3. Add:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://your-backend-url.onrender.com` (from Part A, Step 4)
   - **Scopes**: All scopes (Production, Deploy previews, Branch deploys)

> **Note**: This must be set before the first build, as Vite reads env vars at build time.

### Step 5: Deploy

1. Click **"Deploy site"**
2. Wait for build to complete
3. Netlify will assign a URL like: `https://random-name-123456.netlify.app`
4. **Copy this URL** - you'll need it for backend CORS configuration

### Step 6: Update Backend CORS

1. Go back to your backend host dashboard (Render/Railway/Fly)
2. Update `CORS_ORIGINS` environment variable:
   ```
   CORS_ORIGINS=https://your-site-name.netlify.app,http://localhost:5173,http://localhost:5174
   ```
3. **Redeploy** the backend service

### Step 7: Update Google OAuth (if using custom domain)

If you set up a custom domain for Netlify:

1. Update `CORS_ORIGINS` in backend to include your custom domain
2. Update Google OAuth redirect URIs if needed

---

## Part C: Verification Checklist

### Backend Verification

1. **Health Endpoint**:

   ```bash
   curl https://your-backend-url.onrender.com/api/health
   ```

   Expected: `{"ok":true,"time":"...","uptime":...,"env":"production","db":"connected"}`

2. **CORS Check**:
   ```bash
   curl -H "Origin: https://your-site-name.netlify.app" \
        -H "Access-Control-Request-Method: POST" \
        -H "Access-Control-Request-Headers: Content-Type" \
        -X OPTIONS \
        https://your-backend-url.onrender.com/api/health
   ```
   Should return `200 OK` with CORS headers

### Frontend Verification

1. **Visit Netlify URL**: `https://your-site-name.netlify.app`
2. **Open Browser DevTools** → **Console**
3. **Check for errors**: Should see `[api] BASE_URL configured: https://your-backend-url.onrender.com`
4. **Test API connection**: Try logging in or visiting `/dashboard`
5. **Check Network tab**: API calls should go to your backend URL (not localhost)

### Full Flow Test

1. **Landing Page**: Should load without errors
2. **Newsletter Subscribe**: Should work (check backend logs for email sending)
3. **Register/Login**: Should work and set cookies
4. **Dashboard**: Should load after login
5. **Gmail Connect**: Should redirect to Google OAuth
6. **Gmail Scan**: Should initiate scan (if Gmail connected)

---

## Part D: Environment Variables Reference

### Backend Environment Variables

| Variable               | Required | Description                     | Example                                           |
| ---------------------- | -------- | ------------------------------- | ------------------------------------------------- |
| `PORT`                 | No       | Server port (host sets this)    | `10000`                                           |
| `NODE_ENV`             | Yes      | Environment                     | `production`                                      |
| `MONGO_URI`            | Yes      | MongoDB connection string       | `mongodb+srv://...`                               |
| `JWT_ACCESS_SECRET`    | Yes      | JWT access token secret         | `openssl rand -hex 32`                            |
| `JWT_REFRESH_SECRET`   | Yes      | JWT refresh token secret        | `openssl rand -hex 32`                            |
| `CORS_ORIGINS`         | Yes      | Comma-separated allowed origins | `https://app.netlify.app,http://localhost:5173`   |
| `GOOGLE_CLIENT_ID`     | Yes      | Google OAuth client ID          | `xxx.apps.googleusercontent.com`                  |
| `GOOGLE_CLIENT_SECRET` | Yes      | Google OAuth client secret      | `xxx`                                             |
| `GOOGLE_REDIRECT_URI`  | Yes      | OAuth redirect URI              | `https://backend.onrender.com/api/gmail/callback` |
| `OPENAI_API_KEY`       | Yes      | OpenAI API key                  | `sk-...`                                          |
| `RESEND_API_KEY`       | No       | Resend API key                  | `re_xxxxxxxxxxxxx`                                |
| `EMAIL_FROM`           | No       | From email address              | `no-reply@subkiller.app`                          |

### Frontend Environment Variables (Netlify)

| Variable       | Required | Description          | Example                        |
| -------------- | -------- | -------------------- | ------------------------------ |
| `VITE_API_URL` | Yes      | Backend API base URL | `https://backend.onrender.com` |

---

## Part E: Troubleshooting

### Backend Issues

**"Port already in use"**:

- Render/Railway/Fly set `PORT` automatically
- Don't hardcode port 4000 in production
- Backend uses `process.env.PORT` with fallback

**CORS errors**:

- Check `CORS_ORIGINS` includes your Netlify URL (with `https://`)
- Check backend logs for blocked origins
- Ensure frontend URL matches exactly (no trailing slash)

**Cookies not working**:

- In production, cookies use `sameSite: "none"` and `secure: true`
- Both frontend and backend must be HTTPS
- Check browser console for cookie warnings

**Database connection fails**:

- Verify `MONGO_URI` is correct
- Check MongoDB Atlas IP whitelist (allow all IPs: `0.0.0.0/0`)
- Check MongoDB user has correct permissions

### Frontend Issues

**"Backend not reachable"**:

- Check `VITE_API_URL` is set in Netlify
- Verify backend URL is correct (no trailing slash)
- Check backend `/api/health` endpoint works
- Check CORS allows your Netlify origin

**Build fails**:

- Check Node version (should be 20)
- Check `netlify.toml` base directory is `frontendMain`
- Check build logs for specific errors

**API calls fail with CORS**:

- Verify `CORS_ORIGINS` in backend includes Netlify URL
- Check backend logs for blocked origins
- Ensure both frontend and backend are HTTPS in production

### Google OAuth Issues

**"invalid_client"**:

- Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are correct
- Check `GOOGLE_REDIRECT_URI` matches exactly (including `https://`)
- Verify redirect URI is added in Google Cloud Console

**"redirect_uri_mismatch"**:

- Add both production and development redirect URIs in Google Cloud Console
- Production: `https://your-backend-url.onrender.com/api/gmail/callback`
- Development: `http://localhost:4000/api/gmail/callback`

### Email Issues

**Emails not sending**:

- Check `RESEND_API_KEY` is set (get from https://resend.com/api-keys)
- Verify `EMAIL_FROM` uses a verified domain in Resend
- In development mode, emails are automatically logged (not sent)
- Check backend logs for Resend API errors
- Ensure domain is verified in Resend dashboard if using custom domain

---

## Part F: Post-Deployment

### Monitor Logs

- **Backend**: Check host dashboard logs for errors
- **Frontend**: Check Netlify deploy logs
- **Database**: Monitor MongoDB Atlas for connection issues

### Set Up Custom Domain (Optional)

1. **Netlify**: Add custom domain in site settings
2. **Backend**: Update `CORS_ORIGINS` to include custom domain
3. **Google OAuth**: Update redirect URIs if needed

### Enable HTTPS

- **Netlify**: HTTPS is automatic
- **Backend**: Render/Railway/Fly provide HTTPS automatically
- **Cookies**: Will work cross-site with `sameSite: "none"` and `secure: true`

---

## Quick Reference

### Backend Start Command

```bash
node --experimental-specifier-resolution=node dist-server/server.js
```

### Health Check

```bash
curl https://your-backend-url.onrender.com/api/health
```

### Generate JWT Secrets

```bash
openssl rand -hex 32
```

### Test CORS

```bash
curl -H "Origin: https://your-site.netlify.app" \
     -H "Access-Control-Request-Method: POST" \
     -X OPTIONS \
     https://your-backend-url.onrender.com/api/health
```

---

## Support

If you encounter issues:

1. Check backend logs in your host dashboard
2. Check frontend build logs in Netlify
3. Verify all environment variables are set correctly
4. Test backend `/api/health` endpoint directly
5. Check browser console for frontend errors
