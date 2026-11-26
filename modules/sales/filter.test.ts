import { describe, expect, it } from "vitest";
import { parseMovementStatus, salesApiPath, salesFilterPath } from "./filter";

describe("parseMovementStatus", () => {
  it("acepta cada estado y trata lo demás como todos", () => {
    expect(parseMovementStatus("paid")).toBe("paid");
    expect(parseMovementStatus("qr_uncertain")).toBe("qr_uncertain");
    expect(parseMovementStatus("created")).toBe("created");
    expect(parseMovementStatus(null)).toBeNull();
    expect(parseMovementStatus("pagado")).toBeNull();
    expect(parseMovementStatus("")).toBeNull();
  });
});

describe("rutas del filtro", () => {
  it("Todos no lleva parámetro y un estado sí", () => {
    expect(salesFilterPath(null)).toBe("/ventas");
    expect(salesFilterPath("qr_uncertain")).toBe("/ventas?estado=qr_uncertain");
  });

  it("la página siguiente conserva el estado", () => {
    expect(salesApiPath("abc", "paid")).toBe(
      "/api/sales?cursor=abc&estado=paid",
    );
    expect(salesApiPath("abc", null)).toBe("/api/sales?cursor=abc");
  });
});
