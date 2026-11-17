import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createConfirmedAuthUser, readSignupAuthConfig } from "./admin";

const config = {
  supabaseUrl: "https://auth.example",
  secretKey: "secret-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("readSignupAuthConfig", () => {
  it("exige URL y clave secreta", () => {
    expect(readSignupAuthConfig({})).toBeNull();
    expect(
      readSignupAuthConfig({
        NEXT_PUBLIC_SUPABASE_URL: "https://auth.example",
        SUPABASE_SECRET_KEY: "secret-key",
      }),
    ).toEqual(config);
  });
});

describe("createConfirmedAuthUser", () => {
  it("crea el usuario ya confirmado y no manda la clave al mensaje", async () => {
    const fetchImpl = vi.fn(async () => json({ id: "user-1" }));

    await expect(
      createConfirmedAuthUser(
        config,
        { email: "a@comercio.test", password: "secreta-12" },
        fetchImpl as typeof fetch,
      ),
    ).resolves.toEqual({ ok: true, user: { id: "user-1" } });

    const [url, init] = (fetchImpl.mock.calls[0] ?? []) as [
      string,
      RequestInit,
    ];
    expect(url).toBe("https://auth.example/auth/v1/admin/users");
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body)) as {
      email_confirm: boolean;
      password: string;
    };
    expect(body.email_confirm).toBe(true);
    expect(body.password).toBe("secreta-12");
    expect(JSON.stringify(init?.headers)).toContain("secret-key");
  });

  it("reconoce un correo que ya existe", async () => {
    const fetchImpl = vi.fn(async () =>
      json({ error_code: "email_exists", msg: "already" }, 422),
    );

    await expect(
      createConfirmedAuthUser(
        config,
        { email: "a@comercio.test", password: "secreta-12" },
        fetchImpl,
      ),
    ).resolves.toEqual({ ok: false, reason: "email_exists" });
  });

  it("un fallo de red no se presenta como correo repetido", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("sin red");
    });

    await expect(
      createConfirmedAuthUser(
        config,
        { email: "a@comercio.test", password: "secreta-12" },
        fetchImpl,
      ),
    ).resolves.toEqual({ ok: false, reason: "failed" });
  });
});
