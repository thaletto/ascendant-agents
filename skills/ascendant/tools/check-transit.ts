import { Chart } from "astro-ascendant";
import { DateTime, Effect, Match } from "effect";

import {
  decodeMoment,
  makeLocatedMoment,
  type OffsetMoment,
  type PersonName,
  readStoredPerson,
} from "./common.ts";

export interface TransitGraha {
  readonly name: string;
  readonly sign: string;
  readonly degree: number;
  readonly house: number;
  readonly retrograde: boolean;
}

export interface TransitOutput {
  readonly at: string;
  readonly lagna: string;
  readonly grahas: ReadonlyArray<TransitGraha>;
}

function compactChart(at: DateTime.Utc, chart: Chart.Chart): TransitOutput {
  const firstHouse = chart.houses[1];
  const lagna = Match.value(firstHouse.lagna).pipe(
    Match.when(Match.null, () => firstHouse.sign),
    Match.when(
      Match.defined,
      (placement) => `${placement.sign.name} ${placement.degree.toFixed(2)}`,
    ),
    Match.exhaustive,
  );
  const grahas = Chart.Houses.literals.flatMap((house) =>
    chart.houses[house].planets.map((planet) => ({
      name: planet.name,
      sign: planet.sign.name,
      degree: Number(planet.degree.toFixed(2)),
      house,
      retrograde: planet.is_retrograde,
    })),
  );

  return {
    at: DateTime.formatIso(at),
    lagna,
    grahas,
  };
}

export const calculateTransit = Effect.fn("Ascendant.calculateTransit")(
  function* (name: PersonName, moment: OffsetMoment) {
    const person = yield* readStoredPerson(name);
    const transitDate = yield* decodeMoment(moment);
    const locatedMoment = makeLocatedMoment(
      transitDate,
      person.latitude,
      person.longitude,
    );
    const calculation = yield* Chart.generate(locatedMoment, [1]);

    return compactChart(transitDate, calculation.charts[0]);
  },
);
