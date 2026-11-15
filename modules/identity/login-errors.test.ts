import { describe, expect, it } from "vitest";
import { classifyLoginError, LOGIN_ERROR_MESSAGES } from "./login-errors";

describe("classifyLoginError", () => {
  it("credenciales incorrectas y usuario inexistente se ven igual", () => {
    expect(
      classifyLoginError({ code: "invalid_credentials", status: 400 }),
    ).toBe("invalid_credentials");
    expect(classifyLoginError({ code: "user_not_found", status: 400 })).toBe(
      "invalid_credentials",
    );
  });

  it("detecta límite de intentos", () => {
    expect(
      classifyLoginError({ code: "over_request_rate_limit", status: 429 }),
    ).toBe("rate_limited");
    expect(classifyLoginError({ status: 429 })).toBe("rate_limited");
  });

  it("distingue problemas de conexión de credenciales", () => {
    expect(
      classifyLoginError({ name: "AuthRetryableFetchError", status: 0 }),
    ).toBe("connection");
    expect(classifyLoginError({ status: 503 })).toBe("connection");
  });

  it("cualquier otra cosa es desconocida", () => {
    expect(classifyLoginError({ code: "weird", status: 418 })).toBe("unknown");
  });
});

describe("mensajes de login", () => {
  it("no contienen jerga técnica", () => {
    for (const message of Object.values(LOGIN_ERROR_MESSAGES)) {
      expect(message).not.toMatch(
        /HTTP|\b4\d\d\b|\b5\d\d\b|token|JWT|supabase/i,
      );
    }
  });
});
