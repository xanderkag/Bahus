# Bakhus — Agent Guide (Current Status & Context)
# Last updated: 2026-04-18

## 🎯 Current Mission

**PROTOTYPE PHASE.** The goal is to demonstrate the end-to-end import workflow to validate commercial viability.
No production-grade features (persistent storage, auth, data security) should be added until the commercial decision is confirmed.
The system is ~95% ready for demo presentation.

---

## 🛠 Architecture (Current — PaaS)

| Layer | Technology | URL |
|---|---|---|
| Frontend | Vercel (static, auto-deploy from `main`) | `https://bahus.vercel.app` |
| Backend API | Railway (Python HTTP, Docker) | `https://bahus-production.up.railway.app` |
| Database | Supabase PostgreSQL (pooler) | via `DATABASE_URL` env var |
| AI Processing | n8n Cloud (`n8n.chevich.com`) | webhook-triggered |

**Frontend core:** Modular Vanilla JS in `src/`. State from Postgres via `src/state/initial-state.js`.
**Backend:** `scripts/postgres_api.py` — monolithic HTTP handler (no framework). Handles DB, CORS, file uploads, n8n dispatch, webhooks.
**CI/CD:** Push to `main` → Vercel auto-deploys frontend. Railway auto-deploys backend via Dockerfile.

---

## 🚀 Railway Environment Variables (Required)

Set in Railway → project → service **Bahus** → Variables:

| Variable | Value | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://...supabase.com.../postgres` | Supabase connection |
| `PORT` | `8080` | Railway port binding |
| `N8N_IMPORT_WEBHOOK_URL` | `https://n8n.chevich.com/webhook/bakhus-pdf-import` | n8n webhook for imports |
| `PUBLIC_API_URL` | `https://bahus-production.up.railway.app` | Callback URL sent to n8n |

> ⚠️ **IMPORTANT:** Railway uses **ephemeral filesystem**. Uploaded files are lost on every redeploy/restart.
> For prototype this is acceptable — files are uploaded and immediately dispatched to n8n.
> For production, migrate to Supabase Storage or S3.

---

## 🤖 n8n Integration

### Import Flow
1. User uploads file via UI → frontend sends `multipart/form-data` to `POST /api/imports`
2. Backend saves file to local disk, stores metadata in DB, sets status = `queued`
3. Backend immediately calls `_trigger_n8n_import_dispatch()` in a background thread
4. Backend sends `multipart/form-data` to `N8N_IMPORT_WEBHOOK_URL` (with the file binary)
5. n8n processes, then calls `callbackSuccessUrl` = `PUBLIC_API_URL/api/webhooks/n8n/import-result`
6. Backend updates import status → `parsed`
7. Frontend polls `/api/imports/{id}/status` every 5s until status changes from `queued`/`processing`

### n8n Webhook (Bahus Import)
- **URL:** `https://n8n.chevich.com/webhook/bakhus-pdf-import`
- **Method:** POST, multipart/form-data
- **File field:** `file`
- **Key payload fields:** `import_batch_id`, `import_file_id`, `callbackSuccessUrl`, `callbackFailedUrl`, `correlation_id`
- **Workflow must be ACTIVE** (green toggle in n8n UI)

### Logging
Structured logs in Railway Deploy Logs. Search for:
- `[N8N] DISPATCH →` — file sent to n8n
- `[N8N] RESPONSE ←` — n8n acknowledged
- `[N8N] ERROR ←` — n8n returned error
- `[N8N] SKIP` — `N8N_IMPORT_WEBHOOK_URL` not configured
- `[WEBHOOK]` — n8n called back with result

---

## 📁 Key Files

| File | Purpose |
|---|---|
| `scripts/postgres_api.py` | Main backend (all routes, n8n dispatch, webhooks) |
| `src/actions/app-actions.js` | All frontend business logic and state mutations |
| `src/views/layout.js` | Modal rendering (incl. upload modal 3-state UX) |
| `src/views/overview.js` | Import/file table views + status indicators |
| `src/styles/app.css` | All styles |
| `src/app.js` | App init, polling loop |
| `docs/TECH_DEBT.md` | Known issues and future improvements |
| `docs/n8n-async-flow.md` | Async upload UX design doc |

---

## 🧹 Technical Rules

- **Version string:** Always visible in frontend header (`src/views/layout.js`). Must include git hash + build date. CI populates via `src/version.js`.
- **Commit format:** `vX.Y.Z (YYYY-MM-DD HH:MM MSK) — description`
- **n8n workflows:** Store ONLY in `n8n/` directory. Never on Desktop or root.
- **No mock data:** All `cl_...` and demo seeds are permanently deleted.
- **No framework bloat:** Keep frontend as Vanilla JS. No React, no bundler complexity.
