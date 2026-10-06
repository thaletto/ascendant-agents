import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "bun:test";
import { Effect, Schema } from "effect";

import { AppLayer, Latitude, Longitude, OffsetMoment, PersonName } from "./common.ts";
import { initializePersonFromInput } from "./init-person.ts";

const ADA = {
  name: Schema.decodeUnknownSync(PersonName)("Ada"),
  moment: Schema.decodeUnknownSync(OffsetMoment)("1990-01-01T12:00:00+05:30"),
  latitude: Schema.decodeUnknownSync(Latitude)(12.9716),
  longitude: Schema.decodeUnknownSync(Longitude)(77.5946),
} as const;

describe("initializePerson chart schools", () => {
  test("writes Lahiri WholeSign vargas and a separate KP D1 as markdown", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "ascendant-a311-"));
    const previous = process.cwd();
    process.chdir(workspace);

    try {
      const result = await Effect.runPromise(
        initializePersonFromInput(ADA.name, ADA.moment, ADA.latitude, ADA.longitude).pipe(
          Effect.provide(AppLayer),
        ),
      );

      expect(result.artifacts.charts).toBe(16);
      expect(result.artifacts.kpCharts).toBe(1);

      const vedicD1 = await readFile(join(workspace, "persons", "Ada", "charts", "D1.md"), "utf8");
      const vedicDasha = await readFile(join(workspace, "persons", "Ada", "dasha.md"), "utf8");
      const kpD1 = await readFile(join(workspace, "persons", "Ada", "kp", "D1.md"), "utf8");
      const kpDasha = await readFile(join(workspace, "persons", "Ada", "kp", "dasha.md"), "utf8");
      const input = await readFile(join(workspace, "persons", "Ada", "input.md"), "utf8");
      const sav = await readFile(join(workspace, "persons", "Ada", "sav.md"), "utf8");
      const charaKarakas = await readFile(
        join(workspace, "persons", "Ada", "jaimini", "chara-karakas.md"),
        "utf8",
      );

      expect(vedicD1).toContain("# Vedic Chart D1 — D1");
      expect(vedicD1).toContain("Parashari");
      expect(vedicD1).toContain("Lahiri");
      expect(vedicD1).toContain("WholeSign");
      expect(vedicD1).toContain("| House | Cusp |");
      expect(vedicDasha).toContain("# Vimshottari Dasha");
      expect(vedicDasha).toContain("Parashari");
      expect(vedicDasha).toContain("| Mahadasha | Start | End |");

      expect(kpD1).toContain("# KP Chart D1 — D1");
      expect(kpD1).toContain("KP");
      expect(kpD1).toContain("KrishnamurtiVP291");
      expect(kpD1).toContain("Placidus");
      expect(kpD1).toContain("## Cusp Lords");
      expect(kpD1).toContain("## Planet Lords");
      expect(kpD1).toContain("Sub-Sub Lord");
      expect(kpDasha).toContain("KP");
      expect(kpDasha).toContain("| Mahadasha | Start | End |");

      expect(input).toContain("name: Ada");
      expect(input).toContain("| Field | Value |");
      expect(sav).toContain("# Sarvashtakavarga");
      expect(charaKarakas).toContain("# Chara Karakas");
    } finally {
      process.chdir(previous);
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
