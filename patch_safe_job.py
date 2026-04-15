import re
with open("scripts/postgres_api.py", "r") as f:
    text = f.read()

# Replace condition to ensure only UUIDs go to the DB
text = text.replace('if payload.get("job_id"):', 'if payload.get("job_id") and len(str(payload.get("job_id"))) == 36 and "-" in str(payload.get("job_id")):')

with open("scripts/postgres_api.py", "w") as f:
    f.write(text)
