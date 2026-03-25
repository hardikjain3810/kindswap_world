# ============================================================================
# SECTION 1 — FOUR ECR REPOSITORIES
# ============================================================================

locals {
  ecr_repositories = {
    "kindswap-backend" = {
      description = "KindSwap NestJS swap backend - node:20-slim runtime"
    }
    "kindswap-frontend" = {
      description = "KindSwap React/Vite frontend - nginx:alpine runtime"
    }
    "kindswap-admin-backend" = {
      description = "KindSwap NestJS admin API - node:20-slim runtime"
    }
    "kindswap-admin-frontend" = {
      description = "KindSwap React admin panel - nginx:alpine runtime"
    }
  }
}

resource "aws_ecr_repository" "repos" {
  for_each = local.ecr_repositories

  name                 = each.key
  image_tag_mutability = "IMMUTABLE"    # Tags cannot be overwritten — SHA tags only

  # scan_on_push using image_scanning_configuration block
  # NOT the deprecated image_scanning_on_push top-level argument
  image_scanning_configuration {
    scan_on_push = true
  }

  # Encrypt images at rest with KMS CMK
  encryption_configuration {
    encryption_type = "KMS"
    kms_key         = data.terraform_remote_state.security.outputs.kms_key_arn
  }

  tags = {
    Name        = each.key
    Description = each.value.description
  }
}

# ============================================================================
# SECTION 2 — LIFECYCLE POLICIES (all 4 repos)
# ============================================================================

resource "aws_ecr_lifecycle_policy" "repos" {
  for_each = local.ecr_repositories

  repository = aws_ecr_repository.repos[each.key].name

  policy = jsonencode({
    rules = [
      {
        # Rule 1: Keep last 10 tagged images (SHA tags matching commit hash pattern)
        rulePriority = 1
        description  = "Keep last 10 tagged images (SHA tags)"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["sha256", "v"]    # SHA-tagged and version-tagged
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      },
      {
        # Rule 2: Expire untagged images after 1 day
        # These are intermediate build layers with no tag — waste of storage
        rulePriority = 2
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 1
        }
        action = { type = "expire" }
      }
    ]
  })
}

# ============================================================================
# SECTION 3 — ECR REPOSITORY POLICY (GitHub Actions access)
# ============================================================================

# Grant the GitHub Actions IAM role push/pull access to all 4 repos via a resource-based policy

resource "aws_ecr_repository_policy" "repos" {
  for_each = local.ecr_repositories

  repository = aws_ecr_repository.repos[each.key].name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowGitHubActionsAccess"
        Effect = "Allow"
        Principal = {
          AWS = data.terraform_remote_state.security.outputs.github_actions_role_arn
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeRepositories",
          "ecr:DescribeImages",
          "ecr:DescribeImageScanFindings",   # Required for CVE gate in CI/CD
          "ecr:ListImages"
        ]
      },
      {
        Sid    = "AllowEKSNodesPull"
        Effect = "Allow"
        Principal = {
          # EKS nodes pull images to run pods
          # The node role ARN comes from the security module
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability"
        ]
      }
    ]
  })
}

# ============================================================================
# SECTION 4 — ECR PULL THROUGH CACHE (optional but include)
# ============================================================================

# Pull-through cache for Docker Hub and public ECR
# Requires authenticated Docker Hub credentials in Secrets Manager
# Disabled for now — can be re-enabled after providing Docker Hub credentials
# Reduces external dependency and potential rate limiting
# Requires ECR permission ecr:CreatePullThroughCacheRule
#
# TODO: Enable this after adding Docker Hub credentials to Secrets Manager
# resource "aws_ecr_pull_through_cache_rule" "docker_hub" {
#   ecr_repository_prefix = "docker-hub"
#   upstream_registry_url = "registry-1.docker.io"
#   credential_arn        = aws_secretsmanager_secret.docker_hub_credentials.arn
# }

# ============================================================================
# SECTION 5 — ECR SCANNING CONFIGURATION (registry-level)
# ============================================================================

# Enable enhanced scanning at the registry level
# This supplements per-repository scan_on_push
#
# NOTE: This requires Amazon Inspector to be enabled in the account.
# If you see an error about Inspector not being enabled, change scan_type to "BASIC"
# and enable Inspector separately via the Inspector console or API.
resource "aws_ecr_registry_scanning_configuration" "main" {
  scan_type = "ENHANCED"    # Uses Amazon Inspector — more comprehensive than BASIC

  rule {
    scan_frequency = "SCAN_ON_PUSH"
    repository_filter {
      filter      = "kindswap-*"    # Applies to all kindswap repos
      filter_type = "WILDCARD"
    }
  }
}

# ============================================================================
# SECTION 6 — CLOUDWATCH ALARM FOR CRITICAL CVE
# ============================================================================

# Alarm when any Critical CVE is found in any ECR repository
# This supplements the CI/CD pipeline CVE gate
resource "aws_cloudwatch_metric_alarm" "ecr_critical_cve" {
  alarm_name          = "kindswap-ecr-critical-cve"
  alarm_description   = "Critical CVE found in ECR image scan - block deployment and investigate immediately"
  namespace           = "AWS/Inspector2"
  metric_name         = "CriticalFindingsCount"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = []    # SNS topic added in monitoring module

  tags = { Name = "kindswap-ecr-critical-cve" }
}

# ============================================================================
# DATA SOURCES
# ============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

data "terraform_remote_state" "security" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/security/terraform.tfstate"
    region = "us-east-1"
  }
}

