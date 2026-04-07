# Firebase + Cloud Run Deploy

Короткий deploy-runbook для быстрого demo Bahus.

Цель:

- фронт отдаётся через `Firebase Hosting`
- backend живёт в `Cloud Run`
- `/api/**` проксируется из Hosting в Cloud Run
- `n8n` стучится webhook'ом в тот же публичный `/api`

## Что уже подготовлено в проекте

- `firebase.json`
- `.firebaserc`
- `docker/mock-api.Dockerfile`

По умолчанию rewrite настроен на:

- Cloud Run service: `bahus-api`
- region: `europe-west1`

Если сервис или регион будут другими, просто поправьте `firebase.json`.

## Что сделать перед деплоем

### 1. Создать проект

Создайте один Firebase / GCP project, например:

- `bahus-demo`

Если project id будет другим, обновите:

- `.firebaserc`

### 2. Включить billing

Для `Cloud Run` нужен billing.

### 3. Установить CLI

Нужны:

- `firebase-tools`
- `gcloud`

## Логин и выбор проекта

```bash
firebase login
gcloud auth login
gcloud config set project bahus-demo
firebase use --add
```

## Deploy backend в Cloud Run

Для первого demo можно выкатывать текущий лёгкий backend из:

- `docker/mock-api.Dockerfile`

### Вариант через Artifact Registry

```bash
gcloud artifacts repositories create bahus \
  --repository-format=docker \
  --location=europe-west1
```

```bash
gcloud auth configure-docker europe-west1-docker.pkg.dev
```

```bash
docker build -f docker/mock-api.Dockerfile \
  -t europe-west1-docker.pkg.dev/bahus-demo/bahus/bahus-api:demo .
```

```bash
docker push europe-west1-docker.pkg.dev/bahus-demo/bahus/bahus-api:demo
```

```bash
gcloud run deploy bahus-api \
  --image europe-west1-docker.pkg.dev/bahus-demo/bahus/bahus-api:demo \
  --region europe-west1 \
  --allow-unauthenticated
```

После этого проверьте:

```bash
curl https://<cloud-run-url>/api/health
```

## Deploy фронта в Firebase Hosting

Из корня проекта:

```bash
firebase deploy --only hosting
```

После этого проверьте:

- `https://<project-id>.web.app`
- `https://<project-id>.web.app/api/health`

Если rewrite настроен правильно, `/api/health` должен попасть в Cloud Run.

## Что важно для Bahus

Фронт у нас статический, поэтому отдельная сборка не нужна.

Firebase Hosting отдаёт:

- `index.html`
- `src/**`

А `Cloud Run` принимает:

- `POST /api/imports`
- `POST /api/imports/:id/dispatch`
- `GET /api/imports/:id/status`
- `POST /api/webhooks/n8n/import-result`
- `POST /api/webhooks/n8n/import-failed`

## Как подключать n8n

В `n8n` используйте не прямой URL Cloud Run, а публичный хост от Hosting:

- `https://<project-id>.web.app/api/webhooks/n8n/import-result`
- `https://<project-id>.web.app/api/webhooks/n8n/import-failed`

Так demo будет выглядеть как единый сервис.

## Что проверить перед показом

1. Открывается сайт
2. Работает `/api/health`
3. Создаётся импорт
4. `dispatch` возвращает payload для `n8n`
5. webhook обновляет статус импорта
6. строки появляются в таблице `Позиции`

## Что менять потом

Когда demo подтвердится:

- заменить `mock_api.py` на более взрослый backend
- при необходимости перевести данные в Postgres
- вынести `n8n` в постоянный контур
