import { z } from "zod";
import {
  parseAmountToCents,
  pesosNumberToCents,
} from "@/modules/charges/amount";

/**
 * Aviso de pago de Pey. La documentación vigente (webhook `codi.qr.payment_received`,
 * noviembre 2026) manda `amount` numérico en pesos, `numRef` como texto,
 * `datePaid` en segundos Unix y campos extra (`apiKeyId`, `concept`, `metadata`).
 * Se siguen aceptando `amount` en texto y `paidAt` ISO: es la forma que ya
 * usan las pruebas locales. Un número que no cae en dos decimales se rechaza.
 */
const peyPaymentNoticeSchema = z.object({
  type: z.literal("codi.qr.payment_received"),
  transactionId: z.string().trim().min(1).max(128),
  codiQrId: z.string().trim().min(1).max(128),
  amount: z.union([z.string().trim().min(1), z.number()]),
  numRef: z.union([
    z.number().int().min(0).max(9_999_999),
    z.string().regex(/^[0-9]{1,7}$/),
  ]),
  bankAccountId: z.string().trim().min(1).max(128),
  paidAt: z.string().optional(),
  datePaid: z.number().optional(),
});

const MIN_UNIX_SECONDS = 1_500_000_000;
const MAX_UNIX_SECONDS = 4_000_000_000;

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

  const amountCents = noticeAmountCents(parsed.data.amount);
  const paidAt = noticePaidAt(parsed.data);
  if (amountCents == null || !paidAt) return { ok: false };

  return {
    ok: true,
    notice: {
      transactionId: parsed.data.transactionId,
      codiQrId: parsed.data.codiQrId,
      amountCents,
      numRef:
        typeof parsed.data.numRef === "number"
          ? parsed.data.numRef
          : Number(parsed.data.numRef),
      bankAccountId: parsed.data.bankAccountId,
      paidAt,
    },
  };
}

function noticeAmountCents(amount: string | number): number | null {
  if (typeof amount === "number") {
    const parsed = pesosNumberToCents(amount);
    return parsed.ok ? parsed.cents : null;
  }
  const parsed = parseAmountToCents(amount);
  return parsed.ok ? parsed.cents : null;
}

function noticePaidAt(data: {
  paidAt?: string;
  datePaid?: number;
}): Date | null {
  if (data.datePaid != null) {
    if (
      !Number.isInteger(data.datePaid) ||
      data.datePaid < MIN_UNIX_SECONDS ||
      data.datePaid > MAX_UNIX_SECONDS
    ) {
      return null;
    }
    return new Date(data.datePaid * 1000);
  }
  if (!data.paidAt || Number.isNaN(Date.parse(data.paidAt))) return null;
  return new Date(data.paidAt);
}
