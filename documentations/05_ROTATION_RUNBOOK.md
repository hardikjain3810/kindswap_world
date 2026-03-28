# 🔑 CREDENTIAL ROTATION RUNBOOK

**Document Version:** v5  
**Date:** March 28, 2026  
**Emergency Contact:** DevOps On-Call  

---

## 📋 OVERVIEW

**What Rotates:** DB_PASSWORD (production RDS)  
**Frequency:** Every 30 days (automatic)  
**Manual Intervention Needed?** Only if automatic rotation fails  
**Grace Period:** 7 days (old password still works)  
**RTO (if fails):** < 30 minutes (manual override)  

---

## 🔄 AUTOMATIC ROTATION FLOW

### Phase 1: Lambda Trigger

```
Time: Daily at 02:00 UTC (off-peak)
Trigger: EventBridge Rule
Lambda: rotate-db-password (Function)
Status: Check CloudWatch Logs
```

### Phase 2: Generate New Password

```bash
# Lambda generates random 32-char password
# Characters: [A-Za-z0-9!@#$%^&*()_+-=[]{}|;:,.<>?]
# Example: "aB3$xY9@mK2#pL8&qW5!rT1*sJ4-uI7"

# Stored in: AWS Secrets Manager
# Key: kindswap/api/db-password
# Version: AWSPENDING (new, unverified)
```

### Phase 3: Verify on RDS

```bash
# Lambda connects: psql -h RDS -U admin
# Execute: ALTER USER admin PASSWORD 'new_password'
# Test: SELECT 1 (verify connection works)

# On Success: Mark AWSPENDING as verified
# On Failure: Rollback, keep AWSCURRENT
```

### Phase 4: Finalize

```
AWSPENDING → AWSCURRENT (new password active)
AWSCURRENT → AWSPREVIOUS (old password, 7-day grace)
```

### Phase 5: Pod Refresh

```
ExternalSecret watches: Secrets Manager (every 15 min)
Detects: Secret changed
Updates: Kubernetes Secret
Pods: Use new password on next connection
Result: No downtime
```

---

## ✅ VERIFY ROTATION SUCCEEDED

### Check Secrets Manager

```bash
# View rotation status
$ aws secretsmanager describe-secret \
    --secret-id kindswap/api/db-password \
    --region us-east-1

# Output (look for):
# - RotationStatus: "Succeeded" OR "InProgress"
# - LastRotatedDate: 2026-03-28 (today)
# - NextRotationDate: 2026-04-28 (in 30 days)
```

### Check Lambda Logs

```bash
# View Lambda execution
$ aws logs tail /aws/lambda/rotate-db-password --follow

# Expected output:
# [INFO] Starting rotation for kindswap/api/db-password
# [INFO] Generated new password: aB3$xY...
# [INFO] Updated RDS: ALTER USER admin PASSWORD '...'
# [INFO] Verified connection: OK
# [INFO] Marked AWSPENDING as verified
# [INFO] Rotation completed in 45 seconds
```

### Check Pod Connection

```bash
# Exec into pod
$ kubectl exec -it deployment/kindswap-backend -n production -- bash

# Inside pod, test DB connection
$ psql -h $DB_HOST -U admin -d kindswap_prod -c "SELECT 1;"

# Output: 1 (success - pod connected with new password)
```

### Check CloudTrail Logs

```bash
# AWS API calls during rotation
$ aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=ResourceName,AttributeValue=kindswap/api/db-password \
    --region us-east-1

# Look for:
# - UpdateSecret (AWSPENDING created)
# - CreateSecret (if new version)
# - RotateSecret (rotation initiated)
# - DescribeDBInstances (Lambda checked RDS)
```

---

## ⚠️ HANDLE FAILED ROTATION

### Check if Rotation Failed

```bash
# Describe secret
$ aws secretsmanager describe-secret \
    --secret-id kindswap/api/db-password \
    --region us-east-1

# Look for:
# - RotationStatus: "Failed"
# - RotationFailureReason: "Internal error" OR "Lambda execution failed"
# - AWSPENDING: Still exists (old password)
```

### Common Issues & Fixes

#### Issue 1: Lambda Timeout

```bash
# Symptoms:
# - Rotation starts but doesn't complete
# - Error: "Task timed out"

# Fix:
# 1. Increase Lambda timeout
$ aws lambda update-function-configuration \
    --function-name rotate-db-password \
    --timeout 300  # 5 minutes

# 2. Force manual rotation
$ aws secretsmanager rotate-secret \
    --secret-id kindswap/api/db-password \
    --rotate-immediately \
    --region us-east-1

# 3. Monitor again
$ aws logs tail /aws/lambda/rotate-db-password --follow
```

