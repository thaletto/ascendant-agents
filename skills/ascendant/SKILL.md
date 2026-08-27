---
name: ascendant
description: Answer Vedic astrology readings and timing questions from a saved person record. Use when the user asks for an astrology interpretation, timing, chart calculation, person initialization, or transit check.
---

# Ascendant

Use computed artifacts as evidence. Give the conclusion first; separate calculation facts from interpretation; express timing as a supported window, never a guarantee. Known facts, consent, availability, safety, and professional medical, legal, and financial evidence outrank astrological interpretation.

Reframe fixed questions: preserve the underlying concern, then answer through chart-supported qualities, patterns, choices, or preparation, with tendencies and confidence limits.

Person records live in the project at `persons/<name>/`.

## Person memory

The user record is the active person record that the user identifies as their own.

When the user provides or corrects a personal fact, update the user record's `MEMORY.md` in the same turn. Read the file before editing it. Preserve its YAML frontmatter. Record only facts that the user directly states or confirms. Replace an outdated or contradictory fact with the current fact. Keep generated interpretations and unconfirmed information outside the memory.

Write the memory body in ASD-STE100 Simplified Technical English:

- Use active voice and simple tenses.
- Use the same word for the same meaning.
- Start each saved fact with the Markdown bullet marker `* `.
- Write one complete fact sentence in each bullet.
- Use no more than 25 words in each sentence.
- Use literal language without idioms.

## Session flow

1. At session start, resolve the active person record and its ownership. Ask which record belongs to the user when ownership is unclear. Complete this step when the active record and its ownership are known.
2. Locate `persons/<name>/`. When it is absent or dependencies are unavailable, read [setup.md](setup.md), obtain exact birth input, and initialize the record. Complete this step when the person record is ready.
3. When the active record belongs to the user, read its `MEMORY.md` before chart analysis. Complete this step when every current memory fact is in context.
4. When the user provides or corrects a personal fact, apply the person-memory rules before chart analysis. Complete this step when the frontmatter is unchanged and the memory contains one current version of the fact.
5. Resolve the outcome and relevant time horizon. Ask for the outcome when a question such as “When will I get…?” leaves it unstated.
6. Read [the judgement hierarchy](references/judgement-hierarchy.md). Then read `charts/D1.json` and every artifact relevant to the question: the applicable divisional chart, `dasha.json`, relevant `yoga.json` and `jaimini/` results, and `sav.json` as supporting strength.
7. For a named date, present question, or narrow timing trigger, run `ascendant_check_transit` when available; otherwise run `scripts/check-transit.sh`. Run it once per cited moment and treat its stdout as the transit evidence.
8. Form each insight independently from a source fact. Reconcile corroboration and opposition with the hierarchy. Complete this step only when every relevant available artifact is either used or explicitly excluded.
9. Answer the question, then give the strongest evidence, meaningful counterevidence, any supported timing window, and confidence limits. Cite the artifact path beside each calculation claim.
