locals {
  common_tags = {
    Project     = "kind_swap"
    Environment = "production"
    ManagedBy   = "terraform"
  }
}

# ─── Remote State References ──────────────────────────────────────────────────
data "terraform_remote_state" "controllers" {
  backend = "s3"
  config = {
    bucket = "kind-swap-terraform-state"
    key    = "k8s/controllers/terraform.tfstate"
    region = "us-east-1"
  }
}

data "aws_caller_identity" "current" {}

# ─── S3 Bucket: Frontend Static Site ─────────────────────────────────────────
resource "aws_s3_bucket" "frontend" {
  bucket = "kind-swap-frontend-${data.aws_caller_identity.current.account_id}"

  lifecycle {
    prevent_destroy = false
  }

  tags = merge(local.common_tags, {
    Name = "kind_swap_frontend_bucket"
  })
}

resource "aws_s3_bucket_versioning" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  versioning_configuration {
    status = "Enabled"
  }
}

# NOTE: Using AES256 instead of KMS because CloudFront OAC cannot decrypt
# KMS-encrypted objects without additional KMS key policy configuration.
resource "aws_s3_bucket_server_side_encryption_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket                  = aws_s3_bucket.frontend.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

# ─── CloudFront Origin Access Control ────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "kind_swap_frontend_oac"
  description                       = "OAC for kind_swap frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ─── CloudFront Distribution ──────────────────────────────────────────────────
# NOTE: CloudFront is a global service — no provider alias needed.
# Only the ACM certificate must be in us-east-1 (handled in 02-controllers).
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "kind_swap frontend distribution"
  default_root_object = "index.html"
  price_class         = "PriceClass_All"
  aliases             = ["kindswap.world"]
  http_version        = "http2and3"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = "kind_swap_frontend_s3"
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "kind_swap_frontend_s3"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    # NOTE: When using a managed cache policy, do NOT set min_ttl/default_ttl/max_ttl
    # as they conflict with the policy settings.
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_optimized.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.cors_s3.id
  }

  # SPA fallback: redirect 403/404 to index.html
  custom_error_response {
    error_code            = 403
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  custom_error_response {
    error_code            = 404
    response_code         = 200
    response_page_path    = "/index.html"
    error_caching_min_ttl = 10
  }

  viewer_certificate {
    acm_certificate_arn      = data.terraform_remote_state.controllers.outputs.acm_frontend_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = merge(local.common_tags, {
    Name = "kind_swap_cloudfront"
  })
}

# ─── CloudFront Cache Policy Data Sources ────────────────────────────────────
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_origin_request_policy" "cors_s3" {
  name = "Managed-CORS-S3Origin"
}

# ─── S3 Bucket Policy: Allow CloudFront OAC Only ─────────────────────────────
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.frontend.arn
          }
        }
      }
    ]
  })

  depends_on = [
    aws_s3_bucket_public_access_block.frontend
  ]
}

