import { and, desc, eq, gt, inArray, lte } from "drizzle-orm";
import type { Database } from "@/adapters/db/create-db";
import {
  charges,
  codiNotifications,
  codiQrs,
  paymentIncidents,
  paymentLinks,
  merchants,
} from "@/adapters/db/schema";
import { canonicalCodiId } from "@/adapters/pey/contract";
import { isSimulatedQr } from "@/adapters/pey/mock";
import type {
  CreatePaymentLinkOutcome,
  CreatePushOutcome,
  CreateQrOutcome,
  PeyAdapter,
} from "@/adapters/pey/types";
import { normalizeConcept } from "./concept";
import { paymentLinkReturnUrls } from "./return-urls";
import { phoneHash } from "./phone-hash";
import { normalizeMxPhone, phoneLast4 } from "./phone";
import {
  QR_EXPIRATION_SECONDS,
  chargeReference,
  randomNumRef,
} from "./reference";
import type { CreateChargeInput } from "./schemas";
import type { ChargeDto } from "./types";

export type ChargesDeps = {
  db: Database;
  pey: PeyAdapter;
  now?: () => Date;
  /** Inyectable para pruebas; por defecto aleatorio. */
  nextNumRef?: () => number;
};

export type CreateChargeResult =
  | { ok: true; charge: ChargeDto; replayed: boolean }
  /** La misma clave de idempotencia se usó con otro importe. */
  | { ok: false; error: "idempotency_conflict" | "merchant_not_found" };

type ChargeRequest = {
  amountCents: number;
  idempotencyKey: string;
  method?: CreateChargeInput["method"];
  phoneNumber?: string | null;
  concept?: string | null;
};

/**
 * Un cobro que sigue en `created` pasado este tiempo quedó sin resolver (p. ej.
 * el proceso cayó entre persistir y llamar a Pey). No se sabe si Pey creó el
 * QR, así que pasa a `qr_uncertain`: jamás se vuelve a pedir un QR a ciegas.
 */
export const STALE_CREATED_MS = 60_000;

const MAX_NUM_REF_ATTEMPTS = 10;

type ChargeRow = typeof charges.$inferSelect;
type QrRow = typeof codiQrs.$inferSelect;
type LinkRow = typeof paymentLinks.$inferSelect;

function methodOf(value: string): ChargeDto["collectionMethod"] {
  if (value === "pn" || value === "link") return value;
  return "qr";
}

function toDto(
  charge: ChargeRow,
  qr: QrRow | null,
  link: LinkRow | null = null,
): ChargeDto {
  return {
    id: charge.id,
    reference: chargeReference(charge.id),
    amountCents: charge.amountCents,
    currency: "MXN",
    status: charge.status,
    collectionMethod: methodOf(charge.collectionMethod),
    phoneLast4: charge.phoneLast4,
    creationResult:
      charge.creationResult === "uncertain" ||
      charge.creationResult === "rejected"
        ? charge.creationResult
        : null,
    paymentLink: link ? { url: link.url } : null,
    createdAt: charge.createdAt.toISOString(),
    expiresAt: charge.expiresAt?.toISOString() ?? null,
    closedAt: charge.closedAt?.toISOString() ?? null,
    qr: qr
      ? {
          payload: qr.qrPayload,
          expiresAt: qr.expiresAt.toISOString(),
          simulated: isSimulatedQr(qr.qrPayload),
        }
      : null,
  };
}

async function loadCharge(
  db: Database,
  merchantId: string,
  where: ReturnType<typeof eq>,
) {
  const [row] = await db
    .select({
      charge: charges,
      qr: codiQrs,
      notification: codiNotifications,
      link: paymentLinks,
    })
    .from(charges)
    .leftJoin(codiQrs, eq(codiQrs.chargeId, charges.id))
    .leftJoin(codiNotifications, eq(codiNotifications.chargeId, charges.id))
    .leftJoin(paymentLinks, eq(paymentLinks.chargeId, charges.id))
    .where(and(eq(charges.merchantId, merchantId), where))
    .limit(1);
  return row ?? null;
}

/**
 * Marca el cobro como `qr_uncertain` y deja una incidencia abierta. Solo
 * actúa si sigue en `created`, así nunca pisa un estado posterior.
 */
async function markUncertain(db: Database, chargeId: string, reason: string) {
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(charges)
      .set({
        status: "qr_uncertain",
        creationResult: "uncertain",
        updatedAt: new Date(),
      })
      .where(and(eq(charges.id, chargeId), eq(charges.status, "created")))
      .returning({ id: charges.id });

    if (updated.length > 0) {
      await tx.insert(paymentIncidents).values({
        chargeId,
        type: "qr_creation_uncertain",
        reason,
      });
    }
  });
  // Solo identificadores: sin importes, cuentas ni secretos.
  console.warn(
    JSON.stringify({ event: "qr_creation_uncertain", chargeId, reason }),
  );
}

