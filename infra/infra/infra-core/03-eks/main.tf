# ============================================================================
# EKS CLUSTER AND CORE INFRASTRUCTURE
# ============================================================================

# Data sources for AWS account and region
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# Remote state references for networking and security layers
data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/networking/terraform.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "security" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/security/terraform.tfstate"
    region = "us-east-1"
  }
}

# ============================================================================
# SECTION 1 — CLOUDWATCH LOG GROUP FOR EKS CONTROL PLANE
# ============================================================================
# Logs all control plane events (api, audit, authenticator, controllerManager, scheduler)
# Retention: 30 days, encrypted with KMS master key
resource "aws_cloudwatch_log_group" "eks_cluster" {
  name              = "/aws/eks/kindswap-cluster/cluster"
  retention_in_days = 30
  kms_key_id        = data.terraform_remote_state.security.outputs.kms_key_arn

  tags = {
    Name      = "kindswap-eks-cluster-logs"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "03-eks"
  }
}

# ============================================================================
# SECTION 2 — EKS CLUSTER
# ============================================================================
# Production EKS cluster with:
# - KMS envelope encryption for Kubernetes secrets
# - All control plane logging to CloudWatch
# - Access Entries API (modern approach, not deprecated aws-auth ConfigMap)
# - IMDSv2 enforcement on nodes
# - Private and public endpoint access
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  version  = var.cluster_version
  role_arn = data.terraform_remote_state.security.outputs.eks_cluster_role_arn

  vpc_config {
    subnet_ids              = data.terraform_remote_state.networking.outputs.private_app_subnet_ids
    security_group_ids      = [data.terraform_remote_state.security.outputs.eks_cluster_sg_id]
    endpoint_private_access = true
    endpoint_public_access  = true
  }

  # KMS envelope encryption for all Kubernetes secrets at rest
  encryption_config {
    provider {
      key_arn = data.terraform_remote_state.security.outputs.kms_key_arn
    }
    resources = ["secrets"]
  }

  # Enable all control plane logging to CloudWatch
  enabled_cluster_log_types = ["api", "audit", "authenticator", "controllerManager", "scheduler"]

  # Modern Access Entries API approach (replaces deprecated aws-auth ConfigMap)
  # bootstrap_cluster_creator_admin_permissions = true grants the Terraform executor cluster-admin
  access_config {
    authentication_mode                         = "API"
    bootstrap_cluster_creator_admin_permissions = true
  }

  tags = {
    Name      = var.cluster_name
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "03-eks"
  }

  depends_on = [aws_cloudwatch_log_group.eks_cluster]
}

# ============================================================================
# SECTION 3 — OIDC PROVIDER FOR IRSA (IAM Roles for Service Accounts)
# ============================================================================
# Fetch the TLS certificate thumbprint for the OIDC issuer
# IRSA roles in downstream modules (01-irsa) will trust this provider
data "tls_certificate" "eks_cluster" {
  url = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

resource "aws_iam_openid_connect_provider" "eks_cluster" {
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.eks_cluster.certificates[0].sha1_fingerprint]
  url             = aws_eks_cluster.main.identity[0].oidc[0].issuer

  tags = {
    Name      = "kindswap-eks-oidc"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "03-eks"
  }
}

# ============================================================================
# SECTION 4 — LAUNCH TEMPLATE FOR CORE NODE GROUP
# ============================================================================
# Security hardening:
# - IMDSv2 required (no IMDSv1 fallback)
# - EBS encryption at rest with KMS master key
# - 50 GB gp3 volume (sufficient for system components)
# - CloudWatch detailed monitoring enabled
resource "aws_launch_template" "core_nodes" {
  name_prefix   = "kindswap-core-nodes-"
  description   = "Launch template for KindSwap EKS core system node group"

  # Enforce IMDSv2 only for security hardening
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"    # IMDSv2 required
    http_put_response_hop_limit = 2             # Required for pod IMDS access
    instance_metadata_tags      = "enabled"
  }

  # Root volume encryption and sizing
  block_device_mappings {
    device_name = "/dev/xvda"
    ebs {
      volume_size           = 50
      volume_type           = "gp3"
      encrypted             = true
      # Use AWS-managed encryption (aws/ebs) instead of customer-managed KMS key
      # to avoid KMS key state issues that block node launches
      delete_on_termination = true
    }
  }

  # CloudWatch detailed monitoring
  monitoring {
    enabled = true
  }

  # Tag all instances created from this template
  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "kindswap-core-node"
      NodeGroup   = "kindswap-core-nodes"
      Environment = "all"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ============================================================================
