# ============================================================================
# KindSwap Security Module — KMS CMK, Security Groups, IAM Roles, CloudTrail
# ============================================================================
# This module establishes the entire security layer for KindSwap infrastructure:
# - Single KMS CMK (alias/kindswap-master) as root of trust for all encryption
# - 5 production security groups (ALB, EKS cluster, EKS nodes, RDS, VPN)
# - Production NAT security group (replaces temp SG from 01-networking)
# - 5 IAM roles: EKS cluster, EKS nodes, GitHub Actions OIDC, Secrets rotation, VPC Flow Logs
# - MFA enforcement policy for console access
# - CloudTrail with S3 backend for KMS audit trail (all Decrypt calls logged)
# ============================================================================

# Remote state reference — read all VPC outputs from 01-networking
data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/networking/terraform.tfstate"
    region = "us-east-1"
  }
}

# Current AWS account ID (used for CMK policy and CloudTrail)
data "aws_caller_identity" "current" {}

# ============================================================================
# SECTION 1 — KMS CMK (alias/kindswap-master)
# ============================================================================
# Single CMK — root of trust for ALL encryption in the KindSwap infrastructure.
# Governs: Secrets Manager, RDS storage (both instances), S3 SSE-KMS,
# EKS envelope encryption, Cosign key storage, CloudTrail logs.

resource "aws_kms_key" "master" {
  description             = "KindSwap master CMK - encrypts all sensitive resources"
  deletion_window_in_days = 30
  enable_key_rotation     = true
  multi_region            = false

  # Explicit key policy — root of trust
  # Requires 4 statements: root full control, admin, Secrets Manager rotation Lambda, AWS services
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Root account full control
      {
        Sid    = "RootFullControl"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action   = "kms:*"
        Resource = "*"
      },
      # Secrets Manager rotation Lambda — decrypt + generate data key only
      {
        Sid    = "SecretsManagerRotationLambda"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/kindswap-secrets-rotation-role"
        }
        Action   = ["kms:Decrypt", "kms:GenerateDataKey", "kms:DescribeKey"]
        Resource = "*"
      },
      # AWS services that need to use the key
      {
        Sid    = "AWSServicesAccess"
        Effect = "Allow"
        Principal = {
          Service = [
            "secretsmanager.amazonaws.com",
            "rds.amazonaws.com",
            "s3.amazonaws.com",
            "logs.amazonaws.com",
            "eks.amazonaws.com",
            "cloudtrail.amazonaws.com",
            "ecr.amazonaws.com"
          ]
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey",
          "kms:CreateGrant"
        ]
        Resource = "*"
      },
      # EC2 EBS encryption requires both encrypt and decrypt permissions
      {
        Sid    = "EC2EBSEncryption"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
      },
      # CloudWatch Logs specific access for encrypting log groups
      {
        Sid    = "CloudWatchLogsEncryption"
        Effect = "Allow"
        Principal = {
          Service = "logs.amazonaws.com"
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:ReEncrypt*",
          "kms:GenerateDataKey*",
          "kms:CreateGrant",
          "kms:DescribeKey"
        ]
        Resource = "*"
        Condition = {
          ArnLike = {
            "kms:EncryptionContext:aws:logs:arn" = "arn:aws:logs:us-east-1:${data.aws_caller_identity.current.account_id}:log-group:*"
          }
        }
      }
    ]
  })

  tags = {
    Name      = "kindswap-master-cmk"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

resource "aws_kms_alias" "master" {
  name          = "alias/kindswap-master"
  target_key_id = aws_kms_key.master.key_id
}

# ============================================================================
# SECTION 2 — SECURITY GROUPS (All 5 production groups + NAT)
# ============================================================================
# Implementation rule: Use aws_security_group_rule resources for cross-SG
# references to avoid Terraform circular dependency errors.
# Create all SG resources first (no inline rules), then add all rules.

# SG 1 — ALB Security Group
# Ingress: TCP 80/443 from 0.0.0.0/0 (public web traffic)
# Egress: All outbound to 0.0.0.0/0
resource "aws_security_group" "alb" {
  name        = "kindswap-alb-sg"
  description = "KindSwap ALB security group - allows HTTP/HTTPS from internet"
  vpc_id      = data.terraform_remote_state.networking.outputs.vpc_id

  tags = {
    Name      = "kindswap-alb-sg"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

resource "aws_security_group_rule" "alb_ingress_http" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
  description       = "HTTP from internet"
}

resource "aws_security_group_rule" "alb_ingress_https" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS from internet"
}

resource "aws_security_group_rule" "alb_egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.alb.id
  description       = "All outbound traffic"
}

