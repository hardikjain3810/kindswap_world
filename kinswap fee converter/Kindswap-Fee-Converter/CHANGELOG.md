# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial project structure
- Node.js 20.x with TypeScript 5.x
- Docker and Docker Compose configuration
- Serverless Framework setup
- Jest testing framework
- ESLint and Prettier configuration
- GitHub Actions CI/CD pipeline
- Four Lambda functions: fee-indexer, conversion-planner, conversion-executor, usdc-distributor
- PostgreSQL with TimescaleDB support
- LocalStack for local AWS services emulation
- Comprehensive README and documentation

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- AWS KMS encryption for wallet keys
- Secrets Manager integration
- VPC isolation for Lambda and RDS

## [1.0.0] - 2026-03-12

### Added
- Initial release
- Production-ready Lambda fee converter
- Full AWS infrastructure support
- Docker-based local development environment
- Professional Node.js project structure
