# Bakhus — Agent Guide (Current Status & Context)
# Last updated: 2026-04-20

## 🎯 Current Mission

**PROTOTYPE PHASE.** The goal is to demonstrate the end-to-end import workflow to validate commercial viability.
No production-grade features (persistent storage, auth, data security) should be added until the commercial decision is confirmed.

---

## 📅 Session Log: 2026-04-19 (Full Day)

> **Итого за день: 21 коммит.** Две параллельных линии работы: UI-рефакторинг и миграция n8n-пайплайна на OpenAI Assistants API.

### 🧩 Линия 1: UI / Frontend

| Время | Коммит | Что сделано |
|---|---|---|
| 12:37 | `d1c38a9` | Fix: гонка состояний `product_ids` в `loadImportsResource`; обновлён `productOrder` при refresh; n8n workflow v7 |
| 12:54 | `a767bd5` | Fix: вся строка импорта кликабельна, не только имя файла |
| 18:33 | `4120e90` | Feat: глобальный поиск по таблице позиций и overview |
| 18:45 | `88ae6a5` | Feat: упрощён UI проверки; добавлена колонка «Артикул производителя» |
| 19:03 | `4914483` | Feat: колонки «Поставщик» и «Актуальность» в обеих таблицах |
| 19:22 | `3b8c5e9` | Feat: динамическая настройка и переупорядочивание колонок через модал |
| 19:33 | `a63e546` | Fix: критическая ошибка разрешения модулей (import path) |
| 19:56 | `1173a8e` | Refactor: удалён мёртвый код после выноса определений колонок |
| 20:03 | `d66319f` | Fix: SyntaxError — экранирование вложенных template literal в колонке issues |
| 21:42 | `f85e2cb` | Fix: шестерёнка настроек перенесена в тулбар таблицы; модал приведён к стандарту `app-dialog` |
| 21:56 | `614d618` | Feat: модал подтверждения «отмечено проверено»; слияние настроек колонок; экран позиций по умолчанию показывает только одобренные |
| 22:53 | `6172d7d` | Fix: защита состояния модала загрузки от фоновых поллеров (дублированная отправка невозможна) |

### 🤖 Линия 2: n8n / OpenAI Assistants API

| Время | Коммит | Что сделано |
|---|---|---|
| 11:57 | `c66545b` | Feat: добавлен `/api/debug/jobs` endpoint для отладки состояния джобов |
| 11:58 | `3dd3229` | Fix: исправлен запрос в debug endpoint |
| 17:19 | `627cb1b` | Feat: апгрейд модели с `gpt-4o-mini` до `gpt-4o` для точного парсинга PDF |
| 20:10 | `35cc963` | Fix: надёжное определение PDF по расширению файла (fallback) в ноде валидации |
| 22:23 | `ecca7ec` | Fix: обработка ошибок PDF-извлечения, усечённых ответов; forward ошибки в CRM-вебхук |
| 23:02 | `dd922cb` | **Feat: МИГРИРОВАЛИ PDF-пайплайн с Extract PDF + gpt-4o на OpenAI Assistants API** |
| 23:24 | `512477f` | Fix: исправлен паттерн обращения к env vars в Code node |
| 23:32 | `aff4034` | Fix: добавлена нода `Inject API Key` для обхода ограничений self-hosted n8n на `$env` |
| 23:39 | `b1874d1` | Fix: форматирование строки env var и контекст итерации в Assistants API Code node |

---

## 🔴 ОТКРЫТЫЙ БЛОКЕР: n8n Assistants API (на завтра)

**Задача на следующую сессию — допинать интеграцию с OpenAI Assistants API.**

### Что есть сейчас

Воркфлоу `n8n/bahus_workflow_v2.json` содержит:
- `Inject API Key` (Set node) → читает `OPENAI_API_KEY` из env и прокидывает в следующую ноду
- `OpenAI Assistants API` (Code node, runOnceForAllItems) → загружает PDF в OpenAI Files API, создаёт временного Assistant, ждёт завершения через polling, извлекает JSON, чистит временные ресурсы

### Известные проблемы / что нужно проверить завтра

