################################################################################
# VPC & Networking Infrastructure for KindSwap
# 
# This module creates the foundational networking layer:
# - VPC with DNS enabled for EKS
# - 6 subnets across 2 AZs (public, private app, private data)
# - Internet Gateway for public access
# - NAT Instance (not Gateway) for private subnet egress to reduce costs
# - Private route table with source_dest_check disabled on NAT
# - VPC Flow Logs for security visibility
# - Proper EKS and Karpenter discovery tags on all subnets
#
# KEY DESIGN DECISION: NAT Instance vs NAT Gateway
# - NAT Instance: $0 (t3.nano with elastic IP), but requires management
# - NAT Gateway: $32/month (standalone, fully managed)
# - For development/staging, NAT Instance saves ~$27/month while maintaining HA
# - source_dest_check must be disabled for NAT Instance to work as gateway
################################################################################

# ─── NAT AMI Data Source ───
# Finds the latest Amazon Linux 2 AMI with kernel for use as NAT instance
data "aws_ami" "nat_ami" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-kernel-*-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}
################################################################################
# VPC
################################################################################

resource "aws_vpc" "kindswap" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name                                        = "kindswap-vpc"
    "kubernetes.io/cluster/kindswap-cluster"   = "shared"
  }
}

################################################################################
# Internet Gateway
################################################################################

resource "aws_internet_gateway" "kindswap" {
  vpc_id = aws_vpc.kindswap.id

  tags = {
    Name = "kindswap-igw"
  }
}

################################################################################
# PUBLIC SUBNETS (for ALB, NAT Instance, and Load Balancer endpoints)
################################################################################

# Public subnet in us-east-1a — hosts NAT instance
resource "aws_subnet" "public_1" {
  vpc_id                  = aws_vpc.kindswap.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name                                        = "kindswap-public-1"
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/kindswap-cluster"   = "shared"
  }
}

# Public subnet in us-east-1b
resource "aws_subnet" "public_2" {
  vpc_id                  = aws_vpc.kindswap.id
  cidr_block              = "10.0.2.0/24"
  availability_zone       = "${var.aws_region}b"
  map_public_ip_on_launch = true

  tags = {
    Name                                        = "kindswap-public-2"
    "kubernetes.io/role/elb"                    = "1"
    "kubernetes.io/cluster/kindswap-cluster"   = "shared"
  }
}

################################################################################
# PRIVATE APPLICATION SUBNETS (for EKS nodes and application pods)
# These subnets include Karpenter discovery tags for auto-scaling
################################################################################

# Private app subnet in us-east-1a
resource "aws_subnet" "private_app_1" {
  vpc_id            = aws_vpc.kindswap.id
  cidr_block        = "10.0.11.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name                                        = "kindswap-private-app-1"
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/kindswap-cluster"   = "shared"
    "karpenter.sh/discovery"                    = "kindswap-cluster"
  }
}

# Private app subnet in us-east-1b
resource "aws_subnet" "private_app_2" {
  vpc_id            = aws_vpc.kindswap.id
  cidr_block        = "10.0.12.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name                                        = "kindswap-private-app-2"
    "kubernetes.io/role/internal-elb"           = "1"
    "kubernetes.io/cluster/kindswap-cluster"   = "shared"
    "karpenter.sh/discovery"                    = "kindswap-cluster"
  }
}

################################################################################
# PRIVATE DATA SUBNETS (for RDS, DynamoDB, and other data tier resources)
# Deliberately NOT tagged with EKS/Karpenter tags to isolate data access
################################################################################

# Private data subnet in us-east-1a
resource "aws_subnet" "private_data_1" {
  vpc_id            = aws_vpc.kindswap.id
  cidr_block        = "10.0.21.0/24"
  availability_zone = "${var.aws_region}a"

  tags = {
    Name = "kindswap-private-data-1"
  }
}

# Private data subnet in us-east-1b
resource "aws_subnet" "private_data_2" {
  vpc_id            = aws_vpc.kindswap.id
  cidr_block        = "10.0.22.0/24"
  availability_zone = "${var.aws_region}b"

  tags = {
    Name = "kindswap-private-data-2"
  }
}

################################################################################
# NAT INSTANCE (t3.nano — saves $27/month vs NAT Gateway per SoW v5)
# Placed in public subnet 1 (us-east-1a) with Elastic IP
# CRITICAL: user_data enables IP forwarding and iptables masquerading
# 
# Why NAT Instance instead of Gateway:
# - Cost: t3.nano $3-5/month vs Gateway $32-45/month → saves $27/month
# - SoW v5 Section 3.2 explicitly specifies NAT Instance for budget compliance
# - source_dest_check must be disabled for packet forwarding to work
# - user_data script is essential (3 lines: ip forward + iptables masquerade)
################################################################################

