## Ascendant setup

Use this guide only when `init` or transit must run and the host reports missing calculation dependencies. Skip this guide on Claude.ai and on any host that cannot write the working directory or run skill scripts. Those hosts already have guidebooks at `<skill-dir>/references/`; the user brings person or chart artifacts from an external source.

Do not copy guidebooks into the working directory. Do not install or mount smfs.

## Install calculation dependencies

From the agent current working directory, run setup once from the installed skill. Setup installs packages into that directory `node_modules`.

```bash
bash "<ascendant-skill-dir>/scripts/setup.sh"
```

Completion: setup reports `status: installed` and the current working directory. It installs the calculation packages into that directory `node_modules` without saving them to an existing package manifest or writing a lockfile, and it preserves person records. Bun is used when available; otherwise Node with npm is sufficient. The command wrappers refresh a self-ignored `.ascendant-agent/tools/` copy in the current working directory so those files resolve the same packages.

## Create person record

Obtain the person name, an exact birth moment in ISO 8601 form with `Z` or an explicit UTC offset, and latitude and longitude. Resolve a place name and historical offset before proceeding. Birth sex is optional.

Invoke `ascendant_init_person` when the host exposes it. Otherwise run:

```bash
bash "<ascendant-skill-dir>/scripts/init-person.sh" \
  --name "Person Name" \
  --moment "2000-01-01T12:00:00+05:30" \
  --latitude 12.9716 \
  --longitude 77.5946 \
  --sex Female
```

Completion: stdout reports the saved record. The record contains `input.txt`, `MEMORY.md`, Vedic `charts/` (D1–D60, Lahiri + WholeSign), Vedic `dasha.txt` (Vimshottari from the Lahiri Moon), `kp/D1.txt` and `kp/dasha.txt` (Krishnamurti + Placidus, Vimshottari from the KP Moon), `sav.txt`, and `jaimini/` artifacts. Chart and dasha `.txt` files include a `calculation` object with school, ayanamsha, house system, and dasha system. Generated `.txt` files contain TOON-formatted text. `MEMORY.md` starts with the person birth details and its header is preserved during a refresh, with confirmed events appended below per `SKILL.md`. A matching `.toon` or `.json` record migrates its generated artifacts to `.txt` during refresh. Identical input refreshes the record; different birth data for the same name requires a new name.
