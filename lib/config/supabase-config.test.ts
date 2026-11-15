import { describe, expect, it } from "vitest";
import {
  getSupabasePublicConfig,
  MissingConfigError,
} from "@/lib/config/public-env";

describe("getSupabasePublicConfig", () => {
  it("devuelve la configuración cuando está completa", () => {
    expect(
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
      }),
    ).toEqual({
      url: "http://127.0.0.1:54321",
      publishableKey: "sb_publishable_x",
    });
  });

  it("falla con un error claro cuando faltan variables, sin exponer valores", () => {
    let error: unknown;
    try {
      getSupabasePublicConfig({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(MissingConfigError);
    expect((error as MissingConfigError).missing).toEqual([
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ]);
    expect((error as Error).message).not.toContain("127.0.0.1");
  });

  it("lista todas las variables ausentes", () => {
    expect(() => getSupabasePublicConfig({})).toThrow(
      /NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/,
    );
  });
});
