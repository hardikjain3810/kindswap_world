#!/bin/bash

# LocalStack initialization script
# This script runs when LocalStack is ready

echo "Initializing LocalStack services..."

# Wait for LocalStack to be fully ready
sleep 5

# Create SQS queues
echo "Creating SQS queues..."
awslocal sqs create-queue --queue-name conversion-jobs
awslocal sqs create-queue --queue-name conversion-jobs-dlq

# Create KMS key
echo "Creating KMS key..."
awslocal kms create-key --description "Ops wallet encryption key"

# Create Secrets Manager secrets
echo "Creating Secrets Manager secrets..."
awslocal secretsmanager create-secret \
  --name /fee-conversion/dev/db-password \
  --secret-string "postgres_local_password"

awslocal secretsmanager create-secret \
  --name /fee-conversion/dev/helius-api-key \
  --secret-string "test_helius_api_key"

awslocal secretsmanager create-secret \
  --name /fee-conversion/dev/ops-wallet-key \
  --secret-string "test_wallet_private_key"

echo "LocalStack initialization complete!"
