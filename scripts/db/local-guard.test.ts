import { describe, expect, it } from "vitest";
import { assertLocalDatabase, isLocalUrl } from "./local-guard";

describe("isLocalUrl", () => {
  it("acepta hosts locales", () => {
    expect(
      isLocalUrl("postgresql://postgres:postgres@127.0.0.1:54322/postgres"),
    ).toBe(true);
    expect(isLocalUrl("http://localhost:54321")).toBe(true);
    expect(
      isLocalUrl("postgresql://u:p@host.docker.internal:54322/postgres"),
    ).toBe(true);
  });

  it("rechaza infraestructura remota, incluso con 'localhost' en otra parte de la URL", () => {
    expect(
      isLocalUrl("postgresql://u:p@db.abcdef.supabase.co:5432/postgres"),
    ).toBe(false);
    expect(
      isLocalUrl(
        "postgresql://u:p@aws-0-us-east-1.pooler.supabase.com:6543/postgres",
      ),
    ).toBe(false);
    expect(isLocalUrl("https://evil.example.com/localhost")).toBe(false);
    expect(isLocalUrl("postgresql://localhost:p@db.example.com/postgres")).toBe(
      false,
    );
  });

  it("rechaza valores que no son URL", () => {
    expect(isLocalUrl("")).toBe(false);
    expect(isLocalUrl("no-es-una-url")).toBe(false);
  });
});

describe("assertLocalDatabase", () => {
  it("lanza ante una base remota", () => {
    expect(() =>
      assertLocalDatabase(
        "postgresql://u:p@db.abcdef.supabase.co:5432/postgres",
      ),
    ).toThrow(/base local/);
  });

  it("no lanza ante una base local", () => {
    expect(() =>
      assertLocalDatabase(
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
      ),
    ).not.toThrow();
  });
});
