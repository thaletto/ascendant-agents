.DEFAULT_GOAL := help
.PHONY: help install build-skill typecheck test lint format

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies (frozen lockfile)
	bun install --frozen-lockfile

build-skill: ## Rebuild all harness skill copies from skills/ascendant/SKILL.src.md
	node scripts/build-skill.mjs

typecheck: ## Typecheck skill tools and opencode plugin
	npm run typecheck

test: ## Run tests
	bun test

lint: ## Lint sources (generated harness copies are ignored via .oxlintrc.json)
	npm run lint

format: ## Format sources (code and JSON only; docs under references/ are untouched)
	npm run format
