# ============================================================================
# REMOTE STATE — EKS, IRSA, DATA, REGISTRY, SECURITY MODULES
# ============================================================================

data "terraform_remote_state" "eks" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/eks/terraform.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "irsa" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "k8s/irsa/terraform.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "data" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/data/terraform.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "registry" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/registry/terraform.tfstate"
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
# SECTION 1 — SECRETPROVIDERCLASS MANIFESTS (CSI Secrets Driver)
# ============================================================================
# These manifests configure the CSI Secrets Store Driver to mount DB credentials
# and API keys from AWS Secrets Manager into pod filesystems
# rotationPollInterval=120s ensures credentials auto-refresh without pod restart

resource "kubernetes_manifest" "secret_provider_production" {
  manifest = {
    apiVersion = "secrets-store.csi.x-k8s.io/v1"
    kind       = "SecretProviderClass"
    metadata = {
      name      = "kindswap-secrets"
      namespace = "production"
    }
    spec = {
      provider = "aws"
      parameters = {
        objects = yamlencode([
          {
            objectName  = "kindswap/db/prod/credentials"
            objectType  = "secretsmanager"
            objectAlias = "db-credentials"
          },
          {
            objectName  = "kindswap/api/helius-rpc-key"
            objectType  = "secretsmanager"
            objectAlias = "helius-rpc-key"
          },
          {
            objectName  = "kindswap/api/jupiter-api-key"
            objectType  = "secretsmanager"
            objectAlias = "jupiter-api-key"
          },
          {
            objectName  = "kindswap/api/sentry-dsn"
            objectType  = "secretsmanager"
            objectAlias = "sentry-dsn"
          }
        ])
        rotationPollInterval = "120s"
      }
    }
  }

  depends_on = [data.terraform_remote_state.eks]
}

resource "kubernetes_manifest" "secret_provider_staging" {
  manifest = {
    apiVersion = "secrets-store.csi.x-k8s.io/v1"
    kind       = "SecretProviderClass"
    metadata = {
      name      = "kindswap-secrets"
      namespace = "staging"
    }
    spec = {
      provider = "aws"
      parameters = {
        objects = yamlencode([
          {
            objectName  = "kindswap/db/staging/credentials"
            objectType  = "secretsmanager"
            objectAlias = "db-credentials"
          },
          {
            objectName  = "kindswap/api/helius-rpc-key"
            objectType  = "secretsmanager"
            objectAlias = "helius-rpc-key"
          },
          {
            objectName  = "kindswap/api/jupiter-api-key"
            objectType  = "secretsmanager"
            objectAlias = "jupiter-api-key"
          },
          {
            objectName  = "kindswap/api/sentry-dsn"
            objectType  = "secretsmanager"
            objectAlias = "sentry-dsn"
          }
        ])
        rotationPollInterval = "120s"
      }
    }
  }

  depends_on = [data.terraform_remote_state.eks]
}

resource "kubernetes_manifest" "secret_provider_dev" {
  manifest = {
    apiVersion = "secrets-store.csi.x-k8s.io/v1"
    kind       = "SecretProviderClass"
    metadata = {
      name      = "kindswap-secrets"
      namespace = "dev"
    }
    spec = {
      provider = "aws"
      parameters = {
        objects = yamlencode([
          {
            objectName  = "kindswap/db/dev/credentials"
            objectType  = "secretsmanager"
            objectAlias = "db-credentials"
          },
          {
            objectName  = "kindswap/api/helius-rpc-key"
            objectType  = "secretsmanager"
            objectAlias = "helius-rpc-key"
          },
          {
            objectName  = "kindswap/api/jupiter-api-key"
            objectType  = "secretsmanager"
            objectAlias = "jupiter-api-key"
          },
          {
            objectName  = "kindswap/api/sentry-dsn"
            objectType  = "secretsmanager"
            objectAlias = "sentry-dsn"
          }
        ])
        rotationPollInterval = "120s"
      }
    }
  }

  depends_on = [data.terraform_remote_state.eks]
}

