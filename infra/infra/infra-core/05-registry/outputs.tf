# ============================================================================
# MAP-BASED OUTPUTS (used by CI/CD pipeline loops)
# ============================================================================

output "repository_urls" {
  description = "Map of repository name to URL — used by CI/CD pipelines"
  value       = { for k, v in aws_ecr_repository.repos : k => v.repository_url }
}

output "repository_arns" {
  description = "Map of repository name to ARN"
  value       = { for k, v in aws_ecr_repository.repos : k => v.arn }
}

output "repository_names" {
  description = "List of all ECR repository names"
  value       = keys(aws_ecr_repository.repos)
}

# ============================================================================
# INDIVIDUAL REPOSITORY OUTPUTS (used by CI/CD Helm values)
# ============================================================================

output "backend_repository_url" {
  description = "KindSwap backend ECR repository URL"
  value       = aws_ecr_repository.repos["kindswap-backend"].repository_url
}

output "frontend_repository_url" {
  description = "KindSwap frontend ECR repository URL"
  value       = aws_ecr_repository.repos["kindswap-frontend"].repository_url
}

output "admin_backend_repository_url" {
  description = "KindSwap admin backend ECR repository URL"
  value       = aws_ecr_repository.repos["kindswap-admin-backend"].repository_url
}

output "admin_frontend_repository_url" {
  description = "KindSwap admin frontend ECR repository URL"
  value       = aws_ecr_repository.repos["kindswap-admin-frontend"].repository_url
}

# ============================================================================
# REGISTRY-LEVEL OUTPUTS
# ============================================================================

output "registry_id" {
  description = "ECR registry ID (AWS account ID)"
  value       = data.aws_caller_identity.current.account_id
}

output "registry_url" {
  description = "ECR registry base URL"
  value       = "${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
}

output "ecr_login_command" {
  description = "Command to authenticate Docker with ECR — use in CI/CD scripts"
  value       = "aws ecr get-login-password --region ${data.aws_region.current.name} | docker login --username AWS --password-stdin ${data.aws_caller_identity.current.account_id}.dkr.ecr.${data.aws_region.current.name}.amazonaws.com"
  sensitive   = false
}

