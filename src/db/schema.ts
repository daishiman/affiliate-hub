import { sql } from "drizzle-orm";
import { index, integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * このファイルは 2 つのドメインを持つ。混ぜてはいけない。
 *
 *   1. 運営者ドメイン (asps / programs / conversions)
 *      運営者が受け取る報酬を管理する。非公開。
 *
 *   2. 読者ドメイン (categories 以降)
 *      読者に商品比較を提供する。公開。仕様書 §12 に対応。
 *
 * 仕様書 §4.7 / §17.4 により、ランキング計算は運営者ドメインを参照して
 * はならない。報酬額の大小が順位に影響した時点で仕様違反になる。
 * 分離は docs/spec/data-model-gap.md の「テスト方針」で静的に検査する。
 */

// ---------------------------------------------------------------------------
// 運営者ドメイン
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 読者ドメイン (仕様書 §12)
// ---------------------------------------------------------------------------

/**
 * カテゴリー。仕様書 §7 の /categories/{category} に対応する。
 */
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  // カテゴリーページ冒頭の一文説明 (§7)
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 人物 (著者 / 編集者 / 監修者)。
 *
 * 仕様書 §12 は author_ids / editor_ids / expert_ids を分けているが、
 * 同一人物が記事によって役割を変えるため、人物は 1 テーブルにまとめ、
 * 役割は articlePeople 側に持たせる。§4.2 の重複入力の禁止に従う。
 */
export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  bio: text("bio"),
  // 資格・専門性。§11.1 の ExpertCaution はこれが無い人物に使えない。
  credentials: text("credentials"),
  avatarAssetId: text("avatar_asset_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 広告・アフィリエイト表記 (§17.1)。
 *
 * 記事・AI 回答・WebMCP の 3 経路が同じ 1 行を参照する。
 * 経路ごとに文言を書くと §28 の「広告関係が 3 経路で一貫する」が破れる。
 */
export const disclosures = sqliteTable("disclosures", {
  id: text("id").primaryKey(),
  relationshipType: text("relationship_type", {
    enum: ["affiliate", "sponsored", "supplied", "loaned", "purchased"],
  }).notNull(),
  advertiserOrSupplier: text("advertiser_or_supplier"),
  editorialInfluence: text("editorial_influence", {
    enum: ["none", "limited", "declared"],
  })
    .notNull()
    .default("none"),
  // 読者に実際に表示する文言。§17.1 が要求する「判別できる表現」。
  visibleMessage: text("visible_message").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

/**
 * 商品。Phase 1 では最小限に留める。
 *
 * 仕様書 §12 の specifications / official_source_ids / image_asset_ids は
 * Phase 2 (検証データ基盤) で追加する。TestRun が無い状態で
 * specifications の構造だけ決めても作り直しになるため。
 */
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    modelNumber: text("model_number"),
    categoryId: text("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    releaseDate: integer("release_date", { mode: "timestamp" }),
    discontinuedAt: integer("discontinued_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("products_category_id_idx").on(t.categoryId)],
);

/**
 * 記事 (§12 Article)。
 */
export const articles = sqliteTable(
  "articles",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    type: text("type", {
      enum: ["ranking", "review", "comparison", "guide", "tool"],
    }).notNull(),
    title: text("title").notNull(),
    // 一文の結論 (§8)。要約ではなく結論を書く。
    summary: text("summary"),
    status: text("status", { enum: ["draft", "review", "published", "archived"] })
      .notNull()
      .default("draft"),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    disclosureId: text("disclosure_id").references(() => disclosures.id, {
      onDelete: "restrict",
    }),
    /**
     * 更新責任者。§28 運用 C1「更新責任者が存在」を満たすために持つ。
     * 仕様書 §12 には無いフィールドだが、完了条件側が要求している。
     */
    ownerId: text("owner_id").references(() => people.id, { onDelete: "restrict" }),
    publishedAt: integer("published_at", { mode: "timestamp" }),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    // 検証を実施した日 (§8 の「検証日」)
    testedAt: integer("tested_at", { mode: "timestamp" }),
    /**
     * 次回確認日。§28 運用 C3「記事ごとの次回確認日が存在」に対応。
     * testedAt (過去に検証した日) とは別概念なので独立して持つ。
     */
    nextReviewAt: integer("next_review_at", { mode: "timestamp" }),
    // 以下は表示用の文字列リスト。参照整合性が不要なので JSON で持つ。
    targetAudience: text("target_audience", { mode: "json" }).$type<string[]>(),
    suitableFor: text("suitable_for", { mode: "json" }).$type<string[]>(),
    notSuitableFor: text("not_suitable_for", { mode: "json" }).$type<string[]>(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("articles_status_idx").on(t.status),
    index("articles_category_id_idx").on(t.categoryId),
    index("articles_next_review_at_idx").on(t.nextReviewAt),
  ],
);

/**
 * 記事 ↔ 人物。role で著者・編集者・監修者を区別する。
 */
export const articlePeople = sqliteTable(
  "article_people",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    personId: text("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "restrict" }),
    role: text("role", { enum: ["author", "editor", "expert"] }).notNull(),
    // 同一役割内での表示順
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.personId, t.role] }),
    index("article_people_person_id_idx").on(t.personId),
  ],
);

/**
 * 記事 ↔ 商品。position が比較表・ランキングの表示順を決める。
 *
 * 注意: ランキングの「順位」はここではなく RankingModel による計算結果で
 * 決まる (Phase 2)。position は表示順の保存にすぎず、順位の正規データ源
 * として扱ってはならない (§27 の禁止依存)。
 */
export const articleProducts = sqliteTable(
  "article_products",
  {
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    position: integer("position").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.productId] }),
    index("article_products_product_id_idx").on(t.productId),
  ],
);

