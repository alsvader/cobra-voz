import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

describe("cn", () => {
  it("combina clases y descarta valores falsos", () => {
    expect(cn("px-4", false, undefined, "py-2")).toBe("px-4 py-2");
  });

  it("resuelve conflictos de Tailwind a favor de la última clase", () => {
    expect(cn("bg-primary", "bg-secondary")).toBe("bg-secondary");
  });
});