# SECTION 5 — CORE NODE GROUP (ON_DEMAND — System Controllers Only)
# ============================================================================
# Purpose: Run system-critical pods (DNS, logging, monitoring, etc.)
# Capacity: ON_DEMAND only (never Spot-evicted, critical for cluster stability)
# Tainting: CriticalAddonsOnly — application pods go to Karpenter nodes
# Scaling: 2 desired, 1 min, 4 max (handles node updates with one rolling at a time)
resource "aws_eks_node_group" "core_nodes" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "kindswap-core-nodes"
  node_role_arn   = data.terraform_remote_state.security.outputs.eks_node_role_arn
  subnet_ids      = data.terraform_remote_state.networking.outputs.private_app_subnet_ids

  # ON_DEMAND only — system controllers must never be Spot-evicted
  capacity_type  = "ON_DEMAND"
  instance_types = [var.core_node_instance_type]

  scaling_config {
    desired_size = var.core_node_desired_size
    min_size     = var.core_node_min_size
    max_size     = var.core_node_max_size
  }

  update_config {
    max_unavailable = 1
  }

  # Taint to ensure only system/controller pods land here
  # Application pods go on Karpenter-managed nodes
  taint {
    key    = "CriticalAddonsOnly"
    value  = "true"
    effect = "NO_SCHEDULE"
  }

  launch_template {
    id      = aws_launch_template.core_nodes.id
    version = aws_launch_template.core_nodes.latest_version
  }

  # Labels for node selection by system controllers
  labels = {
    "role"                          = "system"
    "node-type"                     = "core"
  }

  tags = {
    Name                            = "kindswap-core-nodes"
    Project                         = var.project
    ManagedBy                       = "Terraform"
    Module                          = "03-eks"
    "karpenter.sh/discovery"        = var.cluster_name
  }

  depends_on = [aws_eks_cluster.main]
}

# ============================================================================
# SECTION 6 — EBS CSI DRIVER ADDON
# ============================================================================
# Required for dynamic PersistentVolume provisioning (databases, caches, etc.)
# Addon version: v1.56.0-eksbuild.1 (latest compatible with EKS 1.31)
# Note: IRSA role for EBS CSI will be created in 02-controllers module
# NOTE: Addon creation handled in 02-controllers module after IRSA is configured
# This prevents timeout issues when addon tries to create service accounts
# before IAM roles for service accounts are available.
#
# resource "aws_eks_addon" "ebs_csi_driver" {
#   cluster_name             = aws_eks_cluster.main.name
#   addon_name               = "aws-ebs-csi-driver"
#   addon_version            = "v1.56.0-eksbuild.1"
#   resolve_conflicts_on_update = "OVERWRITE"
#
#   timeouts {
#     create = "30m"
#   }
#
#   tags = {
#     Name      = "kindswap-ebs-csi-driver"
#     Project   = var.project
#     ManagedBy = "Terraform"
#     Module    = "03-eks"
#   }
#
#   depends_on = [aws_eks_node_group.core_nodes]
# }

# ============================================================================
# SECTION 7 — KARPENTER IAM ROLES AND PERMISSIONS
# ============================================================================

# IRSA role for Karpenter controller
# Karpenter needs EC2 fleet management permissions to provision nodes
# Trust: EKS OIDC provider, service account: system:karpenter:karpenter
data "aws_iam_policy_document" "karpenter_controller_assume_role" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.eks_cluster.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "${replace(aws_iam_openid_connect_provider.eks_cluster.url, "https://", "")}:sub"
      values   = ["system:serviceaccount:karpenter:karpenter"]
    }
    condition {
      test     = "StringEquals"
      variable = "${replace(aws_iam_openid_connect_provider.eks_cluster.url, "https://", "")}:aud"
      values   = ["sts.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "karpenter_controller" {
  name               = "kindswap-karpenter-controller"
  assume_role_policy = data.aws_iam_policy_document.karpenter_controller_assume_role.json

  tags = {
    Name      = "kindswap-karpenter-controller"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "03-eks"
  }
}

# Karpenter controller inline policy
# Permissions: EC2 fleet management, PassRole for node role, EKS cluster lookup, SSM AMI queries, SQS interruption
resource "aws_iam_role_policy" "karpenter_controller" {
  name = "kindswap-karpenter-controller-policy"
  role = aws_iam_role.karpenter_controller.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # EC2 fleet management — Karpenter needs these to provision nodes
      {
        Sid    = "Karpenter"
        Effect = "Allow"
        Action = [
          "ec2:CreateFleet",
          "ec2:CreateLaunchTemplate",
          "ec2:CreateTags",
          "ec2:DeleteLaunchTemplate",
          "ec2:DescribeAvailabilityZones",
          "ec2:DescribeImages",
          "ec2:DescribeInstances",
          "ec2:DescribeInstanceTypeOfferings",
          "ec2:DescribeInstanceTypes",
          "ec2:DescribeLaunchTemplates",
          "ec2:DescribeSecurityGroups",
          "ec2:DescribeSpotPriceHistory",
          "ec2:DescribeSubnets",
          "ec2:RunInstances",
          "ec2:TerminateInstances"
        ]
        Resource = "*"
      },
      # Pass node role to EC2 instances Karpenter provisions
      {
        Sid    = "PassNodeInstanceRole"
        Effect = "Allow"
        Action = "iam:PassRole"
        Resource = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${data.terraform_remote_state.security.outputs.eks_node_role_name}"
      },
      # EKS access — Karpenter needs to manage node lifecycle
      {
        Sid    = "EKSClusterEndpointLookup"
        Effect = "Allow"
        Action = ["eks:DescribeCluster"]
        Resource = "arn:aws:eks:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:cluster/${var.cluster_name}"
      },
      # SSM for getting the latest EKS-optimized AMI
      {
        Sid    = "SSMGetParameter"
        Effect = "Allow"
        Action = ["ssm:GetParameter"]
        Resource = "arn:aws:ssm:${data.aws_region.current.name}::parameter/aws/service/eks/optimized-ami/*"
      },
      # Spot interruption handling via SQS
      {
        Sid    = "AllowInterruptionQueueActions"
        Effect = "Allow"
        Action = ["sqs:DeleteMessage", "sqs:GetQueueAttributes", "sqs:GetQueueUrl", "sqs:ReceiveMessage"]
        Resource = aws_sqs_queue.karpenter_interruption.arn
      }
    ]
  })
}

