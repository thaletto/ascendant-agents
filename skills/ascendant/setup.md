# Ascendant setup

Use this guide when `persons/<name>/` is absent or an Ascendant command reports missing dependencies.

## Prepare a person record

1. From the agent's current working directory, run setup once from the installed skill. Setup installs packages into that directory's `node_modules`, and `init-person` saves records in its `persons/<name>/` directory.

   ```bash
   bash "<ascendant-skill-dir>/scripts/setup.sh"
   ```

   Completion: setup reports `status: installed` and the current working directory. It installs the calculation packages into that directory's `node_modules` without saving them to an existing package manifest or writing a lockfile, and it preserves person records. Bun is used when available; otherwise Node with npm is sufficient. The command wrappers refresh a self-ignored `.ascendant-agent/tools/` copy in the current working directory so those files resolve the same packages.

2. Obtain the person's name, an exact birth moment in ISO 8601 form with `Z` or an explicit UTC offset, and latitude and longitude. Resolve a place name and historical offset before proceeding.

3. Invoke `ascendant_init_person` when the host exposes it. Otherwise run:

   ```bash
   bash "<ascendant-skill-dir>/scripts/init-person.sh" \
     --name "Person Name" \
     --moment "2000-01-01T12:00:00+05:30" \
     --latitude 12.9716 \
     --longitude 77.5946
   ```

   Completion: stdout reports the saved record. The record contains `input.txt`, `MEMORY.md`, `charts/`, `dasha.txt`, `sav.txt`, present Yoga results in `yoga.txt`, and `jaimini/` artifacts. Generated `.txt` files contain TOON-formatted text. `MEMORY.md` starts with the person's birth details and is never overwritten during a refresh. A matching `.toon` or `.json` record migrates its generated artifacts to `.txt` during refresh. Identical input refreshes the record; different birth data for the same name requires a new name.