/** Pey rechazó el enlace (HTTP 400). No existe y esta intención no se reintenta. */
async function markRejected(db: Database, chargeId: string, errorType: string) {
  const type = /^[A-Z_]{1,64}$/.test(errorType) ? errorType : "INVALID_REQUEST";
  await db.transaction(async (tx) => {
    const updated = await tx
      .update(charges)
      .set({
        status: "qr_uncertain",
        creationResult: "rejected",
        updatedAt: new Date(),
      })
      .where(and(eq(charges.id, chargeId), eq(charges.status, "created")))
      .returning({ id: charges.id });

    if (updated.length > 0) {
      await tx.insert(paymentIncidents).values({
        chargeId,
        type: "other",
        reason: type,
      });
    }
  });
  console.warn(
    JSON.stringify({
      event: "payment_link_rejected",
      chargeId,
      errorType: type,
    }),
  );
}

/**
 * Pone al día las transiciones que dependen solo del tiempo, SIEMPRE en el
 * servidor y al leer el cobro (el reloj del cliente nunca decide):
 *  - `created` sin resolver tras `STALE_CREATED_MS` → `qr_uncertain`.
 *  - `waiting_payment` con `expires_at` vencido → `expired`.
 *
 * `expired` NO es «pago rechazado» ni impide registrar un pago tardío (RN, UX
 * §6): solo describe que el QR dejó de estar vigente. Los UPDATE son
 * condicionales al estado actual, así nunca pisan un estado posterior (p. ej.
 * un `paid` que llegue en paralelo).
 */
async function settleCharge(
  deps: Pick<ChargesDeps, "db" | "now">,
  merchantId: string,
  found: NonNullable<Awaited<ReturnType<typeof loadCharge>>>,
) {
  const now = (deps.now ?? (() => new Date()))();
  const { charge } = found;

  const isStaleCreated =
    charge.status === "created" &&
    now.getTime() - charge.createdAt.getTime() > STALE_CREATED_MS;
  const isExpired =
    charge.status === "waiting_payment" &&
    charge.expiresAt !== null &&
    charge.expiresAt.getTime() <= now.getTime();

  if (!isStaleCreated && !isExpired) return found;

  if (isStaleCreated) {
    await markUncertain(
      deps.db,
      charge.id,
      charge.collectionMethod === "pn"
        ? "La solicitud de notificación quedó sin resolver; no se sabe si Pey la envió."
        : charge.collectionMethod === "link"
          ? "La solicitud del enlace quedó sin resolver; no se sabe si Pey lo creó."
          : "La solicitud de QR quedó sin resolver; no se sabe si Pey la creó.",
    );
  } else {
    await deps.db
      .update(charges)
      .set({ status: "expired", updatedAt: now })
      .where(
        and(
          eq(charges.id, charge.id),
          eq(charges.status, "waiting_payment"),
          lte(charges.expiresAt, now),
        ),
      );
  }

  return (
    (await loadCharge(deps.db, merchantId, eq(charges.id, charge.id))) ?? found
  );
}

/** Referencia numérica de Pey sin colisión con QR todavía vigentes. */
async function pickNumRef(deps: ChargesDeps, now: Date): Promise<number> {
  const next = deps.nextNumRef ?? randomNumRef;
  for (let attempt = 0; attempt < MAX_NUM_REF_ATTEMPTS; attempt++) {
    const candidate = next();
    const [qrInUse] = await deps.db
      .select({ id: codiQrs.id })
      .from(codiQrs)
      .where(and(eq(codiQrs.numRef, candidate), gt(codiQrs.expiresAt, now)))
      .limit(1);
    const [pushInUse] = await deps.db
      .select({ id: codiNotifications.id })
      .from(codiNotifications)
      .where(
        and(
          eq(codiNotifications.numRef, candidate),
          gt(codiNotifications.expiresAt, now),
        ),
      )
      .limit(1);
    if (!qrInUse && !pushInUse) return candidate;
  }
  throw new Error("No se pudo asignar una referencia numérica libre.");
}

