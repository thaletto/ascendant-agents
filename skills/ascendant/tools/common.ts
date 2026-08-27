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

export const PersonName = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(/^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,79}$/u, {
      message:
        "Use 1-80 letters, numbers, spaces, apostrophes, periods, or hyphens",
    }),
  ),
  Schema.brand("PersonName"),
);
export type PersonName = typeof PersonName.Type;

export const OffsetMoment = Schema.String.pipe(
  Schema.check(
    Schema.isPattern(
      /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/,
      {
        message:
          "Use an ISO 8601 moment with Z or an explicit UTC offset",
      },
    ),
  ),
);
export type OffsetMoment = typeof OffsetMoment.Type;

export const Latitude = Schema.Finite.pipe(
  Schema.check(Schema.isBetween({ minimum: -90, maximum: 90 })),
  Schema.brand("Latitude"),
);
export type Latitude = typeof Latitude.Type;

export const Longitude = Schema.Finite.pipe(
  Schema.check(Schema.isBetween({ minimum: -180, maximum: 180 })),
  Schema.brand("Longitude"),
);
export type Longitude = typeof Longitude.Type;

export const StoredPerson = Schema.Struct({
  schemaVersion: Schema.Literal(1),
  name: PersonName,
  moment: OffsetMoment,
  latitude: Latitude,
  longitude: Longitude,
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

export const AppLayer = Layer.mergeAll(
  PlatformLayer,
  AstroParams.DefaultAstroParams,
  Swisseph.SwissephLayer,
);

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

export function personRecordMatches(
  left: StoredPerson,
  right: StoredPerson,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.name === right.name &&
    left.moment === right.moment &&
    left.latitude === right.latitude &&
    left.longitude === right.longitude
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

export const readStoredPerson = Effect.fn("Ascendant.readStoredPerson")(
  function* (name: PersonName) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const inputFile = path.join("persons", name, "input.toon");

    if (!(yield* fs.exists(inputFile))) {
      return yield* new PersonRecordNotFound({
        file: inputFile,
        message: `No initialized person record exists for ${name}`,
      });
    }

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
  },
);

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
