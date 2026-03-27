variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name"
  type        = string
  default     = "kindswap"
}

variable "grafana_admin_password" {
  description = "Grafana admin password — set via TF_VAR_grafana_admin_password"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.grafana_admin_password) >= 12
    error_message = "Grafana password must be at least 12 characters."
  }
}

