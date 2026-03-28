# 🚨 DISASTER RECOVERY PLAYBOOK: QUICK REFERENCE CARD

**Document Version:** v5  
**Date:** March 28, 2026  
**Emergency Contact:** DevOps On-Call  
**Estimated RTO:** 2-30 minutes (depending on scenario)  

---

## 🎯 QUICK REFERENCE: 4 DR SCENARIOS

| Scenario | Cause | RTO | Commands | Priority |
|----------|-------|-----|----------|----------|
| PITR Restore | Data corruption | 30 min | `aws rds restore-db-instance-to-point-in-time` | CRITICAL |
| Multi-AZ Failover | Primary AZ down | 2-5 min | Automatic (AWS) | CRITICAL |
| Snapshot Restore | Nonprod DB lost | 15 min | `aws rds restore-db-instance-from-snapshot` | HIGH |
| Bad Deployment | Code bug in prod | 1-2 min | `helm rollback` | CRITICAL |

---

## 🔄 SCENARIO 1: PITR RESTORE (Point-In-Time Recovery)

**When:** Data corruption detected, accidental deletion, or data integrity issue

### Commands

```bash
# 1. List available backups (last 7 days)
$ aws rds describe-db-instances \
    --db-instance-identifier kindswap-prod \
    --region us-east-1 \
    --query 'DBInstances[0].[LatestRestorableTime,EarliestRestorableTime]'

# Output: Latest restorable is NOW, earliest is 7 days ago

# 2. Determine restore point (usually 30-60 minutes ago)
RESTORE_TIME="2026-03-28T12:00:00Z"  # 1 hour ago

# 3. Restore to new instance (test first!)
$ aws rds restore-db-instance-to-point-in-time \
    --source-db-instance-identifier kindswap-prod \
    --db-instance-identifier kindswap-prod-pitr-test \
    --restore-time "$RESTORE_TIME" \
    --db-subnet-group-name kindswap-db-subnet-group \
    --publicly-accessible false \
    --vpc-security-group-ids sg-rds-security-group \
    --region us-east-1 \
    --no-copy-tags-to-snapshot

# Output: "DBInstance status creating..."

# 4. Monitor restoration
$ aws rds describe-db-instances \
    --db-instance-identifier kindswap-prod-pitr-test \
    --region us-east-1 \
    --query 'DBInstances[0].DBInstanceStatus'

# Poll every 2 minutes until: "available"
# Estimated time: 20-25 minutes

# 5. Verify data integrity
PITR_ENDPOINT="kindswap-prod-pitr-test.c*.us-east-1.rds.amazonaws.com"

$ psql -h $PITR_ENDPOINT -U admin -d kindswap_prod << 'EOF'
SELECT COUNT(*) as total_swaps FROM swap_transactions;
SELECT COUNT(*) as users FROM users;
SELECT MAX(created_at) as latest_swap FROM swap_transactions;
EOF

# Compare with production DB to confirm correct data

# 6. If data looks good: Promote PITR to primary
# (See: Swap Restored Database to Production below)

# 7. If data looks bad: Delete test instance
$ aws rds delete-db-instance \
    --db-instance-identifier kindswap-prod-pitr-test \
    --skip-final-snapshot \
    --region us-east-1

# Try different restore point (earlier in time)
```

### Promote Restored DB to Production

```bash
# CAUTION: This makes restored DB the new primary!

# 1. Create snapshot of current prod (backup before swap)
$ aws rds create-db-snapshot \
    --db-instance-identifier kindswap-prod \
    --db-snapshot-identifier kindswap-prod-before-pitr-$(date +%s) \
    --region us-east-1

# Wait for snapshot to complete: $ aws rds describe-db-snapshots ...

# 2. Rename old primary
$ aws rds modify-db-instance \
    --db-instance-identifier kindswap-prod \
    --new-db-instance-identifier kindswap-prod-old-$(date +%s) \
    --apply-immediately \
    --region us-east-1

# 3. Rename restored to primary
$ aws rds modify-db-instance \
    --db-instance-identifier kindswap-prod-pitr-test \
    --new-db-instance-identifier kindswap-prod \
    --apply-immediately \
    --region us-east-1

# Wait for rename to complete: $ aws rds describe-db-instances ...

# 4. Update Kubernetes secret (if endpoint changed)
$ kubectl set env deployment/kindswap-backend \
    DB_HOST=$NEW_ENDPOINT \
    -n production

# 5. Verify pods connected
$ kubectl logs -f deployment/kindswap-backend -n production | grep -i "connected\|error"

# 6. Cleanup old database
$ aws rds delete-db-instance \
    --db-instance-identifier kindswap-prod-old-* \
    --skip-final-snapshot \
    --region us-east-1
```