# ============================================================================
# SECTION 2 — EXTERNALSECRET MANIFESTS (External Secrets Operator)
# ============================================================================
# These manifests configure External Secrets Operator to fetch API keys
# from AWS Secrets Manager and sync them into Kubernetes Secrets
# refreshInterval=1h ensures API key changes propagate within an hour

resource "kubernetes_manifest" "external_secret_production" {
  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = "ExternalSecret"
    metadata = {
      name      = "kindswap-api-keys"
      namespace = "production"
    }
    spec = {
      refreshInterval = "1h"
      secretStoreRef = {
        name = "kindswap-aws-secret-store"
        kind = "ClusterSecretStore"
      }
      target = {
        name            = "kindswap-api-keys"
        creationPolicy  = "Owner"
      }
      data = [
        {
          secretKey = "HELIUS_RPC_KEY"
          remoteRef = {
            key      = "kindswap/api/helius-rpc-key"
            property = "value"
          }
        },
        {
          secretKey = "QUICKNODE_KEY"
          remoteRef = {
            key      = "kindswap/api/quicknode-key"
            property = "value"
          }
        },
        {
          secretKey = "JUPITER_API_KEY"
          remoteRef = {
            key      = "kindswap/api/jupiter-api-key"
            property = "value"
          }
        },
        {
          secretKey = "COINGECKO_KEY_1"
          remoteRef = {
            key      = "kindswap/api/coingecko-key-1"
            property = "value"
          }
        },
        {
          secretKey = "COINGECKO_KEY_2"
          remoteRef = {
            key      = "kindswap/api/coingecko-key-2"
            property = "value"
          }
        },
        {
          secretKey = "SENTRY_DSN"
          remoteRef = {
            key      = "kindswap/api/sentry-dsn"
            property = "value"
          }
        }
      ]
    }
  }

  depends_on = [data.terraform_remote_state.eks]
}

resource "kubernetes_manifest" "external_secret_staging" {
  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = "ExternalSecret"
    metadata = {
      name      = "kindswap-api-keys"
      namespace = "staging"
    }
    spec = {
      refreshInterval = "1h"
      secretStoreRef = {
        name = "kindswap-aws-secret-store"
        kind = "ClusterSecretStore"
      }
      target = {
        name            = "kindswap-api-keys"
        creationPolicy  = "Owner"
      }
      data = [
        {
          secretKey = "HELIUS_RPC_KEY"
          remoteRef = {
            key      = "kindswap/api/helius-rpc-key"
            property = "value"
          }
        },
        {
          secretKey = "QUICKNODE_KEY"
          remoteRef = {
            key      = "kindswap/api/quicknode-key"
            property = "value"
          }
        },
        {
          secretKey = "JUPITER_API_KEY"
          remoteRef = {
            key      = "kindswap/api/jupiter-api-key"
            property = "value"
          }
        },
        {
          secretKey = "COINGECKO_KEY_1"
          remoteRef = {
            key      = "kindswap/api/coingecko-key-1"
            property = "value"
          }
        },
        {
          secretKey = "COINGECKO_KEY_2"
          remoteRef = {
            key      = "kindswap/api/coingecko-key-2"
            property = "value"
          }
        },
        {
          secretKey = "SENTRY_DSN"
          remoteRef = {
            key      = "kindswap/api/sentry-dsn"
            property = "value"
          }
        }
      ]
    }
  }

  depends_on = [data.terraform_remote_state.eks]
}

