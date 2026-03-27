#!/usr/bin/env python3
"""
Fix production database migration - execute SQL to remove stuck migration record
"""
import psycopg2
import sys

# Database connection parameters
DB_HOST = "kindswap-prod.cov8e4myuic2.us-east-1.rds.amazonaws.com"
DB_USER = "kindswap_admin"
DB_PASSWORD = "KindSwapProd2026SecurePass32Chr"
DB_NAME = "kindswap_production"
DB_PORT = 5432

try:
    print(f"Connecting to {DB_HOST}:{DB_PORT}/{DB_NAME} as {DB_USER}...")
    conn = psycopg2.connect(
        host=DB_HOST,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        port=DB_PORT,
        connect_timeout=10
    )
    
    cursor = conn.cursor()
    print("✅ Connected successfully!")
    
    print("\n1. Deleting failed migration record...")
    cursor.execute("""
        DELETE FROM typeorm_metadata 
        WHERE name = 'ChangeAdminPermissionsToArray1739356400000';
    """)
    deleted = cursor.rowcount
    print(f"   Deleted {deleted} row(s)")
    
    print("\n2. Dropping DEFAULT constraint from permissions column...")
    cursor.execute("""
        ALTER TABLE admins ALTER COLUMN permissions DROP DEFAULT;
    """)
    print("   ✅ DEFAULT dropped")
    
    print("\n3. Verifying the fix...")
    cursor.execute("""
        SELECT column_name, column_default, data_type
        FROM information_schema.columns
        WHERE table_name = 'admins'
        AND column_name = 'permissions';
    """)
    result = cursor.fetchone()
    if result:
        col_name, col_default, data_type = result
        print(f"   Column: {col_name}")
        print(f"   Data type: {data_type}")
        print(f"   Default: {col_default if col_default else 'NULL (no default set)'}")
        if not col_default:
            print("   ✅ SUCCESS - DEFAULT is now NULL")
        else:
            print(f"   ⚠️  WARNING - DEFAULT is still set to: {col_default}")
    
    conn.commit()
    print("\n✅ All fixes applied successfully!")
    cursor.close()
    conn.close()
    sys.exit(0)
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    sys.exit(1)
