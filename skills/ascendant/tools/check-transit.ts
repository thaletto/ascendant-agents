import { BunRuntime } from "@effect/platform-bun";
import { Chart } from "astro-ascendant";
import { Console, DateTime, Effect, Match } from "effect";
import { Command, Flag } from "effect/unstable/cli";

import {
  AppLayer,
  decodeMoment,
  makeLocatedMoment,
  OffsetMoment,
  PersonName,
  readStoredPerson,
  TOOL_VERSION,
} from "./common.js";

const nameFlag = Flag.string("name").pipe(
  Flag.withDescription("Name of an initialized persons/<name> record"),
  Flag.withSchema(PersonName),
);

const momentFlag = Flag.string("moment").pipe(
  Flag.withDescription("Offset-aware ISO 8601 transit moment"),
  Flag.withSchema(OffsetMoment),
);

function formatDegree(degree: number): string {
  return degree.toFixed(2);
}

function compactChart(at: DateTime.Utc, chart: Chart.Chart) {
  const firstHouse = chart.houses[1];
  const lagna = Match.value(firstHouse.lagna).pipe(
    Match.when(
      Match.null,
      () => firstHouse.sign,
    ),
    Match.when(
      Match.defined,
      (placement) =>
        `${placement.sign.name} ${formatDegree(placement.degree)}`,
    ),
    Match.exhaustive,
  );
  const grahas = Chart.Houses.literals.flatMap((house) =>
    chart.houses[house].planets.map(
      (planet) =>
        `${planet.name}:${planet.sign.name} ${formatDegree(planet.degree)} H${house}${planet.is_retrograde ? " R" : ""}`,
    ),
  );

  return {
    at: DateTime.formatIso(at),
    lagna,
    grahas,
  };
}

const command = Command.make(
  "check-transit",
  {
    name: nameFlag,
    moment: momentFlag,
  },
  Effect.fn("Ascendant.checkTransitCommand")(function* ({ moment, name }) {
    const person = yield* readStoredPerson(name);
    const transitDate = yield* decodeMoment(moment);
    const locatedMoment = makeLocatedMoment(
      transitDate,
      person.latitude,
      person.longitude,
    );
    const calculation = yield* Chart.generate(locatedMoment, [1]);
    const output = compactChart(transitDate, calculation.charts[0]);

    yield* Console.log(JSON.stringify(output));
  }),
).pipe(
  Command.withDescription(
    "Calculate a compact D1 transit chart at a saved person's location",
  ),
);

command.pipe(
  Command.run({ version: TOOL_VERSION }),
  Effect.provide(AppLayer),
  BunRuntime.runMain,
);
