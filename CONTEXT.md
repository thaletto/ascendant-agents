# Ascendant

A Vedic (Indian) astrology chart generator. Given a moment and geographic location, it computes the positions of the grahas and the resulting chart. Because positions are computed for arbitrary moments, the same machinery also produces transits.

## Language

**Chart**:
A snapshot of astrological positions arranged into twelve houses. A Rashi or divisional Chart identifies its Division; D1 and the divisional charts are derived from the same Placements.
_Avoid_: Birth wheel, horoscope, kundali (unless the user specifically says these)

**Placements**:
The exact sidereal longitudes and motion states of the Lagna and grahas at a Located Moment. They are the common source from which the D1 and divisional charts are derived; Placements given natal meaning are natal placements.
_Avoid_: D1 chart, raw chart, base chart

**Yoga**:
A named classical formation defined by relationships among grahas, signs, or houses in one or more Charts.
_Avoid_: Yoga calculation, detected Yoga when presence has not been established

**Yoga definition**:
A versioned rule that states the evidence and conditions used to establish one canonical Yoga, together with its classification and a description of its traditionally attributed effect.
_Avoid_: Yoga method, Yoga function, registry entry

**Yoga classification**:
The Positive, Negative, or Neutral interpretive category assigned to a Yoga definition by its rule set.
_Avoid_: Strength, probability, evaluation outcome

**Yoga evaluation**:
The application of one or more Yoga definitions to the relevant Chart evidence.
_Avoid_: Yoga, Yoga detection

**Yoga result**:
The present or absent outcome of evaluating one Yoga definition, together with structured supporting evidence.
_Avoid_: Yoga definition, prediction, guaranteed outcome

**Yoga evidence**:
The chart observations and condition outcomes that explain the cause of a present or absent Yoga result. It belongs to one evaluation and is distinct from the Yoga definition's description of the attributed effect.
_Avoid_: Description, interpretation, strength

**Yoga evidence body**:
A Lagna or graha used as a reference or checked position in typed Yoga evidence. “Body” is limited to this evidence algebra, where one position relationship must support both Lagna and grahas.
_Avoid_: Planet when Lagna is included, node for Rahu or Ketu

**Yoga rule set**:
A named and versioned collection of Yoga definitions whose shared identity is recorded as provenance on its Yoga results.
_Avoid_: Yoga registry, unversioned Yoga catalogue

**Ashtakavarga**:
A classical Parashari scoring system derived from the Rashi positions of the Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, and Lagna in Placements. It produces Bhinnashtakavarga tables, Sarvashtakavarga, reduced Bhinnashtakavarga, and Shodhya Pinda.
_Avoid_: Compatibility score, probability, prediction

**Jaimini**:
A school of Jyotisha containing distinct calculations such as Chara Karakas, Rashi Drishti, Karakamsha, Arudha Padas, Upapada, and Argala. It identifies a method's provenance, not a calculation requested as a whole.
_Avoid_: Jaimini calculation, Jaimini mode, Jaimini core as a user request

**Chara Karakas**:
Seven planetary roles assigned in descending order from the Degrees derived exactly from the classical planets' stored D1 longitudes. Planets at the same position within their Signs jointly hold every role occupied by their tied ranks.
_Avoid_: requesting Jaimini, approximate tie, arbitrary tiebreaker, Rahu tie fallback

**Rashi Drishti**:
The signs influenced by one reference Sign under a Jaimini sign-aspect method.
_Avoid_: Planetary aspect, degree orb, all-sign table as the required result

**Karakamsha**:
The D9 Sign occupied by each planet holding the Atmakaraka role. When tied planets jointly hold Atmakaraka, every corresponding D9 Sign is a Karakamsha result; the supporting Chara Karakas are not returned unless separately requested.
_Avoid_: Another natal chart, implicit Chara Karaka result

**Arudha Pada**:
The projected Sign reached by repeating the distance from one D1 house's Sign to its lord. This plain projection does not include exceptional source-Sign or seventh-Sign adjustments.
_Avoid_: All-house table as the required result, literal status or ownership

**Upapada**:
The Arudha Pada of the twelfth D1 house, available as its own requested calculation.
_Avoid_: Generic Arudha request, another person's intent

**Argala**:
The supporting and obstructing relationships around one explicit reference under an Argala method. A Sign reference uses the ordinary direction, while a Ketu reference uses the reverse direction from Ketu's occupied Sign.
_Avoid_: All-sign table as the required result, deterministic score or prediction

**Bindu**:
A benefic contribution assigned to one Rashi for an assessed Ashtakavarga entity by one contributor. An Ashtakavarga sign score is the number of bindus assigned to that Rashi.
_Avoid_: Degree, longitude, weighted point

**Bhinnashtakavarga / BAV**:
The twelve Rashi scores for one assessed entity, formed from the bindus contributed by the seven classical planets and Lagna. There is one BAV table for each of those eight entities.
_Avoid_: SAV, planetary placement, house score

