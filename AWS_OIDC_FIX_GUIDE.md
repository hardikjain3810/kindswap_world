# AWS OIDC Authentication Fix Guide

**Issue:** GitHub Actions workflows are failing with:  
```
Error: Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity
```

**Root Cause:** AWS OIDC provider or IAM role trust relationship is misconfigured.

---

## 🔍 Diagnosis Checklist

### 1. Verify GitHub OIDC Provider Exists in AWS

**Action:** Log in to AWS Console → IAM → Identity Providers

**Expected Result:**
- See provider: `https://token.actions.githubusercontent.com`
- Thumbprint: `6938fd4d98bab03faadb97b34396831e3780aea1` (or check if it's there)

**If not found:** Create it:
```bash
aws iam create-open-id-connect-provider \
    --url https://token.actions.githubusercontent.com \
    --client-id-list sts.amazonaws.com \
    --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1 \
    --region us-east-1
```

---

### 2. Verify IAM Role Exists

**Action:** AWS Console → IAM → Roles

**Expected Result:**
- See role: `kindswap-github-actions-role`
- Trust relationship should allow GitHub Actions

**Role Trust Policy (should look like):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::916994818641:oidc-provider/token.actions.githubusercontent.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:hardikjain3810/kindswap_world:ref:refs/heads/*"
        }
      }
    }
  ]
}
```

**If role doesn't exist or trust policy is wrong:**

Create or update with this AWS CLI command:
```bash
# Create the IAM role with correct trust policy
aws iam create-role \
    --role-name kindswap-github-actions-role \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Federated": "arn:aws:iam::916994818641:oidc-provider/token.actions.githubusercontent.com"
          },
          "Action": "sts:AssumeRoleWithWebIdentity",
          "Condition": {
            "StringEquals": {
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
              "token.actions.githubusercontent.com:sub": "repo:hardikjain3810/kindswap_world:ref:refs/heads/*"
            }
          }
        }
      ]
    }' \
    --region us-east-1
```

---

### 3. Verify IAM Role Has Required Permissions

**Action:** AWS Console → IAM → Roles → kindswap-github-actions-role → Permissions

**Required Policies:**
- `AmazonEC2ContainerRegistryPowerUser` (for ECR push/pull)
- `AmazonEKSServiceRolePolicy` (for EKS access)
- `AmazonS3FullAccess` or scoped S3 policy (for SBOM bucket)
- `AWSKeyManagementServicePowerUserPolicy` (for KMS)

**Attach policies:**
```bash
# ECR access
aws iam attach-role-policy \
    --role-name kindswap-github-actions-role \
    --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

# EKS access  
aws iam attach-role-policy \
    --role-name kindswap-github-actions-role \
    --policy-arn arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy

# S3 access (for SBOM)
aws iam attach-role-policy \
    --role-name kindswap-github-actions-role \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

# KMS access
aws iam attach-role-policy \
    --role-name kindswap-github-actions-role \
    --policy-arn arn:aws:iam::aws:policy/AWSKeyManagementServicePowerUserPolicy
```

---

### 4. Verify GitHub Repository Secrets

**Action:** GitHub → kindswap_world → Settings → Secrets and variables → Actions

**Required Secrets:**
- ✅ `AWS_ACCOUNT_ID` = `916994818641`
- ✅ `COSIGN_PRIVATE_KEY` = [from AWS Secrets Manager]
- ✅ `COSIGN_PASSWORD` = [from AWS Secrets Manager]

**If missing, add them:**
```bash
# Get COSIGN keys from AWS
aws secretsmanager get-secret-value \
    --secret-id kindswap/cosign/private-key \
    --query SecretString \
    --output text \
    --region us-east-1

# Copy the output and paste into GitHub Secret: COSIGN_PRIVATE_KEY
```

---

## ✅ Verification Steps

### Step 1: Create a test workflow file

Create `.github/workflows/test-oidc.yml`:

```yaml
name: Test OIDC Connection

on:
  workflow_dispatch:

permissions:
  id-token: write
  contents: read

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::916994818641:role/kindswap-github-actions-role
          aws-region: us-east-1
      
      - name: Test AWS connection
        run: |
          echo "✅ AWS OIDC connection successful!"
          aws sts get-caller-identity
          aws ecr describe-repositories --region us-east-1 | jq '.repositories[].repositoryName'
```

### Step 2: Manually trigger the test

1. Go to GitHub → Actions → "Test OIDC Connection" 
2. Click **Run workflow** button
3. Select `dev` branch → **Run workflow**

### Step 3: Check logs

If successful, you should see:
```
✅ AWS OIDC connection successful!
{
    "UserId": "AIDAI...",
    "Account": "916994818641",
    "Arn": "arn:aws:iam::916994818641:role/kindswap-github-actions-role"
}

kindswap-backend
kindswap-admin-backend
kindswap-frontend
kindswap-admin-frontend
```

---

## 🚀 Once OIDC is Fixed

Re-run all 4 failing deployment workflows:

1. Trigger all 4 deployments to `dev`:
   ```bash
   cd d:\D\kindswap
   git checkout dev
   git commit --allow-empty -m "retry: redeploy all 4 apps to dev"
   git push origin dev
   ```

2. Monitor GitHub Actions: https://github.com/hardikjain3810/kindswap_world/actions

3. All should now succeed with:
   - ✅ Build successful
   - ✅ Image pushed to ECR  
   - ✅ Cosign signing successful
   - ✅ SBOM generated
   - ✅ Helm deployment to EKS
   - ✅ Health checks passed

---

## 🆘 Troubleshooting

### Error: "Trust policy does not grant the required permissions"

**Fix:** Update role trust policy. The `sub` condition might be too restrictive.

For branches (dev, main, etc.), the condition should be:
```json
"token.actions.githubusercontent.com:sub": "repo:hardikjain3810/kindswap_world:ref:refs/heads/*"
```

### Error: "User: arn:aws:iam::...role/kindswap-github-actions-role is not authorized"

**Fix:** The role exists but doesn't have permissions. Verify policies are attached (see Step 3 above).

### Error: "The specified OIDC provider does not exist"

**Fix:** Create the OIDC provider first (see Step 1 above).

---

## 📝 Summary of Changes Made

Once you complete this guide:
- ✅ GitHub can authenticate with AWS via OIDC (no long-lived keys)
- ✅ All 4 deployment workflows will succeed
- ✅ Images build → push to ECR → sign with Cosign → deploy to EKS
- ✅ Each deployment tagged with commit SHA (immutable versions)
