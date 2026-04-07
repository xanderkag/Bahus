# Bakhus Assistant Project Guide

## Что это за проект

`Bakhus Assistant` — прототип B2B-сервиса для работы с прайсами поставщиков и сборки коммерческих предложений.

Если совсем по-человечески, продукт решает три задачи:

1. принять и разобрать входящий файл поставщика;
2. показать менеджеру позиции и проблемы разбора;
3. собрать на основе выбранных строк коммерческое предложение.

Сейчас проект уже находится не на стадии “экраны ради экранов”, а на стадии связанного прототипа с живым deploy-контуром и lightweight backend.

## Как сейчас устроен продукт

### Импорт файлов

Экран импорта — это основной intake workspace.

Что в нём есть:

- таблица импортов;
- таблица позиций выбранного импорта;
- фильтры, сортировка и массовые действия;
- создание нового импорта через модалку;
- async-статусы обработки;
- детали строки в отдельном полноэкранном слое.

Здесь же менеджер видит:

- какой файл загружен;
- что получилось распарсить;
- какие строки требуют проверки;
- что уже можно отправлять дальше в КП.

### Позиции

Экран `Позиции` — это общий реестр строк по всем импортам.

Он нужен не как дубль импорта, а как отдельный рабочий слой:

- для поиска по всем входящим данным;
- для сравнения поставщиков;
- для будущего каталога;
- для подбора строк в КП вне контекста одного файла.

### КП

Экран `КП` — это рабочая область менеджера по коммерческому предложению.

Сценарий:

- сверху таблица коммерческих предложений;
- ниже таблица позиций выбранного предложения;
- отдельные действия по наполнению, цене, альтернативам и экспорту;
- предпросмотр вынесен отдельно, а не висит всегда на странице.

### Настройки

Экран `Настройки` сейчас используется как продуктовая опора под:

- переключение темы интерфейса;
- таблицу пользователей;
- интеграционный endpoint;
- будущую Google авторизацию.

## Что уже приведено к единому виду

За последние итерации интерфейс был сильно упрощён и приведён к более взрослому ритму:

- навигация переведена на единый язык;
- убраны лишние технические элементы;
- `Files` как отдельная вкладка убрана;
- `voice assist` полностью убран;
- экран импорта собран вокруг таблиц, а не карточек;
- экран КП собран вокруг списка КП и списка позиций;
- детали строки живут в модалке, а не в случайном блоке на странице;
- добавлена тёмная и светлая тема.

## Архитектура проекта

### Frontend

Frontend очень лёгкий:

- вход: [`index.html`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/index.html)
- логика: [`src`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src)

Структура:

- `views/` — экраны и layout
- `actions/` — пользовательские действия и orchestration
- `state/` — store и selectors
- `services/` — API/backend/config
- `data/` — demo-state
- `styles/` — tokens, base, app styles

Ключевые файлы:

