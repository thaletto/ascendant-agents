import { BunRuntime } from "@effect/platform-bun";
import {
  Argala,
  ArudhaPada,
  Chart,
  CharaKarakas,
  Dasha,
  Karakamsha,
  RashiDrishti,
  SAV,
  Upapada,
  Yoga,
} from "astro-ascendant";
import {
  Console,
  DateTime,
  Effect,
  FileSystem,
  Path,
} from "effect";
import { Command, Flag } from "effect/unstable/cli";

import {
  AppLayer,
  decodeMoment,
  Latitude,
  Longitude,
  makeLocatedMoment,
  OffsetMoment,
  PersonName,
  PersonRecordConflict,
  personRecordMatches,
  readStoredPerson,
  TOOL_VERSION,
  writeJson,
  type StoredPerson,
} from "./common.js";

const nameFlag = Flag.string("name").pipe(
  Flag.withDescription("Person name and saved-record directory name"),
  Flag.withSchema(PersonName),
);

const momentFlag = Flag.string("moment").pipe(
  Flag.withDescription("Offset-aware ISO 8601 birth moment"),
  Flag.withSchema(OffsetMoment),
);

const latitudeFlag = Flag.float("latitude").pipe(
  Flag.withDescription("Birth latitude from -90 to 90"),
  Flag.withSchema(Latitude),
);

const longitudeFlag = Flag.float("longitude").pipe(
  Flag.withDescription("Birth longitude from -180 to 180"),
  Flag.withSchema(Longitude),
);

function formatDasha(
  dashas: Effect.Success<ReturnType<typeof Dasha.calculate>>,
) {
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

const initializePerson = Effect.fn("Ascendant.initializePerson")(function* (
  storedPerson: StoredPerson,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const personDirectory = path.join("persons", storedPerson.name);
  const inputFile = path.join(personDirectory, "input.json");
  const personDirectoryExists = yield* fs.exists(personDirectory);

  if (personDirectoryExists) {
    if (!(yield* fs.exists(inputFile))) {
      return yield* new PersonRecordConflict({
        directory: personDirectory,
        message:
          "The directory already exists but is not an Ascendant person record",
      });
    }

    const current = yield* readStoredPerson(storedPerson.name);
    if (!personRecordMatches(current, storedPerson)) {
      return yield* new PersonRecordConflict({
        directory: personDirectory,
        message:
          "The person already exists with different birth data; choose another name or move the existing record",
      });
    }
  }

  const birthDate = yield* decodeMoment(storedPerson.moment);
  const locatedMoment = makeLocatedMoment(
    birthDate,
    storedPerson.latitude,
    storedPerson.longitude,
  );
  const calculation = yield* Chart.generate(
    locatedMoment,
    Chart.Division.literals,
  );
  const placements = calculation.placements;
  const birthMoment = locatedMoment.moment;

  const [dasha, sav, yoga] = yield* Effect.all(
    [
      Dasha.calculate(birthMoment, placements),
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
    arudhaPadas,
    upapada,
    argala,
  ] = yield* Effect.all(
    [
      CharaKarakas.calculate(placements),
      RashiDrishti.calculate(lagnaSign),
      Karakamsha.calculate(placements),
      Effect.all(
        Chart.Houses.literals.map((house) =>
          ArudhaPada.calculate(placements, house),
        ),
        { concurrency: "unbounded" },
      ),
      Upapada.calculate(placements),
      Argala.calculate(placements, {
        kind: "Sign",
        sign: lagnaSign,
      }),
    ],
    { concurrency: "unbounded" },
  );

  const chartsDirectory = path.join(personDirectory, "charts");
  const jaiminiDirectory = path.join(personDirectory, "jaimini");
  yield* fs.makeDirectory(chartsDirectory, { recursive: true });
  yield* fs.makeDirectory(jaiminiDirectory, { recursive: true });

  yield* Effect.all(
    calculation.charts.map((chart) =>
      writeJson(
        path.join(chartsDirectory, `D${chart.division}.json`),
        chart,
      ),
    ),
    { concurrency: "unbounded" },
  );

  yield* Effect.all(
    [
      writeJson(inputFile, storedPerson),
      writeJson(path.join(personDirectory, "dasha.json"), formatDasha(dasha)),
      writeJson(path.join(personDirectory, "sav.json"), sav),
      writeJson(path.join(personDirectory, "yoga.json"), {
        provenance: yoga.provenance,
        results: yoga.results.filter((result) => result.present),
      }),
      writeJson(
        path.join(jaiminiDirectory, "chara-karakas.json"),
        charaKarakas,
      ),
      writeJson(
        path.join(jaiminiDirectory, "rashi-drishti.json"),
        rashiDrishti,
      ),
      writeJson(
        path.join(jaiminiDirectory, "karakamsha.json"),
        karakamsha,
      ),
      writeJson(
        path.join(jaiminiDirectory, "arudha-padas.json"),
        arudhaPadas,
      ),
      writeJson(path.join(jaiminiDirectory, "upapada.json"), upapada),
      writeJson(path.join(jaiminiDirectory, "argala.json"), argala),
    ],
    { concurrency: "unbounded" },
  );

  yield* Console.log(personDirectory);
});

const command = Command.make(
  "init-person",
  {
    name: nameFlag,
    moment: momentFlag,
    latitude: latitudeFlag,
    longitude: longitudeFlag,
  },
  Effect.fn("Ascendant.initPersonCommand")(function* ({
    latitude,
    longitude,
    moment,
    name,
  }) {
    const birthDate = yield* decodeMoment(moment);
    const storedPerson: StoredPerson = {
      schemaVersion: 1,
      name,
      moment: DateTime.formatIso(birthDate),
      latitude,
      longitude,
    };

    yield* initializePerson(storedPerson);
  }),
).pipe(
  Command.withDescription(
    "Create a complete persons/<name> Ascendant calculation record",
  ),
);

command.pipe(
  Command.run({ version: TOOL_VERSION }),
  Effect.provide(AppLayer),
  BunRuntime.runMain,
);
