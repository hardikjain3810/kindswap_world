# Development Environment Terraform Variables
# Used for: terraform apply -var-file="terraform.dev.tfvars"

# ============================================
# DEPLOYMENT ENVIRONMENT
# ============================================
aws_region       = "us-east-1"
environment      = "development"
project          = "kindswap"
cost_center      = "development"
owner_email      = "dev@kindswap.world"

# ============================================
# NETWORKING
# ============================================
vpc_cidr              = "10.0.0.0/16"
nat_instance_type     = "t3.nano"
use_production_nat_sg = false

# ============================================
# EKS CLUSTER CONFIGURATION
# ============================================
eks_cluster_version   = "1.31"
enable_cluster_autoscaler = true
enable_metrics_server = true

# Node Groups
core_node_group_desired_size = 2
core_node_group_min_size     = 1
core_node_group_max_size     = 4
core_node_group_instance_types = ["t3.medium"]

# ============================================
# DATABASE CONFIGURATION
# ============================================
rds_engine_version  = "16.1"
rds_instance_class  = "db.t3.micro"  # Development: Burstable tier
rds_allocated_storage = 20             # Development: 20GB
rds_storage_type    = "gp3"
rds_backup_retention_days = 7          # Development: 7 days
rds_multi_az        = false            # Development: Single-AZ to save costs
rds_skip_final_snapshot = false        # Keep snapshots for debugging

# ============================================
# REDIS CONFIGURATION
# ============================================
redis_node_type            = "cache.t3.micro"    # Development: Burstable tier
redis_num_cache_nodes      = 1                   # Development: Single node
redis_automatic_failover   = false               # Development: No failover
redis_engine_version       = "7.0"

# ============================================
# ECR CONFIGURATION
# ============================================
ecr_repositories = {
  backend        = "kindswap-backend-dev"
  admin_backend  = "kindswap-admin-backend-dev"
  frontend       = "kindswap-frontend-dev"
  admin_panel    = "kindswap-admin-panel-dev"
}
ecr_image_scan_on_push = true
ecr_image_tag_mutability = "MUTABLE"

# ============================================
# MONITORING & LOGGING
# ============================================
enable_monitoring      = true
log_retention_days     = 7           # Development: Shorter retention
enable_enhanced_monitoring = false   # Development: Disabled

# ============================================
# SECURITY
# ============================================
enable_vpc_flow_logs  = true
enable_cloudtrail     = true
allow_ssh_cidrs       = ["0.0.0.0/0"]  # WARNING: Development only, restrict in production
enable_secrets_manager = true

# ============================================
# COGNITO (Optional for dev)
# ============================================
cognito_user_pool_name = "kindswap-dev-users"
cognito_client_name    = "kindswap-dev-client"

# ============================================
# TAGS
# ============================================
common_tags = {
  Environment  = "development"
  Project      = "kindswap"
  ManagedBy    = "terraform"
  CreatedDate  = "2026-03-23"
  Purpose      = "Local development and testing"
}
