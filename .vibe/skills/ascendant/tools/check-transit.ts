import { Chart, Transit } from "astro-ascendant";
import { DateTime, Effect, Schema } from "effect";

import {
  calculationContext,
  decodeMoment,
  KpAstroParams,
  makeLocatedMoment,
  type OffsetMoment,
  type PersonName,
  readStoredPerson,
  VedicAstroParams,
} from "./common.ts";

export type TransitSchool = "KP" | "Parashari";

export interface TransitSearchOptions {
  readonly planet: Chart.Planets;
  readonly direction: Transit.TransitDirection;
  readonly kinds: ReadonlyArray<Transit.TransitKind>;
  readonly count: number;
  readonly targetLongitude?: number;
  readonly house?: Chart.Houses;
  readonly maxYears?: number;
  readonly precisionMinutes?: number;
  readonly school?: TransitSchool;
}

function formatEvent(event: Transit.TransitEvent) {
  return {
    planet: event.planet,
    moment: DateTime.formatIso(event.moment),
    longitude: Number(event.longitude.toFixed(2)),
    kind: event.kind,
    ...(event.sign !== undefined ? { sign: event.sign } : {}),
    retrograde: event.is_retrograde,
    direction: event.direction,
    provenance: { ...event.provenance },
    ...(event.calculation !== undefined
      ? {
          chart: Schema.encodeSync(Chart.ChartCalculation)(
            event.calculation,
          ),
        }
      : {}),
  };
}

export const searchTransits = Effect.fn("Ascendant.searchTransits")(
  function* (
    name: PersonName,
    moment: OffsetMoment,
    options: TransitSearchOptions,
  ) {
    const person = yield* readStoredPerson(name);
    const fromDate = yield* decodeMoment(moment);
    const from = makeLocatedMoment(
      fromDate,
      person.latitude,
      person.longitude,
    );
    const events = yield* Transit.findTransits({
      planet: options.planet,
      from,
      count: options.count,
      direction: options.direction,
      kinds: [...options.kinds],
      ...(options.targetLongitude !== undefined
        ? {
            targetLongitude: options.targetLongitude as Chart.Longitude,
          }
        : {}),
      ...(options.house !== undefined ? { house: options.house } : {}),
      ...(options.maxYears !== undefined
        ? { maxYears: options.maxYears }
        : {}),
      ...(options.precisionMinutes !== undefined
        ? { precisionMinutes: options.precisionMinutes }
        : {}),
      includeCharts: [1],
    });

    return {
      from: DateTime.formatIso(fromDate),
      calculation: calculationContext(
        options.school ?? "Parashari",
        options.school === "KP" ? KpAstroParams : VedicAstroParams,
      ),
      events: events.map(formatEvent),
    };
  },
);
