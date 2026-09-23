# Ascendant Agents

[![skills.sh](https://skills.sh/b/thaletto/ascendant-agents)](https://skills.sh/thaletto/ascendant-agents)

Save a birth record once, then ask reading and timing questions. You get answers grounded in stored charts, so the same input always gives the same result.

## What

The Ascendant skill turns a saved birth record into evidence-backed astrology readings. It has three arguments:

- `init` creates or refreshes a reusable `persons/<name>/` record (Vedic charts and dasha, KP D1 and dasha, Ashtakavarga, Jaimini artifacts) from exact birth data;
- `setup` installs calculation dependencies when `init` or transit tools must run, and replaces `./references` from the skill. smfs is not required.
- `analysis` answers a reading or timing question from the saved record, grounding claims in stored charts and method references (KP for timing/yes-no, Parashari for promise/quality/synthesis).

With no argument it infers one: birth data on a writable host means `init`, missing calculation dependencies when tools must run means `setup`, a life question with person evidence means `analysis`.

## Why

Readings stay consistent because three things are separated: deterministic calculations (a Located Moment yields a Lahiri Whole-Sign Vedic chart set plus a separate KrishnamurtiVP291 Placidus KP D1, each with its own Vimshottari dasha), durable person memory (`persons/<name>/MEMORY.md` accumulates only confirmed events), and guidebook method (local KP/Parashari references searched per query). Interpretations never substitute for stored evidence. Do not mix KP house placements with Parashari reading, or Vedic houses with KP cusp and Sub Lord analysis.

The skill ships to many harnesses from a single source of truth: `skills/ascendant/SKILL.src.md` plus the skill subtrees. `scripts/build-skill.mjs` generates the canonical `skills/ascendant/SKILL.md` and one copy per harness with the frontmatter each loader honors (`user-invocable` and `argument-hint` only where supported, `metadata.version` for the Codex layout). Edit the source and rebuild; never hand-edit a generated copy.

Setup is documented next to the skill in [`skills/ascendant/instructions/setup.md`](skills/ascendant/instructions/setup.md). It accepts Bun or Node with npm, installs calculation dependencies in the agent's current working directory without saving them to an existing package manifest or writing a lockfile, and never changes person records. It replaces `./references` by deleting any existing copy and cloning the skill's guidebooks. It does not install smfs. On Claude.ai, skip setup: the plugin already ships `<skill-dir>/references/`, and the user provides person or chart artifacts.

## Installation

### Claude plugin

On Claude Code:

```text
/plugin marketplace add thaletto/ascendant-agents
/plugin install ascendant@ascendant
/reload-plugins
```

On Claude.ai the same plugin ships the skill and its guidebooks. Skip smfs, skip copying `references/`, and skip creating `persons/` unless the conversation already has a writable working directory. Attach or paste a person record (or chart artifacts) and read method from the skill's `references/`.

### Standalone skill

From the working directory where you want to use Ascendant, run:

```console
$ npx skills add thaletto/ascendant-agents --skill ascendant
```

Choose the agent or agents that should receive the skill when prompted.

### Codex plugin

Run:

```console
$ codex plugin marketplace add thaletto/ascendant-agents --ref main
$ codex plugin add ascendant@ascendant
```

Start a new Codex task after installation so the skill is loaded.

### Other harnesses

Every directory below contains a ready-to-use `skills/ascendant/` copy tracked in this repo. Copy it into the matching directory of your project root:

| Harness | Copy from |
|---|---|
| Cursor | `.cursor/skills/ascendant/` |
| Gemini CLI | `.gemini/skills/ascendant/` |
| DeepSeek Harness | `.dsh/skills/ascendant/` |
| Codex CLI (repo skills) | `.agents/skills/ascendant/` |
| GitHub Copilot | `.github/skills/ascendant/` |
| Kiro | `.kiro/skills/ascendant/` |
| OpenCode | `.opencode/skills/ascendant/` (plus `.opencode/commands/ascendant.md` for the `/ascendant` slash command) |
| Pi | `.pi/skills/ascendant/` |
| Qoder | `.qoder/skills/ascendant/` |
| Trae | `.trae/skills/ascendant/` |
| Trae China | `.trae-cn/skills/ascendant/` |
| Rovo Dev | `.rovodev/skills/ascendant/` |
| Mistral Vibe | `.vibe/skills/ascendant/` |
| Veto | `.veto/skills/ascendant/` |
| Grok Build | `.grok/skills/ascendant/` |
| Antigravity | `.agent/skills/ascendant/` |
| Hermes Agent | `.hermes/skills/ascendant/` |

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

Regenerate skill copies after editing the source with `make build-skill` (or `npm run build:skill`).
