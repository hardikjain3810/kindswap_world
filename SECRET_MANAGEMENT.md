# SECRET MANAGEMENT DOCUMENTATION

**Objective:** Central documentation for all secrets, credentials, and sensitive data  
**Scope:** Production, staging, dev environments  
**Location:** AWS Secrets Manager + Pritunl + Kubernetes CSI Driver  
**Last Updated:** March 28, 2026

---

## TABLE OF CONTENTS

1. [Secret Categories](#secret-categories)
2. [AWS Secrets Manager](#aws-secrets-manager)
3. [Kubernetes Secret Mounts](#kubernetes-secret-mounts)
4. [Pritunl VPN Credentials](#pritunl-vpn-credentials)
5. [Secret Rotation Procedures](#secret-rotation-procedures)
6. [Access Policies](#access-policies)
7. [Emergency Access](#emergency-access)

---

## SECRET CATEGORIES

### Category 1: Database Credentials (High Security)

| Secret | Environment | Location | Rotation | Users |
|---|---|---|---|---|
| PostgreSQL username/password | prod | AWS Secrets Manager | Quarterly (180 days) | Backend only |
| PostgreSQL username/password | staging | AWS Secrets Manager | Quarterly | Backend only |
| PostgreSQL username/password | dev | AWS Secrets Manager | No rotation | All devs |

**Access Method:** Kubernetes CSI Driver mounts `/mnt/secrets/database/credentials`

---

### Category 2: Third-Party API Keys (Medium Security)

| Service | Environment | Key Type | Location | Rotation | Users |
|---|---|---|---|---|---|
| Helius RPC | prod | API Key | Secrets Manager | Semi-annually | Backend |
| Jupiter | prod | API Key | Secrets Manager | Semi-annually | Backend |
| CoinGecko | prod | API Key | Secrets Manager | Semi-annually | Backend |
| Sentry | prod | DSN | Secrets Manager | Annual | Backend, Frontend |
| Helius RPC | staging | API Key | Secrets Manager | As needed | Backend |
| Helius RPC | dev | API Key | Secrets Manager | Not applicable | All devs |

**Access Method:** ExternalSecrets operator syncs to Kubernetes ConfigMap

---

### Category 3: Cryptographic Keys (Maximum Security)

| Key | Environment | Location | Rotation | Users |
|---|---|---|---|---|
| ECR signing key (Cosign) | prod | Secrets Manager | Semi-annually | CI/CD only |
| KMS key alias/kindswap-master | prod | AWS KMS | Not rotatable (managed key) | IRSA roles only |
| JWT secret (if used) | prod | Secrets Manager | On compromise | Backend |

**Access Method:** IRSA roles with KMS key grants

---

### Category 4: VPN/Admin Credentials (Variable Security)

| Credential | Location | Access | Rotation |
|---|---|---|---|
| Pritunl admin user/password | Password Manager | Admin only | Manual, as needed |
| Pritunl API key | Password Manager | DevOps only | Annual |
| AWS root account password | Password Manager + hardware key safe | Root only | After each root use |

**Access Method:** Stored in encrypted password manager (1Password, Bitwarden)

---

### Category 5: CI/CD Pipeline Secrets (Medium Security)

| Secret | Location | Used By | Rotation |
|---|---|---|---|
| GitHub repo access token | GitHub secrets | Actions workflow | Annual |
| Docker registry credentials | GitHub secrets | Build step | When credentials change |
| CloudFlare API token | Secrets Manager | Terraform | Semi-annually |
| NPM token (if private packages) | GitHub secrets | Install step | Annual |

**Access Method:** GitHub Actions secrets (encrypted environment variables)

---

## AWS SECRETS MANAGER

### Overview

All secrets are stored in AWS Secrets Manager (`kindswap/...` namespace):

```
kindswap/db/prod/credentials
  ├─ username
  ├─ password
  ├─ engine
  ├─ host
  ├─ port
  └─ dbname

kindswap/api/helius/prod
  ├─ api_key
  └─ rpc_url

kindswap/api/sentry/prod
  ├─ dsn
  └─ environment

kindswap/keys/cosign/prod
  ├─ private_key
  └─ public_key
```

### Viewing Secrets (AWS Console)

**Prerequisite:** MFA-authenticated AWS Console access (see [AWS MFA Guide](./AWS_MFA_ENFORCEMENT_GUIDE.md))

**Steps:**

1. **Navigate to AWS Secrets Manager:**
   ```
   https://console.aws.amazon.com/secretsmanager
   ```

2. **Search for secret name:**
   - Example: `kindswap/db/prod/credentials`

3. **Click secret name**

4. **Click "Retrieve secret value"**
   - Shows all key-value pairs (username, password, host, etc.)

5. **Use values as needed** (copy username, password, etc.)

### Viewing Secrets (AWS CLI)

```bash
# Get full secret value
aws secretsmanager get-secret-value \
  --secret-id kindswap/db/prod/credentials \
  --region us-east-1

# Expected output:
# {
#   "SecretString": "{\"username\":\"postgres\",\"password\":\"xxxxx\",\"host\":\"xxx.rds.amazonaws.com\",\"port\":5432}",
#   "Name": "kindswap/db/prod/credentials",
#   "ARN": "arn:aws:secretsmanager:us-east-1:916994818641:secret:kindswap/db/prod/credentials-...",
#   "VersionId": "123abc...",
#   "LastAccessedDate": "2026-03-28T00:00:00+00:00"
# }
```

### Creating New Secrets (Admin Only)

```bash
# 1. Prepare secret JSON
SECRET_JSON='{
  "username": "postgres",
  "password": "SecurePassword123!@#",
  "host": "kindswap-prod.us-east-1.rds.amazonaws.com",
  "port": 5432,
  "dbname": "kindswap"
}'

# 2. Create secret in Secrets Manager
aws secretsmanager create-secret \
  --name kindswap/db/prod/credentials \
  --description "Production database credentials" \
  --secret-string "$SECRET_JSON" \
  --region us-east-1

# 3. Tag secret for organization
aws secretsmanager tag-resource \
  --secret-id kindswap/db/prod/credentials \
  --tags Key=environment,Value=production Key=project,Value=kindswap
```

### Updating Secrets (Rotation)

```bash
# 1. Get current secret
CURRENT=$(aws secretsmanager get-secret-value \
  --secret-id kindswap/db/prod/credentials \
  --query 'SecretString' --output text)

# 2. Update password in RDS database
# (Done separately - see Secret Rotation Procedures below)

# 3. Update secret value in Secrets Manager
NEW_SECRET_JSON='{
  "username": "postgres",
  "password": "NewSecurePassword456!@#",
  "host": "kindswap-prod.us-east-1.rds.amazonaws.com",
  "port": 5432,
  "dbname": "kindswap"
}'

aws secretsmanager update-secret \
  --secret-id kindswap/db/prod/credentials \
  --secret-string "$NEW_SECRET_JSON"

# 4. Verify update (cached for 120s by CSI driver)
aws secretsmanager get-secret-value \
  --secret-id kindswap/db/prod/credentials
```

---

## KUBERNETES SECRET MOUNTS

### Overview

Secrets are mounted into pods via Kubernetes CSI Driver + AWS Secrets Manager:

**Pod receives:**
- `/mnt/secrets/database/credentials` - Database username/password
- `/mnt/secrets/api/helius` - Third-party API keys
- `/mnt/secrets/api/sentry` - Monitoring DSN

**Refresh interval:** 120 seconds (automatic)

### Viewing Mounted Secrets (Inside Pod)

```bash
# 1. Access pod shell
kubectl exec -it <POD_NAME> -n production -- /bin/bash

# 2. List mounted secret files
ls -la /mnt/secrets/database/
ls -la /mnt/secrets/api/

# 3. View secret contents
cat /mnt/secrets/database/credentials
# Expected output: username=postgres\npassword=xxxxx\nhost=xxx.rds.amazonaws.com

# 4. For JSON format secrets
cat /mnt/secrets/api/helius | jq '.'
# Expected: { "api_key": "xxx", "rpc_url": "https://..." }
```

### SecretProviderClass Configuration

**File:** `infra/infra/infra-k8s/03-config/secret-provider-class-prod.yaml`

```yaml
apiVersion: secrets-store.csi.x-k8s.io/v1
kind: SecretProviderClass
metadata:
  name: kindswap-secrets
  namespace: production
spec:
  provider: aws
  parameters:
    objects: |
      - objectName: "kindswap/db/prod/credentials"
        objectType: "secretsmanager"
        objectAlias: "database"
        
      - objectName: "kindswap/api/helius/prod"
        objectType: "secretsmanager"
        objectAlias: "helius"
        
      - objectName: "kindswap/api/sentry/prod"
        objectType: "secretsmanager"
        objectAlias: "sentry"
        
  rotationPollInterval: "120s"  # Refresh every 2 minutes
  nodePublishSecretRefresh:
    interval: "120s"
```

### Pod Volume Mount Configuration

**In deployment.yaml:**

```yaml
spec:
  containers:
  - name: backend
    image: 916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:xxx
    volumeMounts:
    - name: secrets
      mountPath: /mnt/secrets
      readOnly: true
    
    env:
    # Example: Mount database password as environment variable
    - name: DB_PASSWORD
      valueFrom:
        secretKeyRef:
          name: kindswap-db-password
          key: password
          
  volumes:
  - name: secrets
    csi:
      driver: secrets-store.csi.k8s.io
      readOnly: true
      volumeAttributes:
        secretProviderClass: kindswap-secrets
```

### Testing Secret Mount in Pod

```bash
# 1. Deploy test pod with secret mount
kubectl run secret-test \
  --image=alpine \
  -n production \
  --rm -it \
  --override-type=json \
  -- cat /mnt/secrets/database/credentials

# 2. Verify secret is readable
# Output should show: username=postgres password=xxxxx ...

# 3. Test refresh by updating secret in Secrets Manager
aws secretsmanager update-secret \
  --secret-id kindswap/db/prod/credentials \
  --secret-string '{...new values...}'

# 4. Wait 120 seconds and verify pod sees new values
# CSI driver automatically refreshes
```

---

## PRITUNL VPN CREDENTIALS

### Admin Credentials (For Infrastructure Team)

**Location:** Password manager (1Password, Bitwarden)

**Stored Credentials:**
- Admin username (email)
- Admin password (25+ characters, random)
- Admin TOTP seed (or hardware key registration)

**Access:** Only infrastructure leads

**Procedure to Access:**

1. Open 1Password (or password manager)
2. Search "Pritunl admin"
3. Copy username and password
4. Navigate to https://vpn.kindswap.world/admin
5. Enter credentials
6. When prompted, enter TOTP code from authenticator app

### User VPN Profiles

**Location:** Generated dynamically from Pritunl

**Each user receives:**
- VPN profile file (.ovpn or .conf)
- One-time download link (expires after 24 hours)
- Instructions for MFA setup

**User stores:**
- VPN profile file (local computer only - NOT shared)
- TOTP seed (in authenticator app only)

### Pritunl API Key (For DevOps Automation)

**Location:** Password manager

**Usage:** Automating VPN user management, profile generation

**Procedure to Generate New API Key:**

```bash
# 1. Access Pritunl admin panel
# https://vpn.kindswap.world/admin

# 2. Click username (top-right) → "Settings"

# 3. Scroll to "API"

# 4. Click "Generate Key"

# 5. New key appears (copy immediately)

# 6. Store in password manager with label "Pritunl API Key - Prod"

# 7. Use in scripts:
PRITUNL_API_KEY="<copied-key>"
PRITUNL_API_SECRET="<secret>"
PRITUNL_URL="https://vpn.kindswap.world"

# Example API call:
curl -X GET \
  -H "Auth-Token: $PRITUNL_API_KEY" \
  -H "Auth-Secret: $PRITUNL_API_SECRET" \
  $PRITUNL_URL/api/users
```

---

## SECRET ROTATION PROCEDURES

### Procedure 1: Rotate Database Password (Production)

**Frequency:** Every 180 days (quarterly)  
**Downtime:** ~5 minutes (brief pool reconnection)

**Steps:**

1. **Generate new password** (25+ characters, random):
   ```bash
   openssl rand -base64 30
   # Example output: aBcDeFgHiJkLmNoPqRsTuVwXyZ1234==
   ```

2. **Update RDS password:**
   ```bash
   # In AWS Console: RDS → Databases → kindswap-prod
   # Click "Modify"
   # Section: "Credential Settings"
   # Change master password: <NEW_PASSWORD>
   # Uncheck "Apply immediately" (or check for immediate)
   # Click "Continue"
   # Click "Modify DB instance"
   ```

   **Via AWS CLI:**
   ```bash
   aws rds modify-db-instance \
     --db-instance-identifier kindswap-prod \
     --master-user-password <NEW_PASSWORD> \
     --apply-immediately \
     --region us-east-1
   ```

3. **Wait for RDS status to become "Available"** (typically 2-3 minutes):
   ```bash
   aws rds describe-db-instances \
     --db-instance-identifier kindswap-prod \
     --query 'DBInstances[0].DBInstanceStatus'
   ```

4. **Update Secrets Manager:**
   ```bash
   aws secretsmanager update-secret \
     --secret-id kindswap/db/prod/credentials \
     --secret-string '{
       "username": "postgres",
       "password": "<NEW_PASSWORD>",
       "host": "kindswap-prod.us-east-1.rds.amazonaws.com",
       "port": 5432,
       "dbname": "kindswap"
     }'
   ```

5. **Verify pods reconnect** (CSI driver refreshes every 120 seconds):
   ```bash
   # Check pod logs for successful database connection
   kubectl logs -n production kindswap-backend-<POD> --tail=20
   # Look for: "Database connection established" or similar
   ```

6. **Verify backend API is responsive:**
   ```bash
   curl https://kindswap.world/api/health
   # Should return 200 OK
   ```

### Procedure 2: Rotate Cosign Private Key (CI/CD Signing)

**Frequency:** Semi-annually or on compromise  
**Impact:** New image signatures required for all future deployments

**Steps:**

1. **Generate new Cosign key pair:**
   ```bash
   cosign generate-key-pair
   # Prompts for password (use strong password)
   # Generates: cosign.key, cosign.pub
   ```

2. **Upload to Secrets Manager:**
   ```bash
   PRIVATE_KEY=$(cat cosign.key)
   
   aws secretsmanager update-secret \
     --secret-id kindswap/keys/cosign/prod \
     --secret-string "{\"private_key\":\"$PRIVATE_KEY\"}"
   ```

3. **Update GitHub Actions secret:**
   - Repository → Settings → Secrets and variables → Actions
   - Update `COSIGN_PRIVATE_KEY` with new private key contents
   - Update `COSIGN_PUBLIC_KEY` with new public key

4. **Commit new public key to repository:**
   ```bash
   cp cosign.pub infra/infra/cosign.pub
   git add infra/infra/cosign.pub
   git commit -m "UPDATE: Cosign public key rotation"
   git push
   ```

5. **Old images will show verification failures** (expected):
   - Update verification script to accept both old and new keys during transition
   - Or regenerate images using new key

### Procedure 3: Rotate Third-Party API Keys

**Examples:** Helius, Jupiter, CoinGecko, Sentry  
**Frequency:** Semi-annually  
**Impact:** Minimal (API keys have rate limits but no data)

**Steps (General Process):**

1. **Obtain new API key from service provider:**
   - Log into service account (Helius dashboard, etc.)
   - Navigate to API Keys section
   - Generate new key
   - Old key typically remains valid for grace period

2. **Update Secrets Manager:**
   ```bash
   aws secretsmanager update-secret \
     --secret-id kindswap/api/helius/prod \
     --secret-string '{"api_key":"new_key_xxx"}'
   ```

3. **Wait 120 seconds for CSI driver refresh**

4. **Test API endpoint:**
   ```bash
   # Pod automatically gets new key from refreshed mount
   kubectl exec -it <POD> -n production -- curl \
     https://helius-rpc.com/v0/accounts?api_key=<NEW_KEY>
   ```

5. **Disable old key in service provider** (after verification)

### Procedure 4: MFA Recovery Code Rotation

**Frequency:** Annual or after use  
**Impact:** Backup access security

**Steps:**

1. **Access Pritunl admin → Server Settings**

2. **Click "Generate New Backup Codes"**

3. **New codes replace old codes** (old codes become invalid)

4. **Store new codes in password manager**

5. **Distribute to backup administrators** via secure channel

---

## ACCESS POLICIES

### Policy 1: Database Secrets Access (IRSA Role)

**File:** `infra/infra/infra-k8s/02-security/iam-roles/backend-irsa-role.json`

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SecretsManagerRead",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:916994818641:secret:kindswap/db/*"
    },
    {
      "Sid": "KMSDecrypt",
      "Effect": "Allow",
      "Action": "kms:Decrypt",
      "Resource": "arn:aws:kms:us-east-1:916994818641:key/*",
      "Condition": {
        "StringEquals": {
          "kms:ViaService": "secretsmanager.us-east-1.amazonaws.com"
        }
      }
    }
  ]
}
```

### Policy 2: CSI Driver Access (Pod Identity)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue",
        "secretsmanager:DescribeSecret"
      ],
      "Resource": "arn:aws:secretsmanager:us-east-1:916994818641:secret:kindswap/*"
    }
  ]
}
```

### Policy 3: User Access (MFA Required)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Deny",
      "Action": "secretsmanager:*",
      "Resource": "*",
      "Condition": {
        "Bool": {
          "aws:MultiFactorAuthPresent": "false"
        }
      }
    }
  ]
}
```

---

## EMERGENCY ACCESS

### Scenario 1: Database Inaccessible (Password Lost)

**Solution:**

1. **Contact AWS support** (or use root account credentials)

2. **Reset RDS master password:**
   ```bash
   aws rds modify-db-instance \
     --db-instance-identifier kindswap-prod \
     --master-user-password <NEW_TEMPORARY_PASSWORD> \
     --apply-immediately
   ```

3. **Update Secrets Manager immediately**

4. **Restart backend pods to reconnect:**
   ```bash
   kubectl rollout restart deployment/kindswap-backend -n production
   ```

### Scenario 2: Secrets Manager Unavailable

**Fallback to environment variables:**

```yaml
# In deployment, add fallback env vars
env:
- name: DATABASE_PASSWORD
  valueFrom:
    secretKeyRef:
      name: db-fallback
      key: password
```

### Scenario 3: Compromised API Key

**Immediate actions:**

1. **Disable old key in service provider** immediately

2. **Generate new key:**
   ```bash
   # Via service provider dashboard or API
   ```

3. **Update Secrets Manager** immediately:
   ```bash
   aws secretsmanager update-secret --secret-id kindswap/api/helius/prod ...
   ```

4. **Monitor for unauthorized usage** of old key during grace period

---

## AUDIT & COMPLIANCE

### Access Logging

All secret access is logged:

```bash
# View CloudTrail logs for Secrets Manager access
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetSecretValue \
  --region us-east-1

# Filter by date/user
aws cloudtrail lookup-events \
  --lookup-attributes AttributeKey=Username,AttributeValue=<USERNAME> \
  --start-time 2026-03-01 \
  --region us-east-1
```

### Rotation Tracking

```bash
# List secret versions (tracks rotation history)
aws secretsmanager list-secret-version-ids \
  --secret-id kindswap/db/prod/credentials

# Shows: VersionId, CreatedDate, when rotated
```

---

## CHECKLISTS

### Weekly Audit Checklist
- [ ] Review CloudTrail logs for unauthorized access
- [ ] Verify CSI driver refreshes working (120-second intervals)
- [ ] Test one API key to ensure validity

### Monthly Audit Checklist
- [ ] Audit who has access to which secrets
- [ ] Review IRSA role permissions for least privilege
- [ ] Verify backup codes are still accessible

### Quarterly Rotation Checklist
- [ ] Rotate database passwords
- [ ] Rotate API keys (if semi-annual schedule)
- [ ] Audit Secrets Manager for unused secrets

---

*Last Updated: March 28, 2026*  
*Status: Draft - Subject to team feedback*  
*Next Review: June 2026*
