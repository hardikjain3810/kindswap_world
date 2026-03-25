variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name for tagging"
  type        = string
  default     = "kindswap"
}

variable "cluster_name" {
  description = "EKS cluster name"
  type        = string
  default     = "kindswap-cluster"
}

variable "cluster_version" {
  description = "Kubernetes version to use for the EKS cluster"
  type        = string
  default     = "1.31"
}

variable "core_node_instance_type" {
  description = "Instance type for core node group (ON_DEMAND only)"
  type        = string
  default     = "t3.medium"
}

variable "core_node_desired_size" {
  description = "Desired number of nodes in core node group"
  type        = number
  default     = 2
}

variable "core_node_min_size" {
  description = "Minimum number of nodes in core node group"
  type        = number
  default     = 1
}

variable "core_node_max_size" {
  description = "Maximum number of nodes in core node group"
  type        = number
  default     = 4
}

