# Ascendant Agents

Agent skills and tools for Vedic astrology calculations with [`astro-ascendant`](https://www.npmjs.com/package/astro-ascendant) and Effect.

Install the same Ascendant skill as a Claude Code plugin, a standalone skill, or a Codex plugin. It provides two operations:

- `init-person` creates a reusable `persons/<name>/` calculation record;
- `check-transit` returns a compact D1 transit chart as TOON.

Setup is documented next to the skill in [`skills/ascendant/setup.md`](skills/ascendant/setup.md). It accepts Bun or Node with npm, installs calculation dependencies in the active agent project without saving them to an existing package manifest or writing a lockfile, and never changes person records.

Optionally, mount `persons` with SMFS:

```console
$ curl -fsSL smfs.ai/install | sh
$ smfs mount persons
```

## Install the Claude Code plugin

Run these commands inside Claude Code:

```text
/plugin marketplace add thaletto/ascendant-agents
/plugin install ascendant@ascendant
/reload-plugins
```

## Install the standalone skill

From the project where you want to use Ascendant, run:

```console
$ npx skills add thaletto/ascendant-agents --skill ascendant
```

Choose the agent or agents that should receive the skill when prompted.

## Install the Codex plugin

Run:

```console
$ codex plugin marketplace add thaletto/ascendant-agents --ref main
$ codex plugin add ascendant@ascendant
```

Start a new Codex task after installation so the skill is loaded.

## Local verification

```bash
bun install --frozen-lockfile
bun run typecheck
```

Or, with Node 22.6+:

```bash
npm install
npm run typecheck
```
