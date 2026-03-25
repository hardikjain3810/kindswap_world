/**
 * Jest setup file
 * Runs before all tests
 */

import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error'; // Reduce noise in test output

// Mock AWS SDK clients for unit tests
jest.mock('@aws-sdk/client-sqs');
jest.mock('@aws-sdk/client-kms');
jest.mock('@aws-sdk/client-secrets-manager');

// Global test timeout
jest.setTimeout(30000);

// Suppress console logs in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
