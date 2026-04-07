# PostgreSQL Layer

Локальный PostgreSQL-контур для Bakhus Assistant.

Что уже заложено:

- `001_schema.sql` — первая доменная схема под импорты, review, каталог, КП и jobs
- `002_seed.sql` — базовые роли, пользователи, поставщики, клиенты и несколько catalog products
- `003_real_data_iteration.sql` — расширение под реальные attachments, офферы поставщиков и экспорт КП
- `004_n8n_async_processing.sql` — async-статусы, dispatch payload и webhook callback поля

Основные сущности:

- `app_user`, `app_role`, `app_user_role`
- `supplier`
- `client_account`
- `import_batch`, `import_file`, `import_row`, `import_row_issue`
- `catalog_supplier_offer`
- `catalog_product`, `row_product_match`
- `quote_document`, `quote_item`, `quote_item_alternative`, `quote_export`
- `job_run`

Особенности:

- `pg_trgm` включён под fuzzy search по клиентам, строкам импорта и каталогу
- `JSONB` используется для payload/result и сырых данных
- разные цены и промо по одному и тому же товару от разных поставщиков выносятся в `catalog_supplier_offer`
- attachments живут на уровне `import_file` через `file_kind`, без отдельного voice-сценария
- async-обработка через `n8n` идёт через `job_run` + processing-поля на `import_batch` и `import_file`
- справочник и quote-структура готовы под постепенный перевод mock API на реальную БД

Поднять только БД и GUI:

```bash
make db-up
```

Открыть:

- PostgreSQL: `localhost:5432`
- Adminer: `http://127.0.0.1:8080`

Доступ:

- DB: `bakhus`
- User: `bakhus`
- Password: `bakhus`

Подключиться через psql:

```bash
make db-psql
```
