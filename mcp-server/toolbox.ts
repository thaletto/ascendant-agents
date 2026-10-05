import { z } from "zod";

// Mirrors skills/ascendant/tools/contract.ts so MCP input validation
// matches the skill CLI. The SDK accepts zod v4 schemas directly.
export const PersonName = z
  .string()
  .regex(
    /^[\p{L}\p{N}][\p{L}\p{N} .'-]{0,79}$/u,
    "Use 1-80 letters, numbers, spaces, apostrophes, periods, or hyphens",
  );

export const OffsetMoment = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/,
    "Use an ISO 8601 moment with Z or an explicit UTC offset",
  );

export const Latitude = z.number().min(-90).max(90);

export const Longitude = z.number().min(-180).max(180);

export const Sex = z.enum(["Male", "Female"]);

export const Planet = z.enum([
  "Sun",
  "Moon",
  "Mars",
  "Mercury",
  "Jupiter",
  "Venus",
  "Saturn",
  "Rahu",
  "Ketu",
]);

export const School = z.enum(["kp", "parashari"]);

export const Direction = z.enum(["forward", "backward"]);
