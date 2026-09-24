import {
  NodeFileSystem,
  NodePath,
} from "@effect/platform-node-shared";
import { decode, encode } from "@toon-format/toon";
import { AstroParams, Chart } from "astro-ascendant";
import * as Swisseph from "astro-ascendant/swisseph";
import {
  DateTime,
  Effect,
  FileSystem,
  Layer,
  Path,
  Schema,
} from "effect";

import {
  Latitude,
  Longitude,
  OffsetMoment,
  PersonName,
  Sex,
} from "./contract.ts";
export { Latitude, Longitude, OffsetMoment, PersonName, Sex };

export const StoredPerson = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  name: PersonName,
  moment: OffsetMoment,
  latitude: Latitude,
  longitude: Longitude,
  sex: Schema.optional(Sex),
});
export type StoredPerson = typeof StoredPerson.Type;

export class PersonRecordNotFound extends Schema.TaggedError<PersonRecordNotFound>()(
  "PersonRecordNotFound",
  {
    file: Schema.String,
    message: Schema.String,
  },
) {}

export class PersonRecordConflict extends Schema.TaggedError<PersonRecordConflict>()(
  "PersonRecordConflict",
  {
    directory: Schema.String,
    message: Schema.String,
  },
) {}

export class ToonEncodingError extends Schema.TaggedError<ToonEncodingError>()(
  "ToonEncodingError",
  {
    file: Schema.String,
    message: Schema.String,
  },
) {}

export class ToonDecodingError extends Schema.TaggedError<ToonDecodingError>()(
  "ToonDecodingError",
  {
    file: Schema.String,
    message: Schema.String,
  },
) {}

const NodeServicesLayer: Layer.Layer<FileSystem.FileSystem | Path.Path> =
  Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

export const PlatformLayer: Layer.Layer<FileSystem.FileSystem | Path.Path> =
  NodeServicesLayer;

export const VedicAstroParams = AstroParams.Options.make({
  ayanamsa: "Lahiri",
  houseSystem: "WholeSign",
});

export const KpAstroParams = AstroParams.Options.make({
  ayanamsa: "KrishnamurtiVP291",
  houseSystem: "Placidus",
});

export const VedicAstroParamsLayer = AstroParams.layer(VedicAstroParams);
export const KpAstroParamsLayer = AstroParams.layer(KpAstroParams);

export const AppLayer = Layer.mergeAll(
  PlatformLayer,
  VedicAstroParamsLayer,
  Swisseph.SwissephLayer,
);

export type CalculationSchool = "Parashari" | "KP";
export type CalculationContext = ReturnType<typeof calculationContext>;

export function calculationContext(
  school: CalculationSchool,
  astroParams: AstroParams.Options,
) {
  return {
    school,
    ayanamsa: astroParams.ayanamsa,
    houseSystem: astroParams.houseSystem,
    dashaSystem: "Vimshottari" as const,
  };
}

export const decodeMoment = Effect.fn("Ascendant.decodeMoment")(function* (
  input: OffsetMoment,
) {
  return yield* Schema.decodeUnknownEffect(Schema.DateTimeUtcFromString)(input);
});

export function makeLocatedMoment(
  date: DateTime.Utc,
  latitude: Latitude,
  longitude: Longitude,
): Chart.LocatedMoment {
  return Chart.LocatedMoment.make({
    moment: Chart.Moment.make({ date }),
    latitude,
    longitude,
  });
}

function momentsEqual(left: OffsetMoment, right: OffsetMoment): boolean {
  if (left === right) return true;
  try {
    const leftDate = Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)(left);
    const rightDate = Schema.decodeUnknownSync(Schema.DateTimeUtcFromString)(right);
    return DateTime.Equivalence(leftDate, rightDate);
  } catch {
    return false;
  }
}

export function personRecordMatches(
  left: StoredPerson,
  right: StoredPerson,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.name === right.name &&
    momentsEqual(left.moment, right.moment) &&
    left.latitude === right.latitude &&
    left.longitude === right.longitude &&
    left.sex === right.sex
  );
}

export const writeToon = Effect.fn("Ascendant.writeToon")(function* (
  file: string,
  value: unknown,
) {
  const fs = yield* FileSystem.FileSystem;
  const toon = yield* Effect.try({
    try: () => `${encode(value)}\n`,
    catch: (cause) =>
      new ToonEncodingError({
        file,
        message: String(cause),
      }),
  });

  yield* fs.writeFileString(file, toon);
});

const readToonStoredPersonFile = Effect.fn(
  "Ascendant.readToonStoredPersonFile",
)(function* (inputFile: string) {
  const fs = yield* FileSystem.FileSystem;
  const contents = yield* fs.readFileString(inputFile);
  const decoded = yield* Effect.try({
    try: () => decode(contents),
    catch: (cause) =>
      new ToonDecodingError({
        file: inputFile,
        message: String(cause),
      }),
  });
  return yield* Schema.decodeUnknownEffect(StoredPerson)(decoded);
});

export const readStoredPerson = Effect.fn("Ascendant.readStoredPerson")(
  function* (name: PersonName) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const inputFile = path.join("persons", name, "input.txt");

    if (!(yield* fs.exists(inputFile))) {
      return yield* new PersonRecordNotFound({
        file: inputFile,
        message: `No initialized person record exists for ${name}`,
      });
    }

    return yield* readToonStoredPersonFile(inputFile);
  },
);

export const readLegacyToonStoredPerson = Effect.fn(
  "Ascendant.readLegacyToonStoredPerson",
)(function* (name: PersonName) {
  const path = yield* Path.Path;
  return yield* readToonStoredPersonFile(
    path.join("persons", name, "input.toon"),
  );
});

export const readLegacyStoredPerson = Effect.fn(
  "Ascendant.readLegacyStoredPerson",
)(function* (name: PersonName) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const inputFile = path.join("persons", name, "input.json");
  const contents = yield* fs.readFileString(inputFile);
  return yield* Schema.decodeUnknownEffect(
    Schema.fromJsonString(StoredPerson),
  )(contents);
});
