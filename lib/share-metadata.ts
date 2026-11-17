/** Textos compartidos por las meta de Open Graph y la imagen de 1200×630. */

export const SITE_NAME = "CobraVoz";

export const SITE_DESCRIPTION =
  "Cobra fácilmente, sin dejar de atender tu negocio.";

export const LANDING_TITLE =
  "CobraVoz | Cobra con tu voz y sigue atendiendo tu negocio";

export const LANDING_DESCRIPTION =
  "Di el importe, confirma la cantidad y muestra un QR CoDi para recibir el pago. CobraVoz te avisa cuando el pago está verificado.";

export const OG_IMAGE_ALT = `${SITE_NAME}. ${SITE_DESCRIPTION}`;

/** Origen público. En producción tiene que ser el https real, no localhost. */
export function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}
