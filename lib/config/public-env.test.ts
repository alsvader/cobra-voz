import { describe, expect, it } from "vitest";
import {
  isSimulationAllowed,
  parseAppEnvironment,
} from "@/lib/config/public-env";

describe("parseAppEnvironment", () => {
  it("acepta los entornos válidos", () => {
    expect(parseAppEnvironment("local")).toBe("local");
    expect(parseAppEnvironment("preview")).toBe("preview");
    expect(parseAppEnvironment("production")).toBe("production");
  });

  it("recurre a local ante valores ausentes o desconocidos", () => {
    expect(parseAppEnvironment(undefined)).toBe("local");
    expect(parseAppEnvironment("staging")).toBe("local");
  });
});

describe("isSimulationAllowed", () => {
  it("permite simuladores solo fuera de producción", () => {
    expect(isSimulationAllowed("local")).toBe(true);
    expect(isSimulationAllowed("preview")).toBe(true);
    expect(isSimulationAllowed("production")).toBe(false);
  });
});
