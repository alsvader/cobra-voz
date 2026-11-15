import { timestamp } from "drizzle-orm/pg-core";

/** `timestamptz` en UTC; la zona del comercio se aplica solo al consultar reportes. */
export const timestamptz = (name: string) =>
  timestamp(name, { withTimezone: true });

export const timestamps = {
  createdAt: timestamptz("created_at").notNull().defaultNow(),
  updatedAt: timestamptz("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
