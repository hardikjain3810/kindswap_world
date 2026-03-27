# ============================================================================
# KUBE-PROMETHEUS-STACK
# ============================================================================

output "prometheus_helm_status" {
  description = "Prometheus Helm release status"
  value       = helm_release.kube_prometheus_stack.status
}

output "prometheus_helm_version" {
  description = "Prometheus Helm release version"
  value       = helm_release.kube_prometheus_stack.version
}

output "grafana_helm_status" {
  description = "Grafana Helm release status"
  value       = helm_release.kube_prometheus_stack.status
}

output "grafana_helm_version" {
  description = "Grafana Helm release version"
  value       = helm_release.kube_prometheus_stack.version
}

# ============================================================================
# MONITORING NAMESPACE
# ============================================================================

output "monitoring_namespace" {
  description = "Kubernetes namespace for monitoring stack"
  value       = helm_release.kube_prometheus_stack.namespace
}

# ============================================================================
# SNS TOPIC
# ============================================================================

output "sns_topic_arn" {
  description = "ARN of SNS topic for CloudWatch alarms"
  value       = aws_sns_topic.alerts.arn
}

output "sns_topic_name" {
  description = "Name of SNS topic for CloudWatch alarms"
  value       = aws_sns_topic.alerts.name
}

# ============================================================================
# CLOUDWATCH ALARMS
# ============================================================================

output "cloudwatch_alarms" {
  description = "List of all CloudWatch alarm names"
  value = [
    aws_cloudwatch_metric_alarm.eks_node_cpu.alarm_name,
    aws_cloudwatch_metric_alarm.eks_node_memory.alarm_name,
    aws_cloudwatch_metric_alarm.rds_prod_cpu.alarm_name,
    aws_cloudwatch_metric_alarm.rds_prod_connections.alarm_name,
    aws_cloudwatch_metric_alarm.rds_prod_storage.alarm_name,
    aws_cloudwatch_metric_alarm.rds_nonprod_connections.alarm_name,
    aws_cloudwatch_metric_alarm.rds_nonprod_cpu.alarm_name,
    aws_cloudwatch_metric_alarm.alb_5xx_errors.alarm_name,
    aws_cloudwatch_metric_alarm.alb_latency_p99.alarm_name,
    aws_cloudwatch_metric_alarm.secrets_rotation_failure.alarm_name,
    aws_cloudwatch_metric_alarm.kms_decrypt_errors.alarm_name,
    aws_cloudwatch_metric_alarm.rate_limiting_high.alarm_name,
  ]
}

# ============================================================================
# CLOUDWATCH LOG GROUPS
# ============================================================================

output "app_production_log_group" {
  description = "CloudWatch log group for production application logs"
  value       = aws_cloudwatch_log_group.app_production.name
}

output "app_production_log_group_arn" {
  description = "ARN of production application log group"
  value       = aws_cloudwatch_log_group.app_production.arn
}

output "app_staging_log_group" {
  description = "CloudWatch log group for staging application logs"
  value       = aws_cloudwatch_log_group.app_staging.name
}

output "app_staging_log_group_arn" {
  description = "ARN of staging application log group"
  value       = aws_cloudwatch_log_group.app_staging.arn
}

output "app_dev_log_group" {
  description = "CloudWatch log group for dev application logs"
  value       = aws_cloudwatch_log_group.app_dev.name
}

output "app_dev_log_group_arn" {
  description = "ARN of dev application log group"
  value       = aws_cloudwatch_log_group.app_dev.arn
}
