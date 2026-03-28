# ============================================================================
# AWS MFA ENFORCEMENT CONFIGURATION
# SoW v5 Section S7 — MFA Enforcement (AWS Console)
# ============================================================================
# This Terraform module creates IAM policies and configurations for MFA
# enforcement on AWS Console access.

# MFA Enforcement Policy — Deny all AWS API calls without MFA token
resource "aws_iam_policy" "mfa_enforcement" {
  name        = "kindswap-mfa-enforcement-policy"
  description = "Enforce MFA for AWS Console access (SoW v5 S7)"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowListingInConsole"
        Effect = "Allow"
        Action = [
          "iam:ListUsers",
          "iam:ListVirtualMFADevices",
          "iam:ListMFADevices",
          "iam:GetUser",
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowManagingOwnVirtualMFADevice"
        Effect = "Allow"
        Action = [
          "iam:CreateVirtualMFADevice",
          "iam:DeleteVirtualMFADevice",
        ]
        Resource = "arn:aws:iam::*:mfa/$${aws:username}"
      },
      {
        Sid    = "AllowManagingOwnUserMFA"
        Effect = "Allow"
        Action = [
          "iam:DeactivateMFADevice",
          "iam:GetUser",
          "iam:ListMFADevices",
          "iam:ResyncMFADevice",
          "sts:GetSessionToken",
        ]
        Resource = "arn:aws:iam::*:user/$${aws:username}"
      },
      {
        Sid    = "DenyEverythingExceptListedIfNoMFA"
        Effect = "Deny"
        NotAction = [
          "iam:CreateVirtualMFADevice",
          "iam:EnableMFADevice",
          "iam:GetUser",
          "iam:ListMFADevices",
          "iam:ListUsers",
          "iam:ResyncMFADevice",
          "sts:GetSessionToken",
        ]
        Resource = "*"
        Condition = {
          BoolIfExists = {
            "aws:MultiFactorAuthPresent" = "false"
          }
        }
      },
    ]
  })

  tags = {
    Name    = "kindswap-mfa-enforcement"
    Purpose = "Enforce MFA for all console access"
  }
}

# Example: Attach MFA enforcement policy to DevOps team group
# NOTE: Manually assign this policy to IAM users/groups in AWS Console
resource "aws_iam_group" "devops_team" {
  name = "kindswap-devops-team"
  path = "/teams/"
}

resource "aws_iam_group_policy_attachment" "devops_mfa" {
  group      = aws_iam_group.devops_team.name
  policy_arn = aws_iam_policy.mfa_enforcement.arn
}

# CloudWatch alarm for MFA enforcement failures
resource "aws_cloudwatch_metric_alarm" "mfa_enforcement_failures" {
  alarm_name          = "kindswap-mfa-enforcement-failures"
  alarm_description   = "Alert on MFA enforcement policy denials"
  namespace           = "AWS/CloudTrail"
  metric_name         = "UserAPICallsWithoutMFA"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 5
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"

  tags = {
    Name = "kindswap-mfa-enforcement-monitoring"
  }
}

output "mfa_policy_arn" {
  description = "ARN of the MFA enforcement policy"
  value       = aws_iam_policy.mfa_enforcement.arn
}

output "mfa_policy_id" {
  description = "ID of the MFA enforcement policy"
  value       = aws_iam_policy.mfa_enforcement.id
}

output "devops_group_arn" {
  description = "ARN of DevOps team group"
  value       = aws_iam_group.devops_team.arn
}
