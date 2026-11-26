import { z } from "zod";
import { isValidAmountCents } from "./amount";
import { MAX_CONCEPT_LENGTH, normalizeConcept } from "./concept";
import { normalizeMxPhone } from "./phone";
import { normalizeNumRef } from "./reference";

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
    method: z.enum(["qr", "pn", "link"]).default("qr"),
    phoneNumber: z.string().max(32).optional(),
    concept: z.string().optional(),
    numRef: z.union([z.string(), z.number()]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.method !== "link") {
      const concept = value.concept?.trim() ?? "";
      if (concept.length > MAX_CONCEPT_LENGTH) {
        ctx.addIssue({
          code: "custom",
          message: "El concepto es demasiado largo.",
          path: ["concept"],
        });
      }
      const raw = value.numRef == null ? "" : String(value.numRef).trim();
      if (raw !== "" && normalizeNumRef(value.numRef) === null) {
        ctx.addIssue({
          code: "custom",
          message: "La referencia debe tener hasta 7 dígitos.",
          path: ["numRef"],
        });
      }
    }
    if (value.method === "qr" || value.method === "link") {
      if (value.phoneNumber != null) {
        ctx.addIssue({
          code: "custom",
          message: "Este cobro no lleva celular.",
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
    const concept =
      value.method === "link" ? null : normalizeConcept(value.concept);
    const numRef =
      value.method === "link" ? null : normalizeNumRef(value.numRef);
    if (value.method === "qr" || value.method === "link") {
      return {
        amountCents: value.amountCents,
        idempotencyKey: value.idempotencyKey,
        method: value.method,
        phoneNumber: null,
        concept,
        numRef,
      };
    }
    return {
      amountCents: value.amountCents,
      idempotencyKey: value.idempotencyKey,
      method: "pn" as const,
      phoneNumber: normalizeMxPhone(value.phoneNumber ?? "")!,
      concept,
      numRef,
    };
  });

export type CreateChargeInput = z.infer<typeof createChargeSchema>;

export const chargeIdSchema = z.uuid();
