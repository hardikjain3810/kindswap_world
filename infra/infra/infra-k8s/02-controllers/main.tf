# ============================================================================
# REMOTE STATE — EKS AND IRSA MODULES
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

# ============================================================================
# SECTION 1 — AWS LOAD BALANCER CONTROLLER v1.8.1
# ============================================================================
# Runs on core (system) nodes only — not on Karpenter Spot nodes
# Replica count 2 for HA across multiple AZs
# IRSA role bound via serviceAccount annotation

resource "helm_release" "alb_controller" {
  depends_on = []

  name       = "aws-load-balancer-controller"
  repository = "https://aws.github.io/eks-charts"
  chart      = "aws-load-balancer-controller"
  version    = "1.8.1"
  namespace  = "kube-system"
  atomic     = true
  timeout    = 300

  set {
    name  = "clusterName"
    value = var.cluster_name
  }

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "aws-load-balancer-controller"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = data.terraform_remote_state.irsa.outputs.alb_controller_role_arn
  }

  set {
    name  = "replicaCount"
    value = "2"
  }

  # Tolerations for CriticalAddonsOnly taint on core (system) nodes
  set {
    name  = "tolerations[0].key"
    value = "CriticalAddonsOnly"
  }

  set {
    name  = "tolerations[0].operator"
    value = "Exists"
  }

  set {
    name  = "tolerations[0].effect"
    value = "NoSchedule"
  }
}

# ============================================================================
# SECTION 2 — SECRETS STORE CSI DRIVER v1.4.4
# ============================================================================
# DaemonSet — must run on ALL nodes (core + Karpenter)
# Enables secret rotation polling every 120s

resource "helm_release" "csi_secrets_driver" {
  depends_on = [helm_release.alb_controller]

  name       = "secrets-store-csi-driver"
  repository = "https://kubernetes-sigs.github.io/secrets-store-csi-driver/charts"
  chart      = "secrets-store-csi-driver"
  version    = "1.4.4"
  namespace  = "kube-system"
  atomic     = true
  timeout    = 300

  # Enable secret rotation polling
  set {
    name  = "syncSecret.enabled"
    value = "true"
  }

  set {
    name  = "enableSecretRotation"
    value = "true"
  }

  set {
    name  = "rotationPollInterval"
    value = "120s"
  }

  # DaemonSet tolerance — allows running on all nodes including Karpenter nodes
  set {
    name  = "tolerations[0].operator"
    value = "Exists"
  }
}

# ============================================================================
# SECTION 2B — SECRETS STORE CSI DRIVER AWS PROVIDER v0.3.9
# ============================================================================
# Provider plugin for AWS Secrets Manager integration
# Must run after CSI Driver is deployed

resource "helm_release" "csi_secrets_provider_aws" {
  depends_on = [helm_release.csi_secrets_driver]

  name       = "secrets-store-csi-driver-provider-aws"
  repository = "https://aws.github.io/secrets-store-csi-driver-provider-aws"
  chart      = "secrets-store-csi-driver-provider-aws"
  version    = "0.3.9"
  namespace  = "kube-system"
  atomic     = true
  timeout    = 300

  # DaemonSet — also runs on all nodes
  set {
    name  = "tolerations[0].operator"
    value = "Exists"
  }
}

# ============================================================================
# SECTION 3 — METRICS SERVER v3.12.1
# ============================================================================
# Required for HPA (Horizontal Pod Autoscaling) and resource monitoring
# IMPORTANT: Do NOT add --kubelet-insecure-tls
# EKS nodes have proper kubelet certificates — insecure TLS causes auth failures on EKS 1.31

resource "helm_release" "metrics_server" {
  depends_on = [helm_release.csi_secrets_driver]
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server/"
  chart      = "metrics-server"
  version    = "3.12.1"
  namespace  = "kube-system"
  atomic     = true
  timeout    = 300

  # Secure kubelet communication arguments (no insecure TLS)
  set {
    name  = "args[0]"
    value = "--kubelet-preferred-address-types=InternalIP"
  }

  set {
    name  = "args[1]"
    value = "--kubelet-use-node-status-port"
  }

  set {
    name  = "args[2]"
    value = "--metric-resolution=15s"
  }

  # Tolerations for CriticalAddonsOnly taint on core (system) nodes
  set {
    name  = "tolerations[0].key"
    value = "CriticalAddonsOnly"
  }

  set {
    name  = "tolerations[0].operator"
    value = "Exists"
  }

  set {
    name  = "tolerations[0].effect"
    value = "NoSchedule"
  }
}

# ============================================================================
# SECTION 4 — EXTERNAL SECRETS OPERATOR v0.10.3
# ============================================================================
# Syncs Secrets Manager secrets into Kubernetes Secret objects
# Runs on core nodes only via CriticalAddonsOnly taint tolerance
# IRSA role bound via serviceAccount annotation

