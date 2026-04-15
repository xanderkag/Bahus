# Bakhus Assistant - Agent Guide (Current Status & Context)

## 🎯 Current Mission
We are in the **Prototype & Demo** stage. The primary goal is a successful and impressive client presentation in **1-2 days**.

## 🛠 Project Architecture
- **Stage**: Active Prototyping.
- **Frontend**: Modular Vanilla JS/HTML in `src/`. No heavy build step. Hosted on Firebase.
- **Backend (Mock)**: `scripts/mock_api.py` (Lightweight Python, in-memory demo data). This is the **primary** backend for the upcoming demo.
- **Backend (Postgres)**: `scripts/postgres_api.py` is ready but is a secondary "next step" after the initial demo.
- **Automation**: n8n-driven async flow for file parsing and quote normalization.

## 🚀 Key Priorities (1-2 Days)
1.  **Stable n8n Flow**: Ensure `Upload -> n8n Processing -> Webhook Callback -> UI Update` works flawlessly.
2.  **Demo "WOW" Factor**: UI should be polished, fast, and clearly demonstrate the value (AI-powered parsing).
3.  **Minimal Backend Effort**: Do NOT spend heavy resources on the Postgres transition until the demo is successful.

## 🧹 Technical Debt & Maintenance
- **Removed (Cleaned up)**: `src/views/files.js`, root HTML mocks.
- **Known Issues**:
    - Auth is currently client-side only (localStorage/demo-data).
    - Files are stored locally in `.local/uploads` (no cloud bucket yet).
- **Maintenance**: Keep `src/data/demo-data.js` and `scripts/mock_api.py` in sync with any UI changes.

## 📚 Reference Docs
- [Project Guide](file:///Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/project-guide.md)
- [n8n Async Flow](file:///Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/n8n-async-flow.md)
- [README.md](file:///Users/alexanderliapustin/Desktop/VS%20/Bahus/README.md)
