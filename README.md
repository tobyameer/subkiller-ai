# SubKiller

A subscription tracking app that helps you discover and manage your recurring subscriptions by scanning your Gmail inbox.

## Local Development

### Prerequisites

- Node.js 20+
- MongoDB (local or MongoDB Atlas)
- npm or yarn

### Backend Setup

Backend code is in `dist-server/` (Node/Express):

```bash
# Install dependencies
npm install

# Start backend server
npm run dev:server
```

Backend will run on `http://localhost:4000` by default.

### Frontend Setup

Frontend code is in `frontendMain/` (Vite React):

```bash
# Install dependencies
cd frontendMain
npm install

# Start development server
npm run dev
```

Frontend will run on `http://localhost:5173` by default.

### Environment Variables

#### Backend

Copy `dist-server/.env.example` to `dist-server/.env` and fill in the values.

**Required variables:**
- `MONGO_URI` - MongoDB connection string
- `JWT_ACCESS_SECRET` - JWT access token secret (generate with `openssl rand -hex 32`)
- `JWT_REFRESH_SECRET` - JWT refresh token secret (generate with `openssl rand -hex 32`)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI (e.g., `http://localhost:4000/api/gmail/callback`)
- `OPENAI_API_KEY` - OpenAI API key
- `FRONTEND_ORIGIN` - Comma-separated allowed origins (e.g., `http://localhost:5173,http://localhost:5174`)

**Optional variables:**
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_PREMIUM` - For billing
- `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` - For bank connections
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` - For email sending

#### Frontend

Copy `frontendMain/.env.example` to `frontendMain/.env` and set:

- `VITE_API_URL` - Backend API URL (default: `http://localhost:4000`)

### Running Both Services

From the root directory:

```bash
# Run both frontend and backend
npm run dev
```

Or run them separately:
- Backend: `npm run dev:server`
- Frontend: `npm run dev:client`

## Deployment

For production deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick overview:
- **Frontend**: Deploy to Netlify (see `netlify.toml`)
- **Backend**: Deploy to Render/Railway/Fly.io
- Set environment variables as described in `DEPLOYMENT.md`

## Features

- Gmail inbox scanning for subscription receipts
- Subscription tracking and spending analysis
- AI-powered subscription detection
- Human-in-the-loop review system for accuracy
- AI Copilot for customer support and data analysis

## Project Structure

```
subkiller/
├── dist-server/          # Backend (Node/Express)
│   ├── config/          # Configuration (DB, env, OAuth, etc.)
│   ├── controllers/     # Route handlers
│   ├── middleware/      # Express middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── services/        # Business logic
│   └── server.js        # Entry point
├── frontendMain/        # Frontend (Vite React)
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── hooks/       # Custom hooks
│   │   ├── pages/       # Page components
│   │   └── lib/         # Utilities
│   └── package.json
└── package.json         # Root package.json
```

## Authentication

Auth relies on HTTP-only cookies with `credentials: "include"`. Ensure frontend and backend origins are properly configured in `FRONTEND_ORIGIN` to avoid CORS/login failures.

## License

Private
