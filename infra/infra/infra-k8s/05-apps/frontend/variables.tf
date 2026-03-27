variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used for resource naming"
  type        = string
  default     = "kind_swap"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

