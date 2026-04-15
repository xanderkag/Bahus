# Bakhus Assistant

`Bakhus Assistant` — прототип B2B-веб-сервиса для работы с прайсами поставщиков: импорт файлов, проверка строк, сборка коммерческих предложений и дальнейшая автоматизация через `n8n`.

Сейчас это уже не просто UI-макет. У проекта есть:

- рабочий фронт;
- лёгкий backend для демо;
- публичный deploy;
- заготовка под PostgreSQL backend;
- стартовый async-контур `dispatch -> n8n -> webhook callback`.

## Статус проекта

### Что реально есть сейчас

- экран `Импорт файлов` с таблицей импортов и таблицей строк выбранного импорта;
- экран `Позиции` как общий реестр строк по всем импортам;
- экран `КП` со списком предложений и таблицей позиций выбранного КП;
- экран `Настройки` с таблицей пользователей и переключением темы;
- модалка деталей строки с режимом `Редактировать`;
- создание нового импорта через UI;
- создание КП через UI;
- экспорт как продуктовая заглушка;
- light/dark theme;
- Google login-only auth gate без саморегистрации;
- allowlist пользователей в настройках и demo-state;
- публичный стенд на `Firebase Hosting + Cloud Run`.

### Что сейчас основное

Основной рабочий путь для прототипа:

`UI -> lightweight backend -> dispatch -> n8n -> webhook callback -> строки/ошибки -> UI`

Это важнее, чем пока ещё не доведённый production backend на Postgres.

## Быстрые ссылки

- проект: [`/Users/alexanderliapustin/Desktop/VS /Bahus`](/Users/alexanderliapustin/Desktop/VS%20/Bahus)
- полный обзор: [`docs/project-guide.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/project-guide.md)
- runbook прототипного backend: [`docs/prototype-backend-runbook.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/prototype-backend-runbook.md)
- deploy в `Firebase Hosting + Cloud Run`: [`docs/firebase-cloud-run-deploy.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/firebase-cloud-run-deploy.md)
- async-схема `n8n`: [`docs/n8n-async-flow.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/n8n-async-flow.md)
- first slice backend: [`docs/backend-first-slice.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/backend-first-slice.md)
- план живого PDF-demo: [`docs/pdf-demo-plan.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/pdf-demo-plan.md)

## Ревизия по слоям

### 1. Frontend

Frontend лёгкий, без тяжёлой сборки.

- входная точка: [`index.html`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/index.html)
- bootstrap приложения: [`src/app.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/app.js)
- layout: [`src/views/layout.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/layout.js)
- импорт: [`src/views/overview.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/overview.js)
- позиции: [`src/views/items.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/items.js)
- КП: [`src/views/quote.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/quote.js)
- настройки: [`src/views/settings.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/settings.js)
- действия: [`src/actions/app-actions.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/actions/app-actions.js)
- API bootstrap: [`src/services/api.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/services/api.js)
- backend client: [`src/services/backend.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/services/backend.js)
- auth service: [`src/services/firebase-auth.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/services/firebase-auth.js)
- demo-state: [`src/data/demo-data.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/data/demo-data.js)

Что важно по UX:

- интерфейс уже собран вокруг таблиц, а не карточек;
- фильтры и сортировки живут в шапках таблиц;
- детали строки открываются отдельным слоем;
- `Позиции КП` сознательно не перегружены тяжёлой фильтрацией;
- настройки сейчас намеренно минимальные: пользователи и тема.

### 2. Auth

Сейчас в проекте есть именно `login-only` сценарий:

- вход только через Google;
- саморегистрации нет;
- доступ получают только пользователи из allowlist;
- список разрешённых пользователей живёт в `settings.users`.

Текущие важные файлы:

- [`src/services/firebase-auth.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/services/firebase-auth.js)
- [`src/views/layout.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/layout.js)
- [`src/data/demo-data.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/data/demo-data.js)

Что уже сделано:

- Firebase Web App создан;
- Google provider для Firebase Auth включён;
- во фронт добавлен полный web config, включая `appId`;
- allowlist уже включает `liapustin@gmail.com` и `ai.crm.corp@gmail.com`.

Что ещё надо помнить:

- если OAuth consent screen ограничен `test users`, нужные Gmail должны быть добавлены туда;
- текущий user management пока клиентский, это ещё не production IAM.

### 3. Lightweight backend

Основной backend для прототипа сейчас:

- [`scripts/mock_api.py`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/scripts/mock_api.py)

Это не декоративный mock, а упрощённый рабочий backend. Он уже умеет:

- `GET /api/bootstrap`
- `GET /api/imports`
- `POST /api/imports`
- `POST /api/imports/:id/dispatch`
- `GET /api/imports/:id/status`
- `GET /api/products`
- `GET /api/catalog`
- `GET /api/jobs`
- `GET /api/quote-draft`
- `POST /api/quote-draft`
- `POST /api/review/rows`
- `POST /api/review/normalize`
- `POST /api/review/match`
- `POST /api/webhooks/n8n/import-result`
- `POST /api/webhooks/n8n/import-failed`

Он сейчас и является главным backend-контуром для demo.

