import {
  pgTable,
  text,
  serial,
  timestamp,
  integer,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { scansTable } from "./scans";

export const findingsTable = pgTable("findings", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id")
    .notNull()
    .references(() => scansTable.id, { onDelete: "cascade" }),
  service: text("service", {
    enum: ["iam", "s3", "ec2", "security_groups", "cloudtrail"],
  }).notNull(),
  checkId: text("check_id").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  severity: text("severity", {
    enum: ["critical", "high", "medium", "low", "informational"],
  }).notNull(),
  affectedResource: text("affected_resource").notNull(),
  recommendation: text("recommendation").notNull(),
  // JSON string for extra metadata
  metadataJson: text("metadata_json"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertFindingSchema = createInsertSchema(findingsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type Finding = typeof findingsTable.$inferSelect;
