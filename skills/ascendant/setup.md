# Ascendant setup

Use this guide when `persons/<name>/` is absent or an Ascendant command reports missing dependencies.

## Prepare a person record

1. From the project where the agent is running, run setup once from the installed skill:

   ```bash
   bash "${CLAUDE_SKILL_DIR}/scripts/setup.sh"
   ```

   Completion: setup reports `status: installed` and the active project as `root`. It installs the calculation packages into that project's `node_modules` without saving them to an existing package manifest or writing a lockfile, and it preserves project records. Bun is used when available; otherwise Node with npm is sufficient. The command wrappers refresh a self-ignored, project-local `.ascendant-agent/tools/` copy before execution so those files resolve the same project-level packages.

2. Obtain the person's name, an exact birth moment in ISO 8601 form with `Z` or an explicit UTC offset, and latitude and longitude. Resolve a place name and historical offset before proceeding.

3. Invoke `ascendant_init_person` when the host exposes it. Otherwise run:

   ```bash
   bash "${CLAUDE_SKILL_DIR}/scripts/init-person.sh" \
     --name "Person Name" \
     --moment "2000-01-01T12:00:00+05:30" \
     --latitude 12.9716 \
     --longitude 77.5946
   ```

   Completion: stdout reports the saved record. The record contains normalized input, `charts/`, `dasha.json`, `sav.json`, present Yoga results, and `jaimini/` artifacts. Identical input refreshes the record; different birth data for the same name requires a new name.