**Sarvashtakavarga / SAV**:
The twelve Rashi scores formed by adding the seven planetary BAV tables. The Lagna BAV is excluded; under the classical Parashari table the twelve SAV scores total 337.
_Avoid_: Lagna-inclusive total, compatibility score, universal strength

**Reduced Bhinnashtakavarga**:
The seven planetary BAV tables after Trikona reduction followed by Ekadhipatya reduction. It is the basis for Shodhya Pinda and is distinct from raw BAV and SAV.
_Avoid_: Reduced SAV, normalized score

**Shodhya Pinda**:
The weighted total for one classical planet derived from its reduced BAV. It is the sum of Rashi Pinda, which weights signs, and Graha Pinda, which weights the signs occupied by the seven classical planets.
_Avoid_: SAV total, probability, standalone prediction

**Division**:
The identity of a chart within the divisional system, written D1, D2, D3, and so on. D1 identifies the Rashi chart; the other supported values identify divisional charts.
_Avoid_: Chart type, Varga number

**D1 / Rashi chart**:
The sign-based D1 chart derived from Placements. Its twelve houses are counted from the Lagna sign; it is distinct from a Bhava chart.
_Avoid_: Base chart, raw chart

**Divisional chart**:
A sign-based chart derived from Placements by applying the mapping for its Division to the Lagna and grahas. Its twelve houses are counted from the resulting Lagna sign.
_Avoid_: Derived D1, harmonic chart

**Degree**:
A placement's position within its sign, from zero up to but not including thirty degrees. In D1 it is the source degree within the Rashi; in a divisional chart it is the degree produced by the divisional mapping.
_Avoid_: Absolute longitude, source longitude

**Bhava chart**:
A twelve-house cusp representation produced using a configured House system. It assigns each placement to the house whose cusp begins the placement's half-open zodiac interval, exposes the calculation's eight house angles, and is separate from the D1 / Rashi chart and divisional charts.
_Avoid_: D1, Rashi chart

**Bhava house**:
One of the twelve cusp-bounded sections of a Bhava chart. It owns the cusp at its beginning and the placements from that cusp up to, but not including, the next cusp.
_Avoid_: Sign, Rashi, Whole Sign house

**Chart calculation**:
The Placements, D1, requested divisional charts, and configured Bhava chart derived together under the same AstroParams. A Chart calculation always contains D1 and records its AstroParams; one given natal meaning is a natal calculation.
_Avoid_: Chart bundle, chart pack

**Moment**:
The point in time at which planetary positions are computed. It may represent a birth, a transit, or another event. A Moment is separate from configuration: it is per-computation input, not a setting.
_Avoid_: Time, timestamp, epoch (unless you mean something else)

**Located Moment**:
A Moment paired with the latitude and longitude at which Placements are calculated. It is the canonical input for any Chart calculation and may be given natal, transit, or other event meaning.
_Avoid_: Birth, birth data, chart input, event data

**AstroParams**:
The parameters of the astrological computation: ayanamsa and house system. Separate from the Moment and location; the house system applies to a Bhava chart, not to D1 or divisional charts.
_Avoid_: AstroConfig, settings, options, chart config

**Planet**:
A graha's mapped placement in a Chart: its longitude, Degree, sign, dignity, and inherited retrograde state. Its longitude and Degree belong to that Chart's Division; the source nakshatra and pada remain on the Placements from which the Chart was derived.
_Avoid_: Body, celestial body, position

**Nakshatra placement**:
The nakshatra and pada determined by a graha's source sidereal longitude. It belongs to Placements and is not recalculated from a divisional Chart's mapped longitude.
_Avoid_: Divisional nakshatra, Sign nakshatra

**Sign**:
One of the twelve zodiac signs a graha can occupy: its name and lord. A sign spans several nakshatras, so it does not carry a nakshatra itself.
_Avoid_: Rashi, zodiac, star sign

**Relationship direction**:
All chart relationships are one-directional to keep the data small. A House lists its planets; a Planet does not carry a house reference. Connection back from planet to house is derived by scanning the chart.
_Avoid_: Two-way connections, back-references, cycles

**Ayanamsa**:
The sidereal reference frame used to align tropical longitudes to the fixed zodiac. It is selected from the supported predefined methodologies in AstroParams and recorded on each Chart calculation.
_Avoid_: Reference frame, zodiac offset

**House system**:
The method selected in AstroParams for dividing a Bhava chart into twelve houses. It is recorded on each Chart calculation and does not change the sign-based houses of D1 or divisional charts.
_Avoid_: House division, cusps method

**Rahu / Ketu**:
The lunar nodes, grahas that behave like planets in every way except sign ownership: they do not rule a sign.
_Avoid_: Node, shadow planet, Draco
