# Saved evidence contract

Read artifacts from the exact `persons/<name>` directory. Never resolve a name
containing a path separator or traversal segment.

| Artifact | Use |
| --- | --- |
| `CONTEXT.md` | Identity, birth metadata, and user-provided life context. Context may personalize guidance but is not chart evidence. |
| `charts/D1.json` | Natal houses, signs, occupants, lords, dignity, and Lagna. |
| `charts/D<n>.json` | Topic varga named by the topic rubric. |
| `jaimini.json` | Seven Chara Karakas, Rashi Drishti, Karakamsha, Arudha Padas, Upapada, and raw Argala under the saved named method. |
| `dasha.json` | Active Vimshottari Mahadasha and Antardasha for the resolved moment. Dates are stored as `DD-MM-YYYY`. |
| `yogas.json` | Present computed yogas only; ignore entries whose `present` value is false. |
| `sav.json` | `sarva` scores by sign. Use only at the SAV layer. |
| `provenance.json` | Ayanamsa, house system, rule-pack version, schema, and input hash. |

For time-bound questions, use the bundled `get-transit` skill to calculate
dated planetary positions. That tool supplies data; it does not interpret it.

Legacy `parashari_raman_v1` and `parashari_raman_v2` provenance describes
the method active when the record was saved. Re-running `init-person` with
matching birth data derives `jaimini.json` from saved D1/D9 data, upgrades
provenance to `parashari_raman_jaimini_v3`, and preserves the other artifacts.

## Partial records

Start with every artifact required by the topic rubric. If one is absent,
continue with the independent factors that remain. Name the missing path,
remove every dependent rule from consideration, and lower confidence.

## Claim-level citations

Every material claim cites both its evidence and its governing method:

```text
[evidence: persons/Ada/charts/D1.json#10; source: BPHS-11.11, BPHS-21.1-4]
```

For a developer-authored rule without an external source locator:

```text
[evidence: persons/Ada/dasha.json#Saturn/Saturn; Ascendant methodology: PR-CAR-DASHA]
```

Group citations at the end of a natural sentence or paragraph when all
sentences share the same evidence. Do not append a marker mechanically to
headings, direct questions, or non-interpretive transitions.
