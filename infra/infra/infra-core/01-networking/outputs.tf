################################################################################
# VPC Outputs
################################################################################

output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.kindswap.id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.kindswap.cidr_block
}

output "igw_id" {
  description = "The ID of the Internet Gateway"
  value       = aws_internet_gateway.kindswap.id
}

################################################################################
# Public Subnet Outputs
################################################################################

output "public_subnet_ids" {
  description = "List of all public subnet IDs"
  value       = [aws_subnet.public_1.id, aws_subnet.public_2.id]
}

output "public_subnet_1_id" {
  description = "Public subnet 1 ID (us-east-1a)"
  value       = aws_subnet.public_1.id
}

output "public_subnet_2_id" {
  description = "Public subnet 2 ID (us-east-1b)"
  value       = aws_subnet.public_2.id
}

################################################################################
# Private Application Subnet Outputs (for EKS nodes and pods)
################################################################################

output "private_app_subnet_ids" {
  description = "List of private application subnet IDs (for EKS nodes)"
  value       = [aws_subnet.private_app_1.id, aws_subnet.private_app_2.id]
}

output "private_app_subnet_1_id" {
  description = "Private app subnet 1 ID (us-east-1a)"
  value       = aws_subnet.private_app_1.id
}

output "private_app_subnet_2_id" {
  description = "Private app subnet 2 ID (us-east-1b)"
  value       = aws_subnet.private_app_2.id
}

################################################################################
# Private Data Subnet Outputs (for RDS, DynamoDB, etc.)
################################################################################

output "private_data_subnet_ids" {
  description = "List of private data subnet IDs (isolated from EKS for database security)"
  value       = [aws_subnet.private_data_1.id, aws_subnet.private_data_2.id]
}

output "private_data_subnet_1_id" {
  description = "Private data subnet 1 ID (us-east-1a)"
  value       = aws_subnet.private_data_1.id
}

output "private_data_subnet_2_id" {
  description = "Private data subnet 2 ID (us-east-1b)"
  value       = aws_subnet.private_data_2.id
}

################################################################################
# All Private Subnet Outputs (combined for route table associations)
################################################################################

output "all_private_subnet_ids" {
  description = "List of ALL private subnets (app + data) - used for private route table"
  value       = [aws_subnet.private_app_1.id, aws_subnet.private_app_2.id, aws_subnet.private_data_1.id, aws_subnet.private_data_2.id]
}

################################################################################
# NAT Instance Outputs
################################################################################

output "nat_instance_id" {
  description = "EC2 instance ID of the NAT instance"
  value       = aws_instance.nat.id
}

output "nat_instance_primary_eni_id" {
  description = "Primary network interface ID of the NAT instance (used in private route table)"
  value       = aws_instance.nat.primary_network_interface_id
}

output "nat_eip_id" {
  description = "Allocation ID of the Elastic IP associated with the NAT instance"
  value       = aws_eip.nat.id
}

output "nat_eip_public_ip" {
  description = "The public IP address of the NAT instance (for Cloudflare/WAF allowlisting)"
  value       = aws_eip.nat.public_ip
}

################################################################################
# Route Table Outputs
################################################################################

output "public_rt_id" {
  description = "ID of the public route table (routes traffic to IGW)"
  value       = aws_route_table.public.id
}

output "private_rt_id" {
  description = "ID of the private route table (routes traffic to NAT instance)"
  value       = aws_route_table.private.id
}

################################################################################
# VPC Flow Logs Outputs
################################################################################

output "flow_logs_log_group_name" {
  description = "CloudWatch log group name for VPC Flow Logs"
  value       = aws_cloudwatch_log_group.vpc_flow_logs.name
}

