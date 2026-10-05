import {
  Argala,
  ArudhaPada,
  Chart,
  CharaKarakas,
  Dasha,
  Karakamsha,
  RashiDrishti,
  SAV,
  Transit,
  Upapada,
} from "astro-ascendant";
import { DateTime, Effect, Schema } from "effect";

import {
  calculationContext,
  decodeMoment,
  KpAstroParams,
  KpAstroParamsLayer,
  type Latitude,
  type Longitude,
  type OffsetMoment,
  VedicAstroParams,
} from "../skills/ascendant/tools/common.ts";
import { kpCuspAndPlanetLords } from "../skills/ascendant/tools/kp-lords.ts";
import type { Sex } from "../skills/ascendant/tools/contract.ts";

function formatDasha(dashas: Effect.Success<ReturnType<typeof Dasha.calculate>>) {
  return dashas.map((mahadasha) => ({
    ...mahadasha,
    start: DateTime.formatIso(mahadasha.start),
    end: DateTime.formatIso(mahadasha.end),
    antardashas: mahadasha.antardashas.map((antardasha) => ({
      ...antardasha,
      start: DateTime.formatIso(antardasha.start),
      end: DateTime.formatIso(antardasha.end),
    })),
  }));
}

export const computeBirthCharts = Effect.fn("Mcp.computeBirthCharts")(function* (
  moment: OffsetMoment,
  latitude: Latitude,
  longitude: Longitude,
  sex?: Sex,
) {
  const birthDate = yield* decodeMoment(moment);
  const birthMoment = Chart.Moment.make({ date: birthDate });
  const chartParams = {
    moment: birthMoment,
    latitude,
    longitude,
    ...(sex !== undefined ? { sex } : {}),
  };
  const [vedicCalculation, kpCalculation] = yield* Effect.all(
    [
      Chart.generate(chartParams, Chart.Division.literals),
      Chart.generate(chartParams, []).pipe(Effect.provide(KpAstroParamsLayer)),
    ],
    { concurrency: "unbounded" },
  );
  const placements = vedicCalculation.placements;
  const kpPlacements = kpCalculation.placements;
  const [dasha, kpDasha, sav] = yield* Effect.all(
    [
      Dasha.calculate(birthMoment, placements),
      Dasha.calculate(birthMoment, kpPlacements),
      SAV.calculate(placements),
    ],
    { concurrency: "unbounded" },
  );
  const kpD1 = kpCalculation.charts[0];
  if (kpD1 === undefined)
    return yield* Effect.fail(new Error("KP chart generation returned no D1"));
  const d1 = vedicCalculation.charts[0];
  const lagnaSign = d1?.houses[1].sign;
  if (lagnaSign === undefined)
    return yield* Effect.fail(new Error("Vedic chart generation returned no D1"));
  const [charaKarakas, rashiDrishti, karakamsha, arudhaPadas, upapada, argala] = yield* Effect.all(
    [
      CharaKarakas.calculate(placements),
      RashiDrishti.calculate(lagnaSign),
      Karakamsha.calculate(placements),
      Effect.all(
        Chart.Houses.literals.map((house) => ArudhaPada.calculate(placements, house)),
        { concurrency: "unbounded" },
      ),
      Upapada.calculate(placements),
      Argala.calculate(placements, { kind: "Sign", sign: lagnaSign }),
    ],
    { concurrency: "unbounded" },
  );
  const vedicContext = calculationContext("Parashari", vedicCalculation.astroParams);
  const kpContext = calculationContext("KP", kpCalculation.astroParams);
  const kpLords = kpCuspAndPlanetLords(kpD1);
  return {
    moment: DateTime.formatIso(birthDate),
    latitude,
    longitude,
    vedic: {
      calculation: vedicContext,
      charts: vedicCalculation.charts.map((chart) => Schema.encodeSync(Chart.Chart)(chart)),
      dasha: formatDasha(dasha),
      sav,
      jaimini: { charaKarakas, rashiDrishti, karakamsha, arudhaPadas, upapada, argala },
    },
    kp: {
      calculation: kpContext,
      chart: Schema.encodeSync(Chart.Chart)(kpD1),
      cuspLords: kpLords.cuspLords,
      planetLords: kpLords.planetLords,
      dasha: formatDasha(kpDasha),
    },
  };
});

export interface StatelessTransitOptions {
  readonly planet: Chart.Planets;
  readonly direction: Transit.TransitDirection;
  readonly kinds: ReadonlyArray<Transit.TransitKind>;
  readonly count: number;
  readonly targetLongitude?: number;
  readonly house?: Chart.Houses;
  readonly maxYears?: number;
  readonly precisionMinutes?: number;
  readonly school?: "KP" | "Parashari";
}

export const searchTransitsStateless = Effect.fn("Mcp.searchTransitsStateless")(function* (
  birthMoment: OffsetMoment,
  latitude: Latitude,
  longitude: Longitude,
  fromMoment: OffsetMoment,
  options: StatelessTransitOptions,
) {
  const fromDate = yield* decodeMoment(fromMoment);
  const from = Chart.LocatedMoment.make({
    moment: Chart.Moment.make({ date: fromDate }),
    latitude,
    longitude,
  });
  void birthMoment;
  const events = yield* Transit.findTransits({
    planet: options.planet,
    from,
    count: options.count,
    direction: options.direction,
    kinds: [...options.kinds],
    ...(options.targetLongitude !== undefined
      ? { targetLongitude: options.targetLongitude as Chart.Longitude }
      : {}),
    ...(options.house !== undefined ? { house: options.house } : {}),
    ...(options.maxYears !== undefined ? { maxYears: options.maxYears } : {}),
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
    events: events.map((event) => ({
      planet: event.planet,
      moment: DateTime.formatIso(event.moment),
      longitude: Number(event.longitude.toFixed(2)),
      kind: event.kind,
      retrograde: event.is_retrograde,
      direction: event.direction,
    })),
  };
});
