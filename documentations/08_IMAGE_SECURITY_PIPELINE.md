# 🐳 IMAGE SECURITY PIPELINE GUIDE (v5 NEW)

**Document Version:** v5 (New in v5)  
**Date:** March 28, 2026  
**Audience:** DevOps, Backend Engineers, Security Team  

---

## 🎯 OVERVIEW: 4-STAGE IMAGE SECURITY PIPELINE

Every container image goes through this security gauntlet before production:

```
STAGE 1: ECR Scan → STAGE 2: CVE Gate → STAGE 3: Cosign Sign → STAGE 4: SBOM
  (Vulnerability)      (Block/Allow)    (Image Integrity)    (Supply Chain)
     ↓                      ↓                   ↓                    ↓
  7 min (auto)          Automatic         5 sec (CI/CD)         2 sec (auto)
  Finds vulns          Allows/Blocks       Signs image          Catalogs deps
```

---

## 🔍 STAGE 1: ECR SCAN (Vulnerability Detection)

### Trigger

```
When: Image pushed to ECR
Example: $ docker push 916994.../kindswap-backend:abc1234

Scan runs: Automatically (scan-on-push = true)
Time taken: 5-10 minutes
Results: Available in AWS ECR console
```

### How It Works

```
1. ECR receives image push
2. Image stored in registry
3. ECR Image Scan service analyzes:
   ├─ OS layer (Alpine Linux, Ubuntu, etc.)
   │  └─ Scans: glibc, openssl, bash versions
   │
   ├─ Installed packages (from package managers)
   │  └─ Scans: apt, apk, yum packages
   │
   ├─ Runtime dependencies (npm, pip, maven)
   │  └─ Scans: node_modules, site-packages, .jar files
   │
   └─ Known CVEs (cross-references NVD database)
      └─ Compares: Found packages vs. CVE database

4. Generates report: CRITICAL, HIGH, MEDIUM, LOW findings
5. Stores: In ECR (queryable via CLI/console)
```

### Severity Levels

```
CRITICAL: Remote code execution, code injection, auth bypass
├─ Example: OpenSSL CVE-2022-3786 (RCE in TLS handshake)
├─ Impact: Immediate exploit possible
└─ Action: Patch immediately (within 24 hours)

HIGH: Significant vulnerability, possible exploitation
├─ Example: npm package with known XSS in older version
├─ Impact: May be exploitable with specific conditions
└─ Action: Patch within 1 week

MEDIUM: May lead to exploitation (usually with other factors)
├─ Example: Glibc local privilege escalation
├─ Impact: Requires local access + other exploits
└─ Action: Patch within 1 month (with other updates)

LOW: Minor security issue, unlikely to cause damage
├─ Example: Development tool vulnerability (not in prod)
├─ Impact: Minimal impact on production
└─ Action: Update when convenient (not urgent)
```

---

## ⛔ STAGE 2: CVE GATE (Automated Blocking)

### Policy

```
GitHub Actions workflow (.github/workflows/deploy-backend.yml):

IF (CRITICAL CVEs > 0) → FAIL pipeline, BLOCK deployment ❌
IF (HIGH CVEs > 10) → FAIL pipeline, BLOCK deployment ❌
ELSE → PASS, Continue to signing ✅
```

### How It Works

```bash
# In GitHub Actions:
$ aws ecr describe-image-scan-findings \
    --repository-name kindswap-backend \
    --image-id imageTag=$TAG \
    --query 'imageScanFindings.findingSeverityCounts.CRITICAL'

# Output: 0 (PASS) or 1+ (FAIL)

IF [ "$CRITICAL" -gt "0" ]; then
  echo "CRITICAL CVEs found, blocking deployment"
  exit 1  # FAIL: Stop pipeline
FI
```

### What Happens on Failure

```
Scenario 1: CRITICAL CVE found
├─ Pipeline: FAIL
├─ Artifact: Image pushed to ECR (but not deployed)
├─ Status: "Build failed" (GitHub shows red X)
├─ Team: Notified in #deployments Slack channel
└─ Action: Update dependencies, rebuild image

Scenario 2: HIGH CVE count excessive
├─ Same as CRITICAL
├─ Threshold: > 10 HIGH CVEs
└─ Action: Assess risk, update dependencies
```

---

## ✍️ STAGE 3: COSIGN SIGN (Image Integrity)

### Trigger

```
When: CVE gate PASSES
Tool: Cosign (supply-chain security tool)
Duration: 5 seconds
Secret: Private key from AWS Secrets Manager
```

### What Gets Signed

```
Image Digest: SHA256 hash of image layers
├─ Example: sha256:3b6cb3d6f3e9a8b2c1d5e9f8a7b3c2d1...
├─ Uniquely identifies: Exact image content
└─ Immutable: Cannot change without new digest

Signature: Cryptographic signature with private key
├─ Proves: Image created by authorized entity
├─ Verifiable: With public key (stored in repo)
└─ Tamper-proof: Cannot forge without private key
```

### Signing Process

