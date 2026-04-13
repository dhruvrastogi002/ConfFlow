# ConfFlow
# ConfFlow

ConfFlow is a full-stack conference management website with:
- Frontend single-page app (`Frontend/`)
- Express + MongoDB backend API (`Backend/`)
- Firebase authentication integration

## Project structure

- `Backend/server.js` - backend entrypoint
- `Backend/src/` - API routes, models, middleware, config
- `Frontend/index.html` - SPA shell
- `Frontend/app.js` - frontend app logic
- `Frontend/firebase.js` - Firebase services

## 1) Backend setup

Create backend env file:

1. Copy `Backend/.env.example` to `Backend/.env`
2. Fill real values:
   - `PORT`
   - `FRONTEND_ORIGIN`
   - `MONGO_URI`
   - `FIREBASE_SERVICE_KEY`
   - `RESEND_API_KEY` (for outbound emails)
   - `EMAIL_FROM` (verified sender in Resend)
   - `EMAIL_FALLBACK_TO` (used when recipient id is not an email)

Install and run:

```bash
npm install
npm run dev
```

Backend health check:

`http://localhost:5000/api/health`

## 2) Frontend setup

Install and run frontend:

```bash
cd Frontend
npm install
npm run dev
```

Default frontend URL:

`http://localhost:3000`

## 3) Frontend API base URL

Frontend reads API base from:

- `Frontend/config.js` via `window.__API_BASE__`

Default value:

`http://localhost:5000/api`

Update it for production deployment.

## 4) Deploy to Render

This repository includes `render.yaml` with:
- `confflow-backend` (Node web service)
- `confflow-frontend` (static site from `Frontend/`)

### Render deployment steps

1. Push repository to GitHub.
2. In Render, create from Blueprint and select this repo.
3. Set backend secret env vars in Render:
   - `MONGO_URI`
   - `FIREBASE_SERVICE_KEY`
   - `RESEND_API_KEY` (optional)
   - `EMAIL_FROM` (optional)
   - `EMAIL_FALLBACK_TO` (optional)
4. After frontend URL is created, ensure backend `FRONTEND_ORIGIN` matches that exact URL.
5. Redeploy backend if `FRONTEND_ORIGIN` changes.

### Production readiness checks

- Backend health: `/api/health` returns `{ ok: true }`
- Firebase Admin key is valid JSON in env (single-line escaped format)
- MongoDB Atlas allows Render IP/network access
- Firebase Auth providers enabled and authorized domain includes frontend Render URL
- Firestore/Storage rules deployed from `firestore.rules` and `storage.rules`

## Notes

- `Backend/.env` is ignored by git.
- `Frontend/vercel.json` is used for SPA deployment routing.
- Firebase config for frontend is loaded from `Frontend/firebase-config.js`.
- On first run, if conferences are empty, frontend triggers backend seeding via `POST /api/conferences/seed`.
- Users can create conferences from dashboard tab `Create Conference` after sign-in.
- If Firebase is not configured, the app runs in demo auth mode and uses `x-demo-user` header for protected API routes in local development.
- Phase 1 reviewer workflow:
  - Chair assigns reviewers via `POST /api/reviews/assign`
  - Reviewer sees assigned reviews via `GET /api/reviews/assigned/me`
  - Reviewer submits scores/comments via `POST /api/reviews/:id/submit`
- Phase 2 decision workflow:
  - Chair loads decision context via `GET /api/papers/:id/decision-context`
  - Context includes submitted reviews and average scores
  - Chair submits final decision via `POST /api/papers/:id/decision` with status `accepted` or `rejected`
- Phase 3 operational workflow:
  - Author submits camera-ready for accepted papers via `POST /api/papers/:id/camera-ready`
  - Users fetch notifications via `GET /api/notifications/me` and mark read via `PATCH /api/notifications/:id/read`
  - Chair analytics for a conference via `GET /api/conferences/:id/analytics`
- Phase 4 communication + audit workflow:
  - Notification template preview endpoint: `GET /api/notifications/template-preview/:type`
  - Paper timeline / audit trail endpoint: `GET /api/papers/:id/timeline`
  - Timeline events are persisted for submission, review assignment/submission, decision, and camera-ready.
- Outbound email delivery:
  - Notification events dispatch email via Resend when `RESEND_API_KEY` and `EMAIL_FROM` are configured.
  - If recipient id is not an email, backend uses `EMAIL_FALLBACK_TO` if provided.
