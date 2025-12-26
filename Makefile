# Knowledge Base Development Commands
# Usage: make <target>
#
# Run `make help` for available commands

.PHONY: help dev backend frontend install test clean mcp-build mcp-dev mcp-inspect

# Default target
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
CYAN := \033[0;36m
NC := \033[0m

help: ## Show this help message
	@echo ""
	@echo "Knowledge Base - Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-15s$(NC) %s\n", $$1, $$2}'
	@echo ""

dev: ## Start both frontend and backend (recommended)
	@./scripts/dev.sh

backend: ## Start only the backend server
	@./scripts/start-backend.sh

frontend: ## Start only the frontend server
	@cd frontend && npm run dev

install: ## Install all dependencies
	@echo "$(BLUE)[backend]$(NC) Installing Python dependencies..."
	@cd backend && uv sync
	@echo "$(CYAN)[frontend]$(NC) Installing Node dependencies..."
	@cd frontend && npm install
	@echo "$(CYAN)[mcp-server]$(NC) Installing Node dependencies..."
	@cd mcp-server && npm install
	@echo "$(GREEN)[done]$(NC) All dependencies installed"

test: ## Run backend tests
	@cd backend && source .venv/bin/activate && pytest

test-verbose: ## Run backend tests with verbose output
	@cd backend && source .venv/bin/activate && pytest -v

lint: ## Run linters on backend and frontend
	@echo "$(BLUE)[backend]$(NC) Running ruff..."
	@cd backend && source .venv/bin/activate && ruff format && ruff check --fix
	@echo "$(CYAN)[frontend]$(NC) Running eslint..."
	@cd frontend && npm run lint
	@echo "$(CYAN)[mcp-server]$(NC) Running typecheck..."
	@cd mcp-server && npm run typecheck
	@echo "$(GREEN)[done]$(NC) Linting complete"

clean: ## Clean up generated files and caches
	@echo "Cleaning up..."
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	@rm -rf backend/data/lancedb/* 2>/dev/null || true
	@rm -rf mcp-server/dist 2>/dev/null || true
	@echo "$(GREEN)[done]$(NC) Cleanup complete"

# MCP Server targets
mcp-build: ## Build the MCP server
	@echo "$(CYAN)[mcp-server]$(NC) Building..."
	@cd mcp-server && npm run build
	@echo "$(GREEN)[done]$(NC) MCP server built"

mcp-dev: ## Run MCP server in development mode
	@echo "$(CYAN)[mcp-server]$(NC) Starting in dev mode..."
	@cd mcp-server && npm run dev

mcp-inspect: ## Test MCP server with MCP Inspector
	@echo "$(CYAN)[mcp-server]$(NC) Starting MCP Inspector..."
	@cd mcp-server && npm run inspect:dev
