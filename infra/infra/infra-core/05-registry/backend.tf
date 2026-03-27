terraform {
  backend "s3" {
    bucket         = "kindswap-terraform-state"
    key            = "core/registry/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "kindswap-terraform-locks"
    encrypt        = true
  }
}

