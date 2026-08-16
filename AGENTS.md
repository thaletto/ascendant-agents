# Ascendant Agents repository guidance

## Issue tracker

Use Linear under the Ascendant project for issues, specs, progress notes, and
completion. Preserve native blocker relationships between migration tickets.

## Domain context

Read the root `CONTEXT.md` before changing skills, hosted MCP behavior, or
language that names Jyotisha concepts. Keep the distributed skills
self-contained under `plugins/agent/ascendant/`.

## Private data

Never commit local `persons/` records or MCP environment files. Treat birth
details, generated chart artifacts, OAuth settings, and service credentials as
private local data.
