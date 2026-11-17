import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerMerchant,
  resetRegisterSlots,
  type RegistrationAuth,
} from "./register";

const input = {
  name: "Empanadas del centro",
  email: "Ana@Comercio.test",
  password: "secreta-12",
};

function auth(overrides: Partial<RegistrationAuth> = {}): RegistrationAuth {
  return {
    createConfirmedUser: vi.fn(async () => ({
      ok: true as const,
      id: "user-1",
    })),
    deleteUser: vi.fn(async () => {}),
    ...overrides,
  };
}

function dbThatInserts() {
  return {
    transaction: async (fn: (tx: never) => Promise<unknown>) => fn({} as never),
  };
}

describe("registerMerchant", () => {
  beforeEach(() => {
    resetRegisterSlots();
  });

  it("rechaza nombre, correo o contraseña incompletos y no llama a Auth", async () => {
    const gateway = auth();
    const cases = [
      { ...input, name: "A" },
      { ...input, email: "no-es-correo" },
      { ...input, password: "corta" },
    ];

    for (const candidate of cases) {
      const result = await registerMerchant(
        {
          db: dbThatInserts() as never,
          auth: gateway,
          bankAccountId: "acct-shared",
          rateKey: "ip-1",
        },
        candidate,
      );
      expect(result.ok).toBe(false);
    }
    expect(gateway.createConfirmedUser).not.toHaveBeenCalled();
  });

  it("sin cuenta Pey no crea el usuario", async () => {
    const gateway = auth();
    const result = await registerMerchant(
      {
        db: dbThatInserts() as never,
        auth: gateway,
        bankAccountId: null,
        rateKey: "ip-2",
      },
      input,
    );

    expect(result).toEqual({ ok: false, error: "account_not_configured" });
    expect(gateway.createConfirmedUser).not.toHaveBeenCalled();
  });

  it("normaliza el correo y crea el comercio", async () => {
    const gateway = auth();
    const result = await registerMerchant(
      {
        db: {
          transaction: vi.fn(async () => ({ merchantId: "merchant-1" })),
        } as never,
        auth: gateway,
        bankAccountId: "acct-shared",
        rateKey: "ip-3",
      },
      input,
    );

    expect(result).toEqual({ ok: true, email: "ana@comercio.test" });
    expect(gateway.createConfirmedUser).toHaveBeenCalledWith({
      email: "ana@comercio.test",
      password: "secreta-12",
    });
  });

  it("un correo repetido no borra nada", async () => {
    const gateway = auth({
      createConfirmedUser: vi.fn(async () => ({
        ok: false as const,
        reason: "email_exists" as const,
      })),
    });

    await expect(
      registerMerchant(
        {
          db: dbThatInserts() as never,
          auth: gateway,
          bankAccountId: "acct-shared",
          rateKey: "ip-4",
        },
        input,
      ),
    ).resolves.toEqual({ ok: false, error: "email_taken" });
    expect(gateway.deleteUser).not.toHaveBeenCalled();
  });

  it("si la base falla, borra el usuario que acaba de crear", async () => {
    const gateway = auth();
    const result = await registerMerchant(
      {
        db: {
          transaction: async () => {
            throw new Error("db");
          },
        } as never,
        auth: gateway,
        bankAccountId: "acct-shared",
        rateKey: "ip-5",
      },
      input,
    );

    expect(result).toEqual({ ok: false, error: "unavailable" });
    expect(gateway.deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("a la sexta vez en una hora responde límite", async () => {
    const gateway = auth();
    const deps = {
      db: {
        transaction: vi.fn(async () => ({ merchantId: "merchant-1" })),
      } as never,
      auth: gateway,
      bankAccountId: "acct-shared",
      rateKey: "ip-6",
      now: 1_000,
    };

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await registerMerchant(deps, input);
    }
    await expect(registerMerchant(deps, input)).resolves.toEqual({
      ok: false,
      error: "rate_limited",
    });
  });
});
