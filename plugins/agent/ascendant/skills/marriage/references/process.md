# Evidence-grounded judgement process

Use this skill's own process for every interpretation of a saved chart. Each
skill selects the process, its topic rubric, and the saved evidence that
applies. This copy lives inside the skill so a skills.sh install always
includes it.

1. Resolve the request. Require one exact `persons/<name>` directory; require
   two for compatibility. Infer the topic and desired depth from the user's
   natural question. Ask one clarifying question only when the person,
   timeframe, or decision cannot be determined.
   **Complete when:** every record and the question being answered are clear.
2. Resolve timing and presentation. Use transit data only for a time-bound
   question. Retain a supplied ISO 8601 moment; otherwise use the current
   moment in the user's timezone and state it.
   **Complete when:** the timeframe and output mode are explicit.
3. Read [`hierarchy.md`](hierarchy.md), [`artifacts.md`](artifacts.md),
   [`sources.md`](sources.md), and `topic.md` completely.
   **Complete when:** the hierarchy and exactly one topic rubric are loaded.
4. Inspect the saved artifacts directly. Load the record metadata, D1, the
   topic's varga when required, Jaimini core, dasha, present yogas, SAV, and
   provenance as
   directed by the artifact contract. For a time-bound request, obtain dated
   transit positions with the bundled `get-transit` data tool. Never delegate
   interpretive judgement to a script.
   **Complete when:** every available required factor has an artifact pointer,
   and every missing factor is listed.
5. Apply every applicable rule in the topic rubric using the two-axis
   hierarchy. Judge the Parashari and Jaimini natal factors separately, then
   compare them as co-primary evidence. Agreement strengthens the conclusion;
   disagreement remains mixed. Lower timing layers describe activation and do
   not settle a natal conflict. No model-authored exception may alter the hierarchy.
   **Complete when:** each material conclusion has governing evidence,
   modifiers, conflicts, and one qualitative confidence label.
6. Answer the user's actual question in this order: **Direct answer** in
   everyday language; a short **Why** that translates only the decisive
   patterns; practical guidance; then a compact **Evidence** note with artifact
   pointers and source locators. Keep rule IDs, ranks, degrees, and untranslated
   technical terms in the Evidence note unless the user asks for the mechanics.
   Define an essential term once in plain language. Use `Ascendant methodology`
   for developer rules without an external locator. Personal context may shape
   practical guidance but never masquerades as chart evidence.
   **Complete when:** the response is useful without the Evidence note and every
   material conclusion remains traceable through it.
7. When data is missing, provide a bounded partial reading: name the missing
   artifact, omit dependent factors, lower confidence, and state what remains
   unresolved. Generate missing data only when the user asks.
   **Complete when:** every limitation changes the scope or confidence of the
   answer.
