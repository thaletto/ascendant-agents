#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# Keep dependencies, the runtime copy, and person records in the current
# working directory rather than beside the installed skill.
WORKING_DIRECTORY="$(pwd -P)"
RUNTIME_DIR="${WORKING_DIRECTORY}/.ascendant-agent"
RUNTIME_TOOLS_DIR="${RUNTIME_DIR}/tools"

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

if [ ! -f "${WORKING_DIRECTORY}/node_modules/astro-ascendant/package.json" ] || \
  [ ! -f "${WORKING_DIRECTORY}/node_modules/axi-sdk-js/package.json" ] || \
  [ ! -f "${WORKING_DIRECTORY}/node_modules/effect/package.json" ]; then
  print_error \
    "Ascendant dependencies are missing" \
    "RUNTIME_MISSING" \
    "Run bash \"${SKILL_DIR}/scripts/setup.sh\" from ${WORKING_DIRECTORY}, then retry"
  exit 1
fi

mkdir -p "${RUNTIME_TOOLS_DIR}"
if [ ! -e "${RUNTIME_DIR}/.gitignore" ]; then
  printf '*\n' > "${RUNTIME_DIR}/.gitignore"
fi
# Local-only runtime copy: sync the trusted skill sources into the working
# directory so Node resolves the CWD-installed node_modules. No remote
# fetch happens here. Explicit allowlist only; add new tool files here.
cp "${SKILL_DIR}/tools/ascendant.ts" \
  "${SKILL_DIR}/tools/cli.ts" \
  "${SKILL_DIR}/tools/common.ts" \
  "${SKILL_DIR}/tools/contract.ts" \
  "${SKILL_DIR}/tools/check-transit.ts" \
  "${SKILL_DIR}/tools/ruling-planets.ts" \
  "${SKILL_DIR}/tools/init-person.ts" \
  "${SKILL_DIR}/tools/kp-lords.ts" \
  "${SKILL_DIR}/tools/version.ts" \
  "${SKILL_DIR}/tools/package.json" \
  "${RUNTIME_TOOLS_DIR}/"

cd "${WORKING_DIRECTORY}"
exec "${RUNTIME[@]}" "${RUNTIME_TOOLS_DIR}/ascendant.ts" "$@"
