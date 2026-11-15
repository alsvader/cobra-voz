// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isMutation, isSameOrigin } from "./origin";

function req(headers: Record<string, string>, method = "PATCH") {
  return new Request("https://app.cobravoz.mx/api/preferences", {
    method,
    headers,
  });
}

describe("isSameOrigin", () => {
  it("acepta un Origin igual al Host", () => {
    expect(
      isSameOrigin(
        req({ origin: "https://app.cobravoz.mx", host: "app.cobravoz.mx" }),
      ),
    ).toBe(true);
  });

  it("rechaza un Origin de otro sitio (CSRF)", () => {
    expect(
      isSameOrigin(
        req({ origin: "https://evil.example", host: "app.cobravoz.mx" }),
      ),
    ).toBe(false);
  });

  it("rechaza un subdominio que solo se parece al host", () => {
    expect(
      isSameOrigin(
        req({
          origin: "https://app.cobravoz.mx.evil.example",
          host: "app.cobravoz.mx",
        }),
      ),
    ).toBe(false);
  });

  it("rechaza si falta Origin, es 'null' o no es una URL", () => {
    expect(isSameOrigin(req({ host: "app.cobravoz.mx" }))).toBe(false);
    expect(isSameOrigin(req({ origin: "null", host: "app.cobravoz.mx" }))).toBe(
      false,
    );
    expect(
      isSameOrigin(req({ origin: "no-es-url", host: "app.cobravoz.mx" })),
    ).toBe(false);
  });

  it("usa X-Forwarded-Host detrás de un proxy", () => {
    expect(
      isSameOrigin(
        req({
          origin: "https://app.cobravoz.mx",
          host: "interno:3000",
          "x-forwarded-host": "app.cobravoz.mx",
        }),
      ),
    ).toBe(true);
  });
});

describe("isMutation", () => {
  it("distingue métodos seguros de mutaciones", () => {
    expect(isMutation("GET")).toBe(false);
    expect(isMutation("head")).toBe(false);
    expect(isMutation("POST")).toBe(true);
    expect(isMutation("PATCH")).toBe(true);
    expect(isMutation("DELETE")).toBe(true);
  });
});
