#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "${SKILL_DIR}/../.." && pwd)}"

if [ ! -d "${PLUGIN_ROOT}/node_modules" ]; then
  echo "Ascendant plugin dependencies are not installed." >&2
  echo "Install the plugin through Claude Code, or run 'bun install' or 'npm install' in ${PLUGIN_ROOT}." >&2
  exit 1
fi