# Bakhus Assistant - Agent Guide (Current Status & Context)

## 🎯 Current Mission
We are in the **Production Maintenance** stage. The project has transitioned from a demo prototype on Cloud Run to a fully operational monolithic deployment on a Yandex Cloud VM. The next goals revolve around feature iteration and scaling the n8n workflows.

## 🛠 Project Architecture
- **Stage**: Production. The `demo-data.js` and local fallback modes have been utterly eradicated.
- **Frontend**: Modular Vanilla JS/HTML in `src/`. Initial state is now strictly synthesized inside `src/state/initial-state.js` dynamically from Postgres via the `bootstrap` payload (`clients`, `imports` etc). Dynamically maps API calls to `window.location.origin/api`. Served by Nginx container.
- **Backend (Primary)**: `scripts/postgres_api.py`. Handles dynamic `handle_bootstrap` providing DB datasets to frontend, CORS proxy, cleanup workers, database retry logic, robust multipart `requests` forwarding to n8n, and handles UUID constraint tracking elegantly via SQL subqueries.
- **Database**: PostgreSQL database mounted via persistent Docker volume. Native UUID handling is actively enforced.
- **CI/CD**: GitHub Actions auto-deploys any `main` branch pushes directly to the Yandex Cloud server.

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

## 🤖 n8n Workflow State
The most up-to-date and active workflow reference is continuously stored in `n8n/bahus_production_workflow_v2.json`. 
**CRITICAL RULE:** All n8n workflows MUST be stored EXCLUSIVELY inside the `n8n` directory within the repository. NEVER create loose workflow files on the Desktop or root directory. Keep the project clean.
