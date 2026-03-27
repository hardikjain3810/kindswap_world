# Kindswap Terraform Recovery Checklist - For Backup Repo

**Objective:** Extract `.tf` files from backup repository and integrate into main Kindswap project  
**Date:** March 27, 2026  
**For:** AI/Dev accessing backup repository  

---

## 🎯 Quick Summary

**What we need:**
- 12+ Terraform files across `bootstrap/`, `infra-core/`, and `infra-k8s/` directories
- Complete infrastructure-as-code that currently powers:
  - EKS 1.31 cluster (multi-AZ)
  - RDS PostgreSQL (Multi-AZ, gp3 storage)
  - ECR repositories (4x for Kindswap services)
  - VPC with 5 security endpoints
  - KMS encryption, S3, Prometheus, Grafana

**What we're doing:**
- Locating `.tf` files in backup repo
- Extracting them without exposing secrets
- Committing to `feature/cosign-sbom-security-pipeline` branch
- Creating PR for code review
- Merging to `dev` for production use

---

## 📂 Directory Structure to Extract

```
infra/infra/
├── bootstrap/
│   ├── main.tf           (S3 state backend setup)
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.dev.tfvars
│
├── infra-core/
│   ├── 01-networking/    (VPC, subnets, NAT, endpoints)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── data.tf
│   │
│   ├── 02-security/      (Security groups, IAM, KMS)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── policies.tf
│   │
│   ├── 03-eks/           (EKS cluster, node groups, OIDC)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── oidc.tf
│   │   └── node_groups.tf
│   │
│   ├── 04-data/          (RDS, S3, Redis)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   └── rds.tf
│   │
│   └── 05-registry/      (ECR repositories)
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
│
├── infra-k8s/
│   ├── 01-irsa/          (IAM Roles for Service Accounts)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   │
│   ├── 02-controllers/   (ALB, ESO, CSI driver)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── helm.tf
│   │   └── outputs.tf
│   │
│   ├── 03-karpenter/     (Karpenter auto-scaling)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── helm.tf
│   │   └── outputs.tf
│   │
│   ├── 04-monitoring/    (Prometheus, Grafana)
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── helm.tf
│   │   └── outputs.tf
│   │
│   └── 05-apps/          (Helm app deployments)
│       ├── main.tf
│       ├── variables.tf
│       ├── outputs.tf
│       ├── backend.tf
│       └── helm/         [ALREADY EXISTS - DO NOT OVERWRITE]
│           ├── kindswap-backend/
│           ├── kindswap-admin-backend/
│           ├── kindswap-frontend/
│           └── kindswap-admin-frontend/
│
└── README.md             [ALREADY EXISTS]
```

---

## 🔍 Step 1: Locate Backup Repository

**Where to find it:**
- [ ] Cloud storage (Google Drive, OneDrive, AWS S3, etc.)
- [ ] Local backup drive
- [ ] Another GitHub repository (private or org)
- [ ] GitLab, Bitbucket, or other Git service
- [ ] Backup file (tar.gz, zip, etc.)

**Questions for user:**
- Where is the backup located?
- Is it public or requires authentication?
- What branch/tag contains the `.tf` files?

---

## 🔐 Step 2: Verify No Secrets in Files

**CRITICAL:** Before extracting, check for:

```bash
# Search for sensitive patterns in backup repo
grep -r "password\|secret\|key\|token\|credential" infra/infra/ | grep -v "^Binary"

# Look for AWS credentials
grep -r "AKIA\|aws_secret_access_key\|AWS_ACCESS_KEY" infra/infra/

# Look for common secret file patterns
find infra/infra -name "*.key" -o -name "*.pem" -o -name "*secret*" -o -name "*token*"
```

**Expected Result:** No output (secrets should NOT be in `.tf` files)

**If secrets found:**
1. Extract files WITHOUT the secrets
2. Add entries to `.gitignore`:
   ```
   *.key
   *.pem
   *-secret.tf
   terraform.prod.tfvars
   ```
3. Use AWS Secrets Manager instead (already configured)

---

## 📥 Step 3: Extract Files

### Option A: From GitHub Private Repo
```bash
# Add as remote
git remote add backup https://github.com/user/backup-repo.git
git fetch backup main:backup-main

# List all .tf files in backup
git ls-tree -r backup-main:infra/infra | grep ".tf$"

# Checkout specific directory
git checkout backup-main -- infra/infra/bootstrap/
git checkout backup-main -- infra/infra/infra-core/
git checkout backup-main -- infra/infra/infra-k8s/

# Verify files extracted
find infra/infra -name "*.tf" | wc -l
# Should show 12+ files
```

