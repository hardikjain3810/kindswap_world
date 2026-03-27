import psycopg2

conn = psycopg2.connect(
    host='kindswap-prod.cov8e4myuic2.us-east-1.rds.amazonaws.com',
    port=5432,
    database='kindswap_production',
    user='kindswap_admin',
    password='KindSwapProd2026SecurePass32Chr',
    connect_timeout=10
)
conn.autocommit = False
cur = conn.cursor()

print('✅ Connected to production database')

cur.execute("""DELETE FROM typeorm_metadata
WHERE name = 'ChangeAdminPermissionsToArray1739356400000'""")
print(f'✅ Deleted {cur.rowcount} migration record(s)')

cur.execute('ALTER TABLE admins ALTER COLUMN permissions DROP DEFAULT')
print('✅ Dropped DEFAULT from permissions column')

conn.commit()
print('✅ Transaction committed successfully')

cur.execute("""SELECT column_name, column_default, data_type
FROM information_schema.columns
WHERE table_name = 'admins' AND column_name = 'permissions'""")
row = cur.fetchone()
print(f'✅ Verification - column: {row[0]}, default: {row[1]}, type: {row[2]}')

cur.close()
conn.close()
print('✅ Done. Database fix complete.')
