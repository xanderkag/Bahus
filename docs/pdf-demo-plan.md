# PDF Demo Plan

План первого живого сценария для показа заказчику:

`загрузка PDF -> dispatch в n8n -> webhook обратно -> запись в Postgres -> отображение строк в Bahus`

## Цель

Собрать не всю систему целиком, а один сквозной сценарий, который выглядит как реальный продукт:

1. менеджер загружает один PDF-прайс;
2. импорт создаётся в системе;
3. backend отправляет задачу в `n8n`;
4. `n8n` разбирает PDF;
5. результат возвращается webhook'ом;
6. строки и ошибки сохраняются в PostgreSQL;
7. UI показывает готовый импорт и его позиции.

## Что входит в первый проход

- один тип входного файла: `PDF`
- один pipeline в `n8n`
- один успешный сценарий разбора
- один callback в backend
- одна таблица импортов и одна таблица позиций в UI

Не входит в первый проход:

- все форматы файлов
- все типы вложений
- matching каталога
- сборка КП на реальной БД
- продовая авторизация
- полноценное файловое хранилище

## Что показываем заказчику

На демо должно быть видно:

1. файл загружается из интерфейса;
2. статус меняется на `В очереди`;
3. после обработки появляется `Разобрано` или `Требует проверки`;
4. внизу отображаются реальные строки;
5. ошибки разбора видны отдельно и не теряются.

## Минимальный технический контур

- фронт: текущий `Bahus`
- backend: API слой проекта
- БД: `Postgres`
- processing: `n8n`

Для первой итерации этого достаточно.

## Таблицы, которые реально нужны в первой демо-цепочке

- `import_batch`
- `import_file`
- `import_row`
- `import_row_issue`
- `job_run`

Этого хватает, чтобы не трогать пока каталог и КП.

## Endpoint'ы первой демо-цепочки

### UI -> backend

- `POST /api/imports`
- `POST /api/imports/:id/dispatch`
- `GET /api/imports`
- `GET /api/imports/:id/status`
- `GET /api/imports/:id/rows`

### n8n -> backend

- `POST /api/webhooks/n8n/import-result`
- `POST /api/webhooks/n8n/import-failed`

## Минимальный payload в n8n

Backend отправляет в `n8n`:

```json
{
  "job_id": "job_001",
  "import_batch_id": "imp_004",
  "import_file_id": "file_001",
  "file_kind": "price",
  "mime_type": "application/pdf",
  "storage_path": "/uploads/demo/price.pdf",
  "source_file": "price.pdf",
  "requested_pipeline": "pdf-extract-v1"
}
```

## Минимальный callback success

`n8n` возвращает:

```json
{
  "job_id": "job_001",
  "import_batch_id": "imp_004",
  "import_file_id": "file_001",
  "pipeline": "pdf-extract-v1",
  "status": "partial",
  "rows": [
    {
      "row_index": 1,
      "raw_name": "Вино белое сухое 0.75",
      "normalized_name": "Вино белое сухое",
      "category": "Вино",
      "country": "Италия",
      "volume_l": 0.75,
      "purchase_price": 560.0,
      "rrc_min": 890.0,
      "promo": false
    }
  ],
  "issues": [
    {
      "severity": "warning",
      "row_index": 3,
      "field": "volume_l",
      "message": "Объём не найден"
    }
  ],
  "meta": {
    "currency": "RUB",
    "sheet_name": null,
    "period": "2026-04"
  }
}
```

## Минимальный callback failed

```json
{
  "job_id": "job_001",
  "import_batch_id": "imp_004",
  "import_file_id": "file_001",
  "pipeline": "pdf-extract-v1",
  "error": "PDF parse timeout"
}
```

## Порядок работ

### Этап 1. Поднять локальный контур

Сделать:

- поднять `Postgres`
- накатить `001..004` SQL
- проверить доступность `Adminer`
- оставить фронт и mock API как рабочее окружение для UI

Результат:

- БД готова принимать реальные импорты и callback'и

### Этап 2. Сделать backend persistence для import-flow

Сделать:

- `POST /api/imports` пишет в `import_batch` и `import_file`
- `POST /api/imports/:id/dispatch` создаёт `job_run`
- `GET /api/imports` и `GET /api/imports/:id/status` читают уже из БД

Результат:

- импорт создаётся не в памяти, а в Postgres

### Этап 3. Подключить один workflow в n8n

Сделать:

- webhook входа от backend
- один `PDF` pipeline
- возврат в `import-result` или `import-failed`

Результат:

- `n8n` реально участвует в обработке

### Этап 4. Сохранить результат разбора

Сделать:

- на success вставлять `import_row`
- на success вставлять `import_row_issue`
- обновлять `import_batch.status`
- обновлять `import_file.processing_status`
- обновлять `job_run.status`

Результат:

- строки и ошибки живут в БД

### Этап 5. Подключить UI к реальным данным

Сделать:

- таблица `Файлы` читает реальные импорты
- таблица `Позиции` читает реальные `import_row`
- polling статуса уже показывает смену состояний

Результат:

- UI показывает реальный end-to-end flow

## Критерий готовности демо

Демо считается готовым, когда:

1. в Bahus загружается один PDF;
2. импорт получает `job_id`;
3. `n8n` обрабатывает его;
4. callback пишет строки в Postgres;
5. строки появляются в таблице `Позиции`;
6. хотя бы одна ошибка или warning корректно отображается в UI.

## Что делаем сразу после успешного демо

Следующий шаг после первого живого PDF:

- добавить второй PDF-кейс
- довести хранение файлов
- перейти от `mock_api.py` к реальному backend service
- подключить дальнейшие сценарии `КП`

## Кто что делает

### Bahus backend

- принимает upload
- создаёт import records
- вызывает `n8n`
- принимает callback
- пишет строки и ошибки в БД

### n8n

- получает payload на обработку
- запускает PDF parser
- собирает rows/issues/meta
- вызывает success/failed webhook

### UI

- создаёт импорт
- показывает статус обработки
- показывает готовые строки
- показывает ошибки разбора
