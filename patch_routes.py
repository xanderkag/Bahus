import re

with open("scripts/postgres_api.py", "r") as f:
    text = f.read()

# Add to _do_POST_internal
post_routes = """
        if route == "/api/webhooks/n8n/quote-result":
            return self.handle_n8n_quote_result()
        if route == "/api/webhooks/n8n/quote-failed":
            return self.handle_n8n_quote_failed()
        if route == "/api/proxy/n8n":
"""
text = text.replace('        if route == "/api/proxy/n8n":', post_routes)

# Define quote callbacks
quote_methods = """
    def handle_n8n_quote_result(self) -> None:
        payload = self.read_json_body()
        quote_id = payload.get("quote_id") or payload.get("import_id")
        if not quote_id:
            return self.respond_json({"error": "quote_id is required"}, status=HTTPStatus.BAD_REQUEST)

        with self.db() as conn:
            # We don't necessarily need to require an import batch since it's a quote
            # Update job run if job_id is present
            if payload.get("job_id"):
                conn.execute(
                    \"\"\"
                    update job_run
                    set
                      status = 'done',
                      finished_at = now(),
                      result = %s::jsonb,
                      updated_at = now()
                    where id = %s
                    \"\"\",
                    (json.dumps(payload, ensure_ascii=False, default=json_default), payload["job_id"]),
                )
        return self.respond_json({"item": {"quote_id": quote_id, "status": "processed"}})

    def handle_n8n_quote_failed(self) -> None:
        payload = self.read_json_body()
        quote_id = payload.get("quote_id") or payload.get("import_id")
        if not quote_id:
            return self.respond_json({"error": "quote_id is required"}, status=HTTPStatus.BAD_REQUEST)
            
        with self.db() as conn:
            if payload.get("job_id"):
                conn.execute(
                    \"\"\"
                    update job_run
                    set
                      status = 'failed',
                      finished_at = now(),
                      result = %s::jsonb,
                      updated_at = now()
                    where id = %s
                    \"\"\",
                    (json.dumps(payload, ensure_ascii=False, default=json_default), payload["job_id"]),
                )
        return self.respond_json({"item": {"quote_id": quote_id, "status": "failed"}})

    def handle_proxy_n8n(self) -> None:
"""
text = text.replace('    def handle_proxy_n8n(self) -> None:', quote_methods)

with open("scripts/postgres_api.py", "w") as f:
    f.write(text)
