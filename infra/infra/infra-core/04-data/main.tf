# ============================================================================
# SECTION 11 — DATA SOURCES
# ============================================================================

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ============================================================================
# REMOTE STATE — READ FROM 01-NETWORKING AND 02-SECURITY
# ============================================================================

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
# SECTION 1 — RDS SUBNET GROUP
# ============================================================================

resource "aws_db_subnet_group" "main" {
  name        = "kindswap-db-subnet-group"
  description = "RDS subnet group - private data subnets only (10.0.21.x, 10.0.22.x)"
  subnet_ids  = data.terraform_remote_state.networking.outputs.private_data_subnet_ids

  tags = { Name = "kindswap-db-subnet-group" }
}

# ============================================================================
# SECTION 2 — RDS PARAMETER GROUP FOR NONPROD (max_connections = 113)
# ============================================================================

# Nonprod parameter group — explicitly sets max_connections to 113
# Formula: db.t3.micro has 1GB RAM → 1,073,741,824 / 9,531,392 = 112.6 → 113
# This is the HARD CEILING for the shared staging+dev instance
# Staging pool: 50 connections max
# Dev pool: 40 connections max
# Headroom: 23 connections (RDS overhead, monitoring, admin)
# CloudWatch alarm fires at 90 connections (80% of 113)
resource "aws_db_parameter_group" "nonprod" {
  name        = "kindswap-nonprod-pg16"
  family      = "postgres16"
  description = "KindSwap nonprod parameter group - max_connections=113 (db.t3.micro 1GB RAM hard limit)"

  parameter {
    name         = "max_connections"
    value        = "113"
    apply_method = "pending-reboot"
  }

  tags = { Name = "kindswap-nonprod-pg16" }
}

# Production parameter group — no max_connections override
# db.t3.medium 2GB RAM → ~227 connections (AWS default)
resource "aws_db_parameter_group" "prod" {
  name        = "kindswap-prod-pg16"
  family      = "postgres16"
  description = "KindSwap production parameter group - PostgreSQL 16 defaults"

  tags = { Name = "kindswap-prod-pg16" }
}

# ============================================================================
# SECTION 3 — PRODUCTION RDS (kindswap-prod)
# ============================================================================

resource "aws_db_instance" "prod" {
  identifier     = "kindswap-prod"
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = "db.t3.medium"

  # Storage
  allocated_storage     = 20
  max_allocated_storage = 100    # enable autoscaling up to 100GB
  storage_type          = "gp3"
  storage_encrypted     = true
  kms_key_id            = data.terraform_remote_state.security.outputs.kms_key_arn

  # High availability
  multi_az = true

  # Database
  db_name  = "kindswap_production"
  username = "kindswap_admin"
  # Password managed by Secrets Manager rotation — set initial value via variable
  password = var.prod_db_initial_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [data.terraform_remote_state.security.outputs.rds_sg_id]
  publicly_accessible    = false

  # Parameter group
  parameter_group_name = aws_db_parameter_group.prod.name

  # Backup
  backup_retention_period   = 7
  backup_window             = "03:00-04:00"          # UTC
  maintenance_window        = "Mon:04:00-Mon:05:00"  # After backup window
  copy_tags_to_snapshot     = true

  # Snapshots
  skip_final_snapshot       = false
  final_snapshot_identifier = "kindswap-prod-final-snapshot"
  delete_automated_backups  = false

  # Monitoring
  performance_insights_enabled          = true
  performance_insights_retention_period = 7
  performance_insights_kms_key_id       = data.terraform_remote_state.security.outputs.kms_key_arn
  monitoring_interval                   = 60
  monitoring_role_arn                   = aws_iam_role.rds_enhanced_monitoring.arn

  # Protection — LAYER 1: AWS-level deletion protection
  # LAYER 2: Terraform prevent_destroy lifecycle (below)
  deletion_protection = true

  # Upgrades
  auto_minor_version_upgrade  = true
  allow_major_version_upgrade = false
  apply_immediately           = false

  # LAYER 2 of delete protection — Terraform IaC level
  # Even if deletion_protection is disabled, terraform destroy will fail
  # until this lifecycle block is manually removed from code + PR approved
  lifecycle {
    prevent_destroy = true
    # Ignore password changes — managed by Secrets Manager rotation Lambda
    ignore_changes = [password]
  }

  tags = { Name = "kindswap-prod" }
}

# ============================================================================
# SECTION 4 — NON-PRODUCTION RDS (kindswap-nonprod)
# ============================================================================