/**
 * 会話ブロック (§11)。
 */
export const conversationBlocks = sqliteTable(
  "conversation_blocks",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    speaker: text("speaker", {
      enum: ["ReaderQuestion", "GuideAnswer", "ReviewerNote", "ExpertCaution"],
    }).notNull(),
    // §11.2 で 40〜120 文字程度とされている。長さの検査は入力側で行う。
    body: text("body").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("conversation_blocks_article_id_idx").on(t.articleId)],
);

/**
 * FAQ。
 */
export const faqs = sqliteTable(
  "faqs",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("faqs_article_id_idx").on(t.articleId)],
);

/**
 * 更新履歴 (§22)。
 *
 * 訂正は元の誤りを隠さない。よってこのテーブルは追記のみで、
 * 既存行の更新・削除を行わない運用とする。
 */
export const updateLogs = sqliteTable(
  "update_logs",
  {
    id: text("id").primaryKey(),
    articleId: text("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    changedAt: integer("changed_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    changedById: text("changed_by_id").references(() => people.id, { onDelete: "set null" }),
    changeType: text("change_type", {
      enum: ["factual", "price", "ranking", "editorial", "correction"],
    }).notNull(),
    summary: text("summary").notNull(),
    reviewerId: text("reviewer_id").references(() => people.id, { onDelete: "set null" }),
  },
  (t) => [
    index("update_logs_article_id_idx").on(t.articleId),
    index("update_logs_changed_at_idx").on(t.changedAt),
  ],
);

// 運営者ドメイン
export type Asp = typeof asps.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type Conversion = typeof conversions.$inferSelect;

// 読者ドメイン
export type Category = typeof categories.$inferSelect;
export type Person = typeof people.$inferSelect;
export type Disclosure = typeof disclosures.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type ArticlePerson = typeof articlePeople.$inferSelect;
export type ArticleProduct = typeof articleProducts.$inferSelect;
export type ConversationBlock = typeof conversationBlocks.$inferSelect;
export type Faq = typeof faqs.$inferSelect;
export type UpdateLog = typeof updateLogs.$inferSelect;