#### Issue 2: Network Error (Lambda Can't Reach RDS)

```bash
# Symptoms:
# - Error: "timeout waiting for connection"
# - Lambda is in different security group

# Fix:
# 1. Check Lambda security group
$ aws lambda get-function-configuration \
    --function-name rotate-db-password \
    --query 'VpcConfig'

# 2. Verify RDS security group allows Lambda's SG
$ aws ec2 describe-security-groups \
    --group-ids sg-rds-security-group \
    --query 'SecurityGroups[0].IpPermissions'

# 3. Add ingress rule if missing
$ aws ec2 authorize-security-group-ingress \
    --group-id sg-rds-security-group \
    --protocol tcp \
    --port 5432 \
    --source-group sg-lambda-security-group
```

#### Issue 3: RDS Rejects Password

```bash
# Symptoms:
# - Error: "invalid password for database"
# - RDS user permissions changed

# Fix:
# 1. Connect to RDS directly (with old password)
$ psql -h kindswap-prod.c*.us-east-1.rds.amazonaws.com \
    -U admin -d kindswap_prod

# 2. Verify user still exists
postgres=# SELECT * FROM pg_user WHERE usename='admin';

# 3. Check permissions
postgres=# SELECT * FROM information_schema.role_table_grants \
           WHERE grantee='admin';

# 4. If user deleted, recreate
postgres=# CREATE USER admin WITH PASSWORD 'temporary_password';
postgres=# GRANT ALL PRIVILEGES ON DATABASE kindswap_prod TO admin;

# 5. Manually rotate password
postgres=# ALTER USER admin PASSWORD 'new_password_xyz';

# 6. Update Secrets Manager
$ aws secretsmanager update-secret \
    --secret-id kindswap/api/db-password \
    --secret-string 'new_password_xyz'
```

---

## 🔧 MANUAL OVERRIDE (If Lambda Failed)

### Step 1: Connect to RDS Directly

```bash
# Get current password from Secrets Manager (if it works)
$ aws secretsmanager get-secret-value \
    --secret-id kindswap/api/db-password \
    --query 'SecretString' \
    --region us-east-1

# Or use temporary password if available
$ psql -h kindswap-prod.cXXXXXX.us-east-1.rds.amazonaws.com \
    -U admin \
    -d kindswap_prod
```

### Step 2: Generate and Set New Password

```bash
# Inside PostgreSQL prompt:
postgres=# ALTER USER admin PASSWORD 'aB3$xY9@mK2#pL8&qW5!rT1*sJ4-uI7';
ALTER ROLE

# Verify:
postgres=# \du admin
                List of roles
 Role name | Attributes | Member of
-----------+------------+-----------
 admin     |            | {}

# Verify connection works with new password
$ psql -h kindswap-prod.cXXXXXX.us-east-1.rds.amazonaws.com \
    -U admin \
    -d kindswap_prod \
    -W  # Will prompt for password
postgres=# SELECT 1;
 ?column?
----------
        1
```

### Step 3: Update Secrets Manager

```bash
# Create new version with manual password
$ aws secretsmanager update-secret \
    --secret-id kindswap/api/db-password \
    --secret-string 'aB3$xY9@mK2#pL8&qW5!rT1*sJ4-uI7' \
    --region us-east-1

# Verify
$ aws secretsmanager describe-secret \
    --secret-id kindswap/api/db-password \
    --region us-east-1 | grep -A5 "LastChangedDate"
```

### Step 4: Verify Pods Pick Up New Password

```bash
# Wait for ExternalSecret to refresh (15 minutes or force it)
$ kubectl delete externalsecret kindswap-backend-secrets -n production
$ kubectl apply -f helm/templates/externalsecret.yaml -n production

# Or force pod restart
$ kubectl rollout restart deployment/kindswap-backend -n production

# Check pods are running
$ kubectl get pods -n production

# Verify connection from pod
$ kubectl exec -it deployment/kindswap-backend -n production -- bash
root@pod:/# psql -h $DB_HOST -U admin -d kindswap_prod -c "SELECT 1;"
 ?column?
----------
        1
```

### Step 5: Mark Rotation as Complete

```bash
# Update Secrets Manager to indicate rotation is done
$ aws secretsmanager describe-secret \
    --secret-id kindswap/api/db-password \
    --region us-east-1

# If AWSPENDING still exists, delete it
$ aws secretsmanager update-secret-version-stage \
    --secret-id kindswap/api/db-password \
    --version-stage AWSPENDING \
    --remove-from-version-id <PendingVersionId> \
    --region us-east-1

# Confirm rotation is "Succeeded"
$ aws secretsmanager describe-secret \
    --secret-id kindswap/api/db-password \
    --query 'RotationStatus'
```