### Option B: From Local Backup
```bash
# Copy from backup location
cp -r /path/to/backup/infra/infra/* d:\D\kindswap\infra\infra\

# Verify
ls -la d:\D\kindswap\infra\infra\infra-core\01-networking\main.tf
```

### Option C: From Compressed Archive
```bash
# Extract archive
tar -xzf kindswap-backup.tar.gz
# or
unzip kindswap-backup.zip

# Copy infra files
cp -r extracted/infra/infra/* d:\D\kindswap\infra\infra\
```

### Option D: From S3 Bucket
```bash
# List objects
aws s3 ls s3://kindswap-backups/infra/

# Download entire infra folder
aws s3 cp s3://kindswap-backups/infra/ d:\D\kindswap\infra\infra\ --recursive
```

---

## ✅ Step 4: Verify Extraction

**Run these checks:**

```bash
cd d:\D\kindswap\infra\infra

# Count .tf files (should be 12+)
Get-ChildItem -Recurse -Filter "*.tf" | Measure-Object | Select-Object Count

# Check for main.tf in each layer
Get-ChildItem -Recurse -Filter "main.tf" | ForEach-Object { $_.FullName }

# Verify directory structure
tree /F infra-core/
tree /F infra-k8s/

# Check for .terraform or .tfstate files (should NOT exist - excluded)
Get-ChildItem -Recurse -Filter ".terraform" -Directory | Measure-Object | Select-Object Count
# Should return 0

# Verify no secrets in files
Select-String -Path "*.tf", "*.tfvars" -Pattern "password|secret|AKIA|aws_secret" -Recurse
# Should return no results
```

**Expected Output:**
```
✅ 12+ .tf files found
✅ All directories have main.tf
✅ No .terraform/ directories
✅ No .tfstate files
✅ No secrets detected
```

---

## 🚫 Step 5: Clean Up Sensitive Files

**If any of these exist, REMOVE them:**

```bash
# Remove state files
Remove-Item -Path "**\.terraform\*" -Recurse -Force
Remove-Item -Path "**\terraform.tfstate*" -Recurse -Force

# Remove Terraform cache
Remove-Item -Path "**\.terraform.lock.hcl" -Recurse -Force

# Remove sensitive overrides
Remove-Item -Path "**\override.tf" -Recurse -Force
Remove-Item -Path "**\*_override.tf" -Recurse -Force

# Keep only source .tf files and lock files
Get-ChildItem -Recurse | Where-Object { 
    $_.Name -match "\.tfstate|\.terraform|override" 
} | Remove-Item -Recurse -Force
```

**After cleanup, verify:**
```bash
# Should show only .tf, .tfvars, .tpl, and .hcl files
Get-ChildItem -Recurse -File | ForEach-Object { $_.Extension } | Sort-Object | Get-Unique
# Expected: .exe, .hcl, .tf, .tfvars, .txt, .yaml, .yml (Helm charts)
```

---

## 📝 Step 6: Add Files to Git

```bash
cd d:\D\kindswap

# Check current branch
git branch
# Should show: * feature/cosign-sbom-security-pipeline

# Add all infrastructure files
git add infra/infra/**/*.tf
git add infra/infra/**/*.tfvars
git add infra/infra/**/*.tpl
git add infra/infra/.terraform.lock.hcl  # Lock files are OK to commit

# Verify staged files
git status
# Should show many new files in infra/infra/

# Commit with meaningful message
git commit -m "feat: Add Terraform infrastructure source files

- bootstrap: State backend configuration
- infra-core: VPC, security, EKS, RDS, ECR
- infra-k8s: IRSA, controllers, Karpenter, monitoring, apps
- All .terraform/ and .tfstate files excluded
- No secrets in repository (AWS Secrets Manager configured)

Closes: Infrastructure source code gap"

# Verify commit
git log --oneline -5
# Should show new commit at top
```

---

## 🚀 Step 7: Push to Feature Branch

```bash
# Push to feature branch (where .tf files are staged)
git push origin feature/cosign-sbom-security-pipeline

# Verify push succeeded
git log --oneline origin/feature/cosign-sbom-security-pipeline -3
# Should show the new commit

# Check remote branch has files
git ls-tree -r origin/feature/cosign-sbom-security-pipeline:infra/infra | grep ".tf$" | wc -l
# Should show 12+ files
```

---

## 🔄 Step 8: Create Pull Request

