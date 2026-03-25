# ============================================================================
# REMOTE STATE — EKS, DATA, AND SECURITY MODULES
# ============================================================================

data "terraform_remote_state" "eks" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/eks/terraform.tfstate"
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

data "terraform_remote_state" "security" {
  backend = "s3"
  config = {
    bucket = "kindswap-terraform-state"
    key    = "core/security/terraform.tfstate"
    region = "us-east-1"
  }
}

# ============================================================================
# SECTION 1 — KUBE-PROMETHEUS-STACK (Prometheus + Grafana)
# ============================================================================
# Deploys complete monitoring stack with Prometheus and Grafana
# AlertManager disabled — using CloudWatch + SNS for alerting instead
# Grafana accessible via kubectl port-forward (ClusterIP service)

resource "helm_release" "kube_prometheus_stack" {
  name             = "kube-prometheus-stack"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-prometheus-stack"
  version          = "65.1.1"
  namespace        = "monitoring"
  create_namespace = true
  atomic           = false
  timeout          = 1200

  values = [
    yamlencode({
      # Grafana configuration
      grafana = {
        enabled = true

        # ClusterIP service — access via kubectl port-forward only
        # No Ingress exposure — for production, add ALB Ingress with VPN CIDR restriction
        service = {
          type = "ClusterIP"
        }

        # Persistent storage for dashboards and data
        persistence = {
          enabled           = true
          storageClassName  = "gp3"
          size              = "10Gi"
        }

        # Admin credentials — override via TF_VAR_grafana_admin_password
        adminPassword = var.grafana_admin_password

        # Auto-load dashboards and datasources from ConfigMaps
        sidecar = {
          dashboards = { enabled = true }
          datasources = { enabled = true }
        }
      }

      # Prometheus configuration
      prometheus = {
        prometheusSpec = {
          # Retention — balance storage with operational needs
          retention         = "15d"
          retentionSize     = "10GB"

          # Persistent storage for metrics
          storageSpec = {
            volumeClaimTemplate = {
              spec = {
                storageClassName = "gp3"
                accessModes      = ["ReadWriteOnce"]
                resources = {
                  requests = { storage = "20Gi" }
                }
              }
            }
          }

          # Monitor all namespaces for prometheus service discovery
          podMonitorNamespaceSelector      = {}
          serviceMonitorNamespaceSelector  = {}
          ruleNamespaceSelector            = {}
        }
      }

      # AlertManager disabled — using CloudWatch + SNS for alerting
      alertmanager = {
        enabled = false
      }

      # Prometheus Operator
      prometheusOperator = {
        admissionWebhooks = {
          enabled = false
          patch = {
            enabled = false
          }
          certManager = {
            enabled = false
          }
        }
        tls = {
          internalPort = 8080
        }
      }

      # Kube State Metrics
      kubeStateMetrics = {}

      # Node Exporter
      nodeExporter = {}

      # Run monitoring stack on core (system) nodes
      tolerations = [{
        key      = "CriticalAddonsOnly"
        operator = "Exists"
        effect   = "NoSchedule"
      }]
    })
  ]
}

# ============================================================================
# SECTION 2 — SNS TOPIC FOR CLOUDWATCH ALERTS
# ============================================================================
# Central topic for all CloudWatch alarms
# Encrypted with KMS for HIPAA/compliance requirements
# Subscribers (Slack, email, PagerDuty) added via AWS Console or separate Terraform

resource "aws_sns_topic" "alerts" {
  name              = "kindswap-alerts"
  kms_master_key_id = data.terraform_remote_state.security.outputs.kms_key_id
  tags = { Name = "kindswap-alerts" }
}

# ============================================================================
# SECTION 3 — CLOUDWATCH ALARMS
# ============================================================================
# Complete monitoring coverage for EKS, RDS, ALB, Secrets Manager, and KMS

# ============================================================================
# EKS Node Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "eks_node_cpu" {
  alarm_name          = "kindswap-eks-node-cpu-high"
  alarm_description   = "EKS node CPU exceeded 85% — consider scaling"
  namespace           = "ContainerInsights"
  metric_name         = "node_cpu_utilization"
  dimensions          = { ClusterName = "kindswap-cluster" }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-eks-node-cpu" }
}

resource "aws_cloudwatch_metric_alarm" "eks_node_memory" {
  alarm_name          = "kindswap-eks-node-memory-high"
  alarm_description   = "EKS node memory exceeded 85%"
  namespace           = "ContainerInsights"
  metric_name         = "node_memory_utilization"
  dimensions          = { ClusterName = "kindswap-cluster" }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 85
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-eks-node-memory" }
}

# ============================================================================
# RDS Production Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "rds_prod_cpu" {
  alarm_name          = "kindswap-rds-prod-cpu-high"
  alarm_description   = "Production RDS CPU exceeded 80%"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = "kindswap-prod" }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-rds-prod-cpu" }
}

resource "aws_cloudwatch_metric_alarm" "rds_prod_connections" {
  alarm_name          = "kindswap-rds-prod-connections-routed"
  alarm_description   = "Production RDS connections exceeded 180 (80% of ~227 max on db.t3.medium) — routed to SNS"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  dimensions          = { DBInstanceIdentifier = "kindswap-prod" }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 180
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-rds-prod-connections-routed" }
}

resource "aws_cloudwatch_metric_alarm" "rds_prod_storage" {
  alarm_name          = "kindswap-rds-prod-storage-routed"
  alarm_description   = "Production RDS free storage below 1GB — immediate action required — routed to SNS"
  namespace           = "AWS/RDS"
  metric_name         = "FreeStorageSpace"
  dimensions          = { DBInstanceIdentifier = "kindswap-prod" }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1073741824    # 1GB in bytes
  comparison_operator = "LessThanThreshold"
  treat_missing_data  = "breaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-rds-prod-storage-routed" }
}

