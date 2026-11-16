import { describe, expect, it } from "vitest";
import { parsePeyPaymentNotice } from "./schema";

const notice = {
  type: "codi.qr.payment_received",
  transactionId: "tx-1",
  codiQrId: "qr-1",
  amount: "150.50",
  numRef: 1234567,
  bankAccountId: "acct-1",
  paidAt: "2026-11-15T18:00:00.000Z",
};

describe("parsePeyPaymentNotice", () => {
  it("convierte el importe de texto a centavos, sin punto flotante", () => {
    const parsed = parsePeyPaymentNotice(notice);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.notice.amountCents).toBe(15050);
    expect(parsed.notice.paidAt.toISOString()).toBe("2026-11-15T18:00:00.000Z");
  });

  it("rechaza un importe numérico, un campo extra y un tipo distinto", () => {
    expect(parsePeyPaymentNotice({ ...notice, amount: 150.5 }).ok).toBe(false);
    expect(parsePeyPaymentNotice({ ...notice, extra: true }).ok).toBe(false);
    expect(parsePeyPaymentNotice({ ...notice, type: "otro" }).ok).toBe(false);
    expect(parsePeyPaymentNotice({ ...notice, amount: "0" }).ok).toBe(false);
    expect(parsePeyPaymentNotice({ ...notice, amount: "150.501" }).ok).toBe(
      false,
    );
  });
});
