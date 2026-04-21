import re
with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'r') as f:
    text = f.read()

patch = '''
        if route == "/api/debug/test":
            try:
                import os
                with self.db() as conn:
                    rows = conn.execute("select id, original_name, size_bytes, storage_path from import_file order by uploaded_at desc limit 2").fetchall()
                    db_files = [dict(r) for r in rows]
                
                return self.respond_json({"db": db_files})
            except Exception as e:
                import traceback
                return self.respond_json({"error": str(e), "trace": traceback.format_exc()})
'''
text = re.sub(r'        if route == "/api/debug/logs":.*?            except Exception as e:\n                import traceback\n                return self\.respond_json\(\{"error": str\(e\), "trace": traceback\.format_exc\(\)\}\)', patch.lstrip('\n'), text, flags=re.DOTALL)

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'w') as f:
    f.write(text)
