# ============================================================================
# BACKEND HELM RELEASES
# ============================================================================

output "backend_production_status" {
  description = "Status of NestJS backend Helm release in production"
  value       = helm_release.backend_production.status
}

output "backend_production_namespace" {
  description = "Kubernetes namespace for production backend"
  value       = helm_release.backend_production.namespace
}

output "backend_staging_status" {
  description = "Status of NestJS backend Helm release in staging"
  value       = helm_release.backend_staging.status
}

output "backend_staging_namespace" {
  description = "Kubernetes namespace for staging backend"
  value       = helm_release.backend_staging.namespace
}

output "backend_dev_status" {
  description = "Status of NestJS backend Helm release in dev"
  value       = helm_release.backend_dev.status
}

output "backend_dev_namespace" {
  description = "Kubernetes namespace for dev backend"
  value       = helm_release.backend_dev.namespace
}

# ============================================================================
# FRONTEND HELM RELEASES
# ============================================================================

output "frontend_production_status" {
  description = "Status of React frontend Helm release in production"
  value       = helm_release.frontend_production.status
}

output "frontend_production_namespace" {
  description = "Kubernetes namespace for production frontend"
  value       = helm_release.frontend_production.namespace
}

output "frontend_staging_status" {
  description = "Status of React frontend Helm release in staging"
  value       = helm_release.frontend_staging.status
}

output "frontend_staging_namespace" {
  description = "Kubernetes namespace for staging frontend"
  value       = helm_release.frontend_staging.namespace
}

output "frontend_dev_status" {
  description = "Status of React frontend Helm release in dev"
  value       = helm_release.frontend_dev.status
}

output "frontend_dev_namespace" {
  description = "Kubernetes namespace for dev frontend"
  value       = helm_release.frontend_dev.namespace
}

# ============================================================================
# SECRET PROVIDER CLASSES (CSI)
# ============================================================================

output "secret_provider_class_production" {
  description = "SecretProviderClass name for production CSI volume mounts"
  value       = kubernetes_manifest.secret_provider_production.manifest.metadata.name
}

output "secret_provider_class_staging" {
  description = "SecretProviderClass name for staging CSI volume mounts"
  value       = kubernetes_manifest.secret_provider_staging.manifest.metadata.name
}

output "secret_provider_class_dev" {
  description = "SecretProviderClass name for dev CSI volume mounts"
  value       = kubernetes_manifest.secret_provider_dev.manifest.metadata.name
}

# ============================================================================
# EXTERNAL SECRETS
# ============================================================================

output "external_secret_production" {
  description = "ExternalSecret name for production API keys"
  value       = kubernetes_manifest.external_secret_production.manifest.metadata.name
}

output "external_secret_staging" {
  description = "ExternalSecret name for staging API keys"
  value       = kubernetes_manifest.external_secret_staging.manifest.metadata.name
}

output "external_secret_dev" {
  description = "ExternalSecret name for dev API keys"
  value       = kubernetes_manifest.external_secret_dev.manifest.metadata.name
}

# ============================================================================
# DEPLOYMENT VERIFICATION
# ============================================================================

output "deployment_endpoints" {
  description = "DNS endpoints for KindSwap deployments"
  value = {
    production_backend = "https://kindswap.world/api"
    production_frontend = "https://kindswap.world"
    staging_backend = "https://stg.kindswap.world/api (VPN-only)"
    staging_frontend = "https://stg.kindswap.world (VPN-only)"
    dev_backend = "https://dev.kindswap.world/api (VPN-only)"
    dev_frontend = "https://dev.kindswap.world (VPN-only)"
  }
}
