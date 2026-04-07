# Prototype Backend Runbook

Короткий сценарий для первого живого demo без лишней инфраструктуры.

Идея:

- фронт остаётся как есть;
- backend остаётся в `scripts/mock_api.py`;
- `n8n` подключается только к одному import-flow;
- данные хранятся в памяти процесса, этого достаточно для первого показа.

## Что считаем готовым

Демо считается успешным, когда:

1. в UI загружается один PDF;
2. backend создаёт импорт;
3. backend отдаёт `dispatch_payload` для `n8n`;
4. `n8n` вызывает success webhook;
5. строки появляются в таблице `Позиции`.

## Что поднимаем

### 1. Фронт + backend

```bash
make up-local
```

Или по отдельности:

```bash
make run
make mock-api
```

Открыть:

- фронт: `http://127.0.0.1:4173`
- backend health: `http://127.0.0.1:8079/api/health`

## Как работает прототипный backend

Файл:

- `scripts/mock_api.py`

Это наш текущий лёгкий backend для прототипа. Он уже умеет:

- `POST /api/imports`
- `POST /api/imports/:id/dispatch`
- `GET /api/imports/:id/status`
- `POST /api/webhooks/n8n/import-result`
- `POST /api/webhooks/n8n/import-failed`

## Как прогоняется demo-сценарий

### 1. Создаём импорт

Из UI или напрямую:

```bash
curl -X POST http://127.0.0.1:8079/api/imports \
  -H 'Content-Type: application/json' \
  -d '{
    "supplier_id": "sup_nr",
    "supplier_name": "НР",
    "document_type": "price_list",
    "files": [
      {
        "file_name": "price.pdf",
        "mime_type": "application/pdf",
        "file_kind": "price"
      }
    ],
    "attachments": [],
    "manager_note": "Demo PDF import"
  }'
```

### 2. Отправляем импорт в обработку

```bash
curl -X POST http://127.0.0.1:8079/api/imports/imp_004/dispatch \
  -H 'Content-Type: application/json' \
  -d '{}'
```

В ответе backend уже вернёт:

- `job_id`
- `import_batch_id`
- `requested_pipeline`
- `callbacks.success_url`
- `callbacks.failed_url`

Именно этот `dispatch_payload` можно дальше передать в `n8n`.

## Что должен сделать n8n

Минимально:

1. принять `dispatch_payload`;
2. разобрать PDF;
3. собрать `rows`, `issues`, `meta`;
4. вызвать `success_url`.

## Минимальный success callback

```bash
curl -X POST http://127.0.0.1:8079/api/webhooks/n8n/import-result \
  -H 'Content-Type: application/json' \
  -d '{
    "job_id": "job_import_parse_imp_004_4",
    "import_batch_id": "imp_004",
    "pipeline": "pdf_extract_v1",
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
      },
      {
        "row_index": 2,
        "raw_name": "Игристое брют 0.75",
        "normalized_name": "Игристое брют",
        "category": "Игристое",
        "country": "Испания",
        "volume_l": 0.75,
        "purchase_price": 610.0,
        "rrc_min": 950.0,
        "promo": true
      }
    ],
    "issues": [
      {
        "severity": "warning",
        "row_index": 2,
        "field": "rrc_min",
        "message": "RRC требует проверки"
      }
    ],
    "meta": {
      "currency": "RUB",
      "period": "2026-04",
      "sheet_name": null
    }
  }'
```

## Минимальный failed callback

```bash
curl -X POST http://127.0.0.1:8079/api/webhooks/n8n/import-failed \
  -H 'Content-Type: application/json' \
  -d '{
    "job_id": "job_import_parse_imp_004_4",
    "import_batch_id": "imp_004",
    "pipeline": "pdf_extract_v1",
    "error": "PDF parse timeout"
  }'
```

## Что увидим в UI

После success callback:

- импорт сменит статус;
- polling подтянет обновление автоматически;
- строки появятся в нижней таблице `Позиции`;
- warning/error попадут в детали импорта.

## Почему этого достаточно для прототипа

Потому что это уже показывает главное:

- UI умеет загрузить файл;
- backend умеет создать импорт;
- `n8n` реально участвует в цепочке;
- результат реально возвращается и отображается.

Для первого показа заказчику этого вполне достаточно.
