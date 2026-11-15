import { afterAll, describe, expect, it } from "vitest";
import {
  createTestDb,
  insertMerchant,
  withRollback,
} from "@/adapters/db/testing";
import { getPreferences, updatePreferences } from "./service";

const { db, close } = createTestDb();
afterAll(close);

describe("preferencias del comercio", () => {
  it("se crean con audio activado la primera vez (idempotente)", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);

      expect(await getPreferences(tx as never, merchant.id)).toEqual({
        voiceAnnouncementsEnabled: true,
      });
      expect(await getPreferences(tx as never, merchant.id)).toEqual({
        voiceAnnouncementsEnabled: true,
      });
    }));

  it("actualizar persiste el valor", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);

      const updated = await updatePreferences(tx as never, merchant.id, {
        voiceAnnouncementsEnabled: false,
      });

      expect(updated.voiceAnnouncementsEnabled).toBe(false);
      expect(await getPreferences(tx as never, merchant.id)).toEqual({
        voiceAnnouncementsEnabled: false,
      });
    }));

  it("actualizar un comercio NO modifica el de otro", () =>
    withRollback(db, async (tx) => {
      const merchantA = await insertMerchant(tx);
      const merchantB = await insertMerchant(tx);
      await getPreferences(tx as never, merchantB.id);

      await updatePreferences(tx as never, merchantA.id, {
        voiceAnnouncementsEnabled: false,
      });

      expect(await getPreferences(tx as never, merchantB.id)).toEqual({
        voiceAnnouncementsEnabled: true,
      });
    }));
});
