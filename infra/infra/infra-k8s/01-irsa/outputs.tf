# ============================================================================
# ALB CONTROLLER IRSA OUTPUTS
# ============================================================================

output "alb_controller_role_arn" {
  description = "ALB Controller IRSA role ARN"
  value       = aws_iam_role.alb_controller.arn
}

output "alb_controller_role_name" {
  description = "ALB Controller IRSA role name"
  value       = aws_iam_role.alb_controller.name
}

# ============================================================================
# EXTERNAL SECRETS OPERATOR (ESO) IRSA OUTPUTS
# ============================================================================

output "external_secrets_role_arn" {
  description = "External Secrets Operator IRSA role ARN"
  value       = aws_iam_role.external_secrets.arn
}

output "external_secrets_role_name" {
  description = "External Secrets Operator IRSA role name"
  value       = aws_iam_role.external_secrets.name
}

# ============================================================================
# CSI SECRETS DRIVER IRSA OUTPUTS
# ============================================================================

output "csi_secrets_role_arn" {
  description = "CSI Secrets Driver IRSA role ARN"
  value       = aws_iam_role.csi_secrets.arn
}

output "csi_secrets_role_name" {
  description = "CSI Secrets Driver IRSA role name"
  value       = aws_iam_role.csi_secrets.name
}

# ============================================================================
# BACKEND PRODUCTION IRSA OUTPUTS
# ============================================================================

output "backend_prod_role_arn" {
  description = "Backend production IRSA role ARN"
  value       = aws_iam_role.backend_prod.arn
}

output "backend_prod_role_name" {
  description = "Backend production IRSA role name"
  value       = aws_iam_role.backend_prod.name
}

# ============================================================================
# BACKEND STAGING IRSA OUTPUTS
# ============================================================================

output "backend_staging_role_arn" {
  description = "Backend staging IRSA role ARN"
  value       = aws_iam_role.backend_staging.arn
}

output "backend_staging_role_name" {
  description = "Backend staging IRSA role name"
  value       = aws_iam_role.backend_staging.name
}

# ============================================================================
# BACKEND DEV IRSA OUTPUTS
# ============================================================================

output "backend_dev_role_arn" {
  description = "Backend dev IRSA role ARN"
  value       = aws_iam_role.backend_dev.arn
}

output "backend_dev_role_name" {
  description = "Backend dev IRSA role name"
  value       = aws_iam_role.backend_dev.name
}

# ============================================================================
# EBS CSI DRIVER IRSA OUTPUTS
# ============================================================================

output "ebs_csi_driver_role_arn" {
  description = "EBS CSI Driver IRSA role ARN"
  value       = aws_iam_role.ebs_csi_driver.arn
}

output "ebs_csi_driver_role_name" {
  description = "EBS CSI Driver IRSA role name"
  value       = aws_iam_role.ebs_csi_driver.name
}

