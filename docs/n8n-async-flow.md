# n8n: Async Import Flow & OpenAI Assistants API Pipeline
# Последнее обновление: 2026-04-20

## Зачем нужен отдельный async-контур

Файл, который загружается в интерфейсе, не должен обрабатываться прямо в web backend.

Причины:
- разные типы файлов требуют разных pipeline
- разбор PDF через AI может занимать 15-60 секунд
- нужен повторный запуск без повторной загрузки
- нужны статусы обработки
- нужен webhook callback когда `n8n` закончит работу

---

## Текущий пайплайн: OpenAI Assistants API (с апреля 2026)

### Почему мигрировали с pdfplumber / Extract PDF

Прайс-листы поставщиков часто содержат:
- векторный текст с нестандартными шрифтами (pdfplumber выдаёт мусор)
- таблицы как изображения (OCR нужен)
- сложную верстку с объединёнными ячейками

Стандартный Extract PDF node в n8n + прямая отправка текста в `gpt-4o` давал нестабильные результаты.

### Как работает новый пайплайн

```
Railway Backend
      │
      │ multipart/form-data (file + metadata)
      ▼
 n8n Webhook
      │
      ▼
 Metadata & Validation
 (тип файла, magic bytes, расширение)
      │
      ├── если не PDF/Excel → Format Error → Callback Failed
      │
      ▼
 Inject API Key  ← Set node, читает $env["OPENAI_API_KEY"]
      │            (обход security policy self-hosted n8n)
      ▼
 OpenAI Assistants API  ← Code node, runOnceForAllItems
      │
      │  1. POST /v1/files (загрузка PDF)
      │  2. POST /v1/assistants (создание временного ассистента)
      │  3. POST /v1/threads
      │  4. POST /v1/threads/{id}/messages
      │  5. POST /v1/threads/{id}/runs
      │  6. GET /v1/threads/{id}/runs/{id}  ← polling (max 60 × 3s)
      │  7. GET /v1/threads/{id}/messages  ← извлечение ответа
      │  8. DELETE /v1/files/{id}  ← cleanup
      │  9. DELETE /v1/assistants/{id}  ← cleanup
      │
      ▼
 Format Success / Format Error
      │
      ▼
 HTTP Request → callbackSuccessUrl / callbackFailedUrl
 (Railway: POST /api/webhooks/n8n/import-result)
```

### Ключевые особенности Code node

```javascript
// runOnceForAllItems = true
// Доступ к binary данным через $input.first().binary
const items = $input.all();
const binaryData = items[0].binary;
const fileKey = Object.keys(binaryData)[0];
const file = binaryData[fileKey];

// API key получаем из предыдущей ноды (Inject API Key)
const apiKey = $input.first().json.openai_api_key;
```

### Ограничения

- Assistants API работает 15-60 секунд (vs 3-5 секунд для стандартного chat completion)
- Максимальное время ожидания в нашем скрипте: `60 попыток × 3 секунды = 3 минуты`
- После 3 минут ожидания — ошибка timeout; временные ресурсы всё равно удаляются
- Self-hosted n8n: Code node не имеет доступа к `$env` — обходится через нода `Inject API Key`

---

## Статусная машина

### import_batch.status / import_file.processing_status

```
uploaded → queued → processing → parsed
                              ↘ failed
                              ↘ partial
```

### job_run.status

```
queued → running → done
               ↘ failed
```

---

## API Endpoints

### 1. Приём файла / создание импорта

`POST /api/imports` — `multipart/form-data`

Поля:
- `file` — бинарный файл
- `supplier_id`, `supplier_name`, `document_type`, `request_ref`, `manager_note`

Ответ:
```json
{ "item": { "id": "imp_xxx", "status": "queued" } }
```

### 2. n8n success callback

`POST /api/webhooks/n8n/import-result`

```json
{
  "job_id": "job_001",
  "import_batch_id": "imp_004",
  "import_file_id": "file_001",
  "pipeline": "pdf-assistants-v1",
  "status": "parsed",
  "rows": [
    {
      "name": "Товар 1",
      "article": "ART-001",
      "purchase_price": 1500,
      "currency": "RUB"
    }
  ],
  "issues": [],
  "meta": {
    "sheet_name": null,
    "currency": "RUB"
  }
}
```

### 3. n8n failed callback

`POST /api/webhooks/n8n/import-failed`

```json
{
  "job_id": "job_001",
  "import_batch_id": "imp_004",
  "import_file_id": "file_001",
  "pipeline": "pdf-assistants-v1",
  "error": "Assistants API timeout after 3 minutes"
}
```

### 4. Статус импорта (для polling)

`GET /api/imports/{id}/status`

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
        "processing_pipeline": "pdf-assistants-v1"
      }
    ]
  }
}
```

Frontend поллит каждые 3 секунды до статуса `parsed` / `failed`.

---

## Важные патерны (зафиксированы как правила)

### 1. Inject API Key (self-hosted n8n workaround)

Нода `Inject API Key` — всегда должна стоять **непосредственно перед** Code node.
Code node обращается к ключу через `$input.first().json.openai_api_key`.

```
[Inject API Key (Set node)] → [OpenAI Assistants API (Code node)]
```

### 2. Защита состояния модала от поллеров

`loadImportsResource()` в `app-actions.js` должна **не сбрасывать** статус `saving`/`done`:

```javascript
const isUploading = currentStatus === "saving" || currentStatus === "done";
if (!isUploading) {
  setResourceState("imports", { status: "loading", error: null });
}
// ...при обновлении данных:
status: (imports?.status === "saving" || imports?.status === "done")
  ? imports.status
  : "ready",
```

### 3. Настройки колонок — слияние при апдейте

`mergeTableColumns()` в `app.js` объединяет сохранённый порядок со списком по умолчанию:
- сохранённые колонки идут в их порядке
- новые колонки (которых нет в сохранённом) добавляются в конец
- удалённые (которые есть в сохранённом, но нет в дефолтном) отбрасываются

---

## Debugging

### Railway logs (backend)
```
[N8N] DISPATCH →   # файл отправлен в n8n
[N8N] RESPONSE ←   # n8n принял
[N8N] ERROR ←      # n8n вернул ошибку (4xx/5xx)
[N8N] SKIP         # N8N_IMPORT_WEBHOOK_URL не настроен
[WEBHOOK]          # n8n вызвал callback
```

### n8n execution log
- Открыть n8n UI → Executions
- Найти последний прогон → проверить вывод каждой ноды
- Code node выводит `console.log` в execution log

### Frontend debug
- В `src/utils/dom.js` добавлен временный глобальный catch → выводит `alert()` на любую async ошибку кнопки
- В `createImportsFromUpload` добавлены `alert()` для трассировки статусного потока
- **Убрать перед деплоем!**
