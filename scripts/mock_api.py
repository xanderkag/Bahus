#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse


PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = PROJECT_ROOT / "src" / "data" / "demo-imports.json"
DEFAULT_PUBLIC_API_BASE = os.getenv("PUBLIC_API_BASE_URL", "http://127.0.0.1:8079/api")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Bakhus Assistant mock API")
    parser.add_argument("--host", default=os.getenv("MOCK_API_HOST", "127.0.0.1"))
    parser.add_argument("--port", type=int, default=int(os.getenv("MOCK_API_PORT", "8079")))
    return parser.parse_args()


def load_demo_data() -> dict:
    imports = json.loads(DATA_FILE.read_text(encoding="utf-8"))
    return rebuild_cache_from_imports(imports)


def rebuild_cache_from_imports(imports: list[dict]) -> dict:
    imports = [json.loads(json.dumps(item, ensure_ascii=False)) for item in imports]

    suppliers = {}
    products = []
    for item in imports:
        suppliers[item["supplier"]["id"]] = item["supplier"]
        for product in item["products"]:
            products.append({
                **product,
                "import_id": item["id"],
                "supplier_id": item["supplier"]["id"],
                "supplier_name": item["supplier"]["name"],
                "source_file": item["meta"]["source_file"],
            })

    cache = {
        "imports": imports,
        "suppliers": list(suppliers.values()),
        "products": products,
        "catalog_matches": build_catalog(products),
    }
    return cache


def now_iso() -> str:
    return datetime.utcnow().isoformat(timespec="seconds") + "Z"


def slugify(value: str) -> str:
    allowed = []
    for char in (value or "").lower():
        if char.isalnum():
            allowed.append(char)
        elif char in {" ", "-", "_"}:
            allowed.append("_")
    return "".join(allowed).strip("_") or "item"


