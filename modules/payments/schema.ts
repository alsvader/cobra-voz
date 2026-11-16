import { z } from "zod";
import { parseAmountToCents } from "@/modules/charges/amount";

/**
 * Aviso de pago que CobraVoz acepta de Pey. Contrato PROVISIONAL: la
 * arquitectura nombra estos campos (`codi.qr.payment_received`, `transactionId`,
 * `codiQrId`, importe, referencia y cuenta) pero el payload real se confronta
 * en H5 antes de aflojar esto. El importe llega como texto con máximo dos
 * decimales: un número JSON se rechaza para no pasar por punto flotante.
 */
export const peyPaymentNoticeSchema = z.strictObject({
  type: z.literal("codi.qr.payment_received"),
  transactionId: z.string().trim().min(1).max(128),
  codiQrId: z.string().trim().min(1).max(128),
  amount: z.string().trim(),
  numRef: z.number().int().min(0).max(9_999_999),
  bankAccountId: z.string().trim().min(1).max(128),
  paidAt: z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
    error: "Fecha de pago no válida.",
  }),
});

export type PeyPaymentNotice = {
  transactionId: string;
  codiQrId: string;
  amountCents: number;
  numRef: number;
  bankAccountId: string;
  paidAt: Date;
};

export function parsePeyPaymentNotice(
  body: unknown,
): { ok: true; notice: PeyPaymentNotice } | { ok: false } {
  const parsed = peyPaymentNoticeSchema.safeParse(body);
  if (!parsed.success) return { ok: false };
  const amount = parseAmountToCents(parsed.data.amount);
  if (!amount.ok) return { ok: false };
  return {
    ok: true,
    notice: {
      transactionId: parsed.data.transactionId,
      codiQrId: parsed.data.codiQrId,
      amountCents: amount.cents,
      numRef: parsed.data.numRef,
      bankAccountId: parsed.data.bankAccountId,
      paidAt: new Date(parsed.data.paidAt),
    },
  };
}
