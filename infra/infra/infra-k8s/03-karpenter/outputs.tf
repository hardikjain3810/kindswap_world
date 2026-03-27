# ============================================================================
# KARPENTER HELM RELEASE & NAMESPACE
# ============================================================================

output "karpenter_helm_status" {
  description = "Karpenter Helm release deployment status"
  value       = helm_release.karpenter.status
}

output "karpenter_helm_version" {
  description = "Karpenter Helm chart version deployed"
  value       = helm_release.karpenter.version
}

output "karpenter_namespace" {
  description = "Kubernetes namespace for Karpenter"
  value       = helm_release.karpenter.namespace
}

# ============================================================================
# EKS ACCESS ENTRY FOR KARPENTER NODES
# ============================================================================

output "karpenter_nodes_access_entry_arn" {
  description = "ARN of EKS access entry for Karpenter nodes"
  value       = aws_eks_access_entry.karpenter_nodes.access_entry_arn
}

output "karpenter_nodes_access_entry_type" {
  description = "Type of EKS access entry for Karpenter nodes"
  value       = aws_eks_access_entry.karpenter_nodes.type
}

# ============================================================================
# EC2NODECLASS (Phase 2 — Currently Commented Out)
# ============================================================================
# output "ec2_node_class_name" {
#   description = "EC2NodeClass name for Karpenter nodes"
#   value       = kubernetes_manifest.ec2_node_class.manifest.metadata.name
# }
#
# output "ec2_node_class_ami_family" {
#   description = "AMI family used by EC2NodeClass"
#   value       = kubernetes_manifest.ec2_node_class.manifest.spec.amiFamily
# }

# ============================================================================
# NODEPOOL (Phase 2 — Currently Commented Out)
# ============================================================================
# output "node_pool_name" {
#   description = "Karpenter NodePool name"
#   value       = kubernetes_manifest.node_pool.manifest.metadata.name
# }
#
# output "node_pool_weight" {
#   description = "NodePool scheduling weight"
#   value       = kubernetes_manifest.node_pool.manifest.spec.weight
# }
#
# output "node_pool_cpu_limit" {
#   description = "NodePool CPU limit"
#   value       = kubernetes_manifest.node_pool.manifest.spec.limits.cpu
# }
#
# output "node_pool_memory_limit" {
#   description = "NodePool memory limit"
#   value       = kubernetes_manifest.node_pool.manifest.spec.limits.memory
# }
