# AWS CONSOLE MFA ENFORCEMENT GUIDE

**Objective:** Enforce mandatory TOTP/U2F MFA for all AWS IAM users  
**Compliance:** SoW v5 - S7 MFA Enforcement  
**Scope:** DevOps team, infrastructure leads, anyone with AWS console access  
**MFA Methods Supported:** TOTP apps (Google Authenticator, Authy) or FIDO2 U2F hardware keys

---

## PART 1: TERRAFORM DEPLOYMENT (Admin Only)

### Step 1.1: Review MFA Enforcement Policy

**File:** `infra/infra/infra-k8s/05-apps/terraform/mfa-enforcement.tf`

```hcl
# MFA Enforcement Policy - Denies all actions unless MFA is present
resource "aws_iam_policy" "mfa_enforcement" {
  name = "kindswap-mfa-enforcement"
  
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyAllExceptListedIfNoMFA"
        Effect = "Deny"
        Action = [
          "iam:*",
          "ec2:*",
          "s3:*",
          "rds:*",
          # ... all services except these:
        ]
        Resource = "*"
        Condition = {
          BoolIfExists = {
            "aws:MultiFactorAuthPresent" = "false"
          }
        }
      }
    ]
  })
}

# DevOps Team Group
resource "aws_iam_group" "devops_team" {
  name = "kindswap-devops-team"
}

# Attach MFA policy to group
resource "aws_iam_group_policy_attachment" "devops_mfa" {
  group      = aws_iam_group.devops_team.name
  policy_arn = aws_iam_policy.mfa_enforcement.arn
}
```

### Step 1.2: Deploy MFA Enforcement Policy

**Prerequisites:**
- Terraform initialized in `infra/infra/infra-k8s/05-apps/`
- AWS credentials configured for us-east-1
- Admin/root access to AWS account

**Deployment commands:**

```bash
# Navigate to Terraform directory
cd infra/infra/infra-k8s/05-apps/terraform

# Initialize (if first time)
terraform init

# Plan (review before applying)
terraform plan -target=aws_iam_policy.mfa_enforcement -target=aws_iam_group.devops_team

# Expected output:
#  + aws_iam_policy.mfa_enforcement
#  + aws_iam_group.devops_team

# Apply
terraform apply -target=aws_iam_policy.mfa_enforcement -target=aws_iam_group.devops_team

# Confirm: Type 'yes' when prompted
```

**Verification after deployment:**

```bash
# Verify policy created
aws iam get-policy --policy-name kindswap-mfa-enforcement

# Expected output:
# {
#   "Policy": {
#     "PolicyName": "kindswap-mfa-enforcement",
#     "Arn": "arn:aws:iam::916994818641:policy/kindswap-mfa-enforcement",
#     ...
#   }
# }

# Verify group created
aws iam get-group --group-name kindswap-devops-team

# Expected output:
# {
#   "Group": {
#     "GroupName": "kindswap-devops-team",
#     "Arn": "arn:aws:iam::916994818641:group/kindswap-devops-team",
#     ...
#   }
# }
```

### Step 1.3: Attach Policy to Users

**Method A: Using AWS CLI (Recommended)**

```bash
# Get list of users who need MFA
aws iam list-users --query 'Users[].UserName' --output text

# For each user that should require MFA:
aws iam add-user-to-group \
  --user-name <USERNAME> \
  --group-name kindswap-devops-team

# Example:
aws iam add-user-to-group --user-name alice@kindswap.com --group-name kindswap-devops-team
aws iam add-user-to-group --user-name bob@kindswap.com --group-name kindswap-devops-team
aws iam add-user-to-group --user-name charlie@kindswap.com --group-name kindswap-devops-team
```

**Method B: Using AWS Console (Manual)**

