# TEMPLATE FOR ALL SUBSEQUENT MODULES
# Copy this block into each module's backend.tf and replace REPLACE_WITH_MODULE_PATH

# For infra-core/01-networking/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "core/networking/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }

# For infra-core/02-security/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "core/security/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }

# For infra-core/03-eks/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "core/eks/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }

# For infra-core/04-data/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "core/data/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }

# For infra-core/05-registry/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "core/registry/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }

# For infra-k8s/01-irsa/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "k8s/irsa/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }

# For infra-k8s/02-controllers/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "k8s/controllers/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }

# For infra-k8s/03-karpenter/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "k8s/karpenter/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }

# For infra-k8s/04-monitoring/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "k8s/monitoring/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }

# For infra-k8s/05-apps/backend.tf:
# terraform {
#   backend "s3" {
#     bucket         = "kindswap-terraform-state"
#     key            = "k8s/apps/terraform.tfstate"
#     region         = "us-east-1"
#     dynamodb_table = "kindswap-terraform-locks"
#     encrypt        = true
#   }
# }
