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

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "kindswap-cluster"
}

