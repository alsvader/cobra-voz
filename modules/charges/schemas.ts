import { z } from "zod";
import { isValidAmountCents } from "./amount";
import { normalizeMxPhone } from "./phone";

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
export const createChargeSchema = z
  .strictObject({
    amountCents: z.number().refine(isValidAmountCents, "Importe no válido."),
    idempotencyKey: idempotencyKeySchema,
    method: z.enum(["qr", "pn"]).default("qr"),
    phoneNumber: z.string().max(32).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.method === "qr") {
      if (value.phoneNumber != null) {
        ctx.addIssue({
          code: "custom",
          message: "El cobro por QR no lleva celular.",
          path: ["phoneNumber"],
        });
      }
      return;
    }
    if (!value.phoneNumber || !normalizeMxPhone(value.phoneNumber)) {
      ctx.addIssue({
        code: "custom",
        message: "El celular debe tener 10 dígitos.",
        path: ["phoneNumber"],
      });
    }
  })
  .transform((value) => {
    if (value.method === "qr") {
      return {
        amountCents: value.amountCents,
        idempotencyKey: value.idempotencyKey,
        method: "qr" as const,
        phoneNumber: null,
      };
    }
    return {
      amountCents: value.amountCents,
      idempotencyKey: value.idempotencyKey,
      method: "pn" as const,
      phoneNumber: normalizeMxPhone(value.phoneNumber ?? "")!,
    };
  });

export type CreateChargeInput = z.infer<typeof createChargeSchema>;

export const chargeIdSchema = z.uuid();