def map_source_format(file_name: str, mime_type: str | None = None) -> str:
    suffix = Path(file_name or "").suffix.lower()
    if suffix in {".xlsx", ".xls", ".csv"}:
        return "excel"
    if suffix == ".pdf":
        return "pdf"
    if suffix in {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"}:
        return "image"
    if mime_type:
        if "pdf" in mime_type:
            return "pdf"
        if "sheet" in mime_type or "excel" in mime_type or "csv" in mime_type:
            return "excel"
        if mime_type.startswith("image/"):
            return "image"
    return "attachment"


def infer_pipeline(source_format: str) -> str:
    if source_format == "excel":
        return "table_import"
    if source_format == "pdf":
        return "pdf_extract"
    if source_format == "image":
        return "ocr_extract"
    return "manual_review"


def infer_document_type(source_format: str, explicit_type: str | None = None) -> str:
    if explicit_type:
        return explicit_type
    return "price_list" if source_format in {"pdf", "image"} else "net_price"


def normalize_attachment(entry: dict, index: int = 0) -> dict:
    file_name = entry.get("file_name") or entry.get("name") or f"attachment_{index + 1}"
    mime_type = entry.get("mime_type")
    source_format = map_source_format(file_name, mime_type)
    return {
        "id": entry.get("id") or f"file_{slugify(file_name)}_{index + 1}",
        "file_name": file_name,
        "mime_type": mime_type or "application/octet-stream",
        "file_kind": entry.get("file_kind") or "attachment",
        "source_format": source_format,
        "size_bytes": entry.get("size_bytes"),
        "storage_key": entry.get("storage_key"),
        "url": entry.get("url"),
        "processing_status": entry.get("processing_status", "uploaded"),
        "processing_pipeline": entry.get("processing_pipeline") or infer_pipeline(source_format),
        "last_error": entry.get("last_error"),
    }


def product_key(import_id: str, product: dict) -> str:
    return product.get("product_id") or product.get("temp_id") or f"{import_id}_row_{product['row_index']}"


def map_row_to_product(import_id: str, row: dict, index: int) -> dict:
    purchase_price = row.get("purchase_price")
    raw_name = row.get("raw_name") or row.get("name") or f"Позиция {index + 1}"
    return {
        "row_index": int(row.get("row_index", index + 1)),
        "product_id": row.get("product_id"),
        "temp_id": row.get("temp_id") or row.get("id") or f"tmp_{slugify(raw_name)}_{index + 1}",
        "raw_name": raw_name,
        "normalized_name": row.get("normalized_name"),
        "category": row.get("category"),
        "country": row.get("country"),
        "volume_l": row.get("volume_l"),
        "purchase_price": purchase_price,
        "rrc_min": row.get("rrc_min") or row.get("sale_price"),
        "promo": bool(row.get("promo", False)),
        "ids": row.get("ids") or {},
    }


def map_issue(kind: str, issue: dict, index: int) -> dict:
    return {
        "row_index": int(issue.get("row_index", index + 1)),
        "field": issue.get("field") or "raw_value",
        "message": issue.get("message") or "Требует проверки",
        "raw_value": issue.get("raw_value"),
        "source": issue.get("source", "n8n"),
        "kind": kind,
    }


def build_catalog(products: list[dict]) -> list[dict]:
    catalog = {}
    for product in products:
        key = (product.get("normalized_name") or product.get("raw_name") or "").strip().lower()
        if not key:
            continue
        bucket = catalog.setdefault(
            key,
            {
                "catalog_id": f"cat_{len(catalog) + 1:03d}",
                "title": product.get("normalized_name") or product.get("raw_name"),
                "category": product.get("category"),
                "countries": set(),
                "supplier_names": set(),
                "variants": 0,
                "price_min": None,
                "price_max": None,
            },
        )
        bucket["countries"].add(product.get("country") or "—")
        bucket["supplier_names"].add(product.get("supplier_name") or "—")
        bucket["variants"] += 1
        price = product.get("purchase_price")
        if isinstance(price, (int, float)):
            bucket["price_min"] = price if bucket["price_min"] is None else min(bucket["price_min"], price)
            bucket["price_max"] = price if bucket["price_max"] is None else max(bucket["price_max"], price)

    response = []
    for item in catalog.values():
        response.append({
            **item,
            "countries": sorted(item["countries"]),
            "supplier_names": sorted(item["supplier_names"]),
        })
    return sorted(response, key=lambda row: (-row["variants"], row["title"]))


class MockApiHandler(BaseHTTPRequestHandler):
    data_cache = load_demo_data()
    quote_draft = None
    review_rows = {}
    import_processing = {
        item["id"]: {
            "import_id": item["id"],
            "status": item.get("status", "uploaded"),
            "files": [
                {
                    "id": f"{item['id']}:source",
                    "file_name": item["meta"]["source_file"],
                    "file_kind": "price",
                    "mime_type": "application/octet-stream",
                    "source_format": item["meta"]["source_format"],
                    "processing_status": item.get("status", "uploaded"),
                    "processing_pipeline": infer_pipeline(item["meta"]["source_format"]),
                },
                *[
                    normalize_attachment(attachment, index)
                    for index, attachment in enumerate(item["meta"].get("attachments", []))
                ],
            ],
            "processing_started_at": None,
            "processing_finished_at": None,
            "last_webhook_at": item["meta"].get("import_date"),
            "job_id": None,
            "error": None,
        }
        for item in data_cache["imports"]
    }
    jobs = [
        {"id": "job_parse_imp_001", "type": "parse", "status": "done", "target": "imp_001", "updated_at": "2026-04-04T12:10:00Z"},
        {"id": "job_normalize_imp_001", "type": "normalize", "status": "queued", "target": "imp_001", "updated_at": "2026-04-04T12:12:00Z"},
        {"id": "job_export_quote_demo", "type": "export_quote", "status": "idle", "target": "quote_draft", "updated_at": "2026-04-04T12:12:00Z"},
    ]

    def log_message(self, fmt: str, *args) -> None:
        print(f"[mock-api] {self.address_string()} - {fmt % args}")

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

        if route == "/health":
            return self.respond_json({"status": "ok", "service": "bakhus-mock-api"})
        if route == "/api/health":
            return self.respond_json({"status": "ok", "service": "bakhus-mock-api"})
        if route == "/api/imports":
            return self.respond_json({"items": self.data_cache["imports"]})
        if route.startswith("/api/imports/") and route.endswith("/status"):
            import_id = route.split("/")[3]
            return self.get_import_status(import_id)
        if route == "/api/bootstrap":
            return self.respond_json(self.build_bootstrap_payload())
        if route == "/api/suppliers":
            return self.respond_json({"items": self.data_cache["suppliers"]})
        if route == "/api/products":
            return self.respond_json({"items": self.filter_products(query)})
        if route == "/api/jobs":
            return self.respond_json({"items": self.jobs})
        if route == "/api/catalog":
            return self.respond_json({"items": self.filter_catalog(query)})
        if route == "/api/state":
            return self.respond_json(self.build_state_payload())
        if route == "/api/quote-draft":
            return self.respond_json(self.build_quote_draft())

        return self.respond_json({"error": "Not found", "path": route}, status=HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/imports":
            return self.create_import()
        if parsed.path.startswith("/api/imports/") and parsed.path.endswith("/dispatch"):
            import_id = parsed.path.split("/")[3]
            return self.dispatch_import(import_id)
        if parsed.path == "/api/webhooks/n8n/import-result":
            return self.handle_import_result()
        if parsed.path == "/api/webhooks/n8n/import-failed":
            return self.handle_import_failed()
        if parsed.path == "/api/quote-draft":
            return self.save_quote_draft()
        if parsed.path == "/api/jobs/trigger":
            return self.trigger_job()
        if parsed.path == "/api/review/rows":
            return self.update_review_rows()
        if parsed.path == "/api/review/normalize":
            return self.save_manual_normalization()
        if parsed.path == "/api/review/match":
            return self.save_manual_match()
        return self.respond_json({"error": "Not found", "path": parsed.path}, status=HTTPStatus.NOT_FOUND)

    def filter_products(self, query: dict) -> list[dict]:
        items = [self.merge_review_fields(item) for item in self.data_cache["products"]]
        import_id = query.get("import_id", [None])[0]
        q = (query.get("q", [""])[0] or "").strip().lower()

        if import_id:
            items = [item for item in items if item["import_id"] == import_id]
        if q:
            items = [item for item in items if q in json.dumps(item, ensure_ascii=False).lower()]
        return items

    def product_review_key(self, import_id: str, row_index: int) -> str:
        return f"{import_id}:{row_index}"

    def merge_review_fields(self, product: dict) -> dict:
        key = self.product_review_key(product["import_id"], product["row_index"])
        review = self.review_rows.get(key, {})
        return {**product, **review}

    def filter_catalog(self, query: dict) -> list[dict]:
        items = list(self.data_cache["catalog_matches"])
        q = (query.get("q", [""])[0] or "").strip().lower()
        if q:
            items = [item for item in items if q in json.dumps(item, ensure_ascii=False).lower()]
        return items

    def build_state_payload(self) -> dict:
        imports = self.data_cache["imports"]
        return {
            "summary": {
                "imports": len(imports),
                "suppliers": len(self.data_cache["suppliers"]),
                "products": len(self.data_cache["products"]),
                "catalog_matches": len(self.data_cache["catalog_matches"]),
            },
            "features": {
                "manual_normalization": "planned",
                "catalog_matching": "planned",
                "n8n_processing": "planned",
                "quote_export": "planned",
            },
        }

    def build_bootstrap_payload(self) -> dict:
        return {
            "items": {
                "imports": self.data_cache["imports"],
                "suppliers": self.data_cache["suppliers"],
            },
            "runtime": {
                "data_source": "local-backend",
                "version": 2,
            },
        }

    def build_quote_draft(self) -> dict:
        if self.quote_draft is not None:
            return self.quote_draft
        products = self.data_cache["products"][:4]
        return {
            "meta": {
                "client_id": "cl_001",
                "client_name": "ООО Демо клиент",
                "quote_number": "KP-DEMO-001",
                "currency": "RUB",
                "mode": "internal",
            },
            "items": [
                {
                    "name": item["raw_name"],
                    "purchase_price": item.get("purchase_price"),
                    "sale_price": item.get("rrc_min") or item.get("purchase_price"),
                    "qty": 1,
                    "supplier_name": item["supplier_name"],
                }
                for item in products
            ],
            "saved_at": None,
        }

    def find_import(self, import_id: str) -> dict | None:
        return next((item for item in self.data_cache["imports"] if item["id"] == import_id), None)

    def get_import_status(self, import_id: str) -> None:
        item = self.find_import(import_id)
        if item is None:
            return self.respond_json({"error": "Import not found", "import_id": import_id}, status=HTTPStatus.NOT_FOUND)

        status = self.import_processing.get(import_id, {
            "import_id": import_id,
            "status": item.get("status", "uploaded"),
            "files": [],
            "processing_started_at": None,
            "processing_finished_at": None,
            "last_webhook_at": None,
            "job_id": None,
            "error": None,
        })
        return self.respond_json({"item": status})

    def rebuild_data_cache(self) -> None:
        MockApiHandler.data_cache = rebuild_cache_from_imports(self.data_cache["imports"])

    def create_import(self) -> None:
        payload = self.read_json_body()
        files = payload.get("files") or []
        if not files:
            return self.respond_json({"error": "files is required"}, status=HTTPStatus.BAD_REQUEST)

        main_file = files[0]
        source_file = main_file.get("file_name") or main_file.get("name") or "Новый импорт"
        source_format = map_source_format(source_file, main_file.get("mime_type"))
        import_id = f"imp_{len(self.data_cache['imports']) + 1:03d}"
        supplier_id = payload.get("supplier_id") or f"sup_{slugify(payload.get('supplier_name') or 'new')}"
        supplier_name = payload.get("supplier_name") or "Новый поставщик"
        created_at = payload.get("import_date") or datetime.utcnow().date().isoformat()
        attachments = [
            normalize_attachment(item, index)
            for index, item in enumerate(payload.get("attachments") or files[1:])
        ]

        import_item = {
            "id": import_id,
            "meta": {
                "source_file": source_file,
                "source_format": source_format,
                "import_date": created_at,
                "currency": payload.get("currency", "RUB"),
                "document_type": infer_document_type(source_format, payload.get("document_type")),
                "period": payload.get("period"),
                "sheet_name": payload.get("sheet_name"),
                "attachments": attachments,
                "manager_note": payload.get("manager_note", ""),
                "request_ref": payload.get("request_ref"),
                "request_title": payload.get("request_title"),
            },
            "supplier": {
                "id": supplier_id,
                "name": supplier_name,
                "contract_type": payload.get("contract_type") or infer_document_type(source_format, payload.get("document_type")),
                "vat_included": bool(payload.get("vat_included", True)),
            },
            "created_by": payload.get("created_by", "manager@bakhus"),
            "source": payload.get("source", "Web-интерфейс"),
            "owner": payload.get("owner", "manager@bakhus"),
            "status": "uploaded",
            "errors": [],
            "warnings": [],
            "products": [],
        }

        self.data_cache["imports"].insert(0, import_item)
        self.rebuild_data_cache()
        MockApiHandler.import_processing[import_id] = {
            "import_id": import_id,
            "status": "uploaded",
            "files": [
                {
                    "id": f"{import_id}:source",
                    "file_name": source_file,
                    "file_kind": main_file.get("file_kind", "price"),
                    "mime_type": main_file.get("mime_type", "application/octet-stream"),
                    "source_format": source_format,
                    "processing_status": "uploaded",
                    "processing_pipeline": infer_pipeline(source_format),
                },
                *attachments,
            ],
            "processing_started_at": None,
            "processing_finished_at": None,
            "last_webhook_at": None,
            "job_id": None,
            "error": None,
        }
        return self.respond_json(
            {
                "item": import_item,
                "status": MockApiHandler.import_processing[import_id],
            },
            status=HTTPStatus.CREATED,
        )

    def dispatch_import(self, import_id: str) -> None:
        item = self.find_import(import_id)
        if item is None:
            return self.respond_json({"error": "Import not found", "import_id": import_id}, status=HTTPStatus.NOT_FOUND)

        status = MockApiHandler.import_processing.setdefault(import_id, {
            "import_id": import_id,
            "status": "uploaded",
            "files": [],
            "processing_started_at": None,
            "processing_finished_at": None,
            "last_webhook_at": None,
            "job_id": None,
            "error": None,
        })
        payload = self.read_json_body()
        job_id = payload.get("job_id") or f"job_import_parse_{import_id}_{len(self.jobs) + 1}"
        status["status"] = "queued"
        status["processing_started_at"] = now_iso()
        status["processing_finished_at"] = None
        status["job_id"] = job_id
        status["error"] = None
        for file_item in status["files"]:
            if file_item.get("file_kind") == "price":
                file_item["processing_status"] = "queued"

        item["status"] = "queued"
        job = {
            "id": job_id,
            "type": "import_parse",
            "status": "queued",
            "target": import_id,
            "updated_at": now_iso(),
        }
        self.jobs.insert(0, job)
        public_api_base = os.getenv("PUBLIC_API_BASE_URL", DEFAULT_PUBLIC_API_BASE).rstrip("/")
        price_file = next((file_item for file_item in status["files"] if file_item.get("file_kind") == "price"), None)
        requested_pipeline = price_file.get("processing_pipeline") if price_file else None
        dispatch_payload = {
            "job_id": job_id,
            "import_batch_id": import_id,
            "import_file_id": price_file.get("id") if price_file else None,
            "file_kind": price_file.get("file_kind") if price_file else "price",
            "mime_type": price_file.get("mime_type") if price_file else None,
            "source_file": item["meta"].get("source_file"),
            "source_format": item["meta"].get("source_format"),
            "requested_pipeline": requested_pipeline,
            "callbacks": {
                "success_url": f"{public_api_base}/webhooks/n8n/import-result",
                "failed_url": f"{public_api_base}/webhooks/n8n/import-failed",
            },
            "meta": {
                "supplier_id": item["supplier"]["id"],
                "supplier_name": item["supplier"]["name"],
                "document_type": item["meta"].get("document_type"),
                "currency": item["meta"].get("currency"),
                "request_ref": item["meta"].get("request_ref"),
                "request_title": item["meta"].get("request_title"),
            },
        }
        if price_file:
            price_file["mime_type"] = price_file.get("mime_type") or "application/octet-stream"
        return self.respond_json(
            {"item": job, "status": status, "dispatch_payload": dispatch_payload},
            status=HTTPStatus.CREATED,
        )

    def handle_import_result(self) -> None:
        payload = self.read_json_body()
        import_id = payload.get("import_batch_id") or payload.get("import_id")
        item = self.find_import(import_id)
        if item is None:
            return self.respond_json({"error": "Import not found", "import_id": import_id}, status=HTTPStatus.NOT_FOUND)

        status = MockApiHandler.import_processing.setdefault(import_id, {
            "import_id": import_id,
            "status": "uploaded",
            "files": [],
            "processing_started_at": None,
            "processing_finished_at": None,
            "last_webhook_at": None,
            "job_id": None,
            "error": None,
        })
        processing_status = payload.get("status", "parsed")
        meta = payload.get("meta") or {}
        rows = payload.get("rows") or []
        issues = payload.get("issues") or []

        if rows:
            item["products"] = [map_row_to_product(import_id, row, index) for index, row in enumerate(rows)]

        item["errors"] = [map_issue("errors", issue, index) for index, issue in enumerate(issues) if issue.get("severity") == "error"]
        item["warnings"] = [map_issue("warnings", issue, index) for index, issue in enumerate(issues) if issue.get("severity") != "error"]
        item["status"] = processing_status
        item["meta"]["sheet_name"] = meta.get("sheet_name", item["meta"].get("sheet_name"))
        item["meta"]["currency"] = meta.get("currency", item["meta"].get("currency"))
        item["meta"]["period"] = meta.get("period", item["meta"].get("period"))
        item["meta"]["parse_result"] = payload.get("parse_result")

        status["status"] = processing_status
        status["processing_finished_at"] = now_iso()
        status["last_webhook_at"] = now_iso()
        status["error"] = None
        status["job_id"] = payload.get("job_id") or status.get("job_id")
        for file_item in status["files"]:
            if file_item.get("file_kind") == "price":
                file_item["processing_status"] = processing_status
                file_item["processing_pipeline"] = payload.get("pipeline") or file_item.get("processing_pipeline")
        if payload.get("job_id"):
            self.touch_job(payload["job_id"], "done")

        self.rebuild_data_cache()
        return self.respond_json({"item": item, "status": status})

    def handle_import_failed(self) -> None:
        payload = self.read_json_body()
        import_id = payload.get("import_batch_id") or payload.get("import_id")
        item = self.find_import(import_id)
        if item is None:
            return self.respond_json({"error": "Import not found", "import_id": import_id}, status=HTTPStatus.NOT_FOUND)

        status = MockApiHandler.import_processing.setdefault(import_id, {
            "import_id": import_id,
            "status": "uploaded",
            "files": [],
            "processing_started_at": None,
            "processing_finished_at": None,
            "last_webhook_at": None,
            "job_id": None,
            "error": None,
        })
        error_text = payload.get("error") or payload.get("message") or "Обработка завершилась с ошибкой"
        item["status"] = "failed"
        item["errors"] = [
            *item.get("errors", []),
            {"row_index": 0, "field": "import", "message": error_text, "raw_value": None, "source": "n8n", "kind": "errors"},
        ]
        status["status"] = "failed"
        status["processing_finished_at"] = now_iso()
        status["last_webhook_at"] = now_iso()
        status["error"] = error_text
        status["job_id"] = payload.get("job_id") or status.get("job_id")
        for file_item in status["files"]:
            if file_item.get("file_kind") == "price":
                file_item["processing_status"] = "failed"
                file_item["last_error"] = error_text
        if payload.get("job_id"):
            self.touch_job(payload["job_id"], "failed")

        self.rebuild_data_cache()
        return self.respond_json({"item": item, "status": status})

    def save_quote_draft(self) -> None:
        payload = self.read_json_body()
        payload["saved_at"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
        MockApiHandler.quote_draft = payload
        self.respond_json(payload, status=HTTPStatus.CREATED)

    def update_review_rows(self) -> None:
        payload = self.read_json_body()
        updated = []
        for row in payload.get("updates", []):
          key = self.product_review_key(row["import_id"], int(row["row_index"]))
          self.review_rows[key] = {
              **self.review_rows.get(key, {}),
              "review_status": row.get("review_status", self.review_rows.get(key, {}).get("review_status", "pending")),
              "excluded": bool(row.get("excluded", False)),
          }
          updated.append({"key": key, **self.review_rows[key]})
        self.touch_job("job_normalize_imp_001", "queued")
        self.respond_json({"items": updated}, status=HTTPStatus.CREATED)

    def save_manual_normalization(self) -> None:
        payload = self.read_json_body()
        key = self.product_review_key(payload["import_id"], int(payload["row_index"]))
        self.review_rows[key] = {
            **self.review_rows.get(key, {}),
            "manual_normalized_name": payload.get("manual_normalized_name"),
            "normalization_note": payload.get("normalization_note", ""),
            "review_status": "checked",
        }
        self.touch_job("job_normalize_imp_001", "done")
        self.respond_json({"item": {"key": key, **self.review_rows[key]}}, status=HTTPStatus.CREATED)

    def save_manual_match(self) -> None:
        payload = self.read_json_body()
        key = self.product_review_key(payload["import_id"], int(payload["row_index"]))
        match_id = payload.get("manual_match_id")
        match_result = next((item for item in self.data_cache["catalog_matches"] if item["catalog_id"] == match_id), None)
        self.review_rows[key] = {
            **self.review_rows.get(key, {}),
            "manual_match_id": match_id,
            "manual_match_result": match_result,
            "review_status": self.review_rows.get(key, {}).get("review_status", "checked"),
        }
        self.touch_job("job_export_quote_demo", "queued")
        self.respond_json({"item": {"key": key, **self.review_rows[key]}}, status=HTTPStatus.CREATED)

    def trigger_job(self) -> None:
        payload = self.read_json_body()
        job_type = payload.get("type", "unknown")
        target = payload.get("target", "workspace")
        job_id = f"job_{job_type}_{target}_{len(self.jobs) + 1}"
        item = {
            "id": job_id,
            "type": job_type,
            "status": "queued",
            "target": target,
            "updated_at": datetime.utcnow().isoformat(timespec="seconds") + "Z",
        }
        self.jobs.insert(0, item)
        self.respond_json({"item": item}, status=HTTPStatus.CREATED)

    def touch_job(self, job_id: str, status: str) -> None:
        for job in self.jobs:
            if job["id"] == job_id:
                job["status"] = status
                job["updated_at"] = datetime.utcnow().isoformat(timespec="seconds") + "Z"
                return

    def read_json_body(self) -> dict:
        content_length = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(content_length) if content_length else b"{}"
        return json.loads(raw.decode("utf-8"))

    def respond_json(self, payload: dict, status: HTTPStatus = HTTPStatus.OK) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), MockApiHandler)
    print(f"Bakhus mock API running at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down mock API")


if __name__ == "__main__":
    main()
