import { encode } from "@toon-format/toon";
import { Chart, Transit } from "astro-ascendant";
import { AxiError, exitCodeForError } from "axi-sdk-js";
import { Effect, FileSystem, Match, Path, Schema } from "effect";

import { searchTransits } from "./check-transit.ts";
import {
  AppLayer,
  Latitude,
  Longitude,
  OffsetMoment,
  PersonName,
  PersonRecordConflict,
  PersonRecordNotFound,
  PlatformLayer,
  Sex,
} from "./common.ts";
import { initializePersonFromInput } from "./init-person.ts";

const DESCRIPTION = "Calculate saved Vedic astrology records and search transits";
const INIT_PERSON_HELP =
  "Run `ascendant init-person --name \"<name>\" --moment \"<ISO-8601>\" --latitude <latitude> --longitude <longitude> [--sex Male|Female]`";
const TRANSIT_HELP =
  "Run `ascendant transit --name \"<name>\" --moment \"<ISO-8601>\" --planet <graha> [--direction forward|backward] [--kinds sign-ingress,...] [--count <1-100>] [--target-longitude <0-360>] [--house <1-12>] [--max-years <years>] [--precision-minutes <minutes>]`";
const TOP_LEVEL_HELP = `${encode({
  command: "ascendant",
  description: DESCRIPTION,
  commands: [
    {
      name: "init-person",
      description: "Create or refresh Vedic charts plus a separate KP D1",
    },
    {
      name: "transit",
      description: "Search upcoming or past transit events for a saved person",
    },
  ],
  help: ["Run `ascendant <command> --help` for command flags and examples"],
})}\n`;

interface ParsedFlags {
  readonly [name: string]: string;
}

const TransitCommandInput = Schema.Struct({
  name: PersonName,
  moment: OffsetMoment,
  planet: Chart.Planets,
  direction: Schema.optional(Transit.TransitDirection),
  kinds: Schema.optional(Schema.String),
  count: Schema.optional(Schema.Finite),
  targetLongitude: Schema.optional(Schema.Finite),
  house: Schema.optional(Chart.Houses),
  maxYears: Schema.optional(Schema.Finite),
  precisionMinutes: Schema.optional(Schema.Finite),
});

interface TransitCommandInput extends Schema.Schema.Type<
  typeof TransitCommandInput
> {}

const InitPersonCommandInput = Schema.Struct({
  name: PersonName,
  moment: OffsetMoment,
  latitude: Latitude,
  longitude: Longitude,
  sex: Schema.optional(Sex),
});

interface InitPersonCommandInput extends Schema.Schema.Type<
  typeof InitPersonCommandInput
> {}

function parseFlags(
  command: string,
  args: ReadonlyArray<string>,
  allowed: ReadonlyArray<string>,
  required: ReadonlyArray<string>,
  help: string,
): ParsedFlags {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    if (flag === undefined || !flag.startsWith("--")) {
      throw new AxiError(
        `Unexpected argument for ${command}: ${flag ?? ""}`,
        "VALIDATION_ERROR",
        [help],
      );
    }
    if (!allowed.includes(flag)) {
      throw new AxiError(
        `Unknown flag for ${command}: ${flag}`,
        "VALIDATION_ERROR",
        [`Valid flags: ${allowed.join(", ")}`, help],
      );
    }

    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new AxiError(
        `Missing value for flag: ${flag}`,
        "VALIDATION_ERROR",
        [help],
      );
    }
    if (parsed[flag] !== undefined) {
      throw new AxiError(
        `Duplicate flag: ${flag}`,
        "VALIDATION_ERROR",
        [help],
      );
    }
    parsed[flag] = value;
  }

  for (const flag of required) {
    if (parsed[flag] === undefined) {
      throw new AxiError(
        `Missing required flag: ${flag}`,
        "VALIDATION_ERROR",
        [help],
      );
    }
  }

  return parsed;
}

function flagValue(parsed: ParsedFlags, name: string): string {
  const value = parsed[name];
  if (value !== undefined) return value;
  throw new AxiError(`Missing required flag: ${name}`, "VALIDATION_ERROR");
}

