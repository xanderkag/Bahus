import re
with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'r') as f:
    text = f.read()

patch = '''
        if route == "/api/debug/test":
            try:
                pf = PROJECT_ROOT / ".local" / "logs" / "n8n.log"
                log_content = pf.read_text()[-4000:] if pf.exists() else "NOT FOUND"
                return self.respond_json({"logs": log_content})
            except Exception as e:
                import traceback
                return self.respond_json({"error": str(e), "trace": traceback.format_exc()})
'''
text = re.sub(r'        if route == "/api/debug/test":.*?            except Exception as e:\n                import traceback\n                return self\.respond_json\(\{"error": str\(e\), "trace": traceback\.format_exc\(\)\}\)', patch.lstrip('\n'), text, flags=re.DOTALL)

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'w') as f:
    f.write(text)
