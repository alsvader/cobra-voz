import { afterAll, describe, expect, it } from "vitest";
import { merchantUsers } from "@/adapters/db/schema";
import {
  createTestDb,
  insertAuthUser,
  insertMerchant,
  withRollback,
} from "@/adapters/db/testing";
import { findMerchantIdForUser } from "./merchant-access";

const { db, close } = createTestDb();
afterAll(close);

describe("findMerchantIdForUser", () => {
  it("devuelve el comercio vinculado al usuario", () =>
    withRollback(db, async (tx) => {
      const merchant = await insertMerchant(tx);
      const userId = await insertAuthUser(tx);
      await tx
        .insert(merchantUsers)
        .values({ userId, merchantId: merchant.id });

      expect(await findMerchantIdForUser(tx as never, userId)).toBe(
        merchant.id,
      );
    }));

  it("devuelve null para un usuario sin comercio", () =>
    withRollback(db, async (tx) => {
      const userId = await insertAuthUser(tx);

      expect(await findMerchantIdForUser(tx as never, userId)).toBeNull();
    }));

  it("devuelve null para un usuario desconocido", () =>
    withRollback(db, async (tx) => {
      const unknown = "00000000-0000-4000-8000-0000000000ff";

      expect(await findMerchantIdForUser(tx as never, unknown)).toBeNull();
    }));

  it("cada usuario resuelve solo SU comercio, nunca el de otro", () =>
    withRollback(db, async (tx) => {
      const merchantA = await insertMerchant(tx);
      const merchantB = await insertMerchant(tx);
      const userA = await insertAuthUser(tx);
      const userB = await insertAuthUser(tx);
      await tx.insert(merchantUsers).values([
        { userId: userA, merchantId: merchantA.id },
        { userId: userB, merchantId: merchantB.id },
      ]);

      expect(await findMerchantIdForUser(tx as never, userA)).toBe(
        merchantA.id,
      );
      expect(await findMerchantIdForUser(tx as never, userB)).toBe(
        merchantB.id,
      );
    }));
});
