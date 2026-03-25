# Makefile for Lambda Fee Converter
# Convenient shortcuts for common development tasks

.PHONY: help install build test lint format clean docker-up docker-down deploy-dev deploy-prod

# Default target
.DEFAULT_GOAL := help

# Variables
NODE_VERSION := 20
PROJECT_NAME := lambda-fee-converter

# Colors for output
COLOR_RESET := \033[0m
COLOR_BOLD := \033[1m
COLOR_GREEN := \033[32m
COLOR_YELLOW := \033[33m
COLOR_BLUE := \033[34m

##@ General

help: ## Display this help message
	@echo "$(COLOR_BOLD)$(PROJECT_NAME) - Available Commands$(COLOR_RESET)"
	@echo ""
	@awk 'BEGIN {FS = ":.*##"; printf "Usage:\n  make $(COLOR_BLUE)<target>$(COLOR_RESET)\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  $(COLOR_BLUE)%-20s$(COLOR_RESET) %s\n", $$1, $$2 } /^##@/ { printf "\n$(COLOR_BOLD)%s$(COLOR_RESET)\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Development

install: ## Install dependencies
	@echo "$(COLOR_GREEN)Installing dependencies...$(COLOR_RESET)"
	npm ci

dev: ## Start development server
	@echo "$(COLOR_GREEN)Starting development server...$(COLOR_RESET)"
	npm run dev

watch: ## Watch for changes and rebuild
	@echo "$(COLOR_GREEN)Watching for changes...$(COLOR_RESET)"
	npm run dev

##@ Building

build: ## Build the project
	@echo "$(COLOR_GREEN)Building project...$(COLOR_RESET)"
	npm run build

build-prod: ## Build for production
	@echo "$(COLOR_GREEN)Building for production...$(COLOR_RESET)"
	npm run build:prod

clean: ## Clean build artifacts
	@echo "$(COLOR_YELLOW)Cleaning build artifacts...$(COLOR_RESET)"
	npm run clean
	rm -rf node_modules

##@ Testing

test: ## Run all tests
	@echo "$(COLOR_GREEN)Running tests...$(COLOR_RESET)"
	npm test

test-watch: ## Run tests in watch mode
	@echo "$(COLOR_GREEN)Running tests in watch mode...$(COLOR_RESET)"
	npm run test:watch

test-integration: ## Run integration tests
	@echo "$(COLOR_GREEN)Running integration tests...$(COLOR_RESET)"
	npm run test:integration

test-coverage: ## Run tests with coverage
	@echo "$(COLOR_GREEN)Running tests with coverage...$(COLOR_RESET)"
	npm test -- --coverage

##@ Code Quality

lint: ## Lint code
	@echo "$(COLOR_GREEN)Linting code...$(COLOR_RESET)"
	npm run lint

lint-fix: ## Fix linting issues
	@echo "$(COLOR_GREEN)Fixing linting issues...$(COLOR_RESET)"
	npm run lint:fix

format: ## Format code
	@echo "$(COLOR_GREEN)Formatting code...$(COLOR_RESET)"
	npm run format

format-check: ## Check code formatting
	@echo "$(COLOR_GREEN)Checking code formatting...$(COLOR_RESET)"
	npm run format:check

type-check: ## Run TypeScript type checking
	@echo "$(COLOR_GREEN)Type checking...$(COLOR_RESET)"
	npm run type-check

quality: lint type-check test ## Run all quality checks

##@ Database

migrate-up: ## Run database migrations
	@echo "$(COLOR_GREEN)Running database migrations...$(COLOR_RESET)"
	npm run migrate:up

migrate-down: ## Rollback database migrations
	@echo "$(COLOR_YELLOW)Rolling back database migrations...$(COLOR_RESET)"
	npm run migrate:down

seed: ## Seed database with initial data
	@echo "$(COLOR_GREEN)Seeding database...$(COLOR_RESET)"
	npm run seed:policy

##@ Docker

docker-build: ## Build Docker image
	@echo "$(COLOR_GREEN)Building Docker image...$(COLOR_RESET)"
	docker build -t $(PROJECT_NAME):latest .

docker-up: ## Start Docker containers
	@echo "$(COLOR_GREEN)Starting Docker containers...$(COLOR_RESET)"
	docker-compose up -d

docker-down: ## Stop Docker containers
	@echo "$(COLOR_YELLOW)Stopping Docker containers...$(COLOR_RESET)"
	docker-compose down

docker-logs: ## View Docker logs
	@echo "$(COLOR_GREEN)Viewing Docker logs...$(COLOR_RESET)"
	docker-compose logs -f

docker-restart: docker-down docker-up ## Restart Docker containers

docker-clean: ## Remove Docker containers and volumes
	@echo "$(COLOR_YELLOW)Cleaning Docker containers and volumes...$(COLOR_RESET)"
	docker-compose down -v
	docker system prune -f

##@ Deployment

deploy-dev: ## Deploy to development environment
	@echo "$(COLOR_GREEN)Deploying to development...$(COLOR_RESET)"
	npm run deploy:dev

deploy-prod: ## Deploy to production environment
	@echo "$(COLOR_GREEN)Deploying to production...$(COLOR_RESET)"
	@read -p "Are you sure you want to deploy to production? [y/N] " confirm && [ "$$confirm" = "y" ] && npm run deploy:prod || echo "Deployment cancelled"

invoke-local: ## Invoke Lambda function locally
	@echo "$(COLOR_GREEN)Invoking Lambda function locally...$(COLOR_RESET)"
	serverless invoke local -f feeIndexer

logs-dev: ## View development logs
	@echo "$(COLOR_GREEN)Viewing development logs...$(COLOR_RESET)"
	serverless logs -f feeIndexer --stage dev --tail

logs-prod: ## View production logs
	@echo "$(COLOR_GREEN)Viewing production logs...$(COLOR_RESET)"
	serverless logs -f feeIndexer --stage production --tail

##@ Setup

setup: install docker-up migrate-up seed ## Complete project setup
	@echo "$(COLOR_GREEN)$(COLOR_BOLD)Setup complete! You can now run 'make dev' to start development.$(COLOR_RESET)"

init: ## Initialize project (first time setup)
	@echo "$(COLOR_GREEN)Initializing project...$(COLOR_RESET)"
	cp .env.example .env
	@echo "$(COLOR_YELLOW)Please edit .env with your configuration$(COLOR_RESET)"
	make setup

##@ Maintenance

update: ## Update dependencies
	@echo "$(COLOR_GREEN)Updating dependencies...$(COLOR_RESET)"
	npm update

audit: ## Run security audit
	@echo "$(COLOR_GREEN)Running security audit...$(COLOR_RESET)"
	npm audit

audit-fix: ## Fix security vulnerabilities
	@echo "$(COLOR_GREEN)Fixing security vulnerabilities...$(COLOR_RESET)"
	npm audit fix

##@ Information

info: ## Display project information
	@echo "$(COLOR_BOLD)Project Information$(COLOR_RESET)"
	@echo "  Name:        $(PROJECT_NAME)"
	@echo "  Node:        $(NODE_VERSION)"
	@echo "  Environment: $${NODE_ENV:-development}"
	@node --version
	@npm --version

status: ## Check service status
	@echo "$(COLOR_GREEN)Checking service status...$(COLOR_RESET)"
	@docker-compose ps