```bash
# Go to GitHub
# https://github.com/hardikjain3810/kindswap_world

# Actions:
1. Click "Compare & pull request"
   - Or manually create from feature/cosign-sbom-security-pipeline → dev

2. Set PR details:
   Title: "Infrastructure: Add Terraform source files from backup"
   
   Description:
   ```
   ## Overview
   Adds complete Terraform source code for KindSwap infrastructure.
   
   ## Changes
   - bootstrap: S3 state backend configuration
   - infra-core: VPC, security groups, EKS cluster, RDS Multi-AZ, ECR
   - infra-k8s: IRSA, controllers (ALB, ESO, CSI), Karpenter, monitoring
   
   ## Infrastructure Components
   - ✅ EKS 1.31 cluster (multi-AZ)
   - ✅ RDS PostgreSQL 16 Multi-AZ (gp3 storage)
   - ✅ VPC with 5 security endpoints
   - ✅ KMS encryption for all data
   - ✅ ECR repositories (4x apps)
   - ✅ Prometheus + Grafana monitoring
   
   ## Security
   - ✅ No secrets in repository (.gitignore configured)
   - ✅ AWS Secrets Manager for credentials
   - ✅ OIDC for GitHub Actions (no long-lived keys)
   
   ## Status
   - Extracted from backup repository
   - Verified no sensitive files
   - Ready for code review and merge
   ```

3. Click "Create pull request"
```

---

## 🔍 Step 9: Validate PR

**Check GitHub PR for:**

- [ ] All changed files are `.tf` files (no state files)
- [ ] No credentials/passwords visible
- [ ] File count matches expected (12+ .tf files)
- [ ] All directories present:
  - [ ] bootstrap
  - [ ] infra-core (01-05)
  - [ ] infra-k8s (01-05)
- [ ] Helm charts NOT included (already in repo)

**If validation fails:**
1. Go back to local repo
2. Remove problematic files
3. Re-commit
4. Force push: `git push -f origin feature/cosign-sbom-security-pipeline`
5. PR will auto-update

---

## ✨ Step 10: Monitor Merge

```bash
# After PR is approved and merged:

# Fetch latest dev branch
git fetch origin dev

# Verify files in dev
git ls-tree -r origin/dev:infra/infra | grep ".tf$" | wc -l
# Should show 12+ files

# Checkout dev locally
git checkout dev
git pull origin dev

# Verify locally
ls -la infra/infra/infra-core/01-networking/main.tf
# Should exist

# Ready for terraform apply
cd infra/infra/bootstrap
terraform init
terraform plan
```

---

## 📊 Verification Checklist

Before declaring success, verify:

- [ ] All 12+ `.tf` files extracted
- [ ] All 5 infra-core layers have main.tf
- [ ] All 5 infra-k8s layers have main.tf
- [ ] bootstrap directory has main.tf
- [ ] No .tfstate files committed
- [ ] No .terraform/ directories committed
- [ ] No secrets (passwords, keys) visible
- [ ] terraform.dev.tfvars exists
- [ ] Helm charts in 05-apps/ NOT overwritten
- [ ] PR created to dev branch
- [ ] All GitHub checks passing
- [ ] PR merged successfully
- [ ] Files visible in dev branch

---

## 🚨 If Something Goes Wrong

### `.tf` files not found in backup repo
```bash
# Search with broader patterns
find . -name "*.tf" 2>/dev/null
find . -path "*terraform*" -name "*.tf" 2>/dev/null
find . -type f -size +100c -name "*" | xargs grep -l "resource\|variable\|output"
```

### Files have secrets
```bash
# Extract and sanitize
grep -l "password\|secret\|key" *.tf | xargs sed -i 's/password = ".*/password = var.db_password/g'
# Remove credentials and use variables instead
```

### Helm charts got overwritten
```bash
# Restore from dev branch
git checkout origin/dev -- infra/infra/infra-k8s/05-apps/helm/

# Re-add .tf files only
git add infra/infra/**/*.tf
git commit --amend
```

### PR won't merge (conflicts)
```bash
# Rebase on latest dev
git fetch origin
git rebase origin/dev feature/cosign-sbom-security-pipeline

# Resolve conflicts
git add .
git rebase --continue

# Force push
git push -f origin feature/cosign-sbom-security-pipeline
```

---

## 📌 Summary

**What you're doing:** Recovering infrastructure-as-code from backup repo  
**Expected output:** 12+ Terraform files in feature branch  
**End result:** All infrastructure documented and version-controlled  

**Success criteria:**
- ✅ All `.tf` files extracted and committed
- ✅ No secrets or credentials exposed
- ✅ PR created and merged to dev
- ✅ System ready for terraform apply/plan

---

**Document Version:** 1.0  
**For:** Backup repository extraction  
**Status:** Complete checklist for .tf file recovery  
