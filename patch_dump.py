import re
with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'r') as f:
    text = f.read()

patch = '''
        if route == "/api/debug/logs":
            try:
                import os
                files_found = os.listdir(UPLOADS_DIR) if UPLOADS_DIR.exists() else []
                with self.db() as conn:
                    rows = conn.execute("select id, original_name, storage_path, file_kind from import_file order by uploaded_at desc limit 2").fetchall()
                    db_files = [dict(r) for r in rows]
                
                log_content = ""
                pf = PROJECT_ROOT / "n8n_dispatch.log"
                if pf.exists():
                    log_content = pf.read_text()[-2000:]
                return self.respond_json({"uploads_dir": str(UPLOADS_DIR), "files": files_found, "db": db_files, "logs": log_content})
            except Exception as e:
                import traceback
                return self.respond_json({"error": str(e), "trace": traceback.format_exc()})
'''
text = re.sub(r'        if route == "/api/debug/logs":.*?            except Exception as e:\n                import traceback\n                return self\.respond_json\(\{"error": str\(e\), "trace": traceback\.format_exc\(\)\}\)', patch.lstrip('\n'), text, flags=re.DOTALL)

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'w') as f:
    f.write(text)
