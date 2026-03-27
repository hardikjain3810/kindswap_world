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

variable "backend_image_tag" {
  description = "Docker image tag for NestJS backend — override with commit SHA from CI/CD"
  type        = string
  default     = "latest"
}

variable "frontend_image_tag" {
  description = "Docker image tag for React frontend — override with commit SHA from CI/CD"
  type        = string
  default     = "latest"
}

variable "vpn_cidr" {
  description = "VPN client CIDR range — used to restrict access to non-prod environments (e.g., 10.x.x.0/24 from Pritunl)"
  type        = string
}