# ============================================================================
# RDS Nonproduction Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "rds_nonprod_connections" {
  alarm_name          = "kindswap-rds-nonprod-connections-routed"
  alarm_description   = "Nonprod RDS connections exceeded 90 — approaching 113 HARD LIMIT on db.t3.micro — routed to SNS"
  namespace           = "AWS/RDS"
  metric_name         = "DatabaseConnections"
  dimensions          = { DBInstanceIdentifier = "kindswap-nonprod" }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 90
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-rds-nonprod-connections-routed" }
}

resource "aws_cloudwatch_metric_alarm" "rds_nonprod_cpu" {
  alarm_name          = "kindswap-rds-nonprod-cpu-high"
  alarm_description   = "Nonprod RDS CPU exceeded 80%"
  namespace           = "AWS/RDS"
  metric_name         = "CPUUtilization"
  dimensions          = { DBInstanceIdentifier = "kindswap-nonprod" }
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 80
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-rds-nonprod-cpu" }
}

# ============================================================================
# ALB Alarms
# ============================================================================
# NOTE: ALB is created dynamically by ALB Controller when Ingress resources are deployed
# These alarms have no dimensions because ALB doesn't exist yet during module deployment
# After ALB is created, dimensions should be added manually or via a separate module
# Dimension format: { LoadBalancer = "app/kindswap-ingress/abc123" }

resource "aws_cloudwatch_metric_alarm" "alb_5xx_errors" {
  alarm_name          = "kindswap-alb-5xx-high"
  alarm_description   = "ALB 5xx error rate exceeded 1% — application errors"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "HTTPCode_ELB_5XX_Count"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 2
  threshold           = 10
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-alb-5xx" }
}

resource "aws_cloudwatch_metric_alarm" "alb_latency_p99" {
  alarm_name          = "kindswap-alb-latency-high"
  alarm_description   = "ALB P99 latency exceeded 2 seconds"
  namespace           = "AWS/ApplicationELB"
  metric_name         = "TargetResponseTime"
  extended_statistic  = "p99"
  period              = 300
  evaluation_periods  = 2
  threshold           = 2
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-alb-latency" }
}

# ============================================================================
# Secrets Manager + KMS Alarms
# ============================================================================

resource "aws_cloudwatch_metric_alarm" "secrets_rotation_failure" {
  alarm_name          = "kindswap-secrets-rotation-failure-routed"
  alarm_description   = "Secrets Manager rotation failed — pods using AWSPREVIOUS as fallback — routed to SNS"
  namespace           = "AWS/SecretsManager"
  metric_name         = "RotationThisAttemptFailed"
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-secrets-rotation-failure-routed" }
}

resource "aws_cloudwatch_metric_alarm" "kms_decrypt_errors" {
  alarm_name          = "kindswap-kms-decrypt-errors"
  alarm_description   = "KMS Decrypt failures detected — potential access issue or key misconfiguration"
  namespace           = "AWS/KMS"
  metric_name         = "SystemEventCount"
  dimensions          = { KeyId = data.terraform_remote_state.security.outputs.kms_key_id }
  statistic           = "Sum"
  period              = 300
  evaluation_periods  = 1
  threshold           = 1
  comparison_operator = "GreaterThanOrEqualToThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-kms-errors" }
}

# ============================================================================
# Rate Limiting Alarm (Custom Metric)
# ============================================================================
# Custom metric published by NestJS backend throttler
# NestJS must publish via:
#   aws cloudwatch put-metric-data \
#     --namespace KindSwap/RateLimiting \
#     --metric-name ThrottledRequestsPercent \
#     --value <percent> \
#     --timestamp <ISO8601>

resource "aws_cloudwatch_metric_alarm" "rate_limiting_high" {
  alarm_name          = "kindswap-rate-limiting-high"
  alarm_description   = "NestJS throttler 429 rate exceeded 5% of total — potential attack pattern"
  namespace           = "KindSwap/RateLimiting"
  metric_name         = "ThrottledRequestsPercent"
  statistic           = "Average"
  period              = 300
  evaluation_periods  = 2
  threshold           = 5
  comparison_operator = "GreaterThanThreshold"
  treat_missing_data  = "notBreaching"
  alarm_actions       = [aws_sns_topic.alerts.arn]
  ok_actions          = [aws_sns_topic.alerts.arn]
  tags = { Name = "kindswap-rate-limiting" }
}

# ============================================================================
# SECTION 4 — CLOUDWATCH LOG GROUPS
# ============================================================================
# Application logs with environment-specific retention
# All encrypted with KMS for compliance

resource "aws_cloudwatch_log_group" "app_production" {
  name              = "/kindswap/production"
  retention_in_days = 90
  kms_key_id        = data.terraform_remote_state.security.outputs.kms_key_arn
  tags = { 
    Name        = "kindswap-production-logs"
    Environment = "production"
  }
}

resource "aws_cloudwatch_log_group" "app_staging" {
  name              = "/kindswap/staging"
  retention_in_days = 30
  kms_key_id        = data.terraform_remote_state.security.outputs.kms_key_arn
  tags = { 
    Name        = "kindswap-staging-logs"
    Environment = "staging"
  }
}

resource "aws_cloudwatch_log_group" "app_dev" {
  name              = "/kindswap/dev"
  retention_in_days = 7
  kms_key_id        = data.terraform_remote_state.security.outputs.kms_key_arn
  tags = { 
    Name        = "kindswap-dev-logs"
    Environment = "dev"
  }
}

