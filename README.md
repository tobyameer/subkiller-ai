# SubKiller – dev setup

Backend (Node/Express, compiled JS in `dist-server/`)

```
npm run dev:server
```

Frontend (Vite React in `frontend/`)

```
cd frontend
npm install
npm run dev
```

Key environment variables (examples in `.env` + `frontend/.env`):

- `MONGO_URI`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- `OPENAI_API_KEY`
- `FRONTEND_ORIGIN` — comma-separated allowlist for CORS (e.g. `http://localhost:5173,http://127.0.0.1:5173`)
- `VITE_API_URL` (frontend) — default `http://localhost:8080`
- Plaid/Stripe keys are optional; Plaid routes respond with 501 if not configured.

Auth/flows rely on cookies (`credentials: "include"`). Ensure frontend and backend origins match the allowlist to avoid CORS/login failures.
