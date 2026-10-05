import { Swisseph } from "astro-ascendant";
import { Effect, Layer } from "effect";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import {
  AppLayer,
  KpAstroParamsLayer,
  PlatformLayer,
  type Latitude as LatitudeBrand,
  type Longitude as LongitudeBrand,
} from "../skills/ascendant/tools/common.ts";
import { rulingPlanetsWorkflow } from "../skills/ascendant/tools/ruling-planets.ts";
import { VERSION } from "../skills/ascendant/tools/version.ts";
import { computeBirthCharts, searchTransitsStateless } from "./compute.ts";
import {
  Direction,
  Latitude,
  Longitude,
  OffsetMoment,
  PersonName,
  Planet,
  School,
  Sex,
} from "./toolbox.ts";

const KpLayer = Layer.mergeAll(PlatformLayer, KpAstroParamsLayer, Swisseph.SwissephLayer);

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

function failure(label: string, error: unknown) {
  const message = String((error as { message?: unknown })?.message ?? error);
  return textResult(JSON.stringify({ error: label, message }));
}

export function buildMcpServer(): McpServer {
  const server = new McpServer({ name: "ascendant", version: VERSION });

  server.registerTool(
    "init_person",
    {
      description:
        "Calculate Vedic charts (D1-D60), KP D1 with lords, Vimshottari dashas, Ashtakavarga and Jaimini artifacts for birth data. Stateless: returns charts inline.",
      inputSchema: {
        name: PersonName,
        moment: OffsetMoment,
        latitude: Latitude,
        longitude: Longitude,
        sex: Sex.optional(),
      },
    },
    async ({ name, moment, latitude, longitude, sex }) => {
      try {
        const result = await Effect.runPromise(
          computeBirthCharts(
            moment,
            latitude as LatitudeBrand,
            longitude as LongitudeBrand,
            sex,
          ).pipe(Effect.provide(AppLayer)),
        );
        return textResult(JSON.stringify({ person: name, ...result }));
      } catch (error) {
        return failure("init_person_failed", error);
      }
    },
  );

  server.registerTool(
    "check_transit",
    {
      description:
        "Search upcoming or past transit events from birth place and start moment. Stateless: pass birth data on every call.",
      inputSchema: {
        birthMoment: OffsetMoment,
        latitude: Latitude,
        longitude: Longitude,
        moment: OffsetMoment,
        planet: Planet,
        school: School.optional(),
        direction: Direction.optional(),
        count: z.number().optional(),
        maxYears: z.number().optional(),
      },
    },
    async ({
      birthMoment,
      latitude,
      longitude,
      moment,
      planet,
      school,
      direction,
      count,
      maxYears,
    }) => {
      try {
        const result = await Effect.runPromise(
          searchTransitsStateless(
            birthMoment,
            latitude as LatitudeBrand,
            longitude as LongitudeBrand,
            moment,
            {
              planet,
              school: school === "kp" ? "KP" : "Parashari",
              direction: direction ?? "forward",
              kinds: ["sign-ingress"],
              count: Math.min(Math.max(Math.floor(count ?? 5), 1), 100),
              ...(maxYears !== undefined ? { maxYears } : {}),
            },
          ).pipe(Effect.provide(school === "kp" ? KpLayer : AppLayer)),
        );
        return textResult(JSON.stringify(result));
      } catch (error) {
        return failure("check_transit_failed", error);
      }
    },
  );

  server.registerTool(
    "ruling_planets",
    {
      description:
        "Read KP ruling planets for a judgment moment and place. Used for birth-time verification and significator shortlisting.",
      inputSchema: { moment: OffsetMoment, latitude: Latitude, longitude: Longitude },
    },
    async ({ moment, latitude, longitude }) => {
      try {
        const result = await Effect.runPromise(
          rulingPlanetsWorkflow(
            moment,
            latitude as LatitudeBrand,
            longitude as LongitudeBrand,
          ).pipe(Effect.provide(KpLayer)),
        );
        return textResult(JSON.stringify(result));
      } catch (error) {
        return failure("ruling_planets_failed", error);
      }
    },
  );

  return server;
}
