import { fileURLToPath } from "node:url";

import { type Plugin, tool } from "@opencode-ai/plugin";

type PluginShell = Parameters<Plugin>[0]["$"];

const SCRIPT_DIRECTORY = fileURLToPath(
  new URL("../../skills/ascendant/scripts/", import.meta.url),
);
const OFFSET_MOMENT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/;

function scriptPath(name: string): string {
  return `${SCRIPT_DIRECTORY}${name}.sh`;
}

async function runScript(
  shell: PluginShell,
  script: string,
  args: ReadonlyArray<string>,
  directory: string,
): Promise<string> {
  const result = await shell`${script} ${args}`.cwd(directory).quiet();
  return result.text().trim();
}

export const AscendantPlugin: Plugin = async function AscendantPlugin({ $ }) {
  return {
    tool: {
      ascendant_init_person: tool({
        description:
          "Create or refresh one saved astrology record from exact birth data.",
        args: {
          name: tool.schema
            .string()
            .min(1)
            .describe("Person name used for the saved record directory"),
          moment: tool.schema
            .string()
            .regex(OFFSET_MOMENT_PATTERN)
            .describe(
              "Birth moment in ISO 8601 form with Z or an explicit UTC offset",
            ),
          latitude: tool.schema
            .number()
            .min(-90)
            .max(90)
            .describe("Birth latitude"),
          longitude: tool.schema
            .number()
            .min(-180)
            .max(180)
            .describe("Birth longitude"),
        },
        async execute(args, context) {
          return await runScript(
            $,
            scriptPath("init-person"),
            [
              "--name",
              args.name,
              "--moment",
              args.moment,
              "--latitude",
              String(args.latitude),
              "--longitude",
              String(args.longitude),
            ],
            context.directory,
          );
        },
      }),
      ascendant_check_transit: tool({
        description:
          "Calculate a compact D1 transit for one saved person and moment.",
        args: {
          name: tool.schema
            .string()
            .min(1)
            .describe("Name of an initialized person record"),
          moment: tool.schema
            .string()
            .regex(OFFSET_MOMENT_PATTERN)
            .describe(
              "Transit moment in ISO 8601 form with Z or an explicit UTC offset",
            ),
        },
        async execute(args, context) {
          return await runScript(
            $,
            scriptPath("check-transit"),
            ["--name", args.name, "--moment", args.moment],
            context.directory,
          );
        },
      }),
    },
  };
};
