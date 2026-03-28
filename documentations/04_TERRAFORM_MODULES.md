# 📚 TERRAFORM MODULE DOCUMENTATION

**Document Version:** v5  
**Date:** March 28, 2026  
**Location:** `infra/infra-core/`, `infra/infra-k8s/`  

---

## 🏗️ TERRAFORM APPLY ORDER

```
APPLY SEQUENCE (STRICT ORDER):

Stage 1: Foundation (VPC & Security)
├─ infra/infra-core/01-vpc/main.tf
│  └─ Creates: VPC, subnets, route tables, NAT, IGW
│
├─ infra/infra-core/02-security/main.tf
│  └─ Creates: Security groups, IAM roles, KMS keys

Stage 2: Core Services (Data & Monitoring)
├─ infra/infra-core/03-cdn/main.tf
│  └─ Creates: Cloudflare zone, rate limiting rules

├─ infra/infra-core/04-data/main.tf
│  └─ Creates: RDS instances, Secrets Manager, backups

├─ infra/infra-core/05-iam/main.tf
│  └─ Creates: IRSA roles, Karpenter policies

Stage 3: Kubernetes (EKS & Control Plane)
├─ infra/infra-k8s/01-eks-cluster/main.tf
│  └─ Creates: EKS cluster, node groups, Karpenter

├─ infra/infra-k8s/02-add-ons/main.tf
│  └─ Creates: CoreDNS, VPC CNI, ebs-csi-driver

Stage 4: Applications & Operators
├─ infra/infra-k8s/03-operators/main.tf
│  └─ Creates: External Secrets, Prometheus, Grafana

├─ infra/infra-k8s/04-policy/main.tf
│  └─ Creates: Network policies, admission webhooks

├─ infra/infra-k8s/05-apps/main.tf
│  └─ Creates: Helm deployments, ExternalSecrets
```

---

## 📦 MODULE: 01-VPC

**Path:** `infra/infra-core/01-vpc/`  
**Purpose:** Network foundation (VPC, subnets, routing, NAT)

### What It Provisions

```hcl
module "vpc" {
  source = "./vpc"
  
  # Outputs:
  # - VPC with CIDR 10.0.0.0/16
  # - 6 subnets (2 public, 4 private)
  # - NAT Gateway (EIPs, route tables)
  # - Internet Gateway
  # - Route tables (public to IGW, private to NAT)
}
```

### Key Variables

```hcl
vpc_cidr              = "10.0.0.0/16"
enable_nat_gateway    = true
enable_vpn_gateway    = false  # Use Pritunl instead
single_nat_gateway    = false  # One NAT per AZ for HA
enable_dns_hostnames  = true
enable_dns_support    = true

public_subnets = [
  "10.0.10.0/24",  # us-east-1a
  "10.0.11.0/24",  # us-east-1b
  "10.0.12.0/24",  # us-east-1c
]

private_subnets = [
  "10.0.20.0/24",  # EKS us-east-1a
  "10.0.21.0/24",  # RDS us-east-1a
  "10.0.22.0/24",  # RDS us-east-1b
  "10.0.23.0/24",  # EKS us-east-1b
]
```

### Outputs

```hcl
output "vpc_id" {
  value = aws_vpc.main.id  # vpc-08a60df...
}

output "private_subnet_ids" {
  value = [aws_subnet.private[*].id]  # For EKS
}

output "database_subnet_ids" {
  value = [aws_subnet.database[*].id]  # For RDS
}
```

---

## 🔐 MODULE: 02-SECURITY

**Path:** `infra/infra-core/02-security/`  
**Purpose:** Security groups, IAM, KMS keys

### What It Provisions

```hcl
# Security Groups
resource "aws_security_group" "alb" {
  # Inbound: 80, 443 from 0.0.0.0/0
  # Outbound: 3000, 80 to app-tier-sg
}

resource "aws_security_group" "app_tier" {
  # Inbound: 3000, 80 from alb-sg
  # Outbound: 5432 to rds-sg, 443 to 0.0.0.0/0 (API calls)
}

resource "aws_security_group" "rds" {
  # Inbound: 5432 from app-tier-sg ONLY
  # Outbound: None (read-only)
}

# KMS Key
resource "aws_kms_key" "master" {
  description           = "Master key for KindSwap"
  deletion_window_in_days = 10
  enable_key_rotation   = true
}

# IAM Roles (IRSA - IAM Role for Service Account)
resource "aws_iam_role" "eks_irsa" {
  # Used by: EKS pods (via K8s ServiceAccount)
  # Permissions: Read from Secrets Manager, decrypt with KMS
}
```

