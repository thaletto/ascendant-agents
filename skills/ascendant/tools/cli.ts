import { encode } from "@toon-format/toon";
import { AxiError, exitCodeForError } from "axi-sdk-js";
import { Effect, FileSystem, Match, Path, Schema } from "effect";

import { calculateTransit } from "./check-transit.ts";
import {
  AppLayer,
  Latitude,
  Longitude,
  OffsetMoment,
  PersonName,
  PersonRecordConflict,
  PersonRecordNotFound,
  PlatformLayer,
} from "./common.ts";
import { initializePersonFromInput } from "./init-person.ts";

const DESCRIPTION = "Calculate saved Vedic astrology records and transits";
const INIT_PERSON_HELP =
  "Run `ascendant init-person --name \"<name>\" --moment \"<ISO-8601>\" --latitude <latitude> --longitude <longitude>`";
const TRANSIT_HELP =
  "Run `ascendant transit --name \"<name>\" --moment \"<ISO-8601>\"`";
const TOP_LEVEL_HELP = `${encode({
  command: "ascendant",
  description: DESCRIPTION,
  commands: [
    {
      name: "init-person",
      description: "Create or refresh a complete saved person record",
    },
    {
      name: "transit",
      description: "Calculate a D1 transit for a saved person",
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
});

interface TransitCommandInput extends Schema.Schema.Type<
  typeof TransitCommandInput
> {}

const InitPersonCommandInput = Schema.Struct({
  name: PersonName,
  moment: OffsetMoment,
  latitude: Latitude,
  longitude: Longitude,
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
    ["--name", "--moment"],
    ["--name", "--moment"],
    TRANSIT_HELP,
  );
  const input = yield* Schema.decodeUnknownEffect(TransitCommandInput)({
    name: flagValue(parsed, "--name"),
    moment: flagValue(parsed, "--moment"),
  }).pipe(
    Effect.mapError(
      (error) =>
        new AxiError(error.message, "VALIDATION_ERROR", [TRANSIT_HELP]),
    ),
  );

  return yield* calculateTransit(input.name, input.moment).pipe(
    Effect.mapError((error) =>
      domainError(error, input.name, {
        code: "TRANSIT_FAILED",
        message: "Unable to calculate transit",
        help: "Verify the saved person record and transit moment, then retry",
      }),
    ),
  );
});

const initPersonWorkflow = Effect.fn("Ascendant.initPersonWorkflow")(
  function* (args: ReadonlyArray<string>) {
    const parsed = parseFlags(
      "init-person",
      args,
      ["--name", "--moment", "--latitude", "--longitude"],
      ["--name", "--moment", "--latitude", "--longitude"],
      INIT_PERSON_HELP,
    );
    const input = yield* Schema.decodeUnknownEffect(InitPersonCommandInput)({
      name: flagValue(parsed, "--name"),
      moment: flagValue(parsed, "--moment"),
      latitude: Number(flagValue(parsed, "--latitude")),
      longitude: Number(flagValue(parsed, "--longitude")),
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
    ).pipe(
      Effect.mapError((error) =>
        domainError(error, input.name, {
          code: "INIT_PERSON_FAILED",
          message: "Unable to initialize the person record",
          help: "Verify the birth data and project directory, then retry",
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
        "Run `ascendant init-person --name \"<name>\" --moment \"<ISO-8601>\" --latitude <latitude> --longitude <longitude>`",
      ],
    };
  }

  const entries = yield* fs.readDirectory(personsDirectory);
  const records = yield* Effect.filter(entries, (entry) =>
    fs.exists(path.join(personsDirectory, entry, "input.json")),
  );

  return {
    persons: {
      count: records.length,
      records: [...records]
        .sort()
        .map((name: string) => ({ name, status: "ready" })),
    },
    help: [
      "Run `ascendant transit --name \"<name>\" --moment \"<ISO-8601>\"`",
      "Run `ascendant init-person --name \"<name>\" --moment \"<ISO-8601>\" --latitude <latitude> --longitude <longitude>`",
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
        description: "Create or refresh a complete saved person record",
        flags: {
          "--name": "Required saved person name",
          "--moment": "Required offset-aware ISO 8601 birth moment",
          "--latitude": "Required latitude from -90 to 90",
          "--longitude": "Required longitude from -180 to 180",
        },
        examples: [
          'ascendant init-person --name "Ada" --moment "1990-01-01T12:00:00+05:30" --latitude 12.9716 --longitude 77.5946',
        ],
      })}\n`,
    ),
    Match.when("transit", () =>
      `${encode({
        command: "transit",
        description: "Calculate a D1 transit at a saved person's location",
        flags: {
          "--name": "Required saved person name",
          "--moment": "Required offset-aware ISO 8601 transit moment",
        },
        examples: [
          'ascendant transit --name "Ada" --moment "2026-08-27T22:00:00+05:30"',
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
