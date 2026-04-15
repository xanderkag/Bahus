with open("scripts/postgres_api.py", "r") as f:
    text = f.read()

text = text.replace('quote_id = payload.get("quote_id") or payload.get("import_id")', 'quote_id = payload.get("quote_id") or payload.get("import_id") or payload.get("import_batch_id")')

with open("scripts/postgres_api.py", "w") as f:
    f.write(text)
