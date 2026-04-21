import re
with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'r') as f:
    text = f.read()

patch = '''
        if route == "/api/debug/test":
            try:
                import os
                files_found = os.listdir(UPLOADS_DIR) if UPLOADS_DIR.exists() else []
                return self.respond_json({"uploads_dir": str(UPLOADS_DIR), "files": files_found})
            except Exception as e:
                return self.respond_json({"error": str(e)})

        if route == "/api/webhooks/n8n/import-result":
'''
text = re.sub(r'        if route == "/api/webhooks/n8n/import-result":', patch.lstrip('\n'), text)

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'w') as f:
    f.write(text)
