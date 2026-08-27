#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "${SKILL_DIR}/../.." && pwd)}"

if ! command -v bun >/dev/null 2>&1; then
  echo "Ascendant setup requires Bun: https://bun.sh" >&2
  exit 1
fi

cd "${PLUGIN_ROOT}"
bun install --frozen-lockfile

echo "Ascendant dependencies installed in ${PLUGIN_ROOT}"