interface CommandFailure {
  readonly code: string;
  readonly message: string;
  readonly help: string;
}

function domainError(
  error: unknown,
  name: string,
  fallback: CommandFailure,
): AxiError {
  return Match.value(error).pipe(
    Match.when(
      Match.instanceOf(PersonRecordNotFound),
      (notFound) =>
        new AxiError(notFound.message, "PERSON_NOT_FOUND", [
          `Run \`ascendant init-person --name "${name}" --moment "<ISO-8601>" --latitude <latitude> --longitude <longitude>\``,
        ]),
    ),
    Match.when(
      Match.instanceOf(PersonRecordConflict),
      (conflict) => new AxiError(conflict.message, "PERSON_RECORD_CONFLICT"),
    ),
    Match.when(
      Match.instanceOf(Transit.TransitValidationError),
      (invalid) =>
        new AxiError(invalid.message, "VALIDATION_ERROR", [TRANSIT_HELP]),
    ),
    Match.when(
      Match.instanceOf(Transit.TransitSearchExhausted),
      (exhausted) =>
        new AxiError(exhausted.message, "TRANSIT_SEARCH_EXHAUSTED", [
          `Found ${exhausted.found.length} events before the search window ran out; retry with a larger --max-years`,
        ]),
    ),
    Match.orElse(
      () =>
        new AxiError(fallback.message, fallback.code, [fallback.help]),
    ),
  );
}

const transitWorkflow = Effect.fn("Ascendant.transitWorkflow")(function* (
  args: ReadonlyArray<string>,
) {
  const parsed = parseFlags(
    "transit",
    args,
    [
      "--name",
      "--moment",
      "--planet",
      "--direction",
      "--kinds",
      "--count",
      "--target-longitude",
      "--house",
      "--max-years",
      "--precision-minutes",
    ],
    ["--name", "--moment", "--planet"],
    TRANSIT_HELP,
  );
  const input = yield* Schema.decodeUnknownEffect(TransitCommandInput)({
    name: flagValue(parsed, "--name"),
    moment: flagValue(parsed, "--moment"),
    planet: flagValue(parsed, "--planet"),
    ...(parsed["--direction"] !== undefined
      ? { direction: parsed["--direction"] }
      : {}),
    ...(parsed["--kinds"] !== undefined ? { kinds: parsed["--kinds"] } : {}),
    ...(parsed["--count"] !== undefined
      ? { count: Number(parsed["--count"]) }
      : {}),
    ...(parsed["--target-longitude"] !== undefined
      ? { targetLongitude: Number(parsed["--target-longitude"]) }
      : {}),
    ...(parsed["--house"] !== undefined
      ? { house: Number(parsed["--house"]) }
      : {}),
    ...(parsed["--max-years"] !== undefined
      ? { maxYears: Number(parsed["--max-years"]) }
      : {}),
    ...(parsed["--precision-minutes"] !== undefined
      ? { precisionMinutes: Number(parsed["--precision-minutes"]) }
      : {}),
  }).pipe(
    Effect.mapError(
      (error) =>
        new AxiError(error.message, "VALIDATION_ERROR", [TRANSIT_HELP]),
    ),
  );

  const kinds = yield* Effect.forEach(
    (input.kinds ?? "sign-ingress").split(",").map((kind) => kind.trim()),
    (kind) =>
      Schema.decodeUnknownEffect(Transit.TransitKind)(kind).pipe(
        Effect.mapError(
          () =>
            new AxiError(
              `Unknown transit kind: ${kind}`,
              "VALIDATION_ERROR",
              [
                "Valid kinds: sign-ingress, cusp-crossing, longitude-hit, station",
                TRANSIT_HELP,
              ],
            ),
        ),
      ),
  );
  if (kinds.length === 0) {
    return yield* Effect.fail(
      new AxiError(
        "At least one transit kind is required",
        "VALIDATION_ERROR",
        [TRANSIT_HELP],
      ),
    );
  }

  return yield* searchTransits(input.name, input.moment, {
    planet: input.planet,
    direction: input.direction ?? "forward",
    kinds,
    count: input.count ?? 5,
    ...(input.targetLongitude !== undefined
      ? { targetLongitude: input.targetLongitude }
      : {}),
    ...(input.house !== undefined ? { house: input.house } : {}),
    ...(input.maxYears !== undefined ? { maxYears: input.maxYears } : {}),
    ...(input.precisionMinutes !== undefined
      ? { precisionMinutes: input.precisionMinutes }
      : {}),
  }).pipe(
    Effect.mapError((error) =>
      domainError(error, input.name, {
        code: "TRANSIT_FAILED",
        message: "Unable to search transits",
        help: "Verify the saved person record and search flags, then retry",
      }),
    ),
  );
});

