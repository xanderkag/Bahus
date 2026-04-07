# Backend First Slice

Первый прикладной срез backend для перехода с mock runtime к реальным данным.

## Цель итерации

Не строить весь backend сразу, а закрыть первый рабочий вертикальный сценарий:

1. увидеть реальные импорты;
2. открыть строки выбранного импорта;
3. создать КП;
4. добавить строки в КП;
5. открыть список КП и состав конкретного документа.

## Что покрывает этот срез

- `Импорт файлов`
- `Позиции` внутри выбранного импорта
- `Коммерческие предложения`
- состав `КП`

Не входит в этот срез:

- реальный экспорт файлов;
- catalog matching orchestration;
- jobs runner;
- постоянное файловое хранилище;
- auth и permission model.

## Доменные сущности

- `import_batch`
  - одна рабочая загрузка поставщика
- `import_file`
  - файл-источник или attachment внутри загрузки
- `import_row`
  - строка прайса
- `import_row_issue`
  - ошибка или предупреждение по строке
- `quote_document`
  - коммерческое предложение
- `quote_item`
  - строка КП

## API V1

### 1. Список импортов

`GET /api/imports`

Назначение:
- верхняя таблица `Файлы` на экране `Импорт файлов`

Query params:
- `scope=my|all`
- `supplier_id`
- `status`
- `document_type`
- `q`
- `limit`
- `offset`

Response:

```json
{
  "items": [
    {
      "id": "imp_001",
      "supplier_id": "sup_nr",
      "supplier_name": "НР",
      "source_file": "НР_Сетка_цен_Февраль.xlsx",
      "source_format": "excel",
      "document_type": "net_price",
      "status": "partial",
      "currency": "RUB",
      "period": "2026-02",
      "import_date": "2026-03-02",
      "issues_total": 2,
      "rows_total": 8,
      "attachments_total": 1
    }
  ],
  "meta": {
    "limit": 50,
    "offset": 0,
    "total": 3
  }
}
```

### 2. Создать импорт

`POST /api/imports`

Назначение:
- форма `Новый импорт`

Request body:

```json
{
  "supplier_id": "sup_nr",
  "document_type": "price_list",
  "request_ref": "КП-20260406",
  "request_title": "Подбор по запросу ресторана",
  "manager_note": "Нужен быстрый разбор и проверка цен",
  "files": [
    {
      "original_name": "price.xlsx",
      "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "storage_path": "/uploads/2026/04/price.xlsx",
      "size_bytes": 204800,
      "file_kind": "price"
    },
    {
      "original_name": "request.pdf",
      "mime_type": "application/pdf",
      "storage_path": "/uploads/2026/04/request.pdf",
      "size_bytes": 120480,
      "file_kind": "attachment"
    }
  ]
}
```

Response:

```json
{
  "item": {
    "id": "imp_004",
    "status": "uploaded"
  }
}
```

### 3. Строки импорта

`GET /api/imports/:id/rows`

Назначение:
- нижняя таблица `Позиции` на экране `Импорт файлов`

Query params:
- `q`
- `country`
- `category`
- `promo`
- `review_status`
- `issues`
- `limit`
- `offset`
- `sort`
- `direction`

Response:

```json
{
  "items": [
    {
      "id": "row_001",
      "import_batch_id": "imp_001",
      "row_index": 15,
      "external_product_id": "s147415",
      "temp_product_id": null,
      "raw_name": "Бруни Кюве Розе, розовое сладкое, 0.75",
      "normalized_name": "Бруни Кюве Розе",
      "category": "Игристое",
      "country": "Италия",
      "volume_l": 0.75,
      "purchase_price": 750.32,
      "rrc_min": 1109.00,
      "promo": false,
      "review_status": "pending",
      "excluded": false,
      "issues_total": 0
    }
  ],
  "meta": {
    "limit": 100,
    "offset": 0,
    "total": 8
  }
}
```

