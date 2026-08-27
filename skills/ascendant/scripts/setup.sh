#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "${SKILL_DIR}/../.." && pwd)}"

cd "${PLUGIN_ROOT}"
if command -v bun >/dev/null 2>&1; then
  install_command=(bun install --frozen-lockfile)
elif command -v npm >/dev/null 2>&1; then
  install_command=(npm install --no-audit --no-fund)
else
  printf 'error: Node or Bun package manager is required\ncode: RUNTIME_MISSING\nhelp: Install Node 22.6+ (npm) or Bun, then retry'
  exit 1
fi

if "${install_command[@]}" >&2; then
  required_packages=(
    "@effect/platform-node-shared"
    "@toon-format/toon"
    "astro-ascendant"
    "axi-sdk-js"
    "effect"
  )
  for package in "${required_packages[@]}"; do
    if [ ! -f "${PLUGIN_ROOT}/node_modules/${package}/package.json" ]; then
      printf 'error: Ascendant dependencies were not installed\ncode: SETUP_FAILED\nhelp: Run setup again after checking the package manager output'
      exit 1
    fi
  done
  printf 'setup:\n  status: installed\n  root: %s' "${PLUGIN_ROOT}"
else
  printf 'error: Dependency installation failed\ncode: SETUP_FAILED\nhelp: Run setup again after checking the package manager output'
  exit 1
fi