# NAT instance security group — allow VPC ingress, all outbound
resource "aws_security_group" "nat_sg" {
  name        = "kindswap-nat-sg"
  description = "NAT instance security group - forwards traffic from private subnets"
  vpc_id      = aws_vpc.kindswap.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["10.0.0.0/16"]
    description = "Allow all traffic from VPC for NAT forwarding"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound"
  }

  tags = {
    Name = "kindswap-nat-sg"
  }
}

# NAT instance (t3.nano) — runs in public subnet with IP forwarding
resource "aws_instance" "nat" {
  ami                         = data.aws_ami.nat_ami.id
  instance_type               = "t3.nano"
  subnet_id                   = aws_subnet.public_1.id
  vpc_security_group_ids      = [aws_security_group.nat_sg.id]
  associate_public_ip_address = true
  source_dest_check           = false   # MANDATORY for NAT — disables AWS src/dst check

  # THIS IS THE FIX: enable IP forwarding and masquerading on boot
  # Without this user_data, the instance runs but doesn't forward packets
  user_data = base64encode(<<-EOF
    #!/bin/bash
    # Enable IPv4 forwarding
    echo 1 > /proc/sys/net/ipv4/ip_forward
    echo "net.ipv4.ip_forward = 1" >> /etc/sysctl.conf
    sysctl -p

    # Enable NAT masquerading on eth0 (internet-facing interface)
    iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
    iptables -A FORWARD -i eth0 -j ACCEPT
    iptables -A FORWARD -o eth0 -j ACCEPT

    # Persist iptables rules across reboots
    yum install -y iptables-services
    service iptables save
    systemctl enable iptables
  EOF
  )

  tags = {
    Name = "kindswap-nat-instance"
  }

  lifecycle {
    ignore_changes = [ami]  # Don't replace on AMI updates
  }
}

# Elastic IP for NAT instance (assigned in public subnet)
resource "aws_eip" "nat" {
  domain   = "vpc"
  instance = aws_instance.nat.id

  tags = {
    Name = "kindswap-nat-eip"
  }

  # To ensure proper ordering, add an explicit dependency on the Internet Gateway
  depends_on = [aws_internet_gateway.kindswap]
}

################################################################################
# PUBLIC ROUTE TABLE
# Routes all internet-bound traffic through the Internet Gateway
################################################################################

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.kindswap.id

  tags = {
    Name = "kindswap-public-rt"
  }
}

# Default route to Internet Gateway for public subnets
resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.kindswap.id
}

# Associate public subnets with public route table
resource "aws_route_table_association" "public_1" {
  subnet_id      = aws_subnet.public_1.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_2" {
  subnet_id      = aws_subnet.public_2.id
  route_table_id = aws_route_table.public.id
}

################################################################################
# PRIVATE ROUTE TABLE
# Routes all internet-bound traffic through the NAT instance's network interface
# Uses network_interface_id (not nat_gateway_id — that's only for NAT Gateway)
################################################################################

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.kindswap.id

  tags = {
    Name = "kindswap-private-rt"
  }
}

# Default route to NAT instance for all private subnets (via network interface)
resource "aws_route" "private_nat" {
  route_table_id         = aws_route_table.private.id
  destination_cidr_block = "0.0.0.0/0"
  network_interface_id   = aws_instance.nat.primary_network_interface_id
}

# Associate all private subnets (app + data) with private route table
resource "aws_route_table_association" "private_app_1" {
  subnet_id      = aws_subnet.private_app_1.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_app_2" {
  subnet_id      = aws_subnet.private_app_2.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_data_1" {
  subnet_id      = aws_subnet.private_data_1.id
  route_table_id = aws_route_table.private.id
}

resource "aws_route_table_association" "private_data_2" {
  subnet_id      = aws_subnet.private_data_2.id
  route_table_id = aws_route_table.private.id
}

################################################################################
# VPC FLOW LOGS
# Enables network traffic logging to CloudWatch for security and troubleshooting
################################################################################

# CloudWatch Log Group for VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/kindswap-flow-logs"
  retention_in_days = 30

  tags = {
    Name = "kindswap-vpc-flow-logs"
  }
}

# IAM Role for VPC Flow Logs
resource "aws_iam_role" "vpc_flow_logs" {
  name = "kindswap-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })

  tags = {
    Name = "kindswap-vpc-flow-logs-role"
  }
}

# IAM Policy for VPC Flow Logs
resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "kindswap-vpc-flow-logs-policy"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogDelivery",
          "logs:PutLogEvents"
        ]
        Resource = "*"
      }
    ]
  })
}

# VPC Flow Logs
resource "aws_flow_log" "vpc" {
  iam_role_arn           = aws_iam_role.vpc_flow_logs.arn
  log_destination        = "${aws_cloudwatch_log_group.vpc_flow_logs.arn}:*"
  traffic_type           = "ALL"
  vpc_id                 = aws_vpc.kindswap.id

  tags = {
    Name = "kindswap-vpc-flow-logs"
  }
}