resource "helm_release" "external_secrets" {
  depends_on = [helm_release.csi_secrets_provider_aws, helm_release.metrics_server]

  name             = "external-secrets"
  repository       = "https://charts.external-secrets.io"
  chart            = "external-secrets"
  version          = "0.10.3"
  namespace        = "external-secrets"
  atomic           = false
  timeout          = 900
  create_namespace = true

  set {
    name  = "serviceAccount.create"
    value = "true"
  }

  set {
    name  = "serviceAccount.name"
    value = "external-secrets"
  }

  set {
    name  = "serviceAccount.annotations.eks\\.amazonaws\\.com/role-arn"
    value = data.terraform_remote_state.irsa.outputs.external_secrets_role_arn
  }

  # Tolerations for CriticalAddonsOnly taint on core (system) nodes
  set {
    name  = "tolerations[0].key"
    value = "CriticalAddonsOnly"
  }

  set {
    name  = "tolerations[0].operator"
    value = "Exists"
  }

  set {
    name  = "tolerations[0].effect"
    value = "NoSchedule"
  }

  # cert-controller tolerations
  set {
    name  = "certController.tolerations[0].key"
    value = "CriticalAddonsOnly"
  }

  set {
    name  = "certController.tolerations[0].operator"
    value = "Exists"
  }

  set {
    name  = "certController.tolerations[0].effect"
    value = "NoSchedule"
  }

  # webhook tolerations
  set {
    name  = "webhook.tolerations[0].key"
    value = "CriticalAddonsOnly"
  }

  set {
    name  = "webhook.tolerations[0].operator"
    value = "Exists"
  }

  set {
    name  = "webhook.tolerations[0].effect"
    value = "NoSchedule"
  }
}

# ============================================================================
# WAIT FOR CRDs TO STABILIZE
# ============================================================================

resource "time_sleep" "wait_for_crds" {
  depends_on = [helm_release.external_secrets, helm_release.csi_secrets_driver, helm_release.csi_secrets_provider_aws]
  create_duration = "30s"
}

# ============================================================================
# SECTION 5 — CLUSTER SECRET STORE
# ============================================================================
# ClusterSecretStore for AWS Secrets Manager integration
# References the external-secrets IRSA role
# Depends on External Secrets Operator being fully deployed
# DISABLED FOR NOW: Will be created in Layer 03-karpenter after CRDs are stable

#resource "kubernetes_manifest" "cluster_secret_store" {
#  depends_on = [time_sleep.wait_for_crds]
#
#  manifest = {
#    apiVersion = "external-secrets.io/v1beta1"
#    kind       = "ClusterSecretStore"
#    metadata = {
#      name = "kindswap-aws-secret-store"
#    }
#    spec = {
#      provider = {
#        aws = {
#          service = "SecretsManager"
#          region  = "us-east-1"
#          auth = {
#            jwt = {
#              serviceAccountRef = {
#                name      = "external-secrets"
#                namespace = "external-secrets"
#              }
#            }
#          }
#        }
#      }
#    }
#  }
#}

# ============================================================================
# SECTION 6 — KUBERNETES NAMESPACES
# ============================================================================
# Three application namespaces: production, staging, dev
# Labels required for network policies to work correctly

resource "kubernetes_namespace" "production" {
  metadata {
    name = "production"
    labels = {
      environment                          = "production"
      "app.kubernetes.io/managed-by"       = "terraform"
    }
  }
}

resource "kubernetes_namespace" "staging" {
  metadata {
    name = "staging"
    labels = {
      environment                          = "staging"
      "app.kubernetes.io/managed-by"       = "terraform"
    }
  }
}

resource "kubernetes_namespace" "dev" {
  metadata {
    name = "dev"
    labels = {
      environment                          = "dev"
      "app.kubernetes.io/managed-by"       = "terraform"
    }
  }
}

# ============================================================================
# SECTION 7 — NETWORK POLICIES (NAMESPACE ISOLATION)
# ============================================================================
# Enforce strict ingress policies — production cannot receive traffic from staging or dev
# staging and dev cannot receive traffic from production

# Production: deny all ingress except from production namespace and kube-system
resource "kubernetes_network_policy" "production_deny_from_nonprod" {
  metadata {
    name      = "deny-from-nonprod"
    namespace = kubernetes_namespace.production.metadata[0].name
  }

  spec {
    pod_selector {}    # Applies to all pods in production namespace
    policy_types = ["Ingress"]

    # Allow ingress only from production namespace
    ingress {
      from {
        namespace_selector {
          match_labels = { environment = "production" }
        }
      }
    }

    # Allow ingress from kube-system (system controllers, ingress)
    ingress {
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "kube-system" }
        }
      }
    }
  }
}

# Staging: deny ingress from production
resource "kubernetes_network_policy" "staging_deny_from_prod" {
  metadata {
    name      = "deny-from-production"
    namespace = kubernetes_namespace.staging.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    # Allow ingress only from staging namespace
    ingress {
      from {
        namespace_selector {
          match_labels = { environment = "staging" }
        }
      }
    }

    # Allow ingress from kube-system
    ingress {
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "kube-system" }
        }
      }
    }
  }
}

# Dev: deny ingress from production and staging
resource "kubernetes_network_policy" "dev_deny_from_prod" {
  metadata {
    name      = "deny-from-production"
    namespace = kubernetes_namespace.dev.metadata[0].name
  }

  spec {
    pod_selector {}
    policy_types = ["Ingress"]

    # Allow ingress only from dev namespace
    ingress {
      from {
        namespace_selector {
          match_labels = { environment = "dev" }
        }
      }
    }

    # Allow ingress from kube-system
    ingress {
      from {
        namespace_selector {
          match_labels = { "kubernetes.io/metadata.name" = "kube-system" }
        }
      }
    }
  }
}

