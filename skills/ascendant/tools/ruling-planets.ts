import { Chart } from "astro-ascendant";
import { DateTime, Effect } from "effect";

import {
  calculationContext,
  decodeMoment,
  KpAstroParams,
  type Latitude,
  type Longitude,
  type OffsetMoment,
} from "./common.ts";
import { kpLordChain } from "./kp-lords.ts";

export const rulingPlanetsWorkflow = Effect.fn("Ascendant.rulingPlanets")(function* (
  moment: OffsetMoment,
  latitude: Latitude,
  longitude: Longitude,
) {
  const date = yield* decodeMoment(moment);
  const chartParams = {
    moment: Chart.Moment.make({ date }),
    latitude,
    longitude,
  };
  const calculation = yield* Chart.generate(chartParams, []);
  const d1 = calculation.charts[0];
  if (d1 === undefined) {
    return yield* Effect.fail(new Error("KP chart generation returned no D1"));
  }
  const lagnaLongitude = d1.houses[1].lagna?.longitude;
  if (lagnaLongitude === undefined) {
    return yield* Effect.fail(new Error("KP chart generation returned no Lagna"));
  }
  const planets = Object.values(d1.houses).flatMap((house) => house.planets);
  const moonEntry = planets.find((planet) => planet.name === "Moon");
  if (moonEntry === undefined) {
    return yield* Effect.fail(new Error("KP chart generation returned no Moon"));
  }
  return {
    moment: DateTime.formatIso(date),
    latitude,
    longitude,
    calculation: calculationContext("KP", KpAstroParams),
    rulingPlanets: d1.rulingPlanets,
    ascendant: {
      longitude: lagnaLongitude,
      ...kpLordChain(lagnaLongitude),
    },
    moon: {
      longitude: moonEntry.longitude,
      ...kpLordChain(moonEntry.longitude),
    },
    note: "Day lord follows the UTC weekday; Hindu sunrise-to-sunrise day reckoning (references/kp/birth-time-rectification.md) may differ for moments near sunrise.",
  };
});