---

## 🔐 GRACE PERIOD MANAGEMENT

### Understanding AWSCURRENT vs AWSPREVIOUS

```
After rotation:

AWSPENDING (new) → AWSCURRENT (primary, used by all)
AWSCURRENT (old) → AWSPREVIOUS (grace period, still works)

Grace Period: 7 days

Use cases for grace period:
├─ Pod restart during rotation (uses old password temporarily)
├─ Slow pod startup (takes 2 minutes to boot)
├─ Connection pooling (old connections not reset)
└─ Disaster recovery (revert quickly if issues)

After 7 days:
├─ AWSPREVIOUS → deleted automatically
├─ Old password no longer works
└─ All connections must use new password
```

### Extending Grace Period (If Needed)

```bash
# By default, AWS Secrets Manager keeps AWSPREVIOUS for 7 days
# To extend (manual intervention):

# 1. Create a new secret version without rotating
$ aws secretsmanager put-secret-value \
    --secret-id kindswap/api/db-password \
    --secret-string $(aws secretsmanager get-secret-value \
      --secret-id kindswap/api/db-password \
      --query 'SecretString' --region us-east-1) \
    --region us-east-1

# 2. This keeps old password in AWSPREVIOUS for another 7 days

# NOT RECOMMENDED: Use only if critical pods still need old password
```

---

## 📊 MONITORING ROTATION

### CloudWatch Dashboard

```bash
# Create custom metric for rotations
$ aws cloudwatch put-metric-alarm \
    --alarm-name "RotationFailed" \
    --metric-name RotationFailureCount \
    --namespace "SecretsManager" \
    --statistic Sum \
    --period 3600 \
    --threshold 1 \
    --comparison-operator GreaterThanOrEqualToThreshold \
    --alarm-actions "arn:aws:sns:us-east-1:ACCOUNT:devops-alerts"
```

### Logs to Watch

```bash
# Lambda logs
$ aws logs filter-log-events \
    --log-group-name /aws/lambda/rotate-db-password \
    --filter-pattern "ERROR" \
    --start-time $(date -d '1 day ago' +%s)000

# RDS logs (if rotation failed at DB level)
$ aws rds describe-db-log-files \
    --db-instance-identifier kindswap-prod \
    --query 'DBLogFiles' | grep postgresql

# Application logs (if pods can't connect after rotation)
$ kubectl logs -f deployment/kindswap-backend -n production | grep -i "connection\|error"
```

---

## ⏰ ROTATION SCHEDULE

```
Every 30 days at 02:00 UTC:

Automatic Rotation Triggered
├─ Lambda invoked
├─ New password generated
├─ RDS updated
└─ Pods refreshed (next 15 min)

Post-rotation:
├─ AWSCURRENT: Active (new password)
├─ AWSPREVIOUS: Grace period (7 days)
└─ After 7 days: AWSPREVIOUS deleted

If rotation fails:
├─ Alert: SNS notification to DevOps
├─ Status: RotationStatus = "Failed"
└─ Action: Follow "Handle Failed Rotation" section above
```

---

## 🚨 EMERGENCY PROCEDURE (Compromised Password)

```bash
# If password is compromised and can't wait for rotation:

# 1. Force immediate rotation
$ aws secretsmanager rotate-secret \
    --secret-id kindswap/api/db-password \
    --rotate-immediately \
    --region us-east-1

# 2. If Lambda slow, do manual rotation (see above)

# 3. Revoke old password immediately
$ psql -h kindswap-prod.c*.us-east-1.rds.amazonaws.com \
    -U admin \
    -d kindswap_prod \
    -c "ALTER USER admin PASSWORD 'EMERGENCY_PASSWORD_CHANGE';"

# 4. Update Secrets Manager immediately
$ aws secretsmanager update-secret \
    --secret-id kindswap/api/db-password \
    --secret-string 'EMERGENCY_PASSWORD_CHANGE'

# 5. Force pod restart to pick up new password
$ kubectl rollout restart deployment/kindswap-backend -n production

# 6. Post-incident review
# - How was password compromised?
# - Update security controls
# - Rotate all other credentials as precaution
```

---

**Document:** CREDENTIAL ROTATION RUNBOOK  
**Status:** ✅ COMPLETE  
**Version:** v5  
**Last Updated:** March 28, 2026
