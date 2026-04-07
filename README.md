# Bakhus Assistant

`Bakhus Assistant` — прототип рабочего веб-сервиса для импорта прайсов поставщиков, проверки строк, сборки коммерческих предложений и дальнейшей автоматизации через `n8n`.

Сейчас проект уже умеет:

- работать как статический фронт без тяжёлой сборки;
- показывать экраны `Импорт файлов`, `Позиции`, `КП`, `Настройки`;
- создавать импорт через интерфейс;
- отправлять импорт в lightweight backend;
- держать async-сценарий `dispatch -> status -> webhook callback`;
- жить локально и в публичном demo-контуре `Firebase Hosting + Cloud Run`.

## Быстрые ссылки

- проект: [`/Users/alexanderliapustin/Desktop/VS /Bahus`](/Users/alexanderliapustin/Desktop/VS%20/Bahus)
- полный guide: [`docs/project-guide.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/project-guide.md)
- прототипный runbook backend: [`docs/prototype-backend-runbook.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/prototype-backend-runbook.md)
- deploy в Firebase/Cloud Run: [`docs/firebase-cloud-run-deploy.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/firebase-cloud-run-deploy.md)
- async-схема `n8n`: [`docs/n8n-async-flow.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/n8n-async-flow.md)
- first slice backend: [`docs/backend-first-slice.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/backend-first-slice.md)

## Текущий продуктовый контур

### 1. Импорт файлов

- верхняя таблица: список импортов;
- нижняя таблица: позиции выбранного импорта;
- фильтры и сортировки живут в шапках таблиц;
- новый импорт создаётся через модалку загрузки;
- импорт может иметь основной файл и дополнительные `attachments`;
- статус обработки обновляется через polling.

### 2. Позиции

- большая общая таблица позиций по всем импортам;
- единый рабочий реестр строк;
- база для будущего каталога и выбора строк в КП.

### 3. КП

- верхняя таблица: список коммерческих предложений;
- нижняя таблица: позиции выбранного КП;
- предпросмотр вынесен отдельно, а не висит постоянно на экране;
- сценарий ориентирован на рабочую сборку предложения, а не на “витрину”.

### 4. Настройки

- переключение светлой и тёмной темы;
- таблица пользователей;
- задел под Google авторизацию;
- базовые параметры интеграций и экспорта.

## Текущий frontend

Frontend лежит здесь:

- точка входа: [`index.html`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/index.html)
- код приложения: [`src`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src)

Главные файлы:

- layout: [`src/views/layout.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/layout.js)
- импорт: [`src/views/overview.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/overview.js)
- позиции: [`src/views/items.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/items.js)
- КП: [`src/views/quote.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/quote.js)
- настройки: [`src/views/settings.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/settings.js)
- actions: [`src/actions/app-actions.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/actions/app-actions.js)
- app bootstrap: [`src/app.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/app.js)
- tokens: [`src/styles/tokens.css`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/styles/tokens.css)

## Lightweight backend

Для прототипа основной backend сейчас такой:

- [`scripts/mock_api.py`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/scripts/mock_api.py)

Это не “фейк ради фейка”, а упрощённый backend-контур для demo. Он уже умеет:

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

Отдельно в проекте есть и заготовка более взрослого backend:

- [`scripts/postgres_api.py`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/scripts/postgres_api.py)

Но для первого прототипа основной рабочий путь сейчас именно через lightweight backend.

## Локальный запуск

Быстро поднять фронт и локальный backend:

```bash
make up-local
```

Запуск по частям:

```bash
make run-bg
make mock-api
```

Проверка:

```bash
make health
```

Локальные адреса:

- фронт: [http://127.0.0.1:4173](http://127.0.0.1:4173)
- backend: [http://127.0.0.1:8079/api/health](http://127.0.0.1:8079/api/health)

## Публичный demo-контур

Сейчас прототип уже выложен:

- frontend: [https://bahus-492521.web.app](https://bahus-492521.web.app)
- backend через rewrite: [https://bahus-492521.web.app/api/health](https://bahus-492521.web.app/api/health)
- Cloud Run backend: [https://bahus-api-qjr255udka-ew.a.run.app](https://bahus-api-qjr255udka-ew.a.run.app)

Схема deploy:

- `Firebase Hosting` для фронта;
- `Cloud Run` для lightweight backend;
- `n8n` отдельно, с callback в Bahus backend.

Подробности:

- [`docs/firebase-cloud-run-deploy.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/firebase-cloud-run-deploy.md)

## База данных

В проекте уже есть стартовый PostgreSQL-контур:

- схема: [`db/init/001_schema.sql`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/db/init/001_schema.sql)
- seed: [`db/init/002_seed.sql`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/db/init/002_seed.sql)
- следующие итерации:
  - [`db/init/003_real_data_iteration.sql`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/db/init/003_real_data_iteration.sql)
  - [`db/init/004_n8n_async_processing.sql`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/db/init/004_n8n_async_processing.sql)

Основная модель:

- imports
- files
- rows
- row issues
- quotes
- quote items
- export records
- supplier offers

Важно: один и тот же товар может приходить от разных поставщиков с разными ценами. Это в модели уже учтено.

## n8n и импорт

Текущий целевой поток:

`UI -> lightweight backend -> dispatch -> n8n -> webhook callback -> import rows/issues -> UI`

Под это уже есть:

- документация по async flow: [`docs/n8n-async-flow.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/n8n-async-flow.md)
- план живого PDF demo: [`docs/pdf-demo-plan.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/pdf-demo-plan.md)

Обновлённый workflow JSON под callback demo:

- [`/Users/alexanderliapustin/Documents/Playground/Bahus.n8n.updated.json`](/Users/alexanderliapustin/Documents/Playground/Bahus.n8n.updated.json)

## Что сейчас главное

Если смотреть не как на код, а как на проект, сейчас важны 3 вещи:

1. У нас уже есть демонстрационный продуктовый интерфейс.
2. У нас уже есть публичный deploy.
3. Следующий основной шаг — сделать один живой сценарий разбора файла через `n8n`.

## Следующий практический шаг

Самый полезный следующий шаг:

- взять один `PDF` или другой тестовый файл;
- прогнать его через `n8n`;
- вернуть callback в Bahus;
- показать заказчику end-to-end сценарий.

Если нужен полный обзор проекта, архитектуры, экранов и сценариев, открывайте:

- [`docs/project-guide.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/project-guide.md)