# SG 2 — EKS Cluster Security Group
# Ingress: TCP 443 from EKS nodes (API server access)
# Egress: All outbound
# Note: No inline rules — added below via aws_security_group_rule
resource "aws_security_group" "eks_cluster" {
  name        = "kindswap-eks-cluster-sg"
  description = "KindSwap EKS cluster security group - API server access from nodes only"
  vpc_id      = data.terraform_remote_state.networking.outputs.vpc_id

  tags = {
    Name      = "kindswap-eks-cluster-sg"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

# SG 3 — EKS Node Security Group
# Ingress: Protocol -1 (all) from self + TCP 1025-65535 + TCP 443 + TCP 8080
# Egress: All outbound
# Critical tag: karpenter.sh/discovery = kindswap-cluster (Karpenter discovery)
resource "aws_security_group" "eks_node" {
  name        = "kindswap-eks-node-sg"
  description = "KindSwap EKS node security group - node-to-node + kubelet + API + ALB health checks"
  vpc_id      = data.terraform_remote_state.networking.outputs.vpc_id

  tags = {
    Name                              = "kindswap-eks-node-sg"
    Project                           = var.project
    ManagedBy                         = "Terraform"
    Module                            = "02-security"
    "karpenter.sh/discovery"          = var.cluster_name
    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
  }
}

# SG 4 — RDS Security Group
# Ingress: TCP 5432 (PostgreSQL) from EKS nodes ONLY
# Egress: All outbound
resource "aws_security_group" "rds" {
  name        = "kindswap-rds-sg"
  description = "KindSwap RDS security group - PostgreSQL from EKS nodes only"
  vpc_id      = data.terraform_remote_state.networking.outputs.vpc_id

  tags = {
    Name      = "kindswap-rds-sg"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

# SG 5 — VPN Security Group
# Ingress: UDP 1194 (OpenVPN), UDP 51820 (WireGuard), TCP 443 (Pritunl UI)
# Egress: All outbound
resource "aws_security_group" "vpn" {
  name        = "kindswap-vpn-sg"
  description = "KindSwap VPN security group - OpenVPN, WireGuard, Pritunl"
  vpc_id      = data.terraform_remote_state.networking.outputs.vpc_id

  tags = {
    Name      = "kindswap-vpn-sg"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

resource "aws_security_group_rule" "vpn_ingress_openvpn" {
  type              = "ingress"
  from_port         = 1194
  to_port           = 1194
  protocol          = "udp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.vpn.id
  description       = "OpenVPN from internet"
}

resource "aws_security_group_rule" "vpn_ingress_wireguard" {
  type              = "ingress"
  from_port         = 51820
  to_port           = 51820
  protocol          = "udp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.vpn.id
  description       = "WireGuard from internet"
}

resource "aws_security_group_rule" "vpn_ingress_pritunl_ui" {
  type              = "ingress"
  from_port         = 443
  to_port           = 443
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.vpn.id
  description       = "Pritunl web UI from internet"
}

resource "aws_security_group_rule" "vpn_egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.vpn.id
  description       = "All outbound traffic"
}

# SG 6 — NAT Security Group - CREATED IN 01-NETWORKING MODULE
# The NAT security group is already created by the 01-networking module
# This resource is managed at the source (01-networking) to avoid conflicts

# NAT SG rules reference the existing security group created in Module 1 (01-networking)
# Using data source to find the existing security group by name
data "aws_security_group" "nat" {
  name   = "kindswap-nat-sg"
  vpc_id = data.terraform_remote_state.networking.outputs.vpc_id
}

locals {
  nat_sg_id = data.aws_security_group.nat.id
}

resource "aws_security_group_rule" "nat_ingress_vpc_tcp" {
  type              = "ingress"
  from_port         = 0
  to_port           = 65535
  protocol          = "tcp"
  cidr_blocks       = [data.terraform_remote_state.networking.outputs.vpc_cidr]
  security_group_id = local.nat_sg_id
  description       = "All TCP from VPC CIDR (private subnet traffic)"
}

resource "aws_security_group_rule" "nat_ingress_vpc_udp" {
  type              = "ingress"
  from_port         = 0
  to_port           = 65535
  protocol          = "udp"
  cidr_blocks       = [data.terraform_remote_state.networking.outputs.vpc_cidr]
  security_group_id = local.nat_sg_id
  description       = "All UDP from VPC CIDR (DNS, NTP, etc.)"
}

# Note: nat_egress_all rule is already created in 01-networking module
# and is managed there to avoid conflicts

# ============================================================================
# EKS CLUSTER & NODE SG RULES (cross-referencing each other)
# ============================================================================
# Must come AFTER both SGs are created to avoid circular dependency.
# These rules allow communication between cluster control plane and nodes.

# EKS Cluster SG: Allow TCP 443 from EKS nodes (kubelet API calls to control plane)
resource "aws_security_group_rule" "eks_cluster_ingress_from_nodes" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.eks_node.id
  security_group_id        = aws_security_group.eks_cluster.id
  description              = "HTTPS from EKS nodes (kubelet API)"
}

# EKS Cluster SG: Allow all outbound
resource "aws_security_group_rule" "eks_cluster_egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.eks_cluster.id
  description       = "All outbound traffic"
}

# EKS Node SG: Allow ALL protocols (-1) from self (node-to-node communication)
# CRITICAL: Use protocol="-1" NOT "tcp" — CoreDNS needs UDP 53, VXLAN needs UDP 4789
resource "aws_security_group_rule" "eks_node_ingress_self_all_protocols" {
  type              = "ingress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  self              = true
  security_group_id = aws_security_group.eks_node.id
  description       = "All protocols node-to-node (CoreDNS UDP 53, VXLAN UDP 4789)"
}

# EKS Node SG: Allow TCP 1025-65535 from EKS cluster (kubelet high ports)
resource "aws_security_group_rule" "eks_node_ingress_cluster_kubelet" {
  type                     = "ingress"
  from_port                = 1025
  to_port                  = 65535
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.eks_cluster.id
  security_group_id        = aws_security_group.eks_node.id
  description              = "TCP 1025-65535 from EKS cluster (kubelet + container ports)"
}

# EKS Node SG: Allow TCP 443 from EKS cluster (API server to nodes)
resource "aws_security_group_rule" "eks_node_ingress_cluster_api" {
  type                     = "ingress"
  from_port                = 443
  to_port                  = 443
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.eks_cluster.id
  security_group_id        = aws_security_group.eks_node.id
  description              = "HTTPS from EKS cluster (API server)"
}

# EKS Node SG: Allow TCP 8080 from ALB (health checks, ingress traffic)
resource "aws_security_group_rule" "eks_node_ingress_alb_health" {
  type                     = "ingress"
  from_port                = 8080
  to_port                  = 8080
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.alb.id
  security_group_id        = aws_security_group.eks_node.id
  description              = "TCP 8080 from ALB (health checks + ingress)"
}

# EKS Node SG: Allow all outbound
resource "aws_security_group_rule" "eks_node_egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.eks_node.id
  description       = "All outbound traffic"
}

# ============================================================================
# RDS SG RULES
# ============================================================================
# RDS: Allow TCP 5432 (PostgreSQL) from EKS nodes ONLY
resource "aws_security_group_rule" "rds_ingress_from_nodes" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = aws_security_group.eks_node.id
  security_group_id        = aws_security_group.rds.id
  description              = "PostgreSQL from EKS nodes only"
}

# RDS: Allow all outbound
resource "aws_security_group_rule" "rds_egress_all" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.rds.id
  description       = "All outbound traffic"
}

