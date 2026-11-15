import { z } from "zod";
import { isValidAmountCents } from "./amount";

/**
 * Clave de idempotencia por INTENCIÓN de cobro (RN-07): la genera el cliente
 * una vez por intención y la repite en cada reintento de esa misma intención.
 */
export const idempotencyKeySchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{16,64}$/, "Clave de idempotencia no válida.");

/**
 * Cuerpo de `POST /api/charges`. `strictObject`: no se acepta `merchantId` ni
 * ningún otro campo; el comercio sale de la sesión. El importe se revalida
 * aquí aunque el cliente ya lo haya validado.
 */
export const createChargeSchema = z.strictObject({
  amountCents: z.number().refine(isValidAmountCents, "Importe no válido."),
  idempotencyKey: idempotencyKeySchema,
});

export type CreateChargeInput = z.infer<typeof createChargeSchema>;

export const chargeIdSchema = z.uuid();
