import { describe, expect, it } from "vitest";
import { businessDayRange, resolveTimeZone } from "./business-day";

describe("businessDayRange", () => {
  it("en Ciudad de México el día empieza a las 06:00 UTC", () => {
    const range = businessDayRange(
      "America/Mexico_City",
      new Date("2026-11-15T18:00:00.000Z"),
    );

    expect(range.timeZone).toBe("America/Mexico_City");
    expect(range.start.toISOString()).toBe("2026-11-15T06:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-11-16T06:00:00.000Z");
  });

  it("antes de las 06:00 UTC todavía es el día anterior en México", () => {
    const range = businessDayRange(
      "America/Mexico_City",
      new Date("2026-11-15T05:30:00.000Z"),
    );

    expect(range.start.toISOString()).toBe("2026-11-14T06:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-11-15T06:00:00.000Z");
  });

  it("una zona desconocida cae en America/Mexico_City", () => {
    expect(resolveTimeZone("No/Existe")).toBe("America/Mexico_City");
    expect(resolveTimeZone(null)).toBe("America/Mexico_City");
  });
});
