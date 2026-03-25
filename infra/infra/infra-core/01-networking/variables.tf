variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "project" {
  description = "Project name used for resource naming and tagging"
  type        = string
  default     = "kindswap"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "nat_instance_type" {
  description = "EC2 instance type for NAT instance (t3.nano recommended for cost)"
  type        = string
  default     = "t3.nano"
}

variable "use_production_nat_sg" {
  description = "Whether to use production NAT SG from 02-security module (false = use temp SG)"
  type        = bool
  default     = false
  # After T3 (02-security) applies successfully, set this to true and re-apply this module:
  # terraform apply -var="use_production_nat_sg=true" -target=aws_instance.nat
}

variable "production_nat_sg_id" {
  description = "Production NAT security group ID from 02-security module (required if use_production_nat_sg=true)"
  type        = string
  default     = ""
  # After T3 apply, get this from: terraform output -raw production_nat_sg_id
  # Or: aws ec2 describe-security-groups --filters Name=group-name,Values=kindswap-nat-sg --query 'SecurityGroups[0].GroupId'
}

# NOTE ON nat_sg_id DEPENDENCY:
# The NAT security group will be created in the 02-security module AFTER this module runs.
# For the first apply, this module creates a temporary inline NAT security group with
# minimal rules (allow VPC CIDR inbound, all outbound). This is sufficient for basic NAT.
# 
# After 02-security module completes, the proper kindswap-nat-sg will be created with
# production-ready rules. To use the final SG, either:
# 1. Re-run this module with: terraform apply -var="use_production_nat_sg=true" -target=aws_instance.nat
# 2. Or manually update the instance's security groups in the AWS console
#
# This two-phase approach avoids circular dependencies between modules while maintaining
# security group best practices. Document this in your deployment runbook.


