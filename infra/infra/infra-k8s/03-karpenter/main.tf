# ============================================================================
# DATA SOURCES
# ============================================================================

data "aws_caller_identity" "current" {}

# ============================================================================
# REMOTE STATE — EKS, NETWORKING, AND SECURITY MODULES
# ============================================================================

data "terraform_remote_state" "eks" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/eks/terraform.tfstate"
    region = "us-east-1"
  }
}

data "terraform_remote_state" "networking" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/networking/terraform.tfstate"
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
# SECTION 1 — KARPENTER HELM RELEASE v1.0.6
# ============================================================================
# Deploys Karpenter controller via Helm OCI registry
# Controller runs on core (system) nodes with affinity preference
# IRSA role bound via serviceAccount annotation

resource "helm_release" "karpenter" {
  name             = "karpenter"
  repository       = "oci://public.ecr.aws/karpenter"
  chart            = "karpenter"
  version          = "1.0.6"
  namespace        = "karpenter"
  create_namespace = true
  atomic           = false        # Disable atomic mode to allow webhook to catch up
  timeout          = 600          # 10 minutes — Karpenter initialization takes longer
  wait             = true
  wait_for_jobs    = false

  values = [
    yamlencode({
      settings = {
        clusterName       = var.cluster_name
        clusterEndpoint   = data.terraform_remote_state.eks.outputs.cluster_endpoint
        interruptionQueue = data.terraform_remote_state.eks.outputs.karpenter_interruption_queue_name
      }

      serviceAccount = {
        create = true
        name   = "karpenter"
        annotations = {
          "eks.amazonaws.com/role-arn" = data.terraform_remote_state.eks.outputs.karpenter_controller_role_arn
        }
      }

      controller = {
        resources = {
          requests = {
            cpu    = "1"
            memory = "1Gi"
          }
          limits = {
            cpu    = "1"
            memory = "1Gi"
          }
        }
      }

      # Karpenter controller tolerates CriticalAddonsOnly taint (runs on core nodes)
      tolerations = [{
        key      = "CriticalAddonsOnly"
        operator = "Exists"
        effect   = "NoSchedule"
      }]

      # Prefer core (system) nodes for Karpenter controller itself
      affinity = {
        nodeAffinity = {
          requiredDuringSchedulingIgnoredDuringExecution = {
            nodeSelectorTerms = [{
              matchExpressions = [{
                key      = "role"
                operator = "In"
                values   = ["system"]
              }]
            }]
          }
        }
      }
    })
  ]
}

# ============================================================================
# WAIT FOR KARPENTER CRDs
# ============================================================================

resource "time_sleep" "wait_for_karpenter_crds" {
  depends_on      = [helm_release.karpenter]
  create_duration = "60s"
}

# ============================================================================
# SECTION 2 — EC2NODECLASS (v1 API — NOT v1beta1 AWSNodeTemplate)
# ============================================================================
# Defines AWS-specific node configuration for Karpenter-provisioned nodes
# Amazon Linux 2 AMI family, encrypted EBS, IMDSv2, discovered subnets/SGs
# TEMPORARILY COMMENTED — CRD not available until after time_sleep (Phase 2)

# resource "kubernetes_manifest" "ec2_node_class" {
#   depends_on = [time_sleep.wait_for_karpenter_crds]
#
#   manifest = {
#     apiVersion = "karpenter.k8s.aws/v1"    # v1 API — NOT deprecated v1beta1
#     kind       = "EC2NodeClass"
#     metadata = {
#       name = "kindswap-nodes"
#     }
#     spec = {
#       # Amazon Linux 2 — stable, EKS-optimized AMI family
#       amiFamily = "AL2"
#
#       # Discover subnets via karpenter.sh/discovery tag
#       # Tag was set on private app subnets in 01-networking
#       subnetSelectorTerms = [{
#         tags = {
#           "karpenter.sh/discovery" = var.cluster_name
#         }
#       }]
#
#       # Discover security group via karpenter.sh/discovery tag
#       # Tag was set on kindswap-eks-node-sg in 02-security
#       securityGroupSelectorTerms = [{
#         tags = {
#           "karpenter.sh/discovery" = var.cluster_name
#         }
#       }]
#
#       # Karpenter node role name (not ARN, not instance profile)
#       # This is the Karpenter-specific role from 03-eks
#       role = data.terraform_remote_state.eks.outputs.karpenter_node_role_name
#
#       # EBS root volume — encrypted with KMS, 50Gi gp3
#       blockDeviceMappings = [{
#         deviceName = "/dev/xvda"
#         ebs = {
#           volumeSize          = "50Gi"
#           volumeType          = "gp3"
#           encrypted           = true
#           deleteOnTermination = true
#         }
#       }]
#
#       # IMDSv2 required — no IMDSv1 fallback
#       # hopLimit 2 allows containers to access IMDS
#       metadataOptions = {
#         httpEndpoint            = "enabled"
#         httpProtocolIPv6        = "disabled"
#         httpPutResponseHopLimit = 2
#         httpTokens              = "required"    # IMDSv2 only
#       }
#
#       tags = {
#         Project     = var.project
#         ManagedBy   = "karpenter"
#         Environment = "all"
#       }
#     }
#   }
# }

