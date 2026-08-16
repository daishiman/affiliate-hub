import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * ASP (A8.net, もしもアフィリエイト, Amazon アソシエイト 等)
 */
export const asps = sqliteTable("asps", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  siteUrl: text("site_url"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 案件 (プログラム)。ASP ごとの広告主・報酬条件を保持する。
 */
export const programs = sqliteTable(
  "programs",
  {
    id: text("id").primaryKey(),
    aspId: text("asp_id")
      .notNull()
      .references(() => asps.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    advertiser: text("advertiser"),
    category: text("category"),
    // 成果1件あたりの報酬額 (円)。料率型の案件は rewardRate を使う。
    rewardAmount: integer("reward_amount"),
    // 売上に対する料率 (0.0 - 1.0)
    rewardRate: real("reward_rate"),
    status: text("status", { enum: ["active", "paused", "closed"] })
      .notNull()
      .default("active"),
    landingUrl: text("landing_url"),
    note: text("note"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("programs_asp_id_idx").on(t.aspId), index("programs_status_idx").on(t.status)],
);

/**
 * 成果 (コンバージョン)。ASP からの取り込み単位。
 */
export const conversions = sqliteTable(
  "conversions",
  {
    id: text("id").primaryKey(),
    programId: text("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    // 成果発生日 (日次集計の軸)
    occurredAt: integer("occurred_at", { mode: "timestamp" }).notNull(),
    // 確定 / 未確定 / 却下 — ASP は事後に確定状態を変えるため保持する
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    // 報酬額 (円)。確定前は見込み額。
    amount: integer("amount").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    // ASP 側の一意キー。再取り込み時の重複排除に使う。
    externalId: text("external_id"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("conversions_program_id_idx").on(t.programId),
    index("conversions_occurred_at_idx").on(t.occurredAt),
  ],
);

export type Asp = typeof asps.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Conversion = typeof conversions.$inferSelect;
