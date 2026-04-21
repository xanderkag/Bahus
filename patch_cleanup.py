import re
with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'r') as f:
    text = f.read()

patch = '''
def cleanup_worker():
    """Background thread to delete files in UPLOADS_DIR and Postgres bytea older than 7 days."""
    logger.info("Cleanup thread started.")
    while True:
        try:
            now = time.time()
            cutoff = now - (7 * 24 * 3600)  # 7 days
            deleted_count = 0
            if UPLOADS_DIR.exists():
                for f in UPLOADS_DIR.iterdir():
                    if f.is_file():
                        try:
                            if f.stat().st_mtime < cutoff:
                                f.unlink()
                                deleted_count += 1
                        except Exception as e:
                            logger.error(f"Failed to delete old file {f}: {e}")
            
            # Also clean up Postgres file_bytes
            import psycopg
            try:
                with psycopg.connect(PostgresApiHandler.config.db_url) as conn:
                    # Clear out bytes for old files to reclaim space
                    res = conn.execute("UPDATE import_file SET file_bytes = NULL, cleanup_done = TRUE WHERE uploaded_at < NOW() - INTERVAL '7 days' AND cleanup_done = FALSE")
                    if res.rowcount > 0:
                        logger.info(f"Cleanup thread: cleared file_bytes for {res.rowcount} old DB records.")
                    conn.commit()
            except Exception as db_e:
                logger.error(f"Failed to clean up db file_bytes: {db_e}")

            if deleted_count > 0:
'''
text = re.sub(r'def cleanup_worker\(\):.*?            if deleted_count > 0:', patch.lstrip('\n'), text, flags=re.DOTALL)

with open('/Users/alexanderliapustin/Desktop/Bahus/scripts/postgres_api.py', 'w') as f:
    f.write(text)