### 4. PostgreSQL backend

Следующий слой уже подготовлен, но не является основным для показа:

- [`scripts/postgres_api.py`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/scripts/postgres_api.py)
- [`requirements-backend.txt`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/requirements-backend.txt)
- [`docker/postgres-api.Dockerfile`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docker/postgres-api.Dockerfile)

Это задел под переход от in-memory/demo storage к реальному хранению.

### 5. База данных

В проекте уже есть PostgreSQL-каркас:

- схема: [`db/init/001_schema.sql`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/db/init/001_schema.sql)
- seed: [`db/init/002_seed.sql`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/db/init/002_seed.sql)
- следующая итерация по реальным данным: [`db/init/003_real_data_iteration.sql`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/db/init/003_real_data_iteration.sql)
- async-поля под `n8n`: [`db/init/004_n8n_async_processing.sql`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/db/init/004_n8n_async_processing.sql)

Главные сущности:

- `supplier`
- `client_account`
- `import_batch`
- `import_file`
- `import_row`
- `import_row_issue`
- `catalog_product`
- `row_product_match`
- `quote_document`
- `quote_item`
- `quote_export`
- `job_run`

Ключевая продуктовая особенность уже учтена в модели:

- один и тот же товар может приходить от разных поставщиков с разными ценами;
- “одной истинной цены” у товара нет;
- это важно и для сравнения, и для сборки КП.

### 6. n8n

Что уже зафиксировано:

- async-flow описан в [`docs/n8n-async-flow.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/n8n-async-flow.md)
- прототипный сценарий описан в [`docs/prototype-backend-runbook.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/prototype-backend-runbook.md)
- живой PDF-сценарий расписан в [`docs/pdf-demo-plan.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/pdf-demo-plan.md)

На сегодня логика такая:

1. пользователь загружает файл;
2. backend создаёт импорт;
3. backend dispatch’ит его в `n8n`;
4. `n8n` делает парсинг;
5. `n8n` возвращает `success` или `failed` webhook;
6. backend обновляет импорт, строки и ошибки;
7. UI показывает результат.

Обновлённый workflow-файл для callback demo лежит вне проекта:

- [`/Users/alexanderliapustin/Documents/Playground/Bahus.n8n.updated.json`](/Users/alexanderliapustin/Documents/Playground/Bahus.n8n.updated.json)

## Что задеплоено

Публичный demo-контур уже работает:

- frontend: [https://bahus-492521.web.app](https://bahus-492521.web.app)
- backend через rewrite: [https://bahus-492521.web.app/api/health](https://bahus-492521.web.app/api/health)
- direct Cloud Run backend: [https://bahus-api-qjr255udka-ew.a.run.app](https://bahus-api-qjr255udka-ew.a.run.app)

Схема deploy:

- `Firebase Hosting` для фронта;
- `Cloud Run` для lightweight backend;
- `n8n` отдельно.

Подробности:

- [`docs/firebase-cloud-run-deploy.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/firebase-cloud-run-deploy.md)

## Локальный запуск

Основные команды:

```bash
make up-local
```

По частям:

```bash
make run-bg
make mock-api
```

Проверка:

```bash
make health
```

Адреса:

- фронт: [http://127.0.0.1:4173](http://127.0.0.1:4173)
- backend: [http://127.0.0.1:8079/api/health](http://127.0.0.1:8079/api/health)

## Что сейчас временное или упрощённое

Это важно, чтобы не путать прототип с production:

- пользователи и права пока живут во frontend state;
- Google auth есть как login gate, но не как полноценная серверная auth-модель;
- `postgres_api.py` ещё не стал основным backend;
- часть сценариев всё ещё опирается на demo-data;
- экспорт пока продуктовая заглушка;
- логотип и бренд-образ пока не финализированы;
- `n8n`-контур ещё не доведён до живого стабильного end-to-end demo.

## Legacy и техдолг

Во время ревизии видно, что в дереве остались файлы, которые уже не являются основным маршрутом:

- [`src/views/files.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/files.js) — legacy-экран, текущий основной import-flow живёт в [`src/views/overview.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/overview.js)
- HTML-моки в корне:
  - [`price_import_review_ui_html_mock.html`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/price_import_review_ui_html_mock.html)
  - [`bakhus_assistant_kp_update.html`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/bakhus_assistant_kp_update.html)

Их не обязательно удалять срочно, но важно понимать, что это не ядро текущего приложения.

## Что уже хорошо

На сегодня у проекта сильные стороны такие:

- есть живой продуктовый каркас;
- есть публичный deploy;
- есть единый UI-язык и рабочие таблицы;
- есть понятный import-flow;
- есть реальная точка интеграции с `n8n`;
- есть задел под переход к Postgres.

## Что делать дальше

Самый полезный следующий шаг:

1. довести один живой сценарий `файл -> n8n -> callback -> строки в UI`;
2. после этого решить, когда переводить lightweight backend на Postgres как основной слой;
3. потом уже добивать production auth, file storage и реальные exports.

Если нужен более подробный контекст по продукту и архитектуре, открывайте:

- [`docs/project-guide.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/project-guide.md)