### Key Variables

```hcl
master_key_alias = "kindswap-master-key"
kms_rotation_enabled = true

security_groups = {
  alb = {
    ingress_rules = [
      { from_port = 80, to_port = 80, cidr_blocks = ["0.0.0.0/0"] },
      { from_port = 443, to_port = 443, cidr_blocks = ["0.0.0.0/0"] }
    ]
  }
  
  app_tier = {
    ingress_rules = [
      { from_port = 3000, security_group_id = aws_security_group.alb.id }
    ]
  }
}
```

---

## ☁️ MODULE: 03-CDN

**Path:** `infra/infra-core/03-cdn/`  
**Purpose:** Cloudflare configuration, DNS, rate limiting

### What It Provisions

```hcl
resource "cloudflare_zone" "kindswap" {
  account_id = var.cloudflare_account_id
  zone       = "kindswap.world"
}

resource "cloudflare_record" "cname_to_alb" {
  # CNAME: kindswap.world → ALB endpoint
  # Type: CNAME, Value: alb-xxx.amazonaws.com
}

resource "cloudflare_rate_limit" "api" {
  zone_id   = cloudflare_zone.kindswap.id
  threshold = 100
  period    = 10  # 100 requests per 10 seconds
  
  match {
    request {
      url {
        path { matches = "/api/*" }
      }
    }
  }
  
  action {
    mode = "challenge"  # Show CAPTCHA
  }
}

resource "cloudflare_waf_rule" "sql_injection" {
  zone_id = cloudflare_zone.kindswap.id
  rule_id = "62d9f"  # Cloudflare SQL injection rule
  mode    = "block"
}
```

### Key Variables

```hcl
cloudflare_email          = "devops@kindswap.xyz"
cloudflare_api_token      = var.cloudflare_token  # From environment
cloudflare_account_id     = "abc123xyz"

rate_limit_threshold      = 100  # requests
rate_limit_period         = 10   # seconds
rate_limit_action         = "challenge"

waf_rules = {
  sql_injection   = { enabled = true, mode = "block" }
  xss_protection  = { enabled = true, mode = "block" }
}
```

---

## 🗄️ MODULE: 04-DATA

**Path:** `infra/infra-core/04-data/`  
**Purpose:** RDS, Secrets Manager, backups

### What It Provisions

```hcl
resource "aws_db_instance" "prod" {
  identifier            = "kindswap-prod"
  engine                = "postgres"
  engine_version        = "14.7"
  instance_class        = "db.t3.large"
  allocated_storage     = 100
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = aws_kms_key.master.arn
  
  multi_az              = true
  publicly_accessible   = false
  db_subnet_group_name  = aws_db_subnet_group.private.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  copy_tags_to_snapshot  = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name                   = "kindswap/api/db-password"
  kms_key_id             = aws_kms_key.master.id
  
  rotation_rules {
    automatically_after_days = 30
  }
}
```

### Key Variables

```hcl
prod_db_class           = "db.t3.large"
prod_db_storage         = 100
prod_multi_az           = true
prod_backup_retention   = 7

nonprod_db_class        = "db.t3.small"
nonprod_db_storage      = 50
nonprod_multi_az        = false
nonprod_backup_retention = 3

secrets = [
  "kindswap/api/db-password",
  "kindswap/api/helius-rpc-key",
  "kindswap/api/jupiter-api-key",
  "kindswap/api/cosign/private-key"
]
```

---

## 🎯 MODULE: 05-IAM

**Path:** `infra/infra-core/05-iam/`  
**Purpose:** IAM roles, policies, OIDC for CI/CD

### What It Provisions

