# Bakhus Assistant - Agent Guide (Current Status & Context)

## 🎯 Current Mission
We are in the **Production Maintenance** stage. The project has transitioned from a demo prototype on Cloud Run to a fully operational monolithic deployment on a Yandex Cloud VM. The next goals revolve around feature iteration and scaling the n8n workflows.

## 🛠 Project Architecture
- **Stage**: Production.
- **Frontend**: Modular Vanilla JS/HTML in `src/`. Dynamically maps API calls to `window.location.origin/api`. Served by Nginx container.
- **Backend (Primary)**: `scripts/postgres_api.py`. Includes a CORS proxy, cleanup workers, database retry logic, and handles robust multipart `requests` forwarding to n8n.
- **Database**: PostgreSQL database mounted via persistent Docker volume.
- **CI/CD**: GitHub Actions auto-deploys any `main` branch pushes directly to the Yandex Cloud server.

## 🚀 Key Deploy Information
- **Yandex VM**: `111.88.144.93`
- **Compose Stack**: `docker-compose.prod.yml`
- **Documentation**: 
  - Overview: `README.md`
  - Infrastructure & Deployment: `docs/INFRASTRUCTURE.md`
  - Manual Server Operations: `docs/YANDEX_DEPLOY.md`

## 🧹 Technical Debt & Maintenance
- **Legacy Files**: `scripts/mock_api.py`, `price_import_review_ui_html_mock.html`, `bakhus_assistant_kp_update.html`, and `src/views/files.js` are considered deprecated legacy files. DO NOT USE them as references for current implementation.
- **Auth**: Still client-side oriented. A full SSR/server-based auth flow could be considered next.

## 🤖 n8n Workflow State
The most up-to-date and active workflow reference is continuously stored in `n8n/bahus_production_workflow_v2.json`. 
**CRITICAL RULE:** All n8n workflows MUST be stored EXCLUSIVELY inside the `n8n` directory within the repository. NEVER create loose workflow files on the Desktop or root directory. Keep the project clean.
