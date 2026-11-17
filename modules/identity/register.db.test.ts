import { afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  merchantPreferences,
  merchants,
  merchantUsers,
} from "@/adapters/db/schema";
import {
  createTestDb,
  insertAuthUser,
  withRollback,
} from "@/adapters/db/testing";
import { insertNewMerchant } from "./register";

const { db, close } = createTestDb();
afterAll(close);

describe("insertNewMerchant", () => {
  it("guarda el comercio, la preferencia y el vínculo con la cuenta compartida", () =>
    withRollback(db, async (tx) => {
      const userId = await insertAuthUser(tx);
      const { merchantId } = await insertNewMerchant(tx as never, {
        userId,
        name: "Empanadas del centro",
        bankAccountId: "acct-shared",
      });

      const [merchant] = await tx
        .select()
        .from(merchants)
        .where(eq(merchants.id, merchantId));
      const [link] = await tx
        .select()
        .from(merchantUsers)
        .where(eq(merchantUsers.userId, userId));
      const [preferences] = await tx
        .select()
        .from(merchantPreferences)
        .where(eq(merchantPreferences.merchantId, merchantId));

      expect(merchant?.name).toBe("Empanadas del centro");
      expect(merchant?.peyBankAccountId).toBe("acct-shared");
      expect(merchant?.timezone).toBe("America/Mexico_City");
      expect(merchant?.receivingAccountLabel).toBeNull();
      expect(link?.merchantId).toBe(merchantId);
      expect(preferences?.voiceAnnouncementsEnabled).toBe(true);
    }));
});