```hcl
# OIDC Provider (GitHub Actions)
resource "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
  
  client_id_list = ["sts.amazonaws.com"]
  thumbprint_list = ["6938fd4d98bab03faadb97b34396831e3780aea1"]
}

# CI/CD Role (used by GitHub Actions)
resource "aws_iam_role" "github_actions" {
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = aws_iam_openid_connect_provider.github.arn
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:sub" = "repo:kindswap/kindswap:ref:refs/heads/main"
        }
      }
    }]
  })
}

# Attach policies: ECR push, EKS describe, Cosign
resource "aws_iam_role_policy" "github_ecr" {
  role = aws_iam_role.github_actions.id
  
  policy = jsonencode({
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ecr:GetAuthorizationToken",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:GetDownloadUrlForLayer",
          "ecr:CompleteLayerUpload"
        ]
        Resource = "arn:aws:ecr:*:*:repository/kindswap-*"
      }
    ]
  })
}

# IRSA Role (used by EKS pods)
resource "aws_iam_role" "eks_pods" {
  assume_role_policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Principal = {
        Federated = "arn:aws:iam::ACCOUNT:oidc-provider/oidc.eks.REGION.amazonaws.com/id/EXAMPLEID"
      }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "oidc.eks.REGION.amazonaws.com/id/EXAMPLEID:sub" = "system:serviceaccount:production:kindswap-backend"
        }
      }
    }]
  })
}
```

### Key Variables

```hcl
github_repo              = "kindswap/kindswap"
github_branch            = "main"
oidc_provider_url        = "https://token.actions.githubusercontent.com"

irsa_namespace           = "production"
irsa_service_account     = "kindswap-backend"

# Karpenter policy
karpenter_cluster_name   = "kindswap-eks"
```

---

## 🎪 MODULE: 01-EKS-CLUSTER (K8s)

**Path:** `infra/infra-k8s/01-eks-cluster/`  
**Purpose:** EKS cluster, node groups, Karpenter

### What It Provisions

```hcl
resource "aws_eks_cluster" "kindswap" {
  name            = "kindswap-eks"
  version         = "1.28"
  role_arn        = aws_iam_role.eks_cluster.arn
  
  vpc_config {
    subnet_ids = concat(
      var.public_subnets,
      var.private_subnets
    )
    security_group_ids = [aws_security_group.eks.id]
  }
}

resource "aws_eks_node_group" "general" {
  cluster_name    = aws_eks_cluster.kindswap.name
  node_group_name = "general-purpose"
  
  min_size       = 3
  max_size       = 20
  desired_size   = 5
  
  instance_types = ["t3.large", "t3.xlarge"]
  
  scaling_config {
    desired_size = 5
    max_size     = 20
    min_size     = 3
  }
}

# Karpenter
resource "helm_release" "karpenter" {
  chart      = "karpenter"
  namespace  = "karpenter"
  
  set {
    name  = "settings.clusterName"
    value = aws_eks_cluster.kindswap.name
  }
}
```

### Key Variables

```hcl
cluster_version       = "1.28"
cluster_name          = "kindswap-eks"

node_group_min_size   = 3
node_group_max_size   = 20
node_group_desired    = 5

instance_types        = ["t3.large", "t3.xlarge"]

karpenter_enabled     = true
```

---

## 📚 APPLYING MODULES: STEP-BY-STEP

```bash
# 1. Initialize Terraform
$ cd infra/
$ terraform init
$ terraform workspace new production  # or use `default`

# 2. Apply Stage 1 (Foundation)
$ terraform apply -target=module.vpc -target=module.security

# 3. Apply Stage 2 (Core Services)
$ terraform apply \
    -target=module.cdn \
    -target=module.data \
    -target=module.iam

# 4. Apply Stage 3 (Kubernetes)
$ terraform apply -target=module.eks_cluster

# 5. Apply Stage 4 (Applications)
$ terraform apply -target=module.operators -target=module.apps

# 6. Verify all resources
$ terraform state list
$ aws ec2 describe-vpcs
$ aws rds describe-db-instances
$ aws eks describe-cluster --name kindswap-eks
```

---

## 🔄 UPDATING MODULES

```bash
# Update a specific module (e.g., change node count)
$ terraform plan -target=module.eks_cluster
$ terraform apply -target=module.eks_cluster

# Update all modules
$ terraform plan
$ terraform apply

# Destroy everything (CAUTION!)
$ terraform destroy -target=module.apps
$ terraform destroy -target=module.eks_cluster
$ terraform destroy -target=module.data
$ terraform destroy  # Remove all
```

---

**Document:** TERRAFORM MODULE DOCUMENTATION  
**Status:** ✅ COMPLETE  
**Version:** v5  
**Last Updated:** March 28, 2026
