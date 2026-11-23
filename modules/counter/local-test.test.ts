import { describe, expect, it } from "vitest";
import { isLocalCounterTestAllowed } from "./local-test";

describe("isLocalCounterTestAllowed", () => {
  it("solo acepta local y fuera de un despliegue de producción", () => {
    expect(isLocalCounterTestAllowed({ NEXT_PUBLIC_APP_ENV: "local" })).toBe(
      true,
    );
    expect(
      isLocalCounterTestAllowed({
        NEXT_PUBLIC_APP_ENV: "local",
        VERCEL_ENV: "preview",
      }),
    ).toBe(true);

    for (const env of [
      { NEXT_PUBLIC_APP_ENV: "preview" },
      { NEXT_PUBLIC_APP_ENV: "production" },
      { NEXT_PUBLIC_APP_ENV: "local", VERCEL_ENV: "production" },
      { NEXT_PUBLIC_APP_ENV: "LOCAL" },
      {},
    ]) {
      expect(isLocalCounterTestAllowed(env)).toBe(false);
    }
  });
});
