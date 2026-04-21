import re
with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'r') as f:
    text = f.read()

patch = '''
def main() -> None:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), PostgresApiHandler)
    logger.info(f"bahus PostgreSQL API running at http://{args.host}:{args.port}")
    
    # Run inline migration
    try:
        import psycopg
        with psycopg.connect(PostgresApiHandler.config.db_url) as conn:
            conn.execute("ALTER TABLE import_file ADD COLUMN IF NOT EXISTS file_bytes BYTEA;")
            conn.execute("ALTER TABLE import_file ADD COLUMN IF NOT EXISTS cleanup_done BOOLEAN DEFAULT FALSE;")
            conn.commit()
            logger.info("Database schema check passed (file_bytes added).")
    except Exception as e:
        logger.error(f"Failed to run schema migration: {e}")

    # Start the background cleanup thread
'''
text = re.sub(r'def main\(\) -> None:.*?# Start the background cleanup thread', patch.lstrip('\n'), text, flags=re.DOTALL)

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'w') as f:
    f.write(text)
