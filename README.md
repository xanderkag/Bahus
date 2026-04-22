# Bakhus Assistant

`Bakhus Assistant` — B2B-веб-сервис для работы с прайсами поставщиков: импорт файлов, проверка строк, сборка коммерческих предложений и дальнейшая автоматизация через `n8n`.

## Текущий Статус: Prototype / Pre-Demo

Проект в стадии прототипа. Основной стек: **Vercel (frontend) + Railway (backend) + Supabase (PostgreSQL) + n8n + OpenAI**.

---

## Что реализовано (статус на 2026-04-20)

### ✅ Frontend (Vanilla JS)

- Загрузка файлов поставщиков через UI (drag-and-drop или выбор)
- **Формирование Коммерческих Предложений (КП)**: создание черновиков, добавление позиций, расчёт маржинальности, скачивание в Excel.
- **Глобальный токенизированный поиск**: высокоскоростной поиск по всем полям (с кэшированием `WeakMap`) для таблиц импорта, КП и позиций.
- Расширенная фильтрация и сортировка по: поставщику, актуальности прайса, типу документа и артикулу.
- Прогресс-бар загрузки с процентами (XHR `onprogress`)
- Генерация номера импорта `ИМП-YYYYMMDD-XXXX` в момент выбора файла
- Трёхсостоянный модал загрузки: `idle → saving → done`
- Защита от дублированных отправок (guard на `status === "saving"`)
- Polling статуса каждые 3s (`GET /api/imports/{id}/status`) до состояния `parsed`/`failed`
- Спиннер на статусе `queued`/`processing` в таблице импортов
- Таблица позиций с настраиваемыми колонками (drag-to-reorder, show/hide)
- Слияние пользовательских настроек колонок с новыми колонками при обновлении (`mergeTableColumns`)
- Очищенный, минималистичный UI (Glassmorphism) для деталей позиций, без излишнего технического мусора
- Всплывающие уведомления (Success Modals) с авто-скрытием
- Стандартный `app-dialog` для всех модалов

### ✅ Backend (Python, `scripts/postgres_api.py`)

- `POST /api/imports` — приём multipart/form-data, сохранение на диск, запись в БД
- `GET /api/imports` — список всех импортов с позициями и ошибками
- `GET /api/imports/{id}/status` — статус конкретного импорта для polling
- `POST /api/webhooks/n8n/import-result` — callback от n8n при успехе, запись строк в БД
- `POST /api/webhooks/n8n/import-failed` — callback при ошибке n8n
- `GET /api/debug/jobs` — отладочный endpoint для проверки состояния джобов
- Фоновый поток для dispatch в n8n (не блокирует ответ пользователю)
- Структурированные логи `[N8N] DISPATCH/RESPONSE/ERROR/SKIP` и `[WEBHOOK]`

### 🔄 n8n Pipeline (статус: в процессе финализации)

**Воркфлоу:** `n8n/bahus_workflow_v2.json`

**Текущий подход: OpenAI Assistants API**

В апреле 2026 мы мигрировали с простого PDF text extraction на OpenAI Assistants API. Причина: прайс-листы поставщиков часто содержат векторный текст, нестандартные шрифты, таблицы в изображениях — `pdfplumber` и прямая отправка текста в GPT давали плохие результаты.

**Как работает новый пайплайн:**
1. Webhook получает файл от Railway backend
2. `Metadata & Validation` — проверяет тип файла
3. `Inject API Key` — Set node, пробрасывает `OPENAI_API_KEY` в Code node (обход ограничений self-hosted n8n)
4. `OpenAI Assistants API` — Code node (runOnceForAllItems):
   - Загружает PDF в OpenAI Files API
   - Создаёт временного Assistant с `file_search`
   - Создаёт Thread + Message + запускает Run
   - Поллит статус до завершения (max 3 мин)
   - Извлекает структурированный JSON из ответа
   - Чистит временные ресурсы (file + assistant)
5. Format Success/Error → Callback на CRM

> ⚠️ **ОТКРЫТЫЙ БЛОКЕР:** Финальный тест с реальным PDF не завершён. Последние фиксы (b1874d1) исправляли форматирование env var и контекст итерации. Нужно провести тест завтра.

---

## Архитектура

| Слой | Технология | URL |
|---|---|---|
| Frontend | Vercel (auto-deploy from `main`) | `https://bahus.vercel.app` |
| Backend API | Railway (Python HTTP, Docker) | `https://bahus-production.up.railway.app` |
| Database | Supabase PostgreSQL | via `DATABASE_URL` |
| AI Pipeline | n8n + OpenAI Assistants API | `https://n8n.chevich.com/webhook/bakhus-pdf-import` |

---

## Ключевые файлы

| Файл | Назначение |
|---|---|
| `scripts/postgres_api.py` | Backend (все роуты, n8n dispatch, webhooks) |
| `src/actions/app-actions.js` | Вся бизнес-логика фронтенда |
| `src/views/layout.js` | Рендер модалов и UI |
| `src/views/overview.js` | Таблицы импортов и позиций |
| `src/state/initial-state.js` | Определения колонок и начальное состояние |
| `src/app.js` | Инициализация, polling, слияние настроек |
| `n8n/bahus_workflow_v2.json` | Текущий n8n workflow (Assistants API) |
| `docs/TECH_DEBT.md` | Технический долг |
| `docs/n8n-async-flow.md` | Дизайн асинхронного UX загрузки |

---

## Локальная разработка

```bash
# Запуск с базой данных
docker-compose up -d

# Frontend (без сборки, открыть index.html через dev server)
# Все API-запросы идут на window.location.origin/api
```

> ⚠️ Встроенный mock-режим отключён. Frontend требует живого backend API.

---

## Переменные окружения (Railway)

| Переменная | Назначение |
|---|---|
| `DATABASE_URL` | Supabase PostgreSQL connection string |
| `PORT` | `8080` (Railway port binding) |
| `N8N_IMPORT_WEBHOOK_URL` | URL вебхука n8n для импортов |
| `PUBLIC_API_URL` | Базовый URL Railway (для callback n8n) |

---

## Деплой

```
git push origin main
```

Vercel autobuilds frontend. Railway autobuilds backend via Dockerfile.

Подробнее: 👉 [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)
