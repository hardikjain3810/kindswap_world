# ============================================================================
# ALB CONTROLLER HELM RELEASE
# ============================================================================

output "alb_controller_helm_status" {
  description = "AWS Load Balancer Controller Helm release status"
  value       = helm_release.alb_controller.status
}

output "alb_controller_helm_version" {
  description = "AWS Load Balancer Controller Helm release version"
  value       = helm_release.alb_controller.version
}

# ============================================================================
# CSI SECRETS DRIVER HELM RELEASE
# ============================================================================

output "csi_secrets_driver_helm_status" {
  description = "Secrets Store CSI Driver Helm release status"
  value       = helm_release.csi_secrets_driver.status
}

output "csi_secrets_driver_helm_version" {
  description = "Secrets Store CSI Driver Helm release version"
  value       = helm_release.csi_secrets_driver.version
}

output "csi_secrets_provider_aws_helm_status" {
  description = "Secrets Store CSI Driver AWS Provider Helm release status"
  value       = helm_release.csi_secrets_provider_aws.status
}

output "csi_secrets_provider_aws_helm_version" {
  description = "Secrets Store CSI Driver AWS Provider Helm release version"
  value       = helm_release.csi_secrets_provider_aws.version
}

# ============================================================================
# METRICS SERVER HELM RELEASE
# ============================================================================

output "metrics_server_helm_status" {
  description = "Metrics Server Helm release status"
  value       = helm_release.metrics_server.status
}

output "metrics_server_helm_version" {
  description = "Metrics Server Helm release version"
  value       = helm_release.metrics_server.version
}

# ============================================================================
# EXTERNAL SECRETS OPERATOR HELM RELEASE
# ============================================================================

output "external_secrets_helm_status" {
  description = "External Secrets Operator Helm release status"
  value       = helm_release.external_secrets.status
}

output "external_secrets_helm_version" {
  description = "External Secrets Operator Helm release version"
  value       = helm_release.external_secrets.version
}

# ============================================================================
# CLUSTER SECRET STORE
# ============================================================================

#output "cluster_secret_store_name" {
#  description = "ClusterSecretStore resource name for AWS Secrets Manager"
#  value       = kubernetes_manifest.cluster_secret_store.manifest.metadata.name
#}
#
#output "cluster_secret_store_apiversion" {
#  description = "ClusterSecretStore API version"
#  value       = kubernetes_manifest.cluster_secret_store.manifest.apiVersion
#}

# ============================================================================
# KUBERNETES NAMESPACES
# ============================================================================

output "production_namespace" {
  description = "Production namespace name"
  value       = kubernetes_namespace.production.metadata[0].name
}

output "production_namespace_labels" {
  description = "Production namespace labels"
  value       = kubernetes_namespace.production.metadata[0].labels
}

output "staging_namespace" {
  description = "Staging namespace name"
  value       = kubernetes_namespace.staging.metadata[0].name
}

output "staging_namespace_labels" {
  description = "Staging namespace labels"
  value       = kubernetes_namespace.staging.metadata[0].labels
}

output "dev_namespace" {
  description = "Dev namespace name"
  value       = kubernetes_namespace.dev.metadata[0].name
}

output "dev_namespace_labels" {
  description = "Dev namespace labels"
  value       = kubernetes_namespace.dev.metadata[0].labels
}

# ============================================================================
# NETWORK POLICIES
# ============================================================================

output "production_network_policy" {
  description = "Production namespace network policy name"
  value       = kubernetes_network_policy.production_deny_from_nonprod.metadata[0].name
}

output "staging_network_policy" {
  description = "Staging namespace network policy name"
  value       = kubernetes_network_policy.staging_deny_from_prod.metadata[0].name
}

output "dev_network_policy" {
  description = "Dev namespace network policy name"
  value       = kubernetes_network_policy.dev_deny_from_prod.metadata[0].name
}

