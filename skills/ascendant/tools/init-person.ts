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
import { DateTime, Effect, FileSystem, Path } from "effect";

import {
  decodeMoment,
  type Latitude,
  type Longitude,
  makeLocatedMoment,
  type OffsetMoment,
  type PersonName,
  PersonRecordConflict,
  personRecordMatches,
  readLegacyStoredPerson,
  readStoredPerson,
  writeToon,
  type StoredPerson,
} from "./common.ts";

export interface PersonInitialization {
  readonly person: {
    readonly name: string;
    readonly path: string;
    readonly status: "created" | "refreshed";
  };
  readonly artifacts: {
    readonly charts: number;
    readonly dashas: number;
    readonly jaimini: number;
    readonly yogas: number;
  };
}

function formatMemory(storedPerson: StoredPerson): string {
  return [
    "---",
    `name: ${storedPerson.name}`,
    `birth: ${storedPerson.moment}`,
    `latitude: ${storedPerson.latitude}`,
    `longitude: ${storedPerson.longitude}`,
    "---",
    "",
  ].join("\n");
}

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

function legacyArtifactFiles(
  path: Path.Path,
  personDirectory: string,
): ReadonlyArray<string> {
  return [
    path.join(personDirectory, "input.json"),
    path.join(personDirectory, "dasha.json"),
    path.join(personDirectory, "sav.json"),
    path.join(personDirectory, "yoga.json"),
    ...Chart.Division.literals.map((division) =>
      path.join(personDirectory, "charts", `D${division}.json`),
    ),
    ...[
      "chara-karakas",
      "rashi-drishti",
      "karakamsha",
      "arudha-padas",
      "upapada",
      "argala",
    ].map((artifact) =>
      path.join(personDirectory, "jaimini", `${artifact}.json`),
    ),
  ];
}

export const initializePerson = Effect.fn("Ascendant.initializePerson")(
  function* (storedPerson: StoredPerson) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const personDirectory = path.join("persons", storedPerson.name);
    const inputFile = path.join(personDirectory, "input.toon");
    const legacyInputFile = path.join(personDirectory, "input.json");
    const personDirectoryExists = yield* fs.exists(personDirectory);

    if (personDirectoryExists) {
      const inputExists = yield* fs.exists(inputFile);
      const legacyInputExists = yield* fs.exists(legacyInputFile);
      if (!inputExists && !legacyInputExists) {
        return yield* new PersonRecordConflict({
          directory: personDirectory,
          message:
            "The directory already exists but is not an Ascendant person record",
        });
      }

      const current = inputExists
        ? yield* readStoredPerson(storedPerson.name)
        : yield* readLegacyStoredPerson(storedPerson.name);
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
    const memoryFile = path.join(personDirectory, "MEMORY.md");
    const presentYogas = yoga.results.filter((result) => result.present);
    yield* fs.makeDirectory(chartsDirectory, { recursive: true });
    yield* fs.makeDirectory(jaiminiDirectory, { recursive: true });
    if (!(yield* fs.exists(memoryFile))) {
      yield* fs.writeFileString(memoryFile, formatMemory(storedPerson));
    }

    yield* Effect.all(
      calculation.charts.map((chart) =>
        writeToon(
          path.join(chartsDirectory, `D${chart.division}.toon`),
          chart,
        ),
      ),
      { concurrency: "unbounded" },
    );

    yield* Effect.all(
      [
        writeToon(inputFile, storedPerson),
        writeToon(path.join(personDirectory, "dasha.toon"), formatDasha(dasha)),
        writeToon(path.join(personDirectory, "sav.toon"), sav),
        writeToon(path.join(personDirectory, "yoga.toon"), {
          provenance: yoga.provenance,
          results: presentYogas,
        }),
        writeToon(
          path.join(jaiminiDirectory, "chara-karakas.toon"),
          charaKarakas,
        ),
        writeToon(
          path.join(jaiminiDirectory, "rashi-drishti.toon"),
          rashiDrishti,
        ),
        writeToon(
          path.join(jaiminiDirectory, "karakamsha.toon"),
          karakamsha,
        ),
        writeToon(
          path.join(jaiminiDirectory, "arudha-padas.toon"),
          arudhaPadas,
        ),
        writeToon(path.join(jaiminiDirectory, "upapada.toon"), upapada),
        writeToon(path.join(jaiminiDirectory, "argala.toon"), argala),
      ],
      { concurrency: "unbounded" },
    );

    yield* Effect.all(
      legacyArtifactFiles(path, personDirectory).map((file) =>
        fs.remove(file, { force: true }),
      ),
      { concurrency: "unbounded" },
    );

    return {
      person: {
        name: storedPerson.name,
        path: personDirectory,
        status: personDirectoryExists ? "refreshed" : "created",
      },
      artifacts: {
        charts: calculation.charts.length,
        dashas: dasha.length,
        jaimini: 6,
        yogas: presentYogas.length,
      },
    } satisfies PersonInitialization;
  },
);

export const initializePersonFromInput = Effect.fn(
  "Ascendant.initializePersonFromInput",
)(function* (
  name: PersonName,
  moment: OffsetMoment,
  latitude: Latitude,
  longitude: Longitude,
) {
  const birthDate = yield* decodeMoment(moment);
  const storedPerson: StoredPerson = {
    schemaVersion: 1,
    name,
    moment: DateTime.formatIso(birthDate),
    latitude,
    longitude,
  };

  return yield* initializePerson(storedPerson);
});
