# Ascendant Jyotisha

This context defines the language for Ascendant's sidereal Jyotisha calculations
and the evidence-grounded readings built from saved birth records.

## Distribution

This repository context is not part of the distributed agent plugin. Plugin
skills must be self-contained or point only to references shipped inside
`plugins/agent/ascendant/`.

**Ascendant ChatGPT app**:
A ChatGPT integration whose MCP server exposes a deliberately bounded Ascendant
service; it is distinct from the locally installed Codex skill plugin.
_Avoid_: calling the local skill bundle a ChatGPT plugin.

**Hosted person record**:
A person record held by the Ascendant service for exactly one authenticated
account. Its account owner can delete it; it is distinct from a local
`persons/<name>` record and is never shared across accounts.
_Avoid_: treating a hosted record as a public chart or a synced local directory.

**Consent attestation**:
The record creator's explicit confirmation that they are permitted to store and
analyze the submitted birth details. It establishes a user assertion, not proof
of the chart subject's identity or consent.
_Avoid_: calling an attestation an identity check or verified consent.

**Reading request**:
An account-scoped request that connects one hosted person record, a topic, and
the user's stated question to the evidence returned for that request. It is not
the user's complete ChatGPT conversation.
_Avoid_: calling a tool request a conversation transcript.

**Evidence bundle**:
A versioned selection of saved natal and timing artifacts returned for a
reading request. It makes a reading traceable to the calculation evidence used
at the time, rather than a newly calculated or inferred replacement.
_Avoid_: calling an evidence bundle a complete chat response.

**Skill resource**:
A read-only, self-contained Ascendant instruction that tells the ChatGPT app
how to select and interpret evidence for one topic. It does not itself hold or
mutate a person's data.
_Avoid_: calling a skill resource an MCP data tool.

**MCP data tool**:
An authenticated operation that creates, retrieves, or deletes account-scoped
Ascendant data and evidence. It does not decide an astrological conclusion.
_Avoid_: placing topic interpretation or an unrestricted database query in a
data tool.

## Chart language

**Natal chart (D1/Rashi)**:
The foundational chart calculated for a person's birth data. It establishes the
natal pattern that later timing and derived-chart analysis must relate back to.
_Avoid_: bare “chart” when the chart type is relevant.

**Divisional chart (Varga)**:
A chart derived from the natal chart for a specific division, such as D9. It is
not a second birth chart and does not change the person's birth data.
_Avoid_: treating a Varga as an independent natal chart.

**Lagna**:
The rising point that anchors the house sequence in a chart.
_Avoid_: using “Ascendant” for the library and the chart point in the same
sentence when the distinction matters.

**Sign (Rashi)**:
One of the twelve zodiacal regions occupied by the Lagna or a planet.
_Avoid_: using “sign” and “house” interchangeably.

**House (Bhava)**:
One of the twelve life-area positions organized around the Lagna or a selected
house system. A house is not automatically the same thing as the sign occupying
it.
_Avoid_: treating a Bhava as a synonym for Rashi outside Whole Sign houses.

## Jaimini core

**Chara Karakas**:
The seven planet roles derived under the saved Jaimini method. A Karaka selects
the planet that carries a topic role in this chart; it does not establish a
literal event or another person's private state. Atmakaraka is the self and
core-direction role; Darakaraka is the partnership role; other roles are read
only when the topic rubric selects them.
_Avoid_: treating a Karaka as a guarantee or substituting one role for another.

**Rashi Drishti**:
Jaimini's sign-to-sign influence. Use the saved sign-aspect map for it.
_Avoid_: importing Parashari planetary aspects or degree orbs.

**Karakamsha**:
The D9 sign occupied by the Atmakaraka. Topic rubrics may derive signs from it.
_Avoid_: treating Karakamsha as a replacement natal chart.

**Arudha Pada**:
The projected or visible expression of a house, calculated by the saved method.
**Upapada** is the twelfth-house Pada used for partnership themes.
_Avoid_: reading either Pada as a literal fact about status, ownership, or
another person's intent.

**Argala**:
The saved support and obstruction around a selected sign or Pada. Read its
contributors and blockers as evidence; the artifact is not a score.
_Avoid_: turning a count of contributors into a deterministic result.

**Parashari-Jaimini comparison**:
When a topic rubric declares both systems co-primary, judge each system by its
own rules before comparing them. Agreement strengthens natal confidence;
equally ranked disagreement remains mixed.
_Avoid_: letting one system silently borrow the other's aspects, significators,
or counting rules.

## Timing and interpretation

**Vimshottari Dasha**:
The planetary timing framework used to describe when natal factors may become
active. Its periods can activate a natal pattern but cannot create one absent
from the natal chart.
_Avoid_: using “Dasha” without naming the timing system when other systems are
under discussion.

**Reading**:
An interpretation of a person's saved chart evidence, expressed with
proportionate uncertainty and practical context. A reading is not itself a
calculation artifact or proof of another person's feelings, consent, diagnosis,
or guaranteed outcome.
_Avoid_: presenting an interpretation as certainty.

**Relationship compatibility reading**:
A consent-attested comparison of two hosted person records using the saved
compatibility method. It identifies astrological patterns, not either person's
feelings, consent, availability, or relationship status.
_Avoid_: treating comparison evidence as proof about another person.

## Saved people

**Person**:
The human subject whose birth data is being examined.
_Avoid_: using “person” to mean the saved directory or calculation bundle.

**Person record**:
A reusable saved bundle representing one person's birth data and the chart,
timing, combination, and supporting results derived from it. Different records
may share a name while representing different birth inputs.
_Avoid_: “profile” when referring to this calculation record.
