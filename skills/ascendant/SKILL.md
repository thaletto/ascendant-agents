---
name: ascendant
description: Vedic astrology readings and timing from a saved person record. Use when asked for chart calculation, person init, transit check, or interpretation.
---

## Routing

Check from the agent current working directory:

```bash
test -d ./persons && echo present || echo missing
```

If `missing`, follow `instructions/setup.md` in this skill before any reading. Do not attempt chart or transit work until `persons/<name>/` exists.

If `present`, answer from the saved record plus `smfs grep` over this skill `references/` directory.

## First run (persons missing)

Follow `instructions/setup.md`:

1. Run setup once in the current working directory.
2. Get name, exact ISO 8601 birth moment with Z or offset, latitude, longitude.
3. Create or refresh the record, then continue below.

## Readings (persons present)

1. Resolve `<skill-dir>` as the directory holding this SKILL.md.
2. Search `references/` for query-relevant method only. Do not dump whole files. Prefer `smfs`; on Windows or when `smfs` is missing use PowerShell:

```bash
smfs grep "<query keywords>" "<skill-dir>/references"
```

```powershell
Get-Command smfs -ErrorAction SilentlyContinue
Get-ChildItem "<skill-dir>/references" -Recurse -Include *.md,*.csv | Select-String -Pattern "<keyword1>|<keyword2>" | Select-Object -First 20 Path,LineNumber,Line
```

3. Open only the top hits under `<skill-dir>/references/kp/` or `<skill-dir>/references/parashari/` needed for the query.
4. Base timing and promise claims on the saved `persons/<name>/` record, not on reference text alone.
