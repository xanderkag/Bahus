# Bakhus Assistant - Agent Guide (Current Status & Context)

## 🎯 Current Mission
We are in the **Production Maintenance** stage. The project has transitioned from a demo prototype on Cloud Run to a fully operational monolithic deployment on a Yandex Cloud VM. The next goals revolve around feature iteration and scaling the n8n workflows.

## 🛠 Project Architecture
- **Stage**: Pre-Prod (Operational Validation). The mock fallback models have been utterly eradicated, and the app operates successfully end-to-end on real database sources.
- **Frontend Core**: Modular Vanilla JS in `src/`. Initial state synthesis is natively loaded inside `src/state/initial-state.js` dynamically from Postgres.
- **Frontend UX Mechanics**: Typing mechanisms are fully battle-tested (utilizes `debounce` wrappers for searches, `data-change` bindings for non-blocking numeric edits, and multi-attribute CSS selector extraction for flawless cursor restoration across virtual DOM redraws).
- **Backend (Primary)**: `scripts/postgres_api.py`. Provides DB datasets, CORS proxy, UI workflow bindings, and seamless data hydration for the client.
- **Database**: PostgreSQL hosted natively. UUID data compliance strictly enforced.
- **CI/CD**: GitHub Actions auto-deploys `main` branch directly to Yandex Server (`111.88.144.93`).

## 🚀 Key Deploy Information
- **Yandex VM**: `111.88.144.93`
- **Compose Stack**: `docker-compose.prod.yml`
- **Documentation**: 
  - Overview: `README.md`
  - Infrastructure & Deployment: `docs/INFRASTRUCTURE.md`
  - Manual Server Operations: `docs/YANDEX_DEPLOY.md`

## 🧹 Technical Debt & Maintenance
- **Legacy Files**: `scripts/mock_api.py`, `price_import_review_ui_html_mock.html`, `bakhus_assistant_kp_update.html`, and `src/views/files.js` are considered deprecated legacy files.
- **Mock Cleanup Status**: Fully Complete. All static artifacts, such as `src/data/demo-data.js`, have been deleted. Do not attempt to refer to `cl_...` or demo fake seeds in subsequent code structures.
- **Auth**: Still client-side oriented. A full SSR/server-based auth flow could be considered next.
- **Version Visibility Rule**: A permanent version string must ALWAYS be visible at the top of the frontend Interface (`src/views/layout.js`). The text must include the latest Git commit hash and build date. This avoids ambiguous state during caching or deployment. GitHub Actions must populate this via dynamically creating a temporary `src/version.js` on every Git Push!
- **Commit Versioning Rule**: All git commit/push messages must contain a version tag (starting from `v1.0.0`) and the current date and time in Moscow time (UTC+3). Example format: `v1.0.0 (2026-04-17 12:00:00 MSK) - feature description`. This keeps deployment traces rigorously versioned.

## 🤖 n8n Workflow State
The most up-to-date and active workflow reference is continuously stored in `n8n/bahus_production_workflow_v2.json`. 
**CRITICAL RULE:** All n8n workflows MUST be stored EXCLUSIVELY inside the `n8n` directory within the repository. NEVER create loose workflow files on the Desktop or root directory. Keep the project clean.
