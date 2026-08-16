# Ascendant hosted MCP

This directory contains the hosted connector only. The separately distributed
`astro-ascendant` package remains responsible for chart calculation and
person-record artifacts.

The connector is deliberately split by responsibility:

- `server.py` registers data tools and composes the Vercel ASGI app.
- `store.py` owns SQLite/Neon persistence and account-scoped SQL.
- `records.py` validates birth inputs and calculates evidence bundles.
- `auth.py` configures the OAuth resource server, and `resources.py` publishes
  the canonical topic skills.

`app.py` is the root-level Vercel function entrypoint.

Deploy this directory as the Vercel project Root Directory. Enable **Include
source files outside of the Root Directory** in Vercel's Build and Deployment
settings: `requirements.txt` installs this package and its immutable compatible
`astro-ascendant` revision, while `vercel.json` includes the canonical
`../plugins/agent` skill package.