```bash
# In CI/CD pipeline:

# 1. Retrieve private key from Secrets Manager
$ COSIGN_PRIVATE_KEY=$(aws secretsmanager get-secret-value \
    --secret-id kindswap/cosign/private-key \
    --query 'SecretString' | jq -r '.')

# 2. Sign the image
$ cosign sign \
    --key /tmp/cosign.key \
    --yes \
    916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:abc1234

# Output: Successfully signed image

# 3. Verify signature (locally, for testing)
$ cosign verify \
    --key cosign.pub \
    916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:abc1234

# Output: Verification successful, signature valid
```

### Storage

```
Signatures stored in: OCI Artifact Registry (same as ECR)
├─ Not in image itself
├─ Separate artifact, linked to image digest
├─ Queryable: cosign verify --key cosign.pub <image>
└─ Immutable: Cannot delete without recreating image
```

---

## 📦 STAGE 4: SBOM GENERATION (Supply Chain Transparency)

### Trigger

```
When: Image signed
Tool: Syft (SBOM generator)
Duration: 2 seconds
Output: JSON + CycloneDX XML
```

### What's in SBOM

```
Bill of Materials (full inventory):

Operating System:
├─ OS: Alpine Linux
├─ Version: 3.18
└─ Base packages: musl libc, openssl, ca-certificates

Runtime:
├─ Node.js: 18.16.0
├─ npm: 9.6.5
└─ Python: 3.11.0 (if multi-stage)

Application Dependencies:
├─ @nestjs/core: 9.4.0
├─ @nestjs/common: 9.4.0
├─ typeorm: 0.3.12
├─ postgres: 14.0
└─ ... (all 150+ npm packages)

Each with:
├─ Name
├─ Version
├─ Package manager (npm, pip, apt)
├─ License (MIT, Apache, etc.)
└─ SHA256 hash (integrity verification)
```

### Storage

```
Stored in: AWS S3 bucket (kindswap-sbom-artifacts)
├─ Path: s3://kindswap-sbom-artifacts/backend/{TAG}/sbom.json
├─ Naming: {image-tag}-sbom-{timestamp}.json
└─ Retention: 90 days (cost optimization)

Also available: ECR artifact registry
├─ Linked: To corresponding image
├─ Queryable: Via API
└─ Immutable: Tied to image digest
```

### Example SBOM Content

```json
{
  "bomFormat": "CycloneDX",
  "specVersion": "1.4",
  "metadata": {
    "timestamp": "2026-03-28T13:45:30Z",
    "tools": [{ "name": "syft", "version": "0.68.0" }],
    "component": {
      "type": "container",
      "name": "kindswap-backend",
      "version": "abc1234"
    }
  },
  "components": [
    {
      "type": "application",
      "name": "@nestjs/core",
      "version": "9.4.0",
      "purl": "pkg:npm/%40nestjs/core@9.4.0",
      "licenses": [{ "license": { "name": "MIT" } }],
      "hashes": [
        { "alg": "SHA-256", "content": "abc123..." }
      ]
    },
    ...
  ]
}
```

---

## 📊 HOW TO REVIEW SCAN RESULTS

### AWS Console

```
1. Navigate: AWS ECR → Repositories → kindswap-backend
2. Click: Image tag (e.g., "v5.1.0")
3. Section: "Image scan findings"
4. Table shows:
   ├─ Severity | Count | Details
   ├─ CRITICAL | 0 | ✅ OK
   ├─ HIGH | 2 | ⚠️ Review
   └─ MEDIUM | 5 | ℹ️ Track

5. Click each finding:
   ├─ CVE ID (e.g., CVE-2022-3786)
   ├─ Package: openssl
   ├─ Affected versions: 1.1.0 - 1.1.1q
   ├─ Current version: 1.1.1q
   └─ Advisory: https://nvd.nist.gov/...
```

### CLI Commands

```bash
# Get scan results (JSON format)
$ aws ecr describe-image-scan-findings \
    --repository-name kindswap-backend \
    --image-id imageTag=v5.1.0 \
    --region us-east-1

# Pretty-print findings
$ aws ecr describe-image-scan-findings \
    --repository-name kindswap-backend \
    --image-id imageTag=v5.1.0 \
    --query 'imageScanFindings.findings' \
    --output table

# Count by severity
$ aws ecr describe-image-scan-findings \
    --repository-name kindswap-backend \
    --image-id imageTag=v5.1.0 \
    --query 'imageScanFindings.findingSeverityCounts'

# Output:
# {
#   "CRITICAL": 0,
#   "HIGH": 1,
#   "MEDIUM": 3,
#   "LOW": 2
# }
```

---

## 🚨 HANDLING CRITICAL CVE FINDINGS

### Step 1: Understand the Vulnerability