1. **`Unknown error`** — Code node падал с `Unknown error` (n8n task runner не пробрасывает детали ошибки наружу). Последние фиксы (b1874d1) должны были это исправить, но финальный тест с реальным PDF ещё не был проведён.
2. **Контекст `$input.first().binary`** — При `runOnceForAllItems` бинарные данные доступны через `$input.first().binary`, а не через стандартный `$input.item`. Это зафиксировано в последней версии кода.
3. **Паттерн `Inject API Key`** — Единственный надёжный способ передать `OPENAI_API_KEY` в Code node на self-hosted n8n. Нода должна быть подключена **непосредственно перед** Code node.

### Следующие шаги для n8n

- [ ] Загрузить обновлённый `bahus_workflow_v2.json` в n8n UI (Import workflow)
- [ ] Убедиться, что переменная `OPENAI_API_KEY` выставлена в env n8n
- [ ] Сделать тестовый прогон с реальным «тяжёлым» PDF (векторный прайс-лист)
- [ ] Проверить, что callback с `callbackSuccessUrl` получает структурированный JSON
- [ ] Если ошибка — открыть Railway logs n8n, найти детали через `[N8N]` теги

---

## 🛠 Architecture (Current — PaaS)

| Layer | Technology | URL |
|---|---|---|
| Frontend | Vercel (static, auto-deploy from `main`) | `https://bahus.vercel.app` |
| Backend API | Railway (Python HTTP, Docker) | `https://bahus-production.up.railway.app` |
| Database | Supabase PostgreSQL (pooler) | via `DATABASE_URL` env var |
| AI Processing | n8n Cloud (`n8n.chevich.com`) + OpenAI Assistants API | webhook-triggered |

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
5. n8n processes via **OpenAI Assistants API** (uploads PDF to Files API, creates temp assistant, polls run to completion)
6. n8n calls `callbackSuccessUrl` = `PUBLIC_API_URL/api/webhooks/n8n/import-result`
7. Backend updates import status → `parsed`
8. Frontend polls `/api/imports/{id}/status` every 5s until status changes from `queued`/`processing`

### n8n Workflow: OpenAI Assistants API (v2, current)

**File:** `n8n/bahus_workflow_v2.json`

**Ключевые ноды:**
- `Webhook` — принимает multipart/form-data от Railway backend
- `Metadata & Validation` — определяет тип файла, выдаёт ошибку если не PDF/Excel
- `Inject API Key` — Set node, читает `OPENAI_API_KEY` из `$env`, прокидывает дальше (обход security-ограничений Code node)
- `OpenAI Assistants API` — Code node (runOnceForAllItems):
  - Загружает PDF в Files API (`/v1/files`)
  - Создаёт временного Assistant с инструментом `file_search`
  - Создаёт Thread + Message + Run
  - Поллит статус Run (max 60 попыток × 3s = 3 мин)
  - Извлекает текст из ответа
  - Удаляет временные ресурсы (file + assistant)
- `Format Success` / `Format Error` — форматируют ответ для callback
- `Callback` — отправляет результат на `callbackSuccessUrl` или `callbackFailedUrl`

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
| `src/state/initial-state.js` | Column definitions (`defaultOverviewTableColumns`, `defaultItemsTableColumns`) |
| `src/styles/app.css` | All styles |
| `src/app.js` | App init, polling loop, column settings persistence |
| `n8n/bahus_workflow_v2.json` | Current active n8n workflow (Assistants API) |
| `docs/TECH_DEBT.md` | Known issues and future improvements |
| `docs/n8n-async-flow.md` | Async upload UX design doc |

---

## 🧹 Technical Rules

- **Version string:** Always visible in frontend header (`src/views/layout.js`). Must include git hash + build date. CI populates via `src/version.js`.
- **Commit format:** `type(scope): description` (conventional commits)
- **n8n workflows:** Store ONLY in `n8n/` directory. Never on Desktop or root. Current: `bahus_workflow_v2.json`.
- **No mock data:** All `cl_...` and demo seeds are permanently deleted.
- **No framework bloat:** Keep frontend as Vanilla JS. No React, no bundler complexity.
- **Column definitions:** Defined in `src/state/initial-state.js`. Persisted to `localStorage` key `bahus_settings`. Merged on startup via `mergeTableColumns()` in `app.js` to preserve user order while adding new columns.
- **Upload modal state machine:** States are `idle → saving → done`. Background pollers (`loadImportsResource`) must NOT reset `saving`/`done` status. Guard pattern lives in `loadImportsResource()`.
- **Debugging временных alert():** В `src/utils/dom.js` и `src/actions/app-actions.js` могут быть отладочные `alert()`. Убрать перед финальным деплоем.
