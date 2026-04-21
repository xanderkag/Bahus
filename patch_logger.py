import re
with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'r') as f:
    text = f.read()

patch = '''
        file_info = dispatch_payload.get("file_binary")

        n8n_logger.info(
            f"[N8N] DISPATCH → url={self.config.n8n_webhook_url} "
            f"correlation_id={correlation_id} job_id={job_id} "
            f"target={import_id} pipeline={pipeline} file={source_file} "
            f"file_info={file_info} exists={os.path.exists(file_info['path']) if file_info and file_info.get('path') else False}"
        )
'''
text = re.sub(r'        file_info = dispatch_payload\.get\("file_binary"\)\n\n        n8n_logger\.info\([^)]+\)', patch.strip(), text, count=1, flags=re.DOTALL)

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'w') as f:
    f.write(text)
