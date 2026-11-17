import type { Database } from "@/adapters/db/create-db";
import {
  merchantPreferences,
  merchants,
  merchantUsers,
} from "@/adapters/db/schema";
import { z } from "zod";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

const hits = new Map<string, number[]>();

/** Cinco registros por hora y clave (la IP). Vive en memoria del proceso. */
export function takeRegisterSlot(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((at) => now - at < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.set(key, recent);
  return true;
}

/** Solo para pruebas. */
export function resetRegisterSlots(): void {
  hits.clear();
}

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(72),
});

export type RegistrationInput = {
  name: string;
  email: string;
  password: string;
};

export type RegistrationError =
  | "invalid_name"
  | "invalid_email"
  | "invalid_password"
  | "email_taken"
  | "rate_limited"
  | "account_not_configured"
  | "unavailable";

export type RegistrationResult =
  { ok: true; email: string } | { ok: false; error: RegistrationError };

export type RegistrationAuth = {
  createConfirmedUser(input: {
    email: string;
    password: string;
  }): Promise<
    { ok: true; id: string } | { ok: false; reason: "email_exists" | "failed" }
  >;
  deleteUser(userId: string): Promise<void>;
};

function invalidField(input: RegistrationInput): RegistrationError | null {
  const parsed = registrationSchema.safeParse(input);
  if (parsed.success) return null;
  const field = parsed.error.issues[0]?.path[0];
  if (field === "email") return "invalid_email";
  if (field === "password") return "invalid_password";
  return "invalid_name";
}

/**
 * Crea el usuario ya confirmado y, en la misma transacción, el comercio,
 * sus preferencias y el vínculo. Si la base falla, borra el usuario.
 * `bankAccountId` vacío detiene el alta antes de llamar a Auth.
 */
export async function registerMerchant(
  deps: {
    db: Database;
    auth: RegistrationAuth;
    bankAccountId: string | null;
    rateKey: string;
    now?: number;
  },
  input: RegistrationInput,
): Promise<RegistrationResult> {
  const fieldError = invalidField(input);
  if (fieldError) return { ok: false, error: fieldError };
  if (!takeRegisterSlot(deps.rateKey, deps.now ?? Date.now())) {
    return { ok: false, error: "rate_limited" };
  }
  if (!deps.bankAccountId) {
    return { ok: false, error: "account_not_configured" };
  }

  const parsed = registrationSchema.parse(input);
  const created = await deps.auth.createConfirmedUser({
    email: parsed.email,
    password: parsed.password,
  });
  if (!created.ok) {
    return {
      ok: false,
      error: created.reason === "email_exists" ? "email_taken" : "unavailable",
    };
  }

  try {
    await insertNewMerchant(deps.db, {
      userId: created.id,
      name: parsed.name,
      bankAccountId: deps.bankAccountId,
    });
  } catch {
    await deps.auth.deleteUser(created.id);
    return { ok: false, error: "unavailable" };
  }

  return { ok: true, email: parsed.email };
}

/** Persiste comercio, preferencias y vínculo. La cuenta Pey ya viene resuelta. */
export async function insertNewMerchant(
  db: Database,
  input: { userId: string; name: string; bankAccountId: string },
): Promise<{ merchantId: string }> {
  return db.transaction(async (tx) => {
    const [merchant] = await tx
      .insert(merchants)
      .values({
        name: input.name,
        peyBankAccountId: input.bankAccountId,
        timezone: "America/Mexico_City",
      })
      .returning({ id: merchants.id });
    if (!merchant) {
      throw new Error("No se pudo crear el comercio.");
    }
    await tx.insert(merchantPreferences).values({ merchantId: merchant.id });
    await tx.insert(merchantUsers).values({
      userId: input.userId,
      merchantId: merchant.id,
    });
    return { merchantId: merchant.id };
  });
}
