---
name: ascendant
description: Vedic astrology readings and timing from a saved person record. Use when asked for setup, chart calculation, person init, transit check, or interpretation.
version: 1.2.2
user-invocable: true
argument-hint: init | setup | analysis
---

## Arguments

| Argument | Meaning |
|---|---|
| `init` | Create or refresh a `persons/<name>/` record from birth data |
| `setup` | Install calculation dependencies, smfs, and mount `persons/` |
| `analysis` | Answer a reading or timing question from the saved record |

With no argument, infer it: birth data given means `init`, missing `persons/` means `setup`, a question about life events means `analysis`.

## Routing

Check from the agent current working directory:

```bash
test -d ./persons && echo present || echo missing
```

If `missing`, follow `instructions/setup.md` in this skill before any reading. Complete setup until `persons/<name>/` exists before chart or transit work.

An explicit argument overrides this check: `init` creates the record, `setup` runs setup, `analysis` runs the reading flow.

If `present`, answer from the saved record plus guidebook method. `persons/` is the smfs-mounted container; `references/` are local skill files.

## First run (persons missing or `setup`)

Follow `instructions/setup.md`:

1. Run setup once in the current working directory.
2. Get name, exact ISO 8601 birth moment with Z or offset, latitude, longitude. Birth sex is optional.
3. Create or refresh the record (`init`), then continue below.

## Readings (persons present or `analysis`)

1. Resolve `<skill-dir>` as the directory holding this SKILL.md.
2. Translate the query into astrological search terms before searching. References are astrological guidebooks, so everyday words return nothing. Map the life domain to houses and method words. Example: "When job change" searches `houses job` and `significators job`, not `Job` or `Occupation`. Use terms like houses, significators, dasha, lords, sub-lord, cusps.
3. Pick the reference from the routing table, then search only that directory:

| Question type | Reference |
|---|---|
| Timing (when will X happen) or yes/no (will X happen) | `<skill-dir>/references/kp/` |
| All else: promise, quality, how/why, synthesis, varga, yoga | `<skill-dir>/references/parashari/` |

4. Search each source with its matching tool, returning top 20 hits only:
   - Person memory lives in the mounted container, so query it with `smfs`:

```bash
smfs grep "<name or person keywords>" ./persons
```

   - Guidebook method lives in local files, so search the chosen reference dir with plain `grep` (PowerShell on Windows):

```bash
grep -rhi "<keyword1>|<keyword2>" "<skill-dir>/references/kp" | head -n 20
```

```powershell
Get-ChildItem "<skill-dir>/references/kp" -Recurse -Include *.md,*.csv | Select-String -Pattern "<keyword1>|<keyword2>" | Select-Object -First 20 Path,LineNumber,Line
```

5. Open only the top hits needed for the query. If search returns nothing useful, read `<skill-dir>/references/<chosen>/index.md` and open the mapped file or sections.
6. Ground timing and promise claims in the saved `persons/<name>/` record, using reference text for method only.
7. Maintain `persons/<name>/MEMORY.md` as durable person facts: read it before analysis; preserve the birth header; append every newly confirmed happened event, and only those, as `- [DD/MM/YYYY]: {message}` sorted oldest-first; replace corrected facts instead of duplicating; store facts there, keeping interpretations, calculations, and session hypotheses out.