resource "kubernetes_manifest" "external_secret_dev" {
  manifest = {
    apiVersion = "external-secrets.io/v1beta1"
    kind       = "ExternalSecret"
    metadata = {
      name      = "kindswap-api-keys"
      namespace = "dev"
    }
    spec = {
      refreshInterval = "1h"
      secretStoreRef = {
        name = "kindswap-aws-secret-store"
        kind = "ClusterSecretStore"
      }
      target = {
        name            = "kindswap-api-keys"
        creationPolicy  = "Owner"
      }
      data = [
        {
          secretKey = "HELIUS_RPC_KEY"
          remoteRef = {
            key      = "kindswap/api/helius-rpc-key"
            property = "value"
          }
        },
        {
          secretKey = "QUICKNODE_KEY"
          remoteRef = {
            key      = "kindswap/api/quicknode-key"
            property = "value"
          }
        },
        {
          secretKey = "JUPITER_API_KEY"
          remoteRef = {
            key      = "kindswap/api/jupiter-api-key"
            property = "value"
          }
        },
        {
          secretKey = "COINGECKO_KEY_1"
          remoteRef = {
            key      = "kindswap/api/coingecko-key-1"
            property = "value"
          }
        },
        {
          secretKey = "COINGECKO_KEY_2"
          remoteRef = {
            key      = "kindswap/api/coingecko-key-2"
            property = "value"
          }
        },
        {
          secretKey = "SENTRY_DSN"
          remoteRef = {
            key      = "kindswap/api/sentry-dsn"
            property = "value"
          }
        }
      ]
    }
  }

  depends_on = [data.terraform_remote_state.eks]
}

# ============================================================================
# SECTION 3 — NESTJS BACKEND HELM RELEASES (3 ENVIRONMENTS)
# ============================================================================

resource "helm_release" "backend_production" {
  name      = "kindswap-backend"
  chart     = "${path.module}/helm/kindswap-backend"
  namespace = "production"
  atomic    = false
  timeout   = 900

  set {
    name  = "environment"
    value = "production"
  }
  set {
    name  = "image.repository"
    value = data.terraform_remote_state.registry.outputs.backend_repository_url
  }
  set {
    name  = "image.tag"
    value = var.backend_image_tag
  }
  set {
    name  = "replicaCount.min"
    value = "2"
  }
  set {
    name  = "replicaCount.max"
    value = "10"
  }
  set {
    name  = "resources.requests.cpu"
    value = "250m"
  }
  set {
    name  = "resources.requests.memory"
    value = "256Mi"
  }
  set {
    name  = "resources.limits.cpu"
    value = "1000m"
  }
  set {
    name  = "resources.limits.memory"
    value = "512Mi"
  }
  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = data.terraform_remote_state.irsa.outputs.backend_prod_role_arn
  }
  set {
    name  = "ingress.host"
    value = "kindswap.world"
  }
  set {
    name  = "ingress.scheme"
    value = "internet-facing"
  }
  set {
    name  = "hpa.targetCPUPercent"
    value = "70"
  }
  set {
    name  = "pgPool.max"
    value = "40"
  }

  depends_on = [
    kubernetes_manifest.secret_provider_production,
    kubernetes_manifest.external_secret_production
  ]
}

resource "helm_release" "backend_staging" {
  name      = "kindswap-backend"
  chart     = "${path.module}/helm/kindswap-backend"
  namespace = "staging"
  atomic    = false
  timeout   = 900

  set {
    name  = "environment"
    value = "staging"
  }
  set {
    name  = "image.repository"
    value = data.terraform_remote_state.registry.outputs.backend_repository_url
  }
  set {
    name  = "image.tag"
    value = var.backend_image_tag
  }
  set {
    name  = "replicaCount.min"
    value = "1"
  }
  set {
    name  = "replicaCount.max"
    value = "3"
  }
  set {
    name  = "resources.requests.cpu"
    value = "100m"
  }
  set {
    name  = "resources.requests.memory"
    value = "128Mi"
  }
  set {
    name  = "resources.limits.cpu"
    value = "500m"
  }
  set {
    name  = "resources.limits.memory"
    value = "256Mi"
  }
  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = data.terraform_remote_state.irsa.outputs.backend_staging_role_arn
  }
  set {
    name  = "ingress.host"
    value = "stg.kindswap.world"
  }
  set {
    name  = "ingress.scheme"
    value = "internal"
  }
  set {
    name  = "ingress.vpnCidr"
    value = var.vpn_cidr
  }
  set {
    name  = "pgPool.max"
    value = "20"
  }

  depends_on = [
    kubernetes_manifest.secret_provider_staging,
    kubernetes_manifest.external_secret_staging
  ]
}

