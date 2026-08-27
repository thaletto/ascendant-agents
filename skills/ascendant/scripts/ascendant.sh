#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-$(cd "${SKILL_DIR}/../.." && pwd)}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-${PWD}}"

print_error() {
  printf 'error: %s\ncode: %s\nhelp: %s' "$1" "$2" "$3"
}

if command -v bun >/dev/null 2>&1; then
  RUNTIME=(bun)
elif command -v node >/dev/null 2>&1; then
  if ! node --experimental-strip-types -e '' >/dev/null 2>&1; then
    print_error \
      "Node 22.6 or newer is required to run the TypeScript tool" \
      "RUNTIME_UNSUPPORTED" \
      "Install Node 22.6+ or Bun, then retry"
    exit 1
  fi
  RUNTIME=(node --experimental-strip-types)
else
  print_error \
    "Node or Bun is required to run Ascendant" \
    "RUNTIME_MISSING" \
    "Install Node 22.6+ or Bun, then retry"
  exit 1
fi

if [ ! -f "${PLUGIN_ROOT}/node_modules/astro-ascendant/package.json" ] || \
  [ ! -f "${PLUGIN_ROOT}/node_modules/axi-sdk-js/package.json" ] || \
  [ ! -f "${PLUGIN_ROOT}/node_modules/effect/package.json" ]; then
  print_error \
    "Ascendant dependencies are missing" \
    "RUNTIME_MISSING" \
    "Run bash \"${SKILL_DIR}/scripts/setup.sh\", then retry"
  exit 1
fi

cd "${PROJECT_DIR}"
exec "${RUNTIME[@]}" "${SKILL_DIR}/tools/ascendant.ts" "$@"
