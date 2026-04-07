# n8n Async Flow

Контур асинхронной обработки файлов через `n8n`.

## Зачем нужен отдельный async-контур

Файл, который загружается в интерфейсе, не должен обрабатываться прямо в web backend.

Причины:

- разные типы файлов требуют разных pipeline;
- разбор может быть долгим;
- нужен повторный запуск;
- нужны статусы обработки;
- нужен webhook callback, когда `n8n` закончит работу.

## Целевой поток

1. Пользователь создаёт импорт через UI.
2. Backend создаёт:
   - `import_batch`
   - `import_file`
   - `job_run`
3. Backend отправляет payload в `n8n webhook`.
4. `n8n` сам выбирает pipeline по типу файла:
   - `excel/csv`
   - `pdf`
   - `image/screenshot`
   - `attachment/manual-review`
5. `n8n` завершает обработку и вызывает наш callback.
6. Backend сохраняет:
   - строки импорта,
   - ошибки,
   - служебный payload,
   - статус batch/file/job.
7. UI показывает готовый результат или ошибку.

## Какие статусы нужны

### import_batch.status

- `uploaded`
- `queued`
- `processing`
- `parsed`
- `partial`
- `failed`

### import_file.processing_status

- `uploaded`
- `queued`
- `processing`
- `parsed`
- `failed`
- `ignored`

### job_run.status

Уже есть:

- `queued`
- `running`
- `done`
- `failed`

## Какие поля нужны в БД

### import_batch

- `processing_status text`
- `processing_started_at timestamptz`
- `processing_finished_at timestamptz`
- `last_webhook_at timestamptz`

### import_file

- `processing_status text`
- `processing_pipeline text`
- `dispatch_payload jsonb`
- `parse_result jsonb`
- `last_error text`

### job_run

Используем как tracking record для dispatch/callback.

Важно хранить в `payload`:

- `import_batch_id`
- `import_file_id`
- `file_kind`
- `mime_type`
- `storage_path`
- `requested_pipeline`

Важно хранить в `result`:

- `webhook_run_id`
- `rows_created`
- `issues_created`
- `warnings_created`
- `raw_response`

## Какие endpoint'ы нужны

### 1. Dispatch import

`POST /api/imports/:id/dispatch`

Назначение:
- перевести импорт из `uploaded` в `queued`
- создать `job_run`
- отправить payload в `n8n`

Request body:

```json
{
  "force": false
}
```

Response:

```json
{
  "item": {
    "import_id": "imp_004",
    "job_id": "job_001",
    "status": "queued"
  }
}
```

### 2. n8n success callback

`POST /api/webhooks/n8n/import-result`

Body:

```json
{
  "job_id": "job_001",
  "import_batch_id": "imp_004",
  "import_file_id": "file_001",
  "pipeline": "pdf-extract-v1",
  "status": "partial",
  "rows": [],
  "issues": [],
  "meta": {
    "sheet_name": null,
    "currency": "RUB"
  }
}
```

Поведение backend:

- находит `job_run`
- обновляет `job_run.status = done`
- обновляет `import_batch`
- обновляет `import_file`
- вставляет `import_row`
- вставляет `import_row_issue`

### 3. n8n failed callback

`POST /api/webhooks/n8n/import-failed`

Body:

```json
{
  "job_id": "job_001",
  "import_batch_id": "imp_004",
  "import_file_id": "file_001",
  "pipeline": "pdf-extract-v1",
  "error": "OCR timeout"
}
```

Поведение backend:

- `job_run.status = failed`
- `import_file.processing_status = failed`
- `import_batch.status = failed` или `partial`
- пишет `last_error`

### 4. Import processing status

`GET /api/imports/:id/status`

Ответ:

```json
{
  "item": {
    "id": "imp_004",
    "status": "processing",
    "files": [
      {
        "id": "file_001",
        "file_kind": "price",
        "processing_status": "processing",
        "processing_pipeline": "pdf-extract-v1"
      }
    ]
  }
}
```

## Как выбирать pipeline

### price

- `xlsx`
- `xls`
- `csv`
- `pdf`
- `jpg/png/webp` если это фото прайса

### attachment

- не всегда парсится в строки
- может идти в classify/manual-review flow

### request

- обычно attachment к запросу или КП
- может разбираться отдельно от прайса

## Что важно по продукту

Нам не нужно сейчас решать всё в `n8n`.

Нужно зафиксировать главное:

- backend умеет отправить задачу;
- backend умеет принять callback;
- все статусы и payload'ы сохраняются;
- UI видит прогресс обработки.

Это уже даст нам реальный скелет production-контура.
