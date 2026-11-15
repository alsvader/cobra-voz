import { describe, expect, it } from "vitest";
import { isPrivatePath, loginUrl, sanitizeNextPath } from "./routes";

describe("isPrivatePath", () => {
  it("protege la app y la configuración, incluidas subrutas", () => {
    expect(isPrivatePath("/inicio")).toBe(true);
    expect(isPrivatePath("/configuracion")).toBe(true);
    expect(isPrivatePath("/inicio/algo")).toBe(true);
  });

  it("protege el recorrido de cobro (P02/P03)", () => {
    expect(isPrivatePath("/cobro")).toBe(true);
    expect(isPrivatePath("/cobro/confirmar")).toBe(true);
    expect(isPrivatePath("/cobros-falsos")).toBe(false);
  });

  it("deja públicas la landing y el acceso", () => {
    expect(isPrivatePath("/")).toBe(false);
    expect(isPrivatePath("/acceso")).toBe(false);
    expect(isPrivatePath("/inicio-falso")).toBe(false);
  });
});

describe("sanitizeNextPath", () => {
  it("acepta rutas privadas propias, con query", () => {
    expect(sanitizeNextPath("/inicio")).toBe("/inicio");
    expect(sanitizeNextPath("/configuracion?x=1")).toBe("/configuracion?x=1");
  });

  it("descarta open redirects y rutas no privadas", () => {
    for (const raw of [
      "https://evil.example/inicio",
      "//evil.example/inicio",
      "/\\evil.example",
      "javascript:alert(1)",
      "/acceso",
      "/",
      "inicio",
      "",
    ]) {
      expect(sanitizeNextPath(raw), raw).toBeNull();
    }
    expect(sanitizeNextPath(null)).toBeNull();
    expect(sanitizeNextPath(undefined)).toBeNull();
  });
});

describe("loginUrl", () => {
  it("construye la URL con motivo y destino saneado", () => {
    expect(loginUrl()).toBe("/acceso");
    expect(loginUrl({ reason: "sesion-expirada", next: "/inicio" })).toBe(
      "/acceso?motivo=sesion-expirada&siguiente=%2Finicio",
    );
    expect(loginUrl({ next: "https://evil.example" })).toBe("/acceso");
  });
});
