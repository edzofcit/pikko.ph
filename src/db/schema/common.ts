import { timestamp } from "drizzle-orm/pg-core";

export function timestamps() {
  return {
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  };
}

export type JsonObject = Record<string, unknown>;
