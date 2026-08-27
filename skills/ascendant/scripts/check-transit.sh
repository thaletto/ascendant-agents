#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "${SKILL_DIR}/../.." && pwd)}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${PWD}}"

if ! command -v bun >/dev/null 2>&1; then
  echo "Ascendant requires Bun: https://bun.sh" >&2
  exit 1
fi

if [ ! -d "${PLUGIN_ROOT}/node_modules" ]; then
  echo "Ascendant dependencies are missing. Run ${SKILL_DIR}/scripts/setup.sh first." >&2
  exit 1
fi

cd "${PROJECT_DIR}"
exec bun run "${SKILL_DIR}/tools/check-transit.ts" "$@"