const initPersonWorkflow = Effect.fn("Ascendant.initPersonWorkflow")(
  function* (args: ReadonlyArray<string>) {
  const parsed = parseFlags(
    "init-person",
    args,
    ["--name", "--moment", "--latitude", "--longitude", "--sex"],
    ["--name", "--moment", "--latitude", "--longitude"],
    INIT_PERSON_HELP,
  );
  const input = yield* Schema.decodeUnknownEffect(InitPersonCommandInput)({
    name: flagValue(parsed, "--name"),
    moment: flagValue(parsed, "--moment"),
    latitude: Number(flagValue(parsed, "--latitude")),
    longitude: Number(flagValue(parsed, "--longitude")),
    ...(parsed["--sex"] !== undefined ? { sex: parsed["--sex"] } : {}),
  }).pipe(
      Effect.mapError(
        (error) =>
          new AxiError(error.message, "VALIDATION_ERROR", [INIT_PERSON_HELP]),
      ),
    );

    return yield* initializePersonFromInput(
      input.name,
      input.moment,
      input.latitude,
      input.longitude,
      input.sex,
    ).pipe(
      Effect.mapError((error) =>
        domainError(error, input.name, {
          code: "INIT_PERSON_FAILED",
          message: "Unable to initialize the person record",
          help: "Verify the birth data and current working directory, then retry",
        }),
      ),
    );
  },
);

const homeView = Effect.fn("Ascendant.homeView")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const personsDirectory = "persons";
  const directoryExists = yield* fs.exists(personsDirectory);

  if (!directoryExists) {
    return {
      persons: {
        count: 0,
        records: [],
      },
      help: [
        "Run `ascendant init-person --name \"<name>\" --moment \"<ISO-8601>\" --latitude <latitude> --longitude <longitude> [--sex Male|Female>]`",
      ],
    };
  }

  const entries = yield* fs.readDirectory(personsDirectory);
  const records = yield* Effect.filter(entries, (entry) =>
    fs.exists(path.join(personsDirectory, entry, "input.txt")),
  );

  return {
    persons: {
      count: records.length,
      records: [...records]
        .sort()
        .map((name: string) => ({ name, status: "ready" })),
    },
    help: [
      "Run `ascendant transit --name \"<name>\" --moment \"<ISO-8601>\" --planet <graha>`",
      "Run `ascendant init-person --name \"<name>\" --moment \"<ISO-8601>\" --latitude <latitude> --longitude <longitude> [--sex Male|Female>]`",
    ],
  };
});

function homeCommand(): Promise<Record<string, unknown>> {
  return Effect.runPromise(homeView().pipe(Effect.provide(PlatformLayer)));
}

function transitCommand(args: string[]): Promise<Record<string, unknown>> {
  return Effect.runPromise(
    transitWorkflow(args).pipe(
      Effect.map((output) => ({ ...output })),
      Effect.provide(AppLayer),
    ),
  );
}

function initPersonCommand(args: string[]): Promise<Record<string, unknown>> {
  return Effect.runPromise(
    initPersonWorkflow(args).pipe(
      Effect.map((output) => ({ ...output })),
      Effect.provide(AppLayer),
    ),
  );
}

