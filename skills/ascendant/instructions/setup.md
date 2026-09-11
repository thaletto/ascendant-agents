## Ascendant setup

Use this guide when `persons/<name>/` is absent or an Ascendant command reports missing dependencies.

## Install calculation dependencies

From the agent current working directory, run setup once from the installed skill. Setup installs packages into that directory `node_modules`.

```bash
bash "<ascendant-skill-dir>/scripts/setup.sh"
```

Completion: setup reports `status: installed` and the current working directory. It installs the calculation packages into that directory `node_modules` without saving them to an existing package manifest or writing a lockfile, and it preserves person records. Bun is used when available; otherwise Node with npm is sufficient. The command wrappers refresh a self-ignored `.ascendant-agent/tools/` copy in the current working directory so those files resolve the same packages.

## Install smfs

```bash
curl -fsSL https://smfs.ai/install | bash
smfs login
```

Login is once per machine. It prompts for a Supermemory API key from console.supermemory.ai. Key can also pass directly with `smfs login --key sm_...`. If `smfs whoami` already shows a user, skip login.

Completion: `smfs` is on PATH and login succeeds. If `smfs` is unavailable on this platform, skip login and mount and continue without it.

## Mount persons container

```bash
smfs mount persons
```

Completion: `persons/` in the current working directory is mounted. Run once per working directory. Only `persons/` is mounted; `references/` stays as local skill files.

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

Completion: stdout reports the saved record. The record contains `input.txt`, `MEMORY.md`, `charts/`, `dasha.txt`, `sav.txt`, and `jaimini/` artifacts. Generated `.txt` files contain TOON-formatted text. `MEMORY.md` starts with the person birth details and is never overwritten during a refresh. A matching `.toon` or `.json` record migrates its generated artifacts to `.txt` during refresh. Identical input refreshes the record; different birth data for the same name requires a new name.
