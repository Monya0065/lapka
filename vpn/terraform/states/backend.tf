# Terraform Remote State Backend
terraform {
  required_version = ">= 1.0"
  
  backend "s3" {
    bucket         = "lapka-vpn-terraform-states"
    key            = "vpn/production/terraform.tfstate"
    region         = "eu-central-1"
    encrypt        = true
    dynamodb_table = "lapka-vpn-terraform-locks"
  }
}

# S3 bucket for state storage
resource "aws_s3_bucket" "terraform_states" {
  bucket = "lapka-vpn-terraform-states"
  
  tags = {
    Name        = "Lapka VPN Terraform States"
    Environment = "production"
  }
}

resource "aws_s3_bucket_versioning" "terraform_states" {
  bucket = aws_s3_bucket.terraform_states.id
  
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption" "terraform_states" {
  bucket = aws_s3_bucket.terraform_states.id
  
  server_side_encryption_rule {
    server_side_encryption_configuration {
      sse_algorithm = "AES256"
    }
  }
}

# DynamoDB for state locking
resource "aws_dynamodb_table" "terraform_locks" {
  name           = "lapka-vpn-terraform-locks"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key     = "LockID"
  
  attribute {
    name = "LockID"
    type = "S"
  }
  
  tags = {
    Name = "Lapka VPN Terraform Locks"
  }
}