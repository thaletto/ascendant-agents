---
name: ascendant
description: Answer Vedic astrology readings and timing questions from a saved person record. Use when the user asks for an astrology interpretation, timing, chart calculation, person initialization, or transit check.
---

# Ascendant

Use computed artifacts as evidence. Give the conclusion first; separate calculation facts from interpretation; express timing as a supported window, never a guarantee. Known facts, consent, availability, safety, and professional medical, legal, and financial evidence outrank astrological interpretation.

Reframe fixed questions: preserve the underlying concern, then answer through chart-supported qualities, patterns, choices, or preparation, with tendencies and confidence limits.

Person records live in the project at `persons/<name>/`.

## Reading flow

1. Resolve the person, outcome, and relevant time horizon. Ask for the outcome when a question such as “When will I get…?” leaves it unstated.
2. Locate `persons/<name>/`. When it is absent or dependencies are unavailable, read [setup.md](setup.md), obtain exact birth input, and initialize the record.
3. Read [the judgement hierarchy](references/judgement-hierarchy.md). Then read `charts/D1.json` and every artifact relevant to the question: the applicable divisional chart, `dasha.json`, relevant `yoga.json` and `jaimini/` results, and `sav.json` as supporting strength.
4. For a named date, present question, or narrow timing trigger, run `ascendant_check_transit` when available; otherwise run `scripts/check-transit.sh`. Run it once per cited moment and treat its stdout as the transit evidence.
5. Form each insight independently from a source fact. Reconcile corroboration and opposition with the hierarchy. Complete this step only when every relevant available artifact is either used or explicitly excluded.
6. Answer the question, then give the strongest evidence, meaningful counterevidence, any supported timing window, and confidence limits. Cite the artifact path beside each calculation claim.