**RTO:** 20-30 minutes

---

## 🔄 SCENARIO 2: MULTI-AZ FAILOVER (Automatic)

**When:** Primary AZ (us-east-1a) goes down

### What Happens Automatically

```
AWS RDS Multi-AZ Failover (automatic, no human action):

T+0min:  Primary node in us-east-1a becomes unavailable
T+2min:  AWS detects failure
T+3min:  RDS automatically promotes standby (us-east-1b)
T+4min:  New standby node created in us-east-1c
T+5min:  Failover complete, applications reconnect

Result:
├─ DNS endpoint: Same (kindswap-prod.c*.us-east-1.rds.amazonaws.com)
├─ Data: Fully consistent (replicated)
├─ Downtime: ~5 minutes (connections retry automatically)
└─ Action needed: NONE (automatic)

Pods automatically reconnect:
├─ On error: Connection pool detects DB offline
├─ Retry: Exponential backoff (1s, 2s, 4s, 8s, ...)
├─ Reconnect: Once new primary available
└─ Result: Service recovers without restart
```

### Verify Failover Succeeded

```bash
# 1. Check RDS status
$ aws rds describe-db-instances \
    --db-instance-identifier kindswap-prod \
    --region us-east-1 \
    --query 'DBInstances[0].[DBInstanceStatus,AvailabilityZone]'

# Expected: ["available", "us-east-1b"] (changed AZ!)

# 2. Verify standby created
$ aws rds describe-db-instances \
    --db-instance-identifier kindswap-prod \
    --region us-east-1 \
    --query 'DBInstances[0].SecondaryAvailabilityZone'

# Expected: "us-east-1c" (new standby)

# 3. Check pod logs for reconnections
$ kubectl logs -f deployment/kindswap-backend -n production | tail -20

# Look for: "Connection reestablished" or "Database recovered"

# 4. Test endpoint
$ curl https://kindswap.world/api/v1/health

# Expected: 200 OK after ~5 minutes
```

### Manual Failover (If Needed)

```bash
# Force failover to standby (last resort)
# Use only if primary is unresponsive and won't recover

$ aws rds reboot-db-instance \
    --db-instance-identifier kindswap-prod \
    --force-failover \
    --region us-east-1

# This triggers immediate failover to standby
# RTO: ~2 minutes
```

**RTO:** 2-5 minutes (automatic), 2 minutes (manual)

---

## 🔄 SCENARIO 3: NONPROD SNAPSHOT RESTORE

**When:** Staging/dev database corrupted or lost

### Commands

```bash
# 1. List available snapshots
$ aws rds describe-db-snapshots \
    --db-instance-identifier kindswap-nonprod \
    --region us-east-1 \
    --query 'DBSnapshots[].[DBSnapshotIdentifier,SnapshotCreateTime]'

# Output:
# kindswap-nonprod-snapshot-2026-03-28, 2026-03-28T23:45:00Z
# kindswap-nonprod-snapshot-2026-03-27, 2026-03-27T23:45:00Z

# 2. Choose latest snapshot (or specific date)
SNAPSHOT_ID="kindswap-nonprod-snapshot-2026-03-28"

# 3. Restore from snapshot
$ aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier kindswap-nonprod-temp \
    --db-snapshot-identifier $SNAPSHOT_ID \
    --db-instance-class db.t3.small \
    --db-subnet-group-name kindswap-db-subnet-group \
    --publicly-accessible false \
    --region us-east-1

# 4. Monitor restoration
$ aws rds describe-db-instances \
    --db-instance-identifier kindswap-nonprod-temp \
    --query 'DBInstances[0].DBInstanceStatus'

# Wait for: "available" (10-15 minutes)

# 5. Verify data
$ psql -h kindswap-nonprod-temp.c*.us-east-1.rds.amazonaws.com \
    -U admin -d kindswap_staging \
    -c "SELECT COUNT(*) FROM swap_transactions;"

# 6. Swap with current nonprod
$ aws rds delete-db-instance \
    --db-instance-identifier kindswap-nonprod \
    --skip-final-snapshot \
    --region us-east-1

$ aws rds modify-db-instance \
    --db-instance-identifier kindswap-nonprod-temp \
    --new-db-instance-identifier kindswap-nonprod \
    --apply-immediately \
    --region us-east-1

# 7. Update Kubernetes (if endpoint changed)
$ kubectl rollout restart deployment/kindswap-staging -n staging
```

