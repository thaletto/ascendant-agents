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
} from "astro-ascendant";
import { DateTime, Effect, FileSystem, Path, Schema } from "effect";

import {
  calculationContext,
  decodeMoment,
  KpAstroParamsLayer,
  type Latitude,
  type Longitude,
  type OffsetMoment,
  type PersonName,
  PersonRecordConflict,
  personRecordMatches,
  readLegacyStoredPerson,
  readLegacyToonStoredPerson,
  readStoredPerson,
  type Sex,
  writeToon,
  type StoredPerson,
} from "./common.ts";
import { kpCuspAndPlanetLords } from "./kp-lords.ts";

export interface PersonInitialization {
  readonly person: {
    readonly name: string;
    readonly path: string;
    readonly status: "created" | "refreshed";
  };
  readonly artifacts: {
    readonly charts: number;
    readonly kpCharts: number;
    readonly dashas: number;
    readonly jaimini: number;
  };
}

function formatMemory(storedPerson: StoredPerson): string {
  return [
    "---",
    `name: ${storedPerson.name}`,
    `birth: ${storedPerson.moment}`,
    `latitude: ${storedPerson.latitude}`,
    `longitude: ${storedPerson.longitude}`,
    ...(storedPerson.sex !== undefined ? [`sex: ${storedPerson.sex}`] : []),
    "---",
    "",
  ].join("\n");
}

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

function generatedArtifactFiles(
  path: Path.Path,
  personDirectory: string,
  extension: "json" | "toon",
): ReadonlyArray<string> {
  return [
    path.join(personDirectory, `input.${extension}`),
    path.join(personDirectory, `dasha.${extension}`),
    path.join(personDirectory, `sav.${extension}`),
    path.join(personDirectory, `yoga.${extension}`),
    path.join(personDirectory, "kp", `D1.${extension}`),
    path.join(personDirectory, "kp", `dasha.${extension}`),
    ...Chart.Division.literals.map((division) =>
      path.join(personDirectory, "charts", `D${division}.${extension}`),
    ),
    ...["chara-karakas", "rashi-drishti", "karakamsha", "arudha-padas", "upapada", "argala"].map(
      (artifact) => path.join(personDirectory, "jaimini", `${artifact}.${extension}`),
    ),
  ];
}

