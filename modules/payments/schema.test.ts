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

  it("acepta el aviso documentado: pesos numéricos, numRef texto y datePaid", () => {
    const parsed = parsePeyPaymentNotice({
      type: "codi.qr.payment_received",
      transactionId: "01M3QR8H0RH0XBCKYYD242YXNV",
      codiQrId: "35a13c183a",
      amount: 0.01,
      apiKeyId: "01M3QMMR6X9CBVDY1SF3G8QWNW",
      bankAccountId: "01JBAVWE4NS5TGXHWGMX3KH23Q",
      concept: "(dev) Order 345",
      datePaid: 1790724818,
      metadata: { externalMetadata: { chargeId: "abc" } },
      numRef: "34567",
    });

    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.notice.amountCents).toBe(1);
    expect(parsed.notice.numRef).toBe(34567);
    expect(parsed.notice.paidAt).toEqual(new Date(1790724818 * 1000));
  });

  it("rechaza un tipo distinto, un importe vacío y centavos de más", () => {
    expect(parsePeyPaymentNotice({ ...notice, type: "otro" }).ok).toBe(false);
    expect(parsePeyPaymentNotice({ ...notice, amount: "0" }).ok).toBe(false);
    expect(parsePeyPaymentNotice({ ...notice, amount: 0 }).ok).toBe(false);
    expect(parsePeyPaymentNotice({ ...notice, amount: "150.501" }).ok).toBe(
      false,
    );
    expect(parsePeyPaymentNotice({ ...notice, amount: 10.555 }).ok).toBe(false);
    expect(parsePeyPaymentNotice({ ...notice, paidAt: undefined }).ok).toBe(
      false,
    );
  });
});