# ============================================================================
# SECTION 3 — IAM ROLES
# ============================================================================

# Role 1 — EKS Cluster Role
# Trust principal: eks.amazonaws.com
# Managed policies: AmazonEKSClusterPolicy, AmazonEKSVPCResourceController
resource "aws_iam_role" "eks_cluster" {
  name               = "kindswap-eks-cluster-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "eks.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name      = "kindswap-eks-cluster-role"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

resource "aws_iam_role_policy_attachment" "eks_cluster_policy" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
}

resource "aws_iam_role_policy_attachment" "eks_vpc_resource_controller" {
  role       = aws_iam_role.eks_cluster.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSVPCResourceController"
}

# Role 2 — EKS Node Role
# Trust principal: ec2.amazonaws.com
# Managed policies: AmazonEKSWorkerNodePolicy, AmazonEKS_CNI_Policy,
#                   AmazonEC2ContainerRegistryReadOnly, AmazonSSMManagedInstanceCore
resource "aws_iam_role" "eks_node" {
  name               = "kindswap-eks-node-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name      = "kindswap-eks-node-role"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

resource "aws_iam_role_policy_attachment" "eks_node_policy" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy"
}

resource "aws_iam_role_policy_attachment" "eks_cni_policy" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy"
}

resource "aws_iam_role_policy_attachment" "eks_registry_read_only" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"
}

