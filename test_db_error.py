import psycopg2

conn = psycopg2.connect("postgresql://bakhus:bakhus@111.88.144.93:5432/bakhus")
try:
    print("Testing UUID syntax error...")
    conn.cursor().execute("select * from job_run where id = 'ob_123'")
except Exception as e:
    print(f"Exception caught: {type(e)}")
    print(e)
