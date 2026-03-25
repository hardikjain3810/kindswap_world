#!/bin/bash
# Local Lambda Testing Script
# Usage: ./test-lambda.sh <function-name>
# Example: ./test-lambda.sh feeIndexer

set -e

FUNCTION_NAME=$1

if [ -z "$FUNCTION_NAME" ]; then
  echo "Usage: ./test-lambda.sh <function-name>"
  echo ""
  echo "Available functions:"
  echo "  - feeIndexer"
  echo "  - conversionPlanner"
  echo "  - conversionExecutor"
  echo "  - usdcDistributor"
  exit 1
fi

echo "=================================================="
echo "Testing Lambda Function: $FUNCTION_NAME"
echo "=================================================="
echo ""

# Map function names to event files
case $FUNCTION_NAME in
  feeIndexer)
    EVENT_FILE="events/fee-indexer-event.json"
    ;;
  conversionPlanner)
    EVENT_FILE="events/conversion-planner-event.json"
    ;;
  conversionExecutor)
    EVENT_FILE="events/conversion-executor-event.json"
    ;;
  usdcDistributor)
    EVENT_FILE="events/usdc-distributor-event.json"
    ;;
  *)
    echo "Error: Unknown function '$FUNCTION_NAME'"
    exit 1
    ;;
esac

# Check if event file exists
if [ ! -f "$EVENT_FILE" ]; then
  echo "Error: Event file not found: $EVENT_FILE"
  exit 1
fi

echo "Using event file: $EVENT_FILE"
echo ""

# Invoke the function locally
serverless invoke local \
  -f "$FUNCTION_NAME" \
  --path "$EVENT_FILE" \
  --config serverless.local.yml

echo ""
echo "=================================================="
echo "Lambda test completed"
echo "=================================================="
