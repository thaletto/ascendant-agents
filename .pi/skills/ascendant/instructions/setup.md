## Ascendant setup

Use this guide when `persons/<name>/` is absent or an Ascendant command reports missing dependencies.

## Install calculation dependencies

From the agent current working directory, run setup once from the installed skill. Setup installs packages into that directory `node_modules`.

```bash
bash "<ascendant-skill-dir>/scripts/setup.sh"
```

Completion: setup reports `status: installed` and the current working directory. It installs the calculation packages into that directory `node_modules` without saving them to an existing package manifest or writing a lockfile, and it preserves person records. Bun is used when available; otherwise Node with npm is sufficient. The command wrappers refresh a self-ignored `.ascendant-agent/tools/` copy in the current working directory so those files resolve the same packages.

## Install smfs

Approval gate: before downloading or running the smfs installer, ask
the human for approval via tool with Yes/No options and proceed only
on an explicit Yes. Do not run any install command without that approval.

Verify first, then install (only after Yes). Do not pipe an uninspected remote script
directly to a shell. Download it, read it, then run the local copy:

```bash
curl -fsSL https://smfs.ai/install -o /tmp/smfs-install.sh
less /tmp/smfs-install.sh
bash /tmp/smfs-install.sh
smfs login
```

Only `https://smfs.ai/install` over HTTPS is expected. If the script
content looks unrelated to smfs/Supermemory, stop and do not run it.

Login is once per machine. It prompts for a Supermemory API key from console.supermemory.ai. Prefer the interactive prompt so the key stays out of shell history; do not pass `--key sm_...` on a shared command line. If `smfs whoami` already shows a user, skip login.

Completion: `smfs` is on PATH and login succeeds. If `smfs` is unavailable on this platform, skip login and mount and continue without it.

## Mount persons and references containers

`persons/` mounts in the agent current working directory. `references/`
lives under the installed skill directory, not necessarily the current
directory, so it mounts at its skill path:

```bash
smfs mount persons
smfs mount references --path "<ascendant-skill-dir>/references"
```

Completion: `persons/` in the current working directory is mounted and
`references/` under the skill directory is mounted. Run once per working
directory (persons) and once per skill install (references). Mounting
preserves the shipped local reference files. Both are smfs-mounted
containers afterwards.

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

Completion: stdout reports the saved record. The record contains `input.txt`, `MEMORY.md`, `charts/`, `dasha.txt`, `sav.txt`, and `jaimini/` artifacts. Generated `.txt` files contain TOON-formatted text. `MEMORY.md` starts with the person birth details and its header is preserved during a refresh, with confirmed events appended below per `SKILL.md`. A matching `.toon` or `.json` record migrates its generated artifacts to `.txt` during refresh. Identical input refreshes the record; different birth data for the same name requires a new name.