```
Question 1: What is the CVE about?
├─ Read: CVE description on NVD (nvd.nist.gov)
├─ Check: CVSS score (severity 0-10)
└─ Understand: Attack vector (network, local, physical)

Question 2: Is it in production code or dev tools?
├─ Production: JavaScript, Python runtime, dependencies
├─ Dev: TypeScript compiler, testing frameworks (not in final image)
└─ Critical difference: Production vulnerabilities are urgent

Question 3: Is it actually exploitable in our context?
├─ Example: Openssl RCE
│  └─ Exploitable: YES (API server exposed to internet)
├─ Example: Glibc local privilege escalation
│  └─ Exploitable: NO (requires host access + other exploits)
└─ Assess: Realistic exploitation paths
```

### Step 2: Update Dependency

```bash
# Find affected dependency
$ npm list openssl

# Output: indirect dep via node-gyp

# Update directly (if production dep)
$ npm update openssl

# Or force update
$ npm install openssl@latest

# Run tests to ensure no breakage
$ npm test
$ npm run test:e2e

# Rebuild image
$ docker build -t backend:hotfix-$(date +%s) .

# Re-scan
$ docker push 916994.../kindswap-backend:hotfix-...

# Wait 5-10 minutes for ECR scan to complete
```

### Step 3: Verify Fix

```bash
# Check scan results again
$ aws ecr describe-image-scan-findings \
    --repository-name kindswap-backend \
    --image-id imageTag=hotfix-... \
    --query 'imageScanFindings.findingSeverityCounts'

# Confirm: CRITICAL count is 0
```

### Step 4: Deploy Hotfix

```bash
# If CRITICAL is fixed, deploy immediately
$ helm upgrade --install kindswap-backend ... \
    --set image.tag=hotfix-...
```

---

## ✅ VERIFYING COSIGN SIGNATURES

### Verify All Running Pods

```bash
# Get all running pod images
$ kubectl get pods -n production \
    -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'

# For each image, verify signature
$ cosign verify \
    --key cosign.pub \
    916994818641.dkr.ecr.us-east-1.amazonaws.com/kindswap-backend:abc1234

# Expected output:
# Verification for 916994.../kindswap-backend:abc1234
# The following checks were performed on each of these signatures:
#   - The cosign claims were appended to the image
#   - The signature was verified against the specified public key
# [{"critical":{"identity":...,"type":"cosignature"}...}]
```

### Automated Verification (Admission Webhook)

```
Kubernetes ValidatingWebhookConfiguration:
├─ Name: cosign-signature-verification
├─ Trigger: On pod creation/update
├─ Action: Verify Cosign signature
├─ If valid: Allow pod creation
├─ If invalid: Reject (403 Forbidden)
└─ Result: Only signed images can run
```

### Test Unsigned Image Rejection

```bash
# Build test image WITHOUT signing
$ docker build -t test:unsigned .
$ docker push 916994.../test:unsigned

# Try to deploy (will fail)
$ kubectl create deployment test-unsigned \
    --image=916994.../test:unsigned \
    -n production

# Expected error:
# Error from server (Forbidden): error when creating "deployment": 
# admission webhook "verify.cosign.kindswap" denied the request: 
# signature verification failed
```

---

## 📝 SBOM USAGE

### Finding Known Vulnerabilities in SBOM

```bash
# Download SBOM
$ aws s3 cp s3://kindswap-sbom-artifacts/backend/v5.1.0/sbom.json ./

# Search for specific package
$ cat sbom.json | jq '.components[] | select(.name=="typeorm")'

# Output:
# {
#   "type": "application",
#   "name": "typeorm",
#   "version": "0.3.12",
#   "licenses": [{"license": {"name": "Apache-2.0"}}],
#   "hashes": [{"alg": "SHA-256", "content": "..."}]
# }
```

### License Compliance Check

```bash
# Check licenses in SBOM
$ cat sbom.json | jq '.components[].licenses[].license.name' | sort | uniq

# Output (example):
# MIT
# Apache-2.0
# BSD-3-Clause
# ISC
# MPL-2.0

# Verify: All licenses are approved (whitelist check)
```

---

## 📊 PIPELINE SUMMARY

| Stage | Tool | Time | Trigger | Failure Action |
|-------|------|------|---------|-----------------|
| Scan | ECR | 5-10m | Image push | Store findings |
| Gate | GitHub | 1m | Scan complete | ❌ FAIL pipeline |
| Sign | Cosign | 5s | CVE gate pass | (implicit if gate passes) |
| SBOM | Syft | 2s | Image signed | Store + link to image |

---

## 🎯 BEST PRACTICES

```
1. Update dependencies regularly
   └─ At least monthly, more often if CRITICAL CVEs active

2. Monitor CVE feeds
   └─ Subscribe to NVD alerts for your packages

3. Test after updates
   └─ Run full test suite before pushing to production

4. Keep SBOM for audit
   └─ Store for 1+ year (compliance requirement)

5. Verify signatures in all environments
   └─ Prod, staging, dev (not just prod)
```

---

**Document:** IMAGE SECURITY PIPELINE GUIDE  
**Status:** ✅ COMPLETE (NEW IN v5)  
**Version:** v5  
**Last Updated:** March 28, 2026
