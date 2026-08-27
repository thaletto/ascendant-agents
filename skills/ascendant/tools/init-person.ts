import {
  Argala,
  ArudhaPada,
  AstroParams,
  Chart,
  CharaKarakas,
  Dasha,
  Karakamsha,
  RashiDrishti,
  SAV,
  Upapada,
  Yoga,
} from "astro-ascendant";
import * as Swisseph from "astro-ascendant/swisseph";

import {
  NodeFileSystem,
  NodePath,
  NodeRuntime,
} from "@effect/platform-node";

import {
  Console,
  DateTime,
  Effect,
  FileSystem,
  Layer,
  Path,
} from "effect";

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const [name, date, latitudeArg, longitudeArg] = process.argv.slice(2);

  if (!name || !date || !latitudeArg || !longitudeArg) {
    return yield* Effect.fail(
      new Error(
        'Usage: npx tsx generate.ts "<name>" "<datetime>" <latitude> <longitude>',
      ),
    );
  }

  const latitude = Number(latitudeArg);
  const longitude = Number(longitudeArg);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return yield* Effect.fail(
      new Error("Latitude and longitude must be valid numbers"),
    );
  }

  const moment = Chart.Moment.make({
    date: DateTime.makeUnsafe(date),
  });

  const input = Chart.LocatedMoment.make({
    moment,
    latitude,
    longitude,
  });

  const personDir = path.join("persons", name);
  const chartsDir = path.join(personDir, "charts");

  yield* fs.makeDirectory(chartsDir, {
    recursive: true,
  });

  const calculation = yield* Chart.generate(
    input,
    Chart.Division.literals,
  );

  const placements = calculation.placements;

  const [dasha, sav, yoga] = yield* Effect.all(
    [
      Dasha.calculate(moment, placements),
      SAV.calculate(placements),
      Yoga.evaluateAll(calculation),
    ],
    { concurrency: "unbounded" },
  );

  const d1 = calculation.charts[0];
  const lagnaSign = d1.houses[1].sign;

  const [
    charaKarakas,
    rashiDrishti,
    karakamsha,
    arudhaLagna,
    upapada,
    argala,
  ] = yield* Effect.all(
    [
      CharaKarakas.calculate(placements),
      RashiDrishti.calculate(lagnaSign),
      Karakamsha.calculate(placements),
      ArudhaPada.calculate(placements, 1),
      Upapada.calculate(placements),
      Argala.calculate(placements, {
        kind: "Sign",
        sign: lagnaSign,
      }),
    ],
    { concurrency: "unbounded" },
  );

  const jaimini = {
    charaKarakas,
    rashiDrishti,
    karakamsha,
    arudhaLagna,
    upapada,
    argala,
  };

  const dashaJson = dasha.map((mahadasha) => ({
    ...mahadasha,
    start: DateTime.formatIso(mahadasha.start),
    end: DateTime.formatIso(mahadasha.end),

    antardashas: mahadasha.antardashas.map((antardasha) => ({
      ...antardasha,
      start: DateTime.formatIso(antardasha.start),
      end: DateTime.formatIso(antardasha.end),
    })),
  }));

  const writeJson = (file: string, value: unknown) =>
    fs.writeFileString(
      file,
      JSON.stringify(value, null, 2),
    );

  yield* Effect.all(
    calculation.charts.map((chart) =>
      writeJson(
        path.join(chartsDir, `D${chart.division}.json`),
        chart,
      ),
    ),
    { concurrency: "unbounded" },
  );

  yield* Effect.all(
    [
      writeJson(path.join(personDir, "dasha.json"), dashaJson),
      writeJson(path.join(personDir, "sav.json"), sav),
      writeJson(path.join(personDir, "yoga.json"), yoga),
      writeJson(path.join(personDir, "jaimini.json"), jaimini),
    ],
    { concurrency: "unbounded" },
  );

  yield* Console.log(`Generated: ${personDir}`);
});

const AppLayer = Layer.mergeAll(
  AstroParams.DefaultAstroParams,
  Swisseph.SwissephLayer,
  NodeFileSystem.layer,
  NodePath.layer,
);

NodeRuntime.runMain(
  program.pipe(
    Effect.provide(AppLayer),
  ),
);