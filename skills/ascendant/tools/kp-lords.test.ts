import { describe, expect, test } from "bun:test";

import { starLordOf, subLordOf, subSubLordOf } from "./kp-lords.ts";

describe("kp lord chain", () => {
  test("starts Ashwini with Ketu as star lord", () => {
    expect(starLordOf(0)).toBe("Ketu");
    expect(subLordOf(0)).toBe("Ketu");
    expect(subSubLordOf(0)).toBe("Ketu");
  });

  test("moves to Venus sub after Ketu's 7/120 of Ashwini", () => {
    const insideVenusSub = (7 / 120) * (360 / 27) + 1e-9;
    expect(subLordOf(insideVenusSub)).toBe("Venus");
    expect(subSubLordOf(insideVenusSub)).toBe("Venus");
  });
});
