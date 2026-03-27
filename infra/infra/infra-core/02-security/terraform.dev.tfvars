# Development Terraform Variables for 02-security Module

aws_region           = "us-east-1"
project              = "kindswap"
environment          = "development"
vpc_id               = "vpc-043b017aea0ecaf2d"
vpc_cidr             = "10.0.0.0/16"
public_subnet_ids    = ["subnet-03b734e1426e6fcfa", "subnet-029bb34e2bde6a7e4"]
private_app_subnet_ids = ["subnet-024da76e845378ea4", "subnet-08df955464b06a7b4"]
private_data_subnet_ids = ["subnet-00ce83f3c182c42e8", "subnet-0b6731d2fb8e42f00"]
nat_instance_id      = "i-03ea0d88c4aa0329f"
