---
name: get-transit
description: Show where the planets are now, or at a requested date, compared with a person's birth chart.
license: AGPL-3.0
---

# Current planetary positions

Read [`../../../AGENTS.md`](../../../AGENTS.md).

Use this skill when a user asks what is moving through their chart now or on a specific date.

## Inputs

- **Name:** a person already saved in `persons/<name>/`.
- **Date:** optional ISO date and time with a timezone; use the current moment when omitted.
- **Chart division:** optional; use the main birth chart by default.

From the user's project directory, run the bundled script using its installed skill path. If Ascendant is not installed, install the package first with `python3 -m pip install astro-ascendant`.

```bash
python3 <path-to-get-transit-skill>/scripts/get-transit.py --name "<name>" --date "<date>" --division 1
```

Leave out `--date` for the current moment. Use the requested chart division when one is provided. Running with no arguments lists the saved persons; `--version` prints the tool version. Exit codes: `0` on success, `1` on missing records or internal errors, `2` on unknown flags or invalid values.

## Result

Return the script's structured (TOON) report as dated evidence. The output
starts with a `get-transit:` block carrying the name, moment, division,
location, natal lagna, and aggregate counts; the `planets[N]` block lists each
planet's sign, degree, direction (`R`/`D`), birth-star, quarter, and the
birth-chart house affected; the `houses[N]` block lists each house, sign, lord,
and contained planets; a trailing `help[N]` block shows the next commands.
Errors are structured on stdout, never on stderr. Route interpretation to the
matching specialist skill for the question, which carries its own process and
topic rubric; this tool only supplies dated positions.

Use this report as dated evidence. The script calculates planetary positions;
it does not decide their meaning or weight.