/** Un resultado «created» solo vale si trae id, qrString y una vigencia futura. */
function validateCreated(
  outcome: Extract<CreateQrOutcome, { status: "created" }>,
  now: Date,
): string | null {
  if (!outcome.peyQrId?.trim())
    return "Pey no devolvió el identificador del QR.";
  if (!outcome.qrString?.trim()) return "Pey no devolvió el contenido del QR.";
  if (
    !(outcome.expiresAt instanceof Date) ||
    Number.isNaN(outcome.expiresAt.getTime()) ||
    outcome.expiresAt.getTime() <= now.getTime()
  ) {
    return "Pey devolvió una vigencia no válida.";
  }
  return null;
}

function validatePush(
  outcome: Extract<CreatePushOutcome, { status: "created" }>,
  now: Date,
): string | null {
  if (!outcome.transactionId?.trim() || outcome.transactionId.length > 128) {
    return "Pey no devolvió el identificador de la notificación.";
  }
  if (!outcome.codiId || !canonicalCodiId(outcome.codiId)) {
    return "Pey no devolvió el folio de la notificación.";
  }
  if (
    !(outcome.expiresAt instanceof Date) ||
    Number.isNaN(outcome.expiresAt.getTime()) ||
    outcome.expiresAt.getTime() <= now.getTime()
  ) {
    return "Pey devolvió una vigencia no válida.";
  }
  return null;
}

/**
 * Crea (o recupera) la intención de cobro y solicita el QR o la notificación.
 *
 * Garantías:
 *  - La intención se persiste ANTES de llamar a Pey.
 *  - `(merchant_id, idempotency_key)` es único en BD: ante peticiones
 *    simultáneas o repetidas solo UNA ejecuta la llamada a Pey; el resto recibe
 *    el mismo cobro (`replayed`).
 *  - Se hace una sola llamada a Pey por intención, sin reintentos. Si el
 *    resultado es incierto, el cobro queda en `qr_uncertain` con una incidencia
 *    abierta y NO se pide otro instrumento automáticamente.
 *  - `waiting_payment` y la fila del QR o de la notificación se escriben juntos,
 *    y solo con una respuesta real y válida.
 */
