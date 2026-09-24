import { NodeChildProcessSpawner, NodeFileSystem, NodePath } from "@effect/platform-node-shared";
import { Plugin } from "@opencode/plugin/effect";
import { Tool } from "@opencode/schema/tool";
import { Effect, Layer, Path, Schema, Scope, Stream } from "effect";
import { ChildProcess } from "effect/unstable/process";
import {
  Latitude,
  Longitude,
  OffsetMoment,
  PersonName,
  Sex,
} from "../../../skills/ascendant/tools/contract.ts";

const FileSystemLive = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);

const NodeLive = Layer.mergeAll(
  FileSystemLive,
  NodeChildProcessSpawner.layer.pipe(Layer.provide(FileSystemLive)),
);

const InitPersonInput = Schema.Struct({
  name: PersonName.pipe(
    Schema.annotate({ description: "Person name used for the saved record directory" }),
  ),
  moment: OffsetMoment.pipe(
    Schema.annotate({
      description: "Birth moment in ISO 8601 form with Z or an explicit UTC offset",
    }),
  ),
  latitude: Latitude.pipe(Schema.annotate({ description: "Birth latitude" })),
  longitude: Longitude.pipe(Schema.annotate({ description: "Birth longitude" })),
  sex: Schema.optional(Sex.pipe(Schema.annotate({ description: "Birth sex: Male or Female" }))),
});

const CheckTransitInput = Schema.Struct({
  name: PersonName.pipe(Schema.annotate({ description: "Name of an initialized person record" })),
  moment: OffsetMoment.pipe(
    Schema.annotate({
      description: "Transit moment in ISO 8601 form with Z or an explicit UTC offset",
    }),
  ),
});

const describeCause = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const toToolError = (message: string): Tool.Error => Tool.Error.make({ message });

function runScript(
  script: string,
  args: ReadonlyArray<string>,
  directory: string,
): Effect.Effect<string, Tool.Error> {
  return Effect.gen(function* () {
    const handle = yield* ChildProcess.make(script, [...args], { cwd: directory }).pipe(
      Effect.mapError((cause) => toToolError(`Failed to spawn ${script}: ${describeCause(cause)}`)),
    );
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [
        handle.stdout.pipe(Stream.decodeText, Stream.runCollect),
        handle.stderr.pipe(Stream.decodeText, Stream.runCollect),
        handle.exitCode,
      ],
      { concurrency: "unbounded" },
    ).pipe(
      Effect.mapError((cause) =>
        toToolError(`Failed to read ${script} output: ${describeCause(cause)}`),
      ),
    );
    if (exitCode !== 0) {
      const detail = stderr.join("").trim();
      return yield* toToolError(detail === "" ? `${script} exited with code ${exitCode}` : detail);
    }
    return stdout.join("").trim();
  }).pipe(
    Effect.timeout(60_000),
    Effect.mapError((cause) =>
      cause instanceof Tool.Error
        ? cause
        : toToolError(`Timed out running ${script}: ${describeCause(cause)}`),
    ),
    Effect.scoped,
    Effect.provide(NodeLive),
  );
}

export default Plugin.define({
  id: "ascendant",
  effect: (ctx): Effect.Effect<void, never, Scope.Scope> =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const scriptDirectory = yield* path.fromFileUrl(
        new URL("../../../skills/ascendant/scripts/", import.meta.url),
      );
      const initScript = path.join(scriptDirectory, "init-person.sh");
      const transitScript = path.join(scriptDirectory, "check-transit.sh");
      const directory: string = ctx.location.directory;
      yield* ctx.tool.transform((editor) => {
        editor.add({
          name: "ascendant_init_person",
          description: "Create or refresh one saved astrology record from exact birth data.",
          input: InitPersonInput,
          execute: (args) =>
            runScript(
              initScript,
              [
                "--name",
                args.name,
                "--moment",
                args.moment,
                "--latitude",
                String(args.latitude),
                "--longitude",
                String(args.longitude),
                ...(args.sex !== undefined ? ["--sex", args.sex] : []),
              ],
              directory,
            ).pipe(Effect.map((text) => ({ content: text }))),
        });
        editor.add({
          name: "ascendant_check_transit",
          description: "Calculate a compact D1 transit for one saved person and moment.",
          input: CheckTransitInput,
          execute: (args) =>
            runScript(
              transitScript,
              ["--name", args.name, "--moment", args.moment],
              directory,
            ).pipe(Effect.map((text) => ({ content: text }))),
        });
      });
    }).pipe(Effect.provide(NodeLive), Effect.orDie),
});
