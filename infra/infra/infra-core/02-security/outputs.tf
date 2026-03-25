# ============================================================================
# KMS CMK Outputs
# ============================================================================

output "kms_key_id" {
  description = "ID of KindSwap master CMK"
  value       = aws_kms_key.master.key_id
}

output "kms_key_arn" {
  description = "ARN of KindSwap master CMK"
  value       = aws_kms_key.master.arn
}

output "kms_alias_arn" {
  description = "ARN of KindSwap master CMK alias"
  value       = aws_kms_alias.master.arn
}

# ============================================================================
# Security Group Outputs
# ============================================================================

output "alb_sg_id" {
  description = "ID of ALB security group"
  value       = aws_security_group.alb.id
}

output "eks_cluster_sg_id" {
  description = "ID of EKS cluster security group"
  value       = aws_security_group.eks_cluster.id
}

output "eks_node_sg_id" {
  description = "ID of EKS node security group"
  value       = aws_security_group.eks_node.id
}

output "rds_sg_id" {
  description = "ID of RDS security group"
  value       = aws_security_group.rds.id
}

output "vpn_sg_id" {
  description = "ID of VPN security group"
  value       = aws_security_group.vpn.id
}

output "nat_sg_id" {
  description = "ID of NAT instance security group (managed by 01-networking module)"
  value       = data.aws_security_group.nat.id
}

# ============================================================================
# IAM Role Outputs
# ============================================================================

output "eks_cluster_role_arn" {
  description = "ARN of EKS cluster IAM role"
  value       = aws_iam_role.eks_cluster.arn
}

output "eks_node_role_arn" {
  description = "ARN of EKS node IAM role"
  value       = aws_iam_role.eks_node.arn
}

output "eks_node_role_name" {
  description = "Name of EKS node IAM role (needed for managed node group attachment)"
  value       = aws_iam_role.eks_node.name
}

output "github_actions_role_arn" {
  description = "ARN of GitHub Actions OIDC IAM role"
  value       = aws_iam_role.github_actions.arn
}

output "secrets_rotation_lambda_role_arn" {
  description = "ARN of Secrets Manager rotation Lambda IAM role"
  value       = aws_iam_role.secrets_rotation_lambda.arn
}

# ============================================================================
# IAM Policy & OIDC Outputs
# ============================================================================

output "mfa_enforcement_policy_arn" {
  description = "ARN of MFA enforcement policy"
  value       = aws_iam_policy.mfa_enforcement.arn
}

output "github_oidc_provider_arn" {
  description = "ARN of GitHub Actions OIDC provider"
  value       = aws_iam_openid_connect_provider.github_actions.arn
}

# ============================================================================
# CloudTrail Outputs
# ============================================================================

# output "cloudtrail_arn" (DISABLED)
# output "cloudtrail_arn" {
#   description = "ARN of CloudTrail trail for audit logging"
#   value       = aws_cloudtrail.main.arn
# }

# output "cloudtrail_logs_bucket_name" (DISABLED)
# output "cloudtrail_logs_bucket_name" {
#   description = "Name of S3 bucket for CloudTrail logs (KMS encrypted)"
#   value       = aws_s3_bucket.cloudtrail_logs.id
# }

