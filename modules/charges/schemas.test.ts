import { describe, expect, it } from "vitest";
import { MAX_NUM_REF, chargeReference, randomNumRef } from "./reference";
import { chargeIdSchema, createChargeSchema } from "./schemas";

const key = "0b2b8e0a-6d1c-4a43-9a53-3f5a3f0a9d11";

describe("createChargeSchema", () => {
  it("acepta importe en centavos enteros y una clave válida", () => {
    expect(
      createChargeSchema.safeParse({ amountCents: 15050, idempotencyKey: key })
        .success,
    ).toBe(true);
  });

  it.each([0, -1, 1.5, NaN, Infinity, 100_000_000, "15050", null, undefined])(
    "rechaza el importe %j",
    (amountCents) => {
      expect(
        createChargeSchema.safeParse({ amountCents, idempotencyKey: key })
          .success,
      ).toBe(false);
    },
  );

  it.each([
    "",
    "corta",
    "con espacios no válidos 123",
    "x".repeat(65),
    "a/b".repeat(8),
  ])("rechaza la clave de idempotencia %j", (idempotencyKey) => {
    expect(
      createChargeSchema.safeParse({ amountCents: 100, idempotencyKey })
        .success,
    ).toBe(false);
  });

  it("rechaza campos extra: no se acepta merchantId del cliente", () => {
    const result = createChargeSchema.safeParse({
      amountCents: 100,
      idempotencyKey: key,
      merchantId: "00000000-0000-4000-8000-000000000001",
    });
    expect(result.success).toBe(false);
  });

  it("acepta una notificación con celular de 10 dígitos", () => {
    const result = createChargeSchema.safeParse({
      amountCents: 100,
      idempotencyKey: key,
      method: "pn",
      phoneNumber: "55 1234-5678",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.phoneNumber).toBe("5512345678");
    expect(result.data.method).toBe("pn");
  });

  it("rechaza la lada y un QR que trae celular", () => {
    expect(
      createChargeSchema.safeParse({
        amountCents: 100,
        idempotencyKey: key,
        method: "pn",
        phoneNumber: "+52 55 1234 5678",
      }).success,
    ).toBe(false);
    expect(
      createChargeSchema.safeParse({
        amountCents: 100,
        idempotencyKey: key,
        phoneNumber: "5512345678",
      }).success,
    ).toBe(false);
  });

  it("acepta un enlace y rechaza que traiga celular", () => {
    const ok = createChargeSchema.safeParse({
      amountCents: 100,
      idempotencyKey: key,
      method: "link",
    });
    expect(ok.success).toBe(true);
    if (!ok.success) return;
    expect(ok.data.method).toBe("link");
    expect(ok.data.phoneNumber).toBeNull();
    expect(
      createChargeSchema.safeParse({
        amountCents: 100,
        idempotencyKey: key,
        method: "link",
        phoneNumber: "5512345678",
      }).success,
    ).toBe(false);
  });

  it("rechaza cuerpos que no son objeto", () => {
    for (const body of [undefined, null, "x", 5, []]) {
      expect(createChargeSchema.safeParse(body).success).toBe(false);
    }
  });
});

describe("chargeIdSchema", () => {
  it("solo acepta UUID", () => {
    expect(chargeIdSchema.safeParse(key).success).toBe(true);
    expect(chargeIdSchema.safeParse("123").success).toBe(false);
    expect(chargeIdSchema.safeParse("../etc/passwd").success).toBe(false);
  });
});

describe("referencias", () => {
  it("chargeReference deriva CV-XXXXXXXX del UUID, en mayúsculas", () => {
    expect(chargeReference("5f0d9f0e-8c3a-4e0e-9d7e-0c1f7c8c2a11")).toBe(
      "CV-5F0D9F0E",
    );
  });

  it("randomNumRef siempre cabe en 7 dígitos", () => {
    for (let i = 0; i < 2000; i++) {
      const value = randomNumRef();
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(MAX_NUM_REF);
    }
  });
});
