# Ascendant Agents

Agent skills and small TypeScript tools for Vedic astrology calculations with [`astro-ascendant`](https://www.npmjs.com/package/astro-ascendant) and Effect.

The repository provides one shared implementation for Claude Code, Codex, and OpenCode:

- `setup` installs the root Bun dependencies only;
- `init-person` creates a reusable `persons/<name>/` calculation record;
- `check-transit` returns a compact D1 transit chart as one JSON line.

## Claude Code

The Claude plugin manifest is `.claude-plugin/plugin.json`, with marketplace metadata in `.claude-plugin/marketplace.json`. The Ascendant skill invokes the scripts under `skills/ascendant/scripts/`.

## Codex

The Codex plugin manifest is `.codex-plugin/plugin.json`. It exposes the same Ascendant skill under `skills/ascendant/`.

## OpenCode

The project plugin at `.opencode/plugins/ascendant.ts` exposes three native tools:

- `ascendant_setup`
- `ascendant_init_person`
- `ascendant_check_transit`

OpenCode installs the adapter dependency from `.opencode/package.json`; `ascendant_setup` installs the shared calculation dependencies at the repository root.

## Local verification

```bash
bun install --frozen-lockfile
bun run typecheck
```
