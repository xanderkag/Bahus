import requests
import json
import re

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'r') as f:
    text = f.read()

patch = '''
        if route == "/api/debug/test":
            try:
                import psycopg
                log = []
                with self.db() as conn:
                    try:
                        conn.execute("ALTER TABLE import_file ADD COLUMN IF NOT EXISTS file_bytes BYTEA;")
                        conn.execute("ALTER TABLE import_file ADD COLUMN IF NOT EXISTS cleanup_done BOOLEAN DEFAULT FALSE;")
                        conn.commit()
                        log.append("Migration successful")
                    except Exception as e:
                        log.append(f"Migration error: {e}")
                
                    col = conn.execute("SELECT column_name FROM information_schema.columns WHERE table_name='import_file' AND column_name='file_bytes'").fetchone()
                    rows = []
                    if col:
                        rows = conn.execute("SELECT id, original_name, size_bytes, length(file_bytes) as bytes_len FROM import_file ORDER BY uploaded_at DESC LIMIT 3").fetchall()
                    
                return self.respond_json({"log": log, "column_exists": bool(col), "files": [dict(r) for r in rows]})
            except Exception as e:
                import traceback
                return self.respond_json({"error": str(e), "trace": traceback.format_exc()})
'''
text = re.sub(r'        if route == "/api/debug/test":.*?            except Exception as e:\n                import traceback\n                return self\.respond_json\(\{"error": str\(e\), "trace": traceback\.format_exc\(\)\}\)', patch.lstrip('\n'), text, flags=re.DOTALL)

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'w') as f:
    f.write(text)

