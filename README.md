# Ascendant Agents

Ascendant Agents contains the agent-facing Ascendant integrations:

- evidence-grounded Jyotisha skills;
- the Codex plugin and marketplace manifest; and
- the authenticated hosted MCP connector used by the Ascendant ChatGPT app.

Chart calculation remains in the separately distributed
[`astro-ascendant`](https://github.com/thaletto/ascendant) Python package. The
hosted connector pins an immutable compatible core revision until that contract
is available in a later PyPI release.

## Install the skills

Install the portable skill bundle from the repository:

```bash
npx skills add thaletto/ascendant-agents
```

The local chart and transit tools also require the calculation package:

```bash
python3 -m pip install astro-ascendant
```

## Install the Codex plugin

Add the repository as a Codex marketplace, then install the bundled plugin:

```bash
codex plugin marketplace add https://github.com/thaletto/ascendant-agents.git --ref main
codex plugin add agent@ascendant
```

## Develop and verify

Ascendant Agents requires Python 3.11 or later. Create a local environment,
install the hosted MCP package with its development dependencies, and run the
repository checks:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -e './mcp[dev]'
make check
```

The plugin contract tests exercise the skill package and bundled local tools.
The MCP tests exercise authenticated record isolation, resources, tools, and
the stateless Vercel HTTP interface.

## Deploy the hosted MCP connector

Use `mcp/` as the Vercel project root and enable **Include source files outside
of the Root Directory** so the deployment can package the canonical skills
from `plugins/agent/`. Environment and OAuth configuration belong in Vercel or
an ignored local `mcp/.env.*` file; never commit credentials.

## License

Ascendant Agents is licensed under the GNU Affero General Public License v3.0.