resource "aws_db_instance" "nonprod" {
  identifier     = "kindswap-nonprod"
  engine         = "postgres"
  engine_version = "16.4"
  instance_class = "db.t3.micro"

  # Storage
  allocated_storage = 20
  storage_type      = "gp2"
  storage_encrypted = true
  kms_key_id        = data.terraform_remote_state.security.outputs.kms_key_arn

  # Single-AZ (cost optimization — nonprod downtime acceptable)
  multi_az = false

  # Database — this instance hosts two logical databases:
  # kindswap_staging (created via post-provision script in apps module)
  # kindswap_dev     (created via post-provision script in apps module)
  db_name  = "kindswap_staging"   # default DB; kindswap_dev created separately
  username = "kindswap_admin"
  password = var.nonprod_db_initial_password

  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [data.terraform_remote_state.security.outputs.rds_sg_id]
  publicly_accessible    = false

  # Parameter group with max_connections=113
  parameter_group_name = aws_db_parameter_group.nonprod.name

  # Backup — 3-day retention (not 7 — cost optimization)
  backup_retention_period   = 3
  backup_window             = "04:00-05:00"    # After prod backup window
  maintenance_window        = "Mon:05:00-Mon:06:00"
  copy_tags_to_snapshot     = true

  # Snapshots
  skip_final_snapshot       = false
  final_snapshot_identifier = "kindswap-nonprod-final-snapshot"
  delete_automated_backups  = false

  # No Performance Insights on t3.micro (not supported)
  performance_insights_enabled = false

  # Basic enhanced monitoring
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Protection — same two-layer approach as production
  deletion_protection = true

  lifecycle {
    prevent_destroy = true
    ignore_changes  = [password]
  }

  tags = { Name = "kindswap-nonprod" }
}

# ============================================================================
# SECTION 5 — RDS ENHANCED MONITORING IAM ROLE
# ============================================================================

resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "kindswap-rds-enhanced-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "monitoring.rds.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = { Name = "kindswap-rds-enhanced-monitoring" }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# ============================================================================
# SECTION 6 — SECRETS MANAGER SECRETS (all 9)
# ============================================================================

# DB Secrets (3) — These get daily rotation

resource "aws_secretsmanager_secret" "db_prod" {
  name                    = "kindswap/db/prod/credentials"
  description             = "KindSwap production RDS credentials - daily rotation via Lambda"
  kms_key_id              = data.terraform_remote_state.security.outputs.kms_key_id
  recovery_window_in_days = 7

  tags = { Name = "kindswap-db-prod-credentials" }
}