export async function createCharge(
  deps: ChargesDeps,
  merchantId: string,
  input: ChargeRequest,
): Promise<CreateChargeResult> {
  const { db, pey } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const method = input.method ?? "qr";
  const phone =
    method === "pn" ? normalizeMxPhone(input.phoneNumber ?? "") : null;
  if (method === "pn" && !phone) {
    throw new Error(
      "El cobro por notificación requiere un celular de 10 dígitos.",
    );
  }
  const hashedPhone = phone ? phoneHash(phone) : null;
  const concept = normalizeConcept(input.concept);

  const [merchant] = await db
    .select({ peyBankAccountId: merchants.peyBankAccountId })
    .from(merchants)
    .where(eq(merchants.id, merchantId))
    .limit(1);
  if (!merchant) return { ok: false, error: "merchant_not_found" };

  const [inserted] = await db
    .insert(charges)
    .values({
      merchantId,
      amountCents: input.amountCents,
      idempotencyKey: input.idempotencyKey,
      collectionMethod: method,
      phoneHash: hashedPhone,
      phoneLast4: phone ? phoneLast4(phone) : null,
      concept,
    })
    .onConflictDoNothing({
      target: [charges.merchantId, charges.idempotencyKey],
    })
    .returning();

  // Repetición: misma intención → mismo registro, sin tocar a Pey.
  if (!inserted) {
    const existing = await loadCharge(
      db,
      merchantId,
      eq(charges.idempotencyKey, input.idempotencyKey),
    );
    if (!existing) {
      // Imposible salvo borrado concurrente; se trata como error interno.
      throw new Error("Cobro idempotente no encontrado tras el conflicto.");
    }
    const existingMethod = methodOf(existing.charge.collectionMethod);
    if (
      existing.charge.amountCents !== input.amountCents ||
      existingMethod !== method ||
      existing.charge.concept !== concept ||
      (method === "pn" && existing.charge.phoneHash !== hashedPhone)
    ) {
      return { ok: false, error: "idempotency_conflict" };
    }
    const settled = await settleCharge(deps, merchantId, existing);
    return {
      ok: true,
      charge: toDto(settled.charge, settled.qr, settled.link),
      replayed: true,
    };
  }

  // Intención nueva: única llamada a Pey.
  const numRef = await pickNumRef(deps, now);
  const reference = chargeReference(inserted.id);

  let outcome: CreateQrOutcome | CreatePushOutcome | CreatePaymentLinkOutcome;
  try {
    const request = {
      chargeId: inserted.id,
      amountCents: inserted.amountCents,
      concept: concept ?? `Cobro ${reference}`,
      numRef,
      expirationSeconds: QR_EXPIRATION_SECONDS,
      bankAccountId: merchant.peyBankAccountId,
    };
    if (method === "link") {
      outcome = await pey.createPaymentLink({
        chargeId: inserted.id,
        amountCents: inserted.amountCents,
        expirationSeconds: QR_EXPIRATION_SECONDS,
        ...paymentLinkReturnUrls(),
      });
    } else {
      outcome =
        method === "pn"
          ? await pey.createCodiPush({ ...request, phoneNumber: phone! })
          : await pey.createCodiQr(request);
    }
  } catch {
    // Un adaptador que lanza se trata igual que un timeout: incierto.
    outcome = {
      status: "uncertain",
      reason: "Error inesperado al llamar a Pey.",
    };
  }

  if (outcome.status === "created" && !("url" in outcome)) {
    const invalid =
      "qrString" in outcome
        ? validateCreated(outcome, now)
        : validatePush(outcome, now);
    if (invalid) {
      outcome = { status: "uncertain", reason: invalid };
    }
  }

  if (outcome.status === "rejected") {
    await markRejected(db, inserted.id, outcome.errorType);
    const settled = await loadCharge(
      db,
      merchantId,
      eq(charges.id, inserted.id),
    );
    return {
      ok: true,
      charge: toDto(settled!.charge, settled!.qr, settled!.link),
      replayed: false,
    };
  }

  if (outcome.status === "uncertain") {
    await markUncertain(db, inserted.id, outcome.reason);
    const settled = await loadCharge(
      db,
      merchantId,
      eq(charges.id, inserted.id),
    );
    return {
      ok: true,
      charge: toDto(settled!.charge, settled!.qr, settled!.link),
      replayed: false,
    };
  }

  try {
    await db.transaction(async (tx) => {
      if ("url" in outcome) {
        await tx.insert(paymentLinks).values({
          chargeId: inserted.id,
          peyPaymentLinkId: outcome.peyPaymentLinkId,
          url: outcome.url,
          expiresAt: outcome.expiresAt,
        });
      } else if ("qrString" in outcome) {
        await tx.insert(codiQrs).values({
          chargeId: inserted.id,
          peyQrId: outcome.peyQrId,
          numRef,
          qrPayload: outcome.qrString,
          expiresAt: outcome.expiresAt,
        });
      } else {
        await tx.insert(codiNotifications).values({
          chargeId: inserted.id,
          peyTransactionId: outcome.transactionId,
          codiId: outcome.codiId,
          numRef,
          phoneLast4: phoneLast4(phone!),
          expiresAt: outcome.expiresAt,
        });
      }
      await tx
        .update(charges)
        .set({
          status: "waiting_payment",
          expiresAt: outcome.expiresAt,
          updatedAt: new Date(),
        })
        .where(and(eq(charges.id, inserted.id), eq(charges.status, "created")));
    });
  } catch {
    // Pey pudo haber creado el instrumento pero no se pudo guardar: no se
    // expone y se trata como incierto.
    await markUncertain(
      db,
      inserted.id,
      method === "pn"
        ? "Pey envió la notificación pero no se pudo persistir en CobraVoz."
        : method === "link"
          ? "Pey creó el enlace pero no se pudo persistir en CobraVoz."
          : "Pey creó el QR pero no se pudo persistir en CobraVoz.",
    );
  }

  const settled = await loadCharge(db, merchantId, eq(charges.id, inserted.id));
  return {
    ok: true,
    charge: toDto(settled!.charge, settled!.qr, settled!.link),
    replayed: false,
  };
}

/** Cobro del comercio indicado, o `null` (también si es de otro comercio). */
export type SettledCharge = {
  charge: ChargeDto;
  /** Id del QR en Pey. `null` si ese QR nunca se confirmó o el cobro es push. */
  peyQrId: string | null;
  /** `transactionId` de la notificación. `null` si nunca se confirmó o es QR. */
  peyTransactionId: string | null;
  /** Id del enlace en Pey. `null` si nunca se confirmó. */
  peyPaymentLinkId: string | null;
};

/**
 * Lee el cobro del comercio y aplica el vencimiento por tiempo. Incluye el
 * id de Pey, que el DTO público no expone, para poder conciliar.
 */
export async function loadSettledCharge(
  deps: Pick<ChargesDeps, "db" | "now">,
  merchantId: string,
  chargeId: string,
): Promise<SettledCharge | null> {
  const found = await loadCharge(deps.db, merchantId, eq(charges.id, chargeId));
  if (!found) return null;
  const settled = await settleCharge(deps, merchantId, found);
  return {
    charge: toDto(settled.charge, settled.qr, settled.link),
    peyQrId: settled.qr?.peyQrId ?? null,
    peyTransactionId: settled.notification?.peyTransactionId ?? null,
    peyPaymentLinkId: settled.link?.peyPaymentLinkId ?? null,
  };
}