### 4. Проблемы импорта

`GET /api/imports/:id/issues`

Назначение:
- модалка проблем текущего импорта

### 5. Список КП

`GET /api/quotes`

Назначение:
- верхняя таблица на экране `КП`

Query params:
- `scope=my|all`
- `client_id`
- `status`
- `q`
- `limit`
- `offset`

Response:

```json
{
  "items": [
    {
      "id": "qt_001",
      "quote_number": "КП-20260406",
      "quote_date": "2026-04-06",
      "client_id": "cl_001",
      "client_name": "ООО \"Гастроном на Петровке\"",
      "request_title": "Подбор по Поставщик_Б_Прайс_Март.pdf",
      "manager_name": "Александр",
      "mode": "internal",
      "status": "draft",
      "positions_total": 4,
      "total_sale": 4328.00,
      "margin_pct": 53.50
    }
  ],
  "meta": {
    "limit": 50,
    "offset": 0,
    "total": 3
  }
}
```

### 6. Создать КП

`POST /api/quotes`

Request body:

```json
{
  "client_id": "cl_001",
  "request_title": "Подбор по ресторану",
  "quote_date": "2026-04-06",
  "mode": "internal",
  "note": "Черновик на согласование"
}
```

### 7. Получить одно КП

`GET /api/quotes/:id`

Назначение:
- нижняя рабочая таблица `Позиции КП`

Response:

```json
{
  "item": {
    "id": "qt_001",
    "quote_number": "КП-20260406",
    "quote_date": "2026-04-06",
    "client_id": "cl_001",
    "client_name": "ООО \"Гастроном на Петровке\"",
    "request_title": "Подбор по Поставщик_Б_Прайс_Март.pdf",
    "manager_name": "Александр",
    "mode": "internal",
    "status": "draft",
    "note": "Черновик на согласование",
    "items": []
  }
}
```

### 8. Добавить строки в КП

`POST /api/quotes/:id/items`

Request body:

```json
{
  "rows": [
    {
      "source_import_row_id": "row_001"
    },
    {
      "source_import_row_id": "row_002"
    }
  ]
}
```

Поведение:
- backend создаёт `quote_item`;
- `line_no` назначается автоматически;
- `name_snapshot`, `category_snapshot`, `country_snapshot`, `purchase_price`, `rrc_min` снимаются со строки импорта на момент добавления;
- `sale_price` по умолчанию берётся из `rrc_min`, а если её нет, из `purchase_price`.

### 9. Обновить строку КП

`PATCH /api/quote-items/:id`

Request body:

```json
{
  "qty": 2,
  "sale_price": 1290.00,
  "comment": "Согласовано вручную"
}
```

### 10. Удалить строку КП

`DELETE /api/quote-items/:id`

## Порядок реализации

### Этап 1

- `GET /api/imports`
- `GET /api/imports/:id/rows`
- `GET /api/imports/:id/issues`

Даёт живой экран `Импорт файлов`.

### Этап 2

- `GET /api/quotes`
- `POST /api/quotes`
- `GET /api/quotes/:id`
- `POST /api/quotes/:id/items`

Даёт живой экран `КП`.

### Этап 3

- `PATCH /api/quote-items/:id`
- `DELETE /api/quote-items/:id`
- `POST /api/imports`

Даёт реальное редактирование и создание данных.

## Что важно по ценам поставщиков

Один и тот же товар может приходить:

- от разных поставщиков;
- по разным закупочным ценам;
- в разное время;
- как promo и как обычный прайс.

Поэтому:

- `catalog_product` не хранит “единственную цену”;
- цены живут в `catalog_supplier_offer`;
- `import_row` остаётся источником фактического входящего предложения;
- `quote_item` хранит snapshot цены на момент сборки КП.

Это позволит:

- сравнивать предложения поставщиков;
- не терять историю цен;
- собирать КП не по абстрактному товару, а по конкретному предложению.