export const initializePerson = Effect.fn("Ascendant.initializePerson")(function* (
  storedPerson: StoredPerson,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const personDirectory = path.join("persons", storedPerson.name);
  const inputFile = path.join(personDirectory, "input.txt");
  const legacyToonInputFile = path.join(personDirectory, "input.toon");
  const legacyJsonInputFile = path.join(personDirectory, "input.json");
  const personDirectoryExists = yield* fs.exists(personDirectory);

  if (personDirectoryExists) {
    const inputExists = yield* fs.exists(inputFile);
    const legacyToonInputExists = yield* fs.exists(legacyToonInputFile);
    const legacyJsonInputExists = yield* fs.exists(legacyJsonInputFile);
    if (!inputExists && !legacyToonInputExists && !legacyJsonInputExists) {
      return yield* PersonRecordConflict.make({
        directory: personDirectory,
        message: "The directory already exists but is not an Ascendant person record",
      });
    }

    let current: StoredPerson;
    if (inputExists) {
      current = yield* readStoredPerson(storedPerson.name);
    } else if (legacyToonInputExists) {
      current = yield* readLegacyToonStoredPerson(storedPerson.name);
    } else {
      current = yield* readLegacyStoredPerson(storedPerson.name);
    }
    if (!personRecordMatches(current, storedPerson)) {
      return yield* PersonRecordConflict.make({
        directory: personDirectory,
        message:
          "The person already exists with different birth data; choose another name or move the existing record",
      });
    }
  }

  const birthDate = yield* decodeMoment(storedPerson.moment);
  const birthMoment = Chart.Moment.make({ date: birthDate });
  const chartParams = {
    moment: birthMoment,
    latitude: storedPerson.latitude,
    longitude: storedPerson.longitude,
    ...(storedPerson.sex !== undefined ? { sex: storedPerson.sex } : {}),
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

  const d1 = vedicCalculation.charts[0];
  const kpD1 = kpCalculation.charts[0];
  const lagnaSign = d1.houses[1].sign;
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
      Argala.calculate(placements, {
        kind: "Sign",
        sign: lagnaSign,
      }),
    ],
    { concurrency: "unbounded" },
  );

  const chartsDirectory = path.join(personDirectory, "charts");
  const kpDirectory = path.join(personDirectory, "kp");
  const jaiminiDirectory = path.join(personDirectory, "jaimini");
  const memoryFile = path.join(personDirectory, "MEMORY.md");
  yield* fs.makeDirectory(chartsDirectory, { recursive: true });
  yield* fs.makeDirectory(kpDirectory, { recursive: true });
  yield* fs.makeDirectory(jaiminiDirectory, { recursive: true });
  if (!(yield* fs.exists(memoryFile))) {
    yield* fs.writeFileString(memoryFile, formatMemory(storedPerson));
  }

  const vedicContext = calculationContext("Parashari", vedicCalculation.astroParams);
  const kpContext = calculationContext("KP", kpCalculation.astroParams);
  const kpLords = kpCuspAndPlanetLords(kpD1);

  yield* Effect.all(
    vedicCalculation.charts.map((chart) =>
      writeToon(path.join(chartsDirectory, `D${chart.division}.txt`), {
        calculation: vedicContext,
        chart: Schema.encodeSync(Chart.Chart)(chart),
      }),
    ),
    { concurrency: "unbounded" },
  );

  yield* Effect.all(
    [
      writeToon(inputFile, storedPerson),
      writeToon(path.join(personDirectory, "dasha.txt"), {
        calculation: vedicContext,
        mahadashas: formatDasha(dasha),
      }),
      writeToon(path.join(kpDirectory, "D1.txt"), {
        calculation: kpContext,
        chart: Schema.encodeSync(Chart.Chart)(kpD1),
        cuspLords: kpLords.cuspLords,
        planetLords: kpLords.planetLords,
      }),
      writeToon(path.join(kpDirectory, "dasha.txt"), {
        calculation: kpContext,
        mahadashas: formatDasha(kpDasha),
      }),
      writeToon(path.join(personDirectory, "sav.txt"), sav),
      writeToon(path.join(jaiminiDirectory, "chara-karakas.txt"), charaKarakas),
      writeToon(path.join(jaiminiDirectory, "rashi-drishti.txt"), rashiDrishti),
      writeToon(path.join(jaiminiDirectory, "karakamsha.txt"), karakamsha),
      writeToon(path.join(jaiminiDirectory, "arudha-padas.txt"), arudhaPadas),
      writeToon(path.join(jaiminiDirectory, "upapada.txt"), upapada),
      writeToon(path.join(jaiminiDirectory, "argala.txt"), argala),
    ],
    { concurrency: "unbounded" },
  );

  yield* Effect.all(
    [
      ...generatedArtifactFiles(path, personDirectory, "toon"),
      ...generatedArtifactFiles(path, personDirectory, "json"),
      path.join(personDirectory, "yoga.txt"),
    ].map((file) => fs.remove(file, { force: true })),
    { concurrency: "unbounded" },
  );

  return {
    person: {
      name: storedPerson.name,
      path: personDirectory,
      status: personDirectoryExists ? "refreshed" : "created",
    },
    artifacts: {
      charts: vedicCalculation.charts.length,
      kpCharts: kpCalculation.charts.length,
      dashas: dasha.length,
      jaimini: 6,
    },
  } satisfies PersonInitialization;
});

export const initializePersonFromInput = Effect.fn("Ascendant.initializePersonFromInput")(
  function* (
    name: PersonName,
    moment: OffsetMoment,
    latitude: Latitude,
    longitude: Longitude,
    sex?: Sex,
  ) {
    const birthDate = yield* decodeMoment(moment);
    const storedPerson: StoredPerson = {
      schemaVersion: 1,
      name,
      moment: DateTime.formatIso(birthDate),
      latitude,
      longitude,
      ...(sex !== undefined ? { sex } : {}),
    };

    return yield* initializePerson(storedPerson);
  },
);
