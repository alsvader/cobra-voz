import { describe, expect, it } from "vitest";
import { bearerMatches } from "./cron";

describe("bearerMatches", () => {
  it("acepta el secreto exacto y rechaza ausencias, vacíos y casi-aciertos", () => {
    expect(bearerMatches("Bearer secreto-cron", "secreto-cron")).toBe(true);
    expect(bearerMatches("Bearer secreto-cron", "")).toBe(false);
    expect(bearerMatches(null, "secreto-cron")).toBe(false);
    expect(bearerMatches("secreto-cron", "secreto-cron")).toBe(false);
    expect(bearerMatches("Bearer secreto-cron ", "secreto-cron")).toBe(false);
    expect(bearerMatches("Bearer otro", "secreto-cron")).toBe(false);
  });
});
