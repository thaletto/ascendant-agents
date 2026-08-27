import { tryFastPath } from "axi-sdk-js/fast-path";

import { VERSION } from "./version.ts";

const argv = process.argv.slice(2);

if (!tryFastPath(argv, { version: VERSION })) {
  const { run } = await import("./cli.ts");
  const { NodeRuntime } = await import("@effect/platform-node-shared");
  run(argv).pipe(NodeRuntime.runMain);
}
