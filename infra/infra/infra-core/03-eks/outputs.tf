# ============================================================================
# SECTION 1 — EKS CLUSTER OUTPUTS
# ============================================================================

output "cluster_id" {
  description = "EKS cluster ID (same as cluster name)"
  value       = aws_eks_cluster.main.id
}

output "cluster_name" {
  description = "EKS cluster name"
  value       = aws_eks_cluster.main.name
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane (HTTPS)"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_version" {
  description = "Kubernetes version running on EKS cluster"
  value       = aws_eks_cluster.main.version
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate authority data (for kubeconfig, kubectl, Helm)"
  value       = aws_eks_cluster.main.certificate_authority[0].data
  sensitive   = true
}

output "cluster_oidc_issuer_url" {
  description = "OIDC issuer URL (raw, with https://)"
  value       = aws_eks_cluster.main.identity[0].oidc[0].issuer
}

# ============================================================================
# SECTION 2 — OIDC PROVIDER OUTPUTS (For IRSA in 01-irsa module)
# ============================================================================

output "oidc_provider_arn" {
  description = "ARN of the OIDC provider for IRSA trust relationships"
  value       = aws_iam_openid_connect_provider.eks_cluster.arn
}

output "oidc_provider_url" {
  description = "OIDC provider URL without https:// prefix (for trust policy conditions)"
  value       = replace(aws_iam_openid_connect_provider.eks_cluster.url, "https://", "")
}

# ============================================================================
# SECTION 3 — CORE NODE GROUP OUTPUTS
# ============================================================================

output "core_node_group_name" {
  description = "Name of the EKS core node group"
  value       = aws_eks_node_group.core_nodes.node_group_name
}

output "core_node_group_status" {
  description = "Status of the core node group (ACTIVE, CREATING, UPDATING, DELETING, CREATE_FAILED, UPDATE_FAILED, DELETE_FAILED)"
  value       = aws_eks_node_group.core_nodes.status
}

# ============================================================================
# SECTION 4 — KARPENTER CONTROLLER IRSA OUTPUTS
# ============================================================================

output "karpenter_controller_role_arn" {
  description = "ARN of the Karpenter controller IRSA role"
  value       = aws_iam_role.karpenter_controller.arn
}

output "karpenter_controller_role_name" {
  description = "Name of the Karpenter controller IRSA role"
  value       = aws_iam_role.karpenter_controller.name
}

# ============================================================================
# SECTION 5 — KARPENTER NODE ROLE OUTPUTS (For EC2NodeClass provisioning)
# ============================================================================

output "karpenter_node_role_arn" {
  description = "ARN of the Karpenter node role (attached to Karpenter-provisioned EC2 instances)"
  value       = aws_iam_role.karpenter_node.arn
}

output "karpenter_node_role_name" {
  description = "Name of the Karpenter node role"
  value       = aws_iam_role.karpenter_node.name
}

output "karpenter_node_instance_profile_name" {
  description = "Name of the Karpenter node instance profile (for EC2NodeClass nodeRole field)"
  value       = aws_iam_instance_profile.karpenter_node.name
}

# ============================================================================
# SECTION 6 — KARPENTER SPOT INTERRUPTION QUEUE OUTPUTS
# ============================================================================

output "karpenter_interruption_queue_name" {
  description = "SQS queue name for Karpenter Spot interruption handling (for Karpenter Helm values)"
  value       = aws_sqs_queue.karpenter_interruption.name
}

output "karpenter_interruption_queue_arn" {
  description = "ARN of the SQS queue for Karpenter interruptions"
  value       = aws_sqs_queue.karpenter_interruption.arn
}

# ============================================================================
# SECTION 7 — CLOUDWATCH LOG GROUP OUTPUTS
# ============================================================================

output "eks_cluster_log_group_name" {
  description = "CloudWatch log group name for EKS control plane logs"
  value       = aws_cloudwatch_log_group.eks_cluster.name
}

