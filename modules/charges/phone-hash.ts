import { createHash } from "node:crypto";

/** Identifica el número sin guardarlo. Mismo celular, mismo hash. */
export function phoneHash(phone: string): string {
  return createHash("sha256").update(phone).digest("hex");
}
