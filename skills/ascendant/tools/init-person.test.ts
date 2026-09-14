import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { decode } from "@toon-format/toon";
import { describe, expect, test } from "bun:test";
import { Effect, Schema } from "effect";

import { AppLayer, Latitude, Longitude, OffsetMoment, PersonName } from "./common.ts";
import { initializePersonFromInput } from "./init-person.ts";
import { subLordOf, subSubLordOf } from "./kp-lords.ts";

const ADA = {
  name: Schema.decodeUnknownSync(PersonName)("Ada"),
  moment: Schema.decodeUnknownSync(OffsetMoment)("1990-01-01T12:00:00+05:30"),
  latitude: Schema.decodeUnknownSync(Latitude)(12.9716),
  longitude: Schema.decodeUnknownSync(Longitude)(77.5946),
} as const;

describe("initializePerson chart schools", () => {
  test("writes Lahiri WholeSign vargas and a separate KP D1", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "ascendant-a311-"));
    const previous = process.cwd();
    process.chdir(workspace);

    try {
      const result = await Effect.runPromise(
        initializePersonFromInput(
          ADA.name,
          ADA.moment,
          ADA.latitude,
          ADA.longitude,
        ).pipe(Effect.provide(AppLayer)),
      );

      expect(result.artifacts.charts).toBe(16);
      expect(result.artifacts.kpCharts).toBe(1);

      const vedicD1 = decode(
        await readFile(join(workspace, "persons", "Ada", "charts", "D1.txt"), "utf8"),
      ) as {
        calculation: {
          school: string;
          ayanamsa: string;
          houseSystem: string;
          dashaSystem: string;
        };
        chart: { division: number };
      };
      const vedicDasha = decode(
        await readFile(join(workspace, "persons", "Ada", "dasha.txt"), "utf8"),
      ) as {
        calculation: { school: string; ayanamsa: string; dashaSystem: string };
        mahadashas: unknown[];
      };
      const kpD1 = decode(
        await readFile(join(workspace, "persons", "Ada", "kp", "D1.txt"), "utf8"),
      ) as {
        calculation: {
          school: string;
          ayanamsa: string;
          houseSystem: string;
          dashaSystem: string;
        };
        chart: { division: number; houses: Record<string, { cusp?: number }> };
        cuspLords: Array<{
          house: number;
          starLord: string;
          subLord: string;
          subSubLord: string;
        }>;
        planetLords: Array<{ name: string; subSubLord: string }>;
      };
      const kpDasha = decode(
        await readFile(join(workspace, "persons", "Ada", "kp", "dasha.txt"), "utf8"),
      ) as {
        calculation: { school: string; ayanamsa: string; dashaSystem: string };
        mahadashas: unknown[];
      };

      expect(vedicD1.calculation).toEqual({
        school: "Parashari",
        ayanamsa: "Lahiri",
        houseSystem: "WholeSign",
        dashaSystem: "Vimshottari",
      });
      expect(vedicD1.chart.division).toBe(1);
      expect(vedicDasha.calculation.school).toBe("Parashari");
      expect(vedicDasha.calculation.ayanamsa).toBe("Lahiri");
      expect(vedicDasha.calculation.dashaSystem).toBe("Vimshottari");
      expect(vedicDasha.mahadashas.length).toBeGreaterThan(0);

      expect(kpD1.calculation).toEqual({
        school: "KP",
        ayanamsa: "Krishnamurti",
        houseSystem: "Placidus",
        dashaSystem: "Vimshottari",
      });
      expect(kpD1.chart.division).toBe(1);
      expect(kpD1.cuspLords).toHaveLength(12);
      expect(kpD1.planetLords.some((planet) => planet.name === "Lagna")).toBe(true);
      expect(kpDasha.calculation.school).toBe("KP");
      expect(kpDasha.calculation.ayanamsa).toBe("Krishnamurti");
      expect(kpDasha.calculation.dashaSystem).toBe("Vimshottari");

      const firstCusp = kpD1.chart.houses["1"]?.cusp;
      expect(typeof firstCusp).toBe("number");
      const firstLords = kpD1.cuspLords[0];
      expect(firstLords?.house).toBe(1);
      expect(firstLords?.subLord).toBe(subLordOf(firstCusp as number));
      expect(firstLords?.subSubLord).toBe(subSubLordOf(firstCusp as number));
    } finally {
      process.chdir(previous);
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
