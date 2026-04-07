#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from urllib.request import Request, urlopen
from uuid import UUID

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError as exc:  # pragma: no cover - runtime-only guard
    raise SystemExit(
        "psycopg is required for postgres_api.py. Install dependencies first, for example: "
        "pip install -r requirements-backend.txt"
    ) from exc


PROJECT_ROOT = Path(__file__).resolve().parent.parent


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bakhus Assistant PostgreSQL API")
    parser.add_argument("--host", default=os.getenv("API_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("API_PORT", "8078")))
    return parser.parse_args()


def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def infer_source_format(file_name: str, mime_type: str | None = None) -> str:
    suffix = Path(file_name or "").suffix.lower()
    if suffix in {".xlsx", ".xls", ".csv"}:
        return "excel"
    if suffix == ".pdf":
        return "pdf"
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}:
        return "image"
    if mime_type:
        lowered = mime_type.lower()
        if "pdf" in lowered:
            return "pdf"
        if "sheet" in lowered or "excel" in lowered or "csv" in lowered:
            return "excel"
        if lowered.startswith("image/"):
            return "image"
    return "attachment"


def infer_pipeline(source_format: str) -> str:
    if source_format == "excel":
        return "table_import"
    if source_format == "pdf":
        return "pdf_extract_v1"
    if source_format == "image":
        return "ocr_extract_v1"
    return "manual_review"


def json_default(value):
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


@dataclass
class AppConfig:
    db_dsn: str
    n8n_webhook_url: str | None
    public_file_base_url: str | None
    default_user_email: str


def build_config() -> AppConfig:
    db_dsn = os.getenv(
        "DATABASE_URL",
        "postgresql://bakhus:bakhus@127.0.0.1:5432/bakhus",
    )
    return AppConfig(
        db_dsn=db_dsn,
        n8n_webhook_url=os.getenv("N8N_IMPORT_WEBHOOK_URL"),
        public_file_base_url=os.getenv("PUBLIC_FILE_BASE_URL"),
        default_user_email=os.getenv("DEFAULT_MANAGER_EMAIL", "manager@bakhus"),
    )


class PostgresApiHandler(BaseHTTPRequestHandler):
    config = build_config()

    def log_message(self, fmt: str, *args) -> None:
        print(f"[postgres-api] {self.address_string()} - {fmt % args}")

    def end_headers(self) -> None:
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        super().end_headers()

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        route = parsed.path
        query = parse_qs(parsed.query)

        if route in {"/health", "/api/health"}:
            return self.respond_json({"status": "ok", "service": "bakhus-postgres-api"})
        if route == "/api/bootstrap":
            return self.handle_bootstrap()
        if route == "/api/imports":
            return self.handle_list_imports()
        if route.startswith("/api/imports/") and route.endswith("/status"):
            return self.handle_import_status(route.split("/")[3])
        if route == "/api/products":
            return self.handle_list_products(query.get("import_id", [None])[0])
        if route == "/api/jobs":
            return self.handle_list_jobs()
        if route == "/api/suppliers":
            return self.handle_list_suppliers()

        return self.respond_json({"error": "Not found", "path": route}, status=HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        route = parsed.path

        if route == "/api/imports":
            return self.handle_create_import()
        if route.startswith("/api/imports/") and route.endswith("/dispatch"):
            return self.handle_dispatch_import(route.split("/")[3])
        if route == "/api/webhooks/n8n/import-result":
            return self.handle_n8n_import_result()
        if route == "/api/webhooks/n8n/import-failed":
            return self.handle_n8n_import_failed()

        return self.respond_json({"error": "Not found", "path": route}, status=HTTPStatus.NOT_FOUND)

    def read_json_body(self) -> dict:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def respond_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False, default=json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def db(self):
        return psycopg.connect(self.config.db_dsn, row_factory=dict_row)

    def require_import(self, conn, import_id: str) -> dict | None:
        item = conn.execute(
            """
            select
              ib.id,
              ib.supplier_id,
              s.name as supplier_name,
              s.contract_type,
              s.vat_included,
              ib.source,
              ib.status,
              ib.processing_status,
              ib.document_type,
              ib.source_format,
              ib.currency,
              ib.period,
              ib.sheet_name,
              ib.import_date,
              ib.request_ref,
              ib.request_title,
              ib.manager_note,
              ib.processing_started_at,
              ib.processing_finished_at,
              ib.last_webhook_at,
              owner.email as owner_email,
              created_by.email as created_by_email
            from import_batch ib
            join supplier s on s.id = ib.supplier_id
            left join app_user owner on owner.id = ib.owner_user_id
            left join app_user created_by on created_by.id = ib.created_by_user_id
            where ib.id = %s
            """,
            (import_id,),
        ).fetchone()
        return item

    def get_default_user_id(self, conn) -> str | None:
        row = conn.execute(
            "select id from app_user where email = %s limit 1",
            (self.config.default_user_email,),
        ).fetchone()
        return str(row["id"]) if row else None

    def load_suppliers(self, conn) -> list[dict]:
        rows = conn.execute(
            """
            select id, external_code, name, contract_type, vat_included
            from supplier
            where is_active = true
            order by name asc
            """
        ).fetchall()
        return [
            {
                "id": str(row["id"]),
                "external_code": row["external_code"],
                "name": row["name"],
                "contract_type": row["contract_type"],
                "vat_included": row["vat_included"],
            }
            for row in rows
        ]

    def load_import_files(self, conn, import_id: str) -> list[dict]:
        rows = conn.execute(
            """
            select
              id,
              original_name,
              storage_path,
              mime_type,
              size_bytes,
              file_kind,
              note,
              processing_status,
              processing_pipeline,
              last_error,
              uploaded_at
            from import_file
            where import_batch_id = %s
            order by uploaded_at asc
            """,
            (import_id,),
        ).fetchall()
        return [
            {
                "id": str(row["id"]),
                "file_name": row["original_name"],
                "storage_path": row["storage_path"],
                "mime_type": row["mime_type"],
                "size_bytes": row["size_bytes"],
                "file_kind": row["file_kind"],
                "note": row["note"],
                "processing_status": row["processing_status"],
                "processing_pipeline": row["processing_pipeline"],
                "last_error": row["last_error"],
                "uploaded_at": row["uploaded_at"],
                "source_format": infer_source_format(row["original_name"], row["mime_type"]),
            }
            for row in rows
        ]

    def load_import_rows(self, conn, import_id: str) -> list[dict]:
        rows = conn.execute(
            """
            select
              ir.id,
              ir.import_batch_id,
              ir.row_index,
              ir.external_product_id,
              ir.temp_product_id,
              ir.raw_name,
              ir.normalized_name,
              ir.manual_normalized_name,
              ir.normalization_note,
              ir.category,
              ir.country,
              ir.volume_l,
              ir.purchase_price,
              ir.rrc_min,
              ir.promo,
              ir.review_status,
              ir.excluded,
              count(iri.id) as issues_total
            from import_row ir
            left join import_row_issue iri on iri.import_row_id = ir.id
            where ir.import_batch_id = %s
            group by ir.id
            order by ir.row_index asc
            """,
            (import_id,),
        ).fetchall()
        return [
            {
                "id": str(row["id"]),
                "import_batch_id": str(row["import_batch_id"]),
                "row_index": row["row_index"],
                "product_id": row["external_product_id"],
                "temp_id": row["temp_product_id"],
                "raw_name": row["raw_name"],
                "normalized_name": row["manual_normalized_name"] or row["normalized_name"],
                "category": row["category"],
                "country": row["country"],
                "volume_l": float(row["volume_l"]) if row["volume_l"] is not None else None,
                "purchase_price": float(row["purchase_price"]) if row["purchase_price"] is not None else None,
                "rrc_min": float(row["rrc_min"]) if row["rrc_min"] is not None else None,
                "promo": row["promo"],
                "review_status": row["review_status"],
                "excluded": row["excluded"],
                "issues_total": row["issues_total"],
                "ids": {},
            }
            for row in rows
        ]

    def load_import_issues(self, conn, import_id: str) -> list[dict]:
        rows = conn.execute(
            """
            select
              iri.id,
              iri.import_row_id,
              iri.severity,
              iri.field_name,
              iri.message,
              iri.raw_value,
              ir.row_index
            from import_row_issue iri
            join import_row ir on ir.id = iri.import_row_id
            where ir.import_batch_id = %s
            order by ir.row_index asc, iri.created_at asc
            """,
            (import_id,),
        ).fetchall()
        return [
            {
                "id": str(row["id"]),
                "import_row_id": str(row["import_row_id"]),
                "severity": row["severity"],
                "field": row["field_name"],
                "message": row["message"],
                "raw_value": row["raw_value"],
                "row_index": row["row_index"],
            }
            for row in rows
        ]

    def serialize_import(self, conn, batch_row: dict) -> dict:
        import_id = str(batch_row["id"])
        files = self.load_import_files(conn, import_id)
        rows = self.load_import_rows(conn, import_id)
        issues = self.load_import_issues(conn, import_id)
        price_file = next((item for item in files if item["file_kind"] == "price"), files[0] if files else None)
        attachments = [item for item in files if item["file_kind"] != "price"]

        return {
            "id": import_id,
            "meta": {
                "source_file": price_file["file_name"] if price_file else None,
                "source_format": batch_row["source_format"] or (price_file["source_format"] if price_file else None),
                "import_date": batch_row["import_date"],
                "currency": batch_row["currency"],
                "document_type": batch_row["document_type"],
                "period": batch_row["period"],
                "sheet_name": batch_row["sheet_name"],
                "attachments": attachments,
                "manager_note": batch_row["manager_note"],
                "request_ref": batch_row["request_ref"],
                "request_title": batch_row["request_title"],
                "processing_started_at": batch_row["processing_started_at"],
                "processing_finished_at": batch_row["processing_finished_at"],
                "last_webhook_at": batch_row["last_webhook_at"],
            },
            "supplier": {
                "id": str(batch_row["supplier_id"]),
                "name": batch_row["supplier_name"],
                "contract_type": batch_row["contract_type"],
                "vat_included": batch_row["vat_included"],
            },
            "created_by": batch_row["created_by_email"],
            "source": batch_row["source"],
            "owner": batch_row["owner_email"],
            "status": batch_row["processing_status"] or batch_row["status"],
            "errors": [
                {
                    "row_index": issue["row_index"],
                    "field": issue["field"],
                    "message": issue["message"],
                    "raw_value": issue["raw_value"],
                }
                for issue in issues
                if issue["severity"] == "error"
            ],
            "warnings": [
                {
                    "row_index": issue["row_index"],
                    "field": issue["field"],
                    "message": issue["message"],
                    "raw_value": issue["raw_value"],
                }
                for issue in issues
                if issue["severity"] != "error"
            ],
            "products": rows,
        }

    def handle_bootstrap(self) -> None:
        with self.db() as conn:
            imports = self.load_serialized_imports(conn)
            suppliers = self.load_suppliers(conn)
        return self.respond_json(
            {
                "items": {
                    "imports": imports,
                    "suppliers": suppliers,
                },
                "runtime": {
                    "data_source": "postgres-api",
                    "version": 1,
                },
            }
        )

    def load_serialized_imports(self, conn) -> list[dict]:
        batch_rows = conn.execute(
            """
            select
              ib.id,
              ib.supplier_id,
              s.name as supplier_name,
              s.contract_type,
              s.vat_included,
              ib.source,
              ib.status,
              ib.processing_status,
              ib.document_type,
              ib.source_format,
              ib.currency,
              ib.period,
              ib.sheet_name,
              ib.import_date,
              ib.request_ref,
              ib.request_title,
              ib.manager_note,
              ib.processing_started_at,
              ib.processing_finished_at,
              ib.last_webhook_at,
              owner.email as owner_email,
              created_by.email as created_by_email
            from import_batch ib
            join supplier s on s.id = ib.supplier_id
            left join app_user owner on owner.id = ib.owner_user_id
            left join app_user created_by on created_by.id = ib.created_by_user_id
            order by ib.import_date desc nulls last, ib.created_at desc
            """
        ).fetchall()
        return [self.serialize_import(conn, row) for row in batch_rows]

    def handle_list_imports(self) -> None:
        with self.db() as conn:
            imports = self.load_serialized_imports(conn)
        return self.respond_json({"items": imports})

    def handle_list_suppliers(self) -> None:
        with self.db() as conn:
            suppliers = self.load_suppliers(conn)
        return self.respond_json({"items": suppliers})

    def handle_list_products(self, import_id: str | None) -> None:
        if not import_id:
            return self.respond_json({"items": []})
        with self.db() as conn:
            import_row = self.require_import(conn, import_id)
            if import_row is None:
                return self.respond_json({"error": "Import not found", "import_id": import_id}, status=HTTPStatus.NOT_FOUND)
            products = self.load_import_rows(conn, import_id)
            supplier_name = import_row["supplier_name"]
            source_file = self.load_import_files(conn, import_id)
            source_file_name = next((item["file_name"] for item in source_file if item["file_kind"] == "price"), source_file[0]["file_name"] if source_file else None)

        return self.respond_json(
            {
                "items": [
                    {
                        **product,
                        "import_id": import_id,
                        "supplier_id": str(import_row["supplier_id"]),
                        "supplier_name": supplier_name,
                        "source_file": source_file_name,
                    }
                    for product in products
                ]
            }
        )

    def handle_list_jobs(self) -> None:
        with self.db() as conn:
            rows = conn.execute(
                """
                select id, type, target_type, target_id, status, updated_at
                from job_run
                order by created_at desc
                limit 50
                """
            ).fetchall()
        return self.respond_json(
            {
                "items": [
                    {
                        "id": str(row["id"]),
                        "type": row["type"],
                        "status": row["status"],
                        "target": str(row["target_id"]) if row["target_id"] else row["target_type"],
                        "updated_at": row["updated_at"],
                    }
                    for row in rows
                ]
            }
        )

    def handle_import_status(self, import_id: str) -> None:
        with self.db() as conn:
            batch_row = self.require_import(conn, import_id)
            if batch_row is None:
                return self.respond_json({"error": "Import not found", "import_id": import_id}, status=HTTPStatus.NOT_FOUND)
            files = self.load_import_files(conn, import_id)
            status = {
                "id": import_id,
                "status": batch_row["processing_status"] or batch_row["status"],
                "processing_started_at": batch_row["processing_started_at"],
                "processing_finished_at": batch_row["processing_finished_at"],
                "last_webhook_at": batch_row["last_webhook_at"],
                "files": [
                    {
                        "id": file["id"],
                        "file_kind": file["file_kind"],
                        "original_name": file["file_name"],
                        "processing_status": file["processing_status"],
                        "processing_pipeline": file["processing_pipeline"],
                        "last_error": file["last_error"],
                    }
                    for file in files
                ],
            }
        return self.respond_json({"item": status})

    def handle_create_import(self) -> None:
        payload = self.read_json_body()
        files = payload.get("files") or []
        if not files:
            return self.respond_json({"error": "files is required"}, status=HTTPStatus.BAD_REQUEST)

        with self.db() as conn:
            supplier_id = payload.get("supplier_id")
            supplier_row = conn.execute(
                "select id, name from supplier where id = %s limit 1",
                (supplier_id,),
            ).fetchone()
            if supplier_row is None:
                return self.respond_json({"error": "Supplier not found", "supplier_id": supplier_id}, status=HTTPStatus.BAD_REQUEST)

            default_user_id = self.get_default_user_id(conn)
            main_file = files[0]
            source_format = infer_source_format(main_file.get("file_name") or main_file.get("original_name") or "", main_file.get("mime_type"))
            import_row = conn.execute(
                """
                insert into import_batch (
                  supplier_id,
                  owner_user_id,
                  created_by_user_id,
                  source,
                  status,
                  processing_status,
                  document_type,
                  source_format,
                  currency,
                  period,
                  import_date,
                  request_ref,
                  request_title,
                  manager_note
                )
                values (
                  %s, %s, %s, %s,
                  'uploaded',
                  'uploaded',
                  %s, %s, %s, %s, %s,
                  %s, %s, %s
                )
                returning id
                """,
                (
                    supplier_id,
                    default_user_id,
                    default_user_id,
                    payload.get("source", "Web-интерфейс"),
                    payload.get("document_type", "price_list"),
                    source_format,
                    payload.get("currency", "RUB"),
                    payload.get("period"),
                    payload.get("import_date") or date.today().isoformat(),
                    payload.get("request_ref"),
                    payload.get("request_title"),
                    payload.get("manager_note"),
                ),
            ).fetchone()
            import_id = str(import_row["id"])

            for file in files:
                original_name = file.get("file_name") or file.get("original_name")
                conn.execute(
                    """
                    insert into import_file (
                      import_batch_id,
                      original_name,
                      storage_path,
                      mime_type,
                      size_bytes,
                      file_kind,
                      note,
                      processing_status,
                      processing_pipeline
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, 'uploaded', %s)
                    """,
                    (
                        import_id,
                        original_name,
                        file.get("storage_path") or f"/uploads/demo/{original_name}",
                        file.get("mime_type"),
                        file.get("size_bytes"),
                        file.get("file_kind", "price"),
                        file.get("note"),
                        infer_pipeline(infer_source_format(original_name or "", file.get("mime_type"))),
                    ),
                )

            for attachment in payload.get("attachments") or []:
                original_name = attachment.get("file_name") or attachment.get("original_name")
                conn.execute(
                    """
                    insert into import_file (
                      import_batch_id,
                      original_name,
                      storage_path,
                      mime_type,
                      size_bytes,
                      file_kind,
                      note,
                      processing_status,
                      processing_pipeline
                    )
                    values (%s, %s, %s, %s, %s, %s, %s, 'uploaded', %s)
                    """,
                    (
                        import_id,
                        original_name,
                        attachment.get("storage_path") or f"/uploads/demo/{original_name}",
                        attachment.get("mime_type"),
                        attachment.get("size_bytes"),
                        attachment.get("file_kind", "attachment"),
                        attachment.get("note"),
                        infer_pipeline(infer_source_format(original_name or "", attachment.get("mime_type"))),
                    ),
                )
            conn.commit()

            batch_row = self.require_import(conn, import_id)
            item = self.serialize_import(conn, batch_row)

        return self.respond_json({"item": item}, status=HTTPStatus.CREATED)

    def dispatch_to_n8n(self, dispatch_payload: dict) -> dict | None:
        if not self.config.n8n_webhook_url:
            return None
        request = Request(
            self.config.n8n_webhook_url,
            data=json.dumps(dispatch_payload, ensure_ascii=False, default=json_default).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(request, timeout=10) as response:
            raw = response.read() or b"{}"
        return json.loads(raw.decode("utf-8"))

    def handle_dispatch_import(self, import_id: str) -> None:
        payload = self.read_json_body()
        with self.db() as conn:
            batch_row = self.require_import(conn, import_id)
            if batch_row is None:
                return self.respond_json({"error": "Import not found", "import_id": import_id}, status=HTTPStatus.NOT_FOUND)

            files = self.load_import_files(conn, import_id)
            price_file = next((item for item in files if item["file_kind"] == "price"), None)
            if price_file is None:
                return self.respond_json({"error": "Price file not found", "import_id": import_id}, status=HTTPStatus.BAD_REQUEST)

            default_user_id = self.get_default_user_id(conn)
            dispatch_payload = {
                "import_batch_id": import_id,
                "import_file_id": price_file["id"],
                "file_kind": price_file["file_kind"],
                "mime_type": price_file["mime_type"],
                "storage_path": price_file["storage_path"],
                "source_file": price_file["file_name"],
                "requested_pipeline": price_file["processing_pipeline"] or infer_pipeline(price_file["source_format"]),
                "force": bool(payload.get("force", False)),
            }
            job_row = conn.execute(
                """
                insert into job_run (
                  type,
                  target_type,
                  target_id,
                  status,
                  payload,
                  created_by_user_id
                )
                values (
                  'import_parse',
                  'import_batch',
                  %s,
                  'queued',
                  %s::jsonb,
                  %s
                )
                returning id
                """,
                (import_id, json.dumps(dispatch_payload, ensure_ascii=False, default=json_default), default_user_id),
            ).fetchone()
            job_id = str(job_row["id"])
            dispatch_payload["job_id"] = job_id

            conn.execute(
                """
                update import_batch
                set
                  status = 'queued',
                  processing_status = 'queued',
                  processing_started_at = now(),
                  processing_finished_at = null,
                  updated_at = now()
                where id = %s
                """,
                (import_id,),
            )
            conn.execute(
                """
                update import_file
                set
                  processing_status = case when file_kind = 'price' then 'queued' else processing_status end,
                  dispatch_payload = %s::jsonb
                where import_batch_id = %s
                """,
                (json.dumps(dispatch_payload, ensure_ascii=False, default=json_default), import_id),
            )
            conn.commit()

        dispatch_result = None
        if self.config.n8n_webhook_url:
            try:
                dispatch_result = self.dispatch_to_n8n(dispatch_payload)
            except Exception as error:  # pragma: no cover - network path
                return self.respond_json(
                    {
                        "error": "Failed to dispatch to n8n",
                        "details": str(error),
                        "item": {
                            "import_id": import_id,
                            "job_id": job_id,
                            "status": "queued",
                        },
                    },
                    status=HTTPStatus.BAD_GATEWAY,
                )

        return self.respond_json(
            {
                "item": {
                    "import_id": import_id,
                    "job_id": job_id,
                    "status": "queued",
                },
                "dispatch": dispatch_result,
            },
            status=HTTPStatus.CREATED,
        )

    def resolve_import_file_id(self, conn, import_id: str, import_file_id: str | None) -> str | None:
        if import_file_id:
            return import_file_id
        row = conn.execute(
            """
            select id
            from import_file
            where import_batch_id = %s and file_kind = 'price'
            order by uploaded_at asc
            limit 1
            """,
            (import_id,),
        ).fetchone()
        return str(row["id"]) if row else None

    def handle_n8n_import_result(self) -> None:
        payload = self.read_json_body()
        import_id = payload.get("import_batch_id") or payload.get("import_id")
        if not import_id:
            return self.respond_json({"error": "import_batch_id is required"}, status=HTTPStatus.BAD_REQUEST)

        with self.db() as conn:
            batch_row = self.require_import(conn, import_id)
            if batch_row is None:
                return self.respond_json({"error": "Import not found", "import_id": import_id}, status=HTTPStatus.NOT_FOUND)

            import_file_id = self.resolve_import_file_id(conn, import_id, payload.get("import_file_id"))
            status = payload.get("status", "parsed")
            meta = payload.get("meta") or {}
            rows = payload.get("rows") or []
            issues = payload.get("issues") or []
            parse_result = payload.get("parse_result") or payload

            if payload.get("job_id"):
                conn.execute(
                    """
                    update job_run
                    set
                      status = 'done',
                      started_at = coalesce(started_at, now()),
                      finished_at = now(),
                      result = %s::jsonb,
                      updated_at = now()
                    where id = %s
                    """,
                    (json.dumps(payload, ensure_ascii=False, default=json_default), payload["job_id"]),
                )

            conn.execute(
                """
                update import_batch
                set
                  status = %s,
                  processing_status = %s,
                  processing_finished_at = now(),
                  last_webhook_at = now(),
                  currency = coalesce(%s, currency),
                  period = coalesce(%s, period),
                  sheet_name = coalesce(%s, sheet_name),
                  updated_at = now()
                where id = %s
                """,
                (status, status, meta.get("currency"), meta.get("period"), meta.get("sheet_name"), import_id),
            )
            if import_file_id:
                conn.execute(
                    """
                    update import_file
                    set
                      processing_status = %s,
                      processing_pipeline = %s,
                      parse_result = %s::jsonb,
                      last_error = null
                    where id = %s
                    """,
                    (
                        status,
                        payload.get("pipeline"),
                        json.dumps(parse_result, ensure_ascii=False, default=json_default),
                        import_file_id,
                    ),
                )

            conn.execute("delete from import_row where import_batch_id = %s", (import_id,))

            row_map = {}
            for index, row in enumerate(rows):
                row_index = int(row.get("row_index", index + 1))
                inserted = conn.execute(
                    """
                    insert into import_row (
                      import_batch_id,
                      row_index,
                      external_product_id,
                      temp_product_id,
                      raw_name,
                      normalized_name,
                      category,
                      country,
                      volume_l,
                      purchase_price,
                      rrc_min,
                      promo,
                      raw_payload
                    )
                    values (
                      %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
                    )
                    returning id
                    """,
                    (
                        import_id,
                        row_index,
                        row.get("product_id") or row.get("external_product_id"),
                        row.get("temp_id") or row.get("temp_product_id"),
                        row.get("raw_name") or row.get("name") or f"Строка {row_index}",
                        row.get("normalized_name"),
                        row.get("category"),
                        row.get("country"),
                        row.get("volume_l"),
                        row.get("purchase_price"),
                        row.get("rrc_min") or row.get("sale_price"),
                        bool(row.get("promo", False)),
                        json.dumps(row, ensure_ascii=False, default=json_default),
                    ),
                ).fetchone()
                row_map[row_index] = str(inserted["id"])

            for issue in issues:
                row_id = row_map.get(int(issue.get("row_index", 0)))
                if not row_id:
                    continue
                conn.execute(
                    """
                    insert into import_row_issue (
                      import_row_id,
                      severity,
                      field_name,
                      message,
                      raw_value
                    )
                    values (%s, %s, %s, %s, %s)
                    """,
                    (
                        row_id,
                        "error" if issue.get("severity") == "error" else "warning",
                        issue.get("field"),
                        issue.get("message") or "Требует проверки",
                        issue.get("raw_value"),
                    ),
                )

            conn.commit()
            refreshed = self.serialize_import(conn, self.require_import(conn, import_id))

        return self.respond_json({"item": refreshed})

    def handle_n8n_import_failed(self) -> None:
        payload = self.read_json_body()
        import_id = payload.get("import_batch_id") or payload.get("import_id")
        if not import_id:
            return self.respond_json({"error": "import_batch_id is required"}, status=HTTPStatus.BAD_REQUEST)

        with self.db() as conn:
            batch_row = self.require_import(conn, import_id)
            if batch_row is None:
                return self.respond_json({"error": "Import not found", "import_id": import_id}, status=HTTPStatus.NOT_FOUND)

            import_file_id = self.resolve_import_file_id(conn, import_id, payload.get("import_file_id"))
            error_text = payload.get("error") or payload.get("message") or "Обработка завершилась с ошибкой"

            if payload.get("job_id"):
                conn.execute(
                    """
                    update job_run
                    set
                      status = 'failed',
                      started_at = coalesce(started_at, now()),
                      finished_at = now(),
                      result = %s::jsonb,
                      updated_at = now()
                    where id = %s
                    """,
                    (json.dumps(payload, ensure_ascii=False, default=json_default), payload["job_id"]),
                )

            conn.execute(
                """
                update import_batch
                set
                  status = 'failed',
                  processing_status = 'failed',
                  processing_finished_at = now(),
                  last_webhook_at = now(),
                  updated_at = now()
                where id = %s
                """,
                (import_id,),
            )
            if import_file_id:
                conn.execute(
                    """
                    update import_file
                    set
                      processing_status = 'failed',
                      processing_pipeline = %s,
                      last_error = %s
                    where id = %s
                    """,
                    (payload.get("pipeline"), error_text, import_file_id),
                )
            conn.commit()
            refreshed = self.serialize_import(conn, self.require_import(conn, import_id))

        return self.respond_json({"item": refreshed, "error": error_text})


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), PostgresApiHandler)
    print(f"Bakhus PostgreSQL API running at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down PostgreSQL API")


if __name__ == "__main__":
    main()
