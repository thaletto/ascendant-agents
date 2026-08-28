#!/usr/bin/env bash
set -euo pipefail

# Dependencies belong to the current working directory. The installed skill
# may live elsewhere, so its directory is not the dependency location.
WORKING_DIRECTORY="$(pwd -P)"

required_packages=(
  "@effect/platform-node-shared"
  "@swisseph/node"
  "@toon-format/toon"
  "astro-ascendant"
  "axi-sdk-js"
  "effect"
)

package_specs=(
  "@effect/platform-node-shared@4.0.0-rc.112"
  "@swisseph/node@1.3.1"
  "@toon-format/toon@4.1.1"
  "astro-ascendant@0.1.2"
  "axi-sdk-js@0.1.11"
  "effect@4.0.0-rc.112"
)

cd "${WORKING_DIRECTORY}"
if command -v bun >/dev/null 2>&1; then
  install_dependencies() {
    bun add --no-save --trust "${package_specs[@]}"
  }
elif command -v npm >/dev/null 2>&1; then
  install_dependencies() {
    local npm_major

    if ! npm install \
      --no-save \
      --no-package-lock \
      --no-audit \
      --no-fund \
      "${package_specs[@]}"; then
      return 1
    fi

    npm_major="$(npm --version)"
    npm_major="${npm_major%%.*}"
    if [[ "${npm_major}" =~ ^[0-9]+$ ]] && [ "${npm_major}" -ge 11 ]; then
      npm rebuild \
        @swisseph/node \
        msgpackr-extract \
        --dangerously-allow-all-scripts
    fi
  }
else
  printf 'error: Node or Bun package manager is required\ncode: RUNTIME_MISSING\nhelp: Install Node 22.6+ (npm) or Bun, then retry'
  exit 1
fi

if install_dependencies >&2; then
  for package in "${required_packages[@]}"; do
    if [ ! -f "${WORKING_DIRECTORY}/node_modules/${package}/package.json" ]; then
      printf 'error: Ascendant dependencies were not installed\ncode: SETUP_FAILED\nhelp: Run setup again after checking the package manager output'
      exit 1
    fi
  done
  printf 'setup:\n  status: installed\n  directory: %s\n' "${WORKING_DIRECTORY}"
else
  printf 'error: Dependency installation failed\ncode: SETUP_FAILED\nhelp: Run setup again after checking the package manager output'
  exit 1
fi
