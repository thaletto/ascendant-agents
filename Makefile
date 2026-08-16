.DEFAULT_GOAL := help

VENV ?= .venv
PYTHON := $(VENV)/bin/python
BASEDPYRIGHT := $(VENV)/bin/basedpyright

.PHONY: help test test-plugin test-mcp typecheck check

help: ## Show available development commands.
	@awk 'BEGIN {FS = ":.*##"} /^[a-zA-Z_-]+:.*##/ {printf "%-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

test: ## Run the complete plugin and MCP test suite.
	$(PYTHON) -m pytest -q

test-plugin: ## Run the plugin contract tests.
	$(PYTHON) -m pytest -q tests/test_agent_plugin.py

test-mcp: ## Run the hosted MCP behavior tests.
	$(PYTHON) -m pytest -q tests/test_mcp_service.py

typecheck: ## Run strict Basedpyright for the hosted MCP package and tests.
	cd mcp && ../$(BASEDPYRIGHT) --project pyproject.toml

check: test typecheck ## Run all verification checks.