# ============================================================================
# SECTION 3 — NODEPOOL (v1 API — NOT v1beta1 Provisioner)
# ============================================================================
# Karpenter NodePool configuration with cost optimization
# Spot + On-Demand instances, 5% disruption budget, 30s consolidation
# TEMPORARILY COMMENTED — EC2NodeClass dependency not available until Phase 2

# resource "kubernetes_manifest" "node_pool" {
#   manifest = {
#     apiVersion = "karpenter.sh/v1"    # v1 API — NOT deprecated v1beta1 Provisioner
#     kind       = "NodePool"
#     metadata = {
#       name = "kindswap-general-pool"
#     }
#     spec = {
#       template = {
#         metadata = {
#           labels = {
#             "node-type"  = "app"
#             "managed-by" = "karpenter"
#           }
#         }
#         spec = {
#           # Reference the EC2NodeClass by name
#           nodeClassRef = {
#             group = "karpenter.k8s.aws"
#             kind  = "EC2NodeClass"
#             name  = "kindswap-nodes"
#           }
#
#           # Instance requirements — cost-optimized mix of instance types
#           # Prefer Spot over On-Demand, fallback to On-Demand if Spot unavailable
#           requirements = [
#             {
#               key      = "karpenter.sh/capacity-type"
#               operator = "In"
#               values   = ["spot", "on-demand"]
#             },
#             {
#               key      = "kubernetes.io/arch"
#               operator = "In"
#               values   = ["amd64"]
#             },
#             {
#               key      = "kubernetes.io/os"
#               operator = "In"
#               values   = ["linux"]
#             },
#             {
#               key      = "node.kubernetes.io/instance-type"
#               operator = "In"
#               values = [
#                 "t3.medium", "t3.large",
#                 "t3a.medium", "t3a.large",
#                 "m5.large", "m5.xlarge",
#                 "m6i.large", "m6i.xlarge"
#               ]
#             }
#           ]
#
#           # Graceful termination period — allow 30s for pod draining on shutdown
#           terminationGracePeriod = "30s"
#         }
#       }
#
#       # Disruption policy — consolidation and budget controls
#       disruption = {
#         # WhenEmptyOrUnderutilized removes nodes when empty or <50% utilized
#         consolidationPolicy = "WhenEmptyOrUnderutilized"
#         # Remove idle nodes within 30 seconds (cost optimization)
#         consolidateAfter = "30s"
#         # Disruption budget — max 5% of nodes disrupted simultaneously
#         budgets = [{
#           nodes = "5%"
#         }]
#       }
#
#       # Resource limits — cap total cluster resources managed by this NodePool
#       limits = {
#         cpu    = "1000"
#         memory = "1000Gi"
#       }
#
#       # Weight for scheduling — higher weight = higher priority
#       # Only matters if multiple NodePools exist
#       weight = 100
#     }
#   }
#
#   depends_on = [kubernetes_manifest.ec2_node_class]
# }

# ============================================================================
# SECTION 4 — EKS ACCESS ENTRY FOR KARPENTER NODES
# ============================================================================
# Required for Karpenter-provisioned nodes to join the EKS cluster
# Works with EKS Access Entries API (not aws-auth ConfigMap)
# Type EC2_LINUX allows Linux nodes to authenticate via their IAM role

resource "aws_eks_access_entry" "karpenter_nodes" {
  cluster_name  = var.cluster_name
  principal_arn = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:role/${data.terraform_remote_state.eks.outputs.karpenter_node_role_name}"
  type          = "EC2_LINUX"

  tags = {
    Name = "kindswap-karpenter-node-access"
  }
}

