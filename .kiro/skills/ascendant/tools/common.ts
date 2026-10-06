import { NodeFileSystem, NodePath } from "@effect/platform-node-shared";
import { decode } from "@toon-format/toon";
import { AstroParams, Chart } from "astro-ascendant";
import * as Swisseph from "astro-ascendant/swisseph";
import { DateTime, Effect, FileSystem, Layer, Path, Schema } from "effect";

import { Latitude, Longitude, OffsetMoment, PersonName, Sex } from "./contract.ts";
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

const NodeServicesLayer: Layer.Layer<FileSystem.FileSystem | Path.Path> = Layer.mergeAll(
  NodeFileSystem.layer,
  NodePath.layer,
);

export const PlatformLayer: Layer.Layer<FileSystem.FileSystem | Path.Path> = NodeServicesLayer;

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

export function calculationContext(school: CalculationSchool, astroParams: AstroParams.Options) {
  return {
    school,
    ayanamsa: astroParams.ayanamsa,
    houseSystem: astroParams.houseSystem,
    dashaSystem: "Vimshottari" as const,
  };
}

export const decodeMoment = Effect.fn("Ascendant.decodeMoment")(function* (input: OffsetMoment) {
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

export function personRecordMatches(left: StoredPerson, right: StoredPerson): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.name === right.name &&
    momentsEqual(left.moment, right.moment) &&
    left.latitude === right.latitude &&
    left.longitude === right.longitude &&
    left.sex === right.sex
  );
}

export const writeMarkdown = Effect.fn("Ascendant.writeMarkdown")(function* (
  file: string,
  content: string,
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(file, content.endsWith("\n") ? content : `${content}\n`);
});

const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---/;

function parseFrontmatterValue(value: string): string | number {
  const trimmed = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

function parseInputFrontmatter(contents: string, inputFile: string) {
  const match = contents.match(FRONTMATTER_PATTERN);
  if (match?.[1] === undefined) {
    return Effect.fail(
      new ToonDecodingError({
        file: inputFile,
        message: "Missing frontmatter in input.md",
      }),
    );
  }
  const fields: Record<string, string | number> = {};
  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const colon = line.indexOf(":");
    if (colon <= 0) continue;
    fields[line.slice(0, colon).trim()] = parseFrontmatterValue(line.slice(colon + 1));
  }
  return Schema.decodeUnknownEffect(StoredPerson)({
    schemaVersion: 1,
    name: fields["name"],
    moment: fields["birth"] ?? fields["moment"],
    latitude: fields["latitude"],
    longitude: fields["longitude"],
    ...(fields["sex"] !== undefined ? { sex: fields["sex"] } : {}),
  }).pipe(
    Effect.mapError(
      (cause) =>
        new ToonDecodingError({
          file: inputFile,
          message: String(cause),
        }),
    ),
  );
}

const readToonStoredPersonFile = Effect.fn("Ascendant.readToonStoredPersonFile")(function* (
  inputFile: string,
) {
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

export const readStoredPerson = Effect.fn("Ascendant.readStoredPerson")(function* (
  name: PersonName,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const inputFile = path.join("persons", name, "input.md");

  if (yield* fs.exists(inputFile)) {
    const contents = yield* fs.readFileString(inputFile);
    return yield* parseInputFrontmatter(contents, inputFile);
  }

  for (const legacy of ["input.txt", "input.toon", "input.json"] as const) {
    const legacyFile = path.join("persons", name, legacy);
    if (yield* fs.exists(legacyFile)) {
      if (legacy === "input.json") {
        const contents = yield* fs.readFileString(legacyFile);
        return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(StoredPerson))(contents);
      }
      return yield* readToonStoredPersonFile(legacyFile);
    }
  }

  return yield* new PersonRecordNotFound({
    file: inputFile,
    message: `No initialized person record exists for ${name}`,
  });
});

export const readLegacyToonStoredPerson = Effect.fn("Ascendant.readLegacyToonStoredPerson")(
  function* (name: PersonName) {
    const path = yield* Path.Path;
    return yield* readToonStoredPersonFile(path.join("persons", name, "input.toon"));
  },
);

export const readLegacyStoredPerson = Effect.fn("Ascendant.readLegacyStoredPerson")(function* (
  name: PersonName,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const inputFile = path.join("persons", name, "input.json");
  const contents = yield* fs.readFileString(inputFile);
  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(StoredPerson))(contents);
});