1. Navigate to [AWS IAM Console](https://console.aws.amazon.com/iam/)
2. Click "User groups" in left menu
3. Click "kindswap-devops-team"
4. Click "Add users"
5. Select all users requiring MFA enforcement
6. Click "Add users"

### Step 1.4: Test MFA Requirement

**Test Case 1: User WITHOUT MFA device configured**

```bash
# Try any AWS API call without MFA token
aws s3 ls --region us-east-1

# Expected result: AccessDeniedException
# Error message: User: arn:aws:iam::916994818641:user/test-user 
#                is not authorized to perform: s3:ListBucket
#                because no MFA device is configured
```

**Test Case 2: User WITH MFA device configured (but no MFA token in request)**

```bash
# Try AWS API call without MFA token
aws iam list-users

# Expected result: AccessDeniedException
# Error message: User is not authorized because MFA authentication is required
```

**Test Case 3: User WITH MFA device and MFA token provided**

```bash
# Get MFA device ARN
DEVICE_ARN=$(aws iam list-mfa-devices --user-name <USERNAME> --query 'MFADevices[0].SerialNumber' --output text)

# Get 6-digit code from authenticator app
# Then run command with MFA token:
aws sts get-caller-identity \
  --serial-number $DEVICE_ARN \
  --token-code <6-DIGIT-CODE>

# Expected result: Success - shows user identity
# {
#   "UserId": "AIDAI1234567890ABCDE",
#   "Account": "916994818641",
#   "Arn": "arn:aws:iam::916994818641:user/test-user"
# }
```

---

## PART 2: USER MFA SETUP (Self-Service)

### Step 2.1: User Creates/Obtains TOTP Device

**All users must complete this before being added to `kindswap-devops-team` group**

**Option A: TOTP App (Recommended)**

**Setup TOTP in Authenticator App:**

1. **Install app:** Google Authenticator, Authy, or Microsoft Authenticator
   - Follow instructions in [Pritunl MFA Setup Guide](./PRITUNL_MFA_SETUP_GUIDE.md) Part 2.2

2. **User navigates to AWS IAM Console:**
   - URL: https://console.aws.amazon.com/iam/

3. **Click username (top-right) → "Security credentials"**

4. **Navigate to "Multi-factor authentication (MFA)"** section

5. **Click "Assign MFA device"**

6. **Select "Authenticator app"** option

7. **In dialog, choose "Authenticator app or compatible application"**

8. **Scan QR code with authenticator app** (or enter manual code)

9. **Enter two 6-digit codes from app** (codes 30 seconds apart)
   - First code: e.g., 123456
   - Wait 30 seconds
   - Second code: e.g., 123498

10. **Click "Assign MFA"** 

**Success message:** "Your virtual MFA device has been successfully assigned"

**Option B: FIDO2 U2F Hardware Key (Enhanced Security)**

**Supported keys:**
- YubiKey 5 series or later
- Google Titan keys
- Other FIDO2-certified hardware keys

**Setup hardware key:**

1. User navigates to AWS IAM Console → "Security credentials"

2. Click "Assign MFA device"

3. Select "Hardware FIDO2 security key"

4. Click "Continue"

5. Insert FIDO2 hardware key into USB port

6. Follow on-screen prompts to authenticate with key

7. Key is now registered with AWS account

**Advantages:**
- ✅ Phishing-proof (key doesn't respond to fake websites)
- ✅ No sync issues (no time-based codes)
- ✅ Works with Pritunl VPN AND AWS Console

### Step 2.2: Verify MFA Device is Registered

**User can verify their MFA device:**

```bash
# List registered MFA devices
aws iam list-mfa-devices --user-name <YOUR_USERNAME>

# Expected output:
# {
#   "MFADevices": [
#     {
#       "UserName": "alice@kindswap.com",
#       "SerialNumber": "arn:aws:iam::916994818641:mfa/alice-authenticator",
#       "EnableDate": "2026-03-28T10:00:00+00:00"
#     }
#   ]
# }
```

### Step 2.3: Test AWS Console Access with MFA

**User can now test console access:**

1. **Log out** of AWS Console (if already logged in)

2. **Navigate to AWS login page:**
   ```
   https://916994818641.signin.aws.amazon.com/console
   ```

3. **Enter IAM username and password**

4. **AWS prompts: "MFA Code"**

5. **Open authenticator app, find AWS MFA entry**
   - Get 6-digit code
   - Code changes every 30 seconds

6. **Enter 6-digit code in AWS prompt**

7. **Click "Submit"**

8. **Success:** User is logged into AWS Console

---

## PART 3: AWS CLI MFA USAGE

### Step 3.1: Install AWS CLI

**Prerequisites:** Python 3.9+ and pip installed

```bash
# Install or upgrade AWS CLI
pip install --upgrade awscli

# Verify installation
aws --version
# Expected: aws-cli/2.x.x
```

### Step 3.2: Configure AWS CLI Credentials

**Create AWS credentials file:**

```bash
# On macOS/Linux:
~/.aws/credentials

# On Windows:
%USERPROFILE%\.aws\credentials
```

**File contents:**

```ini
[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
region = us-east-1
```

### Step 3.3: Obtain Temporary MFA Credentials

**When MFA is required, user must first get temporary credentials:**

```bash
# Get MFA device ARN
DEVICE_ARN=$(aws iam list-mfa-devices --user-name <USERNAME> \
  --query 'MFADevices[0].SerialNumber' --output text)

# Get 6-digit code from authenticator app
MFA_CODE=<6-DIGIT-CODE>

# Request temporary session credentials
aws sts get-session-token \
  --serial-number $DEVICE_ARN \
  --token-code $MFA_CODE \
  --duration-seconds 43200

# Expected output:
# {
#   "Credentials": {
#     "AccessKeyId": "ASIAIOSFODNN7EXAMPLE",
#     "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
#     "SessionToken": "AQoDYXdzEJr...",
#     "Expiration": "2026-03-28T22:00:00Z"
#   }
# }
```

### Step 3.4: Use Temporary Credentials

**Export the returned credentials to environment variables:**

```bash
# macOS/Linux
export AWS_ACCESS_KEY_ID="ASIAIOSFODNN7EXAMPLE"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
export AWS_SESSION_TOKEN="AQoDYXdzEJr..."

# Windows PowerShell
$env:AWS_ACCESS_KEY_ID="ASIAIOSFODNN7EXAMPLE"
$env:AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
$env:AWS_SESSION_TOKEN="AQoDYXdzEJr..."
```

**Now run AWS CLI commands:**

```bash
# Example: List S3 buckets (succeeds with MFA token)
aws s3 ls

# Example: Delete Kubernetes cluster (requires confirmation)
aws eks delete-cluster --name kindswap-prod

# All commands now work with MFA credentials
```

**Credentials expire after 12 hours** - user must repeat Step 3.3 to get fresh credentials

### Step 3.5: Automate MFA Token Entry (Optional)

**For DevOps workflows, create helper script:**

**File: `~/.aws/get-mfa-session.sh` (macOS/Linux)**

```bash
#!/bin/bash

# Usage: source ~/.aws/get-mfa-session.sh
# Gets MFA device, prompts for code, sets environment variables

DEVICE_ARN=$(aws iam list-mfa-devices --user-name $USER \
  --query 'MFADevices[0].SerialNumber' --output text)

echo "Enter 6-digit MFA code from authenticator app:"
read -r MFA_CODE

RESPONSE=$(aws sts get-session-token \
  --serial-number $DEVICE_ARN \
  --token-code $MFA_CODE \
  --duration-seconds 43200)

export AWS_ACCESS_KEY_ID=$(echo $RESPONSE | jq -r '.Credentials.AccessKeyId')
export AWS_SECRET_ACCESS_KEY=$(echo $RESPONSE | jq -r '.Credentials.SecretAccessKey')
export AWS_SESSION_TOKEN=$(echo $RESPONSE | jq -r '.Credentials.SessionToken')

echo "✓ MFA session established (expires in 12 hours)"
```

**Usage:**

```bash
source ~/.aws/get-mfa-session.sh
# Enter code when prompted
# Environment variables are set for 12 hours
```

---

## PART 4: TROUBLESHOOTING

### Issue 1: "User is not authorized to perform: iam:GetUser"

**Symptom:** User can't check their own account details after MFA policy applied

**Cause:** MFA policy denies all IAM actions without MFA

**Solution:**
```bash
# User must first get temporary MFA credentials
# Then all iam: actions work
aws iam get-user --user-name $(aws sts get-caller-identity --query 'Arn' --output text | cut -d'/' -f2)
```

### Issue 2: "MFA token code is invalid"

**Symptom:** Authenticator code entered but "invalid code" error

**Causes:**
1. Device time out of sync
2. Code entered too slowly (after 30-second expiration)
3. Code typed incorrectly

**Solutions:**
```bash
# 1. Sync device time
#    iPhone: Settings → General → Date & Time → Toggle "Set Automatically" OFF then ON
#    Android: Settings → System → Date & time → Toggle "Use network-provided time" OFF then ON
#    macOS: System Preferences → Date & Time → Uncheck "Set date and time automatically" then check again
#    Windows: Settings → Time & Language → Date & Time → Toggle "Set time automatically" OFF then ON

# 2. Type faster - enter code within 15 seconds, not 25+

# 3. Try again with next code (wait 30 seconds)
```

### Issue 3: "MFA device not found"

**Symptom:** `MFADevices` list is empty when running `list-mfa-devices`

**Cause:** No MFA device has been registered yet

**Solution:** User must complete [Step 2.1](#step-21-user-creates-obtains-totp-device)

### Issue 4: "User does not have permissions to perform: sts:GetSessionToken"

**Symptom:** MFA policy prevents calling STS (Security Token Service) API

**Cause:** MFA policy too restrictive - blocks STS before MFA token can be provided

**Solution:** Modify `mfa-enforcement.tf` to exclude STS from initial deny:

```hcl
policy = jsonencode({
  Version = "2012-10-17"
  Statement = [
    {
      Sid       = "AllowSTS"
      Effect    = "Allow"
      Action    = "sts:GetSessionToken"
      Resource  = "*"
    },
    {
      Sid    = "DenyAllExceptListedIfNoMFA"
      Effect = "Deny"
      Action = [
        "iam:*",
        "ec2:*",
        # ... all EXCEPT sts:GetSessionToken
      ]
      Resource = "*"
      Condition = {
        BoolIfExists = {
          "aws:MultiFactorAuthPresent" = "false"
        }
      }
    }
  ]
})
```

### Issue 5: "AccessDenied when calling AssumeRole"

**Symptom:** User can't assume cross-account roles even with MFA

**Cause:** Role trust policy doesn't include MFA requirement or user's MFA device

**Solution:** Update role trust policy to accept MFA-authenticated users:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::916994818641:user/alice@kindswap.com"
      },
      "Action": "sts:AssumeRole",
      "Condition": {
        "Bool": {
          "aws:MultiFactorAuthPresent": "true"
        }
      }
    }
  ]
}
```

---

## PART 5: EMERGENCY ACCESS (No MFA Device)

### Scenario: User Lost Their MFA Device

**Procedure:**

1. **User cannot access AWS Console or CLI** (MFA required)

2. **Contact infrastructure administrator:**
   - Email: infrastructure@kindswap.com
   - Slack: #infrastructure-emergency

3. **Admin deregisters user's MFA device:**

```bash
# Admin only - requires root credentials
aws iam deactivate-mfa-device \
  --user-name alice@kindswap.com \
  --serial-number arn:aws:iam::916994818641:mfa/alice-authenticator
