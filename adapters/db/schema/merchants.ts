import { boolean, index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { authUsers } from "drizzle-orm/supabase";
import { timestamps } from "./columns";

/**
 * Comercio del piloto. Solo guarda datos públicos no sensibles: las
 * credenciales de Pey viven en variables de entorno del servidor (RN-20).
 */
export const merchants = pgTable("merchants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  /** Zona IANA usada en CONSULTAS de reportes (día comercial); el UTC no se toca. */
  timezone: text("timezone").notNull().default("America/Mexico_City"),
  /** Identificador de la cuenta receptora ya registrada en Pey (`bankAccountId`). */
  peyBankAccountId: text("pey_bank_account_id").notNull(),
  /** Etiqueta no sensible para A02, p. ej. «Cuenta terminación 1234». */
  receivingAccountLabel: text("receiving_account_label"),
  ...timestamps,
}).enableRLS();

/** Vincula `auth.users` con un comercio. El alta pública vive en `/registro`. */
export const merchantUsers = pgTable(
  "merchant_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .unique("merchant_users_user_id_key")
      .references(() => authUsers.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (table) => [index("merchant_users_merchant_id_idx").on(table.merchantId)],
).enableRLS();

/** 1:1 con el comercio. */
export const merchantPreferences = pgTable("merchant_preferences", {
  id: uuid("id").primaryKey().defaultRandom(),
  merchantId: uuid("merchant_id")
    .notNull()
    .unique("merchant_preferences_merchant_id_key")
    .references(() => merchants.id, { onDelete: "restrict" }),
  voiceAnnouncementsEnabled: boolean("voice_announcements_enabled")
    .notNull()
    .default(true),
  ...timestamps,
}).enableRLS();