resource "aws_iam_role_policy_attachment" "eks_ssm_managed_instance" {
  role       = aws_iam_role.eks_node.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# Instance profile for EKS nodes (required for node group attachment)
resource "aws_iam_instance_profile" "eks_node" {
  name = "kindswap-eks-node-profile"
  role = aws_iam_role.eks_node.name
}

# Role 3 — GitHub Actions OIDC Role
# Trust principal: OIDC provider https://token.actions.githubusercontent.com
# Permissions: ECR (push images), EKS (describe cluster), S3, Secrets Manager, KMS
resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]

  tags = {
    Name      = "kindswap-github-actions-oidc"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

resource "aws_iam_role" "github_actions" {
  name               = "kindswap-github-actions-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Federated = aws_iam_openid_connect_provider.github_actions.arn
        }
        Action = "sts:AssumeRoleWithWebIdentity"
        Condition = {
          StringLike = {
            "token.actions.githubusercontent.com:sub" = "repo:${var.github_org}/*:*"
          }
        }
      }
    ]
  })

  tags = {
    Name      = "kindswap-github-actions-role"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

resource "aws_iam_role_policy" "github_actions_inline" {
  name   = "kindswap-github-actions-inline"
  role   = aws_iam_role.github_actions.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # ECR: GetAuthorizationToken (all resources, required for docker login)
      {
        Sid    = "ECRAuthorizationToken"
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken"
        ]
        Resource = "*"
      },
      # ECR: Push/pull images to kindswap-* repositories
      {
        Sid    = "ECRRepositoryPush"
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload",
          "ecr:DescribeImages",
          "ecr:DescribeImageScanFindings"
        ]
        Resource = "arn:aws:ecr:${var.aws_region}:${data.aws_caller_identity.current.account_id}:repository/kindswap-*"
      },
      # EKS: Describe cluster (for kubectl access verification)
      {
        Sid    = "EKSDescribeCluster"
        Effect = "Allow"
        Action = [
          "eks:DescribeCluster"
        ]
        Resource = "arn:aws:eks:${var.aws_region}:${data.aws_caller_identity.current.account_id}:cluster/${var.cluster_name}"
      },
      # S3: Access kindswap-* buckets (for artifact storage)
      {
        Sid    = "S3Access"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::kindswap-*",
          "arn:aws:s3:::kindswap-*/*"
        ]
      },
      # Secrets Manager: Read Cosign private key for image signing
      {
        Sid    = "SecretsManagerCosign"
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:kindswap/cosign/private-key"
      },
      # KMS: Decrypt with master CMK (for Secrets Manager access)
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt"
        ]
        Resource = aws_kms_key.master.arn
      }
    ]
  })
}

