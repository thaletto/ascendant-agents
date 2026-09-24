import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { Effect, Layer, Schema } from "effect";
import { Chart, Swisseph, Transit } from "astro-ascendant";

import {
  AppLayer,
  KpAstroParamsLayer,
  Latitude,
  Longitude,
  OffsetMoment,
  PersonName,
  PlatformLayer,
} from "./common.ts";
import { searchTransits } from "./check-transit.ts";
import { initializePersonFromInput } from "./init-person.ts";
import { kpLordChain } from "./kp-lords.ts";
import { rulingPlanetsWorkflow } from "./ruling-planets.ts";

const KpLayer = Layer.mergeAll(PlatformLayer, KpAstroParamsLayer, Swisseph.SwissephLayer);

describe("ruling planets", () => {
  test("returns five KP ruling planets with lord chains", async () => {
    const result = await Effect.runPromise(
      rulingPlanetsWorkflow(
        Schema.decodeUnknownSync(OffsetMoment)("2026-09-23T10:00:00+05:30"),
        Schema.decodeUnknownSync(Latitude)(12.9716),
        Schema.decodeUnknownSync(Longitude)(77.5946),
      ).pipe(Effect.provide(KpLayer)),
    );

    expect(result.calculation).toEqual({
      school: "KP",
      ayanamsa: "KrishnamurtiVP291",
      houseSystem: "Placidus",
      dashaSystem: "Vimshottari",
    });
    expect(result.rulingPlanets).toHaveLength(5);
    expect(result.ascendant).toEqual({
      longitude: result.ascendant.longitude,
      ...kpLordChain(result.ascendant.longitude),
    });
    expect(result.moon).toEqual({
      longitude: result.moon.longitude,
      ...kpLordChain(result.moon.longitude),
    });
  });
});

describe("transit schools", () => {
  test("KP school reports KP provenance and cusps", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "ascendant-kp-transit-"));
    const previous = process.cwd();
    process.chdir(workspace);

    try {
      await Effect.runPromise(
        initializePersonFromInput(
          Schema.decodeUnknownSync(PersonName)("Ada"),
          Schema.decodeUnknownSync(OffsetMoment)("1990-01-01T12:00:00+05:30"),
          Schema.decodeUnknownSync(Latitude)(12.9716),
          Schema.decodeUnknownSync(Longitude)(77.5946),
        ).pipe(Effect.provide(AppLayer)),
      );

      const kp = await Effect.runPromise(
        searchTransits(
          Schema.decodeUnknownSync(PersonName)("Ada"),
          Schema.decodeUnknownSync(OffsetMoment)("2026-08-27T22:00:00+05:30"),
          {
            planet: Schema.decodeUnknownSync(Chart.Planets)("Jupiter"),
            school: "KP",
            direction: "forward",
            kinds: [Schema.decodeUnknownSync(Transit.TransitKind)("sign-ingress")],
            count: 1,
          },
        ).pipe(Effect.provide(KpLayer)),
      );
      expect(kp.calculation.school).toBe("KP");
      expect(kp.calculation.ayanamsa).toBe("KrishnamurtiVP291");
    } finally {
      process.chdir(previous);
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
