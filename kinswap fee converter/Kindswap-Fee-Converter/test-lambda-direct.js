#!/usr/bin/env node
/**
 * Direct Lambda Function Tester
 * This script directly imports and runs Lambda handlers without Serverless Framework
 *
 * Usage: node test-lambda-direct.js <function-name>
 * Example: node test-lambda-direct.js feeIndexer
 */

const path = require('path');
const fs = require('fs');

// Parse command line arguments
const functionName = process.argv[2];

if (!functionName) {
  console.error('Usage: node test-lambda-direct.js <function-name>');
  console.error('');
  console.error('Available functions:');
  console.error('  - feeIndexer');
  console.error('  - conversionPlanner');
  console.error('  - conversionExecutor');
  console.error('  - usdcDistributor');
  process.exit(1);
}

// Function name mapping to paths
const functionMap = {
  feeIndexer: {
    handler: './dist/functions/fee-indexer/index.js',
    event: './events/fee-indexer-event.json',
    name: 'Fee Indexer'
  },
  conversionPlanner: {
    handler: './dist/functions/conversion-planner/index.js',
    event: './events/conversion-planner-event.json',
    name: 'Conversion Planner'
  },
  conversionExecutor: {
    handler: './dist/functions/conversion-executor/index.js',
    event: './events/conversion-executor-event.json',
    name: 'Conversion Executor'
  },
  usdcDistributor: {
    handler: './dist/functions/usdc-distributor/index.js',
    event: './events/usdc-distributor-event.json',
    name: 'USDC Distributor'
  }
};

const config = functionMap[functionName];

if (!config) {
  console.error(`Error: Unknown function '${functionName}'`);
  process.exit(1);
}

// Load environment variables from .env.development
require('dotenv').config({ path: '.env.development' });

// Mock AWS Lambda context
const context = {
  callbackWaitsForEmptyEventLoop: true,
  functionName: functionName,
  functionVersion: '$LATEST',
  invokedFunctionArn: `arn:aws:lambda:local:000000000000:function:${functionName}`,
  memoryLimitInMB: '512',
  awsRequestId: `local-${Date.now()}-${Math.random().toString(36).substring(7)}`,
  logGroupName: `/aws/lambda/${functionName}`,
  logStreamName: `2026/03/12/[$LATEST]local`,
  getRemainingTimeInMillis: () => 30000,
  done: () => {},
  fail: () => {},
  succeed: () => {}
};

// Run the test
async function runTest() {
  console.log('==================================================');
  console.log(`Testing Lambda Function: ${config.name}`);
  console.log('==================================================');
  console.log('');

  try {
    // Check if handler file exists
    const handlerPath = path.resolve(__dirname, config.handler);
    if (!fs.existsSync(handlerPath)) {
      console.error(`Error: Handler file not found: ${handlerPath}`);
      console.error('');
      console.error('Run "npm run build" first to compile TypeScript');
      process.exit(1);
    }

    // Check if event file exists
    const eventPath = path.resolve(__dirname, config.event);
    if (!fs.existsSync(eventPath)) {
      console.error(`Error: Event file not found: ${eventPath}`);
      process.exit(1);
    }

    // Load the handler
    console.log(`Loading handler from: ${config.handler}`);
    const { handler } = require(handlerPath);

    if (typeof handler !== 'function') {
      console.error('Error: Handler export is not a function');
      process.exit(1);
    }

    // Load the event
    console.log(`Loading event from: ${config.event}`);
    const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));

    console.log('');
    console.log('Event data:');
    console.log(JSON.stringify(event, null, 2));
    console.log('');
    console.log('Executing handler...');
    console.log('');

    // Execute the handler
    const startTime = Date.now();
    const result = await handler(event, context);
    const duration = Date.now() - startTime;

    console.log('');
    console.log('==================================================');
    console.log('✓ Lambda execution completed successfully');
    console.log('==================================================');
    console.log(`Duration: ${duration}ms`);
    console.log('');
    console.log('Result:');
    console.log(JSON.stringify(result, null, 2));

  } catch (error) {
    console.log('');
    console.log('==================================================');
    console.log('✗ Lambda execution failed');
    console.log('==================================================');
    console.error('Error:', error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
    process.exit(1);
  }
}

runTest();