resource "helm_release" "backend_dev" {
  name      = "kindswap-backend"
  chart     = "${path.module}/helm/kindswap-backend"
  namespace = "dev"
  atomic    = false
  timeout   = 900

  set {
    name  = "environment"
    value = "dev"
  }
  set {
    name  = "image.repository"
    value = data.terraform_remote_state.registry.outputs.backend_repository_url
  }
  set {
    name  = "image.tag"
    value = var.backend_image_tag
  }
  set {
    name  = "replicaCount.min"
    value = "1"
  }
  set {
    name  = "replicaCount.max"
    value = "1"
  }
  set {
    name  = "resources.requests.cpu"
    value = "100m"
  }
  set {
    name  = "resources.requests.memory"
    value = "128Mi"
  }
  set {
    name  = "resources.limits.cpu"
    value = "250m"
  }
  set {
    name  = "resources.limits.memory"
    value = "256Mi"
  }
  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = data.terraform_remote_state.irsa.outputs.backend_dev_role_arn
  }
  set {
    name  = "ingress.host"
    value = "dev.kindswap.world"
  }
  set {
    name  = "ingress.scheme"
    value = "internal"
  }
  set {
    name  = "ingress.vpnCidr"
    value = var.vpn_cidr
  }
  set {
    name  = "pgPool.max"
    value = "10"
  }

  depends_on = [
    kubernetes_manifest.secret_provider_dev,
    kubernetes_manifest.external_secret_dev
  ]
}

# ============================================================================
# SECTION 4 — REACT FRONTEND HELM RELEASES (3 ENVIRONMENTS)
# ============================================================================

resource "helm_release" "frontend_production" {
  name      = "kindswap-frontend"
  chart     = "${path.module}/helm/kindswap-frontend"
  namespace = "production"
  atomic    = false
  timeout   = 900

  set {
    name  = "environment"
    value = "production"
  }
  set {
    name  = "image.repository"
    value = data.terraform_remote_state.registry.outputs.frontend_repository_url
  }
  set {
    name  = "image.tag"
    value = var.frontend_image_tag
  }
  set {
    name  = "replicaCount"
    value = "2"
  }
  set {
    name  = "ingress.host"
    value = "kindswap.world"
  }
  set {
    name  = "ingress.scheme"
    value = "internet-facing"
  }
}

resource "helm_release" "frontend_staging" {
  name      = "kindswap-frontend"
  chart     = "${path.module}/helm/kindswap-frontend"
  namespace = "staging"
  atomic    = false
  timeout   = 900

  set {
    name  = "environment"
    value = "staging"
  }
  set {
    name  = "image.repository"
    value = data.terraform_remote_state.registry.outputs.frontend_repository_url
  }
  set {
    name  = "image.tag"
    value = var.frontend_image_tag
  }
  set {
    name  = "replicaCount"
    value = "1"
  }
  set {
    name  = "ingress.host"
    value = "stg.kindswap.world"
  }
  set {
    name  = "ingress.scheme"
    value = "internal"
  }
  set {
    name  = "ingress.vpnCidr"
    value = var.vpn_cidr
  }
}

resource "helm_release" "frontend_dev" {
  name      = "kindswap-frontend"
  chart     = "${path.module}/helm/kindswap-frontend"
  namespace = "dev"
  atomic    = false
  timeout   = 900

  set {
    name  = "environment"
    value = "dev"
  }
  set {
    name  = "image.repository"
    value = data.terraform_remote_state.registry.outputs.frontend_repository_url
  }
  set {
    name  = "image.tag"
    value = var.frontend_image_tag
  }
  set {
    name  = "replicaCount"
    value = "1"
  }
  set {
    name  = "ingress.host"
    value = "dev.kindswap.world"
  }
  set {
    name  = "ingress.scheme"
    value = "internal"
  }
  set {
    name  = "ingress.vpnCidr"
    value = var.vpn_cidr
  }
}