resource "aws_secretsmanager_secret_version" "db_prod_initial" {
  secret_id = aws_secretsmanager_secret.db_prod.id
  secret_string = jsonencode({
    engine   = "postgres"
    host     = aws_db_instance.prod.address
    port     = 5432
    dbname   = "kindswap_production"
    username = aws_db_instance.prod.username
    password = var.prod_db_initial_password
  })

  lifecycle {
    # Rotation Lambda will update this — ignore further Terraform changes
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "db_staging" {
  name                    = "kindswap/db/staging/credentials"
  description             = "KindSwap staging RDS credentials - daily rotation via Lambda"
  kms_key_id              = data.terraform_remote_state.security.outputs.kms_key_id
  recovery_window_in_days = 7

  tags = { Name = "kindswap-db-staging-credentials" }
}

resource "aws_secretsmanager_secret_version" "db_staging_initial" {
  secret_id = aws_secretsmanager_secret.db_staging.id
  secret_string = jsonencode({
    engine   = "postgres"
    host     = aws_db_instance.nonprod.address
    port     = 5432
    dbname   = "kindswap_staging"
    username = aws_db_instance.nonprod.username
    password = var.nonprod_db_initial_password
  })
  lifecycle { ignore_changes = [secret_string] }
}

resource "aws_secretsmanager_secret" "db_dev" {
  name                    = "kindswap/db/dev/credentials"
  description             = "KindSwap dev RDS credentials - daily rotation via Lambda"
  kms_key_id              = data.terraform_remote_state.security.outputs.kms_key_id
  recovery_window_in_days = 7

  tags = { Name = "kindswap-db-dev-credentials" }
}

resource "aws_secretsmanager_secret_version" "db_dev_initial" {
  secret_id = aws_secretsmanager_secret.db_dev.id
  secret_string = jsonencode({
    engine   = "postgres"
    host     = aws_db_instance.nonprod.address
    port     = 5432
    dbname   = "kindswap_dev"
    username = aws_db_instance.nonprod.username
    password = var.nonprod_db_initial_password
  })
  lifecycle { ignore_changes = [secret_string] }
}

# API Key Secrets (6) - No rotation, manual management
# COMMENTED OUT: These 6 secrets already exist in AWS from previous runs
# After RDS and core infrastructure deploys, import them into state via manual process
# (terraform import has syntax issues with slashes in for_each keys)

# locals {
#   api_secrets = {
#     "kindswap/api/helius-rpc-key"    = "Helius RPC API key - primary Solana RPC endpoint"
#     "kindswap/api/quicknode-key"     = "QuickNode backup RPC key - failover Solana endpoint"
#     "kindswap/api/jupiter-api-key"   = "Jupiter Aggregator API key - DEX routing fallback"
#     "kindswap/api/coingecko-key-1"   = "CoinGecko Pro API key 1 - token price feeds"
#     "kindswap/api/coingecko-key-2"   = "CoinGecko Pro API key 2 - rotation fallback"
#     "kindswap/api/sentry-dsn"        = "Sentry DSN - error tracking for frontend and backend"
#   }
# }
#
# resource "aws_secretsmanager_secret" "api_keys" {
#   for_each = local.api_secrets
#
#   name                    = each.key
#   description             = each.value
#   kms_key_id              = data.terraform_remote_state.security.outputs.kms_key_id
#   recovery_window_in_days = 7
#
#   tags = { Name = replace(each.key, "/", "-") }
# }
#
# # Initial placeholder values - actual API keys must be set manually via AWS Console or CLI
# resource "aws_secretsmanager_secret_version" "api_keys_initial" {
#   for_each  = local.api_secrets
#   secret_id = aws_secretsmanager_secret.api_keys[each.key].id
#   secret_string = jsonencode({
#     value = "PLACEHOLDER - replace with actual API key via AWS Console or: aws secretsmanager put-secret-value --secret-id ${each.key} --secret-string '{\"value\":\"YOUR_KEY_HERE\"}'"
#   })
#
#   lifecycle {
#     # Prevent Terraform from overwriting manually-set API keys on re-apply
#     ignore_changes = [secret_string]
#   }
# }

# ============================================================================
# SECTION 7 — COSIGN KEY SECRET
# ============================================================================

# Cosign signing key for Docker image signature verification (SoW v5 Section 5.6 Stage 3)
resource "aws_secretsmanager_secret" "cosign_key" {
  name                    = "kindswap/cosign/private-key"
  description             = "Cosign signing key - used by CI/CD pipeline to sign Docker images before deployment"
  kms_key_id              = data.terraform_remote_state.security.outputs.kms_key_id
  recovery_window_in_days = 7

  tags = { Name = "kindswap-cosign-private-key" }
}

resource "aws_secretsmanager_secret_version" "cosign_key_initial" {
  secret_id     = aws_secretsmanager_secret.cosign_key.id
  secret_string = jsonencode({
    private_key = "PLACEHOLDER — generate with: cosign generate-key-pair and store the private key here"
  })

  lifecycle { ignore_changes = [secret_string] }
}

# ============================================================================
# SECTION 8 — ROTATION LAMBDA
# ============================================================================

# Rotation Lambda for all 3 DB secrets (prod, staging, dev)
# Uses AWS Serverless Application Repository (SAR) provided single-user rotation function
# Password policy: alphanumeric only (a-z, A-Z, 0-9), 32 chars minimum
# No special characters — prevents escaping failures in NestJS TypeORM

# Deploy the AWS SAR rotation function BEFORE applying this Terraform:
# aws serverlessrepo create-cloud-formation-change-set \
#   --application-id arn:aws:serverlessrepo:us-east-1:297356227824:applications/SecretsManagerRDSPostgreSQLRotationSingleUser \
#   --stack-name kindswap-rotation-lambda \
#   --capabilities CAPABILITY_IAM \
#   --region us-east-1
# Then accept the change set in CloudFormation console.
# The deployed function will be: arn:aws:lambda:us-east-1:<ACCOUNT_ID>:function:SecretsManagerRDSPostgreSQLRotationSingleUser

# Reference the pre-deployed SAR function
locals {
  rotation_lambda_arn = "arn:aws:lambda:us-east-1:${data.aws_caller_identity.current.account_id}:function:SecretsManagerRDSPostgreSQLRotationSingleUser"
}

# Allow Secrets Manager to invoke the pre-deployed rotation Lambda
resource "aws_lambda_permission" "secrets_manager_rotation_prod" {
  count             = var.enable_secrets_rotation ? 1 : 0
  statement_id      = "SecretsManagerInvocationProd"
  action            = "lambda:InvokeFunction"
  function_name     = "SecretsManagerRDSPostgreSQLRotationSingleUser"
  principal         = "secretsmanager.amazonaws.com"
  source_arn        = aws_secretsmanager_secret.db_prod.arn
}

resource "aws_lambda_permission" "secrets_manager_rotation_staging" {
  count             = var.enable_secrets_rotation ? 1 : 0
  statement_id      = "SecretsManagerInvocationStaging"
  action            = "lambda:InvokeFunction"
  function_name     = "SecretsManagerRDSPostgreSQLRotationSingleUser"
  principal         = "secretsmanager.amazonaws.com"
  source_arn        = aws_secretsmanager_secret.db_staging.arn
}

resource "aws_lambda_permission" "secrets_manager_rotation_dev" {
  count             = var.enable_secrets_rotation ? 1 : 0
  statement_id      = "SecretsManagerInvocationDev"
  action            = "lambda:InvokeFunction"
  function_name     = "SecretsManagerRDSPostgreSQLRotationSingleUser"
  principal         = "secretsmanager.amazonaws.com"
  source_arn        = aws_secretsmanager_secret.db_dev.arn
}

# Configure daily rotation on prod DB secret
resource "aws_secretsmanager_secret_rotation" "db_prod" {
  count               = var.enable_secrets_rotation ? 1 : 0
  secret_id           = aws_secretsmanager_secret.db_prod.id
  rotation_lambda_arn = local.rotation_lambda_arn

  rotation_rules {
    automatically_after_days = 1    # Daily rotation per SoW v5
  }

  depends_on = [aws_lambda_permission.secrets_manager_rotation_prod]
}

resource "aws_secretsmanager_secret_rotation" "db_staging" {
  count               = var.enable_secrets_rotation ? 1 : 0
  secret_id           = aws_secretsmanager_secret.db_staging.id
  rotation_lambda_arn = local.rotation_lambda_arn
  rotation_rules { automatically_after_days = 1 }
  depends_on = [aws_lambda_permission.secrets_manager_rotation_staging]
}

resource "aws_secretsmanager_secret_rotation" "db_dev" {
  count               = var.enable_secrets_rotation ? 1 : 0
  secret_id           = aws_secretsmanager_secret.db_dev.id
  rotation_lambda_arn = local.rotation_lambda_arn
  rotation_rules { automatically_after_days = 1 }
  depends_on = [aws_lambda_permission.secrets_manager_rotation_dev]
}

# ============================================================================
# SECTION 9 — CLOUDWATCH ALARMS (Connection Limits)
# ============================================================================

# Production — alert at 180 connections (80% of ~227 max_connections on db.t3.medium)
resource "aws_cloudwatch_metric_alarm" "rds_prod_connections" {
  alarm_name          = "kindswap-rds-prod-high-connections"
  alarm_description   = "Production RDS DatabaseConnections exceeded 180 (80% of ~227 max)"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.prod.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 180
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = []   # Add SNS topic ARN when monitoring module creates it

  tags = { Name = "kindswap-rds-prod-connections" }
}

# Nonprod — alert at 90 connections (80% of 113 max_connections — HARD LIMIT on db.t3.micro)
resource "aws_cloudwatch_metric_alarm" "rds_nonprod_connections" {
  alarm_name          = "kindswap-rds-nonprod-high-connections"
  alarm_description   = "Nonprod RDS DatabaseConnections exceeded 90 - approaching 113 hard limit (db.t3.micro 1GB RAM)"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.nonprod.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 90
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = []

  tags = { Name = "kindswap-rds-nonprod-connections" }
}

# Production storage alarm
resource "aws_cloudwatch_metric_alarm" "rds_prod_storage" {
  alarm_name          = "kindswap-rds-prod-low-storage"
  alarm_description   = "Production RDS free storage below 1GB - requires immediate attention"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = aws_db_instance.prod.identifier }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1073741824    # 1GB in bytes
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = []

  tags = { Name = "kindswap-rds-prod-storage" }
}

# Rotation failure alarm
resource "aws_cloudwatch_metric_alarm" "secrets_rotation_failure" {
  alarm_name          = "kindswap-secrets-rotation-failure"
  alarm_description   = "Secrets Manager rotation failure - pods using AWSPREVIOUS as fallback"
  namespace           = "AWS/SecretsManager"
  metric_name         = "RotationThisAttemptFailed"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = []

  tags = { Name = "kindswap-secrets-rotation-failure" }
}

# ============================================================================
# SECTION 10 — SBOM S3 BUCKET
# ============================================================================

# S3 bucket for Software Bill of Materials (SBOM) artifacts
# Generated by syft after each Docker image build (SoW v5 Section 5.6 Stage 4)
resource "aws_s3_bucket" "sbom" {
  bucket        = "kindswap-sbom-${data.aws_caller_identity.current.account_id}"
  force_destroy = false

  tags = { Name = "kindswap-sbom" }
}

resource "aws_s3_bucket_versioning" "sbom" {
  bucket = aws_s3_bucket.sbom.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "sbom" {
  bucket = aws_s3_bucket.sbom.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = data.terraform_remote_state.security.outputs.kms_key_arn
    }
  }
}

resource "aws_s3_bucket_public_access_block" "sbom" {
  bucket                  = aws_s3_bucket.sbom.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "sbom" {
  bucket = aws_s3_bucket.sbom.id
  rule {
    id     = "sbom-retention"
    status = "Enabled"
    expiration { days = 90 }    # SoW v5: 90-day retention
    filter { prefix = "" }
  }
}