export async function getCharge(
  deps: Pick<ChargesDeps, "db" | "now">,
  merchantId: string,
  chargeId: string,
): Promise<ChargeDto | null> {
  const settled = await loadSettledCharge(deps, merchantId, chargeId);
  return settled?.charge ?? null;
}

const RESUMABLE_STATUSES = [
  "created",
  "waiting_payment",
  "qr_uncertain",
] as const;

/**
 * Cobro que Inicio puede ofrecer al reabrir la app (UF-07). El más reciente
 * que sigue en curso o sin QR confirmado. Un cobro ya pagado no se anuncia.
 */
export async function findResumableCharge(
  deps: Pick<ChargesDeps, "db" | "now">,
  merchantId: string,
): Promise<ChargeDto | null> {
  const rows = await deps.db
    .select({
      charge: charges,
      qr: codiQrs,
      notification: codiNotifications,
      link: paymentLinks,
    })
    .from(charges)
    .leftJoin(codiQrs, eq(codiQrs.chargeId, charges.id))
    .leftJoin(codiNotifications, eq(codiNotifications.chargeId, charges.id))
    .leftJoin(paymentLinks, eq(paymentLinks.chargeId, charges.id))
    .where(
      and(
        eq(charges.merchantId, merchantId),
        inArray(charges.status, [...RESUMABLE_STATUSES]),
      ),
    )
    .orderBy(desc(charges.createdAt))
    .limit(5);

  for (const row of rows) {
    const settled = await settleCharge(deps, merchantId, row);
    if (
      settled.charge.status === "created" ||
      settled.charge.status === "waiting_payment" ||
      settled.charge.status === "qr_uncertain"
    ) {
      return toDto(settled.charge, settled.qr, settled.link);
    }
  }
  return null;
}

export type CloseChargeResult =
  | { ok: true; charge: ChargeDto; alreadyClosed: boolean }
  /** El cobro no existe o es de otro comercio (indistinguibles). */
  | { ok: false; error: "not_found" }
  /** Solo se puede cerrar un cobro que espera pago; se devuelve el estado real. */
  | { ok: false; error: "not_closable"; charge: ChargeDto };

/**
 * «Cerrar cobro» (UF-04): cierre LOCAL de un cobro que espera pago.
 *
 * Solo cambia el estado en CobraVoz: no cancela nada en el banco ni borra el
 * QR ni impide conciliar un pago tardío (RN, Architecture §7). Por eso:
 *  - Solo se cierra desde `waiting_payment`; un cobro `paid`, `expired`,
 *    incierto o en incidencia no se toca.
 *  - El UPDATE es condicional al estado: si en paralelo llegó un pago, gana el
 *    pago y la respuesta es `not_closable` con el estado real.
 *  - Repetir el cierre es idempotente (`alreadyClosed`).
 */
export async function closeCharge(
  deps: Pick<ChargesDeps, "db" | "now">,
  merchantId: string,
  chargeId: string,
): Promise<CloseChargeResult> {
  const now = (deps.now ?? (() => new Date()))();
  const where = eq(charges.id, chargeId);

  const found = await loadCharge(deps.db, merchantId, where);
  if (!found) return { ok: false, error: "not_found" };
  const settled = await settleCharge(deps, merchantId, found);

  if (settled.charge.status === "locally_closed") {
    return {
      ok: true,
      charge: toDto(settled.charge, settled.qr, settled.link),
      alreadyClosed: true,
    };
  }

  if (settled.charge.status === "waiting_payment") {
    const updated = await deps.db
      .update(charges)
      .set({ status: "locally_closed", closedAt: now, updatedAt: now })
      .where(and(where, eq(charges.status, "waiting_payment")))
      .returning({ id: charges.id });

    if (updated.length > 0) {
      const closed = await loadCharge(deps.db, merchantId, where);
      return {
        ok: true,
        charge: toDto(closed!.charge, closed!.qr, closed!.link),
        alreadyClosed: false,
      };
    }
  }

  // Cambió en paralelo (pago, cierre simultáneo...) o nunca fue cerrable.
  const current = (await loadCharge(deps.db, merchantId, where)) ?? settled;
  if (current.charge.status === "locally_closed") {
    return {
      ok: true,
      charge: toDto(current.charge, current.qr, current.link),
      alreadyClosed: true,
    };
  }
  return {
    ok: false,
    error: "not_closable",
    charge: toDto(current.charge, current.qr, current.link),
  };
}
