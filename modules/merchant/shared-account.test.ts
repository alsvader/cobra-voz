import { describe, expect, it } from "vitest";
import {
  LOCAL_DEMO_BANK_ACCOUNT_ID,
  sharedBankAccountId,
} from "./shared-account";

describe("sharedBankAccountId", () => {
  it("usa la variable de servidor cuando está definida", () => {
    expect(
      sharedBankAccountId({
        PEY_BANK_ACCOUNT_ID: " acct-shared ",
        NEXT_PUBLIC_APP_ENV: "production",
        VERCEL_ENV: "production",
      }),
    ).toBe("acct-shared");
  });

  it("en local, sin la variable, usa la cuenta de prueba del seed", () => {
    expect(sharedBankAccountId({ NEXT_PUBLIC_APP_ENV: "local" })).toBe(
      LOCAL_DEMO_BANK_ACCOUNT_ID,
    );
  });

  it("en producción, sin la variable, no inventa una cuenta", () => {
    expect(
      sharedBankAccountId({
        NEXT_PUBLIC_APP_ENV: "production",
        VERCEL_ENV: "production",
      }),
    ).toBeNull();
    expect(sharedBankAccountId({})).toBeNull();
  });
});
