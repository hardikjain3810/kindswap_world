variable "aws_region" {
  default = "us-east-1"
}

variable "project" {
  default = "kindswap"
}

variable "prod_db_initial_password" {
  description = "Initial production DB password — will be rotated by Lambda within 24 hours. Must be alphanumeric only, min 32 chars."
  type        = string
  sensitive   = true
  # Do NOT set a default — must be explicitly provided
  # Pass via: terraform apply -var="prod_db_initial_password=YOURSTRONGPASSWORD"
  # Or via: TF_VAR_prod_db_initial_password environment variable
}

variable "nonprod_db_initial_password" {
  description = "Initial nonprod DB password — will be rotated by Lambda within 24 hours. Must be alphanumeric only, min 32 chars."
  type        = string
  sensitive   = true
}

variable "enable_secrets_rotation" {
  description = "Enable automatic password rotation via Secrets Manager. Set to true only after SAR rotation Lambda is deployed."
  type        = bool
  default     = false
}