```

4. **Admin temporarily removes user from MFA-required group:**

```bash
aws iam remove-user-from-group \
  --user-name alice@kindswap.com \
  --group-name kindswap-devops-team
```

5. **User sets up new MFA device** ([Step 2.1](#step-21-user-creates-obtains-totp-device))

6. **Admin re-adds user to group:**

```bash
aws iam add-user-to-group \
  --user-name alice@kindswap.com \
  --group-name kindswap-devops-team
```

---

## PART 6: BEST PRACTICES

### ✅ DO:
- ✅ Use hardware keys (U2F) for highest security
- ✅ Store backup codes in encrypted password manager
- ✅ Use automatic date/time on all devices
- ✅ Use different authenticator apps on backup device (for redundancy)
- ✅ Test MFA setup immediately after registration
- ✅ Report lost devices immediately

### ❌ DON'T:
- ❌ Screenshot TOTP codes
- ❌ Share MFA device with others
- ❌ Use generic "AWS" names in authenticator (use "AWS kindswap 916994818641")
- ❌ Manually set device time (use automatic NTP)
- ❌ Store backup codes in unencrypted email
- ❌ Skip MFA setup to "save time" (will lock yourself out)

---

## FAQ

**Q: Do I need MFA for AWS Console AND CLI?**  
A: Yes - MFA policy enforces it for both. AWS Console auto-prompts for MFA. CLI requires manual `sts:GetSessionToken` call with MFA code.

**Q: Can I use Pritunl TOTP device for AWS Console MFA?**  
A: Yes - same RFC 6238 TOTP standard. Register same authenticator app in AWS.

**Q: How long do MFA credentials last?**  
A: 12 hours. After 12 hours, user must provide new MFA code to get fresh credentials.

**Q: What if someone compromises my AWS access key?**  
A: MFA prevents damage - attacker still needs 6-digit MFA code. Rotate access keys immediately.

**Q: Is MFA required for programmatic access (CI/CD)?**  
A: No - use IAM roles with specific permissions instead of long-lived access keys. Roles are MFA-bypass but are more secure for automation.

---

## SUPPORT

**For AWS Console/CLI issues:**
- Infrastructure team: infrastructure@kindswap.com
- AWS Support: [AWS support portal](https://console.aws.amazon.com/support)

**For security incidents:**
- Immediately notify security team
- Revoke compromised credentials: `aws iam delete-access-key`
- Report in #security Slack channel

---

*Last Updated: March 28, 2026*  
*Document Status: Draft for Team Review*  
*MFA Policy: SoW v5 S7 Compliance*
