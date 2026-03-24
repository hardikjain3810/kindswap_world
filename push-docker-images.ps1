#!/usr/bin/env powershell
# Docker build and push script for KindSwap

$ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
$REGISTRY = "$ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com"

Write-Host "`n=== Step 1: Docker Login to ECR ===" -ForegroundColor Cyan

# Get ECR login password
$password = aws ecr get-login-password --region us-east-1
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to get ECR login password" -ForegroundColor Red
    exit 1
}

# Login to Docker
Write-Host "Logging in to $REGISTRY..." -ForegroundColor Yellow
echo $password | docker login --username AWS --password-stdin $REGISTRY
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Docker login failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Successfully logged in to ECR" -ForegroundColor Green

Write-Host "`n=== Step 2: Build and Push Images ===" -ForegroundColor Cyan

$builds = @(
    @{ repo="kindswap-backend";        dir="d:\D\kindswap\backend" },
    @{ repo="kindswap-frontend";       dir="d:\D\kindswap\frontend" },
    @{ repo="kindswap-admin-backend";  dir="d:\D\kindswap\admin backend\Admin-Backend" },
    @{ repo="kindswap-admin-frontend"; dir="d:\D\kindswap\admin panel\Admin-Panel" }
)

$failed = @()

foreach ($b in $builds) {
    $tag = "$REGISTRY/$($b.repo):v0.1.0"
    Write-Host "`nBuilding $($b.repo)..." -ForegroundColor Cyan
    
    # Build image
    docker build -t $tag "$($b.dir)" 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Build failed for $($b.repo)" -ForegroundColor Red
        $failed += $b.repo
        continue
    }
    
    # Push image
    Write-Host "Pushing $tag..." -ForegroundColor Yellow
    docker push $tag
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Push failed for $($b.repo)" -ForegroundColor Red
        $failed += $b.repo
    } else {
        Write-Host "✅ $($b.repo):v0.1.0 pushed successfully" -ForegroundColor Green
    }
}

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
if ($failed.Count -eq 0) {
    Write-Host "✅ All images built and pushed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Failed images: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
