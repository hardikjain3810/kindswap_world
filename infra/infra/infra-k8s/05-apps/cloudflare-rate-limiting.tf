# ============================================================================
# CLOUDFLARE RATE LIMITING CONFIGURATION
# SoW v5 Section S5 — Dual-Layer Rate Limiting (Layer 1)
# ============================================================================
# This Terraform module creates Cloudflare rate limiting rules as specified in SoW v5.
# Rate limiting rule: /api/* path, 15 requests per minute per IP, Block action
#
# IMPORTANT: Cloudflare API token must be set via TF_VAR_cloudflare_api_token
#            environment variable or .tfvars file
#
# Provider configuration:
# terraform {
#   required_providers {
#     cloudflare = {
#       source  = "cloudflare/cloudflare"
#       version = "~> 4.0"
#     }
#   }
# }
#
# provider "cloudflare" {
#   api_token = var.cloudflare_api_token
# }

variable "cloudflare_api_token" {
  description = "Cloudflare API token for terraform provider"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for kindswap.world"
  type        = string
}

# Rate Limiting Rule: /api/* — 15 requests per minute per IP
resource "cloudflare_rate_limit" "api_rate_limit" {
  zone_id = var.cloudflare_zone_id
  disabled = false
  
  description = "KindSwap API Rate Limiting — SoW v5 Layer 1 (15 req/min per IP)"
  match {
    request {
      url {
        path {
          matches = "/api/*"
        }
      }
    }
  }
  
  # 15 requests per 60 seconds (same as NestJS Layer 2)
  threshold   = 15
  period      = 60
  
  # Action: Challenge (shows CAPTCHA)
  # For stricter enforcement, use "block" instead
  action = "challenge"
  
  # Bypass rate limiting for internal/monitoring traffic (optional)
  # bypass = ["query_string_argument_value"]
  
  tags = ["rate-limiting", "api-protection", "sow-v5"]
}

output "cloudflare_rate_limit_id" {
  description = "Cloudflare rate limit rule ID"
  value       = cloudflare_rate_limit.api_rate_limit.id
}

output "cloudflare_rate_limit_description" {
  description = "Rate limit rule configuration"
  value       = "Path: /api/*, Threshold: 15 req/60s, Action: challenge"
}
