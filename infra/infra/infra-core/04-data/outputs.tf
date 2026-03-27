# ============================================================================
# RDS INSTANCES
# ============================================================================

output "prod_db_identifier" {
  description = "Production RDS instance identifier"
  value       = aws_db_instance.prod.identifier
}

output "prod_db_address" {
  description = "Production RDS endpoint hostname (used by Secrets Manager secret)"
  value       = aws_db_instance.prod.address
}

output "prod_db_port" {
  description = "Production RDS port"
  value       = aws_db_instance.prod.port
}

output "prod_db_arn" {
  description = "Production RDS instance ARN"
  value       = aws_db_instance.prod.arn
}

output "prod_db_name" {
  description = "Production RDS database name"
  value       = aws_db_instance.prod.db_name
}

output "nonprod_db_identifier" {
  description = "Non-production RDS instance identifier"
  value       = aws_db_instance.nonprod.identifier
}

output "nonprod_db_address" {
  description = "Non-production RDS endpoint hostname"
  value       = aws_db_instance.nonprod.address
}

output "nonprod_db_port" {
  description = "Non-production RDS port"
  value       = aws_db_instance.nonprod.port
}

output "nonprod_db_arn" {
  description = "Non-production RDS instance ARN"
  value       = aws_db_instance.nonprod.arn
}

output "nonprod_db_name" {
  description = "Non-production RDS database name (default DB; dev created separately)"
  value       = aws_db_instance.nonprod.db_name
}

output "db_subnet_group_name" {
  description = "RDS subnet group name"
  value       = aws_db_subnet_group.main.name
}

# ============================================================================
# SECRETS MANAGER SECRETS
# ============================================================================

output "db_prod_secret_arn" {
  description = "Production DB secret ARN (kindswap/db/prod/credentials)"
  value       = aws_secretsmanager_secret.db_prod.arn
}

output "db_staging_secret_arn" {
  description = "Staging DB secret ARN (kindswap/db/staging/credentials)"
  value       = aws_secretsmanager_secret.db_staging.arn
}

output "db_dev_secret_arn" {
  description = "Dev DB secret ARN (kindswap/db/dev/credentials)"
  value       = aws_secretsmanager_secret.db_dev.arn
}

output "cosign_key_secret_arn" {
  description = "Cosign private key secret ARN (kindswap/cosign/private-key)"
  value       = aws_secretsmanager_secret.cosign_key.arn
}

# output "api_keys_secret_arns" {
#   description = "All API key secrets ARNs"
#   value = {
#     helius_rpc    = aws_secretsmanager_secret.api_keys["kindswap/api/helius-rpc-key"].arn
#     quicknode     = aws_secretsmanager_secret.api_keys["kindswap/api/quicknode-key"].arn
#     jupiter       = aws_secretsmanager_secret.api_keys["kindswap/api/jupiter-api-key"].arn
#     coingecko_1   = aws_secretsmanager_secret.api_keys["kindswap/api/coingecko-key-1"].arn
#     coingecko_2   = aws_secretsmanager_secret.api_keys["kindswap/api/coingecko-key-2"].arn
#     sentry_dsn    = aws_secretsmanager_secret.api_keys["kindswap/api/sentry-dsn"].arn
#   }
# }

# ============================================================================
# ROTATION LAMBDA
# ============================================================================

output "rotation_lambda_arn" {
  description = "Pre-deployed SAR rotation Lambda ARN (SecretsManagerRDSPostgreSQLRotationSingleUser)"
  value       = local.rotation_lambda_arn
}

output "rotation_lambda_name" {
  description = "Pre-deployed SAR rotation Lambda function name"
  value       = "SecretsManagerRDSPostgreSQLRotationSingleUser"
}

# ============================================================================
# SBOM S3 BUCKET
# ============================================================================

output "sbom_bucket_name" {
  description = "SBOM S3 bucket name"
  value       = aws_s3_bucket.sbom.bucket
}

output "sbom_bucket_arn" {
  description = "SBOM S3 bucket ARN"
  value       = aws_s3_bucket.sbom.arn
}

