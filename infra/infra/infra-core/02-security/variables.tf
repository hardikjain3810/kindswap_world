variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used for resource naming"
  type        = string
  default     = "kindswap"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "kindswap-cluster"
}

variable "github_org" {
  description = "GitHub organization name for OIDC trust"
  type        = string
  default     = "hardikjain3810"
}