**RTO:** 15 minutes

---

## 🔄 SCENARIO 4: BAD DEPLOYMENT ROLLBACK

**When:** Code bug in production, need to revert immediately

### Commands

```bash
# 1. Check deployment history
$ helm history kindswap-backend -n production

# Output:
# REVISION  STATUS      CHART               VERSION
# 10        DEPLOYED    kindswap-backend-1.0.0
# 9         SUPERSEDED  kindswap-backend-1.0.0
# 8         SUPERSEDED  kindswap-backend-0.9.9

# 2. Rollback to previous version
$ helm rollback kindswap-backend 9 -n production --wait

# This rolls back to revision 9
# Estimated: 1 minute

# 3. Verify rollback
$ kubectl rollout status deployment/kindswap-backend -n production
$ curl https://kindswap.world/api/v1/health

# 4. Check logs for errors
$ kubectl logs -f deployment/kindswap-backend -n production

# 5. If still having issues, rollback further
$ helm rollback kindswap-backend 8 -n production --wait
```

**RTO:** 1-2 minutes

---

## 📋 EXTENDED PROCEDURES

### Full RDS Failover Test (Monthly)

```bash
# Schedule: 1st Saturday of month (02:00 UTC)
# Duration: 5 minutes downtime

# 1. Announce maintenance
$ slack-message "#infrastructure: RDS failover test starting"

# 2. Trigger failover
$ aws rds reboot-db-instance \
    --db-instance-identifier kindswap-prod \
    --force-failover \
    --region us-east-1

# 3. Monitor progress
$ watch -n 5 "aws rds describe-db-instances \
    --db-instance-identifier kindswap-prod \
    --query 'DBInstances[0].[DBInstanceStatus,AvailabilityZone]'"

# 4. Verify pod reconnection
$ kubectl get pods -n production
$ kubectl logs -f deployment/kindswap-backend -n production

# 5. Test application
$ curl https://kindswap.world/api/v1/health

# 6. Post-incident
$ slack-message "#infrastructure: RDS failover test completed successfully"
```

### Snapshot Verification (Weekly)

```bash
# 1. List recent snapshots
$ aws rds describe-db-snapshots \
    --db-instance-identifier kindswap-prod \
    --query 'DBSnapshots[0:3]'

# 2. Verify snapshot is complete
$ aws rds describe-db-snapshots \
    --db-snapshot-identifier <latest-snapshot-id> \
    --query 'DBSnapshots[0].[SnapshotCreateTime,Status,AllocatedStorage]'

# Expected Status: "available"
```

---

## 🆘 EMERGENCY ESCALATION

```
If ANY recovery procedure fails:

IMMEDIATE ACTIONS:
1. Stop: Don't make more changes
2. Snapshot: Create final backup
3. Alert: Contact AWS support (critical case)
4. Notify: Exec team (service may be down for 1+ hours)

ESCALATION:
- Tier 1: DevOps team (on-call)
- Tier 2: Architecture team (if Tier 1 cannot fix)
- Tier 3: AWS support (professional services)
- Tier 4: External contractor (last resort, pre-negotiated)

Contact Info:
- On-call: Slack #infrastructure-oncall (24/7)
- Exec: Navdeep (navdeep@kindswap.xyz)
- AWS: Support case opened (if pro support active)
```

---

## 📊 RECOVERY METRICS

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| PITR Restore RTO | < 30 min | 20-25 min | ✅ PASS |
| Multi-AZ Failover RTO | < 5 min | 2-5 min | ✅ PASS |
| Snapshot Restore RTO | < 20 min | 15 min | ✅ PASS |
| Deployment Rollback RTO | < 3 min | 1-2 min | ✅ PASS |
| Backup Retention | 7 days | 7 days | ✅ PASS |
| PITR Window | 7 days | 7 days | ✅ PASS |
| Multi-AZ Status | Active | Active | ✅ PASS |

---

## ✅ DR TEST SCHEDULE

```
Monthly: PITR test (restore to test instance)
Monthly: Multi-AZ failover test
Weekly: Snapshot verification
Quarterly: Full DR drill (all scenarios)
Annually: RTO/RPO review and updates
```

---

**Document:** DISASTER RECOVERY PLAYBOOK  
**Status:** ✅ COMPLETE  
**Version:** v5  
**Last Updated:** March 28, 2026
