import psycopg2

conn = psycopg2.connect(
    host="kindswap-prod.cov8e4myuic2.us-east-1.rds.amazonaws.com",
    port=5432,
    database="kindswap_production",
    user="kindswap_admin",
    password="KindSwapProd2026SecurePass32Chr",
    connect_timeout=10
)
conn.autocommit = False
cur = conn.cursor()
print("Connected")

cur.execute("DELETE FROM typeorm_metadata WHERE name = 'ChangeAdminPermissionsToArray1739356400000'")
print(f"Deleted {cur.rowcount} row(s)")

cur.execute("ALTER TABLE admins ALTER COLUMN permissions DROP DEFAULT")
print("Dropped DEFAULT")

conn.commit()
print("Committed")

cur.execute("SELECT column_default FROM information_schema.columns WHERE table_name='admins' AND column_name='permissions'")
print(f"column_default is now: {cur.fetchone()[0]}")

cur.close()
conn.close()
print("Done")
