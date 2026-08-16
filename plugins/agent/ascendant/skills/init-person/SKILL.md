---
name: init-person
description: Save a person's birth details and prepare reusable chart, Jaimini, timing, yoga, and SAV information used by the astrology skills.
license: AGPL-3.0
---

# Save birth details

Use this skill when the user provides a name, birth date and time with timezone, latitude, and longitude.

From the user's project directory, run the bundled script using its installed skill path. If Ascendant is not installed, install the package first with `python3 -m pip install astro-ascendant`.

```bash
python3 <path-to-init-person-skill>/scripts/init-person.py \
  --name "<name>" \
  --dob "<YYYY-MM-DDTHH:MM:SS+HH:MM>" \
  --latitude <latitude> \
  --longitude <longitude>
```

The command creates `persons/<name>/`, saves the original details, and prepares:

- divisional charts under `charts/`
- the named seven-karaka Jaimini core in `jaimini.json`
- planetary periods in `dasha.json`
- yoga results in `yogas.json`
- the complete Ashtakavarga/Sarvashtakavarga result in `sav.json`

Running it again with the same details reuses the existing record. Matching
v1 or v2 records derive `jaimini.json` from their saved D1/D9 data and upgrade
to `parashari_raman_jaimini_v3` without rewriting their context or existing
calculation artifacts. If the same name is used with different birth details,
a numeric suffix is appended to the directory name.

The output is structured (TOON): an `init-person:` block with the record name,
`status` (`created` or `reused`), directory, chart count, and rule pack, plus a
trailing `help[N]` block. Running with no arguments lists the saved persons;
`--version` prints the tool version. Exit codes: `0` on success, `1` on
internal errors, `2` on unknown flags or invalid values. Errors are structured
on stdout, never on stderr.

After it completes, read `provenance.json` and the generated files before
answering the user's astrology question. Cite the resulting record and
provenance for every factual statement about the saved chart; route
interpretation to the matching specialist skill for the question, which
carries its own process and topic rubric.
