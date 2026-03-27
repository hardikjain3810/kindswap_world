output "cloudfront_distribution_id" {
  description = "ID of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.id
}

output "cloudfront_distribution_domain" {
  description = "Domain name of the CloudFront distribution — use as CNAME value for kindswap.world in Cloudflare"
  value       = aws_cloudfront_distribution.frontend.domain_name
}

output "cloudfront_distribution_arn" {
  description = "ARN of the CloudFront distribution"
  value       = aws_cloudfront_distribution.frontend.arn
}

output "frontend_bucket_name" {
  description = "Name of the S3 bucket hosting the frontend"
  value       = aws_s3_bucket.frontend.bucket
}

output "frontend_bucket_arn" {
  description = "ARN of the S3 bucket hosting the frontend"
  value       = aws_s3_bucket.frontend.arn
}

output "cloudflare_cname_instructions" {
  description = "Instructions for adding the CloudFront CNAME in Cloudflare"
  value       = <<-EOT
    ============================================================
    CLOUDFLARE DNS — ACTION REQUIRED
    ============================================================
    Add the following CNAME record in Cloudflare for kindswap.world:

      Type:  CNAME
      Name:  kindswap.world  (or @)
      Value: ${aws_cloudfront_distribution.frontend.domain_name}
      Proxy: DNS only (grey cloud — do NOT proxy through Cloudflare)

    This routes traffic to your CloudFront distribution.
    ============================================================
  EOT
}

