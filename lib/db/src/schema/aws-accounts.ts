import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const awsAccountsTable = pgTable("aws_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  // Stored encrypted - in production use KMS or secrets manager
  accessKeyId: text("access_key_id").notNull(),
  secretAccessKey: text("secret_access_key").notNull(),
  region: text("region").notNull().default("us-east-1"),
  lastScanAt: timestamp("last_scan_at", { withTimezone: true }),
  lastScore: real("last_score"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertAwsAccountSchema = createInsertSchema(
  awsAccountsTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  lastScanAt: true,
  lastScore: true,
});
export type InsertAwsAccount = z.infer<typeof insertAwsAccountSchema>;
export type AwsAccount = typeof awsAccountsTable.$inferSelect;
