variable "aws_region" {
  description = "AWS region for Terraform state backend"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name for resource tagging"
  type        = string
  default     = "kindswap"
}