- [`src/views/layout.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/layout.js)
- [`src/views/overview.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/overview.js)
- [`src/views/items.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/items.js)
- [`src/views/quote.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/quote.js)
- [`src/views/settings.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/settings.js)
- [`src/actions/app-actions.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/actions/app-actions.js)
- [`src/app.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/app.js)

### Lightweight backend

Основной прототипный backend:

- [`scripts/mock_api.py`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/scripts/mock_api.py)

Он сейчас закрывает важные demo-сценарии:

- bootstrap состояния;
- список импортов;
- создание импорта;
- dispatch на обработку;
- статус обработки;
- список позиций;
- каталог;
- quote draft;
- review actions;
- webhook callback от `n8n`.

Это и есть текущий рабочий backend для прототипа.

### PostgreSQL backend

Отдельно подготовлен и следующий слой:

- [`scripts/postgres_api.py`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/scripts/postgres_api.py)

Он нужен уже не для “первого показа”, а для перехода к реальным данным в постоянном хранении.

## Текущий deploy

Сейчас проект уже выложен публично.

Адреса:

- frontend: [https://bahus-492521.web.app](https://bahus-492521.web.app)
- backend via rewrite: [https://bahus-492521.web.app/api/health](https://bahus-492521.web.app/api/health)
- direct Cloud Run: [https://bahus-api-qjr255udka-ew.a.run.app](https://bahus-api-qjr255udka-ew.a.run.app)

Схема:

- `Firebase Hosting`
- `Cloud Run`
- `n8n` отдельно

Это сейчас лучший demo-контур, потому что:

- фронт у нас статический;
- backend лёгкий и контейнеризуемый;
- можно быстро показать заказчику;
- не надо сразу строить тяжёлый production-контур.

## База данных и предметная модель

В проекте уже заложен PostgreSQL-каркас.

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

Дополнительно зафиксирована важная модель:

один и тот же товар может прийти от разных поставщиков с разными ценами.

Это значит:

- не существует одной “истинной цены” товара;
- у товара могут быть разные supplier offers;
- это важно и для аналитики, и для подбора в КП.

## n8n-контур

Целевой async-flow сейчас такой:

1. пользователь загружает файл;
2. backend создаёт импорт;
3. backend делает `dispatch`;
4. `n8n` разбирает файл;
5. `n8n` возвращает success или failed webhook;
6. backend обновляет импорт, строки и ошибки;
7. интерфейс показывает результат.

Под это уже есть:

- [`docs/n8n-async-flow.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/n8n-async-flow.md)
- [`docs/prototype-backend-runbook.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/prototype-backend-runbook.md)
- [`docs/pdf-demo-plan.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/pdf-demo-plan.md)

И есть обновлённый JSON workflow:

- [`/Users/alexanderliapustin/Documents/Playground/Bahus.n8n.updated.json`](/Users/alexanderliapustin/Documents/Playground/Bahus.n8n.updated.json)

## Что уже готово технически

### UI

Готово:

- структура экранов;
- единый язык интерфейса;
- upload flow;
- quote flow;
- theme switch;
- settings users table;
- light/dark theme state в localStorage.

### Backend

Готово:

- lightweight backend для demo;
- import creation;
- import dispatch;
- import status polling;
- n8n callbacks;
- public deploy.

### Deploy

Готово:

- Firebase project `bahus-492521`
- Hosting
- Cloud Run service `bahus-api`
- working rewrite `/api/**`

## Что пока упрощено специально

Для прототипа сознательно упрощено:

- нет реального постоянного хранилища файлов;
- нет полноценной Google auth;
- нет production-grade user management;
- Postgres backend ещё не стал основным;
- часть реальных сценариев пока живёт в demo-state.

Это не баг стратегии, а осознанное упрощение ради скорости.

## Что делать дальше

### Ближайшая цель

Показать заказчику один живой сценарий:

`загрузка файла -> n8n -> callback -> строки в интерфейсе`

### Следующий шаг после demo

Перейти к реальным данным:

- сделать Postgres основным backend storage;
- сохранять импорты и строки не в памяти;
- подключить второй и третий parser;
- довести реальные quote exports;
- подключить Google auth.

## Если открыть проект в VS Code

Папка проекта:

- [`/Users/alexanderliapustin/Desktop/VS /Bahus`](/Users/alexanderliapustin/Desktop/VS%20/Bahus)

Самое полезное для быстрого входа:

1. открыть [`README.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/README.md)
2. открыть [`docs/project-guide.md`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/docs/project-guide.md)
3. открыть [`src/views/layout.js`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/src/views/layout.js)
4. открыть [`scripts/mock_api.py`](/Users/alexanderliapustin/Desktop/VS%20/Bahus/scripts/mock_api.py)

## Коротко

На сегодня `Bakhus Assistant` — это уже не просто набор макетов. Это рабочий прототип с публичным deploy, UI-потоком импорта и КП, lightweight backend и подготовленным `n8n`-контуром под первый живой demo.