# ============================================================================
# SECTION 8 — KARPENTER SPOT INTERRUPTION SQS QUEUE
# ============================================================================
# SQS queue for Karpenter to receive Spot interruption notices
# EventBridge forwards EC2 Spot interruption warnings and state changes
# Without this, Spot instances are terminated abruptly without graceful drainage
resource "aws_sqs_queue" "karpenter_interruption" {
  name                      = "kindswap-karpenter-interruption"
  message_retention_seconds = 300
  sqs_managed_sse_enabled   = true

  tags = {
    Name      = "kindswap-karpenter-interruption"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "03-eks"
  }
}

# SQS queue policy — allow EventBridge to send messages
resource "aws_sqs_queue_policy" "karpenter_interruption" {
  queue_url = aws_sqs_queue.karpenter_interruption.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = ["events.amazonaws.com", "sqs.amazonaws.com"]
      }
      Action   = "sqs:SendMessage"
      Resource = aws_sqs_queue.karpenter_interruption.arn
    }]
  })
}

# ============================================================================
# SECTION 9 — EVENTBRIDGE RULES FOR SPOT INTERRUPTION AND STATE CHANGES
# ============================================================================

# Rule 1: EC2 Spot Instance Interruption Warning
# Triggered when AWS detects a Spot instance will be interrupted within 2 minutes
resource "aws_cloudwatch_event_rule" "karpenter_spot_interruption" {
  name        = "kindswap-karpenter-spot-interruption"
  description = "Karpenter spot instance interruption notice"

  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["EC2 Spot Instance Interruption Warning"]
  })
}

resource "aws_cloudwatch_event_target" "karpenter_spot_interruption" {
  rule = aws_cloudwatch_event_rule.karpenter_spot_interruption.name
  arn  = aws_sqs_queue.karpenter_interruption.arn
}

# Rule 2: EC2 Instance State Changes
# Triggered when instances enter stopped, stopping, terminated, terminating, or stopping-on-reboot states
resource "aws_cloudwatch_event_rule" "karpenter_instance_state" {
  name        = "kindswap-karpenter-instance-state"
  description = "Karpenter EC2 instance state change"

  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["EC2 Instance State-change Notification"]
  })
}

resource "aws_cloudwatch_event_target" "karpenter_instance_state" {
  rule = aws_cloudwatch_event_rule.karpenter_instance_state.name
  arn  = aws_sqs_queue.karpenter_interruption.arn
}

# ============================================================================
# SECTION 10 — EKS ACCESS ENTRY FOR GITHUB ACTIONS
# ============================================================================
# Grant GitHub Actions OIDC role cluster-admin access via Access Entries API
# This replaces the deprecated aws-auth ConfigMap approach
# Used for: CD pipeline, infrastructure automation, cluster management
resource "aws_eks_access_entry" "github_actions" {
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = data.terraform_remote_state.security.outputs.github_actions_role_arn
  type          = "STANDARD"

  tags = {
    Name      = "kindswap-github-actions-access"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "03-eks"
  }
}

# Attach cluster-admin policy to GitHub Actions access entry
resource "aws_eks_access_policy_association" "github_actions_admin" {
  cluster_name  = aws_eks_cluster.main.name
  principal_arn = data.terraform_remote_state.security.outputs.github_actions_role_arn
  policy_arn    = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"

  access_scope {
    type = "cluster"
  }

  depends_on = [aws_eks_access_entry.github_actions]
}



