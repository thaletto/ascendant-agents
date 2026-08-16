# Parashari-Jaimini hierarchy

Version: `parashari_raman_jaimini_v3`

The developer owns both axes below. The model decides whether a saved factor
matches a rule, then applies the fixed precedence.

## Axis 1: evidence layer

From strongest to lightest:

1. **Natal promise** — D1 Parashari factors and the topic's declared Jaimini
   factors establish whether the topic is supported, constrained, or mixed.
2. **Relevant varga** — confirms or qualifies D1 for topics that name one. It
   cannot create a promise that D1 denies.
3. **Vimshottari activation** — describes when natal and varga factors are
   activated; it does not rewrite them.
4. **Transit trigger** — describes dated activation only. Load it for a
   time-bound question.
5. **SAV corroboration** — adjusts confidence in a relevant sign or house but
   never controls the conclusion.

## Axis 2: factor rank

Within one layer, from strongest to lightest:

1. **Primary** — controls that layer.
2. **Corroborating** — strengthens or weakens a primary factor.
3. **Modifying** — changes expression, conditions, or trade-offs.
4. **Background** — useful context that cannot change the judgment.

## Precedence

Compare the evidence layer first, then the factor rank. A higher factor
controls unless a topic rubric names an explicit exception. Several
lower-ranked factors cannot outvote one higher-ranked factor. Equally ranked
contradictory factors remain mixed; explain both. Lower layers may describe
their timing or expression but cannot resolve the mixed conclusion.

Jaimini and Parashari factors are co-primary only where the topic rubric names
both. Judge each system on its own terms before comparing them. Agreement
strengthens natal confidence; disagreement remains mixed. Neither system
silently borrows the other's aspects, significators, or counting rules.

## Applying a house rule

For a selected house, inspect its sign, occupants, and sign lord in the same
chart:

- `Exalted`, `Moola Trikona`, `Own`, or `Friend` dignity supports the rule.
- `Debilitated` or `Enemy` dignity constrains the rule.
- A lord placed in house 6, 8, or 12 constrains the rule unless the topic
  rubric explicitly treats that house as the subject being judged.
- Conflicting support and constraint is mixed.
- Any other combination is neutral.

Use present entries from `yogas.json` only at the rank assigned by the topic
rubric. A stored yoga never outranks the house or lord that governs the topic.

## Applying the Jaimini core

Read the [Jaimini core](jaimini-core.md), then apply only
the factors selected by this topic rubric. An unrelated Karaka is background.

For SAV, use the saved sign score with `BPHS-72.1-7`: above 30 corroborates,
25 through 30 is neutral, and below 25 constrains. SAV remains the lightest
layer regardless of the score.

## Confidence

Give every substantive conclusion one label:

- **Strong** — the primary natal factor is clear, every varga required by the
  topic is available and corroborating, every timing layer required by the
  question is corroborating, and no equal-rank conflict remains.
- **Moderate** — the primary natal factor and every required varga are
  available, but optional corroboration is incomplete or materially qualified.
- **Tentative** — a required artifact is missing, primary evidence is partial,
  or only lower-layer evidence is available.
- **Mixed** — equal-rank evidence conflicts without a developer tie-breaker.

Confidence describes evidence quality, not a probability.
