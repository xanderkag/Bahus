import re
with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'r') as f:
    text = f.read()

patch = '''
# Create a dedicated logger for n8n actions
n8n_logger = logging.getLogger("bahus.n8n")
n8n_logger.setLevel(logging.INFO)
file_handler = logging.FileHandler(PROJECT_ROOT / "n8n_dispatch.log")
file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
n8n_logger.addHandler(file_handler)
'''
text = re.sub(r'# Create a dedicated logger for n8n actions\nn8n_logger = logging\.getLogger\("bahus\.n8n"\)\nn8n_logger\.setLevel\(logging\.INFO\)', patch.strip('\n'), text, flags=re.DOTALL)

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'w') as f:
    f.write(text)
