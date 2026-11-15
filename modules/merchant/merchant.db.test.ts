import { afterAll, describe, expect, it } from "vitest";
import {
  createTestDb,
  insertMerchant,
  withRollback,
} from "@/adapters/db/testing";
import { getMerchantProfile } from "./service";

const { db, close } = createTestDb();
afterAll(close);

describe("getMerchantProfile", () => {
  it("expone solo nombre, etiqueta de cuenta y zona horaria", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);

      const profile = await getMerchantProfile(tx as never, merchant.id);

      expect(Object.keys(profile ?? {}).sort()).toEqual([
        "name",
        "receivingAccountLabel",
        "timezone",
      ]);
      // Ningún dato bancario del proveedor llega al DTO.
      expect(JSON.stringify(profile)).not.toContain(merchant.peyBankAccountId);
    }));

  it("devuelve null si el comercio no existe", () =>
    withRollback(db, async (tx) => {
      const profile = await getMerchantProfile(
        tx as never,
        "00000000-0000-4000-8000-0000000000fe",
      );

      expect(profile).toBeNull();
    }));
});