function commandHelp(command: string): string | null {
  return Match.value(command).pipe(
    Match.when("init-person", () =>
      `${encode({
        command: "init-person",
        description: "Create or refresh Vedic charts plus a separate KP D1",
        flags: {
          "--name": "Required saved person name",
          "--moment": "Required offset-aware ISO 8601 birth moment",
          "--latitude": "Required latitude from -90 to 90",
          "--longitude": "Required longitude from -180 to 180",
          "--sex": "Optional birth sex: Male or Female",
        },
        examples: [
          'ascendant init-person --name "Ada" --moment "1990-01-01T12:00:00+05:30" --latitude 12.9716 --longitude 77.5946',
          'ascendant init-person --name "Ada" --moment "1990-01-01T12:00:00+05:30" --latitude 12.9716 --longitude 77.5946 --sex Female',
        ],
      })}\n`,
    ),
    Match.when("transit", () =>
      `${encode({
        command: "transit",
        description: "Search transit events from a saved person's location",
        flags: {
          "--name": "Required saved person name",
          "--moment": "Required offset-aware ISO 8601 start moment",
          "--planet": "Required graha: Sun, Moon, Mars, Mercury, Venus, Jupiter, Saturn, Rahu, or Ketu",
          "--direction": "Optional search direction: forward (default) or backward",
          "--kinds": "Optional comma-separated kinds (default sign-ingress): sign-ingress, cusp-crossing, longitude-hit, station",
          "--count": "Optional number of events from 1 to 100 (default 5)",
          "--target-longitude": "Required for longitude-hit: sidereal longitude from 0 to 360",
          "--house": "Required for cusp-crossing: natal house from 1 to 12",
          "--max-years": "Optional search window in years (default 30)",
          "--precision-minutes": "Optional refinement precision in minutes (default 1)",
        },
        examples: [
          'ascendant transit --name "Ada" --moment "2026-08-27T22:00:00+05:30" --planet Jupiter',
          'ascendant transit --name "Ada" --moment "2026-08-27T22:00:00+05:30" --planet Saturn --kinds sign-ingress,station --count 3 --direction forward',
        ],
      })}\n`,
    ),
    Match.orElse(() => null),
  );
}

function writeOutput(output: Record<string, unknown>): void {
  process.stdout.write(`${encode(output)}\n`);
}

function writeError(error: unknown): void {
  const formatted =
    error instanceof AxiError
      ? error
      : new AxiError(
          error instanceof Error ? error.message : String(error),
          "UNKNOWN",
        );
  writeOutput({
    error: formatted.message,
    code: formatted.code,
    help: formatted.suggestions,
  });
  process.exitCode = exitCodeForError(formatted);
}

function commandHandler(
  command: string,
): ((args: string[]) => Promise<Record<string, unknown>>) | undefined {
  return Match.value(command).pipe(
    Match.when("init-person", () => initPersonCommand),
    Match.when("transit", () => transitCommand),
    Match.orElse(() => undefined),
  );
}

async function runCli(argv: ReadonlyArray<string>): Promise<void> {
  if (argv.length === 0) {
    try {
      writeOutput(await homeCommand());
    } catch (error) {
      writeError(error);
    }
    return;
  }

  if (argv.length === 1 && argv[0] === "--help") {
    process.stdout.write(TOP_LEVEL_HELP);
    return;
  }

  const command = argv[0];
  if (command === undefined || command.startsWith("-")) {
    writeError(
      new AxiError("Flags must come after a command", "VALIDATION_ERROR", [
        "Run `ascendant <command> --help` to see available commands",
      ]),
    );
    return;
  }

  const args = [...argv.slice(1)];
  if (args.includes("--help")) {
    const help = commandHelp(command);
    if (help !== null) {
      process.stdout.write(help);
      return;
    }
  }

  const handler = commandHandler(command);
  if (handler === undefined) {
    writeError(
      new AxiError(`Unknown command: ${command}`, "VALIDATION_ERROR", [
        "Run `ascendant --help` to see available commands",
      ]),
    );
    return;
  }

  try {
    writeOutput(await handler(args));
  } catch (error) {
    writeError(error);
  }
}

export const run = Effect.fn("Ascendant.runCli")(function* (
  argv: ReadonlyArray<string>,
) {
  yield* Effect.promise(() => runCli(argv));
});