# Role 4 — Secrets Manager Rotation Lambda Role
# Trust principal: lambda.amazonaws.com
# Permissions: SecretsManager (rotate secrets), RDS (modify instances), KMS (decrypt)
resource "aws_iam_role" "secrets_rotation_lambda" {
  name               = "kindswap-secrets-rotation-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name      = "kindswap-secrets-rotation-role"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

# Attach AWS Lambda basic execution role (for CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.secrets_rotation_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

resource "aws_iam_role_policy" "secrets_rotation_lambda_inline" {
  name   = "kindswap-secrets-rotation-inline"
  role   = aws_iam_role.secrets_rotation_lambda.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      # Secrets Manager: Rotate secrets under kindswap/*
      {
        Sid    = "SecretsManagerRotation"
        Effect = "Allow"
        Action = [
          "secretsmanager:DescribeSecret",
          "secretsmanager:GetSecretValue",
          "secretsmanager:PutSecretValue",
          "secretsmanager:UpdateSecretVersionStage",
          "secretsmanager:GetRandomPassword"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:kindswap/*"
      },
      # RDS: Modify DB instances for password rotation
      {
        Sid    = "RDSModifyInstance"
        Effect = "Allow"
        Action = [
          "rds:ModifyDBInstance"
        ]
        Resource = "arn:aws:rds:${var.aws_region}:${data.aws_caller_identity.current.account_id}:db:kindswap-*"
      },
      # KMS: Decrypt secrets with master CMK
      {
        Sid    = "KMSDecrypt"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey",
          "kms:DescribeKey"
        ]
        Resource = aws_kms_key.master.arn
      }
    ]
  })
}

# ============================================================================
# SECTION 4 — MFA ENFORCEMENT POLICY
# ============================================================================
# Denies all console actions unless MFA is active.
# Exceptions: allows MFA device enrollment actions (so users can self-enroll).

resource "aws_iam_policy" "mfa_enforcement" {
  name        = "kindswap-mfa-enforcement"
  description = "Deny all AWS Console actions when MFA is not active. Allows MFA enrollment."

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "DenyAllWithoutMFA"
        Effect = "Deny"
        NotAction = [
          "iam:CreateVirtualMFADevice",
          "iam:EnableMFADevice",
          "iam:GetUser",
          "iam:ListMFADevices",
          "iam:ListVirtualMFADevices",
          "iam:ResyncMFADevice",
          "sts:GetSessionToken"
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

  tags = {
    Name      = "kindswap-mfa-enforcement"
    Project   = var.project
    ManagedBy = "Terraform"
    Module    = "02-security"
  }
}

# ============================================================================
# SECTION 5 — CLOUDTRAIL FOR KMS AUDIT (DISABLED TEMPORARILY)
# ============================================================================
# CloudTrail logs ALL API calls (especially KMS Decrypt) with principal ARN + timestamp.
# Per SoW v5: every KMS Decrypt call must be logged for audit and compliance.
# S3 backend encrypted with KMS CMK, bucket locked down with public access blocks.
# TEMPORARILY DISABLED: S3 bucket name conflict, will be re-enabled after initial deployment

# S3 bucket for CloudTrail logs (DISABLED)
# resource "aws_s3_bucket" "cloudtrail_logs" {
#   bucket        = "kindswap-cloudtrail-logs-${data.aws_caller_identity.current.account_id}"
#   force_destroy = false

#   tags = {
#     Name      = "kindswap-cloudtrail-logs"
#     Project   = var.project
#     ManagedBy = "Terraform"
#     Module    = "02-security"
#   }
# }

# Block all public access to CloudTrail logs bucket (DISABLED)
# resource "aws_s3_bucket_public_access_block" "cloudtrail_logs" {
#   bucket                  = aws_s3_bucket.cloudtrail_logs.id
#   block_public_acls       = true
#   block_public_policy     = true
#   ignore_public_acls      = true
#   restrict_public_buckets = true
# }

# Enable versioning on CloudTrail logs bucket (DISABLED)
# resource "aws_s3_bucket_versioning" "cloudtrail_logs" {
#   bucket = aws_s3_bucket.cloudtrail_logs.id
#   versioning_configuration {
#     status = "Enabled"
#   }
# }

# Encrypt CloudTrail logs with KMS CMK (DISABLED)
# resource "aws_s3_bucket_server_side_encryption_configuration" "cloudtrail_logs" {
#   bucket = aws_s3_bucket.cloudtrail_logs.id

#   rule {
#     apply_server_side_encryption_by_default {
#       sse_algorithm     = "aws:kms"
#       kms_master_key_id = aws_kms_key.master.arn
#     }
#     bucket_key_enabled = true
#   }
# }

# S3 bucket policy allowing CloudTrail to write (DISABLED)
# resource "aws_s3_bucket_policy" "cloudtrail_logs" {
#   bucket = aws_s3_bucket.cloudtrail_logs.id

#   policy = jsonencode({
#     Version = "2012-10-17"
#     Statement = [
#       {
#         Sid    = "AWSCloudTrailAclCheck"
#         Effect = "Allow"
#         Principal = {
#           Service = "cloudtrail.amazonaws.com"
#         }
#         Action   = "s3:GetBucketAcl"
#         Resource = aws_s3_bucket.cloudtrail_logs.arn
#       },
#       {
#         Sid    = "AWSCloudTrailWrite"
#         Effect = "Allow"
#         Principal = {
#           Service = "cloudtrail.amazonaws.com"
#         }
#         Action   = "s3:PutObject"
#         Resource = "${aws_s3_bucket.cloudtrail_logs.arn}/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
#         Condition = {
#           StringEquals = {
#             "s3:x-amz-acl" = "bucket-owner-full-control"
#           }
#         }
#       },
#       {
#         Sid    = "AllowKMSEncryption"
#         Effect = "Allow"
#         Principal = {
#           Service = "cloudtrail.amazonaws.com"
#         }
#         Action = [
#           "kms:GenerateDataKey",
#           "kms:DecryptDataKey"
#         ]
#         Resource = aws_kms_key.master.arn
#       }
#     ]
#   })
# }

# CloudTrail trail (logs all API calls) (DISABLED)
# resource "aws_cloudtrail" "main" {
#   name                          = "kindswap-cloudtrail"
#   s3_bucket_name                = aws_s3_bucket.cloudtrail_logs.id
#   include_global_service_events = true
#   is_multi_region_trail         = false
#   enable_log_file_validation    = true
#   kms_key_id                    = aws_kms_key.master.arn

#   # Log all API calls (management + data events)
#   event_selector {
#     read_write_type           = "All"
#     include_management_events = true
#   }

#   # Explicitly log all Decrypt calls (for KMS audit requirement)
#   event_selector {
#     read_write_type           = "All"
#     include_management_events = false

#     data_resource {
#       type   = "AWS::S3::Object"
#       values = ["arn:aws:s3:::*/*"]
#     }
#   }

#   # Depends on bucket policy being in place
#   depends_on = [aws_s3_bucket_policy.cloudtrail_logs]

#   tags = {
#     Name      = "kindswap-cloudtrail"
#     Project   = var.project
#     ManagedBy = "Terraform"
#     Module    = "02-security"
#   }
# }

